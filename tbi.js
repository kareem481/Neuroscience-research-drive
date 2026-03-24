/* ============================================
   TRAUMA / TBI REGISTRY
   Saint Luke's Neuroscience Research Department
   ============================================ */

console.log('%c Trauma/TBI Registry ', 'font-size:16px;font-weight:bold;color:#ef4444;background:#0a0a1a;padding:6px 14px;border-radius:8px;border:1px solid #ef4444;');

/* ================================================
   0. SUPABASE CLIENT & AUTH
   ================================================ */
var SUPABASE_URL = 'https://noxyrovuuprygxuyhgik.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veHlyb3Z1dXByeWd4dXloZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTUyMTgsImV4cCI6MjA4OTg5MTIxOH0.F3n5nOdpuz-1fENtAScf4Ina_v51Yz3htQGnbZhEPf4';
var _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var tbiUser = null;
var tbiPatients = [];
var tbiQueryResults = [];
var tbiCurrentPatient = null;
var tbiSortCol = null;
var tbiSortAsc = true;

/* --- HTML escape --- */
function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* --- Auth check on load --- */
async function tbiCheckAuth() {
    try {
        var resp = await _sb.auth.getSession();
        var session = resp.data.session;
        if (!session || !session.user) {
            window.location.href = 'index.html';
            return;
        }
        tbiUser = session.user;
        var nameEl = document.getElementById('btrUserName');
        if (nameEl) nameEl.textContent = tbiUser.email;
    } catch (e) {
        console.error('TBI auth check failed:', e);
        window.location.href = 'index.html';
    }
}

async function tbiLogout() {
    await _sb.auth.signOut();
    window.location.href = 'index.html';
}

/* ================================================
   1. NAVIGATION & TAB SWITCHING
   ================================================ */
var tbiCurrentPage = 'tbi-dashboard';

function tbiNavigate(pageId) {
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

    tbiCurrentPage = pageId;
    var titleEl = document.getElementById('btrPageTitle');
    var titles = {
        'tbi-dashboard': 'Dashboard',
        'tbi-acute': 'Acute TBI (Severe)',
        'tbi-subdural': 'Subdural Hematoma',
        'tbi-fracture': 'Skull Fracture',
        'tbi-add': 'Add Patient',
        'tbi-detail': 'Patient Detail',
        'tbi-query': 'Query Builder',
        'tbi-icp': 'ICP Monitor',
        'tbi-outcomes': 'Outcomes'
    };
    if (titleEl) titleEl.textContent = titles[pageId] || pageId;

    if (pageId === 'tbi-dashboard') renderTBIDashboard();
    else if (pageId === 'tbi-acute') renderAcuteList();
    else if (pageId === 'tbi-subdural') renderSubduralList();
    else if (pageId === 'tbi-fracture') renderFractureList();
    else if (pageId === 'tbi-icp') renderICPPage();
    else if (pageId === 'tbi-outcomes') renderTBIOutcomes();
}

/* --- Toast helper --- */
function tbiToast(message, type) {
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

/* --- Modal helpers --- */
function openTbiModal(title, bodyHtml) {
    document.getElementById('btrModalTitle').textContent = title;
    document.getElementById('btrModalBody').innerHTML = bodyHtml;
    document.getElementById('btrModalOverlay').classList.add('active');
}

function closeTbiModal() {
    document.getElementById('btrModalOverlay').classList.remove('active');
}

/* ================================================
   2. DATA HELPERS & BADGE FUNCTIONS
   ================================================ */
async function tbiFetchAllPatients() {
    var { data, error } = await _sb.from('tbi_patients').select('*');
    if (error) { console.error('Fetch TBI patients error:', error); return []; }
    tbiPatients = data || [];
    return tbiPatients;
}

function gcsBadge(gcs) {
    if (gcs == null) return '<span class="badge badge-gray">N/A</span>';
    var g = parseInt(gcs);
    if (g >= 3 && g <= 8) return '<span class="badge gcs-severe">' + g + ' Severe</span>';
    if (g >= 9 && g <= 12) return '<span class="badge gcs-moderate">' + g + ' Moderate</span>';
    if (g >= 13 && g <= 15) return '<span class="badge gcs-mild">' + g + ' Mild</span>';
    return '<span class="badge badge-gray">' + g + '</span>';
}

function gcsSeverity(gcs) {
    if (gcs == null) return 'Unknown';
    var g = parseInt(gcs);
    if (g >= 3 && g <= 8) return 'Severe';
    if (g >= 9 && g <= 12) return 'Moderate';
    if (g >= 13 && g <= 15) return 'Mild';
    return 'Unknown';
}

function marshallBadge(marshall) {
    if (!marshall) return '<span class="badge badge-gray">N/A</span>';
    var m = String(marshall);
    var cls = 'badge-gray';
    if (m === 'I' || m === 'II') cls = 'marshall-low';
    else if (m === 'III' || m === 'IV') cls = 'marshall-mid';
    else if (m === 'V' || m === 'VI') cls = 'marshall-high';
    return '<span class="badge ' + cls + '">' + _esc(m) + '</span>';
}

function gosBadge(gos) {
    if (gos == null) return '<span class="badge badge-gray">N/A</span>';
    var g = parseInt(gos);
    var labels = { 1: 'Dead', 2: 'Vegetative', 3: 'Severe Disability', 4: 'Moderate Disability', 5: 'Good Recovery' };
    var cls = 'gos-' + g;
    return '<span class="badge ' + cls + '">' + g + ' - ' + (labels[g] || 'N/A') + '</span>';
}

function goseBadge(gose) {
    if (gose == null) return '<span class="badge badge-gray">N/A</span>';
    var g = parseInt(gose);
    var labels = { 1: 'Dead', 2: 'Vegetative', 3: 'Lower SD', 4: 'Upper SD', 5: 'Lower MD', 6: 'Upper MD', 7: 'Lower GR', 8: 'Upper GR' };
    var cls = 'badge-gray';
    if (g === 1) cls = 'gos-1';
    else if (g === 2) cls = 'gos-2';
    else if (g <= 4) cls = 'gos-3';
    else if (g <= 6) cls = 'gos-4';
    else cls = 'gos-5';
    return '<span class="badge ' + cls + '">' + g + ' - ' + (labels[g] || '') + '</span>';
}

function categoryBadge(cat) {
    if (!cat) return '<span class="badge badge-gray">N/A</span>';
    var classMap = {
        'TBI': 'cat-tbi', 'SDH': 'cat-sdh', 'EDH': 'cat-edh',
        'SAH-Traumatic': 'cat-sah', 'Skull Fracture': 'cat-fracture',
        'Penetrating': 'cat-penetrating', 'Polytrauma': 'cat-polytrauma'
    };
    var cls = classMap[cat] || 'badge-gray';
    return '<span class="badge ' + cls + '">' + _esc(cat) + '</span>';
}

function mechanismIcon(mech) {
    if (!mech) return '';
    var icons = {
        'MVC': 'fa-car', 'Motorcycle': 'fa-motorcycle', 'Pedestrian': 'fa-walking',
        'Fall': 'fa-arrow-down', 'Assault': 'fa-fist-raised', 'Sports': 'fa-football-ball',
        'GSW': 'fa-crosshairs', 'Bicycle': 'fa-bicycle'
    };
    var icon = icons[mech] || 'fa-exclamation-triangle';
    return '<i class="fas ' + icon + ' mechanism-icon"></i>';
}

function pupilIndicator(pupils) {
    if (!pupils) return '<span class="badge badge-gray">N/A</span>';
    if (pupils === 'Equal Reactive') return '<span class="pupil-reactive"></span> <span class="pupil-reactive"></span> <span style="color:#10b981;font-size:0.75rem;margin-left:4px">Reactive</span>';
    if (pupils === 'Unilateral Fixed') return '<span class="pupil-fixed"></span> <span class="pupil-reactive"></span> <span style="color:#ef4444;font-size:0.75rem;margin-left:4px">Unilateral</span>';
    if (pupils === 'Bilateral Fixed') return '<span class="pupil-fixed"></span> <span class="pupil-fixed"></span> <span style="color:#ef4444;font-size:0.75rem;margin-left:4px">Bilateral</span>';
    return '<span style="font-size:0.8rem;color:var(--text-secondary)">' + _esc(pupils) + '</span>';
}

function icpBadge(val) {
    if (val == null) return '<span class="badge badge-gray">N/A</span>';
    var v = parseFloat(val);
    if (v < 20) return '<span class="icp-normal">' + v + '</span>';
    if (v <= 25) return '<span class="icp-warning">' + v + '</span>';
    return '<span class="icp-critical">' + v + '</span>';
}

function _statCard(icon, value, label, accentClass) {
    return '<div class="stat-card ' + accentClass + '">' +
        '<div class="stat-icon"><i class="fas ' + icon + '"></i></div>' +
        '<div class="stat-value">' + _esc(String(value)) + '</div>' +
        '<div class="stat-label">' + _esc(label) + '</div></div>';
}

function _detailField(label, value) {
    return '<div class="detail-field"><div class="df-label">' + _esc(label) + '</div><div class="df-value">' + _esc(value != null ? String(value) : 'N/A') + '</div></div>';
}

function downloadCSV(csv, filename) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

/* ================================================
   3. D3 CHART HELPERS
   ================================================ */
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

    var color = opts.color || '#ef4444';
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
        .on('mouseover', function () { d3.select(this).style('opacity', 1); })
        .on('mouseout', function () { d3.select(this).style('opacity', 0.85); });

    svg.selectAll('.bar-label').data(data).enter().append('text')
        .attr('x', function (d) { return x(d.label) + x.bandwidth() / 2; })
        .attr('y', function (d) { return y(d.value) - 4; })
        .attr('text-anchor', 'middle')
        .attr('fill', '#9999b8')
        .attr('font-size', '10px')
        .text(function (d) { return d.value; });
}

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
        .range(opts.colors || ['#ef4444', '#7c3aed', '#06b6d4', '#f97316', '#6366f1', '#10b981', '#ec4899', '#3b82f6']);

    var pie = d3.pie().value(function (d) { return d.value; }).sort(null);
    var arc = d3.arc().innerRadius(opts.donut !== false ? radius * 0.55 : 0).outerRadius(radius);
    var arcHover = d3.arc().innerRadius(opts.donut !== false ? radius * 0.52 : 0).outerRadius(radius + 6);

    svg.selectAll('path').data(pie(data)).enter().append('path')
        .attr('d', arc)
        .attr('fill', function (d) { return colorScale(d.data.label); })
        .style('opacity', 0.85)
        .on('mouseover', function () { d3.select(this).transition().duration(150).attr('d', arcHover).style('opacity', 1); })
        .on('mouseout', function () { d3.select(this).transition().duration(150).attr('d', arc).style('opacity', 0.85); });

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

function d3LineChart(containerId, data, options) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    var opts = options || {};
    var margin = { top: 20, right: 30, bottom: 50, left: 55 };
    var width = container.clientWidth - margin.left - margin.right;
    var height = (opts.height || 320) - margin.top - margin.bottom;
    if (width < 100) width = 400;

    var svg = d3.select('#' + containerId).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var x = d3.scaleTime()
        .domain(d3.extent(data, function (d) { return d.time; }))
        .range([0, width]);

    var yMax = d3.max(data, function (d) { return d.value; }) || 40;
    if (opts.yMax) yMax = Math.max(yMax, opts.yMax);
    var y = d3.scaleLinear().domain([0, yMax * 1.1]).range([height, 0]);

    svg.append('g').attr('class', 'axis').attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat('%m/%d %H:%M')))
        .selectAll('text').attr('transform', 'rotate(-25)').style('text-anchor', 'end');
    svg.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6));

    // ICP zones
    if (opts.zones) {
        // Green zone: 0-20
        svg.append('rect').attr('x', 0).attr('y', y(20)).attr('width', width).attr('height', y(0) - y(20))
            .attr('class', 'icp-chart-zone-green');
        // Yellow zone: 20-25
        svg.append('rect').attr('x', 0).attr('y', y(25)).attr('width', width).attr('height', y(20) - y(25))
            .attr('class', 'icp-chart-zone-yellow');
        // Red zone: >25
        svg.append('rect').attr('x', 0).attr('y', y(yMax * 1.1)).attr('width', width).attr('height', y(25) - y(yMax * 1.1))
            .attr('class', 'icp-chart-zone-red');
    }

    // Threshold line
    if (opts.threshold) {
        svg.append('line')
            .attr('x1', 0).attr('x2', width)
            .attr('y1', y(opts.threshold)).attr('y2', y(opts.threshold))
            .attr('class', 'icp-threshold-line');
        svg.append('text').attr('x', width - 4).attr('y', y(opts.threshold) - 5)
            .attr('text-anchor', 'end').attr('fill', '#ef4444').attr('font-size', '10px')
            .text('ICP = ' + opts.threshold);
    }

    // Line
    var line = d3.line()
        .x(function (d) { return x(d.time); })
        .y(function (d) { return y(d.value); })
        .curve(d3.curveMonotoneX);

    svg.append('path').datum(data)
        .attr('fill', 'none')
        .attr('stroke', opts.lineColor || '#ef4444')
        .attr('stroke-width', 2.5)
        .attr('d', line);

    // Dots
    svg.selectAll('.dot').data(data).enter().append('circle')
        .attr('cx', function (d) { return x(d.time); })
        .attr('cy', function (d) { return y(d.value); })
        .attr('r', 4)
        .attr('fill', function (d) {
            if (opts.threshold) {
                if (d.value > opts.threshold + 5) return '#ef4444';
                if (d.value > opts.threshold) return '#eab308';
                return '#10b981';
            }
            return opts.lineColor || '#ef4444';
        })
        .attr('stroke', '#0a0a1a')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer');

    // Y-axis label
    if (opts.yLabel) {
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -margin.left + 15)
            .attr('x', -height / 2)
            .attr('text-anchor', 'middle')
            .attr('fill', '#9999b8')
            .attr('font-size', '11px')
            .text(opts.yLabel);
    }
}

/* ================================================
   4. DASHBOARD
   ================================================ */
async function renderTBIDashboard() {
    var pts = tbiPatients.length ? tbiPatients : await tbiFetchAllPatients();
    var total = pts.length;

    var catCounts = {};
    var categories = ['TBI', 'SDH', 'EDH', 'SAH-Traumatic', 'Skull Fracture', 'Penetrating', 'Polytrauma'];
    categories.forEach(function (c) { catCounts[c] = 0; });
    pts.forEach(function (p) { if (catCounts.hasOwnProperty(p.category)) catCounts[p.category]++; });

    var severe = pts.filter(function (p) { return p.gcs_ed && parseInt(p.gcs_ed) <= 8; }).length;
    var mortality = pts.filter(function (p) { return p.mortality === 'Yes' || p.gos === 1 || p.gos === '1'; }).length;
    var mortRate = total ? ((mortality / total) * 100).toFixed(1) + '%' : 'N/A';

    var cardsEl = document.getElementById('tbiDashStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-users', total, 'Total Patients', 'accent-red') +
            _statCard('fa-bolt', severe, 'Severe TBI', 'accent-amber') +
            _statCard('fa-brain', catCounts['SDH'], 'SDH Cases', 'accent-purple') +
            _statCard('fa-bone', catCounts['Skull Fracture'], 'Fractures', 'accent-cyan') +
            _statCard('fa-skull-crossbones', mortRate, 'Mortality Rate', 'accent-red') +
            _statCard('fa-crosshairs', catCounts['Penetrating'], 'Penetrating', 'accent-amber');
    }

    // Category pie
    var catData = categories.map(function (c) { return { label: c, value: catCounts[c] }; }).filter(function (d) { return d.value > 0; });
    if (catData.length) {
        d3DonutChart('tbiCategoryPie', catData, { colors: ['#ef4444', '#7c3aed', '#06b6d4', '#f97316', '#6366f1', '#dc2626', '#4b5563'] });
    } else {
        document.getElementById('tbiCategoryPie').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No data</p>';
    }

    // Severity pie
    var sevCounts = { Mild: 0, Moderate: 0, Severe: 0, Unknown: 0 };
    pts.forEach(function (p) {
        var sev = gcsSeverity(p.gcs_ed);
        sevCounts[sev]++;
    });
    var sevData = [
        { label: 'Mild (13-15)', value: sevCounts.Mild },
        { label: 'Moderate (9-12)', value: sevCounts.Moderate },
        { label: 'Severe (3-8)', value: sevCounts.Severe }
    ].filter(function (d) { return d.value > 0; });
    if (sevData.length) {
        d3DonutChart('tbiSeverityPie', sevData, { colors: ['#10b981', '#f97316', '#ef4444'] });
    } else {
        document.getElementById('tbiSeverityPie').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No GCS data</p>';
    }

    // GCS histogram
    var gcsBins = {};
    for (var g = 3; g <= 15; g++) gcsBins[g] = 0;
    pts.forEach(function (p) { if (p.gcs_ed) { var gv = parseInt(p.gcs_ed); if (gcsBins.hasOwnProperty(gv)) gcsBins[gv]++; } });
    var gcsData = [];
    for (var gk = 3; gk <= 15; gk++) { if (gcsBins[gk] > 0) gcsData.push({ label: String(gk), value: gcsBins[gk] }); }
    if (gcsData.length) {
        d3BarChart('tbiGCSHistogram', gcsData, {
            colors: gcsData.map(function (d) {
                var v = parseInt(d.label);
                if (v <= 8) return '#ef4444';
                if (v <= 12) return '#f97316';
                return '#10b981';
            })
        });
    } else {
        document.getElementById('tbiGCSHistogram').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No GCS data</p>';
    }

    // Mechanism bar chart
    var mechCounts = {};
    pts.forEach(function (p) { var m = p.mechanism || 'Unknown'; mechCounts[m] = (mechCounts[m] || 0) + 1; });
    var mechData = Object.keys(mechCounts).sort(function (a, b) { return mechCounts[b] - mechCounts[a]; }).map(function (k) { return { label: k, value: mechCounts[k] }; });
    if (mechData.length) {
        d3BarChart('tbiMechanismChart', mechData, { color: '#f97316' });
    } else {
        document.getElementById('tbiMechanismChart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No mechanism data</p>';
    }

    // GOS outcomes bar
    var gosCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    pts.forEach(function (p) { if (p.gos) { var gv = parseInt(p.gos); if (gosCounts.hasOwnProperty(gv)) gosCounts[gv]++; } });
    var gosLabels = { 1: 'Dead', 2: 'Vegetative', 3: 'Severe', 4: 'Moderate', 5: 'Good' };
    var gosData = [1, 2, 3, 4, 5].map(function (g) { return { label: gosLabels[g], value: gosCounts[g] }; }).filter(function (d) { return d.value > 0; });
    if (gosData.length) {
        d3BarChart('tbiGOSChart', gosData, { colors: ['#111827', '#ef4444', '#f97316', '#eab308', '#10b981'] });
    } else {
        document.getElementById('tbiGOSChart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No GOS data</p>';
    }

    // Mortality by severity
    var mortBySev = { Mild: { total: 0, dead: 0 }, Moderate: { total: 0, dead: 0 }, Severe: { total: 0, dead: 0 } };
    pts.forEach(function (p) {
        var sev = gcsSeverity(p.gcs_ed);
        if (sev !== 'Unknown' && mortBySev[sev]) {
            mortBySev[sev].total++;
            if (p.mortality === 'Yes' || p.gos === 1 || p.gos === '1') mortBySev[sev].dead++;
        }
    });
    var mortData = ['Mild', 'Moderate', 'Severe'].map(function (s) {
        var rate = mortBySev[s].total ? Math.round((mortBySev[s].dead / mortBySev[s].total) * 100) : 0;
        return { label: s, value: rate };
    }).filter(function (d) { return d.value > 0 || true; });
    d3BarChart('tbiMortalityChart', mortData, { colors: ['#10b981', '#f97316', '#ef4444'] });
}

/* ================================================
   5. ACUTE TBI LIST (Severe, GCS 3-8)
   ================================================ */
async function renderAcuteList() {
    var pts = tbiPatients.length ? tbiPatients : await tbiFetchAllPatients();
    var severe = pts.filter(function (p) { return p.gcs_ed && parseInt(p.gcs_ed) <= 8; });

    var total = severe.length;
    var withEVD = severe.filter(function (p) { return p.evd === 'Yes'; }).length;
    var withCrani = severe.filter(function (p) { return p.decompressive_craniectomy === 'Yes' || p.surgery === 'Decompressive Craniectomy'; }).length;
    var mortCount = severe.filter(function (p) { return p.mortality === 'Yes' || p.gos === 1 || p.gos === '1'; }).length;
    var mortRate = total ? ((mortCount / total) * 100).toFixed(0) + '%' : 'N/A';

    var cardsEl = document.getElementById('acuteStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-bolt', total, 'Severe TBI (GCS 3-8)', 'accent-red') +
            _statCard('fa-tint', withEVD, 'EVD Placed', 'accent-cyan') +
            _statCard('fa-head-side-virus', withCrani, 'Decompressive Crani', 'accent-purple') +
            _statCard('fa-skull-crossbones', mortRate, 'Mortality', 'accent-red');
    }

    // GCS distribution for severe
    var gcsBins = {};
    for (var g = 3; g <= 8; g++) gcsBins[g] = 0;
    severe.forEach(function (p) { var gv = parseInt(p.gcs_ed); if (gcsBins.hasOwnProperty(gv)) gcsBins[gv]++; });
    var gcsData = [];
    for (var gk = 3; gk <= 8; gk++) gcsData.push({ label: 'GCS ' + gk, value: gcsBins[gk] });
    d3BarChart('acuteGCSChart', gcsData, { color: '#ef4444' });

    // ICP management chart
    var icpMgmt = { 'EVD': 0, 'Mannitol': 0, 'HTS': 0, 'Decomp Crani': 0, 'Barbiturate': 0, 'Hypothermia': 0 };
    severe.forEach(function (p) {
        if (p.evd === 'Yes') icpMgmt['EVD']++;
        if (p.hyperosmolar === 'Mannitol' || p.hyperosmolar === 'Both') icpMgmt['Mannitol']++;
        if (p.hyperosmolar === 'HTS' || p.hyperosmolar === 'Both') icpMgmt['HTS']++;
        if (p.decompressive_craniectomy === 'Yes' || p.surgery === 'Decompressive Craniectomy') icpMgmt['Decomp Crani']++;
        if (p.barbiturate_coma === 'Yes') icpMgmt['Barbiturate']++;
        if (p.therapeutic_hypothermia === 'Yes') icpMgmt['Hypothermia']++;
    });
    var icpMgmtData = Object.keys(icpMgmt).map(function (k) { return { label: k, value: icpMgmt[k] }; });
    d3BarChart('acuteICPMgmtChart', icpMgmtData, { color: '#06b6d4' });

    // Table
    var tbody = document.getElementById('acuteTbody');
    if (!tbody) return;
    if (!severe.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted);">No severe TBI patients found.</td></tr>';
        return;
    }
    var html = '';
    severe.forEach(function (p) {
        html += '<tr class="clickable-row" onclick="openTBIPatientDetail(\'' + _esc(p.study_id) + '\')">' +
            '<td style="color:var(--accent-primary);font-weight:600">' + _esc(p.study_id) + '</td>' +
            '<td>' + _esc(String(p.age || '')) + '</td>' +
            '<td>' + mechanismIcon(p.mechanism) + _esc(p.mechanism || '') + '</td>' +
            '<td>' + gcsBadge(p.gcs_field) + '</td>' +
            '<td>' + gcsBadge(p.gcs_ed) + '</td>' +
            '<td>' + pupilIndicator(p.pupils) + '</td>' +
            '<td>' + marshallBadge(p.marshall_class) + '</td>' +
            '<td>' + _esc(p.surgery || 'None') + '</td>' +
            '<td>' + gosBadge(p.gos) + '</td></tr>';
    });
    tbody.innerHTML = html;
}

/* ================================================
   6. SUBDURAL HEMATOMA LIST
   ================================================ */
async function renderSubduralList() {
    var pts = tbiPatients.length ? tbiPatients : await tbiFetchAllPatients();
    var sdhPts = pts.filter(function (p) { return p.category === 'SDH' || (p.sdh_type && p.sdh_type !== ''); });

    var total = sdhPts.length;
    var acute = sdhPts.filter(function (p) { return p.sdh_type === 'Acute'; }).length;
    var chronic = sdhPts.filter(function (p) { return p.sdh_type === 'Chronic'; }).length;
    var surgical = sdhPts.filter(function (p) { return p.surgery && p.surgery !== 'None'; }).length;

    var cardsEl = document.getElementById('sdhStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-brain', total, 'Total SDH', 'accent-purple') +
            _statCard('fa-exclamation-circle', acute, 'Acute', 'accent-red') +
            _statCard('fa-clock', chronic, 'Chronic', 'accent-cyan') +
            _statCard('fa-cut', surgical, 'Surgical', 'accent-amber');
    }

    // SDH type pie
    var typeCounts = {};
    sdhPts.forEach(function (p) { var t = p.sdh_type || 'Unknown'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
    var typeData = Object.keys(typeCounts).map(function (k) { return { label: k, value: typeCounts[k] }; });
    if (typeData.length) {
        d3DonutChart('sdhTypePie', typeData, { colors: ['#ef4444', '#f97316', '#06b6d4', '#6366f1', '#4b5563'] });
    } else {
        document.getElementById('sdhTypePie').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No data</p>';
    }

    // Surgical vs conservative
    var conservative = sdhPts.filter(function (p) { return !p.surgery || p.surgery === 'None'; }).length;
    d3BarChart('sdhSurgChart', [
        { label: 'Surgical', value: surgical },
        { label: 'Conservative', value: conservative }
    ], { colors: ['#7c3aed', '#06b6d4'] });

    // Table
    var tbody = document.getElementById('sdhTbody');
    if (!tbody) return;
    if (!sdhPts.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted);">No SDH patients found.</td></tr>';
        return;
    }
    var html = '';
    sdhPts.forEach(function (p) {
        html += '<tr class="clickable-row" onclick="openTBIPatientDetail(\'' + _esc(p.study_id) + '\')">' +
            '<td style="color:var(--accent-primary);font-weight:600">' + _esc(p.study_id) + '</td>' +
            '<td>' + _esc(String(p.age || '')) + '</td>' +
            '<td>' + _esc(p.sdh_type || 'N/A') + '</td>' +
            '<td>' + gcsBadge(p.gcs_ed) + '</td>' +
            '<td>' + _esc(p.midline_shift != null ? p.midline_shift + ' mm' : 'N/A') + '</td>' +
            '<td>' + _esc(p.anticoagulation || 'None') + '</td>' +
            '<td>' + _esc(p.surgery || 'None') + '</td>' +
            '<td>' + gosBadge(p.gos) + '</td></tr>';
    });
    tbody.innerHTML = html;
}

/* ================================================
   7. SKULL FRACTURE LIST
   ================================================ */
async function renderFractureList() {
    var pts = tbiPatients.length ? tbiPatients : await tbiFetchAllPatients();
    var fracPts = pts.filter(function (p) { return p.category === 'Skull Fracture' || (p.fracture_type && p.fracture_type !== ''); });

    var total = fracPts.length;
    var linear = fracPts.filter(function (p) { return p.fracture_type === 'Linear'; }).length;
    var depressed = fracPts.filter(function (p) { return p.fracture_type === 'Depressed'; }).length;
    var basilar = fracPts.filter(function (p) { return p.fracture_type === 'Basilar'; }).length;

    var cardsEl = document.getElementById('fractureStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-bone', total, 'Total Fractures', 'accent-cyan') +
            _statCard('fa-minus', linear, 'Linear', 'accent-green') +
            _statCard('fa-compress-alt', depressed, 'Depressed', 'accent-amber') +
            _statCard('fa-level-down-alt', basilar, 'Basilar', 'accent-purple');
    }

    // Fracture type pie
    var typeCounts = {};
    fracPts.forEach(function (p) { var t = p.fracture_type || 'Unknown'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
    var typeData = Object.keys(typeCounts).map(function (k) { return { label: k, value: typeCounts[k] }; });
    if (typeData.length) {
        d3DonutChart('fractureTypePie', typeData, { colors: ['#10b981', '#f97316', '#7c3aed', '#06b6d4', '#ef4444', '#4b5563'] });
    } else {
        document.getElementById('fractureTypePie').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No data</p>';
    }

    // Surgical chart
    var surgical = fracPts.filter(function (p) { return p.surgery && p.surgery !== 'None'; }).length;
    var conservative = fracPts.length - surgical;
    d3BarChart('fractureSurgChart', [
        { label: 'Surgical', value: surgical },
        { label: 'Conservative', value: conservative }
    ], { colors: ['#6366f1', '#06b6d4'] });

    // Table
    var tbody = document.getElementById('fractureTbody');
    if (!tbody) return;
    if (!fracPts.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted);">No fracture patients found.</td></tr>';
        return;
    }
    var html = '';
    fracPts.forEach(function (p) {
        html += '<tr class="clickable-row" onclick="openTBIPatientDetail(\'' + _esc(p.study_id) + '\')">' +
            '<td style="color:var(--accent-primary);font-weight:600">' + _esc(p.study_id) + '</td>' +
            '<td>' + _esc(String(p.age || '')) + '</td>' +
            '<td>' + mechanismIcon(p.mechanism) + _esc(p.mechanism || '') + '</td>' +
            '<td>' + _esc(p.fracture_type || 'N/A') + '</td>' +
            '<td>' + _esc(p.fracture_location || 'N/A') + '</td>' +
            '<td>' + gcsBadge(p.gcs_ed) + '</td>' +
            '<td>' + _esc(p.surgery || 'None') + '</td>' +
            '<td>' + gosBadge(p.gos) + '</td></tr>';
    });
    tbody.innerHTML = html;
}

/* ================================================
   8. ADD PATIENT WIZARD
   ================================================ */
var tbiWizardStep = 1;
var tbiWizardTotalSteps = 5;

function tbiWizardNext() {
    if (tbiWizardStep >= tbiWizardTotalSteps) return;
    tbiSetWizardStep(tbiWizardStep + 1);
}
function tbiWizardPrev() {
    if (tbiWizardStep <= 1) return;
    tbiSetWizardStep(tbiWizardStep - 1);
}

function tbiSetWizardStep(step) {
    tbiWizardStep = step;
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
    document.getElementById('tbiWizPrev').disabled = step === 1;
    document.getElementById('tbiWizNext').style.display = step === tbiWizardTotalSteps ? 'none' : '';
    document.getElementById('tbiWizSubmit').style.display = step === tbiWizardTotalSteps ? '' : 'none';
}

function tbiCategoryChanged() {
    // Future: show/hide category-specific fields
}

async function tbiAutoGenerateStudyId() {
    var { data } = await _sb.from('tbi_patients').select('study_id').order('study_id', { ascending: false }).limit(1);
    var nextNum = 1;
    if (data && data.length && data[0].study_id) {
        var match = data[0].study_id.match(/TBI-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
    }
    var id = 'TBI-' + String(nextNum).padStart(4, '0');
    document.getElementById('tbiAddStudyId').value = id;
}

async function tbiSubmitNewPatient() {
    var studyId = document.getElementById('tbiAddStudyId').value.trim();
    if (!studyId) { tbiToast('Study ID is required', 'error'); return; }

    var cat = document.getElementById('tbiAddCategory').value;
    if (!cat) { tbiToast('Category is required', 'error'); return; }

    // Gather complications checkboxes
    var compChecks = document.querySelectorAll('.tbi-comp:checked');
    var complications = [];
    for (var c = 0; c < compChecks.length; c++) { complications.push(compChecks[c].value); }

    var patient = {
        study_id: studyId,
        category: cat,
        age: document.getElementById('tbiAddAge').value ? parseInt(document.getElementById('tbiAddAge').value) : null,
        sex: document.getElementById('tbiAddSex').value || null,
        race: document.getElementById('tbiAddRace').value || null,
        ethnicity: document.getElementById('tbiAddEthnicity').value || null,
        injury_date: document.getElementById('tbiAddInjuryDate').value || null,
        mechanism: document.getElementById('tbiAddMechanism').value || null,
        anticoagulation: document.getElementById('tbiAddAnticoag').value || null,

        // Field/ED Assessment
        gcs_field: document.getElementById('tbiAddGCSField').value ? parseInt(document.getElementById('tbiAddGCSField').value) : null,
        gcs_ed: document.getElementById('tbiAddGCSED').value ? parseInt(document.getElementById('tbiAddGCSED').value) : null,
        gcs_eye: document.getElementById('tbiAddGCSEye').value ? parseInt(document.getElementById('tbiAddGCSEye').value) : null,
        gcs_verbal: document.getElementById('tbiAddGCSVerbal').value ? parseInt(document.getElementById('tbiAddGCSVerbal').value) : null,
        gcs_motor: document.getElementById('tbiAddGCSMotor').value ? parseInt(document.getElementById('tbiAddGCSMotor').value) : null,
        pupils: document.getElementById('tbiAddPupils').value || null,
        intubated_field: document.getElementById('tbiAddIntubated').value || null,
        sbp: document.getElementById('tbiAddSBP').value ? parseInt(document.getElementById('tbiAddSBP').value) : null,
        heart_rate: document.getElementById('tbiAddHR').value ? parseInt(document.getElementById('tbiAddHR').value) : null,
        spo2: document.getElementById('tbiAddSpO2').value ? parseInt(document.getElementById('tbiAddSpO2').value) : null,
        associated_injuries: document.getElementById('tbiAddAssocInjuries').value.trim() || null,

        // CT findings
        marshall_class: document.getElementById('tbiAddMarshall').value || null,
        rotterdam_score: document.getElementById('tbiAddRotterdam').value ? parseInt(document.getElementById('tbiAddRotterdam').value) : null,
        midline_shift: document.getElementById('tbiAddMidlineShift').value ? parseFloat(document.getElementById('tbiAddMidlineShift').value) : null,
        herniation: document.getElementById('tbiAddHerniation').value || null,
        sdh_type: document.getElementById('tbiAddSDH').value || null,
        sdh_thickness: document.getElementById('tbiAddSDHThickness').value ? parseFloat(document.getElementById('tbiAddSDHThickness').value) : null,
        edh: document.getElementById('tbiAddEDH').value || null,
        edh_volume: document.getElementById('tbiAddEDHVolume').value ? parseFloat(document.getElementById('tbiAddEDHVolume').value) : null,
        contusion: document.getElementById('tbiAddContusion').value || null,
        dai: document.getElementById('tbiAddDAI').value || null,
        traumatic_sah: document.getElementById('tbiAddTSAH').value || null,
        ivh: document.getElementById('tbiAddIVH').value || null,
        fracture_type: document.getElementById('tbiAddFractureType').value || null,
        fracture_location: document.getElementById('tbiAddFractureLocation').value.trim() || null,

        // Surgery / ICP
        surgery: document.getElementById('tbiAddSurgery').value || null,
        surgery_date: document.getElementById('tbiAddSurgDate').value || null,
        surgeon: document.getElementById('tbiAddSurgeon').value.trim() || null,
        time_to_surgery: document.getElementById('tbiAddTimeToSurg').value ? parseFloat(document.getElementById('tbiAddTimeToSurg').value) : null,
        surgical_complications: document.getElementById('tbiAddSurgComplications').value.trim() || null,
        evd: document.getElementById('tbiAddEVD').value || null,
        icp_monitor_type: document.getElementById('tbiAddICPMonitor').value || null,
        hyperosmolar: document.getElementById('tbiAddHyperosmolar').value || null,
        decompressive_craniectomy: document.getElementById('tbiAddDecompCrani').value || null,
        barbiturate_coma: document.getElementById('tbiAddBarbComa').value || null,
        therapeutic_hypothermia: document.getElementById('tbiAddHypothermia').value || null,

        // ICU course
        icu_days: document.getElementById('tbiAddICUDays').value ? parseInt(document.getElementById('tbiAddICUDays').value) : null,
        ventilator_days: document.getElementById('tbiAddVentDays').value ? parseInt(document.getElementById('tbiAddVentDays').value) : null,
        tracheostomy: document.getElementById('tbiAddTrach').value || null,
        peg_tube: document.getElementById('tbiAddPEG').value || null,
        complications: complications.length ? complications.join(', ') : null,
        vp_shunt: document.getElementById('tbiAddShunt').value || null,

        // Outcomes
        gos: document.getElementById('tbiAddGOS').value ? parseInt(document.getElementById('tbiAddGOS').value) : null,
        gos_e: document.getElementById('tbiAddGOSE').value ? parseInt(document.getElementById('tbiAddGOSE').value) : null,
        drs: document.getElementById('tbiAddDRS').value ? parseInt(document.getElementById('tbiAddDRS').value) : null,
        rancho_level: document.getElementById('tbiAddRancho').value || null,
        mortality: document.getElementById('tbiAddMortality').value || null,
        brain_death: document.getElementById('tbiAddBrainDeath').value || null,
        organ_donor: document.getElementById('tbiAddOrganDonor').value || null,
        discharge_disposition: document.getElementById('tbiAddDisposition').value || null
    };

    var { data, error } = await _sb.from('tbi_patients').insert([patient]).select();
    if (error) {
        tbiToast('Error saving patient: ' + error.message, 'error');
        return;
    }
    tbiToast('Patient ' + studyId + ' saved successfully!', 'success');
    tbiSetWizardStep(1);
    document.querySelectorAll('#tbi-add input, #tbi-add select, #tbi-add textarea').forEach(function (el) {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
    });
    await tbiFetchAllPatients();
}

/* ================================================
   9. PATIENT DETAIL
   ================================================ */
async function openTBIPatientDetail(studyId) {
    tbiNavigate('tbi-detail');
    var container = document.getElementById('tbiDetailContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#ef4444"></i><p style="color:#9999b8;margin-top:10px">Loading patient...</p></div>';

    var { data: patient, error } = await _sb.from('tbi_patients').select('*').eq('study_id', studyId).single();
    if (error || !patient) {
        container.innerHTML = '<div class="detail-placeholder"><i class="fas fa-exclamation-circle"></i><p>Patient not found</p></div>';
        return;
    }
    tbiCurrentPatient = patient;
    var pid = patient.id;

    // Fetch related data in parallel
    var icpP = _sb.from('tbi_icp_readings').select('*').eq('patient_id', pid).order('reading_time', { ascending: true });
    var imagingP = _sb.from('tbi_imaging').select('*').eq('patient_id', pid).order('study_date', { ascending: false });
    var outcomesP = _sb.from('tbi_outcome_assessments').select('*').eq('patient_id', pid).order('assessment_date', { ascending: false });
    var complicationsP = _sb.from('tbi_complications').select('*').eq('patient_id', pid).order('onset_date', { ascending: false });
    var followupsP = _sb.from('tbi_follow_ups').select('*').eq('patient_id', pid).order('visit_date', { ascending: false });

    var results = await Promise.all([icpP, imagingP, outcomesP, complicationsP, followupsP]);
    var icpReadings = results[0].data || [];
    var imaging = results[1].data || [];
    var outcomes = results[2].data || [];
    var complicationsList = results[3].data || [];
    var followups = results[4].data || [];

    var p = patient;
    var html = '';

    // Header
    html += '<div class="detail-header">';
    html += '<div class="detail-header-left">';
    html += '<h2>' + _esc(p.study_id) + '</h2>';
    html += '<div class="detail-subtitle">' + categoryBadge(p.category) + ' &bull; ' + gcsBadge(p.gcs_ed) + ' &bull; ' + mechanismIcon(p.mechanism) + _esc(p.mechanism || '') + '</div>';
    html += '</div>';
    html += '<div class="detail-header-right">';
    html += '<button class="btn btn-outline" onclick="tbiShowEditModal()"><i class="fas fa-edit"></i> Edit</button>';
    html += '<button class="btn btn-accent" onclick="tbiShowAddOutcomeModal(\'' + _esc(p.study_id) + '\')"><i class="fas fa-plus"></i> Add Outcome</button>';
    html += '</div></div>';

    // Tabs
    html += '<div class="detail-tabs">';
    var tabs = ['Overview', 'Injury/ED', 'Imaging', 'Surgery/ICP', 'ICU Course', 'Outcomes', 'Follow-up'];
    tabs.forEach(function (t, i) {
        html += '<button class="detail-tab' + (i === 0 ? ' active' : '') + '" onclick="tbiSwitchDetailTab(' + i + ')" data-idx="' + i + '">' + t + '</button>';
    });
    html += '</div>';

    // Tab 0: Overview
    html += '<div class="detail-tab-panel active" data-idx="0">';
    html += '<div class="detail-section"><h4><i class="fas fa-user"></i> Demographics</h4><div class="detail-grid">';
    html += _detailField('Age', p.age) + _detailField('Sex', p.sex) + _detailField('Race', p.race) + _detailField('Ethnicity', p.ethnicity);
    html += '</div></div>';
    html += '<div class="detail-section"><h4><i class="fas fa-head-side-virus"></i> Injury Summary</h4><div class="detail-grid">';
    html += _detailField('Category', p.category) + _detailField('Injury Date', p.injury_date) + _detailField('Mechanism', p.mechanism) + _detailField('Anticoagulation', p.anticoagulation);
    html += '<div class="detail-field"><div class="df-label">GCS (ED)</div><div class="df-value">' + gcsBadge(p.gcs_ed) + '</div></div>';
    html += '<div class="detail-field"><div class="df-label">Pupils</div><div class="df-value">' + pupilIndicator(p.pupils) + '</div></div>';
    html += '<div class="detail-field"><div class="df-label">Marshall Class</div><div class="df-value">' + marshallBadge(p.marshall_class) + '</div></div>';
    html += '<div class="detail-field"><div class="df-label">GOS</div><div class="df-value">' + gosBadge(p.gos) + '</div></div>';
    html += '</div></div></div>';

    // Tab 1: Injury/ED
    html += '<div class="detail-tab-panel" data-idx="1">';
    html += '<div class="detail-section"><h4><i class="fas fa-ambulance"></i> Field Assessment</h4><div class="detail-grid">';
    html += '<div class="detail-field"><div class="df-label">GCS Field</div><div class="df-value">' + gcsBadge(p.gcs_field) + '</div></div>';
    html += _detailField('Intubated in Field', p.intubated_field);
    html += '</div></div>';
    html += '<div class="detail-section"><h4><i class="fas fa-hospital"></i> ED Assessment</h4><div class="detail-grid">';
    html += '<div class="detail-field"><div class="df-label">GCS ED</div><div class="df-value">' + gcsBadge(p.gcs_ed) + '</div></div>';
    html += _detailField('Eye', p.gcs_eye) + _detailField('Verbal', p.gcs_verbal) + _detailField('Motor', p.gcs_motor);
    html += '<div class="detail-field"><div class="df-label">Pupils</div><div class="df-value">' + pupilIndicator(p.pupils) + '</div></div>';
    html += _detailField('SBP', p.sbp ? p.sbp + ' mmHg' : null) + _detailField('HR', p.heart_rate ? p.heart_rate + ' bpm' : null) + _detailField('SpO2', p.spo2 ? p.spo2 + '%' : null);
    html += _detailField('Associated Injuries', p.associated_injuries);
    html += '</div></div></div>';

    // Tab 2: Imaging
    html += '<div class="detail-tab-panel" data-idx="2">';
    html += '<div class="detail-section"><h4><i class="fas fa-x-ray"></i> Initial CT Findings</h4><div class="detail-grid">';
    html += '<div class="detail-field"><div class="df-label">Marshall Class</div><div class="df-value">' + marshallBadge(p.marshall_class) + '</div></div>';
    html += _detailField('Rotterdam Score', p.rotterdam_score) + _detailField('Midline Shift', p.midline_shift != null ? p.midline_shift + ' mm' : null) + _detailField('Herniation', p.herniation);
    html += _detailField('SDH', p.sdh_type) + _detailField('SDH Thickness', p.sdh_thickness != null ? p.sdh_thickness + ' mm' : null);
    html += _detailField('EDH', p.edh) + _detailField('EDH Volume', p.edh_volume != null ? p.edh_volume + ' cc' : null);
    html += _detailField('Contusion', p.contusion) + _detailField('DAI', p.dai);
    html += _detailField('Traumatic SAH', p.traumatic_sah) + _detailField('IVH', p.ivh);
    html += _detailField('Fracture Type', p.fracture_type) + _detailField('Fracture Location', p.fracture_location);
    html += '</div></div>';
    // Imaging timeline
    html += '<div class="detail-section"><h4><i class="fas fa-images"></i> Imaging Timeline</h4>';
    html += '<button class="btn btn-sm btn-accent" style="margin-bottom:12px" onclick="tbiShowAddImagingModal(' + pid + ')"><i class="fas fa-plus"></i> Add Study</button>';
    if (imaging.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Type</th><th>Findings</th><th>Changes</th></tr></thead><tbody>';
        imaging.forEach(function (im) {
            html += '<tr><td>' + _esc(im.study_date || '') + '</td><td>' + _esc(im.study_type || '') + '</td><td>' + _esc(im.findings || '') + '</td><td>' + _esc(im.changes || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No imaging studies</p>'; }
    html += '</div></div>';

    // Tab 3: Surgery/ICP
    html += '<div class="detail-tab-panel" data-idx="3">';
    html += '<div class="detail-section"><h4><i class="fas fa-cut"></i> Surgery Details</h4><div class="detail-grid">';
    html += _detailField('Surgery', p.surgery) + _detailField('Surgery Date', p.surgery_date) + _detailField('Surgeon', p.surgeon) + _detailField('Time to Surgery', p.time_to_surgery != null ? p.time_to_surgery + ' hrs' : null);
    html += _detailField('Complications', p.surgical_complications);
    html += '</div></div>';
    html += '<div class="detail-section"><h4><i class="fas fa-heartbeat"></i> ICP Management</h4><div class="detail-grid">';
    html += _detailField('EVD', p.evd) + _detailField('ICP Monitor', p.icp_monitor_type) + _detailField('Hyperosmolar', p.hyperosmolar);
    html += _detailField('Decompressive Craniectomy', p.decompressive_craniectomy) + _detailField('Barbiturate Coma', p.barbiturate_coma) + _detailField('Therapeutic Hypothermia', p.therapeutic_hypothermia);
    html += '</div></div>';
    // ICP readings inline chart
    if (icpReadings.length) {
        html += '<div class="detail-section"><h4><i class="fas fa-chart-line"></i> ICP Trend</h4>';
        html += '<div id="detailICPChart" class="chart-container" style="min-height:280px"></div>';
        html += '</div>';
    }
    html += '</div>';

    // Tab 4: ICU Course
    html += '<div class="detail-tab-panel" data-idx="4">';
    html += '<div class="detail-section"><h4><i class="fas fa-procedures"></i> ICU Course</h4><div class="detail-grid">';
    html += _detailField('ICU Days', p.icu_days) + _detailField('Ventilator Days', p.ventilator_days) + _detailField('Tracheostomy', p.tracheostomy) + _detailField('PEG Tube', p.peg_tube);
    html += _detailField('VP Shunt', p.vp_shunt) + _detailField('Complications', p.complications);
    html += '</div></div>';
    // Complications sub-table
    html += '<div class="detail-section"><h4><i class="fas fa-exclamation-triangle"></i> Complication Log</h4>';
    html += '<button class="btn btn-sm btn-accent" style="margin-bottom:12px" onclick="tbiShowAddComplicationModal(' + pid + ')"><i class="fas fa-plus"></i> Add Complication</button>';
    if (complicationsList.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Treatment</th></tr></thead><tbody>';
        complicationsList.forEach(function (co) {
            html += '<tr><td>' + _esc(co.onset_date || '') + '</td><td>' + _esc(co.complication_type || '') + '</td><td>' + _esc(co.details || '') + '</td><td>' + _esc(co.treatment || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No complications logged</p>'; }
    html += '</div></div>';

    // Tab 5: Outcomes
    html += '<div class="detail-tab-panel" data-idx="5">';
    html += '<div class="detail-section"><h4><i class="fas fa-trophy"></i> Outcome Summary</h4><div class="detail-grid">';
    html += '<div class="detail-field"><div class="df-label">GOS</div><div class="df-value">' + gosBadge(p.gos) + '</div></div>';
    html += '<div class="detail-field"><div class="df-label">GOS-E</div><div class="df-value">' + goseBadge(p.gos_e) + '</div></div>';
    html += _detailField('DRS', p.drs) + _detailField('Rancho Level', p.rancho_level);
    html += _detailField('Mortality', p.mortality) + _detailField('Brain Death', p.brain_death) + _detailField('Organ Donor', p.organ_donor) + _detailField('Discharge', p.discharge_disposition);
    html += '</div></div>';
    // Outcome assessments sub-table
    html += '<div class="detail-section"><h4><i class="fas fa-clipboard-list"></i> Outcome Assessments</h4>';
    html += '<button class="btn btn-sm btn-accent" style="margin-bottom:12px" onclick="tbiShowAddOutcomeModal(\'' + _esc(p.study_id) + '\')"><i class="fas fa-plus"></i> Add Assessment</button>';
    if (outcomes.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Type</th><th>Score</th><th>Timepoint</th><th>Notes</th></tr></thead><tbody>';
        outcomes.forEach(function (o) {
            html += '<tr><td>' + _esc(o.assessment_date || '') + '</td><td>' + _esc(o.assessment_type || '') + '</td><td style="font-weight:600">' + _esc(String(o.score != null ? o.score : '')) + '</td><td>' + _esc(o.timepoint || '') + '</td><td>' + _esc(o.notes || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No outcome assessments</p>'; }
    html += '</div></div>';

    // Tab 6: Follow-up
    html += '<div class="detail-tab-panel" data-idx="6">';
    html += '<div class="detail-section"><h4><i class="fas fa-calendar-check"></i> Follow-up Visits</h4>';
    html += '<button class="btn btn-sm btn-accent" style="margin-bottom:12px" onclick="tbiShowAddFollowUpModal(' + pid + ')"><i class="fas fa-plus"></i> Add Visit</button>';
    if (followups.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Type</th><th>GOS</th><th>Return to Work</th><th>Notes</th></tr></thead><tbody>';
        followups.forEach(function (f) {
            html += '<tr><td>' + _esc(f.visit_date || '') + '</td><td>' + _esc(f.visit_type || '') + '</td><td>' + gosBadge(f.gos_at_visit) + '</td><td>' + _esc(f.return_to_work || '') + '</td><td>' + _esc(f.notes || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No follow-up visits</p>'; }
    html += '</div></div>';

    container.innerHTML = html;

    // Render ICP chart if data exists
    if (icpReadings.length) {
        var icpData = icpReadings.map(function (r) {
            return { time: new Date(r.reading_time), value: parseFloat(r.icp_value) };
        }).filter(function (d) { return !isNaN(d.value) && d.time instanceof Date && !isNaN(d.time); });
        if (icpData.length) {
            d3LineChart('detailICPChart', icpData, {
                threshold: 20,
                zones: true,
                yLabel: 'ICP (mmHg)',
                lineColor: '#ef4444',
                yMax: 40
            });
        }
    }
}

function tbiSwitchDetailTab(idx) {
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
function tbiShowEditModal() {
    if (!tbiCurrentPatient) return;
    var p = tbiCurrentPatient;
    var body = '<div class="form-row">' +
        '<div class="form-group"><label>GOS</label><select id="tbiEditGOS"><option value="">N/A</option><option value="1"' + (p.gos == 1 ? ' selected' : '') + '>1 - Dead</option><option value="2"' + (p.gos == 2 ? ' selected' : '') + '>2 - Vegetative</option><option value="3"' + (p.gos == 3 ? ' selected' : '') + '>3 - Severe Disability</option><option value="4"' + (p.gos == 4 ? ' selected' : '') + '>4 - Moderate Disability</option><option value="5"' + (p.gos == 5 ? ' selected' : '') + '>5 - Good Recovery</option></select></div>' +
        '<div class="form-group"><label>GOS-E</label><select id="tbiEditGOSE"><option value="">N/A</option><option value="1"' + (p.gos_e == 1 ? ' selected' : '') + '>1</option><option value="2"' + (p.gos_e == 2 ? ' selected' : '') + '>2</option><option value="3"' + (p.gos_e == 3 ? ' selected' : '') + '>3</option><option value="4"' + (p.gos_e == 4 ? ' selected' : '') + '>4</option><option value="5"' + (p.gos_e == 5 ? ' selected' : '') + '>5</option><option value="6"' + (p.gos_e == 6 ? ' selected' : '') + '>6</option><option value="7"' + (p.gos_e == 7 ? ' selected' : '') + '>7</option><option value="8"' + (p.gos_e == 8 ? ' selected' : '') + '>8</option></select></div></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>DRS</label><input type="number" id="tbiEditDRS" value="' + _esc(String(p.drs || '')) + '" min="0" max="29"></div>' +
        '<div class="form-group"><label>Rancho Level</label><select id="tbiEditRancho"><option value="">N/A</option><option value="I"' + (p.rancho_level === 'I' ? ' selected' : '') + '>I</option><option value="II"' + (p.rancho_level === 'II' ? ' selected' : '') + '>II</option><option value="III"' + (p.rancho_level === 'III' ? ' selected' : '') + '>III</option><option value="IV"' + (p.rancho_level === 'IV' ? ' selected' : '') + '>IV</option><option value="V"' + (p.rancho_level === 'V' ? ' selected' : '') + '>V</option><option value="VI"' + (p.rancho_level === 'VI' ? ' selected' : '') + '>VI</option><option value="VII"' + (p.rancho_level === 'VII' ? ' selected' : '') + '>VII</option><option value="VIII"' + (p.rancho_level === 'VIII' ? ' selected' : '') + '>VIII</option></select></div></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Mortality</label><select id="tbiEditMortality"><option value="">N/A</option><option value="Yes"' + (p.mortality === 'Yes' ? ' selected' : '') + '>Yes</option><option value="No"' + (p.mortality === 'No' ? ' selected' : '') + '>No</option></select></div>' +
        '<div class="form-group"><label>Discharge Disposition</label><select id="tbiEditDisposition"><option value="">N/A</option><option value="Home"' + (p.discharge_disposition === 'Home' ? ' selected' : '') + '>Home</option><option value="Rehab"' + (p.discharge_disposition === 'Rehab' ? ' selected' : '') + '>Rehab</option><option value="SNF"' + (p.discharge_disposition === 'SNF' ? ' selected' : '') + '>SNF</option><option value="LTAC"' + (p.discharge_disposition === 'LTAC' ? ' selected' : '') + '>LTAC</option><option value="Deceased"' + (p.discharge_disposition === 'Deceased' ? ' selected' : '') + '>Deceased</option></select></div></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="tbiSaveEdit()"><i class="fas fa-save"></i> Save</button></div>';
    openTbiModal('Edit Patient - ' + p.study_id, body);
}

async function tbiSaveEdit() {
    if (!tbiCurrentPatient) return;
    var updates = {
        gos: document.getElementById('tbiEditGOS').value ? parseInt(document.getElementById('tbiEditGOS').value) : null,
        gos_e: document.getElementById('tbiEditGOSE').value ? parseInt(document.getElementById('tbiEditGOSE').value) : null,
        drs: document.getElementById('tbiEditDRS').value ? parseInt(document.getElementById('tbiEditDRS').value) : null,
        rancho_level: document.getElementById('tbiEditRancho').value || null,
        mortality: document.getElementById('tbiEditMortality').value || null,
        discharge_disposition: document.getElementById('tbiEditDisposition').value || null
    };
    var { error } = await _sb.from('tbi_patients').update(updates).eq('id', tbiCurrentPatient.id);
    if (error) { tbiToast('Error: ' + error.message, 'error'); return; }
    tbiToast('Patient updated', 'success');
    closeTbiModal();
    await tbiFetchAllPatients();
    openTBIPatientDetail(tbiCurrentPatient.study_id);
}

/* ================================================
   10. CRUD MODALS FOR SUB-TABLES
   ================================================ */

/* --- Add ICP Reading --- */
function tbiShowAddICPModal() {
    var patientSelect = document.getElementById('tbiICPPatientSelect');
    var selectedId = patientSelect ? patientSelect.value : '';
    var body = '<div class="form-group"><label>Patient</label><select id="icpModalPatient">';
    tbiPatients.forEach(function (p) {
        body += '<option value="' + p.id + '"' + (String(p.id) === selectedId ? ' selected' : '') + '>' + _esc(p.study_id) + '</option>';
    });
    body += '</select></div>' +
        '<div class="form-group"><label>Reading Date/Time</label><input type="datetime-local" id="icpTime"></div>' +
        '<div class="form-row"><div class="form-group"><label>ICP (mmHg)</label><input type="number" id="icpValue" min="0" step="1"></div>' +
        '<div class="form-group"><label>MAP (mmHg)</label><input type="number" id="icpMAP" min="0"></div></div>' +
        '<div class="form-group"><label>CPP (mmHg)</label><input type="number" id="icpCPP" min="0" placeholder="Auto-calc: MAP - ICP"></div>' +
        '<div class="form-group"><label>Intervention</label><input type="text" id="icpIntervention" placeholder="e.g. Mannitol 20%, HOB elevation"></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="tbiSaveICPReading()"><i class="fas fa-save"></i> Save</button></div>';
    openTbiModal('Add ICP Reading', body);
}

async function tbiSaveICPReading() {
    var patientId = document.getElementById('icpModalPatient').value;
    var icpVal = document.getElementById('icpValue').value;
    var mapVal = document.getElementById('icpMAP').value;
    var cppVal = document.getElementById('icpCPP').value;
    if (!cppVal && mapVal && icpVal) cppVal = parseInt(mapVal) - parseInt(icpVal);

    var rec = {
        patient_id: parseInt(patientId),
        reading_time: document.getElementById('icpTime').value || null,
        icp_value: icpVal ? parseInt(icpVal) : null,
        map: mapVal ? parseInt(mapVal) : null,
        cpp: cppVal ? parseInt(cppVal) : null,
        interventions: document.getElementById('icpIntervention').value.trim() || null
    };
    var { error } = await _sb.from('tbi_icp_readings').insert([rec]);
    if (error) { tbiToast('Error: ' + error.message, 'error'); return; }
    tbiToast('ICP reading added', 'success');
    closeTbiModal();
    tbiLoadICPData();
}

/* --- Add Imaging Study --- */
function tbiShowAddImagingModal(patientId) {
    var body = '<input type="hidden" id="imgPatientId" value="' + patientId + '">' +
        '<div class="form-row"><div class="form-group"><label>Study Date</label><input type="date" id="imgDate"></div>' +
        '<div class="form-group"><label>Study Type</label><select id="imgType"><option value="">Select</option><option value="CT Head">CT Head</option><option value="CT Angio">CT Angiography</option><option value="MRI Brain">MRI Brain</option><option value="MRA">MRA</option><option value="CTA">CTA</option></select></div></div>' +
        '<div class="form-group"><label>Findings</label><textarea id="imgFindings" rows="3" placeholder="Describe findings..."></textarea></div>' +
        '<div class="form-group"><label>Changes from Prior</label><textarea id="imgChanges" rows="2" placeholder="Interval changes..."></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="tbiSaveImaging()"><i class="fas fa-save"></i> Save</button></div>';
    openTbiModal('Add Imaging Study', body);
}

async function tbiSaveImaging() {
    var rec = {
        patient_id: parseInt(document.getElementById('imgPatientId').value),
        study_date: document.getElementById('imgDate').value || null,
        study_type: document.getElementById('imgType').value || null,
        findings: document.getElementById('imgFindings').value.trim() || null,
        changes: document.getElementById('imgChanges').value.trim() || null
    };
    var { error } = await _sb.from('tbi_imaging').insert([rec]);
    if (error) { tbiToast('Error: ' + error.message, 'error'); return; }
    tbiToast('Imaging study added', 'success');
    closeTbiModal();
    if (tbiCurrentPatient) openTBIPatientDetail(tbiCurrentPatient.study_id);
}

/* --- Add Outcome Assessment --- */
function tbiShowAddOutcomeModal(studyId) {
    var body = '<div class="form-row"><div class="form-group"><label>Assessment Type</label><select id="tbiOAType"><option value="">Select</option><option value="GOS">GOS</option><option value="GOS-E">GOS-E</option><option value="DRS">DRS</option><option value="Rancho">Rancho Los Amigos</option><option value="FIM">FIM</option><option value="Other">Other</option></select></div>' +
        '<div class="form-group"><label>Score / Value</label><input type="text" id="tbiOAScore"></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Assessment Date</label><input type="date" id="tbiOADate"></div>' +
        '<div class="form-group"><label>Timepoint</label><select id="tbiOATimepoint"><option value="">Select</option><option value="Discharge">Discharge</option><option value="3 months">3 Months</option><option value="6 months">6 Months</option><option value="12 months">12 Months</option><option value="24 months">24 Months</option></select></div></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="tbiOANotes" rows="2"></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="tbiSaveOutcome(\'' + _esc(studyId) + '\')"><i class="fas fa-save"></i> Save</button></div>';
    openTbiModal('Add Outcome Assessment - ' + studyId, body);
}

async function tbiSaveOutcome(studyId) {
    var { data: pt } = await _sb.from('tbi_patients').select('id').eq('study_id', studyId).single();
    if (!pt) { tbiToast('Patient not found', 'error'); return; }
    var rec = {
        patient_id: pt.id,
        assessment_type: document.getElementById('tbiOAType').value || null,
        score: document.getElementById('tbiOAScore').value.trim() || null,
        assessment_date: document.getElementById('tbiOADate').value || null,
        timepoint: document.getElementById('tbiOATimepoint').value || null,
        notes: document.getElementById('tbiOANotes').value.trim() || null
    };
    var { error } = await _sb.from('tbi_outcome_assessments').insert([rec]);
    if (error) { tbiToast('Error: ' + error.message, 'error'); return; }
    tbiToast('Outcome assessment added', 'success');
    closeTbiModal();
    if (tbiCurrentPatient && tbiCurrentPatient.study_id === studyId) openTBIPatientDetail(studyId);
}

/* --- Add Complication --- */
function tbiShowAddComplicationModal(patientId) {
    var body = '<input type="hidden" id="compPatientId" value="' + patientId + '">' +
        '<div class="form-row"><div class="form-group"><label>Complication Type</label><select id="compType"><option value="">Select</option><option value="DVT">DVT</option><option value="PE">PE</option><option value="Pneumonia">Pneumonia</option><option value="UTI">UTI</option><option value="Seizure">Seizure</option><option value="Hydrocephalus">Hydrocephalus</option><option value="Wound Infection">Wound Infection</option><option value="Meningitis">Meningitis</option><option value="CSF Leak">CSF Leak</option><option value="Other">Other</option></select></div>' +
        '<div class="form-group"><label>Onset Date</label><input type="date" id="compDate"></div></div>' +
        '<div class="form-group"><label>Details</label><textarea id="compDetails" rows="2"></textarea></div>' +
        '<div class="form-group"><label>Treatment</label><textarea id="compTreatment" rows="2"></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="tbiSaveComplication()"><i class="fas fa-save"></i> Save</button></div>';
    openTbiModal('Add Complication', body);
}

async function tbiSaveComplication() {
    var rec = {
        patient_id: parseInt(document.getElementById('compPatientId').value),
        complication_type: document.getElementById('compType').value || null,
        onset_date: document.getElementById('compDate').value || null,
        details: document.getElementById('compDetails').value.trim() || null,
        treatment: document.getElementById('compTreatment').value.trim() || null
    };
    var { error } = await _sb.from('tbi_complications').insert([rec]);
    if (error) { tbiToast('Error: ' + error.message, 'error'); return; }
    tbiToast('Complication added', 'success');
    closeTbiModal();
    if (tbiCurrentPatient) openTBIPatientDetail(tbiCurrentPatient.study_id);
}

/* --- Add Follow-Up --- */
function tbiShowAddFollowUpModal(patientId) {
    var body = '<input type="hidden" id="fuPatientId" value="' + patientId + '">' +
        '<div class="form-row"><div class="form-group"><label>Visit Date</label><input type="date" id="fuDate"></div>' +
        '<div class="form-group"><label>Visit Type</label><select id="fuType"><option value="">Select</option><option value="Routine">Routine</option><option value="Neurosurgery">Neurosurgery Clinic</option><option value="Rehab">Rehab Follow-up</option><option value="Neuropsych">Neuropsych</option><option value="Emergency">Emergency</option></select></div></div>' +
        '<div class="form-row"><div class="form-group"><label>GOS at Visit</label><select id="fuGOS"><option value="">N/A</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></div>' +
        '<div class="form-group"><label>Return to Work</label><select id="fuRTW"><option value="">N/A</option><option value="Full">Full</option><option value="Partial">Partial</option><option value="Unable">Unable</option><option value="Not Applicable">Not Applicable</option></select></div></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="fuNotes" rows="2"></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="tbiSaveFollowUp()"><i class="fas fa-save"></i> Save</button></div>';
    openTbiModal('Add Follow-up Visit', body);
}

async function tbiSaveFollowUp() {
    var rec = {
        patient_id: parseInt(document.getElementById('fuPatientId').value),
        visit_date: document.getElementById('fuDate').value || null,
        visit_type: document.getElementById('fuType').value || null,
        gos_at_visit: document.getElementById('fuGOS').value ? parseInt(document.getElementById('fuGOS').value) : null,
        return_to_work: document.getElementById('fuRTW').value || null,
        notes: document.getElementById('fuNotes').value.trim() || null
    };
    var { error } = await _sb.from('tbi_follow_ups').insert([rec]);
    if (error) { tbiToast('Error: ' + error.message, 'error'); return; }
    tbiToast('Follow-up added', 'success');
    closeTbiModal();
    if (tbiCurrentPatient) openTBIPatientDetail(tbiCurrentPatient.study_id);
}

/* ================================================
   11. QUERY BUILDER
   ================================================ */
async function tbiRunQuery() {
    var query = _sb.from('tbi_patients').select('*');

    var cat = document.getElementById('tbiQCategory').value;
    var severity = document.getElementById('tbiQSeverity').value;
    var mechanism = document.getElementById('tbiQMechanism').value;
    var gcsMin = document.getElementById('tbiQGCSMin').value;
    var gcsMax = document.getElementById('tbiQGCSMax').value;
    var ageMin = document.getElementById('tbiQAgeMin').value;
    var ageMax = document.getElementById('tbiQAgeMax').value;
    var sex = document.getElementById('tbiQSex').value;
    var marshall = document.getElementById('tbiQMarshall').value;
    var surgeryFilter = document.getElementById('tbiQSurgery').value;
    var gos = document.getElementById('tbiQGOS').value;
    var mortality = document.getElementById('tbiQMortality').value;
    var surgeon = document.getElementById('tbiQSurgeon').value.trim();

    if (cat) query = query.eq('category', cat);
    if (mechanism) query = query.eq('mechanism', mechanism);
    if (gcsMin) query = query.gte('gcs_ed', parseInt(gcsMin));
    if (gcsMax) query = query.lte('gcs_ed', parseInt(gcsMax));
    if (ageMin) query = query.gte('age', parseInt(ageMin));
    if (ageMax) query = query.lte('age', parseInt(ageMax));
    if (sex) query = query.eq('sex', sex);
    if (marshall) query = query.eq('marshall_class', marshall);
    if (gos) query = query.eq('gos', parseInt(gos));
    if (mortality) query = query.eq('mortality', mortality);
    if (surgeon) query = query.ilike('surgeon', '%' + surgeon + '%');

    var { data, error } = await query;
    if (error) { tbiToast('Query error: ' + error.message, 'error'); return; }

    // Apply severity filter client-side
    if (severity) {
        data = data.filter(function (p) {
            return gcsSeverity(p.gcs_ed) === severity;
        });
    }

    // Apply surgery filter client-side
    if (surgeryFilter === 'Yes') {
        data = data.filter(function (p) { return p.surgery && p.surgery !== 'None'; });
    } else if (surgeryFilter === 'No') {
        data = data.filter(function (p) { return !p.surgery || p.surgery === 'None'; });
    }

    tbiQueryResults = data || [];
    tbiRenderQueryResults();
}

function tbiRenderQueryResults() {
    var countEl = document.getElementById('tbiQueryCount');
    if (countEl) countEl.textContent = tbiQueryResults.length + ' patients found';

    var tbody = document.getElementById('tbiQueryTbody');
    if (!tbody) return;
    if (!tbiQueryResults.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted);">No results. Adjust filters and search.</td></tr>';
        return;
    }
    var html = '';
    tbiQueryResults.forEach(function (p) {
        html += '<tr class="clickable-row" onclick="openTBIPatientDetail(\'' + _esc(p.study_id) + '\')">' +
            '<td style="color:var(--accent-primary);font-weight:600">' + _esc(p.study_id) + '</td>' +
            '<td>' + _esc(String(p.age || '')) + '</td>' +
            '<td>' + _esc(p.sex || '') + '</td>' +
            '<td>' + categoryBadge(p.category) + '</td>' +
            '<td>' + mechanismIcon(p.mechanism) + _esc(p.mechanism || '') + '</td>' +
            '<td>' + gcsBadge(p.gcs_ed) + '</td>' +
            '<td>' + marshallBadge(p.marshall_class) + '</td>' +
            '<td>' + _esc(p.surgery || 'None') + '</td>' +
            '<td>' + gosBadge(p.gos) + '</td>' +
            '<td>' + (p.mortality === 'Yes' ? '<span style="color:#ef4444;font-weight:600">Yes</span>' : _esc(p.mortality || '')) + '</td></tr>';
    });
    tbody.innerHTML = html;
}

function tbiClearQueryFilters() {
    ['tbiQGCSMin', 'tbiQGCSMax', 'tbiQAgeMin', 'tbiQAgeMax', 'tbiQSurgeon'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['tbiQCategory', 'tbiQSeverity', 'tbiQMechanism', 'tbiQSex', 'tbiQMarshall', 'tbiQSurgery', 'tbiQGOS', 'tbiQMortality'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    tbiQueryResults = [];
    tbiRenderQueryResults();
    document.getElementById('tbiQueryCount').textContent = '0 patients found';
}

function tbiExportQueryCSV() {
    if (!tbiQueryResults.length) { tbiToast('No results to export', 'info'); return; }
    var fields = ['study_id', 'category', 'age', 'sex', 'mechanism', 'gcs_field', 'gcs_ed', 'pupils', 'marshall_class', 'surgery', 'gos', 'gos_e', 'mortality', 'discharge_disposition'];
    var csv = Papa.unparse(tbiQueryResults.map(function (p) {
        var row = {};
        fields.forEach(function (f) { row[f] = p[f] != null ? p[f] : ''; });
        return row;
    }));
    downloadCSV(csv, 'tbi_query_results.csv');
}

/* --- Sortable table headers --- */
function tbiInitTableSorting() {
    var headers = document.querySelectorAll('#tbiQueryTable thead th[data-sort]');
    for (var i = 0; i < headers.length; i++) {
        headers[i].addEventListener('click', function () {
            var col = this.getAttribute('data-sort');
            if (tbiSortCol === col) tbiSortAsc = !tbiSortAsc;
            else { tbiSortCol = col; tbiSortAsc = true; }
            tbiQueryResults.sort(function (a, b) {
                var va = a[col], vb = b[col];
                if (va == null) va = '';
                if (vb == null) vb = '';
                if (typeof va === 'number' && typeof vb === 'number') return tbiSortAsc ? va - vb : vb - va;
                return tbiSortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
            });
            tbiRenderQueryResults();
        });
    }
}

/* ================================================
   12. ICP MONITOR PAGE
   ================================================ */
async function renderICPPage() {
    var pts = tbiPatients.length ? tbiPatients : await tbiFetchAllPatients();
    // Populate patient selector with severe TBI patients who have ICP monitors
    var select = document.getElementById('tbiICPPatientSelect');
    if (select) {
        var currentVal = select.value;
        var options = '<option value="">-- Select Patient --</option>';
        pts.forEach(function (p) {
            if (p.evd === 'Yes' || p.icp_monitor_type || (p.gcs_ed && parseInt(p.gcs_ed) <= 8)) {
                options += '<option value="' + p.id + '"' + (String(p.id) === currentVal ? ' selected' : '') + '>' + _esc(p.study_id) + ' - GCS ' + _esc(String(p.gcs_ed || '?')) + '</option>';
            }
        });
        select.innerHTML = options;
    }
}

async function tbiLoadICPData() {
    var select = document.getElementById('tbiICPPatientSelect');
    var patientId = select ? select.value : '';
    if (!patientId) {
        document.getElementById('icpStatCards').innerHTML = '';
        document.getElementById('icpTrendChart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:60px">Select a patient to view ICP data</p>';
        document.getElementById('cppTrendChart').innerHTML = '';
        document.getElementById('icpTbody').innerHTML = '';
        return;
    }

    var { data: readings, error } = await _sb.from('tbi_icp_readings').select('*').eq('patient_id', parseInt(patientId)).order('reading_time', { ascending: true });
    if (error) { tbiToast('Error loading ICP data: ' + error.message, 'error'); return; }
    readings = readings || [];

    // Stat cards
    var cardsEl = document.getElementById('icpStatCards');
    if (cardsEl) {
        if (readings.length) {
            var icpValues = readings.filter(function (r) { return r.icp_value != null; }).map(function (r) { return parseFloat(r.icp_value); });
            var cppValues = readings.filter(function (r) { return r.cpp != null; }).map(function (r) { return parseFloat(r.cpp); });
            var maxICP = icpValues.length ? Math.max.apply(null, icpValues) : 'N/A';
            var avgICP = icpValues.length ? (icpValues.reduce(function (s, v) { return s + v; }, 0) / icpValues.length).toFixed(1) : 'N/A';
            var crisisCount = icpValues.filter(function (v) { return v > 20; }).length;
            var avgCPP = cppValues.length ? (cppValues.reduce(function (s, v) { return s + v; }, 0) / cppValues.length).toFixed(0) : 'N/A';

            cardsEl.innerHTML =
                _statCard('fa-chart-line', readings.length, 'Total Readings', 'accent-cyan') +
                _statCard('fa-arrow-up', maxICP, 'Peak ICP', maxICP > 20 ? 'accent-red' : 'accent-green') +
                _statCard('fa-calculator', avgICP, 'Mean ICP', 'accent-amber') +
                _statCard('fa-exclamation-triangle', crisisCount, 'ICP > 20 Events', crisisCount > 0 ? 'accent-red' : 'accent-green') +
                _statCard('fa-tachometer-alt', avgCPP, 'Mean CPP', 'accent-purple');
        } else {
            cardsEl.innerHTML = _statCard('fa-info-circle', 0, 'No ICP readings', 'accent-cyan');
        }
    }

    // ICP trend line chart
    if (readings.length) {
        var icpData = readings.filter(function (r) { return r.icp_value != null && r.reading_time; }).map(function (r) {
            return { time: new Date(r.reading_time), value: parseFloat(r.icp_value) };
        }).filter(function (d) { return !isNaN(d.value) && d.time instanceof Date && !isNaN(d.time); });

        if (icpData.length) {
            d3LineChart('icpTrendChart', icpData, {
                threshold: 20,
                zones: true,
                yLabel: 'ICP (mmHg)',
                lineColor: '#ef4444',
                yMax: 40,
                height: 350
            });
        } else {
            document.getElementById('icpTrendChart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:60px">No valid ICP data to chart</p>';
        }

        // CPP trend
        var cppData = readings.filter(function (r) { return r.cpp != null && r.reading_time; }).map(function (r) {
            return { time: new Date(r.reading_time), value: parseFloat(r.cpp) };
        }).filter(function (d) { return !isNaN(d.value) && d.time instanceof Date && !isNaN(d.time); });

        if (cppData.length) {
            d3LineChart('cppTrendChart', cppData, {
                threshold: 60,
                yLabel: 'CPP (mmHg)',
                lineColor: '#06b6d4',
                yMax: 120,
                height: 300
            });
        } else {
            document.getElementById('cppTrendChart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No CPP data</p>';
        }
    } else {
        document.getElementById('icpTrendChart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:60px">No ICP readings for this patient</p>';
        document.getElementById('cppTrendChart').innerHTML = '';
    }

    // Table
    var tbody = document.getElementById('icpTbody');
    if (!tbody) return;
    if (!readings.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted);">No ICP readings</td></tr>';
        return;
    }
    var html = '';
    readings.forEach(function (r) {
        var timeStr = r.reading_time ? new Date(r.reading_time).toLocaleString() : 'N/A';
        html += '<tr>' +
            '<td>' + _esc(timeStr) + '</td>' +
            '<td>' + icpBadge(r.icp_value) + '</td>' +
            '<td>' + _esc(r.cpp != null ? String(r.cpp) : 'N/A') + '</td>' +
            '<td>' + _esc(r.map != null ? String(r.map) : 'N/A') + '</td>' +
            '<td>' + _esc(r.interventions || '') + '</td></tr>';
    });
    tbody.innerHTML = html;
}

/* ================================================
   13. OUTCOMES PAGE
   ================================================ */
async function renderTBIOutcomes() {
    var pts = tbiPatients.length ? tbiPatients : await tbiFetchAllPatients();

    // Stat cards
    var withGOS = pts.filter(function (p) { return p.gos != null; });
    var goodRecovery = withGOS.filter(function (p) { return parseInt(p.gos) === 5; }).length;
    var grRate = withGOS.length ? ((goodRecovery / withGOS.length) * 100).toFixed(0) + '%' : 'N/A';
    var mortCount = pts.filter(function (p) { return p.mortality === 'Yes' || p.gos == 1; }).length;
    var mortRate = pts.length ? ((mortCount / pts.length) * 100).toFixed(1) + '%' : 'N/A';

    var followups = [];
    var { data: fuData } = await _sb.from('tbi_follow_ups').select('*');
    followups = fuData || [];
    var rtwFull = followups.filter(function (f) { return f.return_to_work === 'Full'; }).length;
    var rtwPartial = followups.filter(function (f) { return f.return_to_work === 'Partial'; }).length;
    var rtwUnable = followups.filter(function (f) { return f.return_to_work === 'Unable'; }).length;

    var cardsEl = document.getElementById('tbiOutcomeStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-star', grRate, 'Good Recovery Rate', 'accent-green') +
            _statCard('fa-skull-crossbones', mortRate, 'Mortality Rate', 'accent-red') +
            _statCard('fa-clipboard-check', withGOS.length, 'With GOS Data', 'accent-cyan') +
            _statCard('fa-briefcase', rtwFull, 'Returned to Work (Full)', 'accent-purple');
    }

    // GOS distribution pie
    var gosCounts = {};
    var gosLabels = { 1: 'Dead', 2: 'Vegetative', 3: 'Severe Disability', 4: 'Moderate Disability', 5: 'Good Recovery' };
    withGOS.forEach(function (p) {
        var g = parseInt(p.gos);
        var label = gosLabels[g] || 'Unknown';
        gosCounts[label] = (gosCounts[label] || 0) + 1;
    });
    var gosData = Object.keys(gosCounts).map(function (k) { return { label: k, value: gosCounts[k] }; });
    if (gosData.length) {
        d3DonutChart('outcomeGOSPie', gosData, { colors: ['#111827', '#ef4444', '#f97316', '#eab308', '#10b981'] });
    } else {
        document.getElementById('outcomeGOSPie').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No GOS data</p>';
    }

    // GOS-E distribution bar
    var goseCounts = {};
    var goseLabels = { 1: 'Dead', 2: 'VS', 3: 'L-SD', 4: 'U-SD', 5: 'L-MD', 6: 'U-MD', 7: 'L-GR', 8: 'U-GR' };
    pts.filter(function (p) { return p.gos_e != null; }).forEach(function (p) {
        var g = parseInt(p.gos_e);
        var label = goseLabels[g] || String(g);
        goseCounts[label] = (goseCounts[label] || 0) + 1;
    });
    var goseData = Object.keys(goseLabels).map(function (k) {
        var label = goseLabels[k];
        return { label: label, value: goseCounts[label] || 0 };
    }).filter(function (d) { return d.value > 0; });
    if (goseData.length) {
        d3BarChart('outcomeGOSEChart', goseData, { colors: ['#111827', '#ef4444', '#ef4444', '#f97316', '#eab308', '#eab308', '#10b981', '#10b981'] });
    } else {
        document.getElementById('outcomeGOSEChart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No GOS-E data</p>';
    }

    // Mortality by severity
    var mortBySev = { Mild: { total: 0, dead: 0 }, Moderate: { total: 0, dead: 0 }, Severe: { total: 0, dead: 0 } };
    pts.forEach(function (p) {
        var sev = gcsSeverity(p.gcs_ed);
        if (sev !== 'Unknown' && mortBySev[sev]) {
            mortBySev[sev].total++;
            if (p.mortality === 'Yes' || p.gos == 1) mortBySev[sev].dead++;
        }
    });
    var mortSevData = ['Mild', 'Moderate', 'Severe'].map(function (s) {
        var rate = mortBySev[s].total ? Math.round((mortBySev[s].dead / mortBySev[s].total) * 100) : 0;
        return { label: s + ' (n=' + mortBySev[s].total + ')', value: rate };
    });
    d3BarChart('outcomeMortSeverity', mortSevData, { colors: ['#10b981', '#f97316', '#ef4444'] });

    // Discharge disposition
    var dispCounts = {};
    pts.filter(function (p) { return p.discharge_disposition; }).forEach(function (p) {
        dispCounts[p.discharge_disposition] = (dispCounts[p.discharge_disposition] || 0) + 1;
    });
    var dispData = Object.keys(dispCounts).map(function (k) { return { label: k, value: dispCounts[k] }; });
    if (dispData.length) {
        d3DonutChart('outcomeDisposition', dispData, { colors: ['#10b981', '#06b6d4', '#f97316', '#7c3aed', '#ef4444', '#4b5563'] });
    } else {
        document.getElementById('outcomeDisposition').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No disposition data</p>';
    }

    // Return to work
    var rtwData = [
        { label: 'Full', value: rtwFull },
        { label: 'Partial', value: rtwPartial },
        { label: 'Unable', value: rtwUnable }
    ].filter(function (d) { return d.value > 0; });
    if (rtwData.length) {
        d3DonutChart('outcomeRTW', rtwData, { colors: ['#10b981', '#f97316', '#ef4444'] });
    } else {
        document.getElementById('outcomeRTW').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No return-to-work data</p>';
    }

    // GOS by category
    var gosByCat = {};
    pts.filter(function (p) { return p.category && p.gos != null; }).forEach(function (p) {
        if (!gosByCat[p.category]) gosByCat[p.category] = { total: 0, goodRecovery: 0 };
        gosByCat[p.category].total++;
        if (parseInt(p.gos) >= 4) gosByCat[p.category].goodRecovery++;
    });
    var gosByCatData = Object.keys(gosByCat).map(function (c) {
        var rate = gosByCat[c].total ? Math.round((gosByCat[c].goodRecovery / gosByCat[c].total) * 100) : 0;
        return { label: c, value: rate };
    });
    if (gosByCatData.length) {
        d3BarChart('outcomeGOSByCategory', gosByCatData, { color: '#7c3aed' });
    } else {
        document.getElementById('outcomeGOSByCategory').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No data by category</p>';
    }
}

/* ================================================
   14. INITIALIZATION
   ================================================ */
async function initTBI() {
    await tbiCheckAuth();
    await tbiFetchAllPatients();
    renderTBIDashboard();

    // Sidebar navigation
    var links = document.querySelectorAll('.sidebar-link');
    for (var i = 0; i < links.length; i++) {
        links[i].addEventListener('click', function (e) {
            e.preventDefault();
            var pageId = this.getAttribute('data-page');
            if (pageId) tbiNavigate(pageId);
        });
    }

    // Sidebar toggle
    var toggle = document.getElementById('sidebarToggle');
    if (toggle) {
        toggle.addEventListener('click', function () {
            document.getElementById('btrSidebar').classList.toggle('collapsed');
        });
    }

    tbiInitTableSorting();
}

document.addEventListener('DOMContentLoaded', initTBI);
