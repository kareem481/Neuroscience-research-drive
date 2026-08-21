# Build contract — slresearchhub.com v2

Vanilla HTML/CSS/JS, no build step, deployed as static files on Vercel. Backend = Supabase project `noxyrovuuprygxuyhgik`.

## Files & load order (every page)
```html
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>… | Saint Luke's Neuroscience Research</title>
<meta name="description" content="…">
<link rel="icon" href="/assets/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/site.css">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="/assets/js/sl.js"></script>
</head><body> … <script>/* page code */</script></body></html>
```
Use **absolute** paths (`/assets/...`, `/hub/...`, `/docs.html`) everywhere. `sl.js` auto-computes `SL.root` but absolute is simpler.

## Shared runtime `window.SL` (assets/js/sl.js) — read the file
- `SL.sb` supabase client · `SL.esc/qs/qsa/param/fmtDate/fmtDateTime/initials/debounce/download/csv`
- `SL.toast(msg,'ok'|'err'|'warn')`, `SL.modal(html,{size:'lg'|'xl'})`, `SL.closeModal()`, `SL.confirm(msg)`
- `SL.icons.*` inline SVG strings (search, users, doc, book, flask, db, cal, chat, settings, edit, trash, plus, download, check, external, info, …)
- **Public pages:** `SL.renderShell({active:'publications'})` → injects topbar+footer. Page content lives in `<main>` you write.
- **Hub pages:** `const me = await SL.requireAuth({roles:[...]?})` then `SL.renderHubShell({active:'projects'})` → injects topbar + sidebar and moves your `<main id="main">` into the shell. `SL.profile`, `SL.user`, `SL.isAdmin()`, `SL.hasRole('Faculty','Admin')`.
- `SL.audit(action, entity_type, entity_id, details)`, `SL.notify(recipients[], type, message, extra)`, `SL.sendEmail(to[], subject, html)` (edge fn `send-notification-email`), `SL.upload(bucket, folder, file)` → public URL. Buckets: `research-files` (internal), `public-assets` (public: photos, doc PDFs).
- Publications helpers: `SL.pubCitation(p)`, `SL.pubBibtex(p)`, `SL.highlightAuthors(p, lastNames[])`.

## Design (assets/css/site.css) — v3 "Synapse": futuristic dark glass, animated
Deep-space background with ambient animated neural-network canvas (`SL.ambient()` — auto-called by both shells), glass cards (`.card` = translucent + blur + gradient hairline), cyan→violet gradient accents (`--grad`, `.grad-text`, `.btn-primary`), Space Grotesk headings, Inter body. Scroll-reveal is automatic (`SL.reveal()` tags `.section/.grid/.card/.pub/.stat`); stat tiles count up. Colour vars: text `--ink/--ink-2/--muted`, accents `--teal/--violet/--gold`, status `--ok/--warn/--danger/--info` (+ `-bg`). **Never hardcode light colours** (`#fff`, `#f6f7f9`, `#0b2545` etc.) in page `<style>` blocks — use the variables; legacy `--navy` now resolves to light text for backwards compatibility, so don't use it as a background. Fonts link: `family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700`. Charts: series palette cyan #22d3ee, violet #a78bfa, emerald #34d399, amber #fbbf24, rose #fb7185, sky #60a5fa; axis/grid `rgba(148,163,184,.25)`; labels `--muted`. Use existing classes: `.container .section .section-head .card .card-hover .grid .grid-3 .stat .btn .btn-primary/.btn-accent/.btn-outline/.btn-ghost/.btn-sm .tag .tag-teal/.tag-ok/... .input .field .form-row .filters .chips .chip .table-wrap .table .pub .pub-title .pub-meta .pub-authors .person .avatar .tabs .modal-* .empty .skeleton .alert-* .breadcrumb .prose .docs-layout .toc .hero .eyebrow .lead .page-head`. Add page-specific CSS in a `<style>` block only when needed; keep it consistent. Responsive: must work at 375px. No Font Awesome; no extra particle libraries (sl.js provides the ambient canvas).

## Supabase schema (public)
Auth: `profiles(id uuid=auth.uid, email, name, initials, role user_role enum, title, credential, department, phone, login_approved, needs_profile_setup)`; roles: Admin, IRB, Faculty, Resident, Medical Student, APP, NP, RN, PA, Research Fellow, CRC, Statistician, Budget & Contracts. Readable by authenticated only. SQL helpers `is_admin()`, `get_my_role()`.
Public-safe people view: `public_people(id, name, initials, role, title, credential, department, slug, photo_url, bio, research_interests, education, clinical_focus, lab_website, orcid, google_scholar, specialties text[], accepting_students, h_index, total_citations)` — anon readable.
`faculty_profiles(id bigint, user_id uuid unique, bio, research_interests, education, clinical_focus, lab_website, orcid, google_scholar, office_location, h_index, total_citations, accepting_students, slug, photo_url, show_on_site, specialties text[], pubmed_enabled, pubmed_author_terms text[], pubmed_affiliation_filter, pubmed_extra_query, last_pubmed_sync)` — owner or admin can update.
`publications(id uuid, pmid, doi, pmcid, title, authors jsonb[{name,last,initials,affiliation}], author_string, journal, journal_abbrev, volume, issue, pages, year, pub_date, epub_date, abstract, keywords text[], mesh_terms text[], pub_types text[], pub_type, source 'pubmed'|'manual', url, pdf_url, visible, featured, notes, created_by)` — anon sees visible=true; admin/creator edit. ~300 rows synced from PubMed.
`publication_authors(publication_id, profile_id, author_position, matched_term)` — links pubs to faculty. `publication_stats(year, n)` view.
`pubmed_sync_log(id, started_at, finished_at, status, faculty_count, found, inserted, updated, error, details jsonb)`. Trigger a sync (admin only): `SL.sb.rpc('trigger_pubmed_sync', {body: {}})` (async; poll the log) or `SL.sb.functions.invoke('sync-pubmed', {body:{faculty_ids?:[]}})` (sync, waits for result). Nightly cron 07:15 UTC.
`documents(id uuid, slug unique, title, category, summary, body_md, file_url, visibility 'public'|'internal'|'admin', tags text[], version, sort_order, published, created_by, updated_by, created_at, updated_at)`; `document_versions(document_id, version, title, body_md, file_url, saved_by, saved_at)` auto-filled by trigger on update. Categories: SOPs, IRB & Regulatory, Onboarding, Policies, Guides, Forms & Templates, Registry Manuals, Statistics.
`announcements(id bigint, title, content, priority, pinned, visibility 'public'|'internal', slug, image_url, created_by text(name), created_at)`.
`projects(id bigint, title, study_type, pillar, department, pi, disease_focus, co_investigators, abstract, umbrella_irb, status, phase, progress int, irb_approved, irb_protocol_number, irb_decision, irb_personnel text[], created_by uuid, admin_approved, approved_by, approved_at, protocol jsonb, irb_consent jsonb, budget jsonb, files jsonb, manuscript jsonb, notes, created_at)`; `project_members(project_id, member_name, member_role)`; `project_publications(project_id bigint, publication_id uuid, title)`.
`grants(title, pi, agency, mechanism, amount, period_start, period_end, status, grant_number, created_by)`, `deadlines(title, deadline_type, deadline_date, description, associated_item, created_by)`, `meetings(title, meeting_date, meeting_time, attendees, agenda, teams_link, location, recurring, created_by)`, `forum_posts(id, title, category, content, author_id, author_name, parent_id, resolved, pinned, created_at)`, `forum_requests(title, category, urgency, project_id, description, status, requested_by)`, `citi_training(user_id, human_subjects_status, certificate_url)`, `cme_records(user_id, credits_earned, credits_required, status, certificate_url)`, `student_assessments(student_id, assessment_date, responses jsonb, submitted_by)`, `student_records`, `notifications(type, message, from_user, from_email, recipients text[], read, project_id, project_title)`, `pending_login_approvals(email, name, role, title, status, requested_at)`, `audit_log(action, entity_type, entity_id text, details, user_id, user_name, user_role)`, `redcap_variables`.
Registries: `btr_patients` (+ btr_progressions, btr_surgeries, btr_radiation_treatments, btr_chemotherapy_regimens, btr_imaging_studies, btr_volumetric_measurements, btr_rano_assessments, btr_follow_ups, btr_clinical_trials, btr_trial_notes, btr_biobank_specimens, btr_tumor_board_meetings, btr_tumor_board_cases, btr_research_cohorts), `tbi_patients` (+ tbi_icp_readings, tbi_imaging, tbi_outcome_assessments, tbi_complications, tbi_follow_ups), `fnr_patients` (+ fnr_device_programming, fnr_seizure_logs, fnr_medications, fnr_outcome_assessments, fnr_follow_ups, fnr_neurophysiology). Column lists are in legacy/btr.js, legacy/tbi.js, legacy/fnr.js (insert statements). Authenticated read; Faculty/Admin update; admin delete.

## Legacy reference
`legacy/` holds the old app (index.html/app.js = hub features; btr/tbi/fnr = registries). Port *behaviour and data model*, not the markup or dark styling. Fix known bugs: dashboard stat order, forum/announcements/audit render targets, hardcoded admin emails (use `SL.isAdmin()` / `SL.ADMIN_EMAILS`), no role checks in registries (require `SL.hasRole('Admin','Faculty','Resident','Research Fellow','CRC','APP','NP','PA','RN','Statistician')` for write; Medical Students read-only).

## Rules
- Escape all user/db strings with `SL.esc` when injecting HTML.
- No `alert()/confirm()` — use `SL.toast` / `SL.confirm`.
- Loading states: show `.skeleton` rows, then render. Empty states: `.empty` with a short sentence.
- Every list page: search + filters + sensible sort + export CSV where it's data.
- Keep each page self-contained (HTML + `<script>`); share only via sl.js. Don't edit sl.js or site.css — if you need a helper, define it locally and mention it in your final report.
- Test by serving `python3 -m http.server 8123` from repo root and loading in Playwright/Chromium (preinstalled: `/opt/pw-browsers/chromium`), checking console for errors. Anonymous pages must render with real data; hub pages will redirect to login (that's expected — verify no JS errors before redirect).

## v3 additions (Aug 2026)
- `grants.is_public`, `grants.summary`, `grants.funding_type` + view `public_grants(id,title,pi,agency,mechanism,funding_type,amount,period_start,period_end,status,summary)` (anon readable). Hub grants editor must expose the "Show on public site" toggle + summary + funding_type.
- `service_requests(id, service, requester_name, requester_email, requester_id, project_id, details, urgency, status new|triaged|in_progress|done|declined, assigned_to, notes, created_at)`; public/anon submit via `SL.sb.rpc('submit_service_request',{p_service,p_name,p_email,p_details,p_urgency})` (validates domain, notifies admins). Admins/Statistician/CRC/Research Fellow triage in Hub.
- RPCs: `admin_emails()` (SL.ADMIN_EMAILS is refreshed from it), `request_access(...)`, `request_login_approval()`, `approve_login_request(p_id, p_approve)`.
- Services catalogue (public page `services.html` + hub request form): Biostatistics & Study Design · IRB & Regulatory Support · REDCap / Data Capture · Registry Data Request (BTR/TBI/FNR) · Manuscript & Editing · Grant Development · Student & Trainee Mentorship.
