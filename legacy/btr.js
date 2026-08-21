/* ============================================
   BRAIN TUMOR REGISTRY (BTR) - Application Logic
   Saint Luke's Neuroscience Research Department
   ============================================ */

console.log('%c Brain Tumor Registry ', 'font-size:16px;font-weight:bold;color:#00d4ff;background:#0a0a1a;padding:6px 14px;border-radius:8px;border:1px solid #00d4ff;');

/* ================================================
   0. SUPABASE CLIENT & AUTH
   ================================================ */
var SUPABASE_URL = 'https://noxyrovuuprygxuyhgik.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veHlyb3Z1dXByeWd4dXloZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTUyMTgsImV4cCI6MjA4OTg5MTIxOH0.F3n5nOdpuz-1fENtAScf4Ina_v51Yz3htQGnbZhEPf4';
var _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var btrUser = null;
var btrPatients = [];       // cached patient data
var btrQueryResults = [];   // current query results
var btrCurrentPatient = null; // detail view patient
var btrCohortPreview = [];  // cohort preview data
var btrBiobankData = [];    // cached specimens
var btrSortCol = null;
var btrSortAsc = true;

/* --- HTML escape --- */
function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* --- Auth check on load --- */
async function btrCheckAuth() {
    try {
        var resp = await _sb.auth.getSession();
        var session = resp.data.session;
        if (!session || !session.user) {
            window.location.href = 'index.html';
            return;
        }
        btrUser = session.user;
        var nameEl = document.getElementById('btrUserName');
        if (nameEl) nameEl.textContent = btrUser.email;
    } catch (e) {
        console.error('BTR auth check failed:', e);
        window.location.href = 'index.html';
    }
}

async function btrLogout() {
    await _sb.auth.signOut();
    window.location.href = 'index.html';
}

/* ================================================
   1. NAVIGATION & TAB SWITCHING
   ================================================ */
var btrCurrentPage = 'btr-dashboard';

function btrNavigate(pageId) {
    var pages = document.querySelectorAll('.btr-page');
    for (var i = 0; i < pages.length; i++) {
        pages[i].classList.remove('active');
    }
    var target = document.getElementById(pageId);
    if (target) target.classList.add('active');

    var links = document.querySelectorAll('.sidebar-link');
    for (var j = 0; j < links.length; j++) {
        links[j].classList.remove('active');
        if (links[j].getAttribute('data-page') === pageId) links[j].classList.add('active');
    }

    btrCurrentPage = pageId;
    var titleEl = document.getElementById('btrPageTitle');
    var titles = {
        'btr-dashboard': 'Dashboard',
        'btr-tree': 'Pathology Classification Tree',
        'btr-query': 'Query Builder',
        'btr-add': 'Add Patient',
        'btr-detail': 'Patient Detail',
        'btr-trials': 'Clinical Trials',
        'btr-quality': 'Data Quality',
        'btr-biobank': 'Biobank',
        'btr-tumorboard': 'Tumor Board',
        'btr-followup': 'Follow-Up Alerts',
        'btr-cohorts': 'Cohort Builder',
        'btr-publications': 'Publications',
        'btr-genomics': 'Genomics'
    };
    if (titleEl) titleEl.textContent = titles[pageId] || pageId;

    // Lazy-load page data
    if (pageId === 'btr-dashboard') renderDashboard();
    else if (pageId === 'btr-tree') renderPathologyTree();
    else if (pageId === 'btr-query') { /* filters ready, user clicks search */ }
    else if (pageId === 'btr-trials') renderTrials();
    else if (pageId === 'btr-quality') renderDataQuality();
    else if (pageId === 'btr-biobank') renderBiobank();
    else if (pageId === 'btr-tumorboard') renderTumorBoard();
    else if (pageId === 'btr-followup') renderFollowUp();
    else if (pageId === 'btr-cohorts') renderCohorts();
    else if (pageId === 'btr-publications') renderPublications();
    else if (pageId === 'btr-genomics') renderGenomics();
}

/* --- Toast helper --- */
function btrToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('btrToastContainer');
    if (!container) return;
    var icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle', warning: 'exclamation-triangle' };
    var toast = document.createElement('div');
    toast.className = 'btr-toast ' + type;
    toast.innerHTML = '<i class="fas fa-' + (icons[type] || 'info-circle') + '"></i> ' + _esc(message);
    container.appendChild(toast);
    setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(function () { toast.remove(); }, 300);
    }, 3500);
}

/* ================================================
   2. DATA HELPERS
   ================================================ */
async function fetchAllPatients() {
    var { data, error } = await _sb.from('btr_patients').select('*');
    if (error) { console.error('Fetch patients error:', error); return []; }
    btrPatients = data || [];
    return btrPatients;
}

function molecularBadge(value, type) {
    if (!value) return '<span class="badge mol-unknown">Unknown</span>';
    var cls = 'mol-unknown';
    var v = value.toLowerCase();
    if (v === 'mutant') cls = 'mol-mutant';
    else if (v === 'wildtype') cls = 'mol-wildtype';
    else if (v === 'methylated') cls = 'mol-methylated';
    else if (v === 'unmethylated') cls = 'mol-unmethylated';
    else if (v === 'codeleted') cls = 'mol-codeleted';
    else if (v === 'amplified') cls = 'mol-amplified';
    else if (v === 'lost') cls = 'mol-lost';
    else if (v === 'retained') cls = 'mol-retained';
    else if (v === 'deleted') cls = 'mol-deleted';
    else if (v === 'not amplified' || v === 'not deleted' || v === 'non-codeleted') cls = 'mol-wildtype';
    return '<span class="badge ' + cls + '">' + _esc(value) + '</span>';
}

function statusBadge(status) {
    if (!status) return '<span class="badge badge-gray">Unknown</span>';
    var cls = status === 'Alive' ? 'status-alive' : status === 'Deceased' ? 'status-deceased' : 'badge-gray';
    return '<span class="badge ' + cls + '">' + _esc(status) + '</span>';
}

function gradeBadge(grade) {
    if (!grade) return '<span class="badge badge-gray">N/A</span>';
    var g = String(grade).toUpperCase();
    var cls = 'badge-gray';
    if (g === 'I' || g === '1') cls = 'grade-i';
    else if (g === 'II' || g === '2') cls = 'grade-ii';
    else if (g === 'III' || g === '3') cls = 'grade-iii';
    else if (g === 'IV' || g === '4') cls = 'grade-iv';
    return '<span class="badge ' + cls + '">Grade ' + _esc(grade) + '</span>';
}

/* ================================================
   3. DASHBOARD
   ================================================ */
async function renderDashboard() {
    var pts = btrPatients.length ? btrPatients : await fetchAllPatients();
    var total = pts.length;
    var alive = pts.filter(function (p) { return p.vital_status === 'Alive'; }).length;
    var deceased = pts.filter(function (p) { return p.vital_status === 'Deceased'; }).length;
    var ages = pts.map(function (p) { return p.age_at_diagnosis; }).filter(function (a) { return a != null; });
    var meanAge = ages.length ? (ages.reduce(function (s, a) { return s + a; }, 0) / ages.length).toFixed(1) : 'N/A';
    var gtrCount = pts.filter(function (p) { return p.extent_of_resection === 'GTR'; }).length;
    var surgCount = pts.filter(function (p) { return p.extent_of_resection; }).length;
    var gtrRate = surgCount ? ((gtrCount / surgCount) * 100).toFixed(0) + '%' : 'N/A';

    var cardsEl = document.getElementById('dashStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-users', total, 'Total Patients', 'accent-cyan') +
            _statCard('fa-heartbeat', alive, 'Alive', 'accent-green') +
            _statCard('fa-skull-crossbones', deceased, 'Deceased', 'accent-red') +
            _statCard('fa-birthday-cake', meanAge, 'Mean Age', 'accent-purple') +
            _statCard('fa-cut', gtrRate, 'GTR Rate', 'accent-amber');
    }

    renderMolBarChart(pts);
    renderGradeDonut(pts);
    renderDxBarChart(pts);
    renderTxBarChart(pts);
    renderEORBarChart(pts);
    renderKMCurve();
}

function _statCard(icon, value, label, accentClass) {
    return '<div class="stat-card ' + accentClass + '">' +
        '<div class="stat-icon"><i class="fas ' + icon + '"></i></div>' +
        '<div class="stat-value">' + _esc(String(value)) + '</div>' +
        '<div class="stat-label">' + _esc(label) + '</div></div>';
}

/* --- D3 Bar Chart Helper --- */
function d3BarChart(containerId, data, options) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    var opts = options || {};
    var margin = { top: 20, right: 20, bottom: 60, left: 50 };
    var width = container.clientWidth - margin.left - margin.right;
    var height = (opts.height || 280) - margin.top - margin.bottom;
    if (width < 100) width = 300;

    var svg = d3.select('#' + containerId).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var x = d3.scaleBand().domain(data.map(function (d) { return d.label; })).range([0, width]).padding(0.3);
    var y = d3.scaleLinear().domain([0, d3.max(data, function (d) { return d.value; }) || 1]).nice().range([height, 0]);

    svg.append('g').attr('class', 'axis').attr('transform', 'translate(0,' + height + ')').call(d3.axisBottom(x))
        .selectAll('text').attr('transform', 'rotate(-35)').style('text-anchor', 'end').attr('dx', '-0.5em').attr('dy', '0.5em');
    svg.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5));

    var color = opts.color || '#00d4ff';
    svg.selectAll('.bar').data(data).enter().append('rect')
        .attr('x', function (d) { return x(d.label); })
        .attr('y', function (d) { return y(d.value); })
        .attr('width', x.bandwidth())
        .attr('height', function (d) { return height - y(d.value); })
        .attr('fill', function (d, i) {
            if (opts.colors) return opts.colors[i % opts.colors.length];
            return color;
        })
        .attr('rx', 3)
        .style('opacity', 0.85)
        .on('mouseover', function (event, d) { d3.select(this).style('opacity', 1); })
        .on('mouseout', function (event, d) { d3.select(this).style('opacity', 0.85); });

    // Value labels on bars
    svg.selectAll('.bar-label').data(data).enter().append('text')
        .attr('x', function (d) { return x(d.label) + x.bandwidth() / 2; })
        .attr('y', function (d) { return y(d.value) - 4; })
        .attr('text-anchor', 'middle')
        .attr('fill', '#9999b8')
        .attr('font-size', '10px')
        .text(function (d) { return d.value; });
}

/* --- D3 Donut/Pie Helper --- */
function d3DonutChart(containerId, data, options) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    var opts = options || {};
    var size = Math.min(container.clientWidth, opts.height || 280);
    if (size < 100) size = 260;
    var radius = size / 2 - 20;

    var svg = d3.select('#' + containerId).append('svg')
        .attr('width', size).attr('height', size)
        .append('g').attr('transform', 'translate(' + size / 2 + ',' + size / 2 + ')');

    var colorScale = d3.scaleOrdinal().domain(data.map(function (d) { return d.label; }))
        .range(opts.colors || ['#00d4ff', '#7c3aed', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899', '#6366f1']);

    var pie = d3.pie().value(function (d) { return d.value; }).sort(null);
    var arc = d3.arc().innerRadius(opts.donut !== false ? radius * 0.55 : 0).outerRadius(radius);
    var arcHover = d3.arc().innerRadius(opts.donut !== false ? radius * 0.52 : 0).outerRadius(radius + 6);

    svg.selectAll('path').data(pie(data)).enter().append('path')
        .attr('d', arc)
        .attr('fill', function (d) { return colorScale(d.data.label); })
        .style('opacity', 0.85)
        .on('mouseover', function (event, d) { d3.select(this).transition().duration(150).attr('d', arcHover).style('opacity', 1); })
        .on('mouseout', function (event, d) { d3.select(this).transition().duration(150).attr('d', arc).style('opacity', 0.85); });

    // Legend
    var legend = svg.selectAll('.legend').data(data).enter().append('g')
        .attr('transform', function (d, i) { return 'translate(' + (radius + 10) + ',' + (i * 18 - data.length * 9) + ')'; });

    // Put legend below if too many items or space is tight
    var legendG = d3.select('#' + containerId).append('div')
        .style('display', 'flex').style('flex-wrap', 'wrap').style('gap', '6px 14px')
        .style('justify-content', 'center').style('margin-top', '8px');
    data.forEach(function (d) {
        legendG.append('span')
            .style('font-size', '11px').style('color', '#9999b8')
            .style('display', 'flex').style('align-items', 'center').style('gap', '4px')
            .html('<span style="width:10px;height:10px;border-radius:2px;background:' + colorScale(d.label) + ';display:inline-block"></span>' + _esc(d.label) + ' (' + d.value + ')');
    });
}

/* --- Molecular Bar Chart --- */
function renderMolBarChart(pts) {
    var markers = [
        { key: 'idh_status', label: 'IDH', pos: 'Mutant' },
        { key: 'mgmt_status', label: 'MGMT', pos: 'Methylated' },
        { key: 'tp53_mutation', label: 'TP53', pos: 'Mutant' },
        { key: 'tert_promoter', label: 'TERT', pos: 'Mutant' },
        { key: 'egfr_amplification', label: 'EGFR', pos: 'Amplified' },
        { key: 'cdkn2a_deletion', label: 'CDKN2A', pos: 'Deleted' },
        { key: 'codel_1p19q', label: '1p/19q', pos: 'Codeleted' }
    ];
    var data = markers.map(function (m) {
        var count = pts.filter(function (p) { return p[m.key] === m.pos; }).length;
        return { label: m.label, value: count };
    });
    d3BarChart('molBarChart', data, { colors: ['#ef4444', '#00d4ff', '#ef4444', '#ef4444', '#ef4444', '#ef4444', '#7c3aed'] });
}

/* --- Grade Donut --- */
function renderGradeDonut(pts) {
    var grades = {};
    pts.forEach(function (p) {
        var g = p.who_grade || 'Unknown';
        grades[g] = (grades[g] || 0) + 1;
    });
    var data = Object.keys(grades).sort().map(function (g) { return { label: 'Grade ' + g, value: grades[g] }; });
    d3DonutChart('gradeDonut', data, { colors: ['#10b981', '#00d4ff', '#f59e0b', '#ef4444', '#666680'] });
}

/* --- Diagnosis Bar Chart --- */
function renderDxBarChart(pts) {
    var dx = {};
    pts.forEach(function (p) {
        var d = p.diagnosis || 'Unknown';
        // Shorten for display
        if (d.length > 25) d = d.substring(0, 22) + '...';
        dx[d] = (dx[d] || 0) + 1;
    });
    var data = Object.keys(dx).map(function (k) { return { label: k, value: dx[k] }; })
        .sort(function (a, b) { return b.value - a.value; }).slice(0, 12);
    d3BarChart('dxBarChart', data, { colors: ['#00d4ff', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#6366f1', '#14b8a6', '#a855f7', '#f97316', '#06b6d4'] });
}

/* --- Treatment Bar Chart --- */
function renderTxBarChart(pts) {
    var categories = { 'Surgery Only': 0, 'Surgery+RT': 0, 'Surgery+Chemo': 0, 'Trimodal': 0, 'Other': 0 };
    pts.forEach(function (p) {
        var hadSurg = p.extent_of_resection ? true : false;
        var hadRT = p.radiation_received === true || p.radiation_received === 'Yes';
        var hadChemo = p.chemotherapy_received === true || p.chemotherapy_received === 'Yes';
        if (hadSurg && hadRT && hadChemo) categories['Trimodal']++;
        else if (hadSurg && hadRT) categories['Surgery+RT']++;
        else if (hadSurg && hadChemo) categories['Surgery+Chemo']++;
        else if (hadSurg) categories['Surgery Only']++;
        else categories['Other']++;
    });
    var data = Object.keys(categories).map(function (k) { return { label: k, value: categories[k] }; });
    d3BarChart('txBarChart', data, { colors: ['#10b981', '#00d4ff', '#7c3aed', '#f59e0b', '#666680'] });
}

/* --- EOR Bar Chart --- */
function renderEORBarChart(pts) {
    var eor = { 'GTR': 0, 'STR': 0, 'Biopsy': 0, 'Unknown': 0 };
    pts.forEach(function (p) {
        var e = p.extent_of_resection || 'Unknown';
        if (eor.hasOwnProperty(e)) eor[e]++;
        else eor['Unknown']++;
    });
    var data = Object.keys(eor).map(function (k) { return { label: k, value: eor[k] }; });
    d3BarChart('eorBarChart', data, { colors: ['#10b981', '#f59e0b', '#ef4444', '#666680'] });
}

/* ================================================
   4. KAPLAN-MEIER CURVES
   ================================================ */
function renderKMCurve() {
    var container = document.getElementById('kmChart');
    if (!container) return;
    container.innerHTML = '';

    var pts = btrPatients;
    if (!pts.length) return;

    var curveType = document.getElementById('kmCurveType').value;
    var stratify = document.getElementById('kmStratify').value;

    var timeField = curveType === 'pfs' ? 'pfs_months' : 'os_months';

    // Group patients by strata
    var groups = {};
    if (stratify === 'none') {
        groups['All Patients'] = pts;
    } else {
        pts.forEach(function (p) {
            var key = p[stratify] || 'Unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
    }

    var colorScale = d3.scaleOrdinal(d3.schemeTableau10);
    var margin = { top: 20, right: 160, bottom: 50, left: 60 };
    var width = container.clientWidth - margin.left - margin.right;
    var height = 300 - margin.top - margin.bottom;
    if (width < 200) width = 400;

    var svg = d3.select('#kmChart').append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var maxTime = 0;
    var allCurves = [];

    Object.keys(groups).forEach(function (label, idx) {
        var g = groups[label];
        var events = g.filter(function (p) { return p[timeField] != null; }).map(function (p) {
            return { time: +p[timeField], event: p.vital_status === 'Deceased' ? 1 : 0 };
        }).sort(function (a, b) { return a.time - b.time; });

        if (!events.length) return;

        // Kaplan-Meier step function
        var n = events.length;
        var survived = n;
        var curve = [{ time: 0, survival: 1.0 }];
        events.forEach(function (e) {
            if (e.event === 1) {
                survived--;
                var s = survived / n;
                curve.push({ time: e.time, survival: s });
            }
            if (e.time > maxTime) maxTime = e.time;
        });
        // Extend to last time point
        if (curve[curve.length - 1].time < maxTime) {
            curve.push({ time: maxTime, survival: curve[curve.length - 1].survival });
        }
        allCurves.push({ label: label, curve: curve, color: colorScale(idx), n: events.length });
    });

    if (!maxTime) maxTime = 60;
    var x = d3.scaleLinear().domain([0, maxTime]).range([0, width]);
    var y = d3.scaleLinear().domain([0, 1]).range([height, 0]);

    svg.append('g').attr('class', 'axis').attr('transform', 'translate(0,' + height + ')').call(d3.axisBottom(x).ticks(8));
    svg.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')));

    // Axis labels
    svg.append('text').attr('x', width / 2).attr('y', height + 40).attr('text-anchor', 'middle')
        .attr('fill', '#9999b8').attr('font-size', '11px').text('Time (months)');
    svg.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -45).attr('text-anchor', 'middle')
        .attr('fill', '#9999b8').attr('font-size', '11px').text('Survival Probability');

    // Draw curves as step functions
    allCurves.forEach(function (c) {
        var line = d3.line()
            .x(function (d) { return x(d.time); })
            .y(function (d) { return y(d.survival); })
            .curve(d3.curveStepAfter);

        svg.append('path')
            .datum(c.curve)
            .attr('fill', 'none')
            .attr('stroke', c.color)
            .attr('stroke-width', 2.5)
            .attr('d', line);
    });

    // Legend
    var legend = svg.selectAll('.km-legend').data(allCurves).enter().append('g')
        .attr('class', 'km-legend')
        .attr('transform', function (d, i) { return 'translate(' + (width + 12) + ',' + (i * 22) + ')'; });
    legend.append('rect').attr('width', 14).attr('height', 3).attr('y', 5).attr('fill', function (d) { return d.color; });
    legend.append('text').attr('x', 20).attr('y', 10)
        .attr('fill', '#9999b8').attr('font-size', '11px')
        .text(function (d) { return d.label + ' (n=' + d.n + ')'; });
}

/* ================================================
   5. PATHOLOGY TREE
   ================================================ */
var BTR_TAXONOMY = {
    name: 'CNS Tumors',
    children: [
        {
            name: 'Diffuse Gliomas', children: [
                {
                    name: 'Adult-type', children: [
                        { name: 'Astrocytoma, IDH-mutant', code: 'AST-IDH' },
                        { name: 'Oligodendroglioma, IDH-mutant, 1p/19q-codeleted', code: 'ODG' },
                        { name: 'Glioblastoma, IDH-wildtype', code: 'GBM-IDH-WT' }
                    ]
                },
                {
                    name: 'Pediatric-type', children: [
                        { name: 'Diffuse Midline Glioma, H3 K27-altered', code: 'DMG' },
                        { name: 'Diffuse Hemispheric Glioma, H3 G34-mutant', code: 'DHG-H3G34' }
                    ]
                }
            ]
        },
        {
            name: 'Circumscribed Gliomas', children: [
                { name: 'Pilocytic Astrocytoma', code: 'PA' },
                { name: 'Pleomorphic Xanthoastrocytoma', code: 'PXA' },
                { name: 'Subependymal Giant Cell Astrocytoma', code: 'SEGA' },
                { name: 'Ependymoma', code: 'EPD' }
            ]
        },
        {
            name: 'Glioneuronal Tumors', children: [
                { name: 'Ganglioglioma', code: 'GG' },
                { name: 'DNET', code: 'DNET' },
                { name: 'Central Neurocytoma', code: 'CN' }
            ]
        },
        {
            name: 'Meningiomas', children: [
                { name: 'Meningioma WHO I', code: 'MNG-I' },
                { name: 'Meningioma WHO II', code: 'MNG-II' },
                { name: 'Meningioma WHO III', code: 'MNG-III' }
            ]
        },
        {
            name: 'Sellar Region', children: [
                { name: 'Pituitary Adenoma', code: 'PIT-A' },
                { name: 'Craniopharyngioma', code: 'CRANIO' },
                { name: "Rathke's Cleft Cyst", code: 'RCC' }
            ]
        },
        {
            name: 'Nerve Sheath', children: [
                { name: 'Vestibular Schwannoma', code: 'VS' },
                { name: 'Neurofibroma', code: 'NF' },
                { name: 'MPNST', code: 'MPNST' }
            ]
        },
        {
            name: 'Embryonal', children: [
                { name: 'Medulloblastoma', code: 'MB' },
                { name: 'AT/RT', code: 'ATRT' },
                { name: 'ETMR', code: 'ETMR' }
            ]
        },
        { name: 'Brain Metastasis', code: 'MET' },
        { name: 'Primary CNS Lymphoma', code: 'PCNSL' },
        { name: 'Hemangioblastoma', code: 'HB' },
        { name: 'Chordoma', code: 'CHOR' },
        { name: 'Chondrosarcoma', code: 'CS' }
    ]
};

var btrTreeRoot = null;
var btrTreeSvg = null;

function renderPathologyTree() {
    var container = document.getElementById('pathologyTree');
    if (!container) return;
    container.innerHTML = '';

    // Count patients per diagnosis
    var dxCounts = {};
    btrPatients.forEach(function (p) {
        if (p.diagnosis) {
            dxCounts[p.diagnosis] = (dxCounts[p.diagnosis] || 0) + 1;
        }
    });

    // Attach counts to leaf nodes
    function attachCounts(node) {
        if (node.code) {
            node.count = dxCounts[node.name] || 0;
        }
        if (node.children) {
            node.children.forEach(attachCounts);
            node.count = node.children.reduce(function (s, c) { return s + (c.count || 0); }, 0);
        }
    }
    var treeData = JSON.parse(JSON.stringify(BTR_TAXONOMY));
    attachCounts(treeData);

    var width = container.clientWidth - 40;
    var height = Math.max(600, Object.keys(dxCounts).length * 28 + 100);

    var svg = d3.select('#pathologyTree').append('svg')
        .attr('width', width + 40).attr('height', height);
    var g = svg.append('g').attr('transform', 'translate(20, 20)');
    btrTreeSvg = g;

    btrTreeRoot = d3.hierarchy(treeData);
    btrTreeRoot.x0 = 0;
    btrTreeRoot.y0 = 0;

    // Collapse initially to 2nd level
    if (btrTreeRoot.children) {
        btrTreeRoot.children.forEach(function (c) {
            if (c.children) collapseTree(c);
        });
    }

    var treeLayout = d3.tree().size([height - 40, width - 200]);
    updateTree(g, treeLayout, width, height);
}

function collapseTree(d) {
    if (d.children) {
        d._children = d.children;
        d._children.forEach(collapseTree);
        d.children = null;
    }
}

function updateTree(g, treeLayout, width, height) {
    treeLayout(btrTreeRoot);

    var nodes = btrTreeRoot.descendants();
    var links = btrTreeRoot.links();

    // Links
    g.selectAll('.tree-link').remove();
    g.selectAll('.tree-link').data(links).enter().insert('path', '.tree-node')
        .attr('class', 'tree-link')
        .attr('d', function (d) {
            return 'M' + d.source.y + ',' + d.source.x +
                'C' + (d.source.y + d.target.y) / 2 + ',' + d.source.x +
                ' ' + (d.source.y + d.target.y) / 2 + ',' + d.target.x +
                ' ' + d.target.y + ',' + d.target.x;
        });

    // Nodes
    g.selectAll('.tree-node').remove();
    var node = g.selectAll('.tree-node').data(nodes).enter().append('g')
        .attr('class', function (d) { return 'tree-node' + ((!d.children && !d._children) ? ' leaf' : ''); })
        .attr('transform', function (d) { return 'translate(' + d.y + ',' + d.x + ')'; })
        .on('click', function (event, d) {
            if (d.children) { d._children = d.children; d.children = null; }
            else if (d._children) { d.children = d._children; d._children = null; }
            else if (d.data.code) { showTreePatients(d.data.name); return; }
            updateTree(g, treeLayout, width, height);
        });

    node.append('circle').attr('r', function (d) { return (!d.children && !d._children && d.data.code) ? 5 : 6; });

    node.append('text')
        .attr('dy', '0.35em')
        .attr('x', function (d) { return (d.children || d._children) ? -10 : 10; })
        .attr('text-anchor', function (d) { return (d.children || d._children) ? 'end' : 'start'; })
        .text(function (d) { return d.data.name; });

    // Badge count on leaf nodes
    node.filter(function (d) { return d.data.code && d.data.count > 0; })
        .append('circle')
        .attr('cx', function (d) { return 10 + d.data.name.length * 5.5 + 14; })
        .attr('r', 9)
        .attr('fill', '#7c3aed');
    node.filter(function (d) { return d.data.code && d.data.count > 0; })
        .append('text')
        .attr('class', 'tree-badge')
        .attr('x', function (d) { return 10 + d.data.name.length * 5.5 + 14; })
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .text(function (d) { return d.data.count; });
}

function btrTreeExpandAll() {
    function expand(d) { if (d._children) { d.children = d._children; d._children = null; } if (d.children) d.children.forEach(expand); }
    if (btrTreeRoot) { expand(btrTreeRoot); renderPathologyTree(); }
}
function btrTreeCollapseAll() {
    if (btrTreeRoot && btrTreeRoot.children) {
        btrTreeRoot.children.forEach(collapseTree);
        renderPathologyTree();
    }
}

function showTreePatients(diagnosisName) {
    var panel = document.getElementById('treeDetailPanel');
    if (!panel) return;
    var matching = btrPatients.filter(function (p) { return p.diagnosis === diagnosisName; });
    if (!matching.length) {
        panel.innerHTML = '<div class="tree-detail-placeholder"><i class="fas fa-inbox"></i><p>No patients with this diagnosis</p></div>';
        return;
    }
    var html = '<h3 style="margin-bottom:12px;font-size:0.95rem;color:var(--accent-primary);">' + _esc(diagnosisName) +
        ' <span class="badge badge-cyan">' + matching.length + '</span></h3>';
    matching.forEach(function (p) {
        html += '<div class="tree-patient-card">' +
            '<div class="tpc-top"><span class="tpc-id">' + _esc(p.study_id) + '</span>' + statusBadge(p.vital_status) + '</div>' +
            '<div class="tpc-meta">Age: ' + _esc(String(p.age_at_diagnosis || 'N/A')) + ' | ' + _esc(p.sex || 'N/A') + ' | ' + gradeBadge(p.who_grade) + '</div>' +
            '<div class="tpc-actions">' +
            '<button class="btn btn-sm btn-accent" onclick="viewPatientDetail(\'' + _esc(p.study_id) + '\')"><i class="fas fa-eye"></i> View</button>' +
            '<button class="btn btn-sm btn-outline" onclick="quickAddProgression(\'' + _esc(p.study_id) + '\')"><i class="fas fa-plus"></i> Progression</button>' +
            '</div></div>';
    });
    panel.innerHTML = html;
}

/* ================================================
   6. QUERY BUILDER
   ================================================ */
async function runQuery() {
    var query = _sb.from('btr_patients').select('*');

    var ageMin = document.getElementById('qAgeMin').value;
    var ageMax = document.getElementById('qAgeMax').value;
    var sex = document.getElementById('qSex').value;
    var grade = document.getElementById('qGrade').value;
    var eor = document.getElementById('qEOR').value;
    var idh = document.getElementById('qIDH').value;
    var mgmt = document.getElementById('qMGMT').value;
    var vital = document.getElementById('qVital').value;
    var surgeon = document.getElementById('qSurgeon').value.trim();
    var dx = document.getElementById('qDiagnosis').value.trim();

    if (ageMin) query = query.gte('age_at_diagnosis', parseInt(ageMin));
    if (ageMax) query = query.lte('age_at_diagnosis', parseInt(ageMax));
    if (sex) query = query.eq('sex', sex);
    if (grade) query = query.eq('who_grade', grade);
    if (eor) query = query.eq('extent_of_resection', eor);
    if (idh) query = query.eq('idh_status', idh);
    if (mgmt) query = query.eq('mgmt_status', mgmt);
    if (vital) query = query.eq('vital_status', vital);
    if (surgeon) query = query.ilike('surgeon', '%' + surgeon + '%');
    if (dx) query = query.ilike('diagnosis', '%' + dx + '%');

    var { data, error } = await query;
    if (error) { btrToast('Query error: ' + error.message, 'error'); return; }
    btrQueryResults = data || [];
    renderQueryResults();
}

function renderQueryResults() {
    var countEl = document.getElementById('queryCount');
    if (countEl) countEl.textContent = btrQueryResults.length + ' patients found';

    var tbody = document.getElementById('queryTbody');
    if (!tbody) return;
    if (!btrQueryResults.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted);">No results. Adjust filters and search.</td></tr>';
        return;
    }
    var html = '';
    btrQueryResults.forEach(function (p) {
        html += '<tr class="clickable-row" onclick="viewPatientDetail(\'' + _esc(p.study_id) + '\')">' +
            '<td style="color:var(--accent-primary);font-weight:600">' + _esc(p.study_id) + '</td>' +
            '<td>' + _esc(String(p.age_at_diagnosis || '')) + '</td>' +
            '<td>' + _esc(p.sex || '') + '</td>' +
            '<td>' + _esc(p.diagnosis || '') + '</td>' +
            '<td>' + gradeBadge(p.who_grade) + '</td>' +
            '<td>' + molecularBadge(p.idh_status) + '</td>' +
            '<td>' + molecularBadge(p.mgmt_status) + '</td>' +
            '<td>' + _esc(p.extent_of_resection || '') + '</td>' +
            '<td>' + statusBadge(p.vital_status) + '</td>' +
            '<td>' + _esc(String(p.os_months != null ? p.os_months : '')) + '</td>' +
            '</tr>';
    });
    tbody.innerHTML = html;
}

function clearQueryFilters() {
    ['qAgeMin', 'qAgeMax', 'qSurgeon', 'qDiagnosis'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['qSex', 'qGrade', 'qEOR', 'qIDH', 'qMGMT', 'qVital'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    btrQueryResults = [];
    renderQueryResults();
    document.getElementById('queryCount').textContent = '0 patients found';
}

function exportQueryCSV() {
    if (!btrQueryResults.length) { btrToast('No results to export', 'info'); return; }
    var fields = ['study_id', 'age_at_diagnosis', 'sex', 'diagnosis', 'who_grade', 'idh_status', 'mgmt_status', 'extent_of_resection', 'vital_status', 'os_months'];
    var csv = Papa.unparse(btrQueryResults.map(function (p) {
        var row = {};
        fields.forEach(function (f) { row[f] = p[f] || ''; });
        return row;
    }));
    downloadCSV(csv, 'btr_query_results.csv');
}

function downloadCSV(csv, filename) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

/* --- Sortable table headers --- */
function initTableSorting() {
    var headers = document.querySelectorAll('#queryTable thead th[data-sort]');
    for (var i = 0; i < headers.length; i++) {
        headers[i].addEventListener('click', function () {
            var col = this.getAttribute('data-sort');
            if (btrSortCol === col) btrSortAsc = !btrSortAsc;
            else { btrSortCol = col; btrSortAsc = true; }
            btrQueryResults.sort(function (a, b) {
                var va = a[col], vb = b[col];
                if (va == null) va = '';
                if (vb == null) vb = '';
                if (typeof va === 'number' && typeof vb === 'number') return btrSortAsc ? va - vb : vb - va;
                return btrSortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
            });
            renderQueryResults();
        });
    }
}

/* ================================================
   7. ADD PATIENT WIZARD
   ================================================ */
var wizardStep = 1;
var wizardTotalSteps = 4;

function wizardNext() {
    if (wizardStep >= wizardTotalSteps) return;
    setWizardStep(wizardStep + 1);
}
function wizardPrev() {
    if (wizardStep <= 1) return;
    setWizardStep(wizardStep - 1);
}

function setWizardStep(step) {
    wizardStep = step;
    var panels = document.querySelectorAll('.wizard-panel');
    var steps = document.querySelectorAll('.wizard-step');
    for (var i = 0; i < panels.length; i++) {
        panels[i].classList.remove('active');
        if (parseInt(panels[i].getAttribute('data-step')) === step) panels[i].classList.add('active');
    }
    for (var j = 0; j < steps.length; j++) {
        var s = parseInt(steps[j].getAttribute('data-step'));
        steps[j].classList.remove('active', 'completed');
        if (s === step) steps[j].classList.add('active');
        else if (s < step) steps[j].classList.add('completed');
    }
    document.getElementById('wizPrev').disabled = step === 1;
    document.getElementById('wizNext').style.display = step === wizardTotalSteps ? 'none' : '';
    document.getElementById('wizSubmit').style.display = step === wizardTotalSteps ? '' : 'none';
}

async function autoGenerateStudyId() {
    var { data } = await _sb.from('btr_patients').select('study_id').order('study_id', { ascending: false }).limit(1);
    var nextNum = 1;
    if (data && data.length && data[0].study_id) {
        var match = data[0].study_id.match(/BTR-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
    }
    var id = 'BTR-' + String(nextNum).padStart(4, '0');
    document.getElementById('addStudyId').value = id;
}

async function submitNewPatient() {
    var studyId = document.getElementById('addStudyId').value.trim();
    if (!studyId) { btrToast('Study ID is required', 'error'); return; }

    var symptoms = [];
    var checkboxes = document.querySelectorAll('.add-symptom:checked');
    for (var i = 0; i < checkboxes.length; i++) symptoms.push(checkboxes[i].value);

    var patient = {
        study_id: studyId,
        age_at_diagnosis: document.getElementById('addAge').value ? parseInt(document.getElementById('addAge').value) : null,
        sex: document.getElementById('addSex').value || null,
        race: document.getElementById('addRace').value || null,
        ethnicity: document.getElementById('addEthnicity').value || null,
        presenting_symptoms: symptoms.length ? symptoms.join(', ') : null,
        kps_score: document.getElementById('addKPS').value ? parseInt(document.getElementById('addKPS').value) : null,
        gcs_score: document.getElementById('addGCS').value ? parseInt(document.getElementById('addGCS').value) : null,
        medical_history: document.getElementById('addMedHistory').value.trim() || null,
        surgery_date: document.getElementById('addSurgDate').value || null,
        surgery_type: document.getElementById('addSurgType').value || null,
        surgical_approach: document.getElementById('addApproach').value.trim() || null,
        extent_of_resection: document.getElementById('addEOR').value || null,
        surgeon: document.getElementById('addSurgeon').value.trim() || null,
        complications: document.getElementById('addComplications').value.trim() || null,
        diagnosis: document.getElementById('addDiagnosis').value || null,
        who_grade: document.getElementById('addGrade').value || null,
        pathology_id: document.getElementById('addPathId').value.trim() || null,
        idh_status: document.getElementById('addIDH').value || null,
        mgmt_status: document.getElementById('addMGMT').value || null,
        codel_1p19q: document.getElementById('add1p19q').value || null,
        tert_promoter: document.getElementById('addTERT').value || null,
        egfr_amplification: document.getElementById('addEGFR').value || null,
        tp53_mutation: document.getElementById('addTP53').value || null,
        atrx_status: document.getElementById('addATRX').value || null,
        cdkn2a_deletion: document.getElementById('addCDKN2A').value || null,
        ki67_percent: document.getElementById('addKi67').value ? parseFloat(document.getElementById('addKi67').value) : null,
        vital_status: 'Alive'
    };

    var { data, error } = await _sb.from('btr_patients').insert([patient]).select();
    if (error) {
        btrToast('Error saving patient: ' + error.message, 'error');
        return;
    }
    btrToast('Patient ' + studyId + ' saved successfully!', 'success');
    // Reset wizard
    setWizardStep(1);
    document.querySelectorAll('#btr-add input, #btr-add select, #btr-add textarea').forEach(function (el) {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
    });
    // Refresh cache
    await fetchAllPatients();
}

/* ================================================
   8. PATIENT DETAIL
   ================================================ */
async function viewPatientDetail(studyId) {
    btrNavigate('btr-detail');
    var container = document.getElementById('detailContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#00d4ff"></i><p style="color:#9999b8;margin-top:10px">Loading patient...</p></div>';

    var { data: patient, error } = await _sb.from('btr_patients').select('*').eq('study_id', studyId).single();
    if (error || !patient) {
        container.innerHTML = '<div class="detail-placeholder"><i class="fas fa-exclamation-circle"></i><p>Patient not found</p></div>';
        return;
    }
    btrCurrentPatient = patient;

    // Fetch related data in parallel
    var pid = patient.id;
    var progressionsP = _sb.from('btr_progressions').select('*').eq('patient_id', pid);
    var surgeriesP = _sb.from('btr_surgeries').select('*').eq('patient_id', pid);
    var radiationP = _sb.from('btr_radiation_treatments').select('*').eq('patient_id', pid);
    var chemoP = _sb.from('btr_chemotherapy_regimens').select('*').eq('patient_id', pid);
    var imagingP = _sb.from('btr_imaging_studies').select('*').eq('patient_id', pid);
    var volumeP = _sb.from('btr_volumetric_measurements').select('*').eq('patient_id', pid);
    var ranoP = _sb.from('btr_rano_assessments').select('*').eq('patient_id', pid);
    var followupsP = _sb.from('btr_follow_ups').select('*').eq('patient_id', pid);

    var results = await Promise.all([progressionsP, surgeriesP, radiationP, chemoP, imagingP, volumeP, ranoP, followupsP]);
    var progressions = results[0].data || [];
    var surgeries = results[1].data || [];
    var radiation = results[2].data || [];
    var chemo = results[3].data || [];
    var imaging = results[4].data || [];
    var volumes = results[5].data || [];
    var rano = results[6].data || [];
    var followups = results[7].data || [];

    var p = patient;
    var html = '';

    // Header
    html += '<div class="detail-header">';
    html += '<div class="detail-header-left">';
    html += '<h2>' + _esc(p.study_id) + '</h2>';
    html += '<div class="detail-subtitle">' + _esc(p.diagnosis || 'No diagnosis') + ' &bull; ' + gradeBadge(p.who_grade) + ' &bull; ' + statusBadge(p.vital_status) + '</div>';
    html += '</div>';
    html += '<div class="detail-header-right">';
    html += '<button class="btn btn-outline" onclick="showEditPatientModal()"><i class="fas fa-edit"></i> Edit</button>';
    html += '<button class="btn btn-accent" onclick="quickAddProgression(\'' + _esc(p.study_id) + '\')"><i class="fas fa-plus"></i> Add Progression</button>';
    html += '</div></div>';

    // Tabs
    html += '<div class="detail-tabs">';
    var tabs = ['Overview', 'Clinical', 'Treatment', 'Imaging', 'Pathology', 'Follow-up'];
    tabs.forEach(function (t, i) {
        html += '<button class="detail-tab' + (i === 0 ? ' active' : '') + '" onclick="switchDetailTab(' + i + ')" data-idx="' + i + '">' + t + '</button>';
    });
    html += '</div>';

    // Tab 0: Overview
    html += '<div class="detail-tab-panel active" data-idx="0">';
    html += '<div class="detail-section"><h4><i class="fas fa-user"></i> Demographics</h4><div class="detail-grid">';
    html += _detailField('Age', p.age_at_diagnosis) + _detailField('Sex', p.sex) + _detailField('Race', p.race) + _detailField('Ethnicity', p.ethnicity);
    html += '</div></div>';
    html += '<div class="detail-section"><h4><i class="fas fa-microscope"></i> Diagnosis &amp; Molecular</h4><div class="detail-grid">';
    html += _detailField('Diagnosis', p.diagnosis) + _detailField('WHO Grade', p.who_grade);
    html += '<div class="detail-field"><div class="df-label">IDH</div><div class="df-value">' + molecularBadge(p.idh_status) + '</div></div>';
    html += '<div class="detail-field"><div class="df-label">MGMT</div><div class="df-value">' + molecularBadge(p.mgmt_status) + '</div></div>';
    html += '<div class="detail-field"><div class="df-label">1p/19q</div><div class="df-value">' + molecularBadge(p.codel_1p19q) + '</div></div>';
    html += '<div class="detail-field"><div class="df-label">TERT</div><div class="df-value">' + molecularBadge(p.tert_promoter) + '</div></div>';
    html += '</div></div>';
    html += '<div class="detail-section"><h4><i class="fas fa-heartbeat"></i> Outcomes</h4><div class="detail-grid">';
    html += _detailField('Vital Status', p.vital_status) + _detailField('OS (months)', p.os_months) + _detailField('PFS (months)', p.pfs_months) + _detailField('Last Follow-up', p.last_followup_date);
    html += '</div></div>';
    html += '</div>';

    // Tab 1: Clinical
    html += '<div class="detail-tab-panel" data-idx="1">';
    html += '<div class="detail-section"><h4><i class="fas fa-stethoscope"></i> Presentation</h4><div class="detail-grid">';
    html += _detailField('Symptoms', p.presenting_symptoms) + _detailField('KPS', p.kps_score) + _detailField('GCS', p.gcs_score);
    html += '</div></div>';
    html += '<div class="detail-section"><h4><i class="fas fa-notes-medical"></i> Medical History</h4><p style="color:var(--text-secondary);font-size:0.85rem">' + _esc(p.medical_history || 'None recorded') + '</p></div>';
    html += '</div>';

    // Tab 2: Treatment
    html += '<div class="detail-tab-panel" data-idx="2">';
    html += '<div class="detail-section"><h4><i class="fas fa-cut"></i> Surgery</h4>';
    if (surgeries.length) {
        surgeries.forEach(function (s) {
            html += '<div class="detail-grid">';
            html += _detailField('Date', s.surgery_date) + _detailField('Type', s.surgery_type) + _detailField('EOR', s.extent_of_resection) + _detailField('Surgeon', s.surgeon);
            html += '</div><hr style="border-color:var(--border-color);margin:8px 0">';
        });
    } else {
        html += '<div class="detail-grid">';
        html += _detailField('Date', p.surgery_date) + _detailField('Type', p.surgery_type) + _detailField('EOR', p.extent_of_resection) + _detailField('Surgeon', p.surgeon);
        html += '</div>';
    }
    html += '</div>';
    html += '<div class="detail-section"><h4><i class="fas fa-radiation"></i> Radiation</h4>';
    if (radiation.length) {
        radiation.forEach(function (r) {
            html += '<div class="detail-grid">';
            html += _detailField('Dose', r.total_dose ? r.total_dose + ' Gy' : null) + _detailField('Fractions', r.fractions) + _detailField('Technique', r.technique) + _detailField('Start', r.start_date);
            html += '</div>';
        });
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No radiation records</p>'; }
    html += '</div>';
    html += '<div class="detail-section"><h4><i class="fas fa-pills"></i> Chemotherapy</h4>';
    if (chemo.length) {
        chemo.forEach(function (c) {
            html += '<div class="detail-grid">';
            html += _detailField('Regimen', c.regimen) + _detailField('Cycles', c.cycles_completed) + _detailField('Start', c.start_date) + _detailField('End', c.end_date);
            html += '</div>';
        });
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No chemotherapy records</p>'; }
    html += '</div>';
    html += '</div>';

    // Tab 3: Imaging
    html += '<div class="detail-tab-panel" data-idx="3">';
    html += '<div class="detail-section"><h4><i class="fas fa-x-ray"></i> Imaging Studies</h4>';
    if (imaging.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Modality</th><th>Findings</th></tr></thead><tbody>';
        imaging.forEach(function (im) {
            html += '<tr><td>' + _esc(im.study_date || '') + '</td><td>' + _esc(im.modality || '') + '</td><td>' + _esc(im.findings || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No imaging studies</p>'; }
    html += '</div>';
    html += '<div class="detail-section"><h4><i class="fas fa-cube"></i> Volumetric Measurements</h4>';
    if (volumes.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Volume (cc)</th><th>Method</th></tr></thead><tbody>';
        volumes.forEach(function (v) {
            html += '<tr><td>' + _esc(v.measurement_date || '') + '</td><td>' + _esc(String(v.volume_cc || '')) + '</td><td>' + _esc(v.method || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No volumetric data</p>'; }
    html += '</div>';
    html += '<div class="detail-section"><h4><i class="fas fa-chart-line"></i> RANO Assessments</h4>';
    if (rano.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Response</th><th>Notes</th></tr></thead><tbody>';
        rano.forEach(function (r) {
            html += '<tr><td>' + _esc(r.assessment_date || '') + '</td><td>' + _esc(r.response || '') + '</td><td>' + _esc(r.notes || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No RANO assessments</p>'; }
    html += '</div></div>';

    // Tab 4: Pathology
    html += '<div class="detail-tab-panel" data-idx="4">';
    html += '<div class="detail-section"><h4><i class="fas fa-microscope"></i> Pathology</h4><div class="detail-grid">';
    html += _detailField('Diagnosis', p.diagnosis) + _detailField('WHO Grade', p.who_grade) + _detailField('Pathology ID', p.pathology_id) + _detailField('Ki-67', p.ki67_percent ? p.ki67_percent + '%' : null);
    html += '</div></div>';
    html += '<div class="detail-section"><h4><i class="fas fa-dna"></i> Molecular Markers</h4><div class="detail-grid">';
    var markers = [
        ['IDH', p.idh_status], ['MGMT', p.mgmt_status], ['1p/19q', p.codel_1p19q],
        ['TERT', p.tert_promoter], ['EGFR', p.egfr_amplification], ['TP53', p.tp53_mutation],
        ['ATRX', p.atrx_status], ['CDKN2A', p.cdkn2a_deletion]
    ];
    markers.forEach(function (m) {
        html += '<div class="detail-field"><div class="df-label">' + m[0] + '</div><div class="df-value">' + molecularBadge(m[1]) + '</div></div>';
    });
    html += '</div></div></div>';

    // Tab 5: Follow-up
    html += '<div class="detail-tab-panel" data-idx="5">';
    html += '<div class="detail-section"><h4><i class="fas fa-chart-line"></i> Disease Progressions</h4>';
    if (progressions.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Type</th><th>Location</th><th>Treatment Plan</th></tr></thead><tbody>';
        progressions.forEach(function (pr) {
            html += '<tr><td>' + _esc(pr.progression_date || '') + '</td><td>' + _esc(pr.type || '') + '</td><td>' + _esc(pr.location || '') + '</td><td>' + _esc(pr.treatment_plan || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No progression events</p>'; }
    html += '</div>';
    html += '<div class="detail-section"><h4><i class="fas fa-calendar-check"></i> Follow-up Visits</h4>';
    if (followups.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Type</th><th>KPS</th><th>Notes</th></tr></thead><tbody>';
        followups.forEach(function (f) {
            html += '<tr><td>' + _esc(f.visit_date || '') + '</td><td>' + _esc(f.visit_type || '') + '</td><td>' + _esc(String(f.kps_score || '')) + '</td><td>' + _esc(f.notes || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No follow-up visits</p>'; }
    html += '</div></div>';

    container.innerHTML = html;
}

function _detailField(label, value) {
    return '<div class="detail-field"><div class="df-label">' + _esc(label) + '</div><div class="df-value">' + _esc(value != null ? String(value) : 'N/A') + '</div></div>';
}

function switchDetailTab(idx) {
    var tabs = document.querySelectorAll('.detail-tab');
    var panels = document.querySelectorAll('.detail-tab-panel');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
        if (parseInt(tabs[i].getAttribute('data-idx')) === idx) tabs[i].classList.add('active');
    }
    for (var j = 0; j < panels.length; j++) {
        panels[j].classList.remove('active');
        if (parseInt(panels[j].getAttribute('data-idx')) === idx) panels[j].classList.add('active');
    }
}

/* --- Edit Patient Modal --- */
function showEditPatientModal() {
    if (!btrCurrentPatient) return;
    var p = btrCurrentPatient;
    var body = '<div class="form-row">' +
        '<div class="form-group"><label>Vital Status</label><select id="editVitalStatus"><option value="Alive"' + (p.vital_status === 'Alive' ? ' selected' : '') + '>Alive</option><option value="Deceased"' + (p.vital_status === 'Deceased' ? ' selected' : '') + '>Deceased</option></select></div>' +
        '<div class="form-group"><label>OS (months)</label><input type="number" id="editOS" value="' + _esc(String(p.os_months || '')) + '"></div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>PFS (months)</label><input type="number" id="editPFS" value="' + _esc(String(p.pfs_months || '')) + '"></div>' +
        '<div class="form-group"><label>Last Follow-up Date</label><input type="date" id="editLastFU" value="' + _esc(p.last_followup_date || '') + '"></div>' +
        '</div>' +
        '<div class="form-group"><label>Date of Death</label><input type="date" id="editDOD" value="' + _esc(p.date_of_death || '') + '"></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="saveEditPatient()"><i class="fas fa-save"></i> Save</button></div>';
    openBtrModal('Edit Patient - ' + p.study_id, body);
}

async function saveEditPatient() {
    if (!btrCurrentPatient) return;
    var updates = {
        vital_status: document.getElementById('editVitalStatus').value,
        os_months: document.getElementById('editOS').value ? parseFloat(document.getElementById('editOS').value) : null,
        pfs_months: document.getElementById('editPFS').value ? parseFloat(document.getElementById('editPFS').value) : null,
        last_followup_date: document.getElementById('editLastFU').value || null,
        date_of_death: document.getElementById('editDOD').value || null
    };
    var { error } = await _sb.from('btr_patients').update(updates).eq('id', btrCurrentPatient.id);
    if (error) { btrToast('Error: ' + error.message, 'error'); return; }
    btrToast('Patient updated', 'success');
    closeBtrModal();
    await fetchAllPatients();
    viewPatientDetail(btrCurrentPatient.study_id);
}

/* --- Quick Add Progression --- */
function quickAddProgression(studyId) {
    var body = '<div class="form-group"><label>Progression Date</label><input type="date" id="progDate"></div>' +
        '<div class="form-group"><label>Type</label><select id="progType"><option value="">Select</option><option value="Local">Local</option><option value="Distant">Distant</option><option value="Leptomeningeal">Leptomeningeal</option><option value="Pseudoprogression">Pseudoprogression</option></select></div>' +
        '<div class="form-group"><label>Location</label><input type="text" id="progLocation" placeholder="e.g. Right frontal"></div>' +
        '<div class="form-group"><label>Treatment Plan</label><textarea id="progPlan" rows="2" placeholder="Next steps..."></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="saveProgression(\'' + _esc(studyId) + '\')"><i class="fas fa-save"></i> Save</button></div>';
    openBtrModal('Add Progression - ' + studyId, body);
}

async function saveProgression(studyId) {
    var { data: pt } = await _sb.from('btr_patients').select('id').eq('study_id', studyId).single();
    if (!pt) { btrToast('Patient not found', 'error'); return; }
    var rec = {
        patient_id: pt.id,
        progression_date: document.getElementById('progDate').value || null,
        type: document.getElementById('progType').value || null,
        location: document.getElementById('progLocation').value.trim() || null,
        treatment_plan: document.getElementById('progPlan').value.trim() || null
    };
    var { error } = await _sb.from('btr_progressions').insert([rec]);
    if (error) { btrToast('Error: ' + error.message, 'error'); return; }
    btrToast('Progression added', 'success');
    closeBtrModal();
    if (btrCurrentPatient && btrCurrentPatient.study_id === studyId) viewPatientDetail(studyId);
}

/* ================================================
   9. CLINICAL TRIALS
   ================================================ */
async function renderTrials() {
    var container = document.getElementById('trialsContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:#00d4ff"></i></div>';

    var { data: trials, error } = await _sb.from('btr_clinical_trials').select('*').order('created_at', { ascending: false });
    if (error) { container.innerHTML = '<p style="color:var(--text-muted)">Error loading trials</p>'; return; }
    if (!trials || !trials.length) { container.innerHTML = '<p style="color:var(--text-muted);padding:20px">No clinical trials yet. Click "Add Trial" to create one.</p>'; return; }

    var html = '';
    trials.forEach(function (t) {
        var phaseClass = 'badge-blue';
        var statusClass = t.status === 'Active' ? 'badge-green' : t.status === 'Closed' ? 'badge-red' : 'badge-amber';
        html += '<div class="trial-card">' +
            '<div class="trial-card-header"><h4>' + _esc(t.name || 'Untitled') + '</h4><div>' +
            '<span class="badge ' + phaseClass + '">' + _esc(t.phase || '') + '</span> ' +
            '<span class="badge ' + statusClass + '">' + _esc(t.status || '') + '</span></div></div>' +
            '<div class="trial-meta"><span><i class="fas fa-user-md"></i> ' + _esc(t.principal_investigator || 'N/A') + '</span>' +
            (t.nct_number ? '<span><i class="fas fa-hashtag"></i> ' + _esc(t.nct_number) + '</span>' : '') + '</div>' +
            '<button class="trial-expand" onclick="toggleTrialDetails(this)"><i class="fas fa-chevron-down"></i> Details</button>' +
            '<div class="trial-details"><p style="font-size:0.83rem;color:var(--text-secondary);margin-bottom:8px">' + _esc(t.description || 'No description') + '</p>' +
            (t.inclusion_criteria ? '<p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px"><strong>Inclusion:</strong> ' + _esc(t.inclusion_criteria) + '</p>' : '') +
            (t.exclusion_criteria ? '<p style="font-size:0.78rem;color:var(--text-muted)"><strong>Exclusion:</strong> ' + _esc(t.exclusion_criteria) + '</p>' : '') +
            '<button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="showAddTrialNoteModal(' + t.id + ')"><i class="fas fa-sticky-note"></i> Add Note</button>' +
            '</div></div>';
    });
    container.innerHTML = html;
}

function toggleTrialDetails(btn) {
    var details = btn.nextElementSibling;
    if (details) details.classList.toggle('open');
    var icon = btn.querySelector('i');
    if (icon) icon.className = details.classList.contains('open') ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
}

function showAddTrialModal() {
    var body = '<div class="form-group"><label>Trial Name</label><input type="text" id="trialName"></div>' +
        '<div class="form-row"><div class="form-group"><label>Phase</label><select id="trialPhase"><option value="Phase I">Phase I</option><option value="Phase II">Phase II</option><option value="Phase III">Phase III</option><option value="Phase IV">Phase IV</option></select></div>' +
        '<div class="form-group"><label>Status</label><select id="trialStatus"><option value="Active">Active</option><option value="Enrolling">Enrolling</option><option value="Closed">Closed</option></select></div></div>' +
        '<div class="form-group"><label>Principal Investigator</label><input type="text" id="trialPI"></div>' +
        '<div class="form-row"><div class="form-group"><label>NCT Number</label><input type="text" id="trialNCT" placeholder="NCT########"></div>' +
        '<div class="form-group"><label>IRB Number</label><input type="text" id="trialIRB"></div></div>' +
        '<div class="form-group"><label>Description</label><textarea id="trialDesc" rows="2"></textarea></div>' +
        '<div class="form-group"><label>Inclusion Criteria</label><textarea id="trialIncl" rows="2"></textarea></div>' +
        '<div class="form-group"><label>Exclusion Criteria</label><textarea id="trialExcl" rows="2"></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="saveNewTrial()"><i class="fas fa-save"></i> Save Trial</button></div>';
    openBtrModal('Add Clinical Trial', body);
}

async function saveNewTrial() {
    var rec = {
        name: document.getElementById('trialName').value.trim(),
        phase: document.getElementById('trialPhase').value,
        status: document.getElementById('trialStatus').value,
        principal_investigator: document.getElementById('trialPI').value.trim() || null,
        nct_number: document.getElementById('trialNCT').value.trim() || null,
        irb_number: document.getElementById('trialIRB').value.trim() || null,
        description: document.getElementById('trialDesc').value.trim() || null,
        inclusion_criteria: document.getElementById('trialIncl').value.trim() || null,
        exclusion_criteria: document.getElementById('trialExcl').value.trim() || null
    };
    if (!rec.name) { btrToast('Trial name is required', 'error'); return; }
    var { error } = await _sb.from('btr_clinical_trials').insert([rec]);
    if (error) { btrToast('Error: ' + error.message, 'error'); return; }
    btrToast('Trial created', 'success');
    closeBtrModal();
    renderTrials();
}

function showAddTrialNoteModal(trialId) {
    var body = '<div class="form-group"><label>Patient Study ID (optional)</label><input type="text" id="tnPatient"></div>' +
        '<div class="form-group"><label>Note</label><textarea id="tnNote" rows="3"></textarea></div>' +
        '<div class="form-group"><label>Author</label><input type="text" id="tnAuthor"></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="saveTrialNote(' + trialId + ')"><i class="fas fa-save"></i> Save</button></div>';
    openBtrModal('Add Trial Note', body);
}

async function saveTrialNote(trialId) {
    var rec = {
        trial_id: trialId,
        patient_study_id: document.getElementById('tnPatient').value.trim() || null,
        note: document.getElementById('tnNote').value.trim(),
        author: document.getElementById('tnAuthor').value.trim() || null
    };
    if (!rec.note) { btrToast('Note is required', 'error'); return; }
    var { error } = await _sb.from('btr_trial_notes').insert([rec]);
    if (error) { btrToast('Error: ' + error.message, 'error'); return; }
    btrToast('Note added', 'success');
    closeBtrModal();
}

/* ================================================
   10. DATA QUALITY
   ================================================ */
async function renderDataQuality() {
    var pts = btrPatients.length ? btrPatients : await fetchAllPatients();
    var total = pts.length;
    if (!total) { document.getElementById('qualityStatCards').innerHTML = '<p style="color:var(--text-muted)">No patient data</p>'; return; }

    var categories = {
        'Demographics': ['age_at_diagnosis', 'sex', 'race', 'ethnicity'],
        'Diagnosis': ['diagnosis', 'who_grade', 'pathology_id'],
        'Molecular': ['idh_status', 'mgmt_status', 'codel_1p19q', 'tert_promoter', 'egfr_amplification', 'tp53_mutation'],
        'Surgery': ['surgery_date', 'surgery_type', 'extent_of_resection', 'surgeon'],
        'Treatment': ['radiation_received', 'chemotherapy_received'],
        'Outcomes': ['vital_status', 'os_months', 'last_followup_date']
    };

    var catScores = {};
    var fieldScores = {};
    Object.keys(categories).forEach(function (cat) {
        var fields = categories[cat];
        var catTotal = 0;
        fields.forEach(function (f) {
            var filled = pts.filter(function (p) { return p[f] != null && p[f] !== ''; }).length;
            var pct = Math.round((filled / total) * 100);
            fieldScores[f] = pct;
            catTotal += pct;
        });
        catScores[cat] = Math.round(catTotal / fields.length);
    });

    var allFieldPcts = Object.values(fieldScores);
    var avgComplete = Math.round(allFieldPcts.reduce(function (s, v) { return s + v; }, 0) / allFieldPcts.length);
    var excellent = Object.values(catScores).filter(function (v) { return v >= 80; }).length;
    var poor = Object.values(catScores).filter(function (v) { return v < 50; }).length;

    document.getElementById('qualityStatCards').innerHTML =
        _statCard('fa-database', total, 'Total Patients', 'accent-cyan') +
        _statCard('fa-clipboard-check', avgComplete + '%', 'Avg Completeness', 'accent-green') +
        _statCard('fa-star', excellent, 'Excellent Categories', 'accent-purple') +
        _statCard('fa-exclamation-triangle', poor, 'Poor Categories', 'accent-red');

    // Category bars
    var barsHtml = '';
    Object.keys(catScores).forEach(function (cat) {
        var pct = catScores[cat];
        var cls = pct >= 80 ? 'excellent' : pct >= 60 ? 'good' : pct >= 40 ? 'fair' : 'poor';
        barsHtml += '<div class="quality-bar-row"><div class="quality-bar-label"><span>' + _esc(cat) + '</span><span>' + pct + '%</span></div>' +
            '<div class="quality-bar-track"><div class="quality-bar-fill ' + cls + '" style="width:' + pct + '%"></div></div></div>';
    });
    document.getElementById('qualityBars').innerHTML = barsHtml;

    // Pie chart of completeness distribution
    var dist = { 'Excellent (80%+)': 0, 'Good (60-79%)': 0, 'Fair (40-59%)': 0, 'Poor (<40%)': 0 };
    pts.forEach(function (p) {
        var allFields = [];
        Object.values(categories).forEach(function (fields) { allFields = allFields.concat(fields); });
        var filled = allFields.filter(function (f) { return p[f] != null && p[f] !== ''; }).length;
        var pct = Math.round((filled / allFields.length) * 100);
        if (pct >= 80) dist['Excellent (80%+)']++;
        else if (pct >= 60) dist['Good (60-79%)']++;
        else if (pct >= 40) dist['Fair (40-59%)']++;
        else dist['Poor (<40%)']++;
    });
    var pieData = Object.keys(dist).map(function (k) { return { label: k, value: dist[k] }; });
    d3DonutChart('qualityPie', pieData, { colors: ['#10b981', '#00d4ff', '#f59e0b', '#ef4444'] });

    // Critical fields table
    var critFields = Object.keys(fieldScores).filter(function (f) { return fieldScores[f] < 50; });
    var critHtml = '';
    if (critFields.length) {
        critHtml = '<table class="btr-table"><thead><tr><th>Field</th><th>Coverage</th><th>Status</th></tr></thead><tbody>';
        critFields.sort(function (a, b) { return fieldScores[a] - fieldScores[b]; });
        critFields.forEach(function (f) {
            critHtml += '<tr><td>' + _esc(f) + '</td><td>' + fieldScores[f] + '%</td><td><span class="badge badge-red">Critical</span></td></tr>';
        });
        critHtml += '</tbody></table>';
    } else {
        critHtml = '<p style="color:var(--accent-tertiary);font-size:0.85rem"><i class="fas fa-check-circle"></i> All fields above 50% coverage</p>';
    }
    document.getElementById('criticalFieldsTable').innerHTML = critHtml;
}

/* ================================================
   11. BIOBANK
   ================================================ */
async function renderBiobank() {
    var { data, error } = await _sb.from('btr_biobank_specimens').select('*').order('collection_date', { ascending: false });
    btrBiobankData = data || [];
    var specimens = btrBiobankData;
    var total = specimens.length;
    var available = specimens.filter(function (s) { return s.status === 'Available'; }).length;
    var dna = specimens.filter(function (s) { return s.dna_extracted === true; }).length;
    var rna = specimens.filter(function (s) { return s.rna_extracted === true; }).length;

    document.getElementById('biobankStats').innerHTML =
        _statCard('fa-vials', total, 'Total Specimens', 'accent-cyan') +
        _statCard('fa-check-circle', available, 'Available', 'accent-green') +
        _statCard('fa-dna', dna, 'DNA Extracted', 'accent-purple') +
        _statCard('fa-flask', rna, 'RNA Extracted', 'accent-amber');

    // Tissue type pie
    var tissueTypes = {};
    specimens.forEach(function (s) {
        var t = s.tissue_type || 'Unknown';
        tissueTypes[t] = (tissueTypes[t] || 0) + 1;
    });
    var pieData = Object.keys(tissueTypes).map(function (k) { return { label: k, value: tissueTypes[k] }; });
    d3DonutChart('tissueTypePie', pieData);

    renderBiobankTable(specimens);
}

function renderBiobankTable(specimens) {
    var tbody = document.getElementById('biobankTbody');
    if (!tbody) return;
    if (!specimens.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">No specimens</td></tr>'; return; }
    var html = '';
    specimens.forEach(function (s) {
        var statusCls = s.status === 'Available' ? 'badge-green' : s.status === 'Used' ? 'badge-amber' : 'badge-gray';
        html += '<tr><td style="color:var(--accent-primary);font-weight:600">' + _esc(s.specimen_id || '') + '</td>' +
            '<td>' + _esc(s.patient_study_id || '') + '</td>' +
            '<td>' + _esc(s.specimen_type || '') + '</td>' +
            '<td>' + _esc(s.tissue_type || '') + '</td>' +
            '<td>' + _esc(s.collection_date || '') + '</td>' +
            '<td>' + _esc(s.storage_location || '') + '</td>' +
            '<td><span class="badge ' + statusCls + '">' + _esc(s.status || 'Unknown') + '</span></td></tr>';
    });
    tbody.innerHTML = html;
}

function filterBiobankTable() {
    var q = (document.getElementById('biobankSearch').value || '').toLowerCase();
    var filtered = btrBiobankData.filter(function (s) {
        return (s.specimen_id || '').toLowerCase().indexOf(q) !== -1 ||
            (s.patient_study_id || '').toLowerCase().indexOf(q) !== -1 ||
            (s.tissue_type || '').toLowerCase().indexOf(q) !== -1;
    });
    renderBiobankTable(filtered);
}

function showAddSpecimenModal() {
    var body = '<div class="form-group"><label>Specimen ID</label><input type="text" id="specId" placeholder="SP-XXX"></div>' +
        '<div class="form-group"><label>Patient Study ID</label><input type="text" id="specPatient" placeholder="BTR-XXXX"></div>' +
        '<div class="form-row"><div class="form-group"><label>Collection Date</label><input type="date" id="specDate"></div>' +
        '<div class="form-group"><label>Specimen Type</label><select id="specType"><option value="Tissue">Tissue</option><option value="Blood">Blood</option><option value="CSF">CSF</option><option value="Other">Other</option></select></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Tissue Type</label><select id="specTissue"><option value="Tumor">Tumor</option><option value="Normal Brain">Normal Brain</option><option value="Peripheral Blood">Peripheral Blood</option><option value="CSF">CSF</option><option value="Other">Other</option></select></div>' +
        '<div class="form-group"><label>Storage Location</label><input type="text" id="specStorage" placeholder="Freezer/rack"></div></div>' +
        '<div class="form-group"><label>IRB Protocol</label><input type="text" id="specIRB"></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="saveSpecimen()"><i class="fas fa-save"></i> Save</button></div>';
    openBtrModal('Add Specimen', body);
}

async function saveSpecimen() {
    var rec = {
        specimen_id: document.getElementById('specId').value.trim(),
        patient_study_id: document.getElementById('specPatient').value.trim() || null,
        collection_date: document.getElementById('specDate').value || null,
        specimen_type: document.getElementById('specType').value,
        tissue_type: document.getElementById('specTissue').value,
        storage_location: document.getElementById('specStorage').value.trim() || null,
        irb_protocol: document.getElementById('specIRB').value.trim() || null,
        status: 'Available'
    };
    if (!rec.specimen_id) { btrToast('Specimen ID required', 'error'); return; }
    var { error } = await _sb.from('btr_biobank_specimens').insert([rec]);
    if (error) { btrToast('Error: ' + error.message, 'error'); return; }
    btrToast('Specimen added', 'success');
    closeBtrModal();
    renderBiobank();
}

/* ================================================
   12. TUMOR BOARD
   ================================================ */
async function renderTumorBoard() {
    var container = document.getElementById('tumorBoardList');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:#00d4ff"></i></div>';

    var { data: meetings } = await _sb.from('btr_tumor_board_meetings').select('*').order('meeting_date', { ascending: false });
    if (!meetings || !meetings.length) { container.innerHTML = '<p style="color:var(--text-muted);padding:20px">No tumor board meetings. Click "Add Meeting" to create one.</p>'; return; }

    var { data: cases } = await _sb.from('btr_tumor_board_cases').select('*');
    var casesByMeeting = {};
    (cases || []).forEach(function (c) {
        if (!casesByMeeting[c.meeting_id]) casesByMeeting[c.meeting_id] = [];
        casesByMeeting[c.meeting_id].push(c);
    });

    var html = '';
    meetings.forEach(function (m) {
        var mc = casesByMeeting[m.id] || [];
        html += '<div class="meeting-card">' +
            '<div class="trial-card-header"><h4>' + _esc(m.meeting_date || 'No date') + '</h4><span class="badge badge-cyan">' + mc.length + ' cases</span></div>' +
            (m.notes ? '<p style="font-size:0.82rem;color:var(--text-secondary);margin:6px 0">' + _esc(m.notes) + '</p>' : '') +
            '<button class="trial-expand" onclick="toggleTrialDetails(this)"><i class="fas fa-chevron-down"></i> Cases</button>' +
            '<div class="trial-details">';
        if (mc.length) {
            mc.forEach(function (c) {
                html += '<div style="padding:8px 0;border-bottom:1px solid var(--border-color)">' +
                    '<strong style="color:var(--accent-primary)">' + _esc(c.patient_study_id || '') + '</strong> - ' + _esc(c.presentation_type || '') +
                    (c.clinical_question ? '<p style="font-size:0.78rem;color:var(--text-secondary);margin-top:2px">' + _esc(c.clinical_question) + '</p>' : '') +
                    (c.recommendation ? '<p style="font-size:0.78rem;color:var(--accent-tertiary);margin-top:2px"><i class="fas fa-check"></i> ' + _esc(c.recommendation) + '</p>' : '') +
                    '</div>';
            });
        } else { html += '<p style="color:var(--text-muted);font-size:0.82rem">No cases discussed</p>'; }
        html += '<button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="showAddCaseModal(' + m.id + ')"><i class="fas fa-plus"></i> Add Case</button>';
        html += '</div></div>';
    });
    container.innerHTML = html;
}

function showAddMeetingModal() {
    var body = '<div class="form-group"><label>Meeting Date</label><input type="date" id="mtgDate"></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="mtgNotes" rows="2"></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="saveMeeting()"><i class="fas fa-save"></i> Save</button></div>';
    openBtrModal('Add Tumor Board Meeting', body);
}

async function saveMeeting() {
    var rec = {
        meeting_date: document.getElementById('mtgDate').value || null,
        notes: document.getElementById('mtgNotes').value.trim() || null
    };
    var { error } = await _sb.from('btr_tumor_board_meetings').insert([rec]);
    if (error) { btrToast('Error: ' + error.message, 'error'); return; }
    btrToast('Meeting created', 'success');
    closeBtrModal();
    renderTumorBoard();
}

function showAddCaseModal(meetingId) {
    var body = '<div class="form-group"><label>Patient Study ID</label><input type="text" id="casePatient" placeholder="BTR-XXXX"></div>' +
        '<div class="form-group"><label>Presentation Type</label><select id="caseType"><option value="New Diagnosis">New Diagnosis</option><option value="Recurrence">Recurrence</option><option value="Treatment Planning">Treatment Planning</option><option value="Follow-up">Follow-up</option></select></div>' +
        '<div class="form-group"><label>Clinical Question</label><textarea id="caseQuestion" rows="2"></textarea></div>' +
        '<div class="form-group"><label>Recommendation</label><textarea id="caseRec" rows="2"></textarea></div>' +
        '<div class="checkbox-grid">' +
        '<label class="cb-label"><input type="checkbox" id="caseNeuroRad"> Neuro-radiology reviewed</label>' +
        '<label class="cb-label"><input type="checkbox" id="casePathRev"> Pathology reviewed</label>' +
        '<label class="cb-label"><input type="checkbox" id="caseMolRev"> Molecular reviewed</label>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="saveCase(' + meetingId + ')"><i class="fas fa-save"></i> Save</button></div>';
    openBtrModal('Add Case', body);
}

async function saveCase(meetingId) {
    var rec = {
        meeting_id: meetingId,
        patient_study_id: document.getElementById('casePatient').value.trim() || null,
        presentation_type: document.getElementById('caseType').value,
        clinical_question: document.getElementById('caseQuestion').value.trim() || null,
        recommendation: document.getElementById('caseRec').value.trim() || null,
        neuroradiology_reviewed: document.getElementById('caseNeuroRad').checked,
        pathology_reviewed: document.getElementById('casePathRev').checked,
        molecular_reviewed: document.getElementById('caseMolRev').checked
    };
    var { error } = await _sb.from('btr_tumor_board_cases').insert([rec]);
    if (error) { btrToast('Error: ' + error.message, 'error'); return; }
    btrToast('Case added', 'success');
    closeBtrModal();
    renderTumorBoard();
}

/* ================================================
   13. FOLLOW-UP ALERTS
   ================================================ */
var btrFollowupTab = 'overdue';

async function renderFollowUp() {
    var pts = btrPatients.length ? btrPatients : await fetchAllPatients();
    var today = new Date();
    var container = document.getElementById('followupContent');
    if (!container) return;

    var overdue = [];
    var upcoming = [];
    var lost = [];

    pts.forEach(function (p) {
        if (p.vital_status === 'Deceased') return;
        var lastFU = p.last_followup_date ? new Date(p.last_followup_date) : null;
        if (!lastFU) { lost.push({ patient: p, days: null }); return; }

        var daysSince = Math.floor((today - lastFU) / (1000 * 60 * 60 * 24));
        var nextMRI = new Date(lastFU);
        nextMRI.setMonth(nextMRI.getMonth() + 3); // assume 3-month MRI interval
        var daysUntil = Math.floor((nextMRI - today) / (1000 * 60 * 60 * 24));

        if (daysSince > 365) {
            lost.push({ patient: p, days: daysSince });
        } else if (daysUntil < 0) {
            overdue.push({ patient: p, days: Math.abs(daysUntil) });
        } else if (daysUntil <= 30) {
            upcoming.push({ patient: p, days: daysUntil });
        }
    });

    var items = btrFollowupTab === 'overdue' ? overdue : btrFollowupTab === 'upcoming' ? upcoming : lost;
    items.sort(function (a, b) {
        if (a.days == null) return 1;
        if (b.days == null) return -1;
        return btrFollowupTab === 'upcoming' ? a.days - b.days : b.days - a.days;
    });

    if (!items.length) {
        container.innerHTML = '<p style="color:var(--text-muted);padding:20px">No patients in this category</p>';
        return;
    }

    var html = '';
    items.forEach(function (item) {
        var p = item.patient;
        var cardClass = btrFollowupTab;
        var dayLabel = btrFollowupTab === 'overdue' ? 'days overdue' : btrFollowupTab === 'upcoming' ? 'days until' : 'days since';
        var dayColor = btrFollowupTab === 'overdue' ? 'var(--danger)' : btrFollowupTab === 'upcoming' ? 'var(--accent-primary)' : 'var(--warning)';
        html += '<div class="followup-card ' + cardClass + '" onclick="viewPatientDetail(\'' + _esc(p.study_id) + '\')">' +
            '<div class="followup-card-info"><h4>' + _esc(p.study_id) + '</h4><p>' + _esc(p.diagnosis || 'Unknown') + ' &bull; ' + _esc(p.sex || '') + ', ' + _esc(String(p.age_at_diagnosis || '')) + '</p></div>' +
            '<div class="followup-card-days" style="color:' + dayColor + '">' +
            (item.days != null ? item.days : '?') +
            '<small>' + dayLabel + '</small></div></div>';
    });
    container.innerHTML = html;
}

function switchFollowupTab(tab) {
    btrFollowupTab = tab;
    var tabs = document.querySelectorAll('.followup-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
        if (tabs[i].getAttribute('data-tab') === tab) tabs[i].classList.add('active');
    }
    renderFollowUp();
}

/* ================================================
   14. COHORT BUILDER
   ================================================ */
async function renderCohorts() {
    var { data: cohorts } = await _sb.from('btr_research_cohorts').select('*').order('created_at', { ascending: false });
    var list = document.getElementById('savedCohortsList');
    if (!list) return;
    if (!cohorts || !cohorts.length) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No saved cohorts yet</p>';
        return;
    }
    var html = '';
    cohorts.forEach(function (c) {
        var count = (c.patient_ids && c.patient_ids.length) ? c.patient_ids.length : 0;
        html += '<div class="cohort-item" onclick="loadCohort(' + c.id + ')">' +
            '<h4>' + _esc(c.name || 'Untitled') + '</h4>' +
            '<p>' + _esc(c.description || '') + '</p>' +
            '<div class="cohort-count">' + count + ' patients</div></div>';
    });
    list.innerHTML = html;
}

async function previewCohort() {
    var pts = btrPatients.length ? btrPatients : await fetchAllPatients();
    var dx = document.getElementById('cohDiagnosis').value.trim().toLowerCase();
    var idh = document.getElementById('cohIDH').value;
    var mgmt = document.getElementById('cohMGMT').value;
    var vital = document.getElementById('cohVital').value;
    var ageMin = document.getElementById('cohAgeMin').value;
    var ageMax = document.getElementById('cohAgeMax').value;
    var grade = document.getElementById('cohGrade').value;

    var filtered = pts.filter(function (p) {
        if (dx && (!p.diagnosis || p.diagnosis.toLowerCase().indexOf(dx) === -1)) return false;
        if (idh && p.idh_status !== idh) return false;
        if (mgmt && p.mgmt_status !== mgmt) return false;
        if (vital && p.vital_status !== vital) return false;
        if (ageMin && (p.age_at_diagnosis == null || p.age_at_diagnosis < parseInt(ageMin))) return false;
        if (ageMax && (p.age_at_diagnosis == null || p.age_at_diagnosis > parseInt(ageMax))) return false;
        if (grade && p.who_grade !== grade) return false;
        return true;
    });

    btrCohortPreview = filtered;
    var preview = document.getElementById('cohortPreview');
    if (preview) preview.style.display = '';
    document.getElementById('cohortPreviewCount').textContent = '(' + filtered.length + ' patients)';

    var tbody = document.getElementById('cohortPreviewTbody');
    var html = '';
    filtered.slice(0, 50).forEach(function (p) {
        html += '<tr><td style="color:var(--accent-primary)">' + _esc(p.study_id) + '</td><td>' + _esc(String(p.age_at_diagnosis || '')) + '</td><td>' + _esc(p.diagnosis || '') + '</td><td>' + gradeBadge(p.who_grade) + '</td><td>' + statusBadge(p.vital_status) + '</td></tr>';
    });
    if (!html) html = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No matches</td></tr>';
    tbody.innerHTML = html;
}

async function saveCohort() {
    if (!btrCohortPreview.length) { btrToast('Preview a cohort first', 'info'); return; }
    var name = prompt('Cohort name:');
    if (!name) return;
    var desc = prompt('Description (optional):') || '';
    var filters = {
        diagnosis: document.getElementById('cohDiagnosis').value.trim(),
        idh_status: document.getElementById('cohIDH').value,
        mgmt_status: document.getElementById('cohMGMT').value,
        vital_status: document.getElementById('cohVital').value,
        age_min: document.getElementById('cohAgeMin').value,
        age_max: document.getElementById('cohAgeMax').value,
        who_grade: document.getElementById('cohGrade').value
    };
    var patientIds = btrCohortPreview.map(function (p) { return p.study_id; });
    var rec = { name: name, description: desc, filters: filters, patient_ids: patientIds };
    var { error } = await _sb.from('btr_research_cohorts').insert([rec]);
    if (error) { btrToast('Error: ' + error.message, 'error'); return; }
    btrToast('Cohort saved', 'success');
    renderCohorts();
}

async function loadCohort(cohortId) {
    var { data: cohort } = await _sb.from('btr_research_cohorts').select('*').eq('id', cohortId).single();
    if (!cohort) return;
    btrCohortPreview = btrPatients.filter(function (p) { return cohort.patient_ids && cohort.patient_ids.indexOf(p.study_id) !== -1; });
    document.getElementById('cohortPreview').style.display = '';
    document.getElementById('cohortPreviewCount').textContent = '(' + btrCohortPreview.length + ' patients)';
    var tbody = document.getElementById('cohortPreviewTbody');
    var html = '';
    btrCohortPreview.slice(0, 50).forEach(function (p) {
        html += '<tr><td style="color:var(--accent-primary)">' + _esc(p.study_id) + '</td><td>' + _esc(String(p.age_at_diagnosis || '')) + '</td><td>' + _esc(p.diagnosis || '') + '</td><td>' + gradeBadge(p.who_grade) + '</td><td>' + statusBadge(p.vital_status) + '</td></tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No patients found</td></tr>';
}

function exportCohortCSV() {
    if (!btrCohortPreview.length) { btrToast('No cohort data', 'info'); return; }
    var fields = ['study_id', 'age_at_diagnosis', 'sex', 'diagnosis', 'who_grade', 'idh_status', 'mgmt_status', 'vital_status', 'os_months'];
    var csv = Papa.unparse(btrCohortPreview.map(function (p) {
        var row = {};
        fields.forEach(function (f) { row[f] = p[f] || ''; });
        return row;
    }));
    downloadCSV(csv, 'btr_cohort.csv');
}

function exportCohortJSON() {
    if (!btrCohortPreview.length) { btrToast('No cohort data', 'info'); return; }
    var fields = ['study_id', 'age_at_diagnosis', 'sex', 'diagnosis', 'who_grade', 'idh_status', 'mgmt_status', 'vital_status', 'os_months'];
    var data = btrCohortPreview.map(function (p) {
        var row = {};
        fields.forEach(function (f) { row[f] = p[f]; });
        return row;
    });
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'btr_cohort.json';
    link.click();
}

/* ================================================
   15. PUBLICATIONS
   ================================================ */
var btrPubsData = [];

async function renderPublications() {
    var { data: pubs } = await _sb.from('btr_publications').select('*').order('publication_date', { ascending: false });
    btrPubsData = pubs || [];
    var total = btrPubsData.length;
    var types = {};
    var thisYear = new Date().getFullYear();
    var thisYearCount = 0;
    btrPubsData.forEach(function (p) {
        var t = p.type || 'Other';
        types[t] = (types[t] || 0) + 1;
        if (p.publication_date && new Date(p.publication_date).getFullYear() === thisYear) thisYearCount++;
    });
    var typeStr = Object.keys(types).map(function (t) { return t + ': ' + types[t]; }).join(', ') || 'None';

    document.getElementById('pubStats').innerHTML =
        _statCard('fa-book-medical', total, 'Total Publications', 'accent-cyan') +
        _statCard('fa-tags', Object.keys(types).length, 'Types', 'accent-purple') +
        _statCard('fa-calendar', thisYearCount, 'This Year', 'accent-green');

    renderPubList(btrPubsData);
}

function renderPubList(pubs) {
    var container = document.getElementById('pubList');
    if (!container) return;
    if (!pubs.length) { container.innerHTML = '<p style="color:var(--text-muted);padding:20px">No publications yet</p>'; return; }
    var html = '';
    pubs.forEach(function (p) {
        html += '<div class="pub-item"><div class="pub-info"><h4>' + _esc(p.title || 'Untitled') + '</h4>' +
            '<div class="pub-authors">' + _esc(p.authors || '') + '</div>' +
            '<div class="pub-journal">' + _esc(p.journal || '') + (p.publication_date ? ' (' + _esc(p.publication_date.substring(0, 4)) + ')' : '') + ' <span class="badge badge-gray">' + _esc(p.type || '') + '</span></div></div>' +
            '<div class="pub-links">' +
            (p.pmid ? '<a href="https://pubmed.ncbi.nlm.nih.gov/' + _esc(p.pmid) + '/" target="_blank" rel="noopener">PubMed</a>' : '') +
            (p.doi ? '<a href="https://doi.org/' + _esc(p.doi) + '" target="_blank" rel="noopener">DOI</a>' : '') +
            '</div></div>';
    });
    container.innerHTML = html;
}

function filterPubTable() {
    var q = (document.getElementById('pubSearch').value || '').toLowerCase();
    var filtered = btrPubsData.filter(function (p) {
        return (p.title || '').toLowerCase().indexOf(q) !== -1 ||
            (p.authors || '').toLowerCase().indexOf(q) !== -1 ||
            (p.journal || '').toLowerCase().indexOf(q) !== -1;
    });
    renderPubList(filtered);
}

function showAddPubModal() {
    var body = '<div class="form-group"><label>Title</label><input type="text" id="pubTitle"></div>' +
        '<div class="form-group"><label>Authors</label><input type="text" id="pubAuthors" placeholder="Last FM, Last FM, ..."></div>' +
        '<div class="form-row"><div class="form-group"><label>Journal</label><input type="text" id="pubJournal"></div>' +
        '<div class="form-group"><label>Type</label><select id="pubType"><option value="Original Research">Original Research</option><option value="Review">Review</option><option value="Case Report">Case Report</option><option value="Letter">Letter</option><option value="Abstract">Abstract</option><option value="Other">Other</option></select></div></div>' +
        '<div class="form-row"><div class="form-group"><label>PMID</label><input type="text" id="pubPMID"></div>' +
        '<div class="form-group"><label>DOI</label><input type="text" id="pubDOI"></div></div>' +
        '<div class="form-group"><label>Publication Date</label><input type="date" id="pubDate"></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="savePub()"><i class="fas fa-save"></i> Save</button></div>';
    openBtrModal('Add Publication', body);
}

async function savePub() {
    var rec = {
        title: document.getElementById('pubTitle').value.trim(),
        authors: document.getElementById('pubAuthors').value.trim() || null,
        journal: document.getElementById('pubJournal').value.trim() || null,
        type: document.getElementById('pubType').value,
        pmid: document.getElementById('pubPMID').value.trim() || null,
        doi: document.getElementById('pubDOI').value.trim() || null,
        publication_date: document.getElementById('pubDate').value || null
    };
    if (!rec.title) { btrToast('Title is required', 'error'); return; }
    var { error } = await _sb.from('btr_publications').insert([rec]);
    if (error) { btrToast('Error: ' + error.message, 'error'); return; }
    btrToast('Publication added', 'success');
    closeBtrModal();
    renderPublications();
}

/* ================================================
   16. GENOMICS
   ================================================ */
async function renderGenomics() {
    var pts = btrPatients.length ? btrPatients : await fetchAllPatients();
    renderGenomicsOverview(pts);
    renderCooccurrenceMatrix(pts);
    renderMutByDiagnosis(pts);
}

function renderGenomicsOverview(pts) {
    var markers = [
        { key: 'idh_status', label: 'IDH', values: ['Mutant', 'Wildtype'] },
        { key: 'mgmt_status', label: 'MGMT', values: ['Methylated', 'Unmethylated'] },
        { key: 'tp53_mutation', label: 'TP53', values: ['Mutant', 'Wildtype'] },
        { key: 'tert_promoter', label: 'TERT', values: ['Mutant', 'Wildtype'] },
        { key: 'egfr_amplification', label: 'EGFR', values: ['Amplified', 'Not Amplified'] },
        { key: 'cdkn2a_deletion', label: 'CDKN2A', values: ['Deleted', 'Not Deleted'] },
        { key: 'atrx_status', label: 'ATRX', values: ['Lost', 'Retained'] },
        { key: 'codel_1p19q', label: '1p/19q', values: ['Codeleted', 'Non-codeleted'] }
    ];
    var data = [];
    markers.forEach(function (m) {
        var posCount = pts.filter(function (p) { return p[m.key] === m.values[0]; }).length;
        data.push({ label: m.label, value: posCount });
    });
    d3BarChart('genomicsOverview', data, { colors: ['#ef4444', '#00d4ff', '#ef4444', '#ef4444', '#ef4444', '#ef4444', '#ef4444', '#7c3aed'], height: 300 });
}

function renderCooccurrenceMatrix(pts) {
    var container = document.getElementById('cooccurrenceMatrix');
    if (!container) return;
    container.innerHTML = '';

    var markerKeys = ['idh_status', 'mgmt_status', 'tp53_mutation', 'tert_promoter', 'egfr_amplification', 'cdkn2a_deletion'];
    var markerLabels = ['IDH', 'MGMT', 'TP53', 'TERT', 'EGFR', 'CDKN2A'];
    var positives = ['Mutant', 'Methylated', 'Mutant', 'Mutant', 'Amplified', 'Deleted'];

    var n = markerKeys.length;
    var matrix = [];
    for (var i = 0; i < n; i++) {
        matrix[i] = [];
        for (var j = 0; j < n; j++) {
            var count = pts.filter(function (p) {
                return p[markerKeys[i]] === positives[i] && p[markerKeys[j]] === positives[j];
            }).length;
            matrix[i][j] = count;
        }
    }

    var cellSize = 50;
    var margin = { top: 80, left: 80 };
    var size = cellSize * n;

    var svg = d3.select('#cooccurrenceMatrix').append('svg')
        .attr('width', size + margin.left + 20)
        .attr('height', size + margin.top + 20)
        .append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var maxVal = d3.max(matrix.flat()) || 1;
    var colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxVal]);

    for (var ri = 0; ri < n; ri++) {
        for (var ci = 0; ci < n; ci++) {
            svg.append('rect')
                .attr('x', ci * cellSize).attr('y', ri * cellSize)
                .attr('width', cellSize - 2).attr('height', cellSize - 2)
                .attr('rx', 4)
                .attr('fill', matrix[ri][ci] > 0 ? colorScale(matrix[ri][ci]) : 'rgba(255,255,255,0.03)');
            svg.append('text')
                .attr('x', ci * cellSize + cellSize / 2 - 1)
                .attr('y', ri * cellSize + cellSize / 2 + 1)
                .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
                .attr('fill', matrix[ri][ci] > maxVal * 0.5 ? '#000' : '#9999b8')
                .attr('font-size', '11px').attr('font-weight', '600')
                .text(matrix[ri][ci]);
        }
    }

    // Labels
    for (var li = 0; li < n; li++) {
        svg.append('text').attr('class', 'cell-label')
            .attr('x', -8).attr('y', li * cellSize + cellSize / 2)
            .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
            .text(markerLabels[li]);
        svg.append('text').attr('class', 'cell-label')
            .attr('x', li * cellSize + cellSize / 2)
            .attr('y', -8)
            .attr('text-anchor', 'middle')
            .text(markerLabels[li]);
    }
}

function renderMutByDiagnosis(pts) {
    var container = document.getElementById('mutByDiagnosis');
    if (!container) return;
    container.innerHTML = '';

    // Group by top diagnoses
    var dxGroups = {};
    pts.forEach(function (p) {
        var dx = p.diagnosis || 'Unknown';
        if (!dxGroups[dx]) dxGroups[dx] = [];
        dxGroups[dx].push(p);
    });
    var topDx = Object.keys(dxGroups).sort(function (a, b) { return dxGroups[b].length - dxGroups[a].length; }).slice(0, 6);

    var markers = [
        { key: 'idh_status', label: 'IDH+', val: 'Mutant' },
        { key: 'mgmt_status', label: 'MGMT+', val: 'Methylated' },
        { key: 'tp53_mutation', label: 'TP53+', val: 'Mutant' }
    ];

    var groupedData = [];
    topDx.forEach(function (dx) {
        var g = dxGroups[dx];
        markers.forEach(function (m) {
            var pct = g.length ? Math.round((g.filter(function (p) { return p[m.key] === m.val; }).length / g.length) * 100) : 0;
            groupedData.push({ dx: dx.length > 20 ? dx.substring(0, 18) + '..' : dx, marker: m.label, value: pct });
        });
    });

    // Grouped bar chart
    var margin = { top: 20, right: 120, bottom: 80, left: 50 };
    var width = container.clientWidth - margin.left - margin.right;
    var height = 300 - margin.top - margin.bottom;
    if (width < 200) width = 400;

    var svg = d3.select('#mutByDiagnosis').append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var x0 = d3.scaleBand().domain(topDx.map(function (d) { return d.length > 20 ? d.substring(0, 18) + '..' : d; })).range([0, width]).paddingInner(0.2);
    var x1 = d3.scaleBand().domain(markers.map(function (m) { return m.label; })).range([0, x0.bandwidth()]).padding(0.05);
    var y = d3.scaleLinear().domain([0, 100]).range([height, 0]);
    var color = d3.scaleOrdinal().domain(markers.map(function (m) { return m.label; })).range(['#ef4444', '#00d4ff', '#f59e0b']);

    svg.append('g').attr('class', 'axis').attr('transform', 'translate(0,' + height + ')').call(d3.axisBottom(x0))
        .selectAll('text').attr('transform', 'rotate(-30)').style('text-anchor', 'end').attr('dx', '-0.5em');
    svg.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5).tickFormat(function (d) { return d + '%'; }));

    var dxGrouped = d3.group(groupedData, function (d) { return d.dx; });
    svg.selectAll('.dx-group').data(dxGrouped).enter().append('g')
        .attr('transform', function (d) { return 'translate(' + x0(d[0]) + ',0)'; })
        .selectAll('rect').data(function (d) { return d[1]; }).enter().append('rect')
        .attr('x', function (d) { return x1(d.marker); })
        .attr('y', function (d) { return y(d.value); })
        .attr('width', x1.bandwidth())
        .attr('height', function (d) { return height - y(d.value); })
        .attr('fill', function (d) { return color(d.marker); })
        .attr('rx', 2)
        .style('opacity', 0.85);

    // Legend
    var legendG = svg.selectAll('.mut-legend').data(markers).enter().append('g')
        .attr('transform', function (d, i) { return 'translate(' + (width + 10) + ',' + (i * 20) + ')'; });
    legendG.append('rect').attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', function (d) { return color(d.label); });
    legendG.append('text').attr('x', 18).attr('y', 10).attr('fill', '#9999b8').attr('font-size', '11px').text(function (d) { return d.label; });
}

/* ================================================
   17. MODAL SYSTEM
   ================================================ */
function openBtrModal(title, bodyHtml) {
    document.getElementById('btrModalTitle').textContent = title;
    document.getElementById('btrModalBody').innerHTML = bodyHtml;
    document.getElementById('btrModalOverlay').classList.add('open');
}

function closeBtrModal() {
    document.getElementById('btrModalOverlay').classList.remove('open');
}

/* ================================================
   18. INITIALIZATION
   ================================================ */
document.addEventListener('DOMContentLoaded', function () {
    // Auth check
    btrCheckAuth().then(function () {
        // Load initial data & dashboard
        fetchAllPatients().then(function () {
            renderDashboard();
        });
    });

    // Sidebar navigation
    var links = document.querySelectorAll('.sidebar-link');
    for (var i = 0; i < links.length; i++) {
        links[i].addEventListener('click', function (e) {
            e.preventDefault();
            var page = this.getAttribute('data-page');
            if (page) btrNavigate(page);
        });
    }

    // Sidebar toggle for mobile
    var toggle = document.getElementById('sidebarToggle');
    if (toggle) {
        toggle.addEventListener('click', function () {
            var sidebar = document.getElementById('btrSidebar');
            if (sidebar) sidebar.classList.toggle('mobile-open');
        });
    }

    // Table sorting
    initTableSorting();

    // Close modal on Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeBtrModal();
    });
});
