/* ============================================
   FUNCTIONAL NEUROSURGERY REGISTRY (FNR)
   Saint Luke's Neuroscience Research Department
   ============================================ */

console.log('%c Functional Neurosurgery Registry ', 'font-size:16px;font-weight:bold;color:#7c3aed;background:#0a0a1a;padding:6px 14px;border-radius:8px;border:1px solid #7c3aed;');

/* ================================================
   0. SUPABASE CLIENT & AUTH
   ================================================ */
var SUPABASE_URL = 'https://noxyrovuuprygxuyhgik.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veHlyb3Z1dXByeWd4dXloZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTUyMTgsImV4cCI6MjA4OTg5MTIxOH0.F3n5nOdpuz-1fENtAScf4Ina_v51Yz3htQGnbZhEPf4';
var _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var fnrUser = null;
var fnrPatients = [];
var fnrQueryResults = [];
var fnrCurrentPatient = null;
var fnrSortCol = null;
var fnrSortAsc = true;
var fnrDashCategory = 'Epilepsy';

/* --- HTML escape --- */
function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* --- Auth check on load --- */
async function fnrCheckAuth() {
    try {
        var resp = await _sb.auth.getSession();
        var session = resp.data.session;
        if (!session || !session.user) {
            window.location.href = 'index.html';
            return;
        }
        fnrUser = session.user;
        var nameEl = document.getElementById('btrUserName');
        if (nameEl) nameEl.textContent = fnrUser.email;
    } catch (e) {
        console.error('FNR auth check failed:', e);
        window.location.href = 'index.html';
    }
}

async function fnrLogout() {
    await _sb.auth.signOut();
    window.location.href = 'index.html';
}

/* ================================================
   1. NAVIGATION & TAB SWITCHING
   ================================================ */
var fnrCurrentPage = 'fnr-dashboard';

function fnrNavigate(pageId) {
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

    fnrCurrentPage = pageId;
    var titleEl = document.getElementById('btrPageTitle');
    var titles = {
        'fnr-dashboard': 'Dashboard',
        'fnr-epilepsy': 'Epilepsy Registry',
        'fnr-dbs': 'DBS Registry',
        'fnr-pain': 'Pain Registry',
        'fnr-add': 'Add Patient',
        'fnr-detail': 'Patient Detail',
        'fnr-query': 'Query Builder',
        'fnr-devices': 'Devices & Programming',
        'fnr-outcomes': 'Outcomes'
    };
    if (titleEl) titleEl.textContent = titles[pageId] || pageId;

    if (pageId === 'fnr-dashboard') renderFNRDashboard();
    else if (pageId === 'fnr-epilepsy') renderEpilepsyList();
    else if (pageId === 'fnr-dbs') renderDBSList();
    else if (pageId === 'fnr-pain') renderPainList();
    else if (pageId === 'fnr-devices') renderDevices();
    else if (pageId === 'fnr-outcomes') renderFNROutcomes();
}

/* --- Toast helper --- */
function fnrToast(message, type) {
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
function openFnrModal(title, bodyHtml) {
    document.getElementById('btrModalTitle').textContent = title;
    document.getElementById('btrModalBody').innerHTML = bodyHtml;
    document.getElementById('btrModalOverlay').classList.add('active');
}

function closeFnrModal() {
    document.getElementById('btrModalOverlay').classList.remove('active');
}

/* ================================================
   2. DATA HELPERS
   ================================================ */
async function fnrFetchAllPatients() {
    var { data, error } = await _sb.from('fnr_patients').select('*');
    if (error) { console.error('Fetch FNR patients error:', error); return []; }
    fnrPatients = data || [];
    return fnrPatients;
}

function engelBadge(engelClass) {
    if (!engelClass) return '<span class="badge badge-gray">N/A</span>';
    var cls = 'badge-gray';
    var label = engelClass;
    var ec = String(engelClass).toUpperCase();
    if (ec === 'IA') { cls = 'engel-ia'; label = 'IA - Seizure Free'; }
    else if (ec === 'IB') { cls = 'engel-ib'; label = 'IB'; }
    else if (ec === 'IC') { cls = 'engel-ic'; label = 'IC'; }
    else if (ec === 'ID') { cls = 'engel-id'; label = 'ID'; }
    else if (ec === 'II') { cls = 'engel-ii'; label = 'II'; }
    else if (ec === 'III') { cls = 'engel-iii'; label = 'III'; }
    else if (ec === 'IV') { cls = 'engel-iv'; label = 'IV'; }
    return '<span class="badge ' + cls + '">' + _esc(label) + '</span>';
}

function updrsImprovement(pre, post) {
    if (pre == null || post == null || pre === 0) return '<span class="badge badge-gray">N/A</span>';
    var pct = ((pre - post) / pre * 100).toFixed(0);
    var cls = pct >= 50 ? 'updrs-good' : pct >= 30 ? 'updrs-moderate' : 'updrs-poor';
    return '<span class="' + cls + '">' + pct + '%</span>';
}

function vasBadge(score) {
    if (score == null) return '<span class="badge badge-gray">N/A</span>';
    var s = parseFloat(score);
    var cls = 'vas-0';
    if (s <= 0) cls = 'vas-0';
    else if (s <= 3) cls = 'vas-low';
    else if (s <= 5) cls = 'vas-mid';
    else if (s <= 7) cls = 'vas-high';
    else cls = 'vas-max';
    return '<span class="badge ' + cls + '">' + s.toFixed(1) + '</span>';
}

function deviceStatusBadge(status) {
    if (!status) return '<span class="badge badge-gray">Unknown</span>';
    var cls = 'badge-gray';
    if (status === 'Active') cls = 'device-active';
    else if (status === 'Low Battery' || status === 'Low' || status === 'ERI') cls = 'device-low-battery';
    else if (status === 'Replaced') cls = 'device-replaced';
    else if (status === 'Explanted') cls = 'device-explanted';
    return '<span class="badge ' + cls + '">' + _esc(status) + '</span>';
}

function categoryBadge(cat) {
    if (!cat) return '<span class="badge badge-gray">N/A</span>';
    var colors = { 'Epilepsy': '#7c3aed', 'DBS': '#06b6d4', 'Pain': '#f97316', 'Spasticity': '#10b981', 'Other': '#6b7280' };
    var c = colors[cat] || '#6b7280';
    return '<span class="badge" style="background:' + c + ';color:#fff">' + _esc(cat) + '</span>';
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

    var color = opts.color || '#7c3aed';
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
        .range(opts.colors || ['#7c3aed', '#06b6d4', '#f97316', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#6366f1']);

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

/* ================================================
   4. DASHBOARD
   ================================================ */
async function renderFNRDashboard() {
    var pts = fnrPatients.length ? fnrPatients : await fnrFetchAllPatients();
    var total = pts.length;
    var epilepsyCount = pts.filter(function (p) { return p.category === 'Epilepsy'; }).length;
    var dbsCount = pts.filter(function (p) { return p.category === 'DBS'; }).length;
    var painCount = pts.filter(function (p) { return p.category === 'Pain'; }).length;
    var spasticityCount = pts.filter(function (p) { return p.category === 'Spasticity'; }).length;

    var seizureFree = pts.filter(function (p) { return p.seizure_free === true || p.engel_class === 'IA'; }).length;
    var epilepsyWithOutcome = pts.filter(function (p) { return p.category === 'Epilepsy' && p.engel_class; }).length;
    var seizureFreeRate = epilepsyWithOutcome ? ((seizureFree / epilepsyWithOutcome) * 100).toFixed(0) + '%' : 'N/A';

    var cardsEl = document.getElementById('fnrDashStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-users', total, 'Total Patients', 'accent-cyan') +
            _statCard('fa-wave-square', epilepsyCount, 'Epilepsy', 'accent-purple') +
            _statCard('fa-microchip', dbsCount, 'DBS', 'accent-cyan') +
            _statCard('fa-fire', painCount, 'Pain', 'accent-amber') +
            _statCard('fa-walking', spasticityCount, 'Spasticity', 'accent-green') +
            _statCard('fa-star', seizureFreeRate, 'Seizure Freedom', 'accent-purple');
    }

    // Category distribution pie
    var catData = [
        { label: 'Epilepsy', value: epilepsyCount },
        { label: 'DBS', value: dbsCount },
        { label: 'Pain', value: painCount },
        { label: 'Spasticity', value: spasticityCount }
    ].filter(function (d) { return d.value > 0; });
    if (catData.length) {
        d3DonutChart('fnrCategoryPie', catData, { colors: ['#7c3aed', '#06b6d4', '#f97316', '#10b981'] });
    } else {
        document.getElementById('fnrCategoryPie').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No data</p>';
    }

    // Engel outcome pie
    var engelCounts = {};
    pts.forEach(function (p) {
        if (p.engel_class) {
            var ec = String(p.engel_class).toUpperCase();
            engelCounts[ec] = (engelCounts[ec] || 0) + 1;
        }
    });
    var engelData = Object.keys(engelCounts).sort().map(function (k) { return { label: 'Engel ' + k, value: engelCounts[k] }; });
    if (engelData.length) {
        d3DonutChart('fnrEngelPie', engelData, { colors: ['#10b981', '#6ee7b7', '#6ee7b7', '#6ee7b7', '#f59e0b', '#f97316', '#ef4444'] });
    } else {
        document.getElementById('fnrEngelPie').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No Engel data</p>';
    }

    // Seizure freedom bar
    var sfByYear = {};
    pts.filter(function (p) { return p.category === 'Epilepsy' && p.surgery_date; }).forEach(function (p) {
        var year = p.surgery_date.substring(0, 4);
        if (!sfByYear[year]) sfByYear[year] = { total: 0, free: 0 };
        sfByYear[year].total++;
        if (p.seizure_free === true || p.engel_class === 'IA') sfByYear[year].free++;
    });
    var sfData = Object.keys(sfByYear).sort().map(function (y) {
        var rate = sfByYear[y].total ? Math.round((sfByYear[y].free / sfByYear[y].total) * 100) : 0;
        return { label: y, value: rate };
    });
    if (sfData.length) {
        d3BarChart('fnrSeizureFreedom', sfData, { color: '#10b981' });
    } else {
        document.getElementById('fnrSeizureFreedom').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No seizure data</p>';
    }

    // DBS improvement bar
    var dbsPts = pts.filter(function (p) { return p.category === 'DBS' && p.updrs_pre != null && p.updrs_post != null && p.updrs_pre > 0; });
    var dbsByTarget = {};
    dbsPts.forEach(function (p) {
        var target = p.dbs_target || 'Unknown';
        if (!dbsByTarget[target]) dbsByTarget[target] = [];
        dbsByTarget[target].push(((p.updrs_pre - p.updrs_post) / p.updrs_pre) * 100);
    });
    var dbsData = Object.keys(dbsByTarget).map(function (t) {
        var avg = dbsByTarget[t].reduce(function (s, v) { return s + v; }, 0) / dbsByTarget[t].length;
        return { label: t, value: Math.round(avg) };
    });
    if (dbsData.length) {
        d3BarChart('fnrDBSImprovement', dbsData, { color: '#06b6d4' });
    } else {
        document.getElementById('fnrDBSImprovement').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No DBS data</p>';
    }
}

function switchDashCategory(cat) {
    fnrDashCategory = cat;
    var tabs = document.querySelectorAll('.cat-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    var catClass = cat.toLowerCase();
    var matchingTabs = document.querySelectorAll('.cat-tab.' + catClass);
    for (var j = 0; j < matchingTabs.length; j++) {
        matchingTabs[j].classList.add('active');
    }
}

/* ================================================
   5. EPILEPSY LIST
   ================================================ */
async function renderEpilepsyList() {
    var pts = fnrPatients.length ? fnrPatients : await fnrFetchAllPatients();
    var epilepsy = pts.filter(function (p) { return p.category === 'Epilepsy'; });

    var total = epilepsy.length;
    var seizureFree = epilepsy.filter(function (p) { return p.seizure_free === true || p.engel_class === 'IA'; }).length;
    var withMonitoring = epilepsy.filter(function (p) { return p.intracranial_monitoring && p.intracranial_monitoring !== 'Not done'; }).length;
    var sfRate = total ? ((seizureFree / total) * 100).toFixed(0) + '%' : 'N/A';

    var cardsEl = document.getElementById('epilepsyStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-wave-square', total, 'Total Epilepsy', 'accent-purple') +
            _statCard('fa-star', seizureFree, 'Seizure Free', 'accent-green') +
            _statCard('fa-percentage', sfRate, 'Freedom Rate', 'accent-cyan') +
            _statCard('fa-brain', withMonitoring, 'Intracranial Monitoring', 'accent-amber');
    }

    // Engel distribution chart
    var engelCounts = {};
    epilepsy.forEach(function (p) {
        var ec = p.engel_class || 'Unknown';
        engelCounts[ec] = (engelCounts[ec] || 0) + 1;
    });
    var engelData = Object.keys(engelCounts).sort().map(function (k) { return { label: k, value: engelCounts[k] }; });
    if (engelData.length) {
        d3BarChart('epilepsyEngelChart', engelData, { colors: ['#10b981', '#6ee7b7', '#6ee7b7', '#6ee7b7', '#f59e0b', '#f97316', '#ef4444', '#666680'] });
    }

    // Table
    var tbody = document.getElementById('epilepsyTbody');
    if (!tbody) return;
    if (!epilepsy.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted);">No epilepsy patients found.</td></tr>';
        return;
    }
    var html = '';
    epilepsy.forEach(function (p) {
        var sfText = (p.seizure_free === true || p.engel_class === 'IA') ? '<span style="color:#10b981;font-weight:600">Yes</span>' : '<span style="color:#ef4444">No</span>';
        html += '<tr class="clickable-row" onclick="openFNRPatientDetail(\'' + _esc(p.study_id) + '\')">' +
            '<td style="color:var(--accent-primary);font-weight:600">' + _esc(p.study_id) + '</td>' +
            '<td>' + _esc(String(p.age_at_surgery || '')) + '</td>' +
            '<td>' + _esc(p.sex || '') + '</td>' +
            '<td>' + _esc(p.epilepsy_type || '') + '</td>' +
            '<td>' + _esc(p.seizure_onset_zone || '') + '</td>' +
            '<td>' + _esc(p.procedure_type || '') + '</td>' +
            '<td>' + engelBadge(p.engel_class) + '</td>' +
            '<td>' + sfText + '</td></tr>';
    });
    tbody.innerHTML = html;
}

/* ================================================
   6. DBS LIST
   ================================================ */
async function renderDBSList() {
    var pts = fnrPatients.length ? fnrPatients : await fnrFetchAllPatients();
    var dbsPts = pts.filter(function (p) { return p.category === 'DBS'; });

    var total = dbsPts.length;
    var withImprovement = dbsPts.filter(function (p) { return p.updrs_pre != null && p.updrs_post != null; });
    var avgImprove = 'N/A';
    if (withImprovement.length) {
        var totalPct = withImprovement.reduce(function (s, p) {
            return s + ((p.updrs_pre - p.updrs_post) / p.updrs_pre * 100);
        }, 0);
        avgImprove = (totalPct / withImprovement.length).toFixed(0) + '%';
    }

    var cardsEl = document.getElementById('dbsStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-microchip', total, 'Total DBS', 'accent-cyan') +
            _statCard('fa-chart-line', avgImprove, 'Avg UPDRS Improvement', 'accent-green') +
            _statCard('fa-clipboard-check', withImprovement.length, 'With Outcome Data', 'accent-purple');
    }

    // UPDRS by target chart
    var byTarget = {};
    dbsPts.forEach(function (p) {
        var t = p.dbs_target || 'Unknown';
        if (!byTarget[t]) byTarget[t] = [];
        if (p.updrs_pre != null && p.updrs_post != null && p.updrs_pre > 0) {
            byTarget[t].push(((p.updrs_pre - p.updrs_post) / p.updrs_pre) * 100);
        }
    });
    var targetData = Object.keys(byTarget).filter(function (t) { return byTarget[t].length > 0; }).map(function (t) {
        var avg = byTarget[t].reduce(function (s, v) { return s + v; }, 0) / byTarget[t].length;
        return { label: t + ' (n=' + byTarget[t].length + ')', value: Math.round(avg) };
    });
    if (targetData.length) {
        d3BarChart('dbsUPDRSChart', targetData, { color: '#06b6d4' });
    } else {
        document.getElementById('dbsUPDRSChart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No UPDRS data</p>';
    }

    // Table
    var tbody = document.getElementById('dbsTbody');
    if (!tbody) return;
    if (!dbsPts.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted);">No DBS patients found.</td></tr>';
        return;
    }
    var html = '';
    dbsPts.forEach(function (p) {
        html += '<tr class="clickable-row" onclick="openFNRPatientDetail(\'' + _esc(p.study_id) + '\')">' +
            '<td style="color:var(--accent-primary);font-weight:600">' + _esc(p.study_id) + '</td>' +
            '<td>' + _esc(String(p.age_at_surgery || '')) + '</td>' +
            '<td>' + _esc(p.sex || '') + '</td>' +
            '<td>' + _esc(p.dbs_indication || '') + '</td>' +
            '<td>' + _esc(p.dbs_target || '') + '</td>' +
            '<td>' + _esc(p.device_manufacturer || '') + ' ' + _esc(p.device_model || '') + '</td>' +
            '<td>' + _esc(String(p.updrs_pre != null ? p.updrs_pre : '')) + '</td>' +
            '<td>' + _esc(String(p.updrs_post != null ? p.updrs_post : '')) + '</td>' +
            '<td>' + updrsImprovement(p.updrs_pre, p.updrs_post) + '</td></tr>';
    });
    tbody.innerHTML = html;
}

/* ================================================
   7. PAIN LIST
   ================================================ */
async function renderPainList() {
    var pts = fnrPatients.length ? fnrPatients : await fnrFetchAllPatients();
    var painPts = pts.filter(function (p) { return p.category === 'Pain'; });

    var total = painPts.length;
    var withVAS = painPts.filter(function (p) { return p.vas_pre != null && p.vas_post != null; });
    var avgReduction = 'N/A';
    if (withVAS.length) {
        var totalRedux = withVAS.reduce(function (s, p) { return s + (p.vas_pre - p.vas_post); }, 0);
        avgReduction = (totalRedux / withVAS.length).toFixed(1);
    }

    var cardsEl = document.getElementById('painStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-fire', total, 'Total Pain', 'accent-amber') +
            _statCard('fa-chart-line', avgReduction, 'Avg VAS Reduction', 'accent-green') +
            _statCard('fa-clipboard-check', withVAS.length, 'With VAS Data', 'accent-cyan');
    }

    // VAS chart
    var vasByProc = {};
    painPts.forEach(function (p) {
        var proc = p.procedure_type || 'Unknown';
        if (!vasByProc[proc]) vasByProc[proc] = { pre: [], post: [] };
        if (p.vas_pre != null) vasByProc[proc].pre.push(p.vas_pre);
        if (p.vas_post != null) vasByProc[proc].post.push(p.vas_post);
    });
    var vasData = Object.keys(vasByProc).filter(function (pr) { return vasByProc[pr].pre.length > 0; }).map(function (pr) {
        var avgPre = vasByProc[pr].pre.reduce(function (s, v) { return s + v; }, 0) / vasByProc[pr].pre.length;
        var avgPost = vasByProc[pr].post.length ? vasByProc[pr].post.reduce(function (s, v) { return s + v; }, 0) / vasByProc[pr].post.length : avgPre;
        return { label: pr, value: Math.round((avgPre - avgPost) * 10) / 10 };
    });
    if (vasData.length) {
        d3BarChart('painVASChart', vasData, { color: '#f97316' });
    } else {
        document.getElementById('painVASChart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No VAS data</p>';
    }

    // Table
    var tbody = document.getElementById('painTbody');
    if (!tbody) return;
    if (!painPts.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted);">No pain patients found.</td></tr>';
        return;
    }
    var html = '';
    painPts.forEach(function (p) {
        var reduction = (p.vas_pre != null && p.vas_post != null) ? (p.vas_pre - p.vas_post).toFixed(1) : 'N/A';
        html += '<tr class="clickable-row" onclick="openFNRPatientDetail(\'' + _esc(p.study_id) + '\')">' +
            '<td style="color:var(--accent-primary);font-weight:600">' + _esc(p.study_id) + '</td>' +
            '<td>' + _esc(String(p.age_at_surgery || '')) + '</td>' +
            '<td>' + _esc(p.sex || '') + '</td>' +
            '<td>' + _esc(p.pain_diagnosis || '') + '</td>' +
            '<td>' + _esc(p.pain_location || '') + '</td>' +
            '<td>' + _esc(p.procedure_type || '') + '</td>' +
            '<td>' + vasBadge(p.vas_pre) + '</td>' +
            '<td>' + vasBadge(p.vas_post) + '</td>' +
            '<td>' + _esc(String(reduction)) + '</td></tr>';
    });
    tbody.innerHTML = html;
}

/* ================================================
   8. ADD PATIENT WIZARD
   ================================================ */
var fnrWizardStep = 1;
var fnrWizardTotalSteps = 5;

function fnrWizardNext() {
    if (fnrWizardStep >= fnrWizardTotalSteps) return;
    fnrSetWizardStep(fnrWizardStep + 1);
}
function fnrWizardPrev() {
    if (fnrWizardStep <= 1) return;
    fnrSetWizardStep(fnrWizardStep - 1);
}

function fnrSetWizardStep(step) {
    fnrWizardStep = step;
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
    document.getElementById('fnrWizPrev').disabled = step === 1;
    document.getElementById('fnrWizNext').style.display = step === fnrWizardTotalSteps ? 'none' : '';
    document.getElementById('fnrWizSubmit').style.display = step === fnrWizardTotalSteps ? '' : 'none';
}

function fnrCategoryChanged() {
    var cat = document.getElementById('fnrAddCategory').value;
    var sections = ['fnrHistEpilepsy', 'fnrHistDBS', 'fnrHistPain', 'fnrHistSpasticity', 'fnrHistNone',
                    'fnrEvalEpilepsy', 'fnrEvalDBS', 'fnrEvalPain', 'fnrEvalSpasticity', 'fnrEvalNone'];
    for (var i = 0; i < sections.length; i++) {
        var el = document.getElementById(sections[i]);
        if (el) el.classList.remove('active');
    }

    if (cat === 'Epilepsy') {
        document.getElementById('fnrHistEpilepsy').classList.add('active');
        document.getElementById('fnrEvalEpilepsy').classList.add('active');
    } else if (cat === 'DBS') {
        document.getElementById('fnrHistDBS').classList.add('active');
        document.getElementById('fnrEvalDBS').classList.add('active');
    } else if (cat === 'Pain') {
        document.getElementById('fnrHistPain').classList.add('active');
        document.getElementById('fnrEvalPain').classList.add('active');
    } else if (cat === 'Spasticity') {
        document.getElementById('fnrHistSpasticity').classList.add('active');
        document.getElementById('fnrEvalSpasticity').classList.add('active');
    } else {
        document.getElementById('fnrHistNone').classList.add('active');
        document.getElementById('fnrEvalNone').classList.add('active');
    }
}

async function fnrAutoGenerateStudyId() {
    var { data } = await _sb.from('fnr_patients').select('study_id').order('study_id', { ascending: false }).limit(1);
    var nextNum = 1;
    if (data && data.length && data[0].study_id) {
        var match = data[0].study_id.match(/FNR-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
    }
    var id = 'FNR-' + String(nextNum).padStart(4, '0');
    document.getElementById('fnrAddStudyId').value = id;
}

async function fnrSubmitNewPatient() {
    var studyId = document.getElementById('fnrAddStudyId').value.trim();
    if (!studyId) { fnrToast('Study ID is required', 'error'); return; }

    var cat = document.getElementById('fnrAddCategory').value;
    if (!cat) { fnrToast('Category is required', 'error'); return; }

    var patient = {
        study_id: studyId,
        category: cat,
        age_at_surgery: document.getElementById('fnrAddAge').value ? parseInt(document.getElementById('fnrAddAge').value) : null,
        sex: document.getElementById('fnrAddSex').value || null,
        race: document.getElementById('fnrAddRace').value || null,
        ethnicity: document.getElementById('fnrAddEthnicity').value || null,
        referring_physician: document.getElementById('fnrAddReferring').value.trim() || null,
        surgery_date: document.getElementById('fnrAddSurgDate').value || null,
        surgeon: document.getElementById('fnrAddSurgeon').value.trim() || null,
        procedure_type: document.getElementById('fnrAddProcedure').value || null,
        laterality: document.getElementById('fnrAddLaterality').value || null,
        surgical_target: document.getElementById('fnrAddTarget').value.trim() || null,
        approach: document.getElementById('fnrAddApproach').value.trim() || null,
        complications: document.getElementById('fnrAddComplications').value.trim() || null,
        operative_notes: document.getElementById('fnrAddOpNotes').value.trim() || null,
        device_manufacturer: document.getElementById('fnrAddDeviceMfg').value || null,
        device_model: document.getElementById('fnrAddDeviceModel').value.trim() || null,
        device_serial: document.getElementById('fnrAddDeviceSerial').value.trim() || null,
        device_implant_date: document.getElementById('fnrAddDeviceImplantDate').value || null,
        lead_model: document.getElementById('fnrAddLeadModel').value.trim() || null,
        ipg_location: document.getElementById('fnrAddIPGLocation').value.trim() || null,
        battery_status: document.getElementById('fnrAddBatteryStatus').value || null,
        device_status: document.getElementById('fnrAddDeviceStatus').value || null
    };

    // Category-specific fields
    if (cat === 'Epilepsy') {
        patient.epilepsy_type = document.getElementById('fnrAddEpilepsyType').value || null;
        patient.seizure_onset_age = document.getElementById('fnrAddSeizureOnsetAge').value ? parseInt(document.getElementById('fnrAddSeizureOnsetAge').value) : null;
        patient.seizure_frequency = document.getElementById('fnrAddSeizureFreq').value ? parseInt(document.getElementById('fnrAddSeizureFreq').value) : null;
        patient.failed_aeds = document.getElementById('fnrAddFailedAEDs').value ? parseInt(document.getElementById('fnrAddFailedAEDs').value) : null;
        patient.seizure_semiology = document.getElementById('fnrAddSemiology').value.trim() || null;
        patient.etiology = document.getElementById('fnrAddEtiology').value || null;
        patient.scalp_eeg = document.getElementById('fnrAddScalpEEG').value || null;
        patient.eeg_localization = document.getElementById('fnrAddEEGLocalization').value.trim() || null;
        patient.mri_findings = document.getElementById('fnrAddMRIFindings').value || null;
        patient.pet_findings = document.getElementById('fnrAddPET').value || null;
        patient.wada_test = document.getElementById('fnrAddWada').value || null;
        patient.neuropsych = document.getElementById('fnrAddNeuropsych').value || null;
        patient.intracranial_monitoring = document.getElementById('fnrAddIntracranial').value || null;
        patient.seizure_onset_zone = document.getElementById('fnrAddSOZ').value.trim() || null;
    } else if (cat === 'DBS') {
        patient.dbs_indication = document.getElementById('fnrAddDBSIndication').value || null;
        patient.disease_duration = document.getElementById('fnrAddDiseaseDuration').value ? parseInt(document.getElementById('fnrAddDiseaseDuration').value) : null;
        patient.updrs_pre = document.getElementById('fnrAddUPDRSPre').value ? parseFloat(document.getElementById('fnrAddUPDRSPre').value) : null;
        patient.hoehn_yahr = document.getElementById('fnrAddHY').value || null;
        patient.ldopa_response = document.getElementById('fnrAddLDopaResponse').value ? parseFloat(document.getElementById('fnrAddLDopaResponse').value) : null;
        patient.dbs_neuropsych = document.getElementById('fnrAddDBSNeuropsych').value || null;
        patient.dbs_mri = document.getElementById('fnrAddDBSMRI').value || null;
        // Extract target from procedure
        var proc = patient.procedure_type || '';
        if (proc.indexOf('STN') !== -1) patient.dbs_target = 'STN';
        else if (proc.indexOf('GPi') !== -1) patient.dbs_target = 'GPi';
        else if (proc.indexOf('VIM') !== -1) patient.dbs_target = 'VIM';
        else if (proc.indexOf('ANT') !== -1) patient.dbs_target = 'ANT';
    } else if (cat === 'Pain') {
        patient.pain_diagnosis = document.getElementById('fnrAddPainDiagnosis').value || null;
        patient.pain_duration = document.getElementById('fnrAddPainDuration').value ? parseInt(document.getElementById('fnrAddPainDuration').value) : null;
        patient.pain_location = document.getElementById('fnrAddPainLocation').value.trim() || null;
        patient.vas_pre = document.getElementById('fnrAddVASPre').value ? parseFloat(document.getElementById('fnrAddVASPre').value) : null;
        patient.pain_psych_eval = document.getElementById('fnrAddPainPsych').value || null;
        patient.prior_interventions = document.getElementById('fnrAddPriorInterventions').value.trim() || null;
    } else if (cat === 'Spasticity') {
        patient.spasticity_etiology = document.getElementById('fnrAddSpasticityEtiology').value || null;
        patient.ashworth_pre = document.getElementById('fnrAddAshworthPre').value ? parseFloat(document.getElementById('fnrAddAshworthPre').value) : null;
        patient.spasticity_distribution = document.getElementById('fnrAddSpasticityDist').value || null;
        patient.baclofen_trial = document.getElementById('fnrAddBaclofenTrial').value || null;
    }

    var { data, error } = await _sb.from('fnr_patients').insert([patient]).select();
    if (error) {
        fnrToast('Error saving patient: ' + error.message, 'error');
        return;
    }
    fnrToast('Patient ' + studyId + ' saved successfully!', 'success');
    fnrSetWizardStep(1);
    document.querySelectorAll('#fnr-add input, #fnr-add select, #fnr-add textarea').forEach(function (el) {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
    });
    fnrCategoryChanged();
    await fnrFetchAllPatients();
}

/* ================================================
   9. PATIENT DETAIL
   ================================================ */
async function openFNRPatientDetail(studyId) {
    fnrNavigate('fnr-detail');
    var container = document.getElementById('fnrDetailContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:60px"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#7c3aed"></i><p style="color:#9999b8;margin-top:10px">Loading patient...</p></div>';

    var { data: patient, error } = await _sb.from('fnr_patients').select('*').eq('study_id', studyId).single();
    if (error || !patient) {
        container.innerHTML = '<div class="detail-placeholder"><i class="fas fa-exclamation-circle"></i><p>Patient not found</p></div>';
        return;
    }
    fnrCurrentPatient = patient;
    var pid = patient.id;

    // Fetch related data in parallel
    var programmingP = _sb.from('fnr_device_programming').select('*').eq('patient_id', pid).order('session_date', { ascending: false });
    var seizureP = _sb.from('fnr_seizure_logs').select('*').eq('patient_id', pid).order('month_year', { ascending: true });
    var medsP = _sb.from('fnr_medications').select('*').eq('patient_id', pid).order('start_date', { ascending: false });
    var outcomesP = _sb.from('fnr_outcome_assessments').select('*').eq('patient_id', pid).order('assessment_date', { ascending: false });
    var followupsP = _sb.from('fnr_follow_ups').select('*').eq('patient_id', pid).order('visit_date', { ascending: false });
    var neuroP = _sb.from('fnr_neurophysiology').select('*').eq('patient_id', pid).order('study_date', { ascending: false });

    var results = await Promise.all([programmingP, seizureP, medsP, outcomesP, followupsP, neuroP]);
    var programming = results[0].data || [];
    var seizureLogs = results[1].data || [];
    var medications = results[2].data || [];
    var outcomes = results[3].data || [];
    var followups = results[4].data || [];
    var neurophysiology = results[5].data || [];

    var p = patient;
    var html = '';

    // Header
    html += '<div class="detail-header">';
    html += '<div class="detail-header-left">';
    html += '<h2>' + _esc(p.study_id) + '</h2>';
    html += '<div class="detail-subtitle">' + categoryBadge(p.category) + ' &bull; ' + _esc(p.procedure_type || 'No procedure') + ' &bull; ' + _esc(p.surgeon || '') + '</div>';
    html += '</div>';
    html += '<div class="detail-header-right">';
    html += '<button class="btn btn-outline" onclick="fnrShowEditModal()"><i class="fas fa-edit"></i> Edit</button>';
    html += '<button class="btn btn-accent" onclick="fnrShowAddOutcomeModal(\'' + _esc(p.study_id) + '\')"><i class="fas fa-plus"></i> Add Outcome</button>';
    html += '</div></div>';

    // Tabs
    html += '<div class="detail-tabs">';
    var tabs = ['Overview', 'Evaluation', 'Surgery', 'Device/Programming', 'Medications', 'Outcomes', 'Follow-up'];
    tabs.forEach(function (t, i) {
        html += '<button class="detail-tab' + (i === 0 ? ' active' : '') + '" onclick="fnrSwitchDetailTab(' + i + ')" data-idx="' + i + '">' + t + '</button>';
    });
    html += '</div>';

    // Tab 0: Overview
    html += '<div class="detail-tab-panel active" data-idx="0">';
    html += '<div class="detail-section"><h4><i class="fas fa-user"></i> Demographics</h4><div class="detail-grid">';
    html += _detailField('Age at Surgery', p.age_at_surgery) + _detailField('Sex', p.sex) + _detailField('Race', p.race) + _detailField('Ethnicity', p.ethnicity) + _detailField('Referring Physician', p.referring_physician);
    html += '</div></div>';
    html += '<div class="detail-section"><h4><i class="fas fa-bolt"></i> Category Details</h4><div class="detail-grid">';
    html += _detailField('Category', p.category) + _detailField('Procedure', p.procedure_type) + _detailField('Laterality', p.laterality) + _detailField('Target/Site', p.surgical_target);
    if (p.category === 'Epilepsy') {
        html += _detailField('Epilepsy Type', p.epilepsy_type) + _detailField('Etiology', p.etiology) + _detailField('Engel Class', p.engel_class) + _detailField('Seizure Free', p.seizure_free ? 'Yes' : 'No');
    } else if (p.category === 'DBS') {
        html += _detailField('Indication', p.dbs_indication) + _detailField('DBS Target', p.dbs_target) + _detailField('UPDRS Pre', p.updrs_pre) + _detailField('UPDRS Post', p.updrs_post);
    } else if (p.category === 'Pain') {
        html += _detailField('Pain Diagnosis', p.pain_diagnosis) + _detailField('Pain Location', p.pain_location) + _detailField('VAS Pre', p.vas_pre) + _detailField('VAS Post', p.vas_post);
    } else if (p.category === 'Spasticity') {
        html += _detailField('Etiology', p.spasticity_etiology) + _detailField('Distribution', p.spasticity_distribution) + _detailField('Ashworth Pre', p.ashworth_pre) + _detailField('Ashworth Post', p.ashworth_post);
    }
    html += '</div></div></div>';

    // Tab 1: Evaluation
    html += '<div class="detail-tab-panel" data-idx="1">';
    if (p.category === 'Epilepsy') {
        html += '<div class="detail-section"><h4><i class="fas fa-brain"></i> Epilepsy Evaluation</h4><div class="detail-grid">';
        html += _detailField('Scalp EEG', p.scalp_eeg) + _detailField('EEG Localization', p.eeg_localization) + _detailField('MRI Findings', p.mri_findings) + _detailField('PET Findings', p.pet_findings);
        html += _detailField('Wada Test', p.wada_test) + _detailField('Neuropsych', p.neuropsych) + _detailField('Intracranial Monitoring', p.intracranial_monitoring) + _detailField('Seizure Onset Zone', p.seizure_onset_zone);
        html += _detailField('Seizure Onset Age', p.seizure_onset_age) + _detailField('Seizure Frequency', p.seizure_frequency ? p.seizure_frequency + '/mo' : null) + _detailField('Failed AEDs', p.failed_aeds) + _detailField('Semiology', p.seizure_semiology);
        html += '</div></div>';
    } else if (p.category === 'DBS') {
        html += '<div class="detail-section"><h4><i class="fas fa-stethoscope"></i> DBS Evaluation</h4><div class="detail-grid">';
        html += _detailField('Disease Duration', p.disease_duration ? p.disease_duration + ' years' : null) + _detailField('Hoehn & Yahr', p.hoehn_yahr) + _detailField('L-Dopa Response', p.ldopa_response ? p.ldopa_response + '%' : null);
        html += _detailField('Neuropsych', p.dbs_neuropsych) + _detailField('MRI', p.dbs_mri);
        html += '</div></div>';
    } else if (p.category === 'Pain') {
        html += '<div class="detail-section"><h4><i class="fas fa-stethoscope"></i> Pain Evaluation</h4><div class="detail-grid">';
        html += _detailField('Pain Duration', p.pain_duration ? p.pain_duration + ' years' : null) + _detailField('Psych Eval', p.pain_psych_eval) + _detailField('Prior Interventions', p.prior_interventions);
        html += '</div></div>';
    } else if (p.category === 'Spasticity') {
        html += '<div class="detail-section"><h4><i class="fas fa-stethoscope"></i> Spasticity Evaluation</h4><div class="detail-grid">';
        html += _detailField('Baclofen Trial', p.baclofen_trial);
        html += '</div></div>';
    }
    // Neurophysiology
    html += '<div class="detail-section"><h4><i class="fas fa-wave-square"></i> Neurophysiology Studies</h4>';
    if (neurophysiology.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Type</th><th>Findings</th></tr></thead><tbody>';
        neurophysiology.forEach(function (n) {
            html += '<tr><td>' + _esc(n.study_date || '') + '</td><td>' + _esc(n.study_type || '') + '</td><td>' + _esc(n.findings || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No neurophysiology studies</p>'; }
    html += '</div></div>';

    // Tab 2: Surgery
    html += '<div class="detail-tab-panel" data-idx="2">';
    html += '<div class="detail-section"><h4><i class="fas fa-cut"></i> Surgery Details</h4><div class="detail-grid">';
    html += _detailField('Date', p.surgery_date) + _detailField('Procedure', p.procedure_type) + _detailField('Surgeon', p.surgeon) + _detailField('Laterality', p.laterality);
    html += _detailField('Target/Site', p.surgical_target) + _detailField('Approach', p.approach) + _detailField('Complications', p.complications);
    html += '</div></div>';
    if (p.operative_notes) {
        html += '<div class="detail-section"><h4><i class="fas fa-file-medical"></i> Operative Notes</h4><p style="color:var(--text-secondary);font-size:0.85rem;white-space:pre-wrap">' + _esc(p.operative_notes) + '</p></div>';
    }
    html += '</div>';

    // Tab 3: Device/Programming
    html += '<div class="detail-tab-panel" data-idx="3">';
    html += '<div class="detail-section"><h4><i class="fas fa-microchip"></i> Device Information</h4><div class="detail-grid">';
    html += _detailField('Manufacturer', p.device_manufacturer) + _detailField('Model', p.device_model) + _detailField('Serial #', p.device_serial) + _detailField('Implant Date', p.device_implant_date);
    html += _detailField('Lead Model', p.lead_model) + _detailField('IPG Location', p.ipg_location);
    html += '<div class="detail-field"><div class="df-label">Battery Status</div><div class="df-value">' + deviceStatusBadge(p.battery_status) + '</div></div>';
    html += '<div class="detail-field"><div class="df-label">Device Status</div><div class="df-value">' + deviceStatusBadge(p.device_status) + '</div></div>';
    html += '</div></div>';

    html += '<div class="detail-section"><h4><i class="fas fa-sliders-h"></i> Programming History</h4>';
    html += '<button class="btn btn-sm btn-accent" style="margin-bottom:12px" onclick="fnrShowAddProgrammingModalForPatient(' + pid + ')"><i class="fas fa-plus"></i> Add Session</button>';
    if (programming.length) {
        html += '<div class="programming-timeline">';
        programming.forEach(function (pg) {
            html += '<div class="programming-entry">';
            html += '<div class="prog-header"><span style="color:var(--accent-primary);font-weight:600">' + _esc(pg.session_date || 'No date') + '</span>' +
                '<span class="badge badge-gray">' + _esc(pg.device_type || '') + '</span></div>';
            html += '<div class="prog-params">';
            html += '<div class="prog-param"><div class="param-label">Amplitude</div><div class="param-value">' + _esc(String(pg.amplitude || 'N/A')) + (pg.amplitude ? ' mA' : '') + '</div></div>';
            html += '<div class="prog-param"><div class="param-label">Pulse Width</div><div class="param-value">' + _esc(String(pg.pulse_width || 'N/A')) + (pg.pulse_width ? ' \u00b5s' : '') + '</div></div>';
            html += '<div class="prog-param"><div class="param-label">Frequency</div><div class="param-value">' + _esc(String(pg.frequency || 'N/A')) + (pg.frequency ? ' Hz' : '') + '</div></div>';
            html += '<div class="prog-param"><div class="param-label">Contacts</div><div class="param-value">' + _esc(String(pg.contacts || 'N/A')) + '</div></div>';
            html += '<div class="prog-param"><div class="param-label">Impedance</div><div class="param-value">' + _esc(String(pg.impedance || 'N/A')) + (pg.impedance ? ' \u03a9' : '') + '</div></div>';
            html += '</div>';
            if (pg.notes) html += '<p style="color:var(--text-secondary);font-size:0.78rem;margin-top:6px">' + _esc(pg.notes) + '</p>';
            html += '</div>';
        });
        html += '</div>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No programming sessions</p>'; }
    html += '</div></div>';

    // Tab 4: Medications
    html += '<div class="detail-tab-panel" data-idx="4">';
    html += '<div class="detail-section"><h4><i class="fas fa-pills"></i> Medications</h4>';
    html += '<button class="btn btn-sm btn-accent" style="margin-bottom:12px" onclick="fnrShowAddMedModal(' + pid + ')"><i class="fas fa-plus"></i> Add Medication</button>';
    if (medications.length) {
        html += '<table class="btr-table"><thead><tr><th>Medication</th><th>Type</th><th>Dose</th><th>Start Date</th><th>End Date</th><th>Status</th></tr></thead><tbody>';
        medications.forEach(function (m) {
            var statusCls = m.end_date ? 'badge-gray' : 'badge-green';
            var statusText = m.end_date ? 'Discontinued' : 'Active';
            html += '<tr><td style="font-weight:600">' + _esc(m.medication_name || '') + '</td><td>' + _esc(m.medication_type || '') + '</td><td>' + _esc(m.dose || '') + '</td><td>' + _esc(m.start_date || '') + '</td><td>' + _esc(m.end_date || 'Current') + '</td><td><span class="badge ' + statusCls + '">' + statusText + '</span></td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No medications recorded</p>'; }
    html += '</div>';
    // Seizure logs
    if (p.category === 'Epilepsy') {
        html += '<div class="detail-section"><h4><i class="fas fa-chart-area"></i> Seizure Log</h4>';
        html += '<button class="btn btn-sm btn-accent" style="margin-bottom:12px" onclick="fnrShowAddSeizureLogModal(' + pid + ')"><i class="fas fa-plus"></i> Add Entry</button>';
        if (seizureLogs.length) {
            html += '<table class="btr-table"><thead><tr><th>Month</th><th>Seizure Count</th><th>Notes</th></tr></thead><tbody>';
            seizureLogs.forEach(function (sl) {
                html += '<tr><td>' + _esc(sl.month_year || '') + '</td><td>' + _esc(String(sl.seizure_count != null ? sl.seizure_count : '')) + '</td><td>' + _esc(sl.notes || '') + '</td></tr>';
            });
            html += '</tbody></table>';
        } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No seizure log entries</p>'; }
        html += '</div>';
    }
    html += '</div>';

    // Tab 5: Outcomes
    html += '<div class="detail-tab-panel" data-idx="5">';
    html += '<div class="detail-section"><h4><i class="fas fa-trophy"></i> Outcome Assessments</h4>';
    html += '<button class="btn btn-sm btn-accent" style="margin-bottom:12px" onclick="fnrShowAddOutcomeModal(\'' + _esc(p.study_id) + '\')"><i class="fas fa-plus"></i> Add Assessment</button>';
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
    html += '<button class="btn btn-sm btn-accent" style="margin-bottom:12px" onclick="fnrShowAddFollowUpModal(' + pid + ')"><i class="fas fa-plus"></i> Add Visit</button>';
    if (followups.length) {
        html += '<table class="btr-table"><thead><tr><th>Date</th><th>Type</th><th>Notes</th></tr></thead><tbody>';
        followups.forEach(function (f) {
            html += '<tr><td>' + _esc(f.visit_date || '') + '</td><td>' + _esc(f.visit_type || '') + '</td><td>' + _esc(f.notes || '') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else { html += '<p style="color:var(--text-muted);font-size:0.85rem">No follow-up visits</p>'; }
    html += '</div></div>';

    container.innerHTML = html;
}

function fnrSwitchDetailTab(idx) {
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
function fnrShowEditModal() {
    if (!fnrCurrentPatient) return;
    var p = fnrCurrentPatient;
    var body = '<div class="form-row">' +
        '<div class="form-group"><label>Engel Class</label><select id="fnrEditEngel"><option value="">N/A</option><option value="IA"' + (p.engel_class === 'IA' ? ' selected' : '') + '>IA</option><option value="IB"' + (p.engel_class === 'IB' ? ' selected' : '') + '>IB</option><option value="IC"' + (p.engel_class === 'IC' ? ' selected' : '') + '>IC</option><option value="ID"' + (p.engel_class === 'ID' ? ' selected' : '') + '>ID</option><option value="II"' + (p.engel_class === 'II' ? ' selected' : '') + '>II</option><option value="III"' + (p.engel_class === 'III' ? ' selected' : '') + '>III</option><option value="IV"' + (p.engel_class === 'IV' ? ' selected' : '') + '>IV</option></select></div>' +
        '<div class="form-group"><label>Seizure Free</label><select id="fnrEditSeizureFree"><option value="">N/A</option><option value="true"' + (p.seizure_free === true ? ' selected' : '') + '>Yes</option><option value="false"' + (p.seizure_free === false ? ' selected' : '') + '>No</option></select></div></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>UPDRS Post-op</label><input type="number" id="fnrEditUPDRSPost" value="' + _esc(String(p.updrs_post || '')) + '"></div>' +
        '<div class="form-group"><label>VAS Post-op</label><input type="number" id="fnrEditVASPost" value="' + _esc(String(p.vas_post || '')) + '" min="0" max="10"></div></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Ashworth Post-op</label><input type="number" id="fnrEditAshworthPost" value="' + _esc(String(p.ashworth_post || '')) + '" min="0" max="4" step="0.5"></div>' +
        '<div class="form-group"><label>Device Status</label><select id="fnrEditDeviceStatus"><option value="">N/A</option><option value="Active"' + (p.device_status === 'Active' ? ' selected' : '') + '>Active</option><option value="Inactive"' + (p.device_status === 'Inactive' ? ' selected' : '') + '>Inactive</option><option value="Replaced"' + (p.device_status === 'Replaced' ? ' selected' : '') + '>Replaced</option><option value="Explanted"' + (p.device_status === 'Explanted' ? ' selected' : '') + '>Explanted</option></select></div></div>' +
        '<div class="form-group"><label>Battery Status</label><select id="fnrEditBattery"><option value="">N/A</option><option value="Full"' + (p.battery_status === 'Full' ? ' selected' : '') + '>Full</option><option value="Adequate"' + (p.battery_status === 'Adequate' ? ' selected' : '') + '>Adequate</option><option value="Low"' + (p.battery_status === 'Low' ? ' selected' : '') + '>Low</option><option value="ERI"' + (p.battery_status === 'ERI' ? ' selected' : '') + '>ERI</option><option value="Rechargeable"' + (p.battery_status === 'Rechargeable' ? ' selected' : '') + '>Rechargeable</option></select></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="fnrSaveEdit()"><i class="fas fa-save"></i> Save</button></div>';
    openFnrModal('Edit Patient - ' + p.study_id, body);
}

async function fnrSaveEdit() {
    if (!fnrCurrentPatient) return;
    var updates = {
        engel_class: document.getElementById('fnrEditEngel').value || null,
        seizure_free: document.getElementById('fnrEditSeizureFree').value === 'true' ? true : document.getElementById('fnrEditSeizureFree').value === 'false' ? false : null,
        updrs_post: document.getElementById('fnrEditUPDRSPost').value ? parseFloat(document.getElementById('fnrEditUPDRSPost').value) : null,
        vas_post: document.getElementById('fnrEditVASPost').value ? parseFloat(document.getElementById('fnrEditVASPost').value) : null,
        ashworth_post: document.getElementById('fnrEditAshworthPost').value ? parseFloat(document.getElementById('fnrEditAshworthPost').value) : null,
        device_status: document.getElementById('fnrEditDeviceStatus').value || null,
        battery_status: document.getElementById('fnrEditBattery').value || null
    };
    var { error } = await _sb.from('fnr_patients').update(updates).eq('id', fnrCurrentPatient.id);
    if (error) { fnrToast('Error: ' + error.message, 'error'); return; }
    fnrToast('Patient updated', 'success');
    closeFnrModal();
    await fnrFetchAllPatients();
    openFNRPatientDetail(fnrCurrentPatient.study_id);
}

/* ================================================
   10. CRUD MODALS FOR SUB-TABLES
   ================================================ */

/* --- Add Programming Session --- */
function fnrShowAddProgrammingModal() {
    var body = '<div class="form-group"><label>Patient Study ID</label><input type="text" id="progPatientId" placeholder="FNR-XXXX"></div>' +
        fnrProgrammingFormFields() +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="fnrSaveProgramming()"><i class="fas fa-save"></i> Save</button></div>';
    openFnrModal('Add Programming Session', body);
}

function fnrShowAddProgrammingModalForPatient(patientId) {
    var body = '<input type="hidden" id="progPatientDbId" value="' + patientId + '">' +
        fnrProgrammingFormFields() +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="fnrSaveProgrammingDirect()"><i class="fas fa-save"></i> Save</button></div>';
    openFnrModal('Add Programming Session', body);
}

function fnrProgrammingFormFields() {
    return '<div class="form-group"><label>Session Date</label><input type="date" id="progDate"></div>' +
        '<div class="form-row"><div class="form-group"><label>Device Type</label><select id="progDeviceType"><option value="">Select</option><option value="DBS">DBS</option><option value="RNS">RNS</option><option value="VNS">VNS</option><option value="SCS">SCS</option></select></div>' +
        '<div class="form-group"><label>Amplitude (mA)</label><input type="number" id="progAmplitude" step="0.1" min="0"></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Pulse Width (\u00b5s)</label><input type="number" id="progPulseWidth" min="0"></div>' +
        '<div class="form-group"><label>Frequency (Hz)</label><input type="number" id="progFrequency" min="0"></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Contacts</label><input type="text" id="progContacts" placeholder="e.g. 1-C+, 2-"></div>' +
        '<div class="form-group"><label>Impedance (\u03a9)</label><input type="number" id="progImpedance" min="0"></div></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="progNotes" rows="2"></textarea></div>';
}

async function fnrSaveProgramming() {
    var studyId = document.getElementById('progPatientId').value.trim();
    if (!studyId) { fnrToast('Patient ID required', 'error'); return; }
    var { data: pt } = await _sb.from('fnr_patients').select('id').eq('study_id', studyId).single();
    if (!pt) { fnrToast('Patient not found', 'error'); return; }
    var rec = fnrBuildProgrammingRec(pt.id);
    var { error } = await _sb.from('fnr_device_programming').insert([rec]);
    if (error) { fnrToast('Error: ' + error.message, 'error'); return; }
    fnrToast('Programming session added', 'success');
    closeFnrModal();
    renderDevices();
}

async function fnrSaveProgrammingDirect() {
    var patientId = document.getElementById('progPatientDbId').value;
    var rec = fnrBuildProgrammingRec(parseInt(patientId));
    var { error } = await _sb.from('fnr_device_programming').insert([rec]);
    if (error) { fnrToast('Error: ' + error.message, 'error'); return; }
    fnrToast('Programming session added', 'success');
    closeFnrModal();
    if (fnrCurrentPatient) openFNRPatientDetail(fnrCurrentPatient.study_id);
}

function fnrBuildProgrammingRec(patientId) {
    return {
        patient_id: patientId,
        session_date: document.getElementById('progDate').value || null,
        device_type: document.getElementById('progDeviceType').value || null,
        amplitude: document.getElementById('progAmplitude').value ? parseFloat(document.getElementById('progAmplitude').value) : null,
        pulse_width: document.getElementById('progPulseWidth').value ? parseInt(document.getElementById('progPulseWidth').value) : null,
        frequency: document.getElementById('progFrequency').value ? parseInt(document.getElementById('progFrequency').value) : null,
        contacts: document.getElementById('progContacts').value.trim() || null,
        impedance: document.getElementById('progImpedance').value ? parseInt(document.getElementById('progImpedance').value) : null,
        notes: document.getElementById('progNotes').value.trim() || null
    };
}

/* --- Add Medication --- */
function fnrShowAddMedModal(patientId) {
    var body = '<input type="hidden" id="medPatientId" value="' + patientId + '">' +
        '<div class="form-row"><div class="form-group"><label>Medication Name</label><input type="text" id="medName" placeholder="e.g. Levetiracetam"></div>' +
        '<div class="form-group"><label>Type</label><select id="medType"><option value="">Select</option><option value="AED">AED</option><option value="Dopaminergic">Dopaminergic</option><option value="Pain">Pain Medication</option><option value="Antispasmodic">Antispasmodic</option><option value="Other">Other</option></select></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Dose</label><input type="text" id="medDose" placeholder="e.g. 500mg BID"></div>' +
        '<div class="form-group"><label>Start Date</label><input type="date" id="medStart"></div></div>' +
        '<div class="form-group"><label>End Date (if discontinued)</label><input type="date" id="medEnd"></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="fnrSaveMed()"><i class="fas fa-save"></i> Save</button></div>';
    openFnrModal('Add Medication', body);
}

async function fnrSaveMed() {
    var rec = {
        patient_id: parseInt(document.getElementById('medPatientId').value),
        medication_name: document.getElementById('medName').value.trim(),
        medication_type: document.getElementById('medType').value || null,
        dose: document.getElementById('medDose').value.trim() || null,
        start_date: document.getElementById('medStart').value || null,
        end_date: document.getElementById('medEnd').value || null
    };
    if (!rec.medication_name) { fnrToast('Medication name required', 'error'); return; }
    var { error } = await _sb.from('fnr_medications').insert([rec]);
    if (error) { fnrToast('Error: ' + error.message, 'error'); return; }
    fnrToast('Medication added', 'success');
    closeFnrModal();
    if (fnrCurrentPatient) openFNRPatientDetail(fnrCurrentPatient.study_id);
}

/* --- Add Seizure Log --- */
function fnrShowAddSeizureLogModal(patientId) {
    var body = '<input type="hidden" id="slPatientId" value="' + patientId + '">' +
        '<div class="form-row"><div class="form-group"><label>Month/Year</label><input type="month" id="slMonth"></div>' +
        '<div class="form-group"><label>Seizure Count</label><input type="number" id="slCount" min="0"></div></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="slNotes" rows="2"></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="fnrSaveSeizureLog()"><i class="fas fa-save"></i> Save</button></div>';
    openFnrModal('Add Seizure Log Entry', body);
}

async function fnrSaveSeizureLog() {
    var rec = {
        patient_id: parseInt(document.getElementById('slPatientId').value),
        month_year: document.getElementById('slMonth').value || null,
        seizure_count: document.getElementById('slCount').value ? parseInt(document.getElementById('slCount').value) : null,
        notes: document.getElementById('slNotes').value.trim() || null
    };
    var { error } = await _sb.from('fnr_seizure_logs').insert([rec]);
    if (error) { fnrToast('Error: ' + error.message, 'error'); return; }
    fnrToast('Seizure log entry added', 'success');
    closeFnrModal();
    if (fnrCurrentPatient) openFNRPatientDetail(fnrCurrentPatient.study_id);
}

/* --- Add Outcome Assessment --- */
function fnrShowAddOutcomeModal(studyId) {
    var body = '<div class="form-row"><div class="form-group"><label>Assessment Type</label><select id="oaType"><option value="">Select</option><option value="Engel">Engel Class</option><option value="UPDRS">UPDRS</option><option value="VAS">VAS</option><option value="Ashworth">Modified Ashworth</option><option value="QOLIE-31">QOLIE-31</option><option value="QOLIE-89">QOLIE-89</option><option value="PDQ-39">PDQ-39</option><option value="Other">Other</option></select></div>' +
        '<div class="form-group"><label>Score / Value</label><input type="text" id="oaScore"></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Assessment Date</label><input type="date" id="oaDate"></div>' +
        '<div class="form-group"><label>Timepoint</label><select id="oaTimepoint"><option value="">Select</option><option value="Baseline">Baseline</option><option value="3 months">3 Months</option><option value="6 months">6 Months</option><option value="12 months">12 Months</option><option value="24 months">24 Months</option><option value="36 months">36 Months</option><option value="Other">Other</option></select></div></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="oaNotes" rows="2"></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="fnrSaveOutcome(\'' + _esc(studyId) + '\')"><i class="fas fa-save"></i> Save</button></div>';
    openFnrModal('Add Outcome Assessment - ' + studyId, body);
}

async function fnrSaveOutcome(studyId) {
    var { data: pt } = await _sb.from('fnr_patients').select('id').eq('study_id', studyId).single();
    if (!pt) { fnrToast('Patient not found', 'error'); return; }
    var rec = {
        patient_id: pt.id,
        assessment_type: document.getElementById('oaType').value || null,
        score: document.getElementById('oaScore').value.trim() || null,
        assessment_date: document.getElementById('oaDate').value || null,
        timepoint: document.getElementById('oaTimepoint').value || null,
        notes: document.getElementById('oaNotes').value.trim() || null
    };
    var { error } = await _sb.from('fnr_outcome_assessments').insert([rec]);
    if (error) { fnrToast('Error: ' + error.message, 'error'); return; }
    fnrToast('Outcome assessment added', 'success');
    closeFnrModal();
    if (fnrCurrentPatient && fnrCurrentPatient.study_id === studyId) openFNRPatientDetail(studyId);
}

/* --- Add Follow-Up --- */
function fnrShowAddFollowUpModal(patientId) {
    var body = '<input type="hidden" id="fuPatientId" value="' + patientId + '">' +
        '<div class="form-row"><div class="form-group"><label>Visit Date</label><input type="date" id="fuDate"></div>' +
        '<div class="form-group"><label>Visit Type</label><select id="fuType"><option value="">Select</option><option value="Routine">Routine</option><option value="Programming">Programming</option><option value="Unscheduled">Unscheduled</option><option value="Emergency">Emergency</option></select></div></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="fuNotes" rows="2"></textarea></div>' +
        '<div class="modal-footer"><button class="btn btn-primary" onclick="fnrSaveFollowUp()"><i class="fas fa-save"></i> Save</button></div>';
    openFnrModal('Add Follow-up Visit', body);
}

async function fnrSaveFollowUp() {
    var rec = {
        patient_id: parseInt(document.getElementById('fuPatientId').value),
        visit_date: document.getElementById('fuDate').value || null,
        visit_type: document.getElementById('fuType').value || null,
        notes: document.getElementById('fuNotes').value.trim() || null
    };
    var { error } = await _sb.from('fnr_follow_ups').insert([rec]);
    if (error) { fnrToast('Error: ' + error.message, 'error'); return; }
    fnrToast('Follow-up added', 'success');
    closeFnrModal();
    if (fnrCurrentPatient) openFNRPatientDetail(fnrCurrentPatient.study_id);
}

/* ================================================
   11. QUERY BUILDER
   ================================================ */
async function fnrRunQuery() {
    var query = _sb.from('fnr_patients').select('*');

    var cat = document.getElementById('fnrQCategory').value;
    var ageMin = document.getElementById('fnrQAgeMin').value;
    var ageMax = document.getElementById('fnrQAgeMax').value;
    var sex = document.getElementById('fnrQSex').value;
    var surgeon = document.getElementById('fnrQSurgeon').value.trim();
    var engel = document.getElementById('fnrQEngel').value;
    var seizureFree = document.getElementById('fnrQSeizureFree').value;
    var dbsTarget = document.getElementById('fnrQDBSTarget').value;
    var procedure = document.getElementById('fnrQProcedure').value.trim();

    if (cat) query = query.eq('category', cat);
    if (ageMin) query = query.gte('age_at_surgery', parseInt(ageMin));
    if (ageMax) query = query.lte('age_at_surgery', parseInt(ageMax));
    if (sex) query = query.eq('sex', sex);
    if (surgeon) query = query.ilike('surgeon', '%' + surgeon + '%');
    if (engel) query = query.eq('engel_class', engel);
    if (seizureFree === 'true') query = query.eq('seizure_free', true);
    else if (seizureFree === 'false') query = query.eq('seizure_free', false);
    if (dbsTarget) query = query.eq('dbs_target', dbsTarget);
    if (procedure) query = query.ilike('procedure_type', '%' + procedure + '%');

    var { data, error } = await query;
    if (error) { fnrToast('Query error: ' + error.message, 'error'); return; }
    fnrQueryResults = data || [];
    fnrRenderQueryResults();
}

function fnrRenderQueryResults() {
    var countEl = document.getElementById('fnrQueryCount');
    if (countEl) countEl.textContent = fnrQueryResults.length + ' patients found';

    var tbody = document.getElementById('fnrQueryTbody');
    if (!tbody) return;
    if (!fnrQueryResults.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted);">No results. Adjust filters and search.</td></tr>';
        return;
    }
    var html = '';
    fnrQueryResults.forEach(function (p) {
        var outcomeText = '';
        if (p.category === 'Epilepsy') outcomeText = engelBadge(p.engel_class);
        else if (p.category === 'DBS') outcomeText = updrsImprovement(p.updrs_pre, p.updrs_post);
        else if (p.category === 'Pain') outcomeText = vasBadge(p.vas_post);
        else outcomeText = '<span class="badge badge-gray">N/A</span>';

        html += '<tr class="clickable-row" onclick="openFNRPatientDetail(\'' + _esc(p.study_id) + '\')">' +
            '<td style="color:var(--accent-primary);font-weight:600">' + _esc(p.study_id) + '</td>' +
            '<td>' + _esc(String(p.age_at_surgery || '')) + '</td>' +
            '<td>' + _esc(p.sex || '') + '</td>' +
            '<td>' + categoryBadge(p.category) + '</td>' +
            '<td>' + _esc(p.procedure_type || '') + '</td>' +
            '<td>' + _esc(p.surgeon || '') + '</td>' +
            '<td>' + engelBadge(p.engel_class) + '</td>' +
            '<td>' + outcomeText + '</td></tr>';
    });
    tbody.innerHTML = html;
}

function fnrClearQueryFilters() {
    ['fnrQAgeMin', 'fnrQAgeMax', 'fnrQSurgeon', 'fnrQProcedure'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['fnrQCategory', 'fnrQSex', 'fnrQEngel', 'fnrQSeizureFree', 'fnrQDBSTarget'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    fnrQueryResults = [];
    fnrRenderQueryResults();
    document.getElementById('fnrQueryCount').textContent = '0 patients found';
}

function fnrExportQueryCSV() {
    if (!fnrQueryResults.length) { fnrToast('No results to export', 'info'); return; }
    var fields = ['study_id', 'category', 'age_at_surgery', 'sex', 'procedure_type', 'surgeon', 'engel_class', 'seizure_free', 'updrs_pre', 'updrs_post', 'vas_pre', 'vas_post'];
    var csv = Papa.unparse(fnrQueryResults.map(function (p) {
        var row = {};
        fields.forEach(function (f) { row[f] = p[f] != null ? p[f] : ''; });
        return row;
    }));
    downloadCSV(csv, 'fnr_query_results.csv');
}

/* --- Sortable table headers --- */
function fnrInitTableSorting() {
    var headers = document.querySelectorAll('#fnrQueryTable thead th[data-sort]');
    for (var i = 0; i < headers.length; i++) {
        headers[i].addEventListener('click', function () {
            var col = this.getAttribute('data-sort');
            if (fnrSortCol === col) fnrSortAsc = !fnrSortAsc;
            else { fnrSortCol = col; fnrSortAsc = true; }
            fnrQueryResults.sort(function (a, b) {
                var va = a[col], vb = b[col];
                if (va == null) va = '';
                if (vb == null) vb = '';
                if (typeof va === 'number' && typeof vb === 'number') return fnrSortAsc ? va - vb : vb - va;
                return fnrSortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
            });
            fnrRenderQueryResults();
        });
    }
}

/* ================================================
   12. DEVICES PAGE
   ================================================ */
async function renderDevices() {
    var pts = fnrPatients.length ? fnrPatients : await fnrFetchAllPatients();
    var withDevice = pts.filter(function (p) { return p.device_manufacturer; });
    var active = withDevice.filter(function (p) { return p.device_status === 'Active'; }).length;
    var lowBattery = withDevice.filter(function (p) { return p.battery_status === 'Low' || p.battery_status === 'ERI'; }).length;

    var cardsEl = document.getElementById('fnrDeviceStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-microchip', withDevice.length, 'Total Devices', 'accent-cyan') +
            _statCard('fa-check-circle', active, 'Active', 'accent-green') +
            _statCard('fa-battery-quarter', lowBattery, 'Low Battery/ERI', 'accent-red') +
            _statCard('fa-exchange-alt', withDevice.filter(function (p) { return p.device_status === 'Replaced'; }).length, 'Replaced', 'accent-amber');
    }

    // Device manufacturer pie
    var mfgCounts = {};
    withDevice.forEach(function (p) {
        var m = p.device_manufacturer || 'Unknown';
        mfgCounts[m] = (mfgCounts[m] || 0) + 1;
    });
    var mfgData = Object.keys(mfgCounts).map(function (k) { return { label: k, value: mfgCounts[k] }; });
    if (mfgData.length) {
        d3DonutChart('fnrDeviceMfgPie', mfgData);
    } else {
        document.getElementById('fnrDeviceMfgPie').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No device data</p>';
    }

    // Battery status chart
    var batCounts = {};
    withDevice.forEach(function (p) {
        var b = p.battery_status || 'Unknown';
        batCounts[b] = (batCounts[b] || 0) + 1;
    });
    var batData = Object.keys(batCounts).map(function (k) { return { label: k, value: batCounts[k] }; });
    if (batData.length) {
        d3BarChart('fnrBatteryChart', batData, { colors: ['#10b981', '#06b6d4', '#f97316', '#ef4444', '#3b82f6', '#666680'] });
    } else {
        document.getElementById('fnrBatteryChart').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No battery data</p>';
    }

    // Recent programming sessions
    var { data: sessions } = await _sb.from('fnr_device_programming').select('*').order('session_date', { ascending: false }).limit(50);
    var tbody = document.getElementById('fnrProgrammingTbody');
    if (!tbody) return;
    if (!sessions || !sessions.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted);">No programming sessions</td></tr>';
        return;
    }

    // Map patient IDs to study IDs
    var patientIds = sessions.map(function (s) { return s.patient_id; });
    var uniqueIds = patientIds.filter(function (v, i, a) { return a.indexOf(v) === i; });
    var { data: ptsLookup } = await _sb.from('fnr_patients').select('id, study_id').in('id', uniqueIds);
    var idMap = {};
    (ptsLookup || []).forEach(function (pt) { idMap[pt.id] = pt.study_id; });

    var html = '';
    sessions.forEach(function (s) {
        html += '<tr>' +
            '<td>' + _esc(s.session_date || '') + '</td>' +
            '<td style="color:var(--accent-primary);font-weight:600;cursor:pointer" onclick="openFNRPatientDetail(\'' + _esc(idMap[s.patient_id] || '') + '\')">' + _esc(idMap[s.patient_id] || 'Unknown') + '</td>' +
            '<td>' + _esc(s.device_type || '') + '</td>' +
            '<td>' + _esc(String(s.amplitude || '')) + (s.amplitude ? ' mA' : '') + '</td>' +
            '<td>' + _esc(String(s.pulse_width || '')) + (s.pulse_width ? ' \u00b5s' : '') + '</td>' +
            '<td>' + _esc(String(s.frequency || '')) + (s.frequency ? ' Hz' : '') + '</td>' +
            '<td>' + _esc(s.contacts || '') + '</td>' +
            '<td>' + _esc(String(s.impedance || '')) + (s.impedance ? ' \u03a9' : '') + '</td></tr>';
    });
    tbody.innerHTML = html;
}

/* ================================================
   13. OUTCOMES PAGE
   ================================================ */
async function renderFNROutcomes() {
    var pts = fnrPatients.length ? fnrPatients : await fnrFetchAllPatients();

    // Stat cards
    var epilepsy = pts.filter(function (p) { return p.category === 'Epilepsy' && p.engel_class; });
    var seizureFree = epilepsy.filter(function (p) { return p.engel_class === 'IA'; }).length;
    var sfRate = epilepsy.length ? ((seizureFree / epilepsy.length) * 100).toFixed(0) + '%' : 'N/A';

    var dbsPts = pts.filter(function (p) { return p.category === 'DBS' && p.updrs_pre != null && p.updrs_post != null && p.updrs_pre > 0; });
    var avgDbsImprove = 'N/A';
    if (dbsPts.length) {
        var total = dbsPts.reduce(function (s, p) { return s + ((p.updrs_pre - p.updrs_post) / p.updrs_pre * 100); }, 0);
        avgDbsImprove = (total / dbsPts.length).toFixed(0) + '%';
    }

    var painPts = pts.filter(function (p) { return p.category === 'Pain' && p.vas_pre != null && p.vas_post != null; });
    var avgVasRedux = 'N/A';
    if (painPts.length) {
        var totalRedux = painPts.reduce(function (s, p) { return s + (p.vas_pre - p.vas_post); }, 0);
        avgVasRedux = (totalRedux / painPts.length).toFixed(1);
    }

    var cardsEl = document.getElementById('fnrOutcomeStatCards');
    if (cardsEl) {
        cardsEl.innerHTML =
            _statCard('fa-star', sfRate, 'Seizure Freedom Rate', 'accent-green') +
            _statCard('fa-chart-line', avgDbsImprove, 'Avg DBS UPDRS Improve', 'accent-cyan') +
            _statCard('fa-thermometer-half', avgVasRedux, 'Avg VAS Reduction', 'accent-amber') +
            _statCard('fa-users', pts.filter(function (p) { return p.engel_class || p.updrs_post != null || p.vas_post != null || p.ashworth_post != null; }).length, 'With Outcome Data', 'accent-purple');
    }

    // Engel trends by year
    var engelByYear = {};
    pts.filter(function (p) { return p.category === 'Epilepsy' && p.engel_class && p.surgery_date; }).forEach(function (p) {
        var year = p.surgery_date.substring(0, 4);
        if (!engelByYear[year]) engelByYear[year] = { IA: 0, IB: 0, IC: 0, ID: 0, II: 0, III: 0, IV: 0 };
        var ec = String(p.engel_class).toUpperCase();
        if (engelByYear[year].hasOwnProperty(ec)) engelByYear[year][ec]++;
    });
    var engelTrendContainer = document.getElementById('fnrEngelTrends');
    if (engelTrendContainer) {
        var years = Object.keys(engelByYear).sort();
        if (years.length) {
            var trendData = years.map(function (y) {
                var total = Object.values(engelByYear[y]).reduce(function (s, v) { return s + v; }, 0);
                var iaRate = total ? Math.round((engelByYear[y].IA / total) * 100) : 0;
                return { label: y, value: iaRate };
            });
            d3BarChart('fnrEngelTrends', trendData, { color: '#10b981' });
        } else {
            engelTrendContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No Engel trend data</p>';
        }
    }

    // UPDRS improvement distribution
    if (dbsPts.length) {
        var buckets = { '<30%': 0, '30-50%': 0, '>50%': 0 };
        dbsPts.forEach(function (p) {
            var pct = ((p.updrs_pre - p.updrs_post) / p.updrs_pre) * 100;
            if (pct >= 50) buckets['>50%']++;
            else if (pct >= 30) buckets['30-50%']++;
            else buckets['<30%']++;
        });
        var updrsData = Object.keys(buckets).map(function (k) { return { label: k, value: buckets[k] }; });
        d3BarChart('fnrUPDRSDist', updrsData, { colors: ['#ef4444', '#f59e0b', '#10b981'] });
    } else {
        document.getElementById('fnrUPDRSDist').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No UPDRS data</p>';
    }

    // VAS reduction chart
    if (painPts.length) {
        var vasData = [
            { label: 'Pre-op Avg', value: Math.round(painPts.reduce(function (s, p) { return s + p.vas_pre; }, 0) / painPts.length * 10) / 10 },
            { label: 'Post-op Avg', value: Math.round(painPts.reduce(function (s, p) { return s + p.vas_post; }, 0) / painPts.length * 10) / 10 }
        ];
        d3BarChart('fnrVASReduction', vasData, { colors: ['#ef4444', '#10b981'] });
    } else {
        document.getElementById('fnrVASReduction').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No VAS data</p>';
    }

    // Outcome comparison by category
    var compData = [];
    if (epilepsy.length) compData.push({ label: 'Epilepsy (SF%)', value: parseInt(sfRate) || 0 });
    if (dbsPts.length) compData.push({ label: 'DBS (UPDRS%)', value: parseInt(avgDbsImprove) || 0 });
    if (painPts.length) {
        var avgVasPct = painPts.reduce(function (s, p) { return s + ((p.vas_pre - p.vas_post) / p.vas_pre * 100); }, 0) / painPts.length;
        compData.push({ label: 'Pain (VAS%)', value: Math.round(avgVasPct) });
    }
    if (compData.length) {
        d3BarChart('fnrOutcomeComparison', compData, { colors: ['#7c3aed', '#06b6d4', '#f97316', '#10b981'] });
    } else {
        document.getElementById('fnrOutcomeComparison').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No outcome comparison data</p>';
    }
}

/* ================================================
   14. INITIALIZATION
   ================================================ */
async function initFNR() {
    await fnrCheckAuth();
    await fnrFetchAllPatients();
    renderFNRDashboard();

    // Sidebar navigation
    var links = document.querySelectorAll('.sidebar-link');
    for (var i = 0; i < links.length; i++) {
        links[i].addEventListener('click', function (e) {
            e.preventDefault();
            var pageId = this.getAttribute('data-page');
            if (pageId) fnrNavigate(pageId);
        });
    }

    // Sidebar toggle
    var toggle = document.getElementById('sidebarToggle');
    if (toggle) {
        toggle.addEventListener('click', function () {
            document.getElementById('btrSidebar').classList.toggle('collapsed');
        });
    }

    fnrInitTableSorting();
}

document.addEventListener('DOMContentLoaded', initFNR);
