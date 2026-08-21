// admin-provision — administrative bulk operations (service role).
// Auth: header x-sync-secret = vault secret `pubmed_sync_secret`, or an Admin user JWT.
// Body: { users?: [{email,name,role,title,credential}], profiles?: [{first,last,department,specialties,education,clinical_focus,bio,role_titles,photo_url,source_url}] }
//  - users: creates auth user (random one-time password, returned in the response; email confirmed,
//    needs_profile_setup) + profiles + faculty_profiles rows; skips existing emails.
//  - rotate_unused: re-randomises the password of every account that has never signed in
//    (optionally emailing each person their new one-time password).
//  - profiles: matched to profiles by last name (+ first initial); fills faculty_profiles fields only where empty,
//    imports the headshot into storage bucket public-assets/photos/<slug>.jpg and sets photo_url.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-sync-secret" } });
const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z]/g, "");
const slug = (s: string) => s.toLowerCase().replace(/,.*$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// One-time password: random, not derivable from the person's name.
function tempPassword() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ", a = "abcdefghijkmnopqrstuvwxyz", d = "23456789", s = "!@#$%&*?";
  const pick = (set: string, n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n))).map((v) => set[v % set.length]).join("");
  const raw = (pick(A, 2) + pick(a, 6) + pick(d, 3) + pick(s, 1)).split("");
  const order = crypto.getRandomValues(new Uint32Array(raw.length));
  return raw.map((c, i) => [order[i], c] as const).sort((x, y) => x[0] - y[0]).map((p) => p[1]).join("");
}

async function authorized(req: Request) {
  const secret = req.headers.get("x-sync-secret");
  if (secret) { const { data } = await admin.rpc("get_sync_secret"); if (data && data === secret) return true; }
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data: u } = await admin.auth.getUser(jwt); if (!u?.user) return false;
  const { data: p } = await admin.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  return p?.role === "Admin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (!(await authorized(req))) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const out: any = { users: [], profiles: [] };

  // ---------- 1. create accounts ----------
  for (const u of body.users || []) {
    const email = String(u.email || "").toLowerCase().trim(); if (!email) continue;
    const { data: existing } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (existing) { out.users.push({ email, status: "exists" }); continue; }
    const password = tempPassword();
    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: u.name } });
    if (error) { out.users.push({ email, status: "error", error: error.message }); continue; }
    const id = created.user.id;
    const initials = (u.name || "").replace(/,.*$/, "").split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
    // a DB trigger on auth.users already creates a bare profiles row → upsert to fill it in
    const { error: pe } = await admin.from("profiles").upsert({ id, email, name: u.name, initials, role: u.role || "Faculty", title: u.title || null, credential: u.credential || null, needs_profile_setup: true, login_approved: true }, { onConflict: "id" });
    if (pe) { out.users.push({ email, status: "profile_error", error: pe.message }); continue; }
    if (["Faculty", "Admin", "Resident", "Research Fellow", "APP", "NP", "PA", "RN", "CRC", "Statistician"].includes(u.role)) {
      await admin.from("faculty_profiles").upsert({ user_id: id, slug: slug(u.name), show_on_site: ["Faculty", "Admin", "Resident", "Research Fellow"].includes(u.role), pubmed_enabled: ["Faculty", "Admin"].includes(u.role) }, { onConflict: "user_id" });
    }
    out.users.push({ email, status: "created", temp_password: password });
  }

  // ---------- 1b. rotate passwords of accounts that have never signed in ----------
  // Body: { rotate_unused: true, notify?: boolean, limit?: number }
  // Old accounts were created with a name-derived password; this replaces those with random ones.
  if (body.rotate_unused) {
    out.rotated = [];
    const perPage = 200; let page = 1; const targets: { id: string; email: string }[] = [];
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) { out.rotate_error = error.message; break; }
      for (const u of data.users) if (!u.last_sign_in_at && u.email) targets.push({ id: u.id, email: u.email });
      if (data.users.length < perPage) break; page++;
    }
    const list = typeof body.limit === "number" ? targets.slice(0, body.limit) : targets;
    for (const t of list) {
      const password = tempPassword();
      const { error } = await admin.auth.admin.updateUserById(t.id, { password });
      if (error) { out.rotated.push({ email: t.email, status: "error", error: error.message }); continue; }
      await admin.from("profiles").update({ needs_profile_setup: true }).eq("id", t.id);
      let mailed = false;
      if (body.notify) {
        const { data: prof } = await admin.from("profiles").select("name").eq("id", t.id).maybeSingle();
        const first = (prof?.name || "").replace(/,.*$/, "").trim().split(/\s+/)[0] || "there";
        const html = `<p>Hi ${first},</p><p>Your Saint Luke's Neuroscience Research Hub account is ready at <a href="https://slresearchhub.com/login">slresearchhub.com</a>.</p>
<p><b>Username:</b> ${t.email}<br><b>One-time password:</b> <code style="font-size:16px">${password}</code></p>
<p>You'll be asked to choose your own password the first time you sign in. If you didn't expect this email, you can ignore it — the one-time password only works once.</p>
<p>— Saint Luke's Neuroscience Research Office</p>`;
        const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ to: t.email, subject: "Your Research Hub sign-in details", html, type: "account_credentials", from_name: "Saint Luke's Neuroscience Research Office" }),
        }).catch(() => null);
        mailed = !!r?.ok;
      }
      out.rotated.push({ email: t.email, status: "rotated", emailed: mailed, ...(body.notify ? {} : { temp_password: password }) });
    }
  }

  // ---------- 2. enrich faculty profiles ----------
  if ((body.profiles || []).length) {
    const { data: people } = await admin.from("profiles").select("id, name, email, title, department").in("role", ["Faculty", "Admin", "Resident", "Research Fellow", "APP", "NP", "PA"]);
    for (const p of body.profiles || []) {
      const match = (people || []).filter((x) => { const parts = x.name.replace(/,.*$/, "").trim().split(/\s+/); const lastOf = parts.slice(-1)[0]; const lastTwo = parts.slice(-2).join(" "); return norm(lastOf) === norm(p.last) || norm(lastTwo) === norm(p.last); })
        .filter((x) => norm(x.name).startsWith(norm(p.first).slice(0, 3)) || norm(x.name).includes(norm(p.first)));
      if (match.length !== 1) { out.profiles.push({ name: `${p.first} ${p.last}`, status: match.length ? "ambiguous" : "not_found" }); continue; }
      const person = match[0];
      const { data: fp } = await admin.from("faculty_profiles").select("*").eq("user_id", person.id).maybeSingle();
      const upd: any = { user_id: person.id, updated_at: new Date().toISOString() };
      if (!fp?.slug) upd.slug = slug(person.name);
      if (!fp?.bio && p.bio) upd.bio = p.bio;
      if (!fp?.education && p.education) upd.education = p.education;
      if (!fp?.clinical_focus && p.clinical_focus) upd.clinical_focus = p.clinical_focus;
      if ((!fp?.specialties || !fp.specialties.length) && p.specialties?.length) upd.specialties = p.specialties;
      if (!fp?.lab_website && p.source_url) upd.lab_website = p.source_url;
      // photo import → storage
      let photoStatus = "kept";
      if (!fp?.photo_url && p.photo_url) {
        try {
          const res = await fetch(p.photo_url.replace(/\/\d+x\d+\.jpg$/, "/600x700.jpg"));
          const buf = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
          const res2 = buf ? null : await fetch(p.photo_url);
          const bytes = buf || (res2 && res2.ok ? new Uint8Array(await res2.arrayBuffer()) : null);
          if (bytes) {
            const path = `photos/${upd.slug || fp?.slug || slug(person.name)}.jpg`;
            const { error: se } = await admin.storage.from("public-assets").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
            if (se) throw se;
            upd.photo_url = admin.storage.from("public-assets").getPublicUrl(path).data.publicUrl; photoStatus = "imported";
          } else photoStatus = "fetch_failed";
        } catch (e) { photoStatus = "error: " + String(e); }
      }
      const { error: ue } = await admin.from("faculty_profiles").upsert(upd, { onConflict: "user_id" });
      // profile title / department (only replace the generic placeholder title)
      const pu: any = {};
      if (p.department && !person.department) pu.department = p.department;
      if ((!person.title || /^Faculty - Neuroscience$/i.test(person.title)) && (p.role_titles?.length || p.department)) {
        pu.title = p.role_titles?.length ? p.role_titles[0] : (p.department === "Neurosurgery" ? "Neurosurgeon" : "Neurologist");
      }
      if (Object.keys(pu).length) await admin.from("profiles").update(pu).eq("id", person.id);
      out.profiles.push({ name: person.name, status: ue ? "error: " + ue.message : "updated", photo: photoStatus, fields: Object.keys(upd).filter((k) => k !== "user_id" && k !== "updated_at") });
    }
  }
  return json(out);
});
