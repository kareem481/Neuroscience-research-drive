-- ============================================================================
-- docs_seed.sql — starter documentation library for slresearchhub.com
-- 12 documents (5 public, 7 internal). Idempotent: ON CONFLICT (slug) DO NOTHING.
-- Apply with the Supabase SQL editor / MCP as the service role.
-- ============================================================================

INSERT INTO public.documents (slug, title, category, summary, body_md, visibility, tags, version, sort_order, published, created_by, updated_by)
VALUES

-- ---------------------------------------------------------------------------
-- 1. Getting started with the Research Hub (Onboarding, public)
-- ---------------------------------------------------------------------------
('getting-started-research-hub',
 'Getting Started with the Research Hub',
 'Onboarding',
 'What the Research Hub is, who can use it, how to request access, and what to expect at first login.',
 $md$
## What the Research Hub is

The Research Hub is the internal workspace of the Saint Luke's Neuroscience Research Department. It sits behind a login and brings together the tools our investigators, coordinators and trainees use every day:

- **Projects & IRB** — a single record for every study from idea to publication, including protocol, consent and budget workspaces and IRB status tracking.
- **Clinical registries** — the Brain Tumor, Neurotrauma and Functional Neurosurgery registries with role-based access.
- **Grants & deadlines**, **meetings & events**, **training records** (CITI, CME) and a **forum** for questions and requests.
- **Publications** synced nightly from PubMed for department faculty.
- **Documentation** — this library. Public documents are readable by anyone; internal SOPs appear once you sign in.

The public website (Research, Publications, People, News) is the outward-facing view of the same data.

## Who can request access

Accounts are issued to people with an active role in department research. Sign-up requires an institutional email address from one of the following domains:

| Domain | Typical users |
|---|---|
| `@saint-lukes.org` / `@saintlukeskc.org` / `@saintlukes.org` | Saint Luke's faculty, APPs, nurses, coordinators, staff |
| `@umkc.edu` | UMKC residents, fellows, medical students and collaborators |

Outside collaborators without one of these addresses should contact the Research Office at **neuroresearch@saint-lukes.org** to discuss a sponsored account or a data-sharing agreement instead.

## Roles

Your role controls what you can see and do. Roles are assigned by an administrator when your account is approved and can be changed later.

| Role | Summary of access |
|---|---|
| Admin | Full access, user approval, settings, audit log |
| IRB | Read access to project regulatory records; can record IRB decisions |
| Faculty | Create and lead projects, edit registries, view all internal documents |
| Resident / Research Fellow | Create projects (with a faculty PI), contribute to registries |
| APP / NP / PA / RN | Contribute to projects and registries they are assigned to |
| CRC (Clinical Research Coordinator) | Project operations, registry data entry, document uploads |
| Statistician | Read access to registries and project data for analysis |
| Budget & Contracts | Project budget workspace and grants |
| Medical Student | Read-only access to registries; may join projects as a team member |

## Requesting access and first login

1. Go to **Research Hub → Create account** and register with your institutional email. You will receive a verification email; click the link.
2. Sign in. Your account is in a **pending approval** state. You can complete your profile but cannot open internal pages yet.
3. An administrator reviews the request (normally within two business days) and assigns a role. You receive an email when the account is approved.
4. Sign in again. The first time you land on the Hub you may be asked to finish your profile (credentials, department, phone). Faculty can also opt in to a public profile on the People page.

> If your approval is taking longer than expected, email **neuroresearch@saint-lukes.org** from your institutional address with your name and the role you are requesting.

## What to do next

- Read the **New Investigator Onboarding Checklist** (visible after login) and complete CITI training if you have not already.
- Browse **How to Propose a Study** to understand the project pipeline before you submit your first idea.
- Bookmark the **Documentation** page; SOPs are updated here first and each document carries a version number.

## Getting help

- Questions about accounts, roles or the website: **neuroresearch@saint-lukes.org**.
- Regulatory questions: start with the *IRB Submission Guide* in this library, then contact the Research Office.
- Technical issues: use the **Forum & Requests** page in the Hub (category "Technical") so the team can track the request.
$md$,
 'public', ARRAY['hub','access','roles','new users'], 1, 10, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 2. New investigator onboarding checklist (Onboarding, internal)
-- ---------------------------------------------------------------------------
('new-investigator-onboarding-checklist',
 'New Investigator Onboarding Checklist',
 'Onboarding',
 'Step-by-step checklist for faculty, fellows, residents and staff joining the research program, with target timelines.',
 $md$
## Purpose

This checklist covers everything a new investigator or research staff member needs in place before touching study data or interacting with research participants. Work through it with your mentor or the Research Office during your first month.

## Week 1 — Accounts and compliance

| Item | Where | Notes |
|---|---|---|
| Research Hub account approved and role assigned | Research Hub | See *Getting Started with the Research Hub* |
| CITI Program — Human Subjects Research (Biomedical) | citiprogram.org, affiliate with Saint Luke's Health System | Required before any human-subjects activity. Renew every 3 years. |
| CITI — Good Clinical Practice (GCP) | citiprogram.org | Required for anyone working on interventional or FDA-regulated studies |
| CITI — Conflict of Interest | citiprogram.org | Required for investigators listed on IRB applications |
| HIPAA Privacy & Security — Research module | Saint Luke's learning management system | Annual |
| Upload CITI certificates | Hub → Training & Students | The Research Office verifies and records expiry dates |

## Weeks 1–2 — Systems access

1. **IRB electronic system account.** Request through the Research Office; include your role and the studies you will join. Investigators must complete a financial disclosure before being added to a protocol.
2. **Epic research access.** Request the *Research Coordinator* or *Research Provider* template, as appropriate. Chart access for research purposes is only permitted for studies you are listed on and only after IRB approval (or a documented preparatory-to-research activity).
3. **REDCap account.** Request via the institutional REDCap portal. Each study database is owned by the PI; ask the study coordinator to add you with the minimum necessary rights (data entry, reports, or export).
4. **Shared research drive** and **Microsoft Teams** channel for the department research group.
5. **Registry access.** Registry write access is granted per role inside the Hub; Medical Students are read-only.

## Weeks 2–4 — Orientation

- Meet with your research mentor to agree on a first project or a role on an existing study.
- Attend the monthly Research Meeting (see **Meetings & Events** in the Hub) and one tumor board or M&M conference relevant to your area.
- Read the following SOPs in this library: *Data Security and PHI Handling*, *IRB Submission Guide*, *Authorship and Publication Policy*.
- Shadow a coordinator on one consent visit or registry abstraction session.

## Before you start on a study

- [ ] Added to the IRB protocol as key personnel (approved amendment on file)
- [ ] CITI and HIPAA training current and recorded in the Hub
- [ ] Delegation of authority log signed (for sponsored or interventional studies)
- [ ] Protocol-specific training documented (study team meeting note or sponsor training certificate)
- [ ] Access to the study's REDCap project and file folder granted by the coordinator

## Mentorship expectations

Residents, fellows and students are expected to have a named faculty mentor for every project. Mentors review the proposal before admin review, co-sign IRB submissions, and are responsible for data integrity and authorship decisions. Mentorship meetings should occur at least monthly while a project is active; record milestones in the project's notes.

## Typical timelines

| Milestone | Typical time |
|---|---|
| Hub approval | 1–2 business days |
| CITI Human Subjects course | 4–6 hours |
| Epic research template | 1–2 weeks after request |
| IRB exempt determination | 2–3 weeks |
| IRB expedited review | 4–6 weeks |
| IRB full-board review | 6–10 weeks (monthly meeting cycle) |

## Contact

Research Office — **neuroresearch@saint-lukes.org**
$md$,
 'internal', ARRAY['onboarding','CITI','HIPAA','Epic','REDCap','checklist'], 1, 20, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 3. How to propose a study (Guides, public)
-- ---------------------------------------------------------------------------
('how-to-propose-a-study',
 'How to Propose a Study',
 'Guides',
 'The life cycle of a departmental research project — from idea to publication — and what the project wizard asks for.',
 $md$
## The project pipeline

Every study in the department follows the same pipeline. The Research Hub tracks the stage so that the team, the Research Office and the IRB liaison can see where each project stands.

| Stage | What happens | Who moves it forward |
|---|---|---|
| **Idea** | Investigator drafts the question, design and team in the project wizard | Investigator + mentor |
| **Admin review** | Research Office checks feasibility, overlap with existing projects, resource needs and regulatory pathway | Research Office |
| **IRB** | Protocol, consent and HIPAA documents submitted; amendments and responses tracked | PI / coordinator |
| **Active** | Enrollment or data abstraction; progress and deviations logged | Study team |
| **Analysis** | Data locked, statistics completed, results reviewed | Statistician + PI |
| **Publication** | Abstract, manuscript, conference presentation; linked to the PubMed record when indexed | Authors |
| **Closed** | IRB closure filed; data archived per retention policy | PI / coordinator |

## Before you open the wizard

Spend time on these four questions. A clear answer to each makes admin review and IRB review far faster.

1. **What is the question?** State it as a single sentence using PICO (Population, Intervention/exposure, Comparator, Outcome) where applicable.
2. **What is the design?** Retrospective chart review, prospective cohort, registry analysis, case series, survey, quality improvement, or interventional trial. The design determines the regulatory pathway.
3. **Where does the data come from?** Existing registry, Epic abstraction, new prospective collection, or an external dataset. Note whether identifiers are needed.
4. **Who is on the team?** A faculty PI is required. Name the statistician early if you will need one, and consider a resident or student co-investigator.

## What the project wizard asks for

The wizard in **Hub → Projects & IRB → New project** collects the following. You can save a draft and return later.

### Study basics
- Title, study type, research pillar (e.g., Neuro-oncology, Neurotrauma, Functional, Cerebrovascular, Spine, Neurology) and disease focus
- Principal investigator, co-investigators and their roles
- Whether the study falls under an existing umbrella IRB (registry protocols) or needs its own

### Abstract and rationale
- Background (3–5 sentences), specific aims, hypotheses
- Primary and secondary outcomes and how they are measured

### Methods
- Population, inclusion and exclusion criteria, expected sample size and justification
- Data sources and variables to be collected
- Statistical approach (a sentence or two is enough at this stage)

### Regulatory
- Anticipated IRB category: exempt, expedited or full board
- Whether informed consent will be obtained or a waiver requested
- Whether a HIPAA authorization or a waiver of authorization is needed

### Resources
- Estimated timeline and milestones
- Funding source, if any; otherwise "departmental"
- Support needed: statistician time, coordinator time, REDCap build, biobank specimens

## After you submit

- The Research Office reviews within about two weeks and either approves the project for IRB preparation, returns it with questions, or suggests merging it with an existing effort.
- Once approved, the **Protocol**, **Consent** and **Budget** workspaces open on the project page. The *IRB Submission Guide* (available after login) walks through the submission itself.
- Progress is shown as a percentage on the project card; keep milestones updated so the dashboard reflects reality.

## Tips from recent projects

- Registry-based questions can often be answered under the registry's umbrella IRB, which saves weeks.
- Use the Hub's **sample-size calculator** (Research Tools) before you promise an enrollment target.
- Decide authorship order at the proposal stage and revisit it at analysis; see the *Authorship and Publication Policy*.
- Ask the statistician to look at your data collection form before you collect anything.

Questions: **neuroresearch@saint-lukes.org**
$md$,
 'public', ARRAY['projects','pipeline','wizard','study design'], 1, 30, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 4. IRB submission guide (IRB & Regulatory, internal)
-- ---------------------------------------------------------------------------
('irb-submission-guide',
 'IRB Submission Guide',
 'IRB & Regulatory',
 'Review categories, required documents, consent and HIPAA considerations, amendments, continuing review and reportable events.',
 $md$
## Scope

This guide applies to all human-subjects research conducted by department investigators and reviewed by the Saint Luke's Health System IRB (or a designated external IRB under a reliance agreement). It summarizes the federal regulations at **45 CFR 46** (the Common Rule), **21 CFR 50 and 56** (FDA-regulated research) and the **HIPAA Privacy Rule (45 CFR 164)**. It does not replace IRB policy; when in doubt, contact the Research Office.

## Is it human-subjects research?

Two questions decide whether IRB review is needed:

1. **Is it research?** A systematic investigation designed to develop or contribute to generalizable knowledge (45 CFR 46.102(l)).
2. **Does it involve human subjects?** A living individual about whom an investigator obtains information or biospecimens through intervention or interaction, or obtains, uses, studies, analyzes or generates identifiable private information or identifiable biospecimens (45 CFR 46.102(e)).

Quality-improvement projects intended only for local practice change are usually not research, but request a **Not Human Subjects Research (NHSR)** determination from the IRB rather than deciding yourself. Case reports of three or fewer patients generally do not require IRB review but do require patient authorization if identifiable details are published.

## Review categories

| Category | When it applies | Typical department examples |
|---|---|---|
| **Exempt** | Minimal risk and fits one of the categories in 45 CFR 46.104(d); e.g., secondary research with information recorded such that subjects cannot be readily identified, or where HIPAA applies and the research is regulated under it (category 4) | Retrospective reviews using a de-identified registry extract; anonymous surveys |
| **Expedited** | Minimal risk and fits one of the OHRP expedited categories (e.g., category 5: existing data, documents, records, specimens; category 7: surveys, interviews, focus groups) | Retrospective chart reviews with identifiers; prospective collection of clinical data from routine care; biospecimen research using leftover tissue |
| **Full board (convened)** | Greater than minimal risk, or minimal-risk studies that do not fit an expedited category; all FDA-regulated investigational device or drug studies | Interventional trials, device studies, studies enrolling vulnerable populations with more than minimal risk |

Exempt and expedited determinations are made by the IRB office or a designated reviewer and are not subject to continuing review unless the IRB requires it. Full-board studies are reviewed at the convened meeting; check the submission deadline calendar in **Hub → Grants & Deadlines**.

## Required documents

Prepare these in the project's Protocol workspace before you start the IRB application.

### All submissions
- IRB application form (electronic)
- Protocol (use the department template: background, aims, design, population, procedures, data management, statistical plan, risks/benefits, privacy and confidentiality)
- CV or biosketch and current CITI certificates for all key personnel
- Conflict-of-interest disclosures
- Data collection instrument or REDCap codebook
- Department sign-off (faculty PI and, for trainees, the mentor)

### Depending on design
- Informed consent form(s) and any assent forms — see *Informed Consent Template Guide*
- HIPAA authorization, or a request for waiver/alteration of authorization
- Request for waiver or alteration of informed consent (45 CFR 46.116(f))
- Recruitment materials, scripts, letters and advertisements
- Surveys, questionnaires and interview guides
- Investigator's brochure, device description or FDA correspondence for regulated studies
- Data use agreement or reliance agreement for multi-site work
- Sponsor protocol and budget for industry studies

## Consent and HIPAA

### Waiver of consent
The IRB may waive or alter consent when all of the following are met (45 CFR 46.116(f)(3)):

1. The research involves no more than minimal risk.
2. The research could not practicably be carried out without the waiver.
3. If identifiable information or biospecimens are used, the research could not practicably be carried out without them.
4. The waiver will not adversely affect the rights and welfare of subjects.
5. Where appropriate, subjects will be provided with additional pertinent information after participation.

Most retrospective chart reviews qualify. Explain *why* consent is impracticable (e.g., large cohort, deceased or lost-to-follow-up patients, selection bias introduced by consent).

### Waiver of HIPAA authorization
A separate justification is required under 45 CFR 164.512(i): minimal privacy risk with a plan to protect and destroy identifiers, impracticability without the waiver, and impracticability without access to PHI. List every identifier you will access and when it will be removed.

### Key information
Consent forms must open with a concise, focused presentation of the key information most likely to assist a prospective subject in deciding whether to participate (45 CFR 46.116(a)(5)).

## Amendments

Any change to an approved study — personnel, procedures, documents, sample size, data elements, sites — must be approved **before** it is implemented, except changes necessary to eliminate an apparent immediate hazard to a subject (report those promptly afterward).

- Submit a modification request describing each change and its rationale, with tracked-changes versions of affected documents.
- Personnel additions require CITI certificates and COI disclosures for the new member.
- Update the project record in the Hub once the amendment is approved so the team knows which version is current.

## Continuing review and closure

- Full-board studies require continuing review at least annually; the IRB sets the interval. Submit at least **6 weeks** before expiration. Lapsed approval means all research activity must stop.
- Exempt and most expedited studies approved under the revised Common Rule do not require continuing review, but an annual status check-in may be requested.
- Close the study when enrollment, follow-up and analysis of identifiable data are complete. Data that remain identifiable after closure must be retained securely under the department retention policy (minimum 6 years after closure; longer for FDA-regulated studies).

## Reportable events

Report the following to the IRB within the timeframe in IRB policy (generally **5 business days** for unanticipated problems, and sooner for serious events).

| Event | Examples |
|---|---|
| Unanticipated problems involving risks to subjects or others | Unexpected serious adverse event related to the research; a breach of confidentiality |
| Serious or continuing noncompliance | Enrolling without consent, lapsed approval, unapproved protocol deviations |
| Protocol deviations that affect safety or data integrity | Missed safety labs, wrong dose, out-of-window visits |
| Privacy or security incidents | Lost unencrypted device, misdirected email with PHI — also notify the Privacy Office immediately |
| External reports | Sponsor safety reports, DSMB reports, FDA letters |

Log deviations in the project record even when they are not reportable; the cumulative pattern matters at continuing review.

## Contacts

Research Office (pre-submission review and regulatory questions): **neuroresearch@saint-lukes.org**
$md$,
 'internal', ARRAY['IRB','45 CFR 46','consent','HIPAA','amendments','reportable events'], 1, 40, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 5. Informed consent template guide (Forms & Templates, public)
-- ---------------------------------------------------------------------------
('informed-consent-template-guide',
 'Informed Consent Template Guide',
 'Forms & Templates',
 'Required elements of informed consent, readability standards, the key-information section and common reviewer comments.',
 $md$
## Purpose

Use this guide with the department consent template when writing or revising a consent form. The template is built around the requirements of **45 CFR 46.116** and, for FDA-regulated studies, **21 CFR 50.25**. Writing that follows this guide is approved faster and understood better by participants.

## Structure of the template

1. Title, protocol number, PI and version date (footer on every page)
2. **Key information** (one page or less)
3. Introduction and invitation
4. Purpose of the study
5. What will happen (procedures, visits, duration)
6. Risks and discomforts
7. Benefits
8. Alternatives to participation
9. Confidentiality and HIPAA authorization (may be a separate form)
10. Costs and compensation
11. Research-related injury (interventional studies)
12. Voluntary participation and withdrawal
13. Whom to contact
14. Signatures

## Key information section

The revised Common Rule requires consent to begin with a concise, focused presentation of the information a reasonable person would want in deciding whether to participate. Keep it to plain language and under one page. It should cover:

- That this is research, participation is voluntary, and the participant can stop at any time
- The purpose, expected duration and main procedures
- The most important or likely risks and discomforts
- Reasonably expected benefits
- Appropriate alternatives, if any

Do not duplicate the whole consent here; the full detail follows in the body.

## Required elements checklist

### Basic elements (46.116(b))
- [ ] Statement that the study involves research, its purposes, duration and procedures; identification of experimental procedures
- [ ] Reasonably foreseeable risks or discomforts
- [ ] Reasonably expected benefits to the subject or others
- [ ] Appropriate alternative procedures or treatments
- [ ] Extent to which confidentiality will be maintained
- [ ] For more than minimal risk: compensation and treatment available for research-related injury
- [ ] Contacts for questions about the research, subjects' rights, and research-related injury
- [ ] Statement that participation is voluntary, refusal involves no penalty, and the subject may discontinue at any time
- [ ] One of the following statements about identifiable private information or biospecimens: that identifiers may be removed and the data used for future research without additional consent, **or** that they will not be used for future research even if de-identified

### Additional elements, when appropriate (46.116(c))
- [ ] Unforeseeable risks (including to embryo or fetus)
- [ ] Circumstances under which participation may be terminated by the investigator
- [ ] Additional costs to the subject
- [ ] Consequences of withdrawal and orderly termination procedures
- [ ] Significant new findings will be provided
- [ ] Approximate number of subjects
- [ ] Whether biospecimens may be used for commercial profit and whether the subject will share in it
- [ ] Whether clinically relevant research results will be returned
- [ ] Whether research might include whole genome sequencing

### FDA-regulated studies (21 CFR 50.25)
- [ ] Statement that FDA may inspect records
- [ ] ClinicalTrials.gov statement (for applicable clinical trials), verbatim as required by 21 CFR 50.25(c)

## Readability

- Target an **8th-grade reading level** or lower (Flesch-Kincaid). Use the readability statistics in Word.
- Second person ("you"), active voice, short sentences (under 20 words), short paragraphs.
- Define every medical term the first time: "craniotomy (surgery to open the skull)".
- Replace: *utilize → use; prior to → before; in the event that → if; participate → take part*.
- Use headings and bullet lists; avoid dense blocks of text.
- Numbers: "1 in 100 people" rather than "1%" where feasible.

## Consent process, not just the form

- Consent must be obtained by a person listed on the protocol and delegated to consent.
- Allow time for questions; for surgical populations, avoid obtaining research consent in the immediate pre-operative holding area unless the IRB has approved that approach.
- Document the consent discussion in the research record (date, time, who consented, copy given).
- For participants with impaired capacity (common in neurotrauma and neuro-oncology): follow IRB policy on capacity assessment and legally authorized representatives (LAR), and plan for re-consent when capacity returns.
- Non-English speakers: use a translated consent or the short-form process with an interpreter, per IRB policy.

## Common reviewer comments

| Comment | Fix |
|---|---|
| "Key information section too long" | Trim to the five bullets above; move detail to the body |
| "Risks understate known surgical risks" | List procedure-specific risks with frequencies where known |
| "Therapeutic misconception" | State clearly that the study may not benefit the participant |
| "Future use statement missing" | Add the required statement on future research use of data/specimens |
| "Contact information incomplete" | Include PI contact, IRB office contact and a 24-hour number for injury |
| "Version date missing from footer" | Add protocol number and version date to every page |

## Template files

Download the current template files from the Hub project **Consent workspace** or request them from **neuroresearch@saint-lukes.org**.
$md$,
 'public', ARRAY['consent','template','45 CFR 46.116','readability','key information'], 1, 50, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 6. Data security and PHI handling (Policies, internal)
-- ---------------------------------------------------------------------------
('data-security-and-phi-handling',
 'Data Security and PHI Handling Policy',
 'Policies',
 'Minimum necessary standard, de-identification, approved storage locations, registry access, data sharing and breach response.',
 $md$
## Policy statement

All research data containing protected health information (PHI) must be collected, stored, used and shared in accordance with the **HIPAA Privacy and Security Rules (45 CFR Parts 160 and 164)**, Saint Luke's Health System policy and the terms of the governing IRB approval. Every member of the research team is personally responsible for compliance.

## Minimum necessary

Access, use and disclose only the PHI that is reasonably necessary for the approved research purpose.

- Collect only the variables listed in the IRB-approved data collection form.
- Request REDCap and registry rights at the lowest level that lets you do your job.
- Do not browse charts of patients who are not enrolled or screened for your study. Preparatory-to-research chart review is permitted only to design a study or assess feasibility, and no PHI may be removed from the EHR during that activity.
- Remove identifiers as early in the workflow as the design allows.

## De-identification

Data are de-identified under the **Safe Harbor** method only when **all 18 HIPAA identifiers** are removed and the investigator has no actual knowledge that the remaining data could identify the individual:

1. Names
2. Geographic subdivisions smaller than a state (street address, city, county, ZIP code — the first three digits of a ZIP may be retained if the area contains more than 20,000 people)
3. All elements of dates (except year) directly related to an individual — birth, admission, discharge, death — and all ages over 89
4. Telephone numbers
5. Fax numbers
6. Email addresses
7. Social Security numbers
8. Medical record numbers
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate or license numbers
12. Vehicle identifiers and serial numbers, including license plates
13. Device identifiers and serial numbers
14. Web URLs
15. IP addresses
16. Biometric identifiers, including finger and voice prints
17. Full-face photographs and comparable images
18. Any other unique identifying number, characteristic or code

A **limited data set** may retain dates and city/state/ZIP but requires a data use agreement. **Coded** data (a study ID with a separately stored key) are still PHI in the hands of anyone who can access the key. The **Expert Determination** method requires a documented statistical analysis and is arranged through the Privacy Office.

> Practical rule: store the crosswalk between study ID and MRN in a separate, access-restricted file, never in the analysis dataset, and destroy it at the date stated in the IRB application.

## Approved storage locations

| Data type | Approved | Not permitted |
|---|---|---|
| Identifiable research data | Institutional REDCap; Research Hub registries (Supabase, access-controlled); departmental shared drive folders restricted to the study team; encrypted institutional OneDrive/SharePoint | Personal email, personal cloud storage (Dropbox, personal Google Drive), unencrypted USB drives, personal laptops, text messages |
| De-identified analysis datasets | Above, plus statistician's encrypted institutional device | Public code repositories, unencrypted removable media |
| Consent forms and regulatory binder | Locked cabinet in the Research Office or the IRB system's electronic binder | Home offices |
| Imaging for research | Institutional PACS research worklists; de-identified DICOM on the research drive | Personal devices, consumer photo apps |

Devices used to access PHI must be institution-managed, encrypted, password-protected with auto-lock, and kept current with updates. Remote access is via the institutional VPN only.

## Clinical registries

- Registry data in the Research Hub are collected under umbrella IRB protocols. Each new analysis of registry data needs either coverage under that protocol or its own IRB approval; check with the Research Office.
- Write access follows role: Faculty, Residents, Research Fellows, CRCs, APPs, NPs, PAs, RNs and Statisticians may add or edit records; Medical Students are read-only; only Admins may delete.
- All edits are audit-logged with user, timestamp and record. Do not share accounts.
- Export registry data only to approved storage locations, and de-identify at export unless the IRB approval requires identifiers.

## Sharing data

- **Inside the institution:** share only with people listed on the IRB protocol. Use the study's REDCap project or shared folder, not email attachments.
- **Outside the institution:** requires an executed data use agreement (DUA) or business associate agreement (BAA) arranged through the Research Office, and an IRB-approved plan. Ship de-identified or limited data sets whenever possible.
- **Publication and repositories:** only de-identified data; check journal and funder data-sharing requirements at the proposal stage. Small cell counts (< 11) in public tables may need suppression for rare conditions.
- **Email:** never send PHI to external addresses. Internal email containing PHI must use the institutional encryption tag per IT policy.

## Retention and destruction

Retain research records for at least **6 years** after study closure (longer if required by sponsor, FDA — 2 years after marketing application — or funding agency). Destroy identifiers on the schedule stated in the IRB application using institutional secure disposal.

## Incidents and breaches

A privacy or security incident is any unauthorized access, use, disclosure or loss of PHI, including lost devices and misdirected messages.

1. **Contain** — retrieve the message, remotely wipe the device, revoke access.
2. **Report immediately** (the same day) to the Saint Luke's Privacy Office and IT Security using the institutional incident process, and notify the PI.
3. **Notify the IRB** as an unanticipated problem within the timeframe in IRB policy (generally 5 business days).
4. **Document** what happened, what data were involved and the corrective action in the project record.

Do not attempt to assess whether a breach is "reportable" yourself; the Privacy Office makes that determination under the HIPAA Breach Notification Rule.

## Training

Annual HIPAA training and CITI Human Subjects certification are required for all research team members. See the *New Investigator Onboarding Checklist*.

Questions: **neuroresearch@saint-lukes.org**
$md$,
 'internal', ARRAY['HIPAA','PHI','de-identification','security','data sharing','breach'], 1, 60, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 7. Authorship and publication policy (Policies, public)
-- ---------------------------------------------------------------------------
('authorship-and-publication-policy',
 'Authorship and Publication Policy',
 'Policies',
 'Who qualifies as an author, how author order is decided, acknowledgments, preprints, and how publications appear on the department website.',
 $md$
## Principles

The department follows the **International Committee of Medical Journal Editors (ICMJE)** recommendations on authorship and the responsibilities of authors. Authorship is a matter of contribution and accountability, not rank, and it is decided transparently and early.

## ICMJE authorship criteria

An author must meet **all four** criteria:

1. Substantial contributions to the conception or design of the work; **or** the acquisition, analysis, or interpretation of data for the work; **and**
2. Drafting the work or reviewing it critically for important intellectual content; **and**
3. Final approval of the version to be published; **and**
4. Agreement to be accountable for all aspects of the work in ensuring that questions related to the accuracy or integrity of any part of the work are appropriately investigated and resolved.

Contributors who meet criterion 1 must be given the opportunity to meet criteria 2–4. Acquisition of funding, general supervision of a research group, provision of patients, or routine data collection alone does not qualify.

## Deciding authorship

- **At proposal:** the PI records provisional authors and their expected contributions in the project's manuscript workspace. This is a plan, not a promise.
- **At analysis:** revisit the list. Contributions change; people join and leave.
- **Before submission:** every listed author confirms their contribution statement (CRediT taxonomy is encouraged) and approves the final manuscript.

## Author order

| Position | Convention in this department |
|---|---|
| First author | The person who did the most work — typically drafted the manuscript and led data collection or analysis. Often a resident, fellow or student. |
| Co-first authors | Permitted where two people contributed equally; state this in a footnote. |
| Middle authors | Ordered by contribution, agreed by the group; alphabetical ordering should be stated if used. |
| Senior (last) author | The faculty member responsible for the project's conception, oversight and integrity — usually the PI. |
| Corresponding author | Responsible for journal communication, data availability and post-publication queries; may be first or senior author. |

Trainees who leave the institution retain authorship rights for work they contributed to; the PI should keep them informed and include them in manuscript review.

## Acknowledgments

People who contributed but do not meet all four criteria — statisticians who ran a standard analysis without interpretive input, coordinators, registry abstractors, editors, funders — should be named in the Acknowledgments with their contribution, with their written permission.

## Disputes

Raise concerns first with the senior author. If unresolved, either party may ask the Research Office to convene a review with the Department Chair or designee. Decisions are documented in the project record. Retaliation for raising an authorship concern is not tolerated.

## Preprints, registration and reporting

- **Clinical trials** must be registered (e.g., ClinicalTrials.gov) before enrollment of the first participant, per ICMJE and federal law where applicable.
- **Preprints** (medRxiv, bioRxiv) are permitted and encouraged for completed work, provided the target journal allows it and the preprint carries a statement that it has not been peer reviewed. Do not post preprints containing PHI or unpublished sponsor data.
- Use the appropriate **reporting guideline** (STROBE, CONSORT, PRISMA, CARE, TRIPOD) — see the *Manuscript Preparation SOP*.
- Disclose all conflicts of interest using the ICMJE disclosure form.

## Institutional affiliation

List the affiliation as *Department of Neurosurgery* or *Department of Neurology*, *Saint Luke's Health System, Kansas City, Missouri*, and, where applicable, *University of Missouri–Kansas City School of Medicine*. Consistent affiliation wording keeps our PubMed searches accurate.

## How publications appear on the website

The Research Hub syncs department publications from **PubMed** nightly using each faculty member's author terms and affiliation filter. To make sure your work is captured:

- Keep your **ORCID** current and link it in your Hub profile.
- Use a consistent name format across papers.
- If a paper is missing or misattributed, use **Hub → Publications → Add manually** or contact **neuroresearch@saint-lukes.org**.
- Link the paper to its project in the Hub so the project record shows its output.

## Related documents

*Manuscript Preparation SOP* · *Data Security and PHI Handling Policy* · *How to Propose a Study*
$md$,
 'public', ARRAY['authorship','ICMJE','publication','preprints','PubMed'], 1, 70, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 8. Manuscript preparation SOP (SOPs, internal)
-- ---------------------------------------------------------------------------
('manuscript-preparation-sop',
 'Manuscript Preparation SOP',
 'SOPs',
 'From locked dataset to accepted paper: IMRaD structure, journal selection, reporting guidelines, internal review, submission and revisions.',
 $md$
## Scope

This SOP describes the department's standard process for preparing, reviewing and submitting original research manuscripts, reviews and case reports. It applies to all projects tracked in the Research Hub.

## Prerequisites

- IRB approval (or exemption/NHSR determination) on file and referenced in the Methods.
- Data locked: the analysis dataset is frozen and archived with a date and the statistician's sign-off.
- Authorship list agreed per the *Authorship and Publication Policy*.
- Project stage in the Hub set to **Analysis** or **Publication**.

## Step 1 — Choose the reporting guideline

Select the guideline that matches the design and download its checklist from the EQUATOR Network. The checklist is submitted with the manuscript and uploaded to the project's manuscript workspace.

| Design | Guideline |
|---|---|
| Observational cohort, case-control, cross-sectional | **STROBE** |
| Randomized controlled trial | **CONSORT** (plus extensions for pilot, non-inferiority, cluster designs) |
| Systematic review / meta-analysis | **PRISMA 2020** |
| Case report / case series | **CARE** |
| Prediction model development or validation | **TRIPOD** |
| Diagnostic accuracy | **STARD** |
| Quality improvement | **SQUIRE 2.0** |
| Surgical innovation / new technique | **IDEAL** framework |

## Step 2 — Select the target journal

Choose the journal **before** writing; formatting, word limits and audience differ widely.

- Shortlist 3 journals (aspirational, realistic, safe). Record them in the manuscript workspace.
- Check: scope, article types, word/figure limits, open-access fees, time to first decision, and indexing in MEDLINE.
- Avoid predatory journals: verify indexing in PubMed/MEDLINE or DOAJ membership; be suspicious of unsolicited invitations and guaranteed acceptance.
- For neurosurgical work, common targets include *Journal of Neurosurgery*, *Neurosurgery*, *World Neurosurgery*, *Neuro-Oncology*, *Journal of Neurotrauma*, *Journal of Neuro-Oncology*, *Stereotactic and Functional Neurosurgery*, *Epilepsia* and *Neurology*. Match the journal to the question, not the other way around.

## Step 3 — Write using IMRaD

### Title and abstract
- Title states the design and population ("…: a retrospective cohort study").
- Structured abstract within the journal's word limit; numbers in the abstract must match the results exactly.

### Introduction (3–4 paragraphs)
What is known, what is not known, and the specific aim or hypothesis in the last paragraph.

### Methods
- Design, setting, period, IRB approval statement and consent/waiver status.
- Participants: inclusion/exclusion criteria, how identified (registry, Epic query, consecutive patients).
- Variables: definitions, measurement, and instruments (e.g., KPS, GCS, GOS-E, Engel class), with version/date.
- Data sources, handling of missing data, and any linkage.
- Statistical methods: tests, models, covariate selection, software and version, significance threshold, sample-size justification. Ask the statistician to write or review this section.

### Results
- Flow of participants (a flow diagram for cohorts and trials).
- Table 1: baseline characteristics.
- Primary outcome first, then secondary outcomes; effect sizes with 95% confidence intervals, not just p-values.
- Do not interpret in Results.

### Discussion
Principal findings → comparison with prior literature → strengths and limitations → implications and next steps → conclusion that answers the aim and does not overreach.

### Other elements
Author contributions (CRediT), acknowledgments, funding, conflicts of interest (ICMJE form), data availability statement, reporting checklist, references in journal style (use a reference manager: EndNote, Zotero or Paperpile).

## Step 4 — Figures and tables

- Every figure and table must be cited in the text and stand alone with its legend.
- Figures: 300 dpi minimum, vector where possible, colorblind-safe palette, no patient identifiers in images (crop or blur; remove DICOM header overlays).
- Tables: one idea per table; consistent decimals; define abbreviations in footnotes.
- Imaging figures require IRB-approved use and, if potentially identifiable (e.g., 3D face reconstructions), patient authorization.

## Step 5 — Internal review

1. **Co-author review** — full draft circulated with a 2-week turnaround; track comments in a single shared file.
2. **Statistical review** — mandatory for any manuscript with inferential statistics.
3. **Senior author sign-off** on the final version.
4. **Department pre-submission review** (optional but encouraged for trainee first authors): submit via **Hub → Forum & Requests**, category "Manuscript review"; a faculty reviewer responds within 10 business days.
5. Run a plagiarism/similarity check if available through the library.

## Step 6 — Submission

- Confirm all authors have approved the final version and completed ICMJE disclosure forms.
- Prepare the cover letter: what the study found, why it fits the journal, statement of originality and no concurrent submission, suggested reviewers if requested.
- Upload the reporting checklist, IRB approval letter if required, and any supplementary files.
- Record the submission date, journal and manuscript ID in the Hub manuscript workspace.

## Step 7 — Revisions and decisions

- Respond to every reviewer comment point by point in a response letter; quote the comment, describe the change, and cite the location in the revised manuscript.
- Be courteous and factual; disagree with evidence when appropriate.
- Track revision deadlines in **Grants & Deadlines**.
- On rejection, revise using the reviews and submit to the next journal on the shortlist within 4 weeks — do not let manuscripts stall.
- On acceptance: update the project stage to **Publication**, upload the accepted manuscript, complete any open-access or copyright forms, and link the PubMed record once indexed.

## Timeline targets

| Milestone | Target |
|---|---|
| Data lock → complete first draft | 8 weeks |
| Internal review | 2–3 weeks |
| Revision turnaround | Within journal deadline, typically 4–8 weeks |
| Resubmission after rejection | 4 weeks |

## Related documents

*Authorship and Publication Policy* · *Sample Size and Statistics Primer* · *Data Security and PHI Handling Policy*
$md$,
 'internal', ARRAY['manuscript','IMRaD','STROBE','CONSORT','PRISMA','journal','submission'], 1, 80, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 9. Brain tumor registry manual (Registry Manuals, internal)
-- ---------------------------------------------------------------------------
('brain-tumor-registry-manual',
 'Brain Tumor Registry Manual',
 'Registry Manuals',
 'Purpose, inclusion criteria, core data dictionary, abstraction workflow and quality assurance for the departmental Brain Tumor Registry.',
 $md$
## Purpose

The Brain Tumor Registry (BTR) is a prospective, IRB-approved departmental registry of adult patients with primary and metastatic central nervous system tumors treated at Saint Luke's. It supports outcomes research, quality reporting, tumor board preparation, clinical trial screening and biobank linkage. It lives in the Research Hub under **Clinical Registries → Brain Tumor Registry**.

## Governance

- Operated under an umbrella IRB protocol with a waiver of consent for retrospective data and an optional consent track for biobanking and future contact.
- Data steward: the neuro-oncology research coordinator. Registry PI: designated neurosurgical oncology faculty.
- Any analysis using registry data must be reviewed by the Research Office to confirm it is covered by the umbrella protocol.

## Inclusion and exclusion

**Include** adults (≥ 18 years) with a new or recurrent intracranial or spinal tumor who had surgery, biopsy, radiosurgery, or were discussed at the Saint Luke's neuro-oncology tumor board, from the registry start date onward.

**Exclude** patients who have opted out of research use of their records, and lesions that prove non-neoplastic on final pathology (record and then mark as excluded; do not delete).

## Core data dictionary (summary)

The full codebook is maintained in the Hub. Key fields and their definitions:

### Demographics and baseline
| Field | Definition / coding |
|---|---|
| Age at diagnosis | Years, from date of first tissue diagnosis or first imaging if no tissue |
| Sex, race, ethnicity | Per EHR self-report |
| KPS at presentation | Karnofsky Performance Status, 0–100 in 10-point steps, as documented at first neurosurgical evaluation |
| Presenting symptoms | Seizure, headache, focal deficit, cognitive change, incidental |
| Prior treatment | Surgery, radiation, systemic therapy before index encounter |

### Tumor and molecular
| Field | Definition / coding |
|---|---|
| Histology | WHO CNS5 (2021) integrated diagnosis |
| WHO grade | 1–4 (CNS WHO grade, Arabic numerals) |
| IDH status | IDH1/IDH2 mutant, wildtype, not tested |
| 1p/19q | Codeleted, intact, not tested (required for oligodendroglioma diagnosis) |
| MGMT promoter | Methylated, unmethylated, indeterminate, not tested |
| Other markers | TERT promoter, EGFR amplification, CDKN2A/B deletion, H3 K27M, BRAF, ATRX, Ki-67 index |
| Location | Lobe/structure, laterality, eloquent cortex involvement |
| Tumor volume | cm³ at diagnosis from volumetric segmentation (T1 post-contrast and T2/FLAIR) |
| Primary site (metastases) | Lung, breast, melanoma, renal, colorectal, other |

### Surgery
| Field | Definition / coding |
|---|---|
| Procedure | Craniotomy resection, biopsy (stereotactic/open), LITT, shunt, other |
| Extent of resection | Gross total (no residual enhancement), near total (≥ 95%), subtotal (< 95%), biopsy — from post-op MRI within 72 hours |
| Residual volume | cm³ |
| Adjuncts | Awake mapping, 5-ALA, intraoperative MRI/ultrasound, neuronavigation, neuromonitoring |
| Complications (30-day) | New neurologic deficit, infection, hemorrhage, CSF leak, VTE, seizure, readmission, return to OR |

### Adjuvant treatment
Radiation (modality, dose/fractions, start and end dates), systemic therapy (regimen, cycles, dates), tumor treating fields, clinical trial enrollment.

### Response and outcome
| Field | Definition / coding |
|---|---|
| RANO assessment | Complete response, partial response, stable disease, progression per RANO (high-grade, low-grade, or brain-metastasis criteria as applicable) at each imaging time point |
| Progression date | First imaging or clinical progression; note pseudoprogression adjudication |
| Vital status | Alive, dead, lost to follow-up; date of last contact |
| Overall survival (OS) | Months from diagnosis (or surgery, specify) to death or censor |
| Progression-free survival (PFS) | Months from diagnosis/surgery to progression or death, whichever first |
| KPS at follow-up | At each visit |

## Abstraction workflow

1. **Case identification** — weekly review of the OR schedule, neuropathology accession list and tumor board agenda. New cases are created within 14 days of surgery.
2. **Baseline entry** — demographics, presentation, imaging and surgical fields from the operative note, discharge summary and post-op MRI report.
3. **Pathology and molecular** — entered when the final integrated diagnosis is signed out; update molecular fields as send-out results return.
4. **Treatment** — radiation and systemic therapy entered at initiation and completion; link trial enrollment.
5. **Follow-up** — at each clinic visit or imaging study (typically every 2–3 months for high-grade glioma): RANO assessment, KPS, progression, complications.
6. **Vital status** — quarterly reconciliation against the EHR and public death records.

Record the source document for each entry in the notes field when it is not obvious. Never infer a value; use "unknown" or "not tested".

## Quality assurance

- **Double abstraction** of a 10% random sample each quarter by a second abstractor; discrepancies adjudicated by the registry PI and the codebook clarified.
- **Automated checks** in the Hub flag impossible dates, missing required fields and out-of-range values (e.g., KPS not in 10-point steps, extent of resection without a post-op MRI date).
- **Monthly completeness report** reviewed at the neuro-oncology research meeting.
- All changes are audit-logged; deletions require Admin role and documented justification.

## Access and security

Authenticated Hub users may read the registry. Write access is limited to Faculty, Residents, Research Fellows, CRCs, APPs, NPs, PAs, RNs and Statisticians. Medical Students are read-only. Exports must follow the *Data Security and PHI Handling Policy*.

## Contact

Registry coordinator via **neuroresearch@saint-lukes.org**.
$md$,
 'internal', ARRAY['registry','brain tumor','glioma','RANO','data dictionary','WHO CNS5'], 1, 90, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 10. Neurotrauma registry manual (Registry Manuals, internal)
-- ---------------------------------------------------------------------------
('neurotrauma-registry-manual',
 'Neurotrauma Registry Manual',
 'Registry Manuals',
 'Data definitions and workflow for the Neurotrauma (TBI) Registry: injury severity, imaging scores, ICP monitoring, complications and GOS-E outcomes.',
 $md$
## Purpose

The Neurotrauma Registry captures adults with traumatic brain injury (TBI), including subdural and epidural hematoma and skull fractures, evaluated by the neurosurgery service. It supports outcomes research, quality benchmarking against national trauma data, and protocol development for ICP management. It lives in the Research Hub under **Clinical Registries → Neurotrauma Registry**.

## Inclusion and exclusion

**Include** patients ≥ 18 years with acute TBI (injury within 7 days) and any of: neurosurgical consultation, ICU admission for TBI, operative intervention, or ICP monitoring.

**Exclude** isolated spinal trauma, chronic subdural hematoma without an acute traumatic component (captured in a separate cohort flag), and non-traumatic intracranial hemorrhage.

## Core data dictionary (summary)

### Injury and presentation
| Field | Definition / coding |
|---|---|
| Mechanism | Fall (ground level / from height), motor vehicle, motorcycle, pedestrian, assault, penetrating, sport, other |
| Time of injury / arrival | Date-time; compute injury-to-arrival interval |
| Anticoagulant / antiplatelet use | Agent and reversal given |
| Pre-hospital hypotension / hypoxia | SBP < 90 mmHg; SpO₂ < 90% |
| Pupils at arrival | Both reactive, one unreactive, both unreactive |
| Polytrauma | Injury Severity Score (ISS) if available |

### Severity
| Field | Definition / coding |
|---|---|
| GCS (arrival, post-resuscitation, best in 24 h) | Total 3–15 with E/V/M components; record "T" for intubated verbal and score motor separately |
| Severity class | Mild 13–15, moderate 9–12, severe 3–8 (post-resuscitation GCS) |
| Marshall CT class | I (no visible pathology), II (diffuse injury, cisterns present, shift < 5 mm), III (swelling: cisterns compressed/absent, shift < 5 mm), IV (shift > 5 mm), V (evacuated mass lesion), VI (non-evacuated mass lesion > 25 cm³) |
| Rotterdam CT score | Sum: basal cisterns (0–2), midline shift (0–1), epidural mass (0–1, reverse-scored), IVH/tSAH (0–1), plus 1; range 1–6 |
| Lesion types | EDH, SDH, contusion, tSAH, IVH, DAI, skull fracture (linear/depressed/basilar) |

### Management
| Field | Definition / coding |
|---|---|
| Operative intervention | Craniotomy, decompressive hemicraniectomy, burr holes, EVD, bone flap management, cranioplasty date |
| ICP monitoring | Device (EVD, parenchymal), insertion and removal date-time, indication |
| ICP readings | Hourly values captured in the ICP module; derived: hours with ICP > 22 mmHg, peak ICP, cerebral perfusion pressure |
| Tiered therapy | Sedation, hyperosmolar therapy (mannitol/hypertonic saline), CSF drainage, hypothermia, barbiturate coma, decompression |
| Seizure prophylaxis | Agent, duration |
| VTE prophylaxis | Agent, start day |

### Complications
Pneumonia/VAP, VTE (DVT/PE), surgical site infection, ventriculitis, post-traumatic seizures (early ≤ 7 days / late), hydrocephalus, CSF leak, re-operation, delirium, pressure injury, sodium disturbance (DI, SIADH, CSW). Record onset date and grade.

### Outcomes
| Field | Definition / coding |
|---|---|
| ICU and hospital length of stay | Days |
| Discharge disposition | Home, inpatient rehab, SNF/LTAC, hospice, death |
| In-hospital mortality | Yes/no, date, withdrawal of life-sustaining therapy flag |
| **GOS-E** | Glasgow Outcome Scale–Extended, 1–8 (1 dead, 2 vegetative, 3 lower severe disability, 4 upper severe, 5 lower moderate, 6 upper moderate, 7 lower good recovery, 8 upper good recovery) at discharge, 3, 6 and 12 months using the structured interview |
| Favorable outcome | GOS-E ≥ 5 (dichotomization must be prespecified per analysis) |
| Return to work / school | At 6 and 12 months |

## Abstraction workflow

1. New cases identified daily from the neurosurgery consult list and trauma registry feed; the record is opened within 72 hours of admission.
2. Arrival data, GCS components and initial CT scores entered from the trauma flowsheet, ED note and radiology report. Marshall and Rotterdam scores are assigned by the abstractor from the report and images; ambiguous cases are reviewed with a neurosurgery resident.
3. ICP data are entered into the ICP module from the ICU flowsheet for the duration of monitoring.
4. Complications and interventions are updated at least weekly while inpatient and finalized at discharge.
5. GOS-E follow-up is collected by structured telephone interview at 3, 6 and 12 months; three documented attempts before recording "lost to follow-up".

## Quality assurance

- 10% double abstraction quarterly; GCS and CT score inter-rater agreement reported (target kappa ≥ 0.8).
- Hub validation rules: GCS components must sum to total; Rotterdam score range 1–6; ICP removal after insertion; GOS-E windows ±2 weeks (3-month), ±4 weeks (6- and 12-month).
- Missing follow-up reviewed monthly by the registry coordinator.

## Access and security

Authenticated read; role-based write (Medical Students read-only); Admin delete only. Follow the *Data Security and PHI Handling Policy* for any export.

## Contact

Registry coordinator via **neuroresearch@saint-lukes.org**.
$md$,
 'internal', ARRAY['registry','TBI','neurotrauma','GCS','GOS-E','ICP','Marshall','Rotterdam'], 1, 100, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 11. Functional neurosurgery registry manual (Registry Manuals, internal)
-- ---------------------------------------------------------------------------
('functional-neurosurgery-registry-manual',
 'Functional Neurosurgery Registry Manual',
 'Registry Manuals',
 'Data definitions for the Functional Neurosurgery Registry covering epilepsy surgery, deep brain stimulation, pain and spasticity, including device programming and outcome scales.',
 $md$
## Purpose

The Functional Neurosurgery Registry (FNR) follows patients treated surgically for epilepsy, movement disorders, chronic pain and spasticity. It captures device details, programming changes and validated outcome scales so that the program can report outcomes, refine patient selection and support research. It lives in the Research Hub under **Clinical Registries → Functional Neurosurgery Registry**.

## Inclusion

Adults (and adolescents with IRB-approved assent procedures) undergoing:

- Epilepsy surgery: resection, laser interstitial thermal therapy (LITT), responsive neurostimulation (RNS), vagus nerve stimulation (VNS), deep brain stimulation (DBS) for epilepsy, stereo-EEG (sEEG) or subdural grid implantation
- Movement-disorder surgery: DBS (STN, GPi, VIM), focused ultrasound thalamotomy, radiofrequency lesioning
- Pain surgery: spinal cord stimulation (SCS), dorsal root ganglion stimulation, intrathecal pump, microvascular decompression or percutaneous procedures for trigeminal neuralgia
- Spasticity: intrathecal baclofen (ITB) pump, selective dorsal rhizotomy

## Common data elements (all cohorts)

| Field | Definition / coding |
|---|---|
| Diagnosis and duration | Primary diagnosis, years since onset |
| Pre-operative evaluation | Multidisciplinary conference date and recommendation |
| Procedure | Type, date, laterality, target, surgeon, anesthesia (awake/asleep), imaging guidance |
| Device | Manufacturer, model, lead type, implantable pulse generator (IPG) type, rechargeable (yes/no), serial numbers (restricted field) |
| Lead location | Target coordinates and post-operative imaging confirmation |
| Complications | Hemorrhage, infection, lead migration/fracture, erosion, hardware malfunction, new deficit, seizure, revision or explant (date and reason) |
| Medications | Drug, dose and changes at each visit (medication module); compute levodopa-equivalent daily dose (LEDD) and antiseizure medication load |
| Follow-up visits | 1, 3, 6, 12 months and annually; record outcome scales and programming |

## Cohort-specific fields

### Epilepsy
| Field | Definition / coding |
|---|---|
| Seizure type and syndrome | ILAE 2017 classification |
| Pre-op seizure frequency | Seizures per month, averaged over the prior 3 months (baseline); seizure log module captures ongoing counts |
| Invasive monitoring | sEEG / subdural; number of electrodes; seizure-onset zone |
| Pathology | Hippocampal sclerosis, focal cortical dysplasia (ILAE type), tumor, vascular, other |
| **Engel class** | I (free of disabling seizures; Ia–Id), II (rare disabling seizures), III (worthwhile improvement), IV (no worthwhile improvement) at 12 months and annually |
| ILAE outcome class | 1–6, recorded alongside Engel |
| Responder | ≥ 50% seizure reduction for neuromodulation cohorts |

### Movement disorders (DBS and lesioning)
| Field | Definition / coding |
|---|---|
| Diagnosis | Parkinson disease, essential tremor, dystonia (classify), other |
| **MDS-UPDRS** | Part III motor score OFF and ON medication pre-operatively; post-operatively ON-stimulation/OFF-medication and ON/ON at 6 and 12 months; record Parts I, II and IV where collected |
| Tremor scales | Fahn–Tolosa–Marín (FTM) or TETRAS for essential tremor |
| Dystonia scales | Burke–Fahn–Marsden (BFMDRS) or TWSTRS for cervical dystonia |
| Quality of life | PDQ-39 (Parkinson), QUEST (tremor) |
| LEDD | Pre-op and at each follow-up |
| Cognitive/psychiatric screening | MoCA, depression and apathy screening pre- and post-op |

### Pain
| Field | Definition / coding |
|---|---|
| Diagnosis | Failed back surgery syndrome / persistent spinal pain syndrome, CRPS, painful diabetic neuropathy, trigeminal neuralgia, other |
| **VAS / NRS pain** | 0–10 at baseline, trial end, and each follow-up; responder = ≥ 50% reduction |
| Trial outcome | SCS trial duration and percent relief; proceed to implant (yes/no) |
| Disability and function | Oswestry Disability Index; PROMIS physical function |
| Opioid use | Morphine milligram equivalents (MME) per day |
| Trigeminal neuralgia | BNI pain intensity score (I–V) and BNI facial numbness score |

### Spasticity
| Field | Definition / coding |
|---|---|
| Etiology | Spinal cord injury, multiple sclerosis, cerebral palsy, stroke, TBI, other |
| **Modified Ashworth Scale** | 0, 1, 1+, 2, 3, 4 per muscle group (record the groups assessed) pre- and post-treatment |
| Spasm frequency | Penn Spasm Frequency Scale |
| ITB trial | Bolus dose and response |
| Pump | Reservoir volume, concentration, daily dose, refill dates, alarm date |
| Function | Goal Attainment Scaling where used |

## Device programming module

Each programming session is recorded as a separate entry:

| Field | Definition / coding |
|---|---|
| Date and clinician | — |
| Active contacts | Per lead; monopolar/bipolar; directional segments where applicable |
| Parameters | Amplitude (mA or V), pulse width (µs), frequency (Hz); for SCS also waveform (tonic, burst, high-frequency) |
| Battery / charge status | Estimated remaining longevity or recharge interval |
| Reason for change | Inadequate benefit, side effect (specify), routine optimization, battery |
| Adverse effects | Dysarthria, paresthesia, dyskinesia, mood change, gait change, stimulation-induced pain |
| Patient-reported benefit | Global impression of change (PGI-C) |

## Workflow

1. Case opened at the multidisciplinary conference decision; baseline scales entered from the pre-operative evaluation.
2. Operative and device fields entered within 7 days of surgery; serial numbers entered from the implant log.
3. Programming entries recorded at every session by the programming clinician or abstracted from the device clinic note within 14 days.
4. Outcome scales entered at each scheduled follow-up; the seizure log and medication modules are updated continuously.
5. Explants, revisions and complications entered within 7 days.

## Quality assurance

- Quarterly 10% double abstraction with emphasis on outcome scales and programming parameters.
- Validation rules: Engel class only at ≥ 12 months post-op; MDS-UPDRS Part III range 0–132; Modified Ashworth values restricted to the allowed set; amplitude units must be specified.
- Annual outcomes summary (Engel I rate, UPDRS III improvement, VAS responder rate, Ashworth change) presented at the functional neurosurgery program meeting.

## Access and security

Authenticated read; role-based write (Medical Students read-only); Admin delete only. Device serial numbers are treated as identifiers under HIPAA and must be removed from exports unless the IRB approval specifically permits them.

## Contact

Registry coordinator via **neuroresearch@saint-lukes.org**.
$md$,
 'internal', ARRAY['registry','epilepsy','DBS','Engel','UPDRS','pain','spasticity','programming'], 1, 110, true, NULL, NULL),

-- ---------------------------------------------------------------------------
-- 12. Sample size and statistics primer (Statistics, public)
-- ---------------------------------------------------------------------------
('sample-size-and-statistics-primer',
 'Sample Size and Statistics Primer',
 'Statistics',
 'A practical primer on choosing a statistical test, power and effect size, multiple comparisons, and when to bring in the statistician.',
 $md$
## Who this is for

Residents, students, fellows and faculty planning a clinical research project. It is a map, not a textbook: it tells you what decisions you need to make and when to ask for help. The department statistician is available for every project — involve them early, ideally before data collection.

## Start with the question

Write the question as a single sentence and identify:

- **Outcome** — what you are measuring, and its type (see below)
- **Exposure or comparison** — groups, treatments, or a continuous predictor
- **Unit of analysis** — patient, procedure, lesion, visit. Repeated measurements on the same patient are *not* independent and need methods that account for that.
- **Design** — retrospective cohort, case-control, cross-sectional, RCT, before-after

## Know your variable types

| Type | Examples | Summarize with |
|---|---|---|
| Continuous, roughly normal | Age, tumor volume (often log-normal) | Mean (SD) |
| Continuous, skewed | Length of stay, opioid dose | Median (IQR) |
| Ordinal | GOS-E, Engel class, Modified Ashworth, WHO grade | Median (IQR) or category counts — do not average |
| Binary | Mortality, infection, responder yes/no | n (%) |
| Nominal | Mechanism of injury, histology | n (%) |
| Time-to-event | Overall survival, time to progression, time to seizure recurrence | Kaplan–Meier median, survival at fixed times |

## Choosing a test

The table below covers most first-pass analyses. Check assumptions (normality, equal variances, expected cell counts) before trusting a p-value.

| Comparison | Parametric | Non-parametric / alternative |
|---|---|---|
| Continuous outcome, 2 independent groups | Independent-samples t-test | Mann–Whitney U |
| Continuous outcome, 2 paired measurements | Paired t-test | Wilcoxon signed-rank |
| Continuous outcome, 3+ groups | One-way ANOVA | Kruskal–Wallis |
| Binary outcome, 2+ groups | Chi-square test | Fisher's exact (any expected count < 5) |
| Binary outcome, paired | McNemar's test | — |
| Association of two continuous variables | Pearson correlation | Spearman correlation |
| Binary outcome with adjustment for confounders | Logistic regression | Penalized regression for small samples |
| Continuous outcome with adjustment | Linear regression | Quantile regression, transformation |
| Time-to-event | Cox proportional hazards | Log-rank test (unadjusted); check proportional hazards |
| Repeated measures | Mixed-effects models | GEE |
| Agreement between raters | Intraclass correlation | Cohen's / Fleiss' kappa |

Rules of thumb:

- **Report effect sizes with 95% confidence intervals** (mean difference, odds ratio, hazard ratio), not p-values alone.
- **Regression needs events.** For logistic and Cox models, plan for roughly 10–15 outcome events per predictor variable; fewer and the model will overfit.
- **Do not dichotomize continuous variables** (e.g., age > 65) unless there is a clinical reason; it discards information.
- **Missing data:** report how much and why; complete-case analysis is acceptable when missingness is small and plausibly random, otherwise discuss multiple imputation with the statistician.

## Power, effect size and sample size

A sample-size calculation answers: *how many participants do I need to have a reasonable chance (power) of detecting an effect of a given size if it truly exists?* You need four ingredients:

1. **Significance level (α)** — usually 0.05 two-sided.
2. **Power (1 − β)** — usually 0.80; 0.90 for confirmatory studies.
3. **Effect size** — the smallest difference that would be clinically meaningful (the minimal clinically important difference), *not* the difference you hope to see. Get it from prior literature, pilot data or clinical judgment.
4. **Variability** — the standard deviation for continuous outcomes, or the baseline event rate for binary outcomes.

Examples of effect-size inputs:

| Outcome type | Effect size | Also needed |
|---|---|---|
| Continuous | Difference in means (or Cohen's d: 0.2 small, 0.5 medium, 0.8 large) | SD |
| Binary | Difference in proportions, odds ratio or relative risk | Control-group rate |
| Time-to-event | Hazard ratio | Event rate, accrual and follow-up time — power depends on number of events, not patients |
| Correlation | r | — |

Then **inflate for attrition** (typically 10–20%) and for clustering if applicable.

The Research Hub includes a **sample-size calculator** under *Research Tools* for two-group comparisons of means and proportions. Use it for planning and feasibility; for grant applications, trials, survival outcomes or complex designs, have the statistician produce and document the calculation.

If your available sample is fixed (e.g., a registry cohort of 140 patients), reverse the question: *what effect size can I detect with 80% power?* If the detectable effect is larger than anything plausible, the study is underpowered and should be reframed as descriptive or hypothesis-generating.

## Multiple comparisons

Every additional test increases the chance of a false-positive finding. With 20 independent tests at α = 0.05, you expect one spurious "significant" result.

- **Prespecify** one primary outcome and a short list of secondary outcomes. Label everything else exploratory.
- **Adjust** when many comparisons address the same question: Bonferroni (simple, conservative), Holm (less conservative), or false-discovery-rate control (Benjamini–Hochberg) for large numbers of tests such as biomarker panels.
- **Subgroup analyses** should be few, prespecified, and tested with an interaction term rather than separate p-values per subgroup.
- Do not run tests until something is significant and report only that; it is a form of p-hacking.

## Common pitfalls

- Confusing **statistical** with **clinical** significance — a tiny p-value on a trivial difference in a large registry means little.
- **Immortal-time bias** in retrospective treatment comparisons (e.g., patients must survive long enough to receive adjuvant therapy).
- **Confounding by indication** — sicker patients receive different treatments; adjust, match, or use propensity methods, and state the limitation.
- Treating **ordinal scales** as continuous (averaging GOS-E or Engel classes).
- **Selective reporting** of outcomes or time points.
- Stating "no difference" when the study was underpowered — say "no significant difference was detected" and give the confidence interval.

## When to consult the statistician

Consult **before** you collect data whenever any of these apply:

- You need a sample-size justification for an IRB application, grant or trial
- The outcome is time-to-event, repeated over time, or clustered (multiple lesions per patient, multiple patients per surgeon)
- You plan a regression model with more than a handful of predictors
- You are building or validating a prediction model
- The design is a randomized or interventional study
- You are unsure which test to use

Request statistical support through **Hub → Forum & Requests** (category "Statistics") or email **neuroresearch@saint-lukes.org**. Include your one-sentence question, design, outcome type, expected numbers and timeline. Statisticians who contribute to design, analysis and interpretation should be considered for authorship under the *Authorship and Publication Policy*.

## Software

R (with RStudio), SPSS and Stata are supported institutionally; GraphPad Prism is acceptable for simple comparisons. Keep an analysis script or syntax file with every project so results can be reproduced; store it with the locked dataset.

## Further reading

- Altman DG, Bland JM. *Statistics Notes* series, BMJ.
- Equator Network reporting guidelines (STROBE, CONSORT, TRIPOD).
- Harrell FE. *Regression Modeling Strategies* — for anyone building models.
$md$,
 'public', ARRAY['statistics','sample size','power','effect size','multiple comparisons'], 1, 120, true, NULL, NULL)

ON CONFLICT (slug) DO NOTHING;
