/* ==========================================================================
   REG — shared runtime for the clinical registries (BTR / TBI / FNR).
   Load AFTER sl.js and d3 v7. Exposes window.REG.
   Auth/role gate, sub-nav router, stat cards, detail layout, D3 charts,
   CSV export/import, wizard, query builder, study-id generator, data
   completeness, audit hooks, PHI notice.
   ========================================================================== */
(function () {
  'use strict';
  const REG = {};
  const esc = (s) => SL.esc(s);

  /* ---------- roles ---------- */
  REG.WRITE_ROLES = ['Admin', 'Faculty', 'Resident', 'Research Fellow', 'CRC', 'APP', 'NP', 'PA', 'RN', 'Statistician'];
  REG.READ_ROLES = ['Medical Student', 'IRB', 'Budget & Contracts'];
  REG.canWrite = false;

  /* ---------- palette — v3 "Synapse" chart colours (dark glass) ---------- */
  REG.SERIES = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#a3e635'];
  REG.NEUTRAL = '#64748b';
  REG.STATUS = { ok: '#34d399', warn: '#fbbf24', danger: '#fb7185', info: '#60a5fa' };
  /* legacy names kept for page code: NAVY = primary series (cyan), TEAL = secondary (violet) */
  REG.NAVY = '#22d3ee'; REG.TEAL = '#a78bfa';
  REG.AMBER = '#fbbf24'; REG.INK_DARK = '#06101a';
  REG.AXIS = 'rgba(148,163,184,.25)'; REG.LABEL = '#8b98ad';
  REG.heatScale = (max) => d3.scaleSequential(d3.interpolateRgb('#0b1a2e', '#67e8f9')).domain([0, max || 1]);
  REG.HEAT_EMPTY = 'rgba(148,163,184,.06)';
  REG.heatText = (v, max) => v > (max || 1) * 0.5 ? '#06101a' : '#c3cddc';
  /** Fixed colour per label so identity never changes between charts. Status-like labels map to status colours. */
  const FIXED = {
    'Alive': REG.STATUS.ok, 'Deceased': REG.STATUS.danger, 'Unknown': REG.NEUTRAL, 'Other': REG.NEUTRAL, 'N/A': REG.NEUTRAL, 'Not tested': REG.NEUTRAL, 'None': REG.NEUTRAL,
    'Mild': REG.STATUS.ok, 'Moderate': REG.STATUS.warn, 'Severe': REG.STATUS.danger,
    'Mild (13-15)': REG.STATUS.ok, 'Moderate (9-12)': REG.STATUS.warn, 'Severe (3-8)': REG.STATUS.danger,
  };
  REG.colorFor = function (labels) {
    let i = 0; const map = {};
    labels.forEach((l) => { if (FIXED[l]) map[l] = FIXED[l]; else map[l] = REG.SERIES[i++ % REG.SERIES.length]; });
    return (l) => map[l] || REG.NEUTRAL;
  };

  /* ---------- tiny helpers ---------- */
  REG.fmtNum = (v, d) => (v == null || v === '' || isNaN(+v)) ? '—' : (+v).toFixed(d == null ? 0 : d);
  REG.pct = (n, d) => d ? Math.round((n / d) * 100) + '%' : '—';
  REG.mean = (arr, dec) => { const a = arr.filter((x) => x != null && !isNaN(+x)).map(Number); return a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(dec == null ? 1 : dec) : '—'; };
  REG.count = (rows, fn) => rows.filter(fn).length;
  REG.tally = (rows, key, fallback) => { const m = {}; rows.forEach((r) => { const v = (typeof key === 'function' ? key(r) : r[key]) || fallback || 'Unknown'; m[v] = (m[v] || 0) + 1; }); return m; };
  REG.toData = (tally, sort) => { const d = Object.keys(tally).map((k) => ({ label: k, value: tally[k] })); if (sort === 'desc') d.sort((a, b) => b.value - a.value); else if (sort === 'label') d.sort((a, b) => String(a.label).localeCompare(String(b.label))); return d; };
  REG.date = (d) => d ? SL.fmtDate(d) : '—';
  REG.dt = (d) => d ? SL.fmtDateTime(d) : '—';
  REG.val = (v, suffix) => (v == null || v === '') ? '—' : esc(String(v)) + (suffix ? ' ' + esc(suffix) : '');
  REG.uid = (() => { let n = 0; return (p) => (p || 'r') + (++n) + '_' + Math.random().toString(36).slice(2, 6); })();

  /* ---------- UI atoms ---------- */
  REG.statCard = (value, label, opts) => {
    opts = opts || {};
    const tone = opts.tone ? ` style="color:${REG.STATUS[opts.tone] || 'inherit'}"` : '';
    return `<div class="card stat reg-stat"><div class="n"${tone}>${esc(value == null ? '—' : value)}</div><div class="l">${esc(label)}</div>${opts.sub ? `<div class="xs muted">${esc(opts.sub)}</div>` : ''}</div>`;
  };
  REG.stats = (cards) => `<div class="reg-stats">${cards.join('')}</div>`;
  REG.detailField = (label, value, opts) => {
    opts = opts || {};
    const v = opts.html ? (value || '—') : REG.val(value, opts.suffix);
    return `<div class="df${opts.full ? ' df-full' : ''}"><div class="df-label">${esc(label)}</div><div class="df-value">${v}</div></div>`;
  };
  REG.detailGrid = (fields) => `<div class="detail-grid">${fields.join('')}</div>`;
  REG.section = (title, body, actions) => `<section class="reg-section"><div class="reg-section-head"><h3>${esc(title)}</h3>${actions ? `<div class="flex">${actions}</div>` : ''}</div>${body}</section>`;
  REG.tag = (text, kind) => `<span class="tag ${kind ? 'tag-' + kind : ''}">${esc(text)}</span>`;
  REG.yesNo = (v) => v === true || v === 'Yes' ? REG.tag('Yes', 'ok') : (v === false || v === 'No' ? REG.tag('No', 'outline') : REG.tag('—', 'outline'));
  REG.empty = (msg, icon) => `<div class="empty">${SL.icons[icon || 'db']}<div>${esc(msg || 'Nothing here yet.')}</div></div>`;
  REG.skeleton = (n) => `<div class="card">${Array.from({ length: n || 5 }, () => '<div class="skeleton"></div>').join('')}</div>`;
  REG.note = (msg) => `<p class="small muted" style="margin:6px 0 0">${esc(msg)}</p>`;
  REG.phiNotice = () => `<div class="phi-notice" role="note">${SL.icons.shield}<div><strong>Limited data set — IRB-governed.</strong> Records are identified by study ID only. Do not enter names, MRNs, dates of birth, addresses or any other direct identifier. Access and exports are audited.</div></div>`;
  REG.readOnlyNotice = () => `<div class="alert alert-info" style="margin-top:12px">Your role (${esc(SL.profile && SL.profile.role)}) has <strong>read-only</strong> access to the registries. Data entry is limited to clinical and research staff.</div>`;

  /* ---------- tables ---------- */
  /**
   * Render a sortable table. cols: [{key,label,render(row),num,sortKey,sortable!==false}]
   * opts: {onRow(row), empty, sticky, rowKey, sort:{key,asc}, limit}
   */
  REG.table = function (el, cols, rows, opts) {
    opts = opts || {};
    const state = opts.sort || { key: null, asc: true };
    const draw = () => {
      let data = rows.slice();
      if (state.key) {
        const col = cols.find((c) => c.key === state.key) || {};
        const k = col.sortKey || state.key;
        data.sort((a, b) => { let va = typeof k === 'function' ? k(a) : a[k], vb = typeof k === 'function' ? k(b) : b[k]; if (va == null) va = ''; if (vb == null) vb = ''; const r = (typeof va === 'number' && typeof vb === 'number') ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true }); return state.asc ? r : -r; });
      }
      if (opts.limit) data = data.slice(0, opts.limit);
      const th = cols.map((c) => `<th class="${c.num ? 'num' : ''} ${c.sortable === false ? '' : 'sortable'} ${state.key === c.key ? (state.asc ? 'asc' : 'desc') : ''}" data-key="${esc(c.key)}">${esc(c.label)}</th>`).join('');
      const body = data.length ? data.map((r, i) => `<tr data-i="${i}" ${opts.onRow ? 'class="clickable"' : ''}>${cols.map((c) => `<td class="${c.num ? 'num' : ''}">${c.render ? c.render(r) : REG.val(r[c.key])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}"><div class="empty" style="padding:28px">${esc(opts.empty || 'No rows.')}</div></td></tr>`;
      el.innerHTML = `<div class="table-wrap ${opts.sticky === false ? '' : 'sticky'}"><table class="table"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>${opts.limit && rows.length > opts.limit ? REG.note(`Showing first ${opts.limit} of ${rows.length}.`) : ''}`;
      SL.qsa('th.sortable', el).forEach((h) => h.onclick = () => { const k = h.dataset.key; if (state.key === k) state.asc = !state.asc; else { state.key = k; state.asc = true; } draw(); });
      if (opts.onRow) SL.qsa('tbody tr.clickable', el).forEach((tr) => tr.onclick = () => opts.onRow(data[+tr.dataset.i]));
    };
    draw();
    return { redraw: (r) => { if (r) rows = r; draw(); } };
  };
  REG.studyLink = (id) => `<a href="?p=detail&id=${encodeURIComponent(id || '')}" class="study-id" data-nav>${esc(id)}</a>`;

  /* ---------- CSV ---------- */
  REG.csvDownload = function (filename, rows, cols) {
    if (!rows || !rows.length) { SL.toast('Nothing to export', 'warn'); return; }
    cols = cols || Object.keys(rows[0]);
    SL.download(filename, SL.csv(rows, cols), 'text/csv;charset=utf-8');
    SL.audit('registry_export', filename.replace(/\.csv$/, ''), String(rows.length), { rows: rows.length, cols });
    SL.toast(`Exported ${rows.length} rows`, 'ok');
  };
  REG.exportBtn = (label) => `<button class="btn btn-outline btn-sm" data-export>${SL.icons.download}${esc(label || 'Export CSV')}</button>`;
  /** Parse a CSV File → rows (objects). Uses PapaParse from CDN when reachable, else a small built-in parser. */
  REG.csvImport = function (file) {
    return new Promise((resolve, reject) => {
      const fallback = () => { const r = new FileReader(); r.onload = () => resolve(REG.parseCsv(r.result)); r.onerror = reject; r.readAsText(file); };
      if (window.Papa) { window.Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => resolve(res.data), error: reject }); return; }
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/papaparse@5/papaparse.min.js';
      s.onload = () => window.Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => resolve(res.data), error: reject });
      s.onerror = fallback; document.head.appendChild(s);
    });
  };
  REG.parseCsv = function (text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map((h) => h.trim());
    return rows.filter((r) => r.some((v) => v !== '')).map((r) => { const o = {}; head.forEach((h, i) => o[h] = r[i] == null ? '' : r[i]); return o; });
  };
  /** Import dialog: pick a CSV, preview, insert rows into `table` (study_id auto-generated when blank). */
  REG.importDialog = function (table, prefix, allowedCols, onDone) {
    SL.modal(`<div class="modal-head"><h3>Import CSV</h3><button class="btn btn-ghost btn-icon" data-close>${SL.icons.close}</button></div>
      <div class="modal-body"><p class="small muted">Header row must use registry column names (e.g. <code>study_id, age_at_diagnosis, sex</code>). Unknown columns are ignored. Blank study IDs are generated. No direct identifiers.</p>
      <input type="file" accept=".csv,text/csv" id="regCsvFile" class="input"><div id="regCsvPreview" class="mt-2"></div></div>
      <div class="modal-foot"><button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" id="regCsvGo" disabled>Import</button></div>`, { size: 'lg' });
    let rows = [];
    SL.qs('#regCsvFile').onchange = async (e) => {
      try { rows = await REG.csvImport(e.target.files[0]); } catch (err) { SL.toast('Could not read file', 'err'); return; }
      const cols = Object.keys(rows[0] || {}); const known = cols.filter((c) => allowedCols.includes(c)); const unknown = cols.filter((c) => !allowedCols.includes(c));
      SL.qs('#regCsvPreview').innerHTML = `<p class="small"><strong>${rows.length}</strong> rows · ${known.length} recognised columns${unknown.length ? ` · ignored: <span class="muted">${esc(unknown.join(', '))}</span>` : ''}</p><div class="table-wrap" style="max-height:220px;overflow:auto"><table class="table"><thead><tr>${known.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 5).map((r) => `<tr>${known.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      SL.qs('#regCsvGo').disabled = !rows.length || !known.length;
    };
    SL.qs('#regCsvGo').onclick = async () => {
      const btn = SL.qs('#regCsvGo'); btn.disabled = true; btn.textContent = 'Importing…';
      let ok = 0, fail = 0;
      for (const r of rows) {
        const rec = {}; allowedCols.forEach((c) => { if (r[c] !== undefined && r[c] !== '') rec[c] = r[c]; });
        try { const saved = await REG.insertWithStudyId(table, prefix, rec); SL.audit('registry_import', table, saved.study_id || saved.id); ok++; } catch (e) { console.warn('import row failed', e); fail++; }
      }
      SL.closeModal(); SL.toast(`Imported ${ok} rows${fail ? `, ${fail} failed` : ''}`, fail ? 'warn' : 'ok');
      if (onDone) onDone();
    };
  };

  /* ---------- data access ---------- */
  const cache = {};
  REG.fetchAll = async function (table, opts) {
    opts = opts || {};
    if (!opts.force && cache[table]) return cache[table];
    let q = SL.sb.from(table).select(opts.select || '*');
    if (opts.order) q = q.order(opts.order, { ascending: opts.ascending !== false });
    const { data, error } = await q;
    if (error) { console.error(table, error); SL.toast(`Could not load ${table}: ${error.message}`, 'err'); return []; }
    cache[table] = data || []; return cache[table];
  };
  REG.invalidate = (table) => { if (table) delete cache[table]; else Object.keys(cache).forEach((k) => delete cache[k]); };
  REG.related = async function (table, patientId, order, asc) {
    let q = SL.sb.from(table).select('*').eq('patient_id', patientId);
    if (order) q = q.order(order, { ascending: asc !== false });
    const { data, error } = await q;
    if (error) { console.warn(table, error.message); return { rows: [], error }; }
    return { rows: data || [] };
  };
  /** Column probe: keys of first row when the table has data (null when empty/unknown). */
  REG.probeColumns = async function (table) {
    const { data } = await SL.sb.from(table).select('*').limit(1);
    return data && data[0] ? Object.keys(data[0]) : null;
  };
  const UNKNOWN_COL = /Could not find the '([^']+)' column/;
  /** Insert, stripping columns the table does not have (PostgREST PGRST204) so minimal forms never hard-fail on schema drift. */
  REG.insertLoose = async function (table, rec) {
    rec = Object.assign({}, rec);
    for (let i = 0; i < 6; i++) {
      const { data, error } = await SL.sb.from(table).insert([rec]).select().maybeSingle();
      if (!error) return data || rec;
      const m = UNKNOWN_COL.exec(error.message || '');
      if (error.code === 'PGRST204' && m && m[1] in rec) { console.warn(`${table}: column "${m[1]}" not in schema; skipped`); SL.toast(`Field "${m[1]}" is not in ${table}; skipped`, 'warn'); delete rec[m[1]]; continue; }
      throw error;
    }
    throw new Error('Insert failed after removing unknown columns');
  };
  REG.updateLoose = async function (table, id, rec) {
    rec = Object.assign({}, rec);
    for (let i = 0; i < 6; i++) {
      const { error } = await SL.sb.from(table).update(rec).eq('id', id);
      if (!error) return true;
      const m = UNKNOWN_COL.exec(error.message || '');
      if (error.code === 'PGRST204' && m && m[1] in rec) { delete rec[m[1]]; SL.toast(`Field "${m[1]}" is not in ${table}; skipped`, 'warn'); continue; }
      throw error;
    }
  };
  /** Next study id: PREFIX-0001 … based on the current maximum. */
  REG.nextStudyId = async function (table, prefix) {
    const { data, error } = await SL.sb.from(table).select('study_id').ilike('study_id', prefix + '-%').order('study_id', { ascending: false }).limit(1);
    if (error) throw error;
    let n = 1;
    if (data && data.length && data[0].study_id) { const m = data[0].study_id.match(/-(\d+)$/); if (m) n = parseInt(m[1], 10) + 1; }
    return prefix + '-' + String(n).padStart(4, '0');
  };
  /** Race-safe insert: generate id if blank; on unique violation (23505) regenerate and retry up to 3 times. */
  REG.insertWithStudyId = async function (table, prefix, rec) {
    rec = Object.assign({}, rec);
    const userSupplied = !!rec.study_id;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!rec.study_id || attempt > 0) rec.study_id = await REG.nextStudyId(table, prefix);
      try {
        const saved = await REG.insertLoose(table, rec);
        if (attempt > 0 || (!userSupplied && saved)) SL.toast(`Assigned study ID ${saved.study_id || rec.study_id}`, 'ok');
        return saved;
      } catch (e) {
        if (e && e.code === '23505') { if (userSupplied && attempt === 0) SL.toast(`${rec.study_id} is already taken — assigning the next free ID`, 'warn'); continue; }
        throw e;
      }
    }
    throw new Error('Could not allocate a unique study ID (3 attempts)');
  };
  REG.audit = (action, table, id, details) => SL.audit(action, table, id, details);

  /* ---------- data completeness ---------- */
  REG.completeness = function (rows, categories) {
    const total = rows.length; const filled = (r, f) => r[f] != null && r[f] !== '';
    const fieldScores = {}, catScores = {}; let allFields = [];
    Object.keys(categories).forEach((cat) => {
      const fs = categories[cat]; allFields = allFields.concat(fs);
      fs.forEach((f) => fieldScores[f] = total ? Math.round(rows.filter((r) => filled(r, f)).length / total * 100) : 0);
      catScores[cat] = fs.length ? Math.round(fs.reduce((s, f) => s + fieldScores[f], 0) / fs.length) : 0;
    });
    const vals = Object.values(fieldScores);
    const avg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
    const perPatient = rows.map((r) => ({ row: r, pct: allFields.length ? Math.round(allFields.filter((f) => filled(r, f)).length / allFields.length * 100) : 0, missing: allFields.filter((f) => !filled(r, f)) }));
    return { total, fieldScores, catScores, avg, perPatient, allFields };
  };
  REG.scoreTone = (pct) => pct >= 80 ? 'ok' : pct >= 60 ? 'info' : pct >= 40 ? 'warn' : 'danger';
  REG.progressBar = (pct, tone) => `<div class="progress"><span style="width:${Math.max(0, Math.min(100, pct))}%;background:${REG.STATUS[tone || REG.scoreTone(pct)]}"></span></div>`;

  /* ---------- forms ---------- */
  /** field: {key,label,type:text|number|date|datetime|month|select|textarea|checks|bool|boolean|static, options:[v|[v,l]], placeholder,min,max,step,help,full,required,when:{key,in:[]}} */
  REG.field = function (f, value) {
    const id = 'f_' + f.key; const v = value == null ? '' : value;
    const attrs = `name="${esc(f.key)}" id="${esc(id)}" ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}`;
    let input = '';
    const opts = (f.options || []).map((o) => Array.isArray(o) ? o : [o, o]);
    switch (f.type) {
      case 'select': input = `<select class="input" ${attrs}><option value="">${esc(f.blank || 'Select…')}</option>${opts.map(([val, lab]) => `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`; break;
      case 'bool': input = `<select class="input" ${attrs}><option value="">Select…</option><option ${v === 'Yes' ? 'selected' : ''}>Yes</option><option ${v === 'No' ? 'selected' : ''}>No</option></select>`; break;
      case 'boolean': input = `<select class="input" ${attrs}><option value="">Select…</option><option value="true" ${v === true ? 'selected' : ''}>Yes</option><option value="false" ${v === false ? 'selected' : ''}>No</option></select>`; break;
      case 'textarea': input = `<textarea class="input" rows="${f.rows || 3}" ${attrs}>${esc(v)}</textarea>`; break;
      case 'checks': { const set = new Set(String(v || '').split(',').map((s) => s.trim()).filter(Boolean)); input = `<div class="check-grid">${opts.map(([val, lab]) => `<label class="check"><input type="checkbox" name="${esc(f.key)}" value="${esc(val)}" ${set.has(val) ? 'checked' : ''}> ${esc(lab)}</label>`).join('')}</div>`; break; }
      case 'static': input = `<div class="input" style="background:rgba(255,255,255,.02);color:var(--muted)">${esc(v)}</div>`; break;
      default: { const t = f.type === 'datetime' ? 'datetime-local' : (f.type || 'text'); input = `<input class="input" type="${t}" ${attrs} value="${esc(v)}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step != null ? `step="${f.step}"` : ''}>`; }
    }
    const when = f.when ? ` data-when-key="${esc(f.when.key)}" data-when-in="${esc(f.when.in.join('|'))}"` : '';
    return `<div class="field${f.full ? ' field-full' : ''}"${when}><label for="${esc(id)}">${esc(f.label)}${f.required ? ' <span style="color:var(--danger)">*</span>' : ''}</label>${input}${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</div>`;
  };
  REG.form = (fields, values) => `<div class="form-grid">${fields.map((f) => REG.field(f, values ? values[f.key] : undefined)).join('')}</div>`;
  /** Wire `when` visibility inside a root. */
  REG.wireWhen = function (root) {
    const apply = () => SL.qsa('[data-when-key]', root).forEach((box) => { const src = root.querySelector(`[name="${box.dataset.whenKey}"]`); const on = src && box.dataset.whenIn.split('|').includes(src.value); box.classList.toggle('hidden', !on); });
    root.addEventListener('change', apply); apply();
  };
  const isHidden = (el) => !!el.closest('.hidden');
  /** Collect typed values for fields from root. Skips fields hidden by `when`. */
  REG.collect = function (root, fields) {
    const out = {};
    fields.forEach((f) => {
      if (f.type === 'static') return;
      if (f.type === 'checks') { const boxes = SL.qsa(`input[name="${f.key}"]`, root); if (boxes.length && isHidden(boxes[0])) return; const vals = boxes.filter((b) => b.checked).map((b) => b.value); out[f.key] = vals.length ? vals.join(', ') : null; return; }
      const el = root.querySelector(`[name="${f.key}"]`); if (!el || isHidden(el)) return;
      let v = el.value; if (typeof v === 'string') v = v.trim();
      if (v === '') { out[f.key] = null; return; }
      if (f.type === 'number') out[f.key] = f.step && String(f.step).includes('.') ? parseFloat(v) : (f.int === false ? parseFloat(v) : (Number.isInteger(+v) ? parseInt(v, 10) : parseFloat(v)));
      else if (f.type === 'boolean') out[f.key] = v === 'true';
      else out[f.key] = v;
    });
    return out;
  };
  REG.validate = function (root, fields) {
    for (const f of fields) { if (!f.required) continue; const el = root.querySelector(`[name="${f.key}"]`); if (el && !isHidden(el) && !el.value.trim()) { el.focus(); SL.toast(`${f.label} is required`, 'err'); return false; } }
    return true;
  };
  /** Modal form → resolves with values or null. */
  REG.modalForm = function (title, fields, values, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const bg = SL.modal(`<div class="modal-head"><h3>${esc(title)}</h3><button class="btn btn-ghost btn-icon" data-close>${SL.icons.close}</button></div><div class="modal-body"><form id="regModalForm">${opts.intro ? `<p class="small muted">${esc(opts.intro)}</p>` : ''}${REG.form(fields, values)}</form></div><div class="modal-foot"><button class="btn btn-outline" data-close>Cancel</button><button class="btn btn-primary" id="regModalSave">${esc(opts.saveLabel || 'Save')}</button></div>`, { size: opts.size || 'lg' });
      const form = SL.qs('#regModalForm'); REG.wireWhen(form);
      let done = false; const finish = (v) => { if (!done) { done = true; resolve(v); } };
      SL.qs('#regModalSave').onclick = async () => { if (!REG.validate(form, fields)) return; const b = SL.qs('#regModalSave'); b.disabled = true; finish(REG.collect(form, fields)); };
      form.onsubmit = (e) => { e.preventDefault(); SL.qs('#regModalSave').click(); };
      const obs = new MutationObserver(() => { if (!bg.classList.contains('open')) { finish(null); obs.disconnect(); } }); obs.observe(bg, { attributes: true });
    });
  };
  /** Generic "add related row" flow: modal → insertLoose → audit → callback. */
  REG.addRelated = async function (table, patientId, title, fields, onSaved) {
    if (!REG.canWrite) { SL.toast('Read-only access', 'warn'); return; }
    const vals = await REG.modalForm(title, fields);
    if (!vals) return;
    try { const row = await REG.insertLoose(table, Object.assign({ patient_id: patientId }, vals)); SL.closeModal(); SL.audit('registry_insert', table, row.id || patientId, { patient_id: patientId }); SL.toast('Saved', 'ok'); if (onSaved) onSaved(row); }
    catch (e) { SL.toast('Save failed: ' + (e.message || e), 'err'); SL.closeModal(); }
  };
  REG.editRow = async function (table, row, title, fields, onSaved) {
    if (!REG.canWrite) { SL.toast('Read-only access', 'warn'); return; }
    const vals = await REG.modalForm(title, fields, row);
    if (!vals) return;
    try { await REG.updateLoose(table, row.id, vals); SL.closeModal(); SL.audit('registry_update', table, row.study_id || row.id, { fields: Object.keys(vals) }); SL.toast('Updated', 'ok'); if (onSaved) onSaved(vals); }
    catch (e) { SL.toast('Update failed: ' + (e.message || e), 'err'); SL.closeModal(); }
  };
  /** Related-records section: table + Add button. cfg: {table,title,cols,fields,order,asc,empty,chart(el,rows)} */
  REG.relatedSection = async function (cfg, patient, onChange) {
    const { rows, error } = await REG.related(cfg.table, patient.id, cfg.order, cfg.asc);
    const id = REG.uid('rel');
    const addBtn = REG.canWrite && cfg.fields ? `<button class="btn btn-sm btn-outline" data-add="${id}">${SL.icons.plus}Add</button>` : '';
    const body = `${cfg.chart && rows.length ? `<div class="chart" id="${id}_chart"></div>` : ''}<div id="${id}"></div>${error ? REG.note('Could not load: ' + error.message) : ''}`;
    const html = REG.section(cfg.title + (rows.length ? ` (${rows.length})` : ''), body, addBtn);
    return { html, rows, mount: (root) => {
      const el = root.querySelector('#' + id); if (!el) return;
      REG.table(el, cfg.cols, rows, { empty: cfg.empty || 'No records yet.', sticky: false });
      if (cfg.chart && rows.length) cfg.chart(root.querySelector('#' + id + '_chart'), rows);
      const b = root.querySelector(`[data-add="${id}"]`); if (b) b.onclick = () => REG.addRelated(cfg.table, patient.id, 'Add — ' + cfg.title, cfg.fields, onChange);
    } };
  };

  /* ---------- wizard ---------- */
  /** steps: [{title, fields, intro}] ; opts {onSubmit(values), canWrite, submitLabel, before(root) } */
  REG.wizard = function (el, steps, opts) {
    opts = opts || {};
    const all = steps.reduce((a, s) => a.concat(s.fields), []);
    let cur = 0;
    el.innerHTML = `<div class="wizard"><ol class="wizard-steps">${steps.map((s, i) => `<li data-step="${i}"><span class="num">${i + 1}</span><span class="lbl">${esc(s.title)}</span></li>`).join('')}</ol>
      <form class="wizard-body" id="${REG.uid('wiz')}">${steps.map((s, i) => `<fieldset class="wizard-panel" data-step="${i}"><h3>${esc(s.title)}</h3>${s.intro ? `<p class="small muted">${esc(s.intro)}</p>` : ''}${REG.form(s.fields)}</fieldset>`).join('')}</form>
      <div class="wizard-foot"><button class="btn btn-outline" data-prev>Back</button><span class="muted small" data-pos></span><span class="grow"></span><button class="btn btn-primary" data-next>Next</button><button class="btn btn-accent" data-submit>${SL.icons.check}${esc(opts.submitLabel || 'Save patient')}</button></div></div>`;
    const form = SL.qs('form', el); REG.wireWhen(form);
    const show = (i) => {
      cur = i;
      SL.qsa('.wizard-panel', el).forEach((p) => p.classList.toggle('active', +p.dataset.step === i));
      SL.qsa('.wizard-steps li', el).forEach((li) => { const s = +li.dataset.step; li.classList.toggle('active', s === i); li.classList.toggle('done', s < i); });
      SL.qs('[data-prev]', el).disabled = i === 0;
      SL.qs('[data-next]', el).classList.toggle('hidden', i === steps.length - 1);
      SL.qs('[data-submit]', el).classList.toggle('hidden', i !== steps.length - 1);
      SL.qs('[data-pos]', el).textContent = `Step ${i + 1} of ${steps.length}`;
      el.scrollIntoView({ block: 'nearest' });
    };
    SL.qs('[data-prev]', el).onclick = () => show(Math.max(0, cur - 1));
    SL.qs('[data-next]', el).onclick = () => { if (REG.validate(form, steps[cur].fields)) show(Math.min(steps.length - 1, cur + 1)); };
    SL.qsa('.wizard-steps li', el).forEach((li) => li.onclick = () => { if (+li.dataset.step < cur || REG.validate(form, steps[cur].fields)) show(+li.dataset.step); });
    form.onsubmit = (e) => e.preventDefault();
    SL.qs('[data-submit]', el).onclick = async () => {
      for (let i = 0; i < steps.length; i++) if (!REG.validate(form, steps[i].fields)) { show(i); return; }
      const b = SL.qs('[data-submit]', el); b.disabled = true;
      try { await opts.onSubmit(REG.collect(form, all), form); } finally { b.disabled = false; }
    };
    if (!REG.canWrite) { SL.qsa('input,select,textarea,button', el).forEach((i) => i.disabled = true); el.insertAdjacentHTML('afterbegin', REG.readOnlyNotice()); }
    show(0);
    return { reset: () => { form.reset(); form.dispatchEvent(new Event('change')); show(0); }, form, set: (k, v) => { const i = form.querySelector(`[name="${k}"]`); if (i) i.value = v; } };
  };

  /* ---------- query builder ---------- */
  const OPS = { text: [['ilike', 'contains'], ['eq', 'is'], ['neq', 'is not'], ['null', 'is empty'], ['notnull', 'is not empty']], number: [['eq', '='], ['neq', '≠'], ['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['null', 'is empty'], ['notnull', 'is not empty']], select: [['eq', 'is'], ['neq', 'is not'], ['in', 'is any of'], ['null', 'is empty'], ['notnull', 'is not empty']], date: [['gte', 'on/after'], ['lte', 'on/before'], ['eq', 'on'], ['null', 'is empty'], ['notnull', 'is not empty']], boolean: [['is', 'is']] };
  /**
   * cfg: {table, fields:[{key,label,type,options}], cols (result columns), onRow, csvName, csvCols, initial:[{key,op,value}], clientFilter(rows,rules)}
   */
  REG.queryBuilder = function (el, cfg) {
    const rules = (cfg.initial || []).slice(); if (!rules.length) rules.push({ key: cfg.fields[0].key, op: OPS[cfg.fields[0].type || 'text'][0][0], value: '' });
    let results = [];
    const fieldOpts = (sel) => cfg.fields.map((f) => `<option value="${esc(f.key)}" ${sel === f.key ? 'selected' : ''}>${esc(f.label)}</option>`).join('');
    const rowHtml = (r, i) => {
      const f = cfg.fields.find((x) => x.key === r.key) || cfg.fields[0]; const ops = OPS[f.type || 'text'];
      const op = ops.find((o) => o[0] === r.op) ? r.op : ops[0][0];
      let val = '';
      if (op === 'null' || op === 'notnull') val = '';
      else if (f.type === 'select' && op === 'in') val = `<select class="input" data-val multiple size="3">${(f.options || []).map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${(r.value || '').split('|').includes(v) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
      else if (f.type === 'select') val = `<select class="input" data-val>${(f.options || []).map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${r.value === v ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
      else if (f.type === 'boolean') val = `<select class="input" data-val><option value="true" ${r.value === 'true' ? 'selected' : ''}>Yes</option><option value="false" ${r.value === 'false' ? 'selected' : ''}>No</option></select>`;
      else val = `<input class="input" data-val type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" value="${esc(r.value || '')}" placeholder="value">`;
      return `<div class="qb-row" data-i="${i}"><select class="input" data-field>${fieldOpts(r.key)}</select><select class="input" data-op>${ops.map((o) => `<option value="${o[0]}" ${o[0] === op ? 'selected' : ''}>${o[1]}</option>`).join('')}</select><div class="qb-val">${val}</div><button class="btn btn-ghost btn-icon" data-del title="Remove">${SL.icons.trash}</button></div>`;
    };
    const draw = () => {
      el.innerHTML = `<div class="card qb"><div class="qb-rows">${rules.map(rowHtml).join('')}</div>
        <div class="flex wrap mt-2"><button class="btn btn-outline btn-sm" data-addrule>${SL.icons.plus}Add condition</button><span class="xs muted">All conditions must match (AND).</span><span class="grow"></span><button class="btn btn-ghost btn-sm" data-clear>Clear</button><button class="btn btn-primary btn-sm" data-run>${SL.icons.search}Run query</button></div></div>
        <div class="flex between wrap mt-3"><div id="qbCount" class="muted small">Run a query to see matching patients.</div><div class="flex">${REG.exportBtn()}</div></div><div id="qbResults" class="mt-2"></div>`;
      SL.qsa('.qb-row', el).forEach((row) => {
        const i = +row.dataset.i;
        SL.qs('[data-field]', row).onchange = (e) => { rules[i] = { key: e.target.value, op: '', value: '' }; draw(); };
        SL.qs('[data-op]', row).onchange = (e) => { rules[i].op = e.target.value; rules[i].value = ''; draw(); };
        const v = SL.qs('[data-val]', row); if (v) v.onchange = () => { rules[i].value = v.multiple ? Array.from(v.selectedOptions).map((o) => o.value).join('|') : v.value; };
        SL.qs('[data-del]', row).onclick = () => { rules.splice(i, 1); if (!rules.length) rules.push({ key: cfg.fields[0].key, op: '', value: '' }); draw(); };
      });
      SL.qs('[data-addrule]', el).onclick = () => { rules.push({ key: cfg.fields[0].key, op: '', value: '' }); draw(); };
      SL.qs('[data-clear]', el).onclick = () => { rules.length = 0; rules.push({ key: cfg.fields[0].key, op: '', value: '' }); results = []; draw(); };
      SL.qs('[data-run]', el).onclick = run;
      SL.qs('[data-export]', el).onclick = () => REG.csvDownload(cfg.csvName || 'query.csv', results, cfg.csvCols || (cfg.cols || []).map((c) => c.key));
      if (results.length || SL.qs('#qbResults', el).dataset.ran) renderResults();
    };
    const renderResults = () => {
      const box = SL.qs('#qbResults', el); box.dataset.ran = '1';
      SL.qs('#qbCount', el).innerHTML = `<strong>${results.length}</strong> patient${results.length === 1 ? '' : 's'} match`;
      REG.table(box, cfg.cols, results, { onRow: cfg.onRow, empty: 'No patients match these conditions.' });
    };
    async function run() {
      // sync values from inputs first
      SL.qsa('.qb-row', el).forEach((row) => { const v = SL.qs('[data-val]', row); if (v) rules[+row.dataset.i].value = v.multiple ? Array.from(v.selectedOptions).map((o) => o.value).join('|') : v.value; rules[+row.dataset.i].op = SL.qs('[data-op]', row).value; });
      let q = SL.sb.from(cfg.table).select('*');
      const applied = [];
      for (const r of rules) {
        const f = cfg.fields.find((x) => x.key === r.key); if (!f) continue;
        const op = r.op || OPS[f.type || 'text'][0][0];
        if (f.client) { applied.push(r); continue; }
        if (op === 'null') q = q.is(r.key, null);
        else if (op === 'notnull') q = q.not(r.key, 'is', null);
        else if (r.value === '' || r.value == null) continue;
        else if (op === 'ilike') q = q.ilike(r.key, '%' + r.value + '%');
        else if (op === 'in') q = q.in(r.key, r.value.split('|').filter(Boolean));
        else if (op === 'is') q = q.is(r.key, r.value === 'true');
        else q = q[op](r.key, f.type === 'number' ? +r.value : r.value);
      }
      SL.qs('#qbResults', el).innerHTML = REG.skeleton(4);
      const { data, error } = await q.limit(2000);
      if (error) { SL.toast('Query error: ' + error.message, 'err'); SL.qs('#qbResults', el).innerHTML = ''; return; }
      results = data || [];
      if (cfg.clientFilter && applied.length) results = cfg.clientFilter(results, applied);
      SL.audit('registry_query', cfg.table, String(results.length), { rules: rules.map((r) => ({ k: r.key, op: r.op, v: r.value })) });
      renderResults();
    }
    draw();
    return { run, results: () => results, rules };
  };

  /* ---------- D3 charts (v3 dark glass) ---------- */
  const d3ok = () => { if (!window.d3) { console.warn('d3 not loaded'); return false; } return true; };
  const tip = (() => { let t; return { show(ev, html) { if (!t) { t = document.createElement('div'); t.className = 'chart-tip'; document.body.appendChild(t); } t.innerHTML = html; t.style.display = 'block'; const x = ev.clientX + 12, y = ev.clientY + 12; t.style.left = Math.min(x, window.innerWidth - t.offsetWidth - 12) + 'px'; t.style.top = (y + window.scrollY) + 'px'; }, hide() { if (t) t.style.display = 'none'; } }; })();
  REG.chartEmpty = (el, msg) => { el.innerHTML = `<div class="chart-empty">${esc(msg || 'No data yet')}</div>`; };
  const widthOf = (el) => { let n = el, w = 0; while (n && !(w = n.clientWidth)) n = n.parentElement; if (n !== el && n) w = Math.max(200, w - 48); return w || 480; };
  const baseSvg = (el, w, h) => d3.select(el).html('').append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('height', h).attr('role', 'img');

  /** Bar chart. data [{label,value}] ; opts {height, horizontal, color, colorFor, format, yLabel, max} */
  REG.bar = function (el, data, opts) {
    if (!d3ok()) return; opts = opts || {};
    if (!data || !data.length || !data.some((d) => d.value > 0)) { REG.chartEmpty(el, opts.empty); return; }
    const colorFor = opts.colorFor || (() => opts.color || REG.NAVY);
    const fmt = opts.format || ((v) => v);
    const W = Math.max(320, widthOf(el));
    if (opts.horizontal) {
      const rowH = 26, m = { top: 8, right: 48, bottom: 24, left: Math.min(W < 480 ? 150 : 200, Math.max(...data.map((d) => String(d.label).length)) * 6.5 + 12) };
      const H = m.top + m.bottom + data.length * rowH; const svg = baseSvg(el, W, H); const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
      const iw = W - m.left - m.right, ih = data.length * rowH;
      const y = d3.scaleBand().domain(data.map((d) => d.label)).range([0, ih]).padding(0.28);
      const x = d3.scaleLinear().domain([0, opts.max || d3.max(data, (d) => d.value) || 1]).nice().range([0, iw]);
      const maxLbl = W < 480 ? 22 : 34; const ya = g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0).tickFormat((l) => String(l).length > maxLbl ? String(l).slice(0, maxLbl - 1) + '…' : l)); ya.select('.domain').remove(); ya.selectAll('text').append('title').text((l) => l);
      g.append('g').attr('class', 'axis gridlines').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).ticks(4).tickSize(-ih).tickFormat(fmt)).select('.domain').remove();
      g.selectAll('rect').data(data).enter().append('rect').attr('y', (d) => y(d.label)).attr('x', 0).attr('height', y.bandwidth()).attr('width', (d) => Math.max(0, x(d.value))).attr('rx', 3).attr('class', 'bar').attr('fill', (d) => colorFor(d.label)).attr('fill-opacity', .9)
        .on('mousemove', (ev, d) => tip.show(ev, `<strong>${esc(d.label)}</strong><br>${esc(fmt(d.value))}`)).on('mouseleave', tip.hide);
      g.selectAll('.val').data(data).enter().append('text').attr('class', 'val').attr('x', (d) => x(d.value) + 5).attr('y', (d) => y(d.label) + y.bandwidth() / 2).attr('dy', '0.35em').text((d) => fmt(d.value));
      return;
    }
    const m = { top: 14, right: 12, bottom: data.some((d) => String(d.label).length > 8) ? 64 : 30, left: 40 };
    const H = opts.height || 260; const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    const svg = baseSvg(el, W, H); const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const x = d3.scaleBand().domain(data.map((d) => d.label)).range([0, iw]).padding(0.3);
    const y = d3.scaleLinear().domain([0, opts.max || d3.max(data, (d) => d.value) || 1]).nice().range([ih, 0]);
    g.append('g').attr('class', 'axis gridlines').call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(fmt)).select('.domain').remove();
    const xa = g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).tickSize(0));
    if (m.bottom > 40) xa.selectAll('text').attr('transform', 'rotate(-32)').style('text-anchor', 'end').attr('dx', '-.4em').attr('dy', '.6em');
    g.selectAll('rect').data(data).enter().append('rect').attr('x', (d) => x(d.label)).attr('y', (d) => y(d.value)).attr('width', x.bandwidth()).attr('height', (d) => Math.max(0, ih - y(d.value))).attr('rx', 3).attr('class', 'bar').attr('fill', (d) => colorFor(d.label)).attr('fill-opacity', .9)
      .on('mousemove', (ev, d) => tip.show(ev, `<strong>${esc(d.label)}</strong><br>${esc(fmt(d.value))}`)).on('mouseleave', tip.hide);
    g.selectAll('.val').data(data).enter().append('text').attr('class', 'val').attr('x', (d) => x(d.label) + x.bandwidth() / 2).attr('y', (d) => y(d.value) - 4).attr('text-anchor', 'middle').text((d) => d.value ? fmt(d.value) : '');
    if (opts.yLabel) svg.append('text').attr('class', 'axis-label').attr('transform', 'rotate(-90)').attr('x', -H / 2).attr('y', 11).attr('text-anchor', 'middle').text(opts.yLabel);
  };
  /** Grouped bar: data [{group, series:{k:v}}], keys [] */
  REG.groupedBar = function (el, data, keys, opts) {
    if (!d3ok()) return; opts = opts || {};
    if (!data.length) { REG.chartEmpty(el, opts.empty); return; }
    const W = Math.max(320, widthOf(el)), H = opts.height || 280, m = { top: 14, right: 12, bottom: 64, left: 40 }; const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    const color = REG.colorFor(keys); const fmt = opts.format || ((v) => v);
    const svg = baseSvg(el, W, H); const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    const x0 = d3.scaleBand().domain(data.map((d) => d.group)).range([0, iw]).paddingInner(0.25);
    const x1 = d3.scaleBand().domain(keys).range([0, x0.bandwidth()]).padding(0.08);
    const y = d3.scaleLinear().domain([0, opts.max || d3.max(data, (d) => d3.max(keys, (k) => d.series[k] || 0)) || 1]).nice().range([ih, 0]);
    g.append('g').attr('class', 'axis gridlines').call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(fmt)).select('.domain').remove();
    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x0).tickSize(0)).selectAll('text').attr('transform', 'rotate(-28)').style('text-anchor', 'end');
    const grp = g.selectAll('.grp').data(data).enter().append('g').attr('transform', (d) => `translate(${x0(d.group)},0)`);
    grp.selectAll('rect').data((d) => keys.map((k) => ({ k, v: d.series[k] || 0, group: d.group }))).enter().append('rect').attr('x', (d) => x1(d.k)).attr('y', (d) => y(d.v)).attr('width', x1.bandwidth()).attr('height', (d) => ih - y(d.v)).attr('rx', 2).attr('class', 'bar').attr('fill', (d) => color(d.k)).attr('fill-opacity', .9)
      .on('mousemove', (ev, d) => tip.show(ev, `<strong>${esc(d.group)}</strong><br>${esc(d.k)}: ${esc(fmt(d.v))}`)).on('mouseleave', tip.hide);
    REG.legend(el, keys.map((k) => ({ label: k, color: color(k) })));
  };
  REG.legend = (el, items) => { const div = document.createElement('div'); div.className = 'chart-legend'; div.innerHTML = items.map((i) => `<span><i style="background:${i.color};color:${i.color}"></i>${esc(i.label)}${i.value != null ? ` <b>${esc(i.value)}</b>` : ''}</span>`).join(''); el.appendChild(div); };
  /** Donut with HTML legend. */
  REG.donut = function (el, data, opts) {
    if (!d3ok()) return; opts = opts || {};
    data = (data || []).filter((d) => d.value > 0);
    if (!data.length) { REG.chartEmpty(el, opts.empty); return; }
    const size = opts.size || 200, r = size / 2 - 4; const color = opts.colorFor || REG.colorFor(data.map((d) => d.label)); const total = d3.sum(data, (d) => d.value);
    el.innerHTML = ''; const wrap = document.createElement('div'); wrap.className = 'donut-wrap'; el.appendChild(wrap);
    const svg = d3.select(wrap).append('svg').attr('viewBox', `0 0 ${size} ${size}`).attr('width', size).attr('height', size).append('g').attr('transform', `translate(${size / 2},${size / 2})`);
    const arc = d3.arc().innerRadius(r * 0.62).outerRadius(r).cornerRadius(2).padAngle(0.02);
    svg.selectAll('path').data(d3.pie().value((d) => d.value).sort(null)(data)).enter().append('path').attr('d', arc).attr('fill', (d) => color(d.data.label)).attr('stroke', 'rgba(6,10,20,.85)').attr('stroke-width', 2).style('filter', (d) => `drop-shadow(0 0 6px ${color(d.data.label)}66)`)
      .on('mousemove', (ev, d) => tip.show(ev, `<strong>${esc(d.data.label)}</strong><br>${d.data.value} (${Math.round(d.data.value / total * 100)}%)`)).on('mouseleave', tip.hide);
    svg.append('text').attr('class', 'donut-n').attr('text-anchor', 'middle').attr('dy', '-0.1em').text(opts.center != null ? opts.center : total);
    svg.append('text').attr('class', 'donut-l').attr('text-anchor', 'middle').attr('dy', '1.3em').text(opts.centerLabel || 'total');
    const leg = document.createElement('div'); leg.className = 'chart-legend vertical'; leg.innerHTML = data.map((d) => `<span><i style="background:${color(d.label)};color:${color(d.label)}"></i>${esc(d.label)} <b>${d.value}</b> <em>${Math.round(d.value / total * 100)}%</em></span>`).join(''); wrap.appendChild(leg);
  };
  /** Time/line series: series [{label, color, points:[{x:Date|number,y}]}] ; opts {threshold, zones:[{from,to,color}], yLabel, yMax, xTime, height, step} */
  REG.line = function (el, series, opts) {
    if (!d3ok()) return; opts = opts || {};
    series = (series || []).filter((s) => s.points && s.points.length);
    if (!series.length) { REG.chartEmpty(el, opts.empty); return; }
    const W = Math.max(320, widthOf(el)), H = opts.height || 260, m = { top: 14, right: 16, bottom: 40, left: 44 }; const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    const all = series.flatMap((s) => s.points);
    const x = (opts.xTime ? d3.scaleTime() : d3.scaleLinear()).domain(d3.extent(all, (d) => d.x)).range([0, iw]);
    const yMax = Math.max(opts.yMax || 0, d3.max(all, (d) => d.y) || 1) * (opts.yPad === false ? 1 : 1.08);
    const y = d3.scaleLinear().domain([opts.yMin != null ? opts.yMin : 0, yMax]).nice().range([ih, 0]);
    const svg = baseSvg(el, W, H); const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    (opts.zones || []).forEach((z) => g.append('rect').attr('x', 0).attr('width', iw).attr('y', y(Math.min(z.to, y.domain()[1]))).attr('height', Math.max(0, y(z.from) - y(Math.min(z.to, y.domain()[1])))).attr('fill', z.color).attr('opacity', 0.1));
    g.append('g').attr('class', 'axis gridlines').call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(opts.yFormat || null)).select('.domain').remove();
    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).ticks(6).tickFormat(opts.xFormat || (opts.xTime ? d3.timeFormat('%b %d %H:%M') : null))).selectAll('text').attr('transform', 'rotate(-20)').style('text-anchor', 'end');
    if (opts.threshold != null) { g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(opts.threshold)).attr('y2', y(opts.threshold)).attr('stroke', REG.STATUS.danger).attr('stroke-dasharray', '4 3'); g.append('text').attr('class', 'axis-label').attr('x', iw).attr('y', y(opts.threshold) - 4).attr('text-anchor', 'end').text(opts.thresholdLabel || ('threshold ' + opts.threshold)); }
    const color = REG.colorFor(series.map((s) => s.label));
    const line = d3.line().x((d) => x(d.x)).y((d) => y(d.y)).curve(opts.step ? d3.curveStepAfter : d3.curveMonotoneX);
    series.forEach((s) => {
      const c = s.color || color(s.label);
      g.append('path').datum(s.points).attr('fill', 'none').attr('stroke', c).attr('stroke-width', opts.step ? 2.25 : 2).attr('stroke-linejoin', 'round').attr('d', line).style('filter', `drop-shadow(0 0 6px ${c}) drop-shadow(0 0 14px ${c}55)`);
      if (!opts.step && s.points.length < 80) g.selectAll(null).data(s.points).enter().append('circle').attr('cx', (d) => x(d.x)).attr('cy', (d) => y(d.y)).attr('r', 4).attr('fill', (d) => opts.threshold != null ? (d.y > opts.threshold ? REG.STATUS.danger : c) : c).attr('stroke', '#0a1020').attr('stroke-width', 2)
        .on('mousemove', (ev, d) => tip.show(ev, `<strong>${esc(s.label)}</strong><br>${esc(opts.xTime ? SL.fmtDateTime(d.x) : (opts.xFormat ? opts.xFormat(d.x) : d.x))}<br>${esc(d.y)}${opts.unit ? ' ' + esc(opts.unit) : ''}`)).on('mouseleave', tip.hide);
    });
    if (opts.yLabel) svg.append('text').attr('class', 'axis-label').attr('transform', 'rotate(-90)').attr('x', -H / 2).attr('y', 11).attr('text-anchor', 'middle').text(opts.yLabel);
    if (series.length > 1 || opts.legend) REG.legend(el, series.map((s) => ({ label: `${s.label}${s.n != null ? ` (n=${s.n})` : ''}`, color: s.color || color(s.label) })));
  };
  /** Kaplan–Meier: groups {label: rows}; timeField, eventFn(row)->bool */
  REG.km = function (el, groups, timeField, eventFn, opts) {
    const series = [];
    Object.keys(groups).forEach((label) => {
      const ev = groups[label].filter((p) => p[timeField] != null && !isNaN(+p[timeField])).map((p) => ({ t: +p[timeField], e: eventFn(p) ? 1 : 0 })).sort((a, b) => a.t - b.t);
      if (!ev.length) return;
      let atRisk = ev.length, s = 1; const pts = [{ x: 0, y: 1 }];
      let i = 0; while (i < ev.length) { const t = ev[i].t; let d = 0, n = 0; while (i < ev.length && ev[i].t === t) { if (ev[i].e) d++; n++; i++; } if (d) { s *= (1 - d / atRisk); pts.push({ x: t, y: +s.toFixed(4) }); } atRisk -= n; }
      const maxT = ev[ev.length - 1].t; if (pts[pts.length - 1].x < maxT) pts.push({ x: maxT, y: s });
      series.push({ label, points: pts, n: ev.length });
    });
    REG.line(el, series, Object.assign({ step: true, yMax: 1, yPad: false, yFormat: d3.format('.0%'), yLabel: 'Survival probability', xFormat: (v) => v + ' mo', legend: true, height: 280 }, opts || {}));
  };
  /** Heatmap / co-occurrence matrix: matrix[i][j], labels[] (single-hue sequential ramp). */
  REG.heatmap = function (el, matrix, labels, opts) {
    if (!d3ok()) return; opts = opts || {};
    const n = labels.length, cell = 46, m = { top: 60, left: 70 }; const W = m.left + n * cell + 8, H = m.top + n * cell + 8;
    const max = d3.max(matrix.flat()) || 1; const color = REG.heatScale(max);
    const svg = d3.select(el).html('').append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', Math.min(W, widthOf(el))).attr('height', H * Math.min(1, widthOf(el) / W)); const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = matrix[i][j];
      g.append('rect').attr('x', j * cell).attr('y', i * cell).attr('width', cell - 3).attr('height', cell - 3).attr('rx', 4).attr('fill', v ? color(v) : REG.HEAT_EMPTY).attr('stroke', 'rgba(148,163,184,.12)').on('mousemove', (ev) => tip.show(ev, `<strong>${esc(labels[i])} × ${esc(labels[j])}</strong><br>${v} patients`)).on('mouseleave', tip.hide);
      g.append('text').attr('x', j * cell + (cell - 3) / 2).attr('y', i * cell + (cell - 3) / 2).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('class', 'cell').attr('fill', REG.heatText(v, max)).text(v);
    }
    labels.forEach((l, i) => { g.append('text').attr('class', 'axis-label').attr('x', -8).attr('y', i * cell + cell / 2 - 1).attr('text-anchor', 'end').attr('dominant-baseline', 'middle').text(l); g.append('text').attr('class', 'axis-label').attr('x', i * cell + cell / 2 - 1).attr('y', -10).attr('text-anchor', 'start').attr('transform', `rotate(-45 ${i * cell + cell / 2 - 1} -10)`).text(l); });
  };

  /* ---------- shell: breadcrumb, sub-nav, router ---------- */
  /**
   * cfg: {registry:'btr', title, subtitle, prefix:'BTR', table, pages:[{key,label,icon,hidden,write}], defaultPage, render(page, params, el)}
   */
  REG.init = async function (cfg) {
    const me = await SL.requireAuth();
    SL.renderHubShell({ active: 'registries' });
    REG.canWrite = SL.hasRole.apply(null, REG.WRITE_ROLES);
    REG.cfg = cfg;
    const main = SL.qs('#main');
    main.innerHTML = `<div class="breadcrumb"><a href="/hub/index.html">Hub</a> › <a href="/hub/registries/index.html">Clinical Registries</a> › ${esc(cfg.title)}</div>
      <div class="page-head"><div><h1>${esc(cfg.title)}</h1><div class="sub">${esc(cfg.subtitle || '')}</div></div>
        <div class="flex wrap">${REG.tag(REG.canWrite ? 'Read / write' : 'Read-only', REG.canWrite ? 'teal' : 'outline')}${REG.canWrite && cfg.pages.some((p) => p.key === 'add') ? `<a class="btn btn-primary btn-sm" href="?p=add" data-nav>${SL.icons.plus}Add patient</a>` : ''}</div></div>
      ${REG.phiNotice()}
      <div class="reg-layout"><nav class="reg-nav" id="regNav" aria-label="${esc(cfg.title)} sections"></nav><section class="reg-content" id="regContent" aria-live="polite"></section></div>`;
    const nav = SL.qs('#regNav'), content = SL.qs('#regContent');
    const visible = cfg.pages.filter((p) => !p.hidden && (!p.write || REG.canWrite));
    nav.innerHTML = visible.map((p) => `<a href="?p=${p.key}" data-nav data-page="${p.key}">${SL.icons[p.icon] || ''}<span>${esc(p.label)}</span></a>`).join('');
    let token = 0;
    async function render(push) {
      const params = new URLSearchParams(location.search);
      let page = params.get('p') || cfg.defaultPage || cfg.pages[0].key;
      if (!cfg.pages.some((p) => p.key === page)) page = cfg.defaultPage || cfg.pages[0].key;
      const def = cfg.pages.find((p) => p.key === page);
      if (def.write && !REG.canWrite) { SL.toast('Read-only access', 'warn'); page = cfg.defaultPage || cfg.pages[0].key; }
      SL.qsa('a[data-page]', nav).forEach((a) => a.classList.toggle('active', a.dataset.page === page));
      document.title = `${def.label} · ${cfg.title} | Saint Luke's Neuroscience Research`;
      const my = ++token;
      const el = document.createElement('div'); el.className = 'reg-page reg-enter'; el.dataset.page = page; el.innerHTML = REG.skeleton(6);
      el.addEventListener('animationend', () => el.classList.remove('reg-enter'), { once: true });
      content.innerHTML = ''; content.appendChild(el);   // mounted before render so charts can measure their width
      try { await cfg.render(page, Object.fromEntries(params.entries()), el); } catch (e) { console.error(e); el.innerHTML = `<div class="alert alert-danger">Something went wrong rendering this page: ${esc(e.message || e)}</div>`; }
      if (my !== token) { el.remove(); return; }
      if (push !== false) window.scrollTo({ top: 0 });
    }
    REG.go = (page, params, opts) => { const sp = new URLSearchParams(); sp.set('p', page); Object.keys(params || {}).forEach((k) => { if (params[k] != null && params[k] !== '') sp.set(k, params[k]); }); const url = location.pathname + '?' + sp.toString(); if (opts && opts.replace) history.replaceState({}, '', url); else history.pushState({}, '', url); render(); };
    REG.refresh = () => render(false);
    document.addEventListener('click', (e) => { const a = e.target.closest('a[data-nav]'); if (!a || e.metaKey || e.ctrlKey) return; e.preventDefault(); const sp = new URLSearchParams(a.getAttribute('href').replace(/^[^?]*\?/, '')); REG.go(sp.get('p'), Object.fromEntries(sp.entries())); });
    window.addEventListener('popstate', () => render(false));
    SL.audit('registry_open', cfg.table, cfg.registry);
    await render(false);
    return { me, canWrite: REG.canWrite };
  };
  /** Patient detail chrome: header + tabs; tabs:[{key,label,html,mount(root)}] */
  REG.detailLayout = function (el, patient, opts) {
    opts = opts || {};
    const tabs = opts.tabs;
    el.innerHTML = `<div class="detail-head"><div><div class="eyebrow">${esc(opts.kicker || 'Patient record')}</div><h2 class="mono">${esc(patient.study_id)}</h2><div class="tags" style="margin-top:6px">${opts.badges || ''}</div></div><div class="flex wrap">${opts.actions || ''}</div></div>
      <div class="tabs" role="tablist">${tabs.map((t, i) => `<button role="tab" data-tab="${t.key}" class="${i === 0 ? 'active' : ''}">${esc(t.label)}</button>`).join('')}</div>
      ${tabs.map((t, i) => `<div class="tab-panel ${i === 0 ? 'active' : ''}" data-panel="${t.key}">${t.html}</div>`).join('')}`;
    tabs.forEach((t) => { if (t.mount) t.mount(el.querySelector(`[data-panel="${t.key}"]`)); });
    const activate = (key) => { SL.qsa('[role=tab]', el).forEach((b) => b.classList.toggle('active', b.dataset.tab === key)); SL.qsa('.tab-panel', el).forEach((p) => p.classList.toggle('active', p.dataset.panel === key)); const sp = new URLSearchParams(location.search); sp.set('tab', key); history.replaceState({}, '', location.pathname + '?' + sp); };
    SL.qsa('[role=tab]', el).forEach((b) => b.onclick = () => activate(b.dataset.tab));
    const initial = new URLSearchParams(location.search).get('tab'); if (initial && tabs.some((t) => t.key === initial)) activate(initial);
  };
  /** Fetch one patient by study id (or numeric id). */
  REG.loadPatient = async function (table, id) {
    if (!id) return null;
    let q = SL.sb.from(table).select('*');
    q = /^\d+$/.test(id) ? q.eq('id', +id) : q.eq('study_id', id);
    const { data } = await q.maybeSingle();
    return data || null;
  };
  REG.notFound = (el, what) => { el.innerHTML = `<div class="empty">${SL.icons.search}<div>${esc(what || 'Patient')} not found.</div><a class="btn btn-outline btn-sm mt-2" href="?p=query" data-nav>Open query builder</a></div>`; };
  REG.listToolbar = (opts) => `<div class="filters"><div class="search grow" style="min-width:200px">${SL.icons.search}<input class="input" id="${opts.searchId || 'listSearch'}" placeholder="${esc(opts.placeholder || 'Search study ID…')}"></div>${opts.extra || ''}<span class="muted small" id="${opts.countId || 'listCount'}"></span>${REG.exportBtn()}</div>`;

  window.REG = REG;
})();
