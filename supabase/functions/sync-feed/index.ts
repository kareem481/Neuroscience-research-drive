// sync-feed — daily "latest in neuroscience" literature feed.
// For each enabled row in feed_sources, asks PubMed for articles added in the last N days
// (edat = Entrez date) and upserts them into literature_feed. Auth: x-sync-secret (vault) or Admin JWT.
// Body: { days?: number (default 3), per_source?: number (default 15) }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-sync-secret" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tag = (x: string, n: string) => { const m = x.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`)); return m ? m[1] : null; };
const tags = (x: string, n: string) => { const out: string[] = []; const re = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`, "g"); let m; while ((m = re.exec(x))) out.push(m[1]); return out; };
const text = (s: string | null) => (s || "").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/\s+/g, " ").trim();
const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
function isoDate(b: string | null) { if (!b) return null; const y = text(tag(b, "Year")); if (!y) return null; let m = text(tag(b, "Month")) || "01"; const d = text(tag(b, "Day")) || "01"; if (isNaN(+m)) m = MONTHS[m.slice(0, 3).toLowerCase()] || "01"; return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }

async function eutil(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, tool: "slresearchhub", email: "aalmekkawi@saint-lukes.org" });
  for (let i = 0; i < 3; i++) { const r = await fetch(`${EUTILS}/${path}?${qs}`); if (r.ok) return await r.text(); if (r.status === 429) { await sleep(1500 * (i + 1)); continue; } throw new Error(`${path} ${r.status}`); }
  throw new Error(`${path} rate limited`);
}
async function authorized(req: Request) {
  const s = req.headers.get("x-sync-secret"); if (s) { const { data } = await admin.rpc("get_sync_secret"); if (data && data === s) return true; }
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); if (!jwt) return false;
  const { data: u } = await admin.auth.getUser(jwt); if (!u?.user) return false;
  const { data: p } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle(); return p?.role === "Admin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (!(await authorized(req))) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const days = Math.min(30, Math.max(1, +body.days || 3)), per = Math.min(50, Math.max(1, +body.per_source || 15));
  const { data: log } = await admin.from("feed_sync_log").insert({ status: "running" }).select("id").single();
  const details: any[] = []; let found = 0, inserted = 0;
  try {
    const { data: sources } = await admin.from("feed_sources").select("*").eq("enabled", true).order("sort_order");
    const owners = new Map<string, { field: string; name: string }>();
    for (const s of sources || []) {
      const term = `(${s.query}) AND ("last ${days} days"[edat]) NOT (Comment[pt] OR Erratum[pt] OR Retraction of Publication[pt] OR Published Erratum[pt])`;
      try {
        const r = JSON.parse(await eutil("esearch.fcgi", { db: "pubmed", term, retmax: String(per), sort: "date", retmode: "json" }));
        const ids: string[] = r?.esearchresult?.idlist || [];
        ids.forEach((id) => { if (!owners.has(id)) owners.set(id, { field: s.field, name: s.name }); });
        details.push({ source: s.name, n: ids.length });
      } catch (e) { details.push({ source: s.name, error: String(e) }); }
      await sleep(350);
    }
    const ids = [...owners.keys()]; found = ids.length;
    const existing = new Set<string>();
    for (let i = 0; i < ids.length; i += 500) { const { data } = await admin.from("literature_feed").select("pmid").in("pmid", ids.slice(i, i + 500)); (data || []).forEach((x) => existing.add(x.pmid)); }
    const fresh = ids.filter((id) => !existing.has(id));
    for (let i = 0; i < fresh.length; i += 100) {
      const xml = await eutil("efetch.fcgi", { db: "pubmed", id: fresh.slice(i, i + 100).join(","), retmode: "xml" });
      const rows = tags(xml, "PubmedArticle").map((a) => {
        const x = a.replace(/<ReferenceList>[\s\S]*?<\/ReferenceList>/g, "");
        const pmid = text(tag(tag(x, "MedlineCitation") || "", "PMID")); const art = tag(x, "Article") || "";
        const jb = tag(art, "Journal") || ""; const ib = tag(jb, "JournalIssue") || "";
        let epub: string | null = null; for (const ad of tags(art, "ArticleDate")) epub = epub || isoDate(ad);
        const authors = tags(tag(art, "AuthorList") || "", "Author").map((au) => { const l = text(tag(au, "LastName")), ini = text(tag(au, "Initials")); return l ? `${l} ${ini}`.trim() : text(tag(au, "CollectiveName")); }).filter(Boolean);
        const doiM = x.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
        const abstract = tags(tag(art, "Abstract") || "", "AbstractText").map((t) => { const lbl = (t.match(/Label="([^"]+)"/) || [])[1]; return lbl ? `${lbl}: ${text(t)}` : text(t); }).join(" ").slice(0, 1500) || null;
        const o = owners.get(pmid) || { field: null, name: null };
        return { pmid, title: text(tag(art, "ArticleTitle")), journal: text(tag(jb, "Title")) || o.name, journal_abbrev: text(tag(jb, "ISOAbbreviation")), field: o.field,
          authors: (authors.length > 6 ? authors.slice(0, 6).join(", ") + ", et al." : authors.join(", ")) || null,
          pub_date: epub || isoDate(tag(ib, "PubDate")), doi: doiM ? doiM[1] : null, abstract, pub_types: tags(tag(art, "PublicationTypeList") || "", "PublicationType").map(text), url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` };
      }).filter((r) => r.pmid && r.title);
      if (rows.length) { const { error } = await admin.from("literature_feed").upsert(rows, { onConflict: "pmid", ignoreDuplicates: true }); if (error) throw error; inserted += rows.length; }
      await sleep(350);
    }
    await admin.from("feed_sync_log").update({ finished_at: new Date().toISOString(), status: "ok", found, inserted, details }).eq("id", log?.id);
    return json({ ok: true, found, inserted, details });
  } catch (e) {
    await admin.from("feed_sync_log").update({ finished_at: new Date().toISOString(), status: "error", error: String(e), found, inserted, details }).eq("id", log?.id);
    return json({ ok: false, error: String(e) }, 500);
  }
});
