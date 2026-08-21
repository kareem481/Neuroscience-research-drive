/* ==========================================================================
   SL — shared runtime for slresearchhub.com (Supabase client, shell, auth, UI)
   Load AFTER supabase-js UMD. Exposes window.SL.
   ========================================================================== */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://noxyrovuuprygxuyhgik.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veHlyb3Z1dXByeWd4dXloZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTUyMTgsImV4cCI6MjA4OTg5MTIxOH0.F3n5nOdpuz-1fENtAScf4Ina_v51Yz3htQGnbZhEPf4';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const SL = { sb, url: SUPABASE_URL, user: null, profile: null };
  const ROOT = document.currentScript && document.currentScript.dataset.root || '';   // '' at site root, '../' inside /hub
  SL.root = ROOT;

  // ---------- tiny helpers ----------
  SL.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  SL.qs = (sel, el) => (el || document).querySelector(sel);
  SL.qsa = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  SL.param = (k) => new URLSearchParams(location.search).get(k);
  SL.fmtDate = (d, opts) => d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', opts || { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  SL.fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  SL.initials = (name) => (name || '?').replace(/,.*$/, '').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  SL.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 250); }; };
  SL.isValidEmail = (e) => /^[^@\s]+@(saintlukeskc\.org|saint-lukes\.org|saintlukes\.org|umkc\.edu)$/i.test(e || '');

  // ---------- toast ----------
  SL.toast = (msg, type) => {
    let wrap = SL.qs('.toasts'); if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toasts'; document.body.appendChild(wrap); }
    const t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg; wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 3800);
  };

  // ---------- modal ----------
  SL.modal = (html, opts) => {
    opts = opts || {};
    let bg = SL.qs('#slModal'); if (!bg) { bg = document.createElement('div'); bg.id = 'slModal'; bg.className = 'modal-bg'; document.body.appendChild(bg); }
    bg.innerHTML = `<div class="modal ${opts.size === 'lg' ? 'modal-lg' : opts.size === 'xl' ? 'modal-xl' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    bg.classList.add('open'); document.body.style.overflow = 'hidden';
    bg.onclick = (e) => { if (e.target === bg && opts.dismissible !== false) SL.closeModal(); };
    SL.qsa('[data-close]', bg).forEach((b) => b.onclick = SL.closeModal);
    return bg;
  };
  SL.closeModal = () => { const bg = SL.qs('#slModal'); if (bg) { bg.classList.remove('open'); bg.innerHTML = ''; } document.body.style.overflow = ''; };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') SL.closeModal(); });
  SL.confirm = (msg, okLabel) => new Promise((res) => {
    SL.modal(`<div class="modal-body"><p style="margin:0">${SL.esc(msg)}</p></div><div class="modal-foot"><button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" id="slConfirmOk">${SL.esc(okLabel || 'Confirm')}</button></div>`);
    SL.qs('#slConfirmOk').onclick = () => { SL.closeModal(); res(true); };
    SL.qs('#slModal').addEventListener('click', function h(e) { if (e.target.hasAttribute('data-close') || e.target === this) { res(false); this.removeEventListener('click', h); } });
  });

  // ---------- icons (inline SVG, stroke) ----------
  const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  SL.icons = {
    search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    menu: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
    external: I('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    book: I('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>'),
    users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c3 0 5.5 2.3 5.5 5.5"/>'),
    doc: I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
    grid: I('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    flask: I('<path d="M9 3h6M10 3v6l-5.5 9A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 9V3"/>'),
    shield: I('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>'),
    db: I('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'),
    brain: I('<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h3V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-3V4z"/>'),
    cal: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    chat: I('<path d="M4 5h16v11H9l-5 4z"/>'),
    settings: I('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5A7 7 0 0 0 19 12z"/>'),
    home: I('<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    logout: I('<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>'),
    chart: I('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'),
    bell: I('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>'),
    upload: I('<path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    edit: I('<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m12.5 7.5 4 4"/>'),
    trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    download: I('<path d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16"/>'),
    check: I('<path d="m5 12 5 5L20 7"/>'),
    info: I('<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>'),
    graduation: I('<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>'),
    award: I('<circle cx="12" cy="9" r="5"/><path d="m8.5 13.5-2 7 5.5-3 5.5 3-2-7"/>'),
    globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  };
  const MARK = `<svg viewBox="0 0 24 24" fill="none" stroke="#06101a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h3V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-3V4z"/><path d="M12 8h-1.5M12 12h-2M12 16h-1.5M12 8h1.5M12 12h2M12 16h1.5" stroke="#06101a" opacity=".6"/></svg>`;

  // ---------- ambient: neural-network canvas, scroll reveal, counters ----------
  SL.ambient = function (opts) {
    opts = opts || {};
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!SL.qs('#slNeural')) {
      const c = document.createElement('canvas'); c.id = 'slNeural'; document.body.prepend(c);
      const ctx = c.getContext('2d'); let w, h, pts = [], raf, mouse = { x: -1e4, y: -1e4 };
      const N = opts.density || (window.innerWidth < 700 ? 38 : 80), LINK = 150;
      function resize() { w = c.width = window.innerWidth * devicePixelRatio; h = c.height = window.innerHeight * devicePixelRatio; c.style.width = '100%'; c.style.height = '100%'; }
      function seed() { pts = Array.from({ length: N }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .25 * devicePixelRatio, vy: (Math.random() - .5) * .25 * devicePixelRatio, r: (Math.random() * 1.6 + .8) * devicePixelRatio, p: Math.random() * Math.PI * 2 })); }
      function step(t) {
        ctx.clearRect(0, 0, w, h);
        const L = LINK * devicePixelRatio;
        for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; }
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
          if (d < L) { const al = (1 - d / L) * .35; ctx.strokeStyle = `rgba(34,211,238,${al})`; ctx.lineWidth = devicePixelRatio * .6; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            // travelling pulse along a few edges
            if ((i * 7 + j) % 23 === 0) { const k = ((t / 1800) + (i + j) * .1) % 1; ctx.fillStyle = 'rgba(167,139,250,.9)'; ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, devicePixelRatio * 1.4, 0, 7); ctx.fill(); } }
        }
        for (const p of pts) { const pulse = .6 + .4 * Math.sin(t / 900 + p.p); const md = Math.hypot(p.x - mouse.x, p.y - mouse.y); const near = md < 160 * devicePixelRatio; ctx.fillStyle = near ? 'rgba(167,139,250,.95)' : `rgba(103,232,249,${.45 + .4 * pulse})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (near ? 1.8 : pulse), 0, 7); ctx.fill(); }
        raf = requestAnimationFrame(step);
      }
      resize(); seed(); raf = requestAnimationFrame(step);
      window.addEventListener('resize', SL.debounce(() => { resize(); seed(); }, 200));
      window.addEventListener('mousemove', (e) => { mouse.x = e.clientX * devicePixelRatio; mouse.y = e.clientY * devicePixelRatio; }, { passive: true });
      document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(step); });
    }
    SL.reveal();
  };
  /** Marks .reveal / .reveal-stagger elements as visible when scrolled into view; auto-tags sections, cards and grids. */
  SL.reveal = function (root) {
    root = root || document;
    SL.qsa('section.section, div.section, div.grid, .card:not(.reveal):not(.grid > .card), .pub, .stat, .page-head', root).forEach((el) => { if (!el.closest('.reveal, .reveal-stagger, .modal')) el.classList.add(el.tagName === 'DIV' && el.classList.contains('grid') ? 'reveal-stagger' : 'reveal'); });
    const io = SL._io || (SL._io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); SL._io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .05 }));
    const vh = window.innerHeight || 800;
    SL.qsa('.reveal:not(.in), .reveal-stagger:not(.in)', root).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 1.1 && r.bottom > 0) el.classList.add('in');   // already on screen: show immediately, no observer lag
      else io.observe(el);
    });
    SL.qsa('.stat .n', root).forEach(SL.countUp);
  };
  /** Animates a numeric stat tile from 0 to its value once. */
  SL.countUp = function (el) {
    if (el.dataset.counted) return; const raw = (el.textContent || '').trim(); const m = raw.match(/^([^\d]*)([\d,]+)(.*)$/); if (!m) return;
    const target = parseInt(m[2].replace(/,/g, ''), 10); if (!isFinite(target) || target === 0) return;
    el.dataset.counted = '1'; const t0 = performance.now(), dur = 1100;
    (function tick(now) { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = m[1] + Math.round(target * e).toLocaleString() + m[3]; if (k < 1) requestAnimationFrame(tick); })(t0);
  };
  // re-run reveal/count when pages inject content later
  new MutationObserver(SL.debounce(() => { if (SL._io) SL.reveal(); }, 120)).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- public shell ----------
  const NAV = [
    { href: 'index.html', label: 'Home', key: 'home' },
    { href: 'research.html', label: 'Research', key: 'research' },
    { href: 'publications.html', label: 'Publications', key: 'publications' },
    { href: 'people.html', label: 'People', key: 'people' },
    { href: 'services.html', label: 'Services', key: 'services' },
    { href: 'docs.html', label: 'Documentation', key: 'docs' },
    { href: 'news.html', label: 'News', key: 'news' },
    { href: 'about.html', label: 'About', key: 'about' },
  ];
  SL.renderShell = function (opts) {
    opts = opts || {};
    const active = opts.active || '';
    const header = document.createElement('header');
    header.innerHTML = `
      <div class="utility-bar"><div class="container"><span>Saint Luke's Health System · Neurology &amp; Neurosurgery · Kansas City, MO</span><span><a href="https://www.saintlukeskc.org" target="_blank" rel="noopener">saintlukeskc.org</a></span></div></div>
      <div class="topbar"><div class="container">
        <a class="brand" href="${ROOT}index.html"><span class="brand-mark">${MARK}</span><span class="brand-text">Neuroscience Research<small>Saint Luke's Health System</small></span></a>
        <button class="nav-toggle" aria-label="Menu" onclick="this.nextElementSibling.classList.toggle('open')">${SL.icons.menu}</button>
        <nav class="nav">${NAV.map((n) => `<a href="${ROOT}${n.href}" class="${n.key === active ? 'active' : ''}">${n.label}</a>`).join('')}<a id="slHubLink" class="btn btn-primary btn-sm" href="${ROOT}hub/index.html">Research Hub</a></nav>
      </div></div>`;
    document.body.prepend(header);
    if (opts.footer !== false) {
      const f = document.createElement('footer'); f.className = 'footer';
      f.innerHTML = `<div class="container">
        <div><div class="brand" style="color:#fff;margin-bottom:12px"><span class="brand-mark">${MARK}</span><span class="brand-text">Neuroscience Research<small style="color:#b9c7da">Saint Luke's Health System</small></span></div>
          <p style="max-width:38ch">Advancing neurological and neurosurgical care through rigorous clinical research, registries, and education in Kansas City.</p></div>
        <div><h4>Explore</h4><a href="${ROOT}research.html">Research programs</a><a href="${ROOT}publications.html">Publications</a><a href="${ROOT}people.html">Faculty &amp; staff</a><a href="${ROOT}services.html">Services</a><a href="${ROOT}news.html">News</a></div>
        <div><h4>Resources</h4><a href="${ROOT}docs.html">Documentation</a><a href="${ROOT}docs.html?c=Onboarding">Getting started</a><a href="${ROOT}hub/index.html">Research Hub (login)</a><a href="${ROOT}about.html#contact">Contact</a></div>
        <div><h4>Department</h4><a href="${ROOT}about.html">About us</a><a href="https://www.saintlukeskc.org" target="_blank" rel="noopener">Saint Luke's Health System</a><a href="${ROOT}about.html#request-access">Request access</a></div>
      </div><div class="footer-bottom"><div class="container"><span>© ${new Date().getFullYear()} Saint Luke's Neuroscience Research Department</span><span>Neurology &amp; Neurosurgery · Kansas City, Missouri</span></div></div>`;
      document.body.appendChild(f);
    }
    SL.ambient();
    // swap hub link label when logged in
    sb.auth.getSession().then(({ data }) => { if (data.session) { const l = SL.qs('#slHubLink'); if (l) l.textContent = 'Open Hub'; } });
  };

  // ---------- hub shell (internal, login-gated) ----------
  const HUB_NAV = [
    { group: 'Overview' },
    { href: 'hub/index.html', label: 'Dashboard', key: 'dashboard', icon: 'home' },
    { href: 'hub/projects.html', label: 'Projects & IRB', key: 'projects', icon: 'flask' },
    { href: 'hub/grants.html', label: 'Grants & Deadlines', key: 'grants', icon: 'award' },
    { href: 'hub/meetings.html', label: 'Meetings & Events', key: 'meetings', icon: 'cal' },
    { group: 'Data' },
    { href: 'hub/registries/index.html', label: 'Clinical Registries', key: 'registries', icon: 'db' },
    { href: 'hub/tools.html', label: 'Research Tools', key: 'tools', icon: 'chart' },
    { href: 'hub/publications.html', label: 'Publications', key: 'publications', icon: 'book' },
    { group: 'People' },
    { href: 'hub/directory.html', label: 'Directory', key: 'directory', icon: 'users' },
    { href: 'hub/education.html', label: 'Training & Students', key: 'education', icon: 'graduation' },
    { href: 'hub/forum.html', label: 'Forum & Requests', key: 'forum', icon: 'chat' },
    { href: 'hub/services.html', label: 'Research Services', key: 'services', icon: 'shield' },
    { href: 'docs.html', label: 'Documentation', key: 'docs', icon: 'doc' },
    { group: 'Administration', admin: true },
    { href: 'hub/admin.html', label: 'Admin Panel', key: 'admin', icon: 'settings', admin: true },
  ];
  /** Builds topbar + sidebar for hub pages. Call after SL.requireAuth(). Page content goes in <main class="main" id="main">. */
  SL.renderHubShell = function (opts) {
    opts = opts || {};
    const p = SL.profile || {};
    const admin = p.role === 'Admin';
    const header = document.createElement('header');
    header.innerHTML = `<div class="topbar"><div class="container" style="max-width:none">
        <a class="brand" href="${ROOT}hub/index.html"><span class="brand-mark">${MARK}</span><span class="brand-text">Research Hub<small>Saint Luke's Neuroscience</small></span></a>
        <div class="flex" style="margin-left:auto;gap:8px">
          <a class="btn btn-ghost btn-sm" href="${ROOT}index.html">${SL.icons.globe}<span class="hide-sm">Public site</span></a>
          <button class="btn btn-ghost btn-sm btn-icon" id="slBell" title="Notifications" style="position:relative">${SL.icons.bell}<span id="slBellBadge" class="hidden" style="position:absolute;top:4px;right:4px;width:8px;height:8px;border-radius:50%;background:var(--danger)"></span></button>
          <div class="flex" style="gap:10px;padding-left:8px;border-left:1px solid var(--line)">
            <span class="avatar" style="width:34px;height:34px;font-size:.8rem">${SL.esc(p.initials || SL.initials(p.name))}</span>
            <div class="hide-sm" style="line-height:1.15"><div style="font-weight:600;font-size:.88rem">${SL.esc(p.name || '')}</div><div class="xs muted">${SL.esc(p.role || '')}</div></div>
            <button class="btn btn-ghost btn-sm btn-icon" title="Sign out" onclick="SL.signOut()">${SL.icons.logout}</button>
          </div>
        </div></div></div>`;
    document.body.prepend(header);
    const shell = document.createElement('div'); shell.className = 'shell';
    const side = document.createElement('aside'); side.className = 'sidebar';
    side.innerHTML = HUB_NAV.filter((n) => !n.admin || admin).map((n) => n.group ? `<div class="group">${n.group}</div>` : `<a href="${ROOT}${n.href}" class="${n.key === opts.active ? 'active' : ''}">${SL.icons[n.icon] || ''}<span>${n.label}</span></a>`).join('');
    const main = SL.qs('#main') || document.createElement('main');
    main.className = 'main'; main.id = 'main';
    shell.appendChild(side); shell.appendChild(main); header.after(shell);
    if (!SL.qs('style[data-sl-hub]')) { const st = document.createElement('style'); st.dataset.slHub = '1'; st.textContent = '@media(max-width:640px){.hide-sm{display:none}.topbar .container{gap:10px;padding:0 12px}.topbar .flex{gap:4px!important}.topbar .brand-text{display:none}}'; document.head.appendChild(st); }
    SL.qs('#slBell').onclick = SL.showNotifications;
    SL.refreshBadge();
    SL.ambient({ density: 40 });
  };
  SL.refreshBadge = async function () {
    if (!SL.user) return;
    const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).contains('recipients', [SL.user.email]).eq('read', false);
    const b = SL.qs('#slBellBadge'); if (b) b.classList.toggle('hidden', !count);
  };
  SL.showNotifications = async function () {
    const { data } = await sb.from('notifications').select('*').contains('recipients', [SL.user.email]).order('created_at', { ascending: false }).limit(30);
    SL.modal(`<div class="modal-head"><h3>Notifications</h3><button class="btn btn-ghost btn-icon" data-close>${SL.icons.close}</button></div><div class="modal-body" style="max-height:60vh;overflow:auto">
      ${(data && data.length) ? data.map((n) => `<div class="pub" style="padding:12px 0;${n.read ? 'opacity:.6' : ''}"><div style="font-weight:${n.read ? 400 : 600}">${SL.esc(n.message)}</div><div class="xs muted">${SL.esc(n.from_user || '')} · ${SL.fmtDateTime(n.created_at)}</div></div>`).join('') : '<div class="empty">No notifications</div>'}
      </div><div class="modal-foot"><button class="btn btn-outline btn-sm" id="slMarkAll">Mark all read</button><button class="btn btn-primary btn-sm" data-close>Close</button></div>`);
    SL.qs('#slMarkAll').onclick = async () => { await sb.from('notifications').update({ read: true }).contains('recipients', [SL.user.email]).eq('read', false); SL.closeModal(); SL.refreshBadge(); };
  };
  SL.notify = (recipients, type, message, extra) => sb.from('notifications').insert(Object.assign({ type, message, recipients, from_user: SL.profile && SL.profile.name, from_email: SL.user && SL.user.email, read: false }, extra || {})).then(() => {});

  // ---------- auth ----------
  SL.session = () => sb.auth.getSession().then(({ data }) => data.session);
  SL.loadProfile = async function () {
    const s = await SL.session(); if (!s) return null;
    SL.user = s.user;
    const { data } = await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    SL.profile = data; return data;
  };
  SL.isAdmin = () => SL.profile && SL.profile.role === 'Admin';
  SL.hasRole = (...r) => SL.profile && r.includes(SL.profile.role);
  /** Gate a page: redirects to login if no session/approval. Returns profile. */
  SL.requireAuth = async function (opts) {
    opts = opts || {};
    const p = await SL.loadProfile();
    const login = ROOT + 'login.html?next=' + encodeURIComponent(location.pathname.replace(/^\//, '') + location.search);
    if (!p) { location.replace(login); return new Promise(() => {}); }
    if (!p.login_approved && !['Admin', 'IRB'].includes(p.role)) { await sb.auth.signOut(); location.replace(login + '&pending=1'); return new Promise(() => {}); }
    if (opts.roles && !opts.roles.includes(p.role)) { SL.toast('You do not have access to that page', 'err'); location.replace(ROOT + 'hub/index.html'); return new Promise(() => {}); }
    return p;
  };
  SL.signOut = async () => { await sb.auth.signOut(); location.href = ROOT + 'index.html'; };
  SL.audit = (action, entity_type, entity_id, details) => sb.from('audit_log').insert({ action, entity_type, entity_id: String(entity_id || ''), details: details || null, user_id: SL.user && SL.user.id, user_name: SL.profile && SL.profile.name, user_role: SL.profile && SL.profile.role }).then(() => {});
  SL.sendEmail = (to, subject, html) => sb.functions.invoke('send-notification-email', { body: { to, subject, html } });
  SL.ADMIN_EMAILS = ['skolakowsky@saint-lukes.org', 'cabagley@saint-lukes.org', 'aalmekkawi@saint-lukes.org'];   // fallback; refreshed from DB below
  SL.adminsReady = sb.rpc('admin_emails').then(({ data }) => { if (Array.isArray(data) && data.length) SL.ADMIN_EMAILS = data; return SL.ADMIN_EMAILS; }).catch(() => SL.ADMIN_EMAILS);

  // ---------- storage ----------
  SL.upload = async function (bucket, folder, file) {
    const path = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) throw error;
    return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  // ---------- publications helpers (shared by public + hub) ----------
  SL.pubCitation = function (p) {
    const auth = p.author_string || '';
    const j = p.journal_abbrev || p.journal || '';
    const vol = p.volume ? `${p.volume}${p.issue ? `(${p.issue})` : ''}` : '';
    const pg = p.pages ? `:${p.pages}` : '';
    return `${auth}. ${p.title}${/[.?!]$/.test(p.title || '') ? '' : '.'} ${j}. ${p.year || ''}${vol ? ';' + vol : ''}${pg}.${p.doi ? ' doi:' + p.doi : ''}`;
  };
  SL.pubBibtex = function (p) {
    const key = ((p.authors && p.authors[0] && p.authors[0].last) || 'ref').toLowerCase().replace(/[^a-z]/g, '') + (p.year || '');
    const authors = (p.authors || []).map((a) => `${a.last}, ${a.initials || ''}`).join(' and ');
    return `@article{${key},\n  title={${p.title}},\n  author={${authors}},\n  journal={${p.journal || ''}},\n  volume={${p.volume || ''}},\n  number={${p.issue || ''}},\n  pages={${p.pages || ''}},\n  year={${p.year || ''}},\n  doi={${p.doi || ''}},\n  pmid={${p.pmid || ''}}\n}`;
  };
  SL.highlightAuthors = function (p, facultyLastNames) {
    const set = new Set((facultyLastNames || []).map((s) => s.toLowerCase()));
    return (p.authors || []).map((a) => {
      const t = SL.esc(a.last && a.initials ? `${a.last} ${a.initials}` : a.name);
      return set.has(String(a.last || '').toLowerCase()) ? `<span class="me">${t}</span>` : t;
    }).join(', ');
  };
  SL.download = function (filename, content, mime) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime || 'text/plain' })); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  SL.csv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => `"${String(r[c] == null ? '' : r[c]).replace(/"/g, '""')}"`).join(','))].join('\n');

  window.SL = SL;
})();
