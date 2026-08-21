// sync-pubmed — pulls publications from PubMed for every faculty member with
// pubmed_enabled = true and upserts them into public.publications, linking
// authors in publication_authors.
//
// Auth: either (a) header `x-sync-secret` matching vault secret `pubmed_sync_secret`
// (used by the nightly pg_cron job), or (b) a user JWT whose profile role is Admin
// (used by the "Sync now" button in the Hub admin panel).
//
// Body (optional JSON): { faculty_ids?: string[], since_year?: number, max_per_author?: number }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "slresearchhub";
const EMAIL = "aalmekkawi@saint-lukes.org";
// Default affiliation filter: Saint Luke's only (Kansas City alone pulls in UMKC/KU/Children's Mercy homonyms).
// Per-faculty `pubmed_extra_query` can widen this (e.g. "Kansas City[Affiliation] OR UT Southwestern[Affiliation]").
const AFFIL = `("Saint Luke's"[Affiliation] OR "Saint Lukes"[Affiliation] OR "St. Luke's"[Affiliation] OR "St Luke's"[Affiliation] OR "St Lukes"[Affiliation] OR "Saint Luke's Hospital"[Affiliation] OR "Saint Luke's Health System"[Affiliation] OR "Marion Bloch"[Affiliation])`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function eutil(path: string, params: Record<string, string>, retries = 3): Promise<string> {
  const qs = new URLSearchParams({ ...params, tool: TOOL, email: EMAIL });
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${EUTILS}/${path}?${qs}`);
    if (res.ok) return await res.text();
    if (res.status === 429) { await sleep(1200 * (i + 1)); continue; }
    throw new Error(`${path} ${res.status}`);
  }
  throw new Error(`${path} rate limited`);
}

// ---------- minimal XML helpers (PubMed efetch XML) ----------
function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`));
  return m ? m[1] : null;
}
function tags(xml: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "g");
  let m; while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}
function text(s: string | null): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/\s+/g, " ").trim();
}
const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
function isoDate(block: string | null): string | null {
  if (!block) return null;
  const y = text(tag(block, "Year")); if (!y) return null;
  let m = text(tag(block, "Month")) || "01"; const d = text(tag(block, "Day")) || "01";
  if (isNaN(+m)) m = MONTHS[m.slice(0, 3).toLowerCase()] || "01";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseArticle(xmlRaw: string) {
  const xml = xmlRaw.replace(/<ReferenceList>[\s\S]*?<\/ReferenceList>/g, "");   // don't pick up cited-article DOIs
  const pmid = text(tag(tag(xml, "MedlineCitation") || "", "PMID"));
  const art = tag(xml, "Article") || "";
  const title = text(tag(art, "ArticleTitle"));
  const journalBlock = tag(art, "Journal") || "";
  const journal = text(tag(journalBlock, "Title"));
  const journal_abbrev = text(tag(journalBlock, "ISOAbbreviation"));
  const issueBlock = tag(journalBlock, "JournalIssue") || "";
  const volume = text(tag(issueBlock, "Volume")) || null;
  const issue = text(tag(issueBlock, "Issue")) || null;
  const pages = text(tag(art, "MedlinePgn")) || null;
  const pubDate = isoDate(tag(issueBlock, "PubDate"));
  let epub: string | null = null;
  for (const ad of tags(art, "ArticleDate")) { if (/DateType="Electronic"/.test(ad) || !epub) epub = isoDate(ad); }
  const yearStr = text(tag(tag(issueBlock, "PubDate") || "", "Year")) || text(tag(tag(issueBlock, "PubDate") || "", "MedlineDate")).slice(0, 4);
  const year = yearStr ? parseInt(yearStr, 10) : (epub ? +epub.slice(0, 4) : null);
  const abstract = tags(tag(art, "Abstract") || "", "AbstractText").map((a, _i, arr) => {
    const lbl = (a.match(/Label="([^"]+)"/) || [])[1];
    return arr.length > 1 && lbl ? `${lbl}: ${text(a)}` : text(a);
  }).join("\n\n") || null;
  const authors = tags(tag(art, "AuthorList") || "", "Author").map((a) => {
    const last = text(tag(a, "LastName")), fore = text(tag(a, "ForeName")), init = text(tag(a, "Initials"));
    const coll = text(tag(a, "CollectiveName"));
    const affiliation = text(tag(tag(a, "AffiliationInfo") || "", "Affiliation")) || null;
    return { name: coll || `${fore} ${last}`.trim(), last: last || coll, initials: init, affiliation };
  });
  const author_string = authors.map((a) => a.last && a.initials ? `${a.last} ${a.initials}` : a.name).join(", ");
  const pub_types = tags(tag(art, "PublicationTypeList") || "", "PublicationType").map(text);
  const mesh = tags(tag(xml, "MeshHeadingList") || "", "DescriptorName").map(text);
  const keywords = tags(tag(xml, "KeywordList") || "", "Keyword").map(text);
  let doi: string | null = null, pmcid: string | null = null;
  const idRe = /<ArticleId IdType="(doi|pmc)">([^<]+)<\/ArticleId>/g; let m;
  while ((m = idRe.exec(xml))) { if (m[1] === "doi") doi = m[2]; else pmcid = m[2]; }
  let pub_type = "Journal Article";
  if (pub_types.some((t) => /Review/.test(t))) pub_type = "Review";
  if (pub_types.some((t) => /Case Reports/.test(t))) pub_type = "Case Report";
  if (pub_types.some((t) => /Clinical Trial|Randomized/.test(t))) pub_type = "Clinical Trial";
  if (pub_types.some((t) => /Editorial|Comment|Letter/.test(t))) pub_type = "Editorial / Letter";
  if (pub_types.some((t) => /Meta-Analysis|Systematic Review/.test(t))) pub_type = "Systematic Review / Meta-Analysis";
  return { pmid, doi, pmcid, title, authors, author_string, journal, journal_abbrev, volume, issue, pages, year, pub_date: pubDate, epub_date: epub, abstract, keywords, mesh_terms: mesh, pub_types, pub_type,
    source: "pubmed", url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` };
}

function normLast(s: string) { return s.toLowerCase().replace(/[^a-z]/g, ""); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ---- auth ----
  let authorized = false;
  const secret = req.headers.get("x-sync-secret");
  if (secret) {
    const { data } = await admin.rpc("get_sync_secret");
    authorized = !!data && data === secret;
  }
  if (!authorized) {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (jwt) {
      const { data: u } = await admin.auth.getUser(jwt);
      if (u?.user) {
        const { data: prof } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
        authorized = prof?.role === "Admin";
      }
    }
  }
  if (!authorized) return json({ error: "unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const sinceYear: number | null = body.since_year ?? null;
  const maxPer: number = body.max_per_author ?? 300;

  const { data: log } = await admin.from("pubmed_sync_log").insert({}).select("id").single();
  const logId = log?.id;
  const details: any[] = [];
  let found = 0, inserted = 0, updated = 0, skipped = 0;

  try {
    let q = admin.from("faculty_profiles").select("user_id, pubmed_author_terms, pubmed_affiliation_filter, pubmed_extra_query, orcid, profiles!inner(name)").eq("pubmed_enabled", true);
    if (Array.isArray(body.faculty_ids) && body.faculty_ids.length) q = q.in("user_id", body.faculty_ids);
    const { data: faculty, error: fe } = await q;
    if (fe) throw fe;

    // 1. esearch per faculty → pmid set with faculty matches
    const pmidOwners = new Map<string, Set<string>>();      // pmid -> faculty user_ids
    const facultyTerms = new Map<string, string[]>();
    const facultyExtra = new Map<string, string>();
    const orcidOwners = new Set<string>();
    for (const f of faculty || []) {
      if (f.pubmed_extra_query) facultyExtra.set(f.user_id, f.pubmed_extra_query);
      const terms = (f.pubmed_author_terms || []).filter(Boolean);
      if (!terms.length) continue;
      facultyTerms.set(f.user_id, terms);
      let term = "(" + terms.map((t: string) => `${t}[Author]`).join(" OR ") + ")";
      if (f.pubmed_affiliation_filter) term += ` AND (${AFFIL}${f.pubmed_extra_query ? " OR (" + f.pubmed_extra_query + ")" : ""})`;
      else if (f.pubmed_extra_query) term += ` AND (${f.pubmed_extra_query})`;
      // ORCID (when set) is authoritative: include every paper PubMed has linked to the ORCID iD, regardless of affiliation.
      const orcid = String(f.orcid || "").replace(/^https?:\/\/orcid\.org\//i, "").trim();
      if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(orcid)) { term = `(${term}) OR ${orcid}[auid]`; orcidOwners.add(f.user_id); }
      if (sinceYear) term += ` AND ${sinceYear}:3000[dp]`;
      try {
        const xml = await eutil("esearch.fcgi", { db: "pubmed", term, retmax: String(maxPer), retmode: "json" });
        const ids: string[] = JSON.parse(xml)?.esearchresult?.idlist || [];
        for (const id of ids) { if (!pmidOwners.has(id)) pmidOwners.set(id, new Set()); pmidOwners.get(id)!.add(f.user_id); }
        details.push({ faculty: (f as any).profiles?.name, count: ids.length });
      } catch (e) {
        details.push({ faculty: (f as any).profiles?.name, error: String(e) });
      }
      await sleep(350); // NCBI: ≤3 req/s without API key
    }
    const allPmids = [...pmidOwners.keys()];
    found = allPmids.length;

    // 2. which already exist?
    const existing = new Map<string, string>();
    for (let i = 0; i < allPmids.length; i += 500) {
      const { data } = await admin.from("publications").select("id, pmid").in("pmid", allPmids.slice(i, i + 500));
      for (const r of data || []) existing.set(r.pmid, r.id);
    }

    // 3. efetch in batches of 100 and upsert
    for (let i = 0; i < allPmids.length; i += 100) {
      const batch = allPmids.slice(i, i + 100);
      const xml = await eutil("efetch.fcgi", { db: "pubmed", id: batch.join(","), retmode: "xml" });
      const articles = tags(xml, "PubmedArticle");
      const parsed = articles.map(parseArticle).filter((a) => a.pmid && a.title);
      // Homonym guard: look at the affiliation PubMed lists for the *matched* author (available on most papers since ~2014).
      //  - affiliation mentions Saint Luke's (or the faculty's extra-query institutions) → confirmed, visible
      //  - affiliation present but clearly elsewhere → skip (different person with the same name)
      //  - no per-author affiliation → import hidden with a review note so an admin can confirm
      const rows: any[] = []; const linkPlan = new Map<string, any[]>();
      for (const r of parsed) {
        const owners = pmidOwners.get(r.pmid) || new Set();
        const links: any[] = []; let confirmed = false, unknown = false, rejected = 0;
        for (const uid of owners) {
          const terms = facultyTerms.get(uid) || [];
          const lasts = terms.map((t) => normLast(t.replace(/\s+[A-Z]+$/, "")));
          const pos = (r.authors as any[]).findIndex((a) => lasts.includes(normLast(a.last || "")));
          const aff = pos >= 0 ? String((r.authors as any[])[pos].affiliation || "") : "";
          const extra = String(facultyExtra.get(uid) || "").toLowerCase().replace(/\[affiliation\]/g, "").split(/\bor\b|\band\b/).map((x) => x.replace(/[()"]/g, "").trim()).filter((x) => x.length > 3);
          const ok = orcidOwners.has(uid) || /luke/i.test(aff) || /marion bloch/i.test(aff) || extra.some((x) => aff.toLowerCase().includes(x));
          if (aff && !ok) { rejected++; continue; }
          if (orcidOwners.has(uid) || aff) confirmed = true; else unknown = true;
          links.push({ publication_id: null, profile_id: uid, author_position: pos >= 0 ? pos + 1 : null, matched_term: terms[0] });
        }
        if (!links.length) { skipped++; continue; }
        const row: any = { ...r, updated_at: new Date().toISOString() };
        if (!existing.has(r.pmid)) { row.visible = confirmed; row.notes = confirmed ? null : "Unverified author match (no affiliation listed for this author on PubMed) — review and make visible if correct."; }
        rows.push(row); linkPlan.set(r.pmid, links);
      }
      if (!rows.length) { await sleep(350); continue; }
      const { data: up, error: ue } = await admin.from("publications").upsert(rows, { onConflict: "pmid", ignoreDuplicates: false }).select("id, pmid");
      if (ue) throw ue;
      for (const r of up || []) {
        if (existing.has(r.pmid)) updated++; else inserted++;
        const links = (linkPlan.get(r.pmid) || []).map((l) => ({ ...l, publication_id: r.id }));
        if (links.length) await admin.from("publication_authors").upsert(links, { onConflict: "publication_id,profile_id" });
      }
      await sleep(350);
    }

    await admin.from("faculty_profiles").update({ last_pubmed_sync: new Date().toISOString() }).in("user_id", [...facultyTerms.keys()]);
    await admin.from("pubmed_sync_log").update({ finished_at: new Date().toISOString(), status: "ok", faculty_count: facultyTerms.size, found, inserted, updated, details: [{ skipped_homonyms: skipped }, ...details] }).eq("id", logId);
    return json({ ok: true, faculty: facultyTerms.size, found, inserted, updated, skipped, details });
  } catch (e) {
    await admin.from("pubmed_sync_log").update({ finished_at: new Date().toISOString(), status: "error", error: String(e), found, inserted, updated, details }).eq("id", logId);
    return json({ ok: false, error: String(e), details }, 500);
  }
});
