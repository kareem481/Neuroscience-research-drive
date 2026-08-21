// sync-opportunities — weekly pull of neuroscience-relevant funding opportunities.
// Sources: Grants.gov search2 API (federal, incl. NIH/NINDS/DoD CDMRP) and the NIH Guide RSS.
// Auth: x-sync-secret (vault) or Admin JWT. Body: { keywords?: string[] }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-sync-secret" } });
const KEYWORDS = ["neurosurgery", "neurology", "neuroscience", "stroke", "traumatic brain injury", "spinal cord", "epilepsy", "glioma", "brain tumor", "neuro-oncology", "dementia", "parkinson"];
const FIELD = (t: string) => { t = t.toLowerCase(); const f: string[] = []; if (/neurosurg|spine|spinal|glioma|brain tumor|neuro-oncol|aneurysm|trauma/.test(t)) f.push("Neurosurgery"); if (/neurolog|stroke|epilep|dementia|alzheimer|parkinson|multiple sclerosis|headache|neuromuscular/.test(t)) f.push("Neurology"); if (/neuroscience|neural|brain|neuron/.test(t)) f.push("Neuroscience"); return f.length ? f : ["General"]; };
const mdy = (s: string | null | undefined) => { if (!s) return null; const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m) return `${m[3]}-${m[1]}-${m[2]}`; const d = new Date(s); return isNaN(+d) ? null : d.toISOString().slice(0, 10); };
const text = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

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
  const keywords: string[] = Array.isArray(body.keywords) && body.keywords.length ? body.keywords : KEYWORDS;
  const { data: log } = await admin.from("opportunity_sync_log").insert({ status: "running" }).select("id").single();
  const details: any[] = []; const rows = new Map<string, any>();
  try {
    // ---- Grants.gov ----
    for (const kw of keywords) {
      try {
        const r = await fetch("https://api.grants.gov/v1/api/search2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword: kw, oppStatuses: "forecasted|posted", rows: 50, sortBy: "openDate|desc" }) });
        const d = await r.json();
        const hits = d?.data?.oppHits || [];
        for (const h of hits) {
          const id = "grants.gov:" + h.id;
          if (rows.has(id)) continue;
          rows.set(id, { kind: "grant", title: h.title, sponsor: h.agencyName || h.agencyCode || "Federal", url: `https://www.grants.gov/search-results-detail/${h.id}`, deadline: mdy(h.closeDate), open_date: mdy(h.openDate), field: FIELD(h.title + " " + (h.agencyName || "")), summary: `${h.number || ""}${h.oppStatus ? " · " + h.oppStatus : ""}${h.docType ? " · " + h.docType : ""}`.replace(/^ · /, ""), source: "grants.gov", external_id: String(h.id), published: true });
        }
        details.push({ source: "grants.gov", keyword: kw, n: hits.length });
      } catch (e) { details.push({ source: "grants.gov", keyword: kw, error: String(e) }); }
    }
    // ---- NIH Guide (funding opportunities RSS) ----
    try {
      const r = await fetch("https://grants.nih.gov/grants/guide/newsfeed/fundingopps.xml");
      const xml = await r.text();
      const items = xml.split("<item>").slice(1);
      let n = 0;
      for (const it of items) {
        const title = text((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
        const link = text((it.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
        const desc = text((it.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "");
        const pub = (it.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
        const blob = (title + " " + desc).toLowerCase();
        if (!keywords.some((k) => blob.includes(k.toLowerCase())) && !/ninds|nia\b|nimh|nibib|brain/.test(blob)) continue;
        const id = "nih:" + (link.match(/(PA[RS]?-\d{2}-\d{3}|RFA-[A-Z]{2}-\d{2}-\d{3}|NOT-[A-Z]{2}-\d{2}-\d{3})/i) || [])[1] || link;
        if (rows.has(id)) continue;
        const exp = (desc.match(/Expiration Date:?\s*([A-Za-z]+ \d{1,2}, \d{4})/) || [])[1];
        rows.set(id, { kind: /NOT-/.test(id) ? "training" : "grant", title, sponsor: "NIH", url: link, deadline: mdy(exp), open_date: mdy(pub), field: FIELD(blob), summary: desc.slice(0, 400), source: "nih", external_id: id.replace(/^nih:/, ""), published: true });
        n++;
      }
      details.push({ source: "nih-guide", n });
    } catch (e) { details.push({ source: "nih-guide", error: String(e) }); }

    const all = [...rows.values()];
    // drop opportunities already closed
    const today = new Date().toISOString().slice(0, 10);
    const live = all.filter((o) => !o.deadline || o.deadline >= today);
    let inserted = 0;
    for (let i = 0; i < live.length; i += 200) {
      const { data, error } = await admin.from("opportunities").upsert(live.slice(i, i + 200), { onConflict: "source,external_id", ignoreDuplicates: false }).select("id");
      if (error) throw error; inserted += (data || []).length;
    }
    // hide expired synced items
    await admin.from("opportunities").update({ published: false }).in("source", ["grants.gov", "nih"]).lt("deadline", today);
    await admin.from("opportunity_sync_log").update({ finished_at: new Date().toISOString(), status: "ok", found: all.length, inserted, details }).eq("id", log?.id);
    return json({ ok: true, found: all.length, upserted: inserted, details });
  } catch (e) {
    await admin.from("opportunity_sync_log").update({ finished_at: new Date().toISOString(), status: "error", error: String(e), details }).eq("id", log?.id);
    return json({ ok: false, error: String(e), details }, 500);
  }
});
