// send-notification-email — transactional email via Resend.
// From: "<Person name> via SL Research Hub <notifications@slresearchhub.com>" (verified domain);
// Reply-To: the person's own Saint Luke's address, so replies land in their inbox.
// Key: vault secret `resend_api_key` (fallback env RESEND_API_KEY).
// Body: { to: string|string[], subject, html?, text?, body?, from_name?, reply_to?: string|string[], type? }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const FROM_ADDRESS = Deno.env.get("RESEND_FROM_ADDRESS") || "notifications@slresearchhub.com";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (s: string) => String(s || "").replace(/[\r\n<>"]/g, "").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const p = await req.json();
    const to: string[] = (Array.isArray(p.to) ? p.to : [p.to]).filter(Boolean).map((x: string) => String(x).trim().toLowerCase());
    if (!to.length || !p.subject || !(p.html || p.body || p.text)) return json({ error: "Missing required fields: to, subject, and (html|body|text)" }, 400);

    let key = Deno.env.get("RESEND_API_KEY") || "";
    if (!key) { const { data } = await admin.rpc("get_vault_secret", { p_name: "resend_api_key" }); key = data || ""; }
    if (!key) { console.log("[email — no key] to:", to, "subject:", p.subject); return json({ success: true, logged: true, message: "No Resend key configured; email logged only." }); }

    // Resolve the acting person (caller JWT) for display name + reply-to, unless supplied
    let fromName = clean(p.from_name || "");
    let replyTo: string[] = (Array.isArray(p.reply_to) ? p.reply_to : p.reply_to ? [p.reply_to] : []).filter(Boolean);
    if (!fromName || !replyTo.length) {
      const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      if (jwt) { const { data: u } = await admin.auth.getUser(jwt); if (u?.user) { const { data: prof } = await admin.from("profiles").select("name,email").eq("id", u.user.id).maybeSingle(); if (prof) { fromName = fromName || clean(prof.name); if (!replyTo.length && prof.email) replyTo = [prof.email]; } } }
    }
    if (!replyTo.length) replyTo = ["aalmekkawi@saint-lukes.org"];            // research office fallback
    const from = `${fromName ? fromName + " via " : ""}SL Research Hub <${FROM_ADDRESS}>`;
    const html = p.html || p.body || null;
    const text = p.text || (html ? String(html).replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : p.body);

    const payload: Record<string, unknown> = { from, to, subject: p.subject, reply_to: replyTo, headers: { "X-Entity-Ref-ID": crypto.randomUUID() }, tags: [{ name: "type", value: clean(p.type || "notification").replace(/[^a-z0-9_-]/gi, "_") }] };
    if (html) payload.html = html; if (text) payload.text = text;
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { console.error("Resend error", data); return json({ success: false, error: data.message || "Resend API error", details: data }, res.status); }
    return json({ success: true, id: data.id, from, reply_to: replyTo });
  } catch (e) { console.error(e); return json({ error: String(e) }, 500); }
});
