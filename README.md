# Saint Luke's Neuroscience Research Database

A comprehensive, self-contained research operations platform for the **Neuroscience Research Department** (Neurology & Neurosurgery) at **Saint Luke's Health System**.

Built as a single-page application (SPA) with vanilla HTML, CSS, and JavaScript — no frameworks, no dependencies, no build step required.

---

## Features

### Core Platform
- **Dark neural network theme** with glassmorphic effects, animated brain logo, and particle canvas background
- **Role-Based Access Control (RBAC)** with 10+ roles: Admin, Faculty, Resident, Medical Student, APP, NP, RN, PA, IRB Reviewer, Research Fellow, CRC, Statistician
- **137+ pre-loaded user accounts** imported from department rosters
- **Global search** across projects, people, and grants (Ctrl+K)
- **Keyboard shortcuts** for quick navigation (Alt+1 through Alt+9)

### Research Project Management
- **Multi-step project creation wizard** (5 steps: Details → Protocol → IRB/Consent → Budget → Review)
- **Project lifecycle tracking**: Pre-submission → Admin Review → IRB Review → Active → Data Collection → Analysis → Publication
- **Budget auto-calculator** with dynamic row addition and preset cost mappings
- **Pipeline, Grid, and List views** for project visualization

### IRB & Compliance
- **IRB approval workflow** with dedicated reviewer access
- **Protocol and consent form validation**
- **Document uploads** restricted by role (IRB-only documents)
- **CITI training requirement tracking** for all personnel

### People & Collaboration
- **People Directory** dynamically rendering all users with role-based filtering (Faculty, Research Staff, Trainees, Medical Students, Collaborators)
- **Send Email Invitations** tab (restricted to administrators) with pre-filled email templates containing credentials and login instructions
- **Login approval workflow** — first-time users submit a login request; administrators approve before access is granted
- **Request Access** form for new personnel not yet in the system

### Data & Analysis Tools
- **REDCap-style form builder** with CSV import/export
- **Sample size calculator** supporting 7 statistical test types (t-test, ANOVA, chi-square, correlation, regression, survival, non-parametric)
- **Dataset management** with statistical resources and code review sections

### Publications & Manuscripts
- **Manuscript preparation** with collaborative on-site editor (Title, Abstract, Introduction, Methods, Results, Discussion, Conclusion, References)
- **Word document export** with academic formatting (Times New Roman, double-spaced)
- **Publication tracking** for papers, presentations, and patents

### Education & Training
- **Medical student module** with onboarding checklist, monthly Likert assessment, project requests, and mentorship tracking
- **CITI training upload** and compliance tracking
- **CME tracking** for continuing education

### Administration
- **Admin Panel** with user management, access request queue, roles & permissions reference, and audit log
- **Pending Login Approvals** dashboard for administrators
- **Credential management** — view all user credentials and export as CSV
- **Notification system** for project submissions, approvals, IRB decisions, and status changes

---

## Quick Start

### Option 1: Python HTTP Server
```bash
git clone https://github.com/kareem481/Neuroscience-research-drive.git
cd Neuroscience-research-drive
python3 -m http.server 8080
```
Open **http://localhost:8080** in your browser.

### Option 2: Open Directly
Simply open `index.html` in any modern web browser. Some features (like mailto links) work best when served via HTTP.

### Option 3: VS Code Live Server
If you have VS Code with the Live Server extension, right-click `index.html` and select "Open with Live Server."

---

## Admin Accounts

| Name | Role | Email |
|------|------|-------|
| Stephanie Kolakowsky-Hayner, PhD | Neuroscience Research Director | skolakowsky@saint-lukes.org |
| Carlos A. Bagley, MD | Neuroscience Director & Chair | cabagley@saint-lukes.org |
| Ahmad Kareem Almekkawi, MD | Neuroscience Research Fellow | aalmekkawi@saint-lukes.org |

**IRB Reviewer:** LaShanda Rose (ldrose@saint-lukes.org)

> Admin accounts without a pre-set password will save whatever password is entered on first login. User accounts have temporary passwords following the pattern `SLNeuro_LastName1!` and must be changed on first login.

---

## File Structure

```
├── index.html    # Main HTML structure (~1,064 lines)
├── styles.css    # Dark theme styles with glassmorphic effects (~909 lines)
├── app.js        # All application logic, user accounts, and features (~4,825 lines)
└── README.md     # This file
```

**No external dependencies** — all fonts (Inter, Space Grotesk) and icons (Font Awesome 6) are loaded via CDN. The entire application runs client-side.

---

## Deployment

### SharePoint (Recommended for Saint Luke's)
1. Upload `index.html`, `styles.css`, and `app.js` to a SharePoint Document Library
2. Access the site via the SharePoint URL
3. For automated emails, integrate with **Power Automate** or **Microsoft Graph API**

### GitHub Pages
1. Go to repository Settings → Pages
2. Set source to "Deploy from a branch" → `main` → `/ (root)`
3. Access at `https://kareem481.github.io/Neuroscience-research-drive/`

### Azure Static Web Apps
Upload the 3 files for a production-grade deployment with custom domain support.

---

## Technology

- **HTML5 / CSS3 / Vanilla JavaScript** — no frameworks, no build tools
- **Fonts**: Inter (body), Space Grotesk (headings) via Google Fonts
- **Icons**: Font Awesome 6 via CDN
- **Theme**: Dark mode with CSS custom properties (`--bg-primary: #0a0a1a`, `--accent-primary: #00d4ff`, `--accent-secondary: #7c3aed`, `--accent-tertiary: #10b981`)
- **Effects**: CSS `backdrop-filter: blur()`, animated SVG brain, HTML5 Canvas particle network, mouse-follow glow on cards

---

## Notes

- This is a **static front-end application** — all data is stored in-memory and resets on page refresh. For persistent data storage, a backend database integration is needed.
- **Email invitations** use `mailto:` links that open the user's default email client with pre-filled content. For automated email sending, a backend service (Microsoft Graph API, SendGrid, etc.) is required.
- The platform is designed to be **self-contained and portable** — the 3 files can be hosted anywhere that serves static content.

---

**Saint Luke's Neuroscience Research Department**
Neurology & Neurosurgery | Kansas City, Missouri
