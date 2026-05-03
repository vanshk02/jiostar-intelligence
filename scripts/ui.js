// ============================================================
//   JIOSTAR INTELLIGENCE — ui.js  v7
//   Full tables with headers, growth cols, cross-filtering,
//   expandable brands, booked rev everywhere
// ============================================================

let DATA = null;
let CURRENT_MONTH    = null;
let CONVERSATION_HISTORY = [];
let CURRENT_BU       = 'all';
let CURRENT_PLATFORM = 'all';
let CURRENT_ADTYPE   = 'all';
let CURRENT_FORMAT   = 'all';
let CURRENT_CATEGORY = 'all';
let CURRENT_AGENCY   = 'all';
const MAIN_BUS = ['LCS1','LCS2','MM1','MM2'];
function filterClientsByBU(clients, buName) {
  if (buName === 'all')    return clients;
  if (buName === 'Others') return clients.filter(c => !MAIN_BUS.includes(c.bu));
  return clients.filter(c => c.bu === buName);
}
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  document.getElementById('query-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitQuery();
  });
});

// ── Load ──────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch('data/summary.json');
    if (!res.ok) throw new Error('not found');
    DATA = await res.json();
    CURRENT_MONTH = DATA.available_months[DATA.available_months.length - 1];
    populateMonthDropdown();
    populateCategoryDropdown();
    populateAgencyDropdown();
    attachListeners();
    document.getElementById('month-select').value = CURRENT_MONTH;
    renderAll();
    document.getElementById('freshness-dot').className = 'freshness-dot ready';
    const d = new Date(DATA.generated_at);
    document.getElementById('freshness-label').textContent =
      'Updated ' + d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'2-digit' });
  } catch(e) {
    document.getElementById('freshness-dot').className = 'freshness-dot error';
    document.getElementById('freshness-label').textContent = 'Data load failed';
    document.getElementById('page-title').textContent = 'Error loading data';
    console.error(e);
  }
}

// ── Dropdowns ─────────────────────────────────────
function populateMonthDropdown() {
  const sel = document.getElementById('month-select');
  sel.innerHTML = '';
  DATA.available_months.slice().reverse().forEach(m => {
    const o = document.createElement('option');
    o.value = m; o.textContent = DATA.months[m] ? DATA.months[m].label : m;
    sel.appendChild(o);
  });
}
function populateCategoryDropdown() {
  const md = DATA.months[CURRENT_MONTH]; if (!md) return;
  const sel = document.getElementById('category-select');
  while (sel.options.length > 1) sel.remove(1);
  (md.categories||[]).forEach(c => { const o=document.createElement('option'); o.value=c.name; o.textContent=c.name; sel.appendChild(o); });
}
function populateAgencyDropdown() {
  const md = DATA.months[CURRENT_MONTH]; if (!md) return;
  const sel = document.getElementById('agency-select');
  while (sel.options.length > 1) sel.remove(1);
  (md.agencies||[]).forEach(a => { const o=document.createElement('option'); o.value=a.name; o.textContent=a.name; sel.appendChild(o); });
}
function attachListeners() {
  document.getElementById('month-select').addEventListener('change', e => {
    CURRENT_MONTH=e.target.value; CURRENT_CATEGORY='all'; CURRENT_AGENCY='all';
    document.getElementById('category-select').value='all';
    document.getElementById('agency-select').value='all';
    populateCategoryDropdown(); populateAgencyDropdown(); renderAll();
  });
  ['bu','platform','adtype','format','category','agency'].forEach(id => {
    document.getElementById(id+'-select').addEventListener('change', e => {
      if(id==='bu')       CURRENT_BU=e.target.value;
      if(id==='platform') CURRENT_PLATFORM=e.target.value;
      if(id==='adtype')   { CURRENT_ADTYPE=e.target.value; CURRENT_FORMAT='all'; document.getElementById('format-select').value='all'; }
      if(id==='format')   CURRENT_FORMAT=e.target.value;
      if(id==='category') CURRENT_CATEGORY=e.target.value;
      if(id==='agency')   CURRENT_AGENCY=e.target.value;
      renderAll();
    });
  });
}
// ── Flags / Diagnostic Layer ───────────────────────
function renderFlags(md) {
  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const flags = [];

  const classify = (pct, label) => {
    if (pct === null || pct === undefined) return;
    if (pct <= -20)      flags.push({ cls: 'flag-red',   icon: '🔴', text: label + ' ' + pct + '% vs LM' });
    else if (pct <= -10) flags.push({ cls: 'flag-amber', icon: '🟡', text: label + ' ' + pct + '% vs LM' });
    else if (pct >= 20)  flags.push({ cls: 'flag-green', icon: '🟢', text: label + ' +' + pct + '% vs LM' });
  };

  // BU flags
  ['LCS1','LCS2','MM1','MM2'].forEach(bu => {
    const b = md.bu[bu] || {};
    classify(b.growth_vs_lm ?? null, bu);
  });

  // Platform flags
  ['CTV','Mobile','Mobile+CTV'].forEach(p => {
    const pl = md.platform[p] || {};
    classify(pl.growth_vs_lm ?? null, p);
  });

  // Category flags — top 10
  (md.categories || []).slice(0, 10).forEach(cat => {
    if (!priorMd) return;
    const prior = (priorMd.categories || []).find(c => c.name === cat.name);
    if (!prior || prior.del_rev <= 0) return;
    const pct = r2(((cat.del_rev - prior.del_rev) / prior.del_rev) * 100);
    classify(pct, cat.name);
  });

  // Agency flags
  (md.agencies || []).forEach(ag => {
    if (!priorMd) return;
    const prior = (priorMd.agencies || []).find(a => a.name === ag.name);
    if (!prior || prior.del_rev <= 0) return;
    const pct = r2(((ag.del_rev - prior.del_rev) / prior.del_rev) * 100);
    classify(pct, ag.name);
  });

  const row = document.getElementById('flags-row');
  if (!flags.length) {
    row.style.display = 'none';
    return;
  }

  // Sort: red first, amber second, green last
  const order = { 'flag-red': 0, 'flag-amber': 1, 'flag-green': 2 };
  flags.sort((a, b) => order[a.cls] - order[b.cls]);

  row.style.display = 'flex';
  row.innerHTML =
    '<div style="width:100%;font-size:11px;font-weight:600;color:var(--ink-soft);letter-spacing:0.05em;text-transform:uppercase;padding-bottom:4px">📊 Auto Diagnostics</div>' +
    flags.map(f =>
      '<span class="flag-pill ' + f.cls + '">' + f.icon + ' ' + f.text + '</span>'
    ).join('');
}
let buChart = null;
let platformChart = null;
let bubbleChart = null;
let diveChart = null;

function renderCharts(md) {
  const lyMd = DATA.months[lyMonthKey(CURRENT_MONTH)] || null;

  // ── BU Bar Chart ──────────────────────────────────
  const buLabels = ['LCS1','LCS2','MM1','MM2','Others'];
  const buCurr   = buLabels.map(b => md.bu[b] ? r2(md.bu[b].del_rev) : 0);
  const buLY     = buLabels.map(b => lyMd && lyMd.bu[b] ? r2(lyMd.bu[b].del_rev) : 0);

  if (buChart) buChart.destroy();
  const buCtx = document.getElementById('bu-chart').getContext('2d');
  buChart = new Chart(buCtx, {
    type: 'bar',
    data: {
      labels: buLabels,
      datasets: [
        {
          label: md.label,
          data: buCurr,
          backgroundColor: 'rgba(59,130,246,0.85)',
          borderRadius: 5,
        },
        {
          label: lyMd ? lyMd.label : 'Last Year',
          data: buLY,
          backgroundColor: 'rgba(59,130,246,0.2)',
          borderRadius: 5,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.raw + ' Cr' } }
      },
      scales: {
        y: { ticks: { callback: v => v + ' Cr', font: { size: 11 } }, grid: { color: '#f1f5f9' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });

  // ── Platform Doughnut ─────────────────────────────
  const platLabels = ['CTV','Mobile','Mobile+CTV'];
  const platData   = platLabels.map(p => md.platform[p] ? r2(md.platform[p].del_rev) : 0);
  const platColors = ['rgba(59,130,246,0.85)','rgba(16,185,129,0.85)','rgba(245,158,11,0.85)'];

  if (platformChart) platformChart.destroy();
  const platCtx = document.getElementById('platform-chart').getContext('2d');
  platformChart = new Chart(platCtx, {
    type: 'doughnut',
    data: {
      labels: platLabels,
      datasets: [{
        data: platData,
        backgroundColor: platColors,
        borderWidth: 2,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.raw + ' Cr (' + Math.round(ctx.raw / (platData.reduce((a,b)=>a+b,0)||1) * 100) + '%)' } }
      },
      cutout: '65%',
    }
  });
}

// ── Category Bubble Map ───────────────────────────
function renderBubbleMap(md) {
  const lyMd = DATA.months[lyMonthKey(CURRENT_MONTH)] || null;

  // Build one data point per category
  const X_CAP = 300;

  const bubbleData = (md.categories || []).map(cat => {
    const lyCat   = lyMd ? (lyMd.categories || []).find(c => c.name === cat.name) : null;
    const rawVsLY = lyCat && lyCat.del_rev > 0
      ? r2(((cat.del_rev - lyCat.del_rev) / lyCat.del_rev) * 100)
      : 0;
    const capped  = rawVsLY > X_CAP;
    return {
      name:    cat.name,
      x:       capped ? X_CAP : rawVsLY,
      y:       r2(cat.del_rev),
      r:       Math.max(7, Math.min(30, (cat.clients || 1) * 2.2)),
      clients: cat.clients || 0,
      rawVsLY,
      capped,
    };
  }).filter(d => d.y > 0);

  // Median revenue — horizontal divider
  const sorted    = bubbleData.map(d => d.y).sort((a, b) => a - b);
  const medianRev = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  // Colour each bubble by quadrant
  const bubbleColor = d => {
    if (d.x >= 0 && d.y >= medianRev) return 'rgba(16,185,129,0.80)';
    if (d.x <  0 && d.y >= medianRev) return 'rgba(245,158,11,0.80)';
    if (d.x >= 0 && d.y <  medianRev) return 'rgba(59,130,246,0.80)';
    return 'rgba(100,116,139,0.55)';
  };

  // Highlight active category
  const activeCat = CURRENT_CATEGORY !== 'all' ? CURRENT_CATEGORY : null;
  const colors    = bubbleData.map(d =>
    activeCat ? (d.name === activeCat ? bubbleColor(d) : 'rgba(203,213,225,0.4)') : bubbleColor(d)
  );

  // Custom plugin — quadrant backgrounds + divider lines + labels
  const quadrantPlugin = {
    id: 'quadrants',
    beforeDraw(chart) {
      const { ctx, chartArea: { left, right, top, bottom }, scales: { x, y } } = chart;
      const cx = x.getPixelForValue(0);
      const cy = y.getPixelForValue(medianRev);
      ctx.save();

      // Quadrant fills
      const fills = [
        { x: cx,   y: top,  w: right - cx,  h: cy - top,    color: 'rgba(16,185,129,0.04)'  },
        { x: left, y: top,  w: cx - left,   h: cy - top,    color: 'rgba(245,158,11,0.04)'  },
        { x: cx,   y: cy,   w: right - cx,  h: bottom - cy, color: 'rgba(59,130,246,0.04)'  },
        { x: left, y: cy,   w: cx - left,   h: bottom - cy, color: 'rgba(100,116,139,0.04)' },
      ];
      fills.forEach(f => { ctx.fillStyle = f.color; ctx.fillRect(f.x, f.y, f.w, f.h); });

      // Divider lines
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, top);  ctx.lineTo(cx, bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(left, cy); ctx.lineTo(right, cy);  ctx.stroke();
      ctx.setLineDash([]);

      // Quadrant labels
      const labels = [
        { text: 'DOUBLE DOWN',  color: 'rgba(16,185,129,0.7)',  x: cx + 8,   y: top + 14    },
        { text: 'DEFEND',       color: 'rgba(245,158,11,0.7)',  x: left + 8, y: top + 14    },
        { text: 'INVEST',       color: 'rgba(59,130,246,0.7)',  x: cx + 8,   y: bottom - 10 },
        { text: 'DEPRIORITIZE', color: 'rgba(100,116,139,0.6)', x: left + 8, y: bottom - 10 },
      ];
      ctx.font = '600 10px DM Sans, sans-serif';
      labels.forEach(l => { ctx.fillStyle = l.color; ctx.fillText(l.text, l.x, l.y); });
      ctx.restore();
    },
    afterDraw(chart) {
      const { ctx, scales: { x, y } } = chart;
      ctx.save();
      ctx.textAlign = 'left';
      bubbleData.forEach((d, i) => {
        const px       = x.getPixelForValue(d.x);
        const py       = y.getPixelForValue(d.y);
        const rad      = chart.data.datasets[0].data[i].r;
        const isActive = activeCat ? d.name === activeCat : true;

        // Only draw inline label for large bubbles (r >= 14) or the active one
        const showLabel = rad >= 14 || (activeCat && d.name === activeCat);
        if (!showLabel) return;

        ctx.font      = '500 10px DM Sans, sans-serif';
        ctx.fillStyle = isActive ? '#334155' : 'rgba(148,163,184,0.5)';
        const label   = d.capped ? d.name + ' ❯' : d.name;
        ctx.fillText(label, px + rad + 4, py + 4);
      });
      ctx.restore();
    }
  };

  if (bubbleChart) bubbleChart.destroy();
  const canvas = document.getElementById('bubble-chart');
  if (!canvas) return;

  bubbleChart = new Chart(canvas.getContext('2d'), {
    type:    'bubble',
    plugins: [quadrantPlugin],
    data: {
      datasets: [{
        data:            bubbleData,
        backgroundColor: colors,
        borderColor:     colors.map(c => c.replace(/[\d.]+\)$/, '1)')),
        borderWidth:     1.5,
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: ctx => ctx[0].raw.name,
            label: ctx => {
              const d = ctx.raw;
              const vsLYDisplay = d.capped
                ? `>${X_CAP}% (actual: +${d.rawVsLY}%)`
                : `${d.rawVsLY > 0 ? '+' : ''}${d.rawVsLY}%`;
              return [
                `Revenue: ${fmtNum(d.y)} Cr`,
                `vs Last Year: ${vsLYDisplay}`,
                `Clients: ${d.clients}`,
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Growth vs Last Year (%)', font: { size: 11 }, color: '#64748B' },
          grid:  { color: 'rgba(0,0,0,0.04)' },
          max:   X_CAP,
          ticks: {
            font: { size: 11 },
            callback: v => v === X_CAP ? '≥300%' : v + '%'
          },
        },
        y: {
          title: { display: true, text: 'Delivered Revenue (Cr)', font: { size: 11 }, color: '#64748B' },
          grid:  { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 11 }, callback: v => v + ' Cr' },
        }
      },
      onClick(e, elements) {
        const sel = document.getElementById('category-select');
        if (!sel) return;
        if (elements.length) {
          const d = bubbleData[elements[0].index];
          sel.value        = d.name;
          CURRENT_CATEGORY = d.name;
        } else {
          // Click on empty area — reset category filter
          sel.value        = 'all';
          CURRENT_CATEGORY = 'all';
        }
        renderAll();
      }
    }
  });
}
// ── Render all ────────────────────────────────────
function renderAll() {
  const md = DATA.months[CURRENT_MONTH]; if (!md) return;
  renderHeader(md); renderKPIs(md); renderCharts(md); renderBubbleMap(md);
  renderBU(md); renderPlatform(md); renderAdType(md);
  renderCategories(md); renderAgencies(md); renderClients(md); renderCohort(); renderChurners(); renderFlags(md);
}

// ── Header ────────────────────────────────────────
function renderHeader(md) {
  document.getElementById('page-title').textContent = md.label;
  document.getElementById('page-sub').textContent = 'Revenue Intelligence · JioStar';
  let meta = fmtInt(md.total_clients) + ' active clients';
  if (md.vs_prior_month && md.vs_prior_month.change_pct !== null) {
    const p = md.vs_prior_month.change_pct;
    meta += '  ·  ' + (p>=0?'+':'') + p + '% vs ' + md.vs_prior_month.label;
  }
  document.getElementById('topbar-meta').textContent = meta;
}

// ── KPI Cards ─────────────────────────────────────
function renderKPIs(md) {
  const momC = md.vs_prior_month?.change_pct != null ? { pct: md.vs_prior_month.change_pct, label: 'vs '+md.vs_prior_month.label } : null;
  const lyC  = md.vs_last_year?.change_pct   != null ? { pct: md.vs_last_year.change_pct,   label: 'vs '+md.vs_last_year.label   } : null;

  const anyFilterActive = CURRENT_BU !== 'all' || CURRENT_PLATFORM !== 'all' ||
    CURRENT_ADTYPE !== 'all' || CURRENT_FORMAT !== 'all' ||
    CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all';
    const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;

  // ── Get filtered clients pool ──────────────────────────────
  let filteredClients = (md.top_clients || []).slice();
  filteredClients = filterClientsByBU(filteredClients, CURRENT_BU);
  if (CURRENT_CATEGORY !== 'all') filteredClients = filteredClients.filter(c =>
    c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
  if (CURRENT_AGENCY !== 'all') filteredClients = filteredClients.filter(c =>
    c.agency === CURRENT_AGENCY || (c.agency_rev_map && c.agency_rev_map[CURRENT_AGENCY] > 0));

  // ── Client rev for platform/adtype/format filters ──────────
  const clientRevForFilters = (c) => {
    const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    if (f !== 'all') {
      const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      if (p === 'CTV')        return c[`ctv_${base}_rev`]  ?? 0;
      if (p === 'Mobile')     return c[`mob_${base}_rev`]  ?? 0;
      if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`] ?? 0;
      return c[fk] ?? 0;
    }
    if (a === 'Video') {
      if (p === 'CTV')        return c.ctv_video_rev        ?? 0;
      if (p === 'Mobile')     return c.mob_video_rev        ?? 0;
      if (p === 'Mobile+CTV') return c.mobilectv_video_rev  ?? 0;
      return c.video_rev ?? 0;
    }
    if (a === 'Display') {
      if (p === 'CTV')        return c.ctv_display_rev       ?? 0;
      if (p === 'Mobile')     return c.mob_display_rev       ?? 0;
      if (p === 'Mobile+CTV') return c.mobilectv_display_rev ?? 0;
      return c.display_rev ?? 0;
    }
    if (p === 'CTV')        return c.ctv_rev        ?? 0;
    if (p === 'Mobile')     return c.mobile_rev     ?? 0;
    if (p === 'Mobile+CTV') return c.mobilectv_rev  ?? 0;
    return c.del_rev ?? 0;
  };

  // ── Total Del Rev ──────────────────────────────────────────
  let totalRev, totalClients, totalBooked;
  if (!anyFilterActive) {
    totalRev     = md.total_del_rev;
    totalClients = md.total_clients;
    totalBooked  = ['LCS1','LCS2','MM1','MM2'].reduce((t,b) => t + (md.bu[b] ? ((md.bu[b].booked_rev||0)/10000000) : 0), 0);
  } else {
    totalRev     = r2(filteredClients.reduce((t,c) => t + clientRevForFilters(c), 0));
    totalClients = filteredClients.filter(c => clientRevForFilters(c) > 0).length;
    totalBooked  = r2(filteredClients.reduce((t,c) => {
      const cr = clientRevForFilters(c);
      return t + (c.del_rev > 0 ? (c.booked_rev||0) * (cr/c.del_rev) / 10000000 : 0);
    }, 0));
  }

  // ── CTV / Mobile split ─────────────────────────────────────
  let adjCTV, adjMobile;
  if (!anyFilterActive) {
    const pureCTV    = md.platform['CTV']        ? md.platform['CTV'].del_rev        : 0;
    const pureMobile = md.platform['Mobile']     ? md.platform['Mobile'].del_rev     : 0;
    const mobCTV     = md.platform['Mobile+CTV'] ? md.platform['Mobile+CTV'].del_rev : 0;
    const pureTotal  = pureCTV + pureMobile;
    const ctvRatio   = pureTotal > 0 ? pureCTV    / pureTotal : 0.5;
    const mobRatio   = pureTotal > 0 ? pureMobile / pureTotal : 0.5;
    adjCTV    = r2(pureCTV    + mobCTV * ctvRatio);
    adjMobile = r2(pureMobile + mobCTV * mobRatio);
  } else {
    const pureCTV    = r2(filteredClients.reduce((t,c) => t + (c.ctv_rev    ?? 0), 0));
    const pureMobile = r2(filteredClients.reduce((t,c) => t + (c.mobile_rev ?? 0), 0));
    const mobCTV     = r2(filteredClients.reduce((t,c) => t + (c.mobilectv_rev ?? 0), 0));
    const pureTotal  = pureCTV + pureMobile;
    const ctvRatio   = pureTotal > 0 ? pureCTV    / pureTotal : 0.5;
    const mobRatio   = pureTotal > 0 ? pureMobile / pureTotal : 0.5;
    adjCTV    = r2(pureCTV    + mobCTV * ctvRatio);
    adjMobile = r2(pureMobile + mobCTV * mobRatio);
  }

  // ── Video / Display ────────────────────────────────────────
  let videoRev, displayRev;
  if (!anyFilterActive) {
    videoRev   = md.ad_type && md.ad_type.Video   ? md.ad_type.Video.del_rev   : 0;
    displayRev = md.ad_type && md.ad_type.Display ? md.ad_type.Display.del_rev : 0;
  } else {
    videoRev   = r2(filteredClients.reduce((t,c) => t + (c.video_rev   ?? 0), 0));
    displayRev = r2(filteredClients.reduce((t,c) => t + (c.display_rev ?? 0), 0));
  }

  // ── Biggest Mover ──────────────────────────────────────────
  const buMovers = ['LCS1','LCS2','MM1','MM2'].map(bu => {
    const curr  = md.bu[bu] ? md.bu[bu].del_rev : 0;
    const prior = priorMd && priorMd.bu[bu] ? priorMd.bu[bu].del_rev : 0;
    const pct   = prior > 0 ? r2(((curr - prior) / prior) * 100) : null;
    return { name: bu, type: 'BU', delta: r2(curr - prior), pct };
  });
  const catMovers = (md.categories || []).slice(0, 8).map(cat => {
    const prior    = (priorMd?.categories || []).find(c => c.name === cat.name);
    const priorRev = prior ? prior.del_rev : 0;
    const delta    = r2(cat.del_rev - priorRev);
    const pct      = priorRev > 0 ? r2(((cat.del_rev - priorRev) / priorRev) * 100) : null;
    return { name: cat.name, type: 'Category', delta, pct };
  });
  const allMovers = [...buMovers, ...catMovers].filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta);
  const topMover  = allMovers[0] || null;

  // ── Next Month Pipeline ─────────────────────────────────────
  const nextMKey    = nextMonthKey(CURRENT_MONTH);
  const nextMd      = DATA.months[nextMKey] || null;
  const lyNextMd    = DATA.months[lyMonthKey(nextMKey)] || null;
  const nextBooked  = nextMd
    ? r2(['LCS1','LCS2','MM1','MM2'].reduce((t, bu) => t + (nextMd.bu[bu] ? (nextMd.bu[bu].booked_rev || 0) / 10000000 : 0), 0))
    : null;
  const lyNextDel   = lyNextMd ? lyNextMd.total_del_rev : null;
  const nextVsLyPct = (nextBooked !== null && lyNextDel && lyNextDel > 0)
    ? r2(((nextBooked - lyNextDel) / lyNextDel) * 100)
    : null;
    const nextVsCurrPct = (nextBooked !== null && totalRev && totalRev > 0)
    ? r2(((nextBooked - totalRev) / totalRev) * 100)
    : null;

  // CTV/Mobile vs LM
  const ctvPrior    = !anyFilterActive && priorMd && md.platform['CTV']    ? priorMd.platform['CTV']?.del_rev    : null;
  const mobPrior    = !anyFilterActive && priorMd && md.platform['Mobile'] ? priorMd.platform['Mobile']?.del_rev : null;
  const ctvMomPct   = ctvPrior > 0 ? r2(((adjCTV    - ctvPrior) / ctvPrior) * 100) : null;
  const mobMomPct   = mobPrior > 0 ? r2(((adjMobile - mobPrior) / mobPrior) * 100) : null;
  const ctvMomC     = ctvMomPct !== null ? { pct: ctvMomPct, label: 'vs ' + (priorMd?.label || 'LM') } : null;
  const mobMomC     = mobMomPct !== null ? { pct: mobMomPct, label: 'vs ' + (priorMd?.label || 'LM') } : null;

  // Video/Display share
  const totalRevForShare = videoRev + displayRev || 1;
  const videoPct   = Math.round((videoRev   / totalRevForShare) * 100);
  const displayPct = Math.round((displayRev / totalRevForShare) * 100);

  

  document.getElementById('kpi-row').innerHTML = [
    kpiCard('Total Del Rev',  totalRev,      'Cr', momC),
    kpiCard('Active Clients', totalClients,  '',   lyC),
    kpiCard('CTV Rev',        adjCTV,        'Cr', ctvMomC,  ctvMomC  ? null : 'incl. Mob+CTV split'),
    kpiCard('Mobile Rev',     adjMobile,     'Cr', mobMomC,  mobMomC  ? null : 'incl. Mob+CTV split'),
    kpiCard('Video Rev',      videoRev,      'Cr', null,     videoPct + '% of total ad rev'),
    kpiCard('Display Rev',    displayRev,    'Cr', null,     displayPct + '% of total ad rev'),
    topMover
      ? `<div class="kpi-card">
          <div class="kpi-label">Biggest mover this month</div>
          <div style="font-size:22px;font-weight:600;color:var(--ink);letter-spacing:-0.02em;margin:6px 0 6px;line-height:1.2">${topMover.name}</div>
          <div style="font-size:13px;font-family:var(--mono);font-weight:500;color:var(--green)">+${fmtNum(topMover.delta)} Cr vs last month</div>
          <div style="font-size:11px;color:var(--ink-soft);margin-top:3px">${topMover.type} · largest absolute gain</div>
        </div>`
      : kpiCard('Biggest mover', 0, 'Cr', null, 'No prior month data'),
    nextBooked !== null
      ? `<div class="kpi-card">
          <div class="kpi-label">Next month pipeline</div>
          <div class="kpi-value" style="margin:6px 0 4px">${fmtNum(nextBooked)}<span class="kpi-unit"> Cr</span></div>
          <div style="font-size:12px;color:var(--ink-soft);margin-bottom:4px">Confirmed bookings · ${nextMd ? nextMd.label : ''}</div>
          ${nextVsCurrPct !== null
            ? `<div class="kpi-change ${nextVsCurrPct >= 0 ? 'up' : 'down'}">${nextVsCurrPct >= 0 ? '↑' : '↓'} ${Math.abs(nextVsCurrPct)}% ${nextVsCurrPct >= 0 ? 'ahead of' : 'behind'} ${md.label} delivered</div>`
            : ''}
        </div>`
      : kpiCard('Next month pipeline', 0, 'Cr', null, 'No bookings data yet'),
  ].join('');
}
function kpiCard(label,val,unit,ch,note) {
  let c='';
  if(ch){const cls=ch.pct>0?'up':ch.pct<0?'down':'flat';const arr=ch.pct>0?'↑':ch.pct<0?'↓':'→';c=`<div class="kpi-change ${cls}">${arr} ${ch.pct>0?'+':''}${Math.abs(ch.pct)}% <span style="color:var(--ink-soft);font-size:11px">${ch.label}</span></div>`;}
  else if(note){c=`<div class="kpi-change flat">${note}</div>`;}
  return `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value">${unit===''?fmtInt(val):fmtNum(val)}<span class="kpi-unit"> ${unit}</span></div>${c}</div>`;
}
// ── Shared helpers ────────────────────────────────
function growthBadge(pct) {
  if (pct===null||pct===undefined) return '<span style="color:var(--ink-soft)">—</span>';
  const col = pct>0 ? 'var(--green)' : pct<0 ? 'var(--red)' : 'var(--ink-soft)';
  const arr = pct>0 ? '↑' : pct<0 ? '↓' : '→';
  return `<span style="color:${col};font-weight:500;font-size:12px">${arr} ${pct>0?'+':''}${pct}%</span>`;
}

// Determine which revenue field to show based on active filters
function activeRevField(obj) {
  if (CURRENT_PLATFORM==='CTV')    return obj.ctv_rev    ?? obj.del_rev;
  if (CURRENT_PLATFORM==='Mobile') return obj.mobile_rev ?? obj.del_rev;
  if (CURRENT_ADTYPE==='Video')    return obj.video_rev  ?? obj.del_rev;
  if (CURRENT_ADTYPE==='Display')  return obj.display_rev?? obj.del_rev;
  return obj.del_rev;
}

function activeRevLabel() {
  if (CURRENT_PLATFORM==='CTV')    return 'CTV Rev';
  if (CURRENT_PLATFORM==='Mobile') return 'Mobile Rev';
  if (CURRENT_ADTYPE==='Video')    return 'Video Rev';
  if (CURRENT_ADTYPE==='Display')  return 'Display Rev';
  return 'Del Rev';
}

// Panel table builder
function ptable(headers, rows) {
  const ths = headers.map(h =>
    `<th style="text-align:${h.right?'right':'left'};min-width:${h.w||'auto'}">${h.label}</th>`
  ).join('');
  return `<div style="overflow-x:auto"><table class="ptable">
    <thead><tr>${ths}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ── BU Breakdown ──────────────────────────────────
function renderBU(md) {
  const buList = ['LCS1','LCS2','MM1','MM2','Others'];

  // ── Multi-dimensional filtering from top_clients ──────────
  // Start with all clients, apply every active filter simultaneously
  // Pick rev directly from stored BU fields — always exact, covers all rows
  const buRevFromStored = (b) => {
    const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    if (f !== 'all') {
      const fk   = formatFieldKey(f);
      const base = fk ? fk.replace('_rev', '') : null;
      if (!base) return 0;
      if (p === 'CTV')         return b['ctv_'  + base + '_rev'] ?? 0;
      if (p === 'Mobile')      return b['mob_'  + base + '_rev'] ?? 0;
      if (p === 'Mobile+CTV')  return b['mctv_' + base + '_rev'] ?? 0;
      return b[fk] ?? 0;
    }
    if (p === 'CTV'        && a === 'Video')   return b.ctv_video_rev      ?? 0;
    if (p === 'CTV'        && a === 'Display') return b.ctv_display_rev    ?? 0;
    if (p === 'Mobile'     && a === 'Video')   return b.mobile_video_rev   ?? 0;
    if (p === 'Mobile'     && a === 'Display') return b.mobile_display_rev ?? 0;
    if (p === 'CTV')                           return b.ctv_rev            ?? 0;
    if (p === 'Mobile')                        return b.mobile_rev         ?? 0;
    if (p === 'Mobile+CTV' && a === 'Video')   return b.mobilectv_video_rev   ?? 0;
    if (p === 'Mobile+CTV' && a === 'Display') return b.mobilectv_display_rev ?? 0;
    if (p === 'Mobile+CTV')                    return b.mobilectv_rev         ?? 0;
    if (a === 'Video')                         return b.video_rev          ?? 0;
    if (a === 'Display')                       return b.display_rev        ?? 0;
    return b.del_rev ?? 0;
  };

  // Pick rev from a single client row
  const clientRev = (c) => {
    const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev', '') : null;
      if (!base) return 0;
      if (p === 'CTV')         return c['ctv_' + base + '_rev']      ?? 0;
    if (p === 'Mobile')      return c['mob_' + base + '_rev']      ?? 0;
    if (p === 'Mobile+CTV')  return c['mctv_' + base + '_rev'] ?? 0;
    return c[fk] ?? 0;
    }
    if (p === 'CTV'    && a === 'Video')   return c.ctv_video_rev   ?? 0;
    if (p === 'CTV'    && a === 'Display') return c.ctv_display_rev ?? 0;
    if (p === 'Mobile' && a === 'Video')   return c.mob_video_rev   ?? 0;
    if (p === 'Mobile' && a === 'Display') return c.mob_display_rev ?? 0;
    if (p === 'CTV')                           return c.ctv_rev       ?? 0;
    if (p === 'Mobile')                        return c.mobile_rev    ?? 0;
    if (p === 'Mobile+CTV')                    return c.mobilectv_rev ?? 0;
    if (a === 'Video')                         return c.video_rev     ?? 0;
    if (a === 'Display')                       return c.display_rev   ?? 0;
    return c.del_rev ?? 0;
  };

  const needsClientFilter = CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all';

  const getFilteredData = (buName, monthData) => {
    if (!monthData) return { rev: 0, booked: 0, clients: 0 };
    const b = monthData.bu[buName] || {};

    if (!needsClientFilter) {
      const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
      let booked, clientCount;

      // Booked cross-cuts (stored in Cr already from JSONExporter sumWhere on BOOKED_REV, still raw INR → divide)
      if (f !== 'all') {
        // Format active — platform-aware exact fields
        const fk   = formatFieldKey(f);
        const base = fk ? fk.replace('_rev','') : null;
        if (p === 'CTV') {
          booked      = b['ctv_'  + base + '_booked']  ?? b.ctv_booked    ?? b.booked_rev;
          clientCount = b['ctv_'  + base + '_clients'] ?? b.ctv_clients   ?? b.clients;
        } else if (p === 'Mobile') {
          booked      = b['mob_'  + base + '_booked']  ?? b.mobile_booked  ?? b.booked_rev;
          clientCount = b['mob_'  + base + '_clients'] ?? b.mobile_clients ?? b.clients;
        } else if (p === 'Mobile+CTV') {
          booked      = b['mctv_' + base + '_booked']  ?? b.mobilectv_booked   ?? b.booked_rev;
          clientCount = b['mctv_' + base + '_clients'] ?? b.mobilectv_clients  ?? b.clients;
        } else if (a === 'Video') {
          booked      = b[base + '_booked']  ?? b.video_booked   ?? b.booked_rev;
          clientCount = b[base + '_clients'] ?? b.video_clients  ?? b.clients;
        } else if (a === 'Display') {
          booked      = b[base + '_booked']  ?? b.display_booked  ?? b.booked_rev;
          clientCount = b[base + '_clients'] ?? b.display_clients ?? b.clients;
        } else {
          booked      = b[base + '_booked']  ?? b.booked_rev;
          clientCount = b[base + '_clients'] ?? b.clients;
        }
      } else if (p==='CTV'    && a==='Video')   { booked = b.ctv_video_booked;          clientCount = b.ctv_video_clients; }
      else if (p==='CTV'    && a==='Display')   { booked = b.ctv_display_booked;        clientCount = b.ctv_display_clients; }
      else if (p==='Mobile' && a==='Video')     { booked = b.mobile_video_booked;       clientCount = b.mobile_video_clients; }
      else if (p==='Mobile' && a==='Display')   { booked = b.mobile_display_booked;     clientCount = b.mobile_display_clients; }
      else if (p==='Mobile+CTV' && a==='Video') { booked = b.mobilectv_video_booked;    clientCount = b.mobilectv_video_clients; }
      else if (p==='Mobile+CTV' && a==='Display'){ booked = b.mobilectv_display_booked; clientCount = b.mobilectv_display_clients; }
      else if (p==='CTV')                       { booked = b.ctv_booked;               clientCount = b.ctv_clients; }
      else if (p==='Mobile')                    { booked = b.mobile_booked;            clientCount = b.mobile_clients; }
      else if (p==='Mobile+CTV')                { booked = b.mobilectv_booked;         clientCount = b.mobilectv_clients; }
      else if (a==='Video')                     { booked = b.video_booked;             clientCount = b.video_clients; }
      else if (a==='Display')                   { booked = b.display_booked;           clientCount = b.display_clients; }
      else                                      { booked = b.booked_rev;               clientCount = b.clients; }

      return {
        rev:     r2(buRevFromStored(b)),
        booked:  r2((booked || 0) / 10000000),
        clients: clientCount || 0,
      };
    }

    // Category/Agency filter active — aggregate from top_clients
    let clients = (monthData.top_clients || []).slice();
    clients = filterClientsByBU(clients, buName);
    if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c => c.category === CURRENT_CATEGORY);
    if (CURRENT_AGENCY   !== 'all') clients = clients.filter(c => c.agency   === CURRENT_AGENCY);
    return {
      rev:     r2(clients.reduce((t, c) => t + clientRev(c), 0)),
      booked:  r2(clients.reduce((t, c) => t + (c.booked_rev || 0), 0) / 10000000),
      clients: clients.length,
    };
  };

  const anyFilterActive = CURRENT_PLATFORM !== 'all' || CURRENT_ADTYPE !== 'all'
    || CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all' || CURRENT_FORMAT !== 'all';

  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[lyMonthKey(CURRENT_MONTH)]    || null;

  const headers = [
    {label:'BU',      w:'60px'},
    {label:'Del Rev', right:true, w:'80px'},
    {label:'Booked',  right:true, w:'80px'},
    {label:'Target',  right:true, w:'70px'},
    {label:'Ach%',    right:true, w:'60px'},
    {label:'vs LM',   right:true, w:'80px'},
    {label:'vs LY',   right:true, w:'80px'},
    {label:'Clients', right:true, w:'60px'},
  ];

  const rows = buList.map(bu => {
    const b       = md.bu[bu] || {};
    const isActive = CURRENT_BU === 'all' || CURRENT_BU === bu;
    const cls      = CURRENT_BU === bu ? 'badge-green' : 'badge-blue';

    let rev, bookedCr, clients, momPct, loyPct;

    if (anyFilterActive) {
      const curr  = getFilteredData(bu, md);
      const prior = getFilteredData(bu, priorMd);
      const ly    = getFilteredData(bu, lyMd);
      rev      = curr.rev;
      bookedCr = curr.booked;
      clients  = bu === 'Others' ? '—' : curr.clients;
      momPct   = prior.rev > 0 ? r2(((curr.rev - prior.rev) / prior.rev) * 100) : null;
      loyPct   = ly.rev    > 0 ? r2(((curr.rev - ly.rev)    / ly.rev)    * 100) : null;
    } else {
      rev      = activeRevField(b);
      bookedCr = r2((b.booked_rev || 0) / 10000000);
      clients  = bu === 'Others' ? '—' : (b.clients || 0);
      momPct   = b.growth_vs_lm ?? null;
      loyPct   = b.growth_vs_ly ?? null;
    }

    return `<tr style="${!isActive?'opacity:0.3':''}">
      <td><span class="badge ${cls}">${bu}</span></td>
      <td style="text-align:right;font-family:var(--mono);font-weight:500">${fmtNum(rev)} Cr</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${fmtNum(bookedCr)} Cr</td>
      <td style="text-align:right;color:var(--ink-soft)">—</td>
      <td style="text-align:right;color:var(--ink-soft)">—</td>
      <td style="text-align:right">${growthBadge(momPct)}</td>
      <td style="text-align:right">${growthBadge(loyPct)}</td>
      <td style="text-align:right;color:var(--ink-soft)">${clients}</td>
    </tr>`;
  }).join('');

  // Calculate totals from what's displayed
  let totalRev = 0, totalBooked = 0, totalClients = 0;
  let totalMomNum = 0, totalMomDen = 0, totalLyNum = 0, totalLyDen = 0;

  buList.forEach(bu => {
    const b = md.bu[bu] || {};
    const isActive = CURRENT_BU === 'all' || CURRENT_BU === bu;
    if (!isActive) return;

    let rev, bookedCr, clients;
    if (anyFilterActive) {
      const curr  = getFilteredData(bu, md);
      const prior = getFilteredData(bu, priorMd);
      const ly    = getFilteredData(bu, lyMd);
      rev      = curr.rev;
      bookedCr = curr.booked;
      clients  = bu === 'Others' ? 0 : curr.clients;
      if (prior.rev > 0) { totalMomNum += curr.rev - prior.rev; totalMomDen += prior.rev; }
      if (ly.rev    > 0) { totalLyNum  += curr.rev - ly.rev;    totalLyDen  += ly.rev;    }
    } else {
      rev      = activeRevField(b);
      bookedCr = r2((b.booked_rev || 0) / 10000000);
      clients  = bu === 'Others' ? 0 : (b.clients || 0);
      if (b.growth_vs_lm != null) { totalMomNum += rev * (b.growth_vs_lm/100); totalMomDen += rev / (1 + b.growth_vs_lm/100); }
      if (b.growth_vs_ly != null) { totalLyNum  += rev * (b.growth_vs_ly/100); totalLyDen  += rev / (1 + b.growth_vs_ly/100); }
    }
    totalRev     += rev;
    totalBooked  += bookedCr;
    totalClients += clients;
  });

  const totalMomPct = totalMomDen > 0 ? r2((totalMomNum / totalMomDen) * 100) : null;
  const totalLyPct  = totalLyDen  > 0 ? r2((totalLyNum  / totalLyDen)  * 100) : null;

  const totalRow = '<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">' +
    '<td><span class="badge badge-gray">Total</span></td>' +
    '<td style="text-align:right;font-family:var(--mono);font-weight:600">' + fmtNum(r2(totalRev)) + ' Cr</td>' +
    '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + fmtNum(r2(totalBooked)) + ' Cr</td>' +
    '<td style="text-align:right;color:var(--ink-soft)">—</td>' +
    '<td style="text-align:right;color:var(--ink-soft)">—</td>' +
    '<td style="text-align:right">' + growthBadge(totalMomPct) + '</td>' +
    '<td style="text-align:right">' + growthBadge(totalLyPct) + '</td>' +
    '<td style="text-align:right;color:var(--ink-soft)">' + fmtInt(totalClients) + '</td>' +
    '</tr>';

  document.getElementById('bu-panel').innerHTML = ptable(headers, rows + totalRow);
}

// ── Platform Split ────────────────────────────────
function renderPlatform(md) {
  const platforms = ['CTV','Mobile','Mobile+CTV'];
  const clsMap = {CTV:'badge-green',Mobile:'badge-blue','Mobile+CTV':'badge-amber'};

  const platformRevFromStored = (pl) => {
    const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    if (f !== 'all') { const fk = formatFieldKey(f); return fk ? (pl[fk] ?? 0) : 0; }
    if (a === 'Video')   return pl.video_rev   ?? 0;
    if (a === 'Display') return pl.display_rev ?? 0;
    return pl.del_rev ?? 0;
  };

  const platformBookedFromStored = (pl) => {
    const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    let booked;
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      booked = base ? (pl[base+'_booked'] ?? pl.booked_rev) : pl.booked_rev;
    } else if (a === 'Video')   booked = pl.video_booked   ?? pl.booked_rev;
    else if (a === 'Display')   booked = pl.display_booked ?? pl.booked_rev;
    else                        booked = pl.booked_rev;
    return r2((booked || 0) / 10000000);
  };

  const platformClientsFromStored = (pl) => {
    const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      return base ? (pl[base+'_clients'] ?? pl.clients) : pl.clients;
    }
    if (a === 'Video')   return pl.video_clients   ?? pl.clients;
    if (a === 'Display') return pl.display_clients ?? pl.clients;
    return pl.clients;
  };

  const needsClientFilterPlat = CURRENT_BU !== 'all' || CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all';
  const anyPlatFilterActive   = needsClientFilterPlat || CURRENT_ADTYPE !== 'all' || CURRENT_FORMAT !== 'all';

  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[lyMonthKey(CURRENT_MONTH)]    || null;

  const getFilteredDataForPlatform = (platformName, monthData) => {
    if (!monthData) return { rev: 0, booked: 0, clients: 0 };
    const pl = monthData.platform[platformName] || {};

    if (!needsClientFilterPlat) {
      return {
        rev:     r2(platformRevFromStored(pl)),
        booked:  platformBookedFromStored(pl),
        clients: platformClientsFromStored(pl),
      };
    }

    let clients = (monthData.top_clients || []).slice();
    clients = filterClientsByBU(clients, CURRENT_BU);
    if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c => c.category === CURRENT_CATEGORY);
    if (CURRENT_AGENCY   !== 'all') clients = clients.filter(c => c.agency   === CURRENT_AGENCY);

    const platKey = platformName === 'CTV' ? 'ctv_rev' : platformName === 'Mobile' ? 'mobile_rev' : 'mobilectv_rev';
    const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    let rev = 0;
    clients.forEach(c => {
      let val = 0;
      if (f !== 'all') {
        const fk   = formatFieldKey(f);
        const base = fk ? fk.replace('_rev', '') : null;
        if (!base) { val = 0; }
        else if (platformName === 'CTV')         val = c['ctv_'  + base + '_rev'] || 0;
        else if (platformName === 'Mobile')      val = c['mob_'  + base + '_rev'] || 0;
        else if (platformName === 'Mobile+CTV')  val = c['mctv_' + base + '_rev'] || 0;
        else                                     val = c[fk] || 0;
      }
      else if (platformName === 'CTV'    && a === 'Video')   val = c.ctv_video_rev   || 0;
      else if (platformName === 'CTV'    && a === 'Display') val = c.ctv_display_rev || 0;
      else if (platformName === 'Mobile' && a === 'Video')   val = c.mob_video_rev   || 0;
      else if (platformName === 'Mobile' && a === 'Display') val = c.mob_display_rev || 0;
      else                                                    val = c[platKey]        || 0;
      rev += val;
    });
    // Approximate platform booked using platform rev ratio, count only platform-active clients
    let bookedSum = 0;
    let platClientCount = 0;
    clients.forEach(c => {
      // Use the exact same field that rev uses, so booked/clients match the filter
      let activeVal = 0;
      if (f !== 'all') {
        const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
        if (base) {
          if (platformName==='CTV')             activeVal = c['ctv_' +base+'_rev'] || 0;
          else if (platformName==='Mobile')     activeVal = c['mob_' +base+'_rev'] || 0;
          else if (platformName==='Mobile+CTV') activeVal = c['mctv_'+base+'_rev'] || 0;
          else                                  activeVal = c[fk] || 0;
        }
      } else if (platformName==='CTV'    && a==='Video')   activeVal = c.ctv_video_rev   || 0;
      else if (platformName==='CTV'    && a==='Display') activeVal = c.ctv_display_rev || 0;
      else if (platformName==='Mobile' && a==='Video')   activeVal = c.mob_video_rev   || 0;
      else if (platformName==='Mobile' && a==='Display') activeVal = c.mob_display_rev || 0;
      else activeVal = c[platKey] || 0;

      if (activeVal > 0) {
        platClientCount++;
        bookedSum += (c.booked_rev || 0);
      }
    });
    // Booked: use stored BU fields scoped to platform — never sum from clients (over-counts)
    let booked;
    const buData = CURRENT_BU !== 'all' ? monthData.bu[CURRENT_BU] || {} : null;
    if (buData) {
      const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
      if (f !== 'all') {
        const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
        if (platformName==='CTV')         booked = buData['ctv_' +base+'_booked'] ?? buData.ctv_booked    ?? buData.booked_rev;
        else if (platformName==='Mobile') booked = buData['mob_' +base+'_booked'] ?? buData.mobile_booked ?? buData.booked_rev;
        else                              booked = buData['mctv_'+base+'_booked'] ?? buData.mobilectv_booked ?? buData.booked_rev;
      } else if (platformName==='CTV'    && a==='Video')   booked = buData.ctv_video_booked;
      else if (platformName==='CTV'    && a==='Display')   booked = buData.ctv_display_booked;
      else if (platformName==='Mobile' && a==='Video')     booked = buData.mobile_video_booked;
      else if (platformName==='Mobile' && a==='Display')   booked = buData.mobile_display_booked;
      else if (platformName==='CTV')                       booked = buData.ctv_booked;
      else if (platformName==='Mobile')                    booked = buData.mobile_booked;
      else if (platformName==='Mobile+CTV')                booked = buData.mobilectv_booked;
      else                                                 booked = buData.booked_rev;
      booked = r2((booked || 0) / 10000000);
    } else {
      booked = r2(bookedSum / 10000000);
    }

    return { rev: r2(rev), booked, clients: platClientCount };
  };

  const headers = [
    {label:'Platform', w:'90px'},
    {label:'Del Rev',  right:true, w:'80px'},
    {label:'Booked',   right:true, w:'80px'},
    {label:'Target',   right:true, w:'70px'},
    {label:'Ach%',     right:true, w:'60px'},
    {label:'vs LM',    right:true, w:'80px'},
    {label:'vs LY',    right:true, w:'80px'},
    {label:'Clients',  right:true, w:'60px'},
  ];

  const rows = platforms.map(p => {
    const pl = md.platform[p] || {};
    const isActive = CURRENT_PLATFORM === 'all' || CURRENT_PLATFORM === p;
    const cls = CURRENT_PLATFORM === p ? 'badge-green' : clsMap[p];
    let rev, bookedCr, clients, momPct, loyPct;

    if (anyPlatFilterActive) {
      const curr  = getFilteredDataForPlatform(p, md);
      const prior = getFilteredDataForPlatform(p, priorMd);
      const ly    = getFilteredDataForPlatform(p, lyMd);
      rev      = curr.rev;
      bookedCr = curr.booked;
      clients  = curr.clients;
      momPct   = prior.rev > 0 ? r2(((curr.rev - prior.rev) / prior.rev) * 100) : null;
      loyPct   = ly.rev    > 0 ? r2(((curr.rev - ly.rev)    / ly.rev)    * 100) : null;
    } else {
      rev      = pl.del_rev ?? 0;
      bookedCr = r2((pl.booked_rev || 0) / 10000000);
      clients  = pl.clients || 0;
      momPct   = pl.growth_vs_lm ?? null;
      loyPct   = pl.growth_vs_ly ?? null;
    }

    return '<tr style="' + (!isActive ? 'opacity:0.3' : '') + '">' +
      '<td><span class="badge ' + cls + '">' + p + '</span></td>' +
      '<td style="text-align:right;font-family:var(--mono);font-weight:500">' + fmtNum(rev) + ' Cr</td>' +
      '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + fmtNum(bookedCr) + ' Cr</td>' +
      '<td style="text-align:right;color:var(--ink-soft)">—</td>' +
      '<td style="text-align:right;color:var(--ink-soft)">—</td>' +
      '<td style="text-align:right">' + growthBadge(momPct) + '</td>' +
      '<td style="text-align:right">' + growthBadge(loyPct) + '</td>' +
      '<td style="text-align:right;color:var(--ink-soft)">' + clients + '</td>' +
    '</tr>';
  }).join('');

  // Total row
  let totalRev = 0, totalBooked = 0, totalClients = 0;
  let totalMomNum = 0, totalMomDen = 0, totalLyNum = 0, totalLyDen = 0;

  platforms.forEach(p => {
    const pl = md.platform[p] || {};
    const isActive = CURRENT_PLATFORM === 'all' || CURRENT_PLATFORM === p;
    if (!isActive) return;
    let rev, bookedCr, clients;
    if (anyPlatFilterActive) {
      const curr  = getFilteredDataForPlatform(p, md);
      const prior = getFilteredDataForPlatform(p, priorMd);
      const ly    = getFilteredDataForPlatform(p, lyMd);
      rev = curr.rev; bookedCr = curr.booked; clients = curr.clients;
      if (prior.rev > 0) { totalMomNum += curr.rev - prior.rev; totalMomDen += prior.rev; }
      if (ly.rev    > 0) { totalLyNum  += curr.rev - ly.rev;    totalLyDen  += ly.rev;    }
    } else {
      rev      = pl.del_rev ?? 0;
      bookedCr = r2((pl.booked_rev || 0) / 10000000);
      clients  = pl.clients || 0;
      if (pl.growth_vs_lm != null) { totalMomNum += rev * (pl.growth_vs_lm/100); totalMomDen += rev / (1 + pl.growth_vs_lm/100); }
      if (pl.growth_vs_ly != null) { totalLyNum  += rev * (pl.growth_vs_ly/100); totalLyDen  += rev / (1 + pl.growth_vs_ly/100); }
    }
    totalRev += rev; totalBooked += bookedCr; totalClients += clients;
  });

  const totalMomPct = totalMomDen > 0 ? r2((totalMomNum / totalMomDen) * 100) : null;
  const totalLyPct  = totalLyDen  > 0 ? r2((totalLyNum  / totalLyDen)  * 100) : null;

  const totalRow = '<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">' +
    '<td><span class="badge badge-gray">Total</span></td>' +
    '<td style="text-align:right;font-family:var(--mono);font-weight:600">' + fmtNum(r2(totalRev)) + ' Cr</td>' +
    '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + fmtNum(r2(totalBooked)) + ' Cr</td>' +
    '<td style="text-align:right;color:var(--ink-soft)">—</td>' +
    '<td style="text-align:right;color:var(--ink-soft)">—</td>' +
    '<td style="text-align:right">' + growthBadge(totalMomPct) + '</td>' +
    '<td style="text-align:right">' + growthBadge(totalLyPct) + '</td>' +
    '<td style="text-align:right;color:var(--ink-soft)">' + (CURRENT_PLATFORM === 'all' ? fmtInt(totalClients) : '—') + '</td>' +
  '</tr>';

  document.getElementById('platform-panel').innerHTML = ptable(headers, rows + totalRow);
}

// ── Ad Type ───────────────────────────────────────
function renderAdType(md) {
  const vFormats = ['Preroll','Midroll','Integration','Spots'];
  const dFormats = ['Billboard','Breakout Billboard','Pause Ads','Display and Frames','Fence Ads','Untagged'];
  const allBUs   = ['LCS1','LCS2','MM1','MM2','Others'];

  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[lyMonthKey(CURRENT_MONTH)]    || null;

  const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
  const needsClientFilter = CURRENT_BU !== 'all' || CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all';
  const anyFilterActive   = needsClientFilter || p !== 'all' || f !== 'all';
  const activeBUs = CURRENT_BU !== 'all' ? [CURRENT_BU] : allBUs;

  const buAdTypeRev = (b, isVideo) => {
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      if (p === 'CTV')        return b[`ctv_${base}_rev`]  ?? 0;
      if (p === 'Mobile')     return b[`mob_${base}_rev`]  ?? 0;
      if (p === 'Mobile+CTV') return b[`mctv_${base}_rev`] ?? 0;
      return b[fk] ?? 0;
    }
    if (p === 'CTV'        && isVideo)  return b.ctv_video_rev         ?? 0;
    if (p === 'CTV'        && !isVideo) return b.ctv_display_rev       ?? 0;
    if (p === 'Mobile'     && isVideo)  return b.mobile_video_rev      ?? 0;
    if (p === 'Mobile'     && !isVideo) return b.mobile_display_rev    ?? 0;
    if (p === 'Mobile+CTV' && isVideo)  return b.mobilectv_video_rev   ?? 0;
    if (p === 'Mobile+CTV' && !isVideo) return b.mobilectv_display_rev ?? 0;
    if (p === 'CTV')        return b.ctv_rev        ?? 0;
    if (p === 'Mobile')     return b.mobile_rev     ?? 0;
    if (p === 'Mobile+CTV') return b.mobilectv_rev  ?? 0;
    return isVideo ? (b.video_rev ?? 0) : (b.display_rev ?? 0);
  };

  const buAdTypeBooked = (b, isVideo) => {
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      if (p === 'CTV')        return b[`ctv_${base}_booked`]  ?? b.ctv_booked       ?? b.booked_rev ?? 0;
      if (p === 'Mobile')     return b[`mob_${base}_booked`]  ?? b.mobile_booked    ?? b.booked_rev ?? 0;
      if (p === 'Mobile+CTV') return b[`mctv_${base}_booked`] ?? b.mobilectv_booked ?? b.booked_rev ?? 0;
      return b[`${base}_booked`] ?? (isVideo ? b.video_booked : b.display_booked) ?? b.booked_rev ?? 0;
    }
    if (p === 'CTV'        && isVideo)  return b.ctv_video_booked         ?? b.ctv_booked       ?? b.booked_rev ?? 0;
    if (p === 'CTV'        && !isVideo) return b.ctv_display_booked       ?? b.ctv_booked       ?? b.booked_rev ?? 0;
    if (p === 'Mobile'     && isVideo)  return b.mobile_video_booked      ?? b.mobile_booked    ?? b.booked_rev ?? 0;
    if (p === 'Mobile'     && !isVideo) return b.mobile_display_booked    ?? b.mobile_booked    ?? b.booked_rev ?? 0;
    if (p === 'Mobile+CTV' && isVideo)  return b.mobilectv_video_booked   ?? b.mobilectv_booked ?? b.booked_rev ?? 0;
    if (p === 'Mobile+CTV' && !isVideo) return b.mobilectv_display_booked ?? b.mobilectv_booked ?? b.booked_rev ?? 0;
    if (p === 'CTV')        return b.ctv_booked       ?? b.booked_rev ?? 0;
    if (p === 'Mobile')     return b.mobile_booked    ?? b.booked_rev ?? 0;
    if (p === 'Mobile+CTV') return b.mobilectv_booked ?? b.booked_rev ?? 0;
    return isVideo ? (b.video_booked ?? b.booked_rev ?? 0) : (b.display_booked ?? b.booked_rev ?? 0);
  };

  const clientRev = (c, isVideo) => {
    // When category/agency filter active, scale raw rev by the category's share of that client's total
    const catScale = (() => {
      if (CURRENT_CATEGORY !== 'all' && c.category_rev_map) {
        const catRev = c.category_rev_map[CURRENT_CATEGORY] || 0;
        return c.del_rev > 0 ? catRev / c.del_rev : 0;
      }
      if (CURRENT_AGENCY !== 'all' && c.agency_rev_map) {
        const agRev = c.agency_rev_map[CURRENT_AGENCY] || 0;
        return c.del_rev > 0 ? agRev / c.del_rev : 0;
      }
      return 1;
    })();
    if (catScale === 0) return 0;

    let base_rev;
    if (f !== 'all') {
      if (isVideo  && dFormats.includes(f)) return 0;
      if (!isVideo && vFormats.includes(f)) return 0;
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      if (p === 'CTV')        base_rev = c[`ctv_${base}_rev`]  ?? 0;
      else if (p === 'Mobile')     base_rev = c[`mob_${base}_rev`]  ?? 0;
      else if (p === 'Mobile+CTV') base_rev = c[`mctv_${base}_rev`] ?? 0;
      else base_rev = c[fk] ?? 0;
    } else if (p === 'CTV'        && isVideo)  base_rev = c.ctv_video_rev         ?? 0;
    else if (p === 'CTV'        && !isVideo) base_rev = c.ctv_display_rev       ?? 0;
    else if (p === 'Mobile'     && isVideo)  base_rev = c.mob_video_rev         ?? 0;
    else if (p === 'Mobile'     && !isVideo) base_rev = c.mob_display_rev       ?? 0;
    else if (p === 'Mobile+CTV' && isVideo)  base_rev = c.mobilectv_video_rev   ?? 0;
    else if (p === 'Mobile+CTV' && !isVideo) base_rev = c.mobilectv_display_rev ?? 0;
    else if (p === 'CTV')        base_rev = c.ctv_rev        ?? 0;
    else if (p === 'Mobile')     base_rev = c.mobile_rev     ?? 0;
    else if (p === 'Mobile+CTV') base_rev = c.mobilectv_rev  ?? 0;
    else base_rev = isVideo ? (c.video_rev ?? 0) : (c.display_rev ?? 0);

    return base_rev * catScale;
  };

  const clientFormatRev = (c, base) => {
    if (p === 'CTV')        return c[`ctv_${base}_rev`]  ?? 0;
    if (p === 'Mobile')     return c[`mob_${base}_rev`]  ?? 0;
    if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`] ?? 0;
    return c[`${base}_rev`] ?? 0;
  };

  const getFilteredClients = (monthData) => {
    if (!monthData) return [];
    let clients = (monthData.top_clients || []).slice();
    clients = filterClientsByBU(clients, CURRENT_BU);
    if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c =>
      c.category === CURRENT_CATEGORY ||
      (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0)
    );
    if (CURRENT_AGENCY !== 'all') clients = clients.filter(c =>
      c.agency === CURRENT_AGENCY ||
      (c.agency_rev_map && c.agency_rev_map[CURRENT_AGENCY] > 0)
    );
    return clients;
  };

  const getAdTypeData = (adType, monthData) => {
    if (!monthData) return { rev: 0, booked: 0, clients: 0 };
    const isVideo = adType === 'Video';

    if (f !== 'all') {
      if (isVideo  && dFormats.includes(f)) return { rev: 0, booked: 0, clients: 0 };
      if (!isVideo && vFormats.includes(f)) return { rev: 0, booked: 0, clients: 0 };
    }

    if (!anyFilterActive) {
      const stored = monthData.ad_type?.[adType] || {};
      const clientCount = (monthData.top_clients || []).filter(c => clientRev(c, isVideo) > 0).length;
      return {
        rev:     stored.del_rev ?? 0,
        booked:  r2((stored.booked_rev ?? 0) / 10000000),
        clients: clientCount,
      };
    }

    // Pure category filter, no BU/platform/format → read stored category data (exact, matches Excel)
    if (CURRENT_CATEGORY !== 'all' && CURRENT_BU === 'all' && p === 'all' && f === 'all') {
      const catData = (monthData.categories || []).find(c => c.name === CURRENT_CATEGORY) || {};
      return {
        rev:     isVideo ? (catData.video_rev || 0) : (catData.display_rev || 0),
        booked:  r2((catData.booked_rev || 0) / 10000000),
        clients: catData.clients || 0,
      };
    }

    // Pure agency filter, no BU/platform/format → read stored agency data (exact)
    if (CURRENT_AGENCY !== 'all' && CURRENT_BU === 'all' && p === 'all' && f === 'all') {
      const agData = (monthData.agencies || []).find(ag => ag.name === CURRENT_AGENCY) || {};
      return {
        rev:     isVideo ? (agData.video_rev || 0) : (agData.display_rev || 0),
        booked:  r2((agData.booked_rev || 0) / 10000000),
        clients: agData.clients || 0,
      };
    }

    const filteredClients = getFilteredClients(monthData);

    let rev = 0;
    if (!needsClientFilter) {
      activeBUs.forEach(buName => { rev += buAdTypeRev(monthData.bu[buName] || {}, isVideo); });
    } else {
      rev = filteredClients.reduce((t, c) => t + clientRev(c, isVideo), 0);
    }

    let bookedRaw = 0;
    if (CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all') {
      // Pro-rate each client's booked by their adtype revenue share
      bookedRaw = filteredClients.reduce((t, c) => {
        const totalClientRev = c.del_rev || 0;
        if (totalClientRev <= 0) return t;
        const adTypeClientRev = clientRev(c, isVideo);
        return t + (c.booked_rev || 0) * (adTypeClientRev / totalClientRev);
      }, 0);
    } else {
      activeBUs.forEach(buName => { bookedRaw += buAdTypeBooked(monthData.bu[buName] || {}, isVideo); });
    }

    const clientCount = filteredClients.filter(c => clientRev(c, isVideo) > 0).length;

    return { rev: r2(rev), booked: r2(bookedRaw / 10000000), clients: clientCount };
  };

  const getFormatData = (fmt, adType, monthData) => {
    if (!monthData) return { rev: 0, booked: 0, clients: 0 };
    const fk = formatFieldKey(fmt);
    const base = fk ? fk.replace('_rev','') : null;
    if (!base) return { rev: 0, booked: 0, clients: 0 };

    const filteredClients = getFilteredClients(monthData);
    let rev = 0, bookedRaw = 0, clientCount = 0;

    if (!anyFilterActive) {
      rev = monthData.ad_type?.[adType]?.formats?.[fmt] ?? 0;
      activeBUs.forEach(buName => {
        const b = monthData.bu[buName] || {};
        if (p === 'CTV')             bookedRaw += b[`ctv_${base}_booked`]  ?? 0;
        else if (p === 'Mobile')     bookedRaw += b[`mob_${base}_booked`]  ?? 0;
        else if (p === 'Mobile+CTV') bookedRaw += b[`mctv_${base}_booked`] ?? 0;
        else                         bookedRaw += b[`${base}_booked`]      ?? 0;
      });
      clientCount = (monthData.top_clients || []).filter(c => clientFormatRev(c, base) > 0).length;
      return { rev: r2(rev), booked: r2(bookedRaw / 10000000), clients: clientCount };
    }

    if (!needsClientFilter) {
      activeBUs.forEach(buName => {
        const b = monthData.bu[buName] || {};
        if (p === 'CTV')             rev += b[`ctv_${base}_rev`]  ?? 0;
        else if (p === 'Mobile')     rev += b[`mob_${base}_rev`]  ?? 0;
        else if (p === 'Mobile+CTV') rev += b[`mctv_${base}_rev`] ?? 0;
        else                         rev += b[fk] ?? 0;
      });
    } else {
      rev = filteredClients.reduce((t, c) => t + clientFormatRev(c, base), 0);
    }

    if (CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all') {
      // Pro-rate each client's booked by their format revenue share
      bookedRaw = filteredClients.reduce((t, c) => {
        const totalClientRev = c.del_rev || 0;
        if (totalClientRev <= 0) return t;
        const fmtClientRev = clientFormatRev(c, base);
        return t + (c.booked_rev || 0) * (fmtClientRev / totalClientRev);
      }, 0);
    } else {
      activeBUs.forEach(buName => {
        const b = monthData.bu[buName] || {};
        if (p === 'CTV')             bookedRaw += b[`ctv_${base}_booked`]  ?? 0;
        else if (p === 'Mobile')     bookedRaw += b[`mob_${base}_booked`]  ?? 0;
        else if (p === 'Mobile+CTV') bookedRaw += b[`mctv_${base}_booked`] ?? 0;
        else                         bookedRaw += b[`${base}_booked`]      ?? 0;
      });
    }

    clientCount = filteredClients.filter(c => clientFormatRev(c, base) > 0).length;
    return { rev: r2(rev), booked: r2(bookedRaw / 10000000), clients: clientCount };
  };

  // ── Build table ────────────────────────────────────────────────────────
  const headers = [
    {label:'Type / Format', w:'140px'},
    {label:'Del Rev',  right:true, w:'80px'},
    {label:'Booked',   right:true, w:'80px'},
    {label:'vs LM',    right:true, w:'72px'},
    {label:'vs LY',    right:true, w:'72px'},
    {label:'Clients',  right:true, w:'60px'},
    {label:'Share',    right:true, w:'52px'},
  ];

  const videoData   = (a === 'all' || a === 'Video')   ? getAdTypeData('Video',   md) : { rev:0, booked:0, clients:0 };
  const displayData = (a === 'all' || a === 'Display') ? getAdTypeData('Display', md) : { rev:0, booked:0, clients:0 };
  const shareDenom  = (videoData.rev + displayData.rev) || 1;

  let rows = '';
  let totalRevSum = 0, totalBookedSum = 0;
  let totalMomNum = 0, totalMomDen = 0, totalLyNum = 0, totalLyDen = 0;

  ['Video','Display'].forEach(adType => {
    const isVideo = adType === 'Video';
    const formats = isVideo ? vFormats : dFormats;
    const curr    = isVideo ? videoData : displayData;

    const formatMismatch = f !== 'all' && (
      (isVideo  && dFormats.includes(f)) ||
      (!isVideo && vFormats.includes(f))
    );
    const isTypeActive = (a === 'all' || a === adType) && !formatMismatch;

    const prior  = getAdTypeData(adType, priorMd);
    const ly     = getAdTypeData(adType, lyMd);
    const momPct = prior.rev > 0 ? r2(((curr.rev - prior.rev) / prior.rev) * 100) : null;
    const loyPct = ly.rev    > 0 ? r2(((curr.rev - ly.rev)    / ly.rev)    * 100) : null;
    const share  = curr.rev  > 0 ? Math.round((curr.rev / shareDenom) * 100)      : 0;
    const badgeCls = a === adType ? 'badge-green' : (isVideo ? 'badge-blue' : 'badge-amber');

    rows += `<tr style="${!isTypeActive ? 'opacity:0.3' : ''}background:var(--surface)">
      <td style="font-weight:500"><span class="badge ${badgeCls}">${adType}</span></td>
      <td style="text-align:right;font-family:var(--mono);font-weight:500">${fmtNum(curr.rev)} Cr</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${fmtNum(curr.booked)} Cr</td>
      <td style="text-align:right">${growthBadge(momPct)}</td>
      <td style="text-align:right">${growthBadge(loyPct)}</td>
      <td style="text-align:right;color:var(--ink-soft)">${curr.clients || '—'}</td>
      <td style="text-align:right;color:var(--ink-soft)">${share}%</td>
    </tr>`;

    if (!formatMismatch) {
      formats.forEach(fmt => {
        if (f !== 'all' && f !== fmt) return;
        const fd = getFormatData(fmt, adType, md);
        if (f === 'all' && fd.rev <= 0) return;
        const isFmtActive = f === 'all' || f === fmt;
        const fmtShare = fd.rev > 0 ? Math.round((fd.rev / shareDenom) * 100) : 0;
        rows += `<tr style="${!isFmtActive ? 'opacity:0.3' : ''}">
          <td style="padding-left:24px;color:var(--ink-soft);font-size:12px">${fmt}</td>
          <td style="text-align:right;font-family:var(--mono);font-size:12px">${fmtNum(fd.rev)} Cr</td>
          <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--ink-soft)">${fmtNum(fd.booked)} Cr</td>
          <td style="text-align:right;color:var(--ink-soft)">—</td>
          <td style="text-align:right;color:var(--ink-soft)">—</td>
          <td style="text-align:right;font-size:12px;color:var(--ink-soft)">${fd.clients}</td>
          <td style="text-align:right;font-size:12px;color:var(--ink-soft)">${fmtShare}%</td>
        </tr>`;
      });
    }

    if (isTypeActive) {
      totalRevSum    += curr.rev;
      totalBookedSum += curr.booked;
      if (prior.rev > 0) { totalMomNum += curr.rev - prior.rev; totalMomDen += prior.rev; }
      if (ly.rev    > 0) { totalLyNum  += curr.rev - ly.rev;    totalLyDen  += ly.rev;    }
    }
  });

  const totalMomPct = totalMomDen > 0 ? r2((totalMomNum / totalMomDen) * 100) : null;
  const totalLyPct  = totalLyDen  > 0 ? r2((totalLyNum  / totalLyDen)  * 100) : null;

  const totalUniqueClients = (() => {
    const fc = getFilteredClients(md);
    return fc.filter(c => clientRev(c, true) > 0 || clientRev(c, false) > 0).length;
  })();

  const totalRow = `<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">
    <td><span class="badge badge-gray">Total</span></td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600">${fmtNum(r2(totalRevSum))} Cr</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${fmtNum(r2(totalBookedSum))} Cr</td>
    <td style="text-align:right">${growthBadge(totalMomPct)}</td>
    <td style="text-align:right">${growthBadge(totalLyPct)}</td>
    <td style="text-align:right;color:var(--ink-soft)">${fmtInt(totalUniqueClients)}</td>
    <td style="text-align:right;color:var(--ink-soft)">100%</td>
  </tr>`;

  document.getElementById('adtype-panel').innerHTML = ptable(headers, rows + totalRow);
}

// ── Categories ────────────────────────────────────
function renderCategories(md) {
  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[lyMonthKey(CURRENT_MONTH)]    || null;

  const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
  const anyFilterActive = CURRENT_BU !== 'all' || CURRENT_AGENCY !== 'all' ||
                          p !== 'all' || a !== 'all' || f !== 'all';

  // ── Client rev for platform × adtype × format filters (no category scaling) ──
  const clientRevForFilters = (c) => {
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      if (p === 'CTV')        return c[`ctv_${base}_rev`]  ?? 0;
      if (p === 'Mobile')     return c[`mob_${base}_rev`]  ?? 0;
      if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`] ?? 0;
      return c[fk] ?? 0;
    }
    if (a === 'Video') {
      if (p === 'CTV')        return c.ctv_video_rev        ?? 0;
      if (p === 'Mobile')     return c.mob_video_rev        ?? 0;
      if (p === 'Mobile+CTV') return c.mobilectv_video_rev  ?? 0;
      return c.video_rev ?? 0;
    }
    if (a === 'Display') {
      if (p === 'CTV')        return c.ctv_display_rev        ?? 0;
      if (p === 'Mobile')     return c.mob_display_rev        ?? 0;
      if (p === 'Mobile+CTV') return c.mobilectv_display_rev  ?? 0;
      return c.display_rev ?? 0;
    }
    if (p === 'CTV')        return c.ctv_rev        ?? 0;
    if (p === 'Mobile')     return c.mobile_rev     ?? 0;
    if (p === 'Mobile+CTV') return c.mobilectv_rev  ?? 0;
    return c.del_rev ?? 0;
  };

  // ── Base clients: filtered by BU + agency only (NOT by category) ───────
  const getBaseClients = (monthData) => {
    if (!monthData) return [];
    let clients = (monthData.top_clients || []).slice();
    clients = filterClientsByBU(clients, CURRENT_BU);
    if (CURRENT_AGENCY !== 'all') clients = clients.filter(c =>
      c.agency === CURRENT_AGENCY ||
      (c.agency_rev_map && c.agency_rev_map[CURRENT_AGENCY] > 0)
    );
    return clients;
  };

  // ── Core aggregator for one category row ────────────────────────────────
  const getCatData = (catName, monthData) => {
    if (!monthData) return { rev: 0, booked: 0, clients: 0 };

    // Pure stored path: no filters → exact match with Excel
    if (!anyFilterActive) {
      const stored = (monthData.categories || []).find(c => c.name === catName) || {};
      return {
        rev:     stored.del_rev || 0,
        booked:  r2((stored.booked_rev || 0) / 10000000),
        clients: stored.clients || 0,
      };
    }

    // All filtered cases: aggregate from clients
    // Primary filter: c.category === catName (always populated, no map needed)
    // Secondary: also catch multi-category clients via category_rev_map if available
    const baseClients = getBaseClients(monthData);

    let rev = 0, bookedRaw = 0;
    const clientSet = new Set();

    baseClients.forEach(c => {
      // Determine if this client belongs to this category and at what scale
      let catScale;
      if (c.category === catName) {
        // Primary category — full weight
        catScale = 1;
      } else if (c.category_rev_map && c.category_rev_map[catName] > 0 && c.del_rev > 0) {
        // Multi-category client — scale by this category's share of their total
        catScale = c.category_rev_map[catName] / c.del_rev;
      } else {
        return; // not in this category
      }

      const filteredRev = clientRevForFilters(c);
      const contribution = filteredRev * catScale;
      // Note: even if contribution is 0 (e.g. format mismatch), still count client
      // in clientSet only if they actually contributed
      if (contribution > 0) {
        rev       += contribution;
        // Pro-rate booked by the same ratio as filtered contribution vs total client rev
        // This ensures adtype/platform/format filters affect booked proportionally
        bookedRaw += c.del_rev > 0
          ? (c.booked_rev || 0) * (contribution / c.del_rev)
          : 0;
        clientSet.add(c.name);
      }
    });

    return { rev: r2(rev), booked: r2(bookedRaw / 10000000), clients: clientSet.size };
  };

  // ── Build rows ──────────────────────────────────────────────────────────
  const catList = md.categories || [];

  // Compute all revs first so share denominator is based on filtered total
  const allRevs    = catList.map(cat => getCatData(cat.name, md));
  const shareDenom = allRevs.reduce((t, d) => t + d.rev, 0) || 1;

  const headers = [
    {label:'#',       w:'28px'},
    {label:'Category'},
    {label:'Del Rev', right:true, w:'80px'},
    {label:'Booked',  right:true, w:'80px'},
    {label:'vs LM',   right:true, w:'72px'},
    {label:'vs LY',   right:true, w:'72px'},
    {label:'Clients', right:true, w:'60px'},
    {label:'Share',   right:true, w:'52px'},
  ];

  let rows = '';
  let totalRev = 0, totalBooked = 0;
  let totalMomNum = 0, totalMomDen = 0, totalLyNum = 0, totalLyDen = 0;

  catList.forEach((cat, i) => {
    const curr  = allRevs[i];
    const prior = getCatData(cat.name, priorMd);
    const ly    = getCatData(cat.name, lyMd);

    // Skip rows with zero rev when any filter is active (keep table clean)
    if (curr.rev <= 0 && anyFilterActive) return;

    const momPct  = prior.rev > 0 ? r2(((curr.rev - prior.rev) / prior.rev) * 100) : null;
    const loyPct  = ly.rev    > 0 ? r2(((curr.rev - ly.rev)    / ly.rev)    * 100) : null;
    const share   = curr.rev  > 0 ? Math.round((curr.rev / shareDenom) * 100)       : 0;
    const isActive = CURRENT_CATEGORY === 'all' || CURRENT_CATEGORY === cat.name;

    rows += `<tr style="${!isActive ? 'opacity:0.3' : ''}">
      <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${i+1}</td>
      <td style="font-weight:500">${cat.name} ${momPct !== null ? (momPct >= 20 ? '<span style="color:var(--green);font-size:11px">↑↑</span>' : momPct >= 5 ? '<span style="color:var(--green);font-size:11px">↑</span>' : momPct <= -20 ? '<span style="color:var(--red);font-size:11px">↓↓</span>' : momPct <= -5 ? '<span style="color:var(--red);font-size:11px">↓</span>' : '') : ''}</td>
      <td style="text-align:right;font-family:var(--mono);font-weight:500">${fmtNum(curr.rev)} Cr</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${fmtNum(curr.booked)} Cr</td>
      <td style="text-align:right">${growthBadge(momPct)}</td>
      <td style="text-align:right">${growthBadge(loyPct)}</td>
      <td style="text-align:right;color:var(--ink-soft)">${curr.clients || '—'}</td>
      <td style="text-align:right;color:var(--ink-soft)">${share}%</td>
    </tr>`;

    if (isActive) {
      totalRev    += curr.rev;
      totalBooked += curr.booked;
      if (prior.rev > 0) { totalMomNum += curr.rev - prior.rev; totalMomDen += prior.rev; }
      if (ly.rev    > 0) { totalLyNum  += curr.rev - ly.rev;    totalLyDen  += ly.rev;    }
    }
  });

  const totalMomPct = totalMomDen > 0 ? r2((totalMomNum / totalMomDen) * 100) : null;
  const totalLyPct  = totalLyDen  > 0 ? r2((totalLyNum  / totalLyDen)  * 100) : null;

  // Total unique clients across filtered base pool
  const totalUniqueClients = (() => {
    if (!anyFilterActive) return md.total_clients || 0;
    const bc = getBaseClients(md);
    return bc.filter(c => clientRevForFilters(c) > 0).length;
  })();

  const totalRow = `<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">
    <td></td>
    <td><span class="badge badge-gray">Total</span></td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600">${fmtNum(r2(totalRev))} Cr</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${fmtNum(r2(totalBooked))} Cr</td>
    <td style="text-align:right">${growthBadge(totalMomPct)}</td>
    <td style="text-align:right">${growthBadge(totalLyPct)}</td>
    <td style="text-align:right;color:var(--ink-soft)">${fmtInt(totalUniqueClients)}</td>
    <td style="text-align:right;color:var(--ink-soft)">100%</td>
  </tr>`;

  document.getElementById('category-panel').innerHTML = ptable(headers, rows + totalRow);
}

// ── Agencies ──────────────────────────────────────
function renderAgencies(md) {
  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[lyMonthKey(CURRENT_MONTH)]    || null;

  const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
  const anyFilterActive = CURRENT_BU !== 'all' || CURRENT_CATEGORY !== 'all' ||
                          p !== 'all' || a !== 'all' || f !== 'all';

  // ── Client rev for platform × adtype × format filters only ─────────────
  const clientRevForFilters = (c) => {
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      if (p === 'CTV')        return c[`ctv_${base}_rev`]  ?? 0;
      if (p === 'Mobile')     return c[`mob_${base}_rev`]  ?? 0;
      if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`] ?? 0;
      return c[fk] ?? 0;
    }
    if (a === 'Video') {
      if (p === 'CTV')        return c.ctv_video_rev        ?? 0;
      if (p === 'Mobile')     return c.mob_video_rev        ?? 0;
      if (p === 'Mobile+CTV') return c.mobilectv_video_rev  ?? 0;
      return c.video_rev ?? 0;
    }
    if (a === 'Display') {
      if (p === 'CTV')        return c.ctv_display_rev        ?? 0;
      if (p === 'Mobile')     return c.mob_display_rev        ?? 0;
      if (p === 'Mobile+CTV') return c.mobilectv_display_rev  ?? 0;
      return c.display_rev ?? 0;
    }
    if (p === 'CTV')        return c.ctv_rev        ?? 0;
    if (p === 'Mobile')     return c.mobile_rev     ?? 0;
    if (p === 'Mobile+CTV') return c.mobilectv_rev  ?? 0;
    return c.del_rev ?? 0;
  };

  // ── Base clients: filtered by BU + category only (NOT by agency) ────────
  const getBaseClients = (monthData) => {
    if (!monthData) return [];
    let clients = (monthData.top_clients || []).slice();
    clients = filterClientsByBU(clients, CURRENT_BU);
    if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c =>
      c.category === CURRENT_CATEGORY ||
      (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0)
    );
    return clients;
  };

  // ── Core aggregator for one agency row ──────────────────────────────────
  const getAgData = (agName, monthData) => {
    if (!monthData) return { rev: 0, booked: 0, clients: 0 };

    // Pure stored path: no filters → exact
    if (!anyFilterActive) {
      const stored = (monthData.agencies || []).find(ag => ag.name === agName) || {};
      return {
        rev:     stored.del_rev || 0,
        booked:  r2((stored.booked_rev || 0) / 10000000),
        clients: stored.clients || 0,
      };
    }

    

    // Full client aggregation for everything else
    const baseClients = getBaseClients(monthData);
    let rev = 0, bookedRaw = 0;
    const clientSet = new Set();

    baseClients.forEach(c => {
      // Determine if this client belongs to this agency and at what scale
      let agScale;
      if (c.agency === agName) {
        agScale = 1;
      } else if (c.agency_rev_map && c.agency_rev_map[agName] > 0 && c.del_rev > 0) {
        agScale = c.agency_rev_map[agName] / c.del_rev;
      } else {
        return;
      }

      const filteredRev  = clientRevForFilters(c);
      const contribution = filteredRev * agScale;
      if (contribution <= 0) return;

      rev       += contribution;
      bookedRaw += c.del_rev > 0
        ? (c.booked_rev || 0) * (contribution / c.del_rev)
        : 0;
      clientSet.add(c.name);
    });

    return { rev: r2(rev), booked: r2(bookedRaw / 10000000), clients: clientSet.size };
  };

  // ── Build rows ──────────────────────────────────────────────────────────
  const agList = md.agencies || [];

  const allRevs    = agList.map(ag => getAgData(ag.name, md));
  const shareDenom = allRevs.reduce((t, d) => t + d.rev, 0) || 1;

  const headers = [
    {label:'#',       w:'28px'},
    {label:'Agency'},
    {label:'Del Rev', right:true, w:'80px'},
    {label:'Booked',  right:true, w:'80px'},
    {label:'vs LM',   right:true, w:'72px'},
    {label:'vs LY',   right:true, w:'72px'},
    {label:'Clients', right:true, w:'60px'},
    {label:'Share',   right:true, w:'52px'},
  ];

  let rows = '';
  let totalRev = 0, totalBooked = 0;
  let totalMomNum = 0, totalMomDen = 0, totalLyNum = 0, totalLyDen = 0;

  agList.forEach((ag, i) => {
    const curr  = allRevs[i];
    const prior = getAgData(ag.name, priorMd);
    const ly    = getAgData(ag.name, lyMd);

    if (curr.rev <= 0 && anyFilterActive) return;

    const momPct   = prior.rev > 0 ? r2(((curr.rev - prior.rev) / prior.rev) * 100) : null;
    const loyPct   = ly.rev    > 0 ? r2(((curr.rev - ly.rev)    / ly.rev)    * 100) : null;
    const share    = curr.rev  > 0 ? Math.round((curr.rev / shareDenom) * 100)       : 0;
    const isActive = CURRENT_AGENCY === 'all' || CURRENT_AGENCY === ag.name;

    rows += `<tr style="${!isActive ? 'opacity:0.3' : ''}">
      <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${i+1}</td>
      <td style="font-weight:500">${ag.name}</td>
      <td style="text-align:right;font-family:var(--mono);font-weight:500">${fmtNum(curr.rev)} Cr</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${fmtNum(curr.booked)} Cr</td>
      <td style="text-align:right">${growthBadge(momPct)}</td>
      <td style="text-align:right">${growthBadge(loyPct)}</td>
      <td style="text-align:right;color:var(--ink-soft)">${curr.clients || '—'}</td>
      <td style="text-align:right;color:var(--ink-soft)">${share}%</td>
    </tr>`;

    if (isActive) {
      totalRev    += curr.rev;
      totalBooked += curr.booked;
      if (prior.rev > 0) { totalMomNum += curr.rev - prior.rev; totalMomDen += prior.rev; }
      if (ly.rev    > 0) { totalLyNum  += curr.rev - ly.rev;    totalLyDen  += ly.rev;    }
    }
  });

  const totalMomPct = totalMomDen > 0 ? r2((totalMomNum / totalMomDen) * 100) : null;
  const totalLyPct  = totalLyDen  > 0 ? r2((totalLyNum  / totalLyDen)  * 100) : null;

  const totalUniqueClients = (() => {
    if (!anyFilterActive) return (md.agencies || []).reduce((t, ag) => t + (ag.clients||0), 0);
    const bc = getBaseClients(md);
    return bc.filter(c => clientRevForFilters(c) > 0).length;
  })();

  const totalRow = `<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">
    <td></td>
    <td><span class="badge badge-gray">Total</span></td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600">${fmtNum(r2(totalRev))} Cr</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${fmtNum(r2(totalBooked))} Cr</td>
    <td style="text-align:right">${growthBadge(totalMomPct)}</td>
    <td style="text-align:right">${growthBadge(totalLyPct)}</td>
    <td style="text-align:right;color:var(--ink-soft)">${fmtInt(totalUniqueClients)}</td>
    <td style="text-align:right;color:var(--ink-soft)">100%</td>
  </tr>`;

  document.getElementById('agency-panel').innerHTML = ptable(headers, rows + totalRow);
}

// ── Top Clients ───────────────────────────────────
function renderClients(md) {
  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[lyMonthKey(CURRENT_MONTH)]    || null;
  const lyClientNames    = new Set((lyMd?.top_clients    || []).map(c => c.name));
  const priorClientNames = new Set((priorMd?.top_clients || []).map(c => c.name));
  const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;

  // ── Same clientRevForFilters as other tables ─────────────────────────
  const clientRevForFilters = (c) => {
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      if (p === 'CTV')        return c[`ctv_${base}_rev`]  ?? 0;
      if (p === 'Mobile')     return c[`mob_${base}_rev`]  ?? 0;
      if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`] ?? 0;
      return c[fk] ?? 0;
    }
    if (a === 'Video') {
      if (p === 'CTV')        return c.ctv_video_rev        ?? 0;
      if (p === 'Mobile')     return c.mob_video_rev        ?? 0;
      if (p === 'Mobile+CTV') return c.mobilectv_video_rev  ?? 0;
      return c.video_rev ?? 0;
    }
    if (a === 'Display') {
      if (p === 'CTV')        return c.ctv_display_rev        ?? 0;
      if (p === 'Mobile')     return c.mob_display_rev        ?? 0;
      if (p === 'Mobile+CTV') return c.mobilectv_display_rev  ?? 0;
      return c.display_rev ?? 0;
    }
    if (p === 'CTV')        return c.ctv_rev        ?? 0;
    if (p === 'Mobile')     return c.mobile_rev     ?? 0;
    if (p === 'Mobile+CTV') return c.mobilectv_rev  ?? 0;
    return c.del_rev ?? 0;
  };

  // ── Filter pool ──────────────────────────────────────────────────────
  let clients = (md.top_clients || []).slice();
  clients = filterClientsByBU(clients, CURRENT_BU);
  if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c =>
    c.category === CURRENT_CATEGORY ||
    (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0)
  );
  if (CURRENT_AGENCY !== 'all') clients = clients.filter(c =>
    c.agency === CURRENT_AGENCY ||
    (c.agency_rev_map && c.agency_rev_map[CURRENT_AGENCY] > 0)
  );

  // ── Attach filtered rev to each client, then sort + slice ────────────
  clients = clients.map(c => ({
    ...c,
    _filteredRev:    clientRevForFilters(c),
    _filteredBooked: c.del_rev > 0
      ? r2((c.booked_rev || 0) * (clientRevForFilters(c) / c.del_rev) / 10000000)
      : 0,
  }));
  clients.sort((a, b) => b._filteredRev - a._filteredRev);
  clients = clients.filter(c => c._filteredRev > 0);
  clients = clients.slice(0, 20);

  // ── Panel title ──────────────────────────────────────────────────────
  const parts = [CURRENT_BU, p, a, f, CURRENT_CATEGORY, CURRENT_AGENCY].filter(v => v !== 'all');
  document.getElementById('clients-panel-title').textContent =
    'Top Clients' + (parts.length ? '  —  ' + parts.join(' · ') : '');

  if (!clients.length) {
    document.getElementById('clients-panel').innerHTML =
      '<div style="padding:24px 18px;color:var(--ink-soft);font-size:13px">No clients match the selected filters.</div>';
    return;
  }

  // ── Share denominator = sum of all filtered clients' rev ─────────────
  const shareDenom = clients.reduce((t, c) => t + c._filteredRev, 0) || 1;

  // ── Rev label ────────────────────────────────────────────────────────
  const revLabel = f !== 'all' ? f
    : a !== 'all' && p !== 'all' ? `${p} · ${a}`
    : p !== 'all' ? p
    : a !== 'all' ? a
    : 'Del Rev';

  // ── Rows ─────────────────────────────────────────────────────────────
  let totalRev = 0, totalBooked = 0;
  const rowsHtml = clients.map((c, i) => {
    const rev    = c._filteredRev;
    const booked = c._filteredBooked;
    const share  = rev > 0 ? Math.round((rev / shareDenom) * 100) : 0;
    totalRev    += rev;
    totalBooked += booked;

    const hasBrands = c.brands && c.brands.length > 0;
    const brandRows = hasBrands ? c.brands.map(b =>
      `<tr class="brand-row" id="brands-${i}" style="display:none;background:var(--surface)">
        <td></td>
        <td colspan="2" style="padding-left:28px;font-size:11px;color:var(--ink-soft)">↳ ${b.name}</td>
        <td style="text-align:right;font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${fmtNum(b.del_rev)} Cr</td>
        <td colspan="5"></td>
      </tr>`
    ).join('') : '';

    const expandBtn = hasBrands
      ? `<button onclick="toggleBrands(${i},this)" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--accent);padding:0 4px;font-family:var(--mono)">+</button>`
      : '';

    return `<tr>
      <td class="rank">${i+1}</td>
      <td><span style="font-weight:500;cursor:pointer;color:var(--accent);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px" onclick="openClientDive('${c.name.replace(/'/g, "\\'")}')">${c.name}</span>${expandBtn}</td>
      <td><span class="badge badge-blue">${c.bu}</span></td>
      <td style="font-family:var(--mono);font-weight:500;text-align:right">${fmtNum(rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right">${fmtNum(booked)} Cr</td>
      <td style="font-size:12px;color:var(--ink-soft)">${c.category||'—'}</td>
<td style="font-size:11px">${lyClientNames.has(c.name) ? '<span style="color:var(--green)">🔄 Repeat</span>' : '<span style="color:var(--accent)">🆕 New</span>'}</td>
      <td style="font-size:12px;color:var(--ink-soft)">${c.agency||'—'}</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.video_rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.display_rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.ctv_rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.mobile_rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.mobilectv_rev)} Cr</td>
      <td>${(() => {
        const h = clientHealthScore(c.name, rev);
        return `<span title="${h.label} — based on 3-month trend, vs last year, and repeat status"
          style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:500;
          color:${h.color};background:${h.color}18;padding:2px 8px;border-radius:10px;cursor:default">
          <span style="width:6px;height:6px;border-radius:50%;background:${h.color};flex-shrink:0"></span>
          ${h.label}
        </span>`;
      })()}</td>
      <td style="text-align:right;color:var(--ink-soft);font-size:12px">${share}%</td>
    </tr>${brandRows}`;
  }).join('');

  const totalRow = `<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">
    <td></td>
    <td><span class="badge badge-gray">Total (Top ${clients.length})</span></td>
    <td></td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600">${fmtNum(r2(totalRev))} Cr</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${fmtNum(r2(totalBooked))} Cr</td>
    <td colspan="7"></td>
    <td style="text-align:right;color:var(--ink-soft)">100%</td>
  </tr>`;

  document.getElementById('clients-panel').innerHTML = `
    <div style="overflow-x:auto">
      <table class="ptable">
        <thead><tr>
          <th style="min-width:28px">#</th>
          <th>Client</th>
          <th>BU</th>
          <th style="text-align:right;min-width:76px">${revLabel}</th>
          <th style="text-align:right;min-width:76px">Booked</th>
          <th>Category</th>
          <th>vs LY</th>
          <th>Agency</th>
          <th style="text-align:right;min-width:68px">Video</th>
          <th style="text-align:right;min-width:68px">Display</th>
          <th style="text-align:right;min-width:68px">CTV</th>
          <th style="text-align:right;min-width:68px">Mobile</th>
          <th style="text-align:right;min-width:68px">Mob+CTV</th>
          <th style="min-width:60px">Health</th>
          <th style="text-align:right;min-width:52px">Share</th>
        </tr></thead>
        <tbody>${rowsHtml}${totalRow}</tbody>
      </table>
    </div>`;
}
// ── Client Health Score ───────────────────────────
function clientHealthScore(clientName, currentRev) {
  const priorMd  = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const prior2Md = DATA.months[priorMonthKey(priorMonthKey(CURRENT_MONTH))] || null;
  const lyMd     = DATA.months[lyMonthKey(CURRENT_MONTH)] || null;

  const findRev = (md) => {
    if (!md) return null;
    const c = (md.top_clients || []).find(x => x.name === clientName);
    return c ? r2(c.del_rev || 0) : null;
  };

  const priorRev  = findRev(priorMd);
  const prior2Rev = findRev(prior2Md);
  const lyRev     = findRev(lyMd);

  let score = 0;

  // ── Signal 1: 3-month revenue trend (weight 40) ──
  if (priorRev !== null && prior2Rev !== null) {
    if (currentRev > priorRev && priorRev > prior2Rev)       score += 40; // growing
    else if (currentRev > priorRev || priorRev >= prior2Rev) score += 20; // mixed
    else                                                      score += 0;  // declining
  } else if (priorRev !== null) {
    score += currentRev >= priorRev ? 30 : 10;
  } else {
    score += 20; // no prior data — neutral
  }

  // ── Signal 2: vs last year (weight 30) ───────────
  if (lyRev !== null && lyRev > 0) {
    const lyPct = ((currentRev - lyRev) / lyRev) * 100;
    if (lyPct >= 10)       score += 30;
    else if (lyPct >= -10) score += 15;
    else                   score += 0;
  } else {
    score += 15; // no LY data — neutral
  }

  // ── Signal 3: repeat vs new (weight 20) ──────────
  if (lyRev !== null && lyRev > 0) score += 20; // was active last year = repeat
  else                              score += 10; // new client — neutral not penalised

  // ── Signal 4: prior month momentum (weight 10) ───
  if (priorRev !== null && priorRev > 0) {
    const mom = ((currentRev - priorRev) / priorRev) * 100;
    if (mom >= 0) score += 10;
    else          score += 0;
  } else {
    score += 5;
  }

  // ── Map score to status ───────────────────────────
  // Max possible = 100
  if (score >= 70) return { status: 'healthy', color: '#10B981', label: 'Healthy',  dot: '🟢' };
  if (score >= 40) return { status: 'watch',   color: '#F59E0B', label: 'Watch',    dot: '🟡' };
  return             { status: 'risk',    color: '#EF4444', label: 'At Risk',  dot: '🔴' };
}
// ── New Client Cohort Health ──────────────────────
function renderCohort() {
  const panel = document.getElementById('cohort-panel');
  if (!panel || !DATA || !CURRENT_MONTH) return;

  // Cohort month = 12 months ago
  const cohortMKey = (() => {
    let y = parseInt(CURRENT_MONTH.slice(0,4));
    let m = parseInt(CURRENT_MONTH.slice(5,7)) - 12;
    while (m < 1) { m += 12; y--; }
    return y + '-' + String(m).padStart(2,'0');
  })();

  const cohortMd  = DATA.months[cohortMKey];
  const currentMd = DATA.months[CURRENT_MONTH];

  if (!cohortMd || !currentMd) {
    panel.innerHTML = '<div style="padding:20px 18px;color:var(--ink-soft);font-size:13px">Not enough historical data to build a 12-month cohort.</div>';
    return;
  }

  // ── Find clients who were NEW in cohort month ─────
  // "New" = appeared in cohortMKey but NOT in any earlier month
  const priorToCohorKeys = DATA.available_months.filter(k => k < cohortMKey);
  const priorNames = new Set();
  priorToCohorKeys.forEach(k => {
    (DATA.months[k]?.top_clients || []).forEach(c => priorNames.add(c.name));
  });

  const cohortClients = (cohortMd.top_clients || []).filter(c => !priorNames.has(c.name));

  if (!cohortClients.length) {
    panel.innerHTML = '<div style="padding:20px 18px;color:var(--ink-soft);font-size:13px">No new clients found in the cohort month (' + (cohortMd.label || cohortMKey) + ').</div>';
    return;
  }

  // ── Check current status of each cohort client ────
  const currentNames = new Map((currentMd.top_clients || []).map(c => [c.name, c]));

  const cohortRows = cohortClients.map(c => {
    const currentClient = currentNames.get(c.name);
    const currentRev    = currentClient ? r2(currentClient.del_rev || 0) : 0;
    const firstRev      = r2(c.del_rev || 0);
    const retained      = currentRev > 0;
    const grew          = retained && currentRev > firstRev;
    const growthPct     = retained && firstRev > 0
      ? r2(((currentRev - firstRev) / firstRev) * 100) : null;

    return {
      name:       c.name,
      bu:         c.bu || '—',
      category:   c.category || '—',
      agency:     c.agency   || '—',
      firstRev,
      currentRev,
      retained,
      grew,
      growthPct,
    };
  }).sort((a, b) => b.firstRev - a.firstRev);

  // ── Summary numbers ───────────────────────────────
  const total    = cohortRows.length;
  const retained = cohortRows.filter(c => c.retained).length;
  const grew     = cohortRows.filter(c => c.grew).length;
  const churned  = total - retained;
  const retRate  = total > 0 ? Math.round((retained / total) * 100) : 0;
  const growRate  = retained > 0 ? Math.round((grew / retained) * 100) : 0;

  // ── Funnel bar ────────────────────────────────────
  const funnelHtml = `
    <div style="display:flex;align-items:center;gap:0;height:10px;border-radius:6px;overflow:hidden;margin-top:10px;width:100%">
      <div style="flex:${grew};background:#10B981;transition:flex 0.4s"></div>
      <div style="flex:${retained - grew};background:#3B82F6;transition:flex 0.4s"></div>
      <div style="flex:${churned};background:#EF4444;opacity:0.35;transition:flex 0.4s"></div>
    </div>
    <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-soft)"><div style="width:8px;height:8px;border-radius:2px;background:#10B981"></div>Retained & Grew (${grew})</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-soft)"><div style="width:8px;height:8px;border-radius:2px;background:#3B82F6"></div>Retained Flat (${retained - grew})</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-soft)"><div style="width:8px;height:8px;border-radius:2px;background:#EF4444;opacity:0.6"></div>Churned (${churned})</div>
    </div>`;

  // ── Summary card ──────────────────────────────────
  const summaryHtml = `
    <div style="display:flex;gap:12px;padding:16px 18px 12px;flex-wrap:wrap;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:120px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-soft);margin-bottom:4px">Cohort Month</div>
        <div style="font-size:18px;font-weight:600;color:var(--ink)">${cohortMd.label || cohortMKey}</div>
        <div style="font-size:11px;color:var(--ink-soft);margin-top:2px">${total} new clients</div>
      </div>
      <div style="flex:1;min-width:120px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-soft);margin-bottom:4px">Retention Rate</div>
        <div style="font-size:28px;font-weight:600;color:${retRate >= 60 ? 'var(--green)' : retRate >= 40 ? 'var(--amber)' : 'var(--red)'}">${retRate}%</div>
        <div style="font-size:11px;color:var(--ink-soft);margin-top:2px">${retained} of ${total} still active</div>
      </div>
      <div style="flex:1;min-width:120px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-soft);margin-bottom:4px">Growth Rate</div>
        <div style="font-size:28px;font-weight:600;color:${growRate >= 50 ? 'var(--green)' : 'var(--amber)'}">${growRate}%</div>
        <div style="font-size:11px;color:var(--ink-soft);margin-top:2px">${grew} of ${retained} retained grew spend</div>
      </div>
      <div style="flex:2;min-width:200px;padding-top:4px">
        ${funnelHtml}
      </div>
    </div>`;

  // ── Table ─────────────────────────────────────────
  const headers = [
    { label: '#',            w: '28px'  },
    { label: 'Client'                   },
    { label: 'BU',           w: '60px'  },
    { label: 'Category'                 },
    { label: 'First Rev',    right: true, w: '84px' },
    { label: 'Now Rev',      right: true, w: '84px' },
    { label: 'Growth',       right: true, w: '80px' },
    { label: 'Status',       w: '130px' },
  ];

  const ths = headers.map(h =>
    `<th style="text-align:${h.right ? 'right' : 'left'};min-width:${h.w || 'auto'}">${h.label}</th>`
  ).join('');

  const rows = cohortRows.map((c, i) => {
    const buCls = { LCS1:'badge-green', LCS2:'badge-blue', MM1:'badge-amber', MM2:'badge-red' }[c.bu] || 'badge-gray';

    let statusBadge;
    if (!c.retained) {
      statusBadge = `<span style="font-size:11px;font-weight:500;color:var(--red);background:var(--red-soft);padding:2px 8px;border-radius:10px">● Churned</span>`;
    } else if (c.grew) {
      statusBadge = `<span style="font-size:11px;font-weight:500;color:var(--green);background:var(--green-soft);padding:2px 8px;border-radius:10px">↑ Retained & Grew</span>`;
    } else {
      statusBadge = `<span style="font-size:11px;font-weight:500;color:var(--accent);background:var(--accent-soft);padding:2px 8px;border-radius:10px">→ Retained Flat</span>`;
    }

    const nowCell = c.retained
      ? `<span style="font-family:var(--mono);font-weight:500">${fmtNum(c.currentRev)} Cr</span>`
      : `<span style="color:var(--ink-faint)">—</span>`;

    const growthCell = c.growthPct !== null
      ? growthBadge(c.growthPct)
      : `<span style="color:var(--ink-faint)">—</span>`;

    return `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${i + 1}</td>
      <td style="font-weight:500">${c.name}</td>
      <td><span class="badge ${buCls}">${c.bu}</span></td>
      <td style="font-size:12px;color:var(--ink-soft)">${c.category}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${fmtNum(c.firstRev)} Cr</td>
      <td style="text-align:right">${nowCell}</td>
      <td style="text-align:right">${growthCell}</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join('');

  panel.innerHTML = summaryHtml + `
    <div style="overflow-x:auto">
      <table class="ptable">
        <thead><tr>${ths}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
// ── Churner Watch ─────────────────────────────────
function renderChurners() {
  const panel = document.getElementById('churner-panel');
  if (!panel || !DATA || !CURRENT_MONTH) return;

  const md = DATA.months[CURRENT_MONTH];
  if (!md) return;

  // All client names active this month
  const currentNames = new Set((md.top_clients || []).map(c => c.name));

  // Walk every past month and build churner profile map
  const churnerMap = {};

  DATA.available_months.forEach(mkey => {
    if (mkey >= CURRENT_MONTH) return;
    const mdata = DATA.months[mkey];
    if (!mdata) return;

    (mdata.top_clients || []).forEach(c => {
      if (currentNames.has(c.name)) return; // still active

      // Dominant platform in this month for this client
      const ctvRev    = c.ctv_rev       || 0;
      const mobRev    = c.mobile_rev    || 0;
      const mctvRev   = c.mobilectv_rev || 0;
      const platPeak  = Math.max(ctvRev, mobRev, mctvRev);
      const platLabel = platPeak === 0 ? '—'
        : platPeak === ctvRev    ? 'CTV'
        : platPeak === mobRev    ? 'Mobile'
        : 'Mobile+CTV';

      if (!churnerMap[c.name]) {
        churnerMap[c.name] = {
          name:      c.name,
          bu:        c.bu,
          category:  c.category || '—',
          agency:    c.agency   || '—',
          lastMonth: mkey,
          lastRev:   c.del_rev,
          lastPlat:  platLabel,
          peakRev:   c.del_rev,
          peakMonth: mkey,
        };
      } else {
        if (mkey > churnerMap[c.name].lastMonth) {
          churnerMap[c.name].lastMonth = mkey;
          churnerMap[c.name].lastRev   = c.del_rev;
          churnerMap[c.name].lastPlat  = platLabel;
        }
        if (c.del_rev > churnerMap[c.name].peakRev) {
          churnerMap[c.name].peakRev   = c.del_rev;
          churnerMap[c.name].peakMonth = mkey;
        }
      }
    });
  });

  // Filter to last 12 months only, sort by peak revenue
  const churners = Object.values(churnerMap)
    .filter(c => {
      const gone = monthDiff(c.lastMonth, CURRENT_MONTH);
      if (gone < 1 || gone > 12) return false;
      if (CURRENT_BU !== 'all' && CURRENT_BU !== 'Others') {
        if (c.bu !== CURRENT_BU) return false;
      }
      if (CURRENT_BU === 'Others') {
        if (MAIN_BUS.includes(c.bu)) return false;
      }
      if (CURRENT_CATEGORY !== 'all' && c.category !== CURRENT_CATEGORY) return false;
      if (CURRENT_AGENCY   !== 'all' && c.agency   !== CURRENT_AGENCY)   return false;
      return true;
    })
    .sort((a, b) => b.peakRev - a.peakRev)
    .slice(0, 20);

  if (!churners.length) {
    panel.innerHTML = '<div style="padding:24px 18px;color:var(--ink-soft);font-size:13px">No churned clients found in the last 12 months.</div>';
    return;
  }

  const headers = [
    { label: '#',            w: '28px'  },
    { label: 'Client'                   },
    { label: 'BU',           w: '60px'  },
    { label: 'Category'                 },
    { label: 'Agency'                   },
    { label: 'Last active',  right: true, w: '100px' },
    { label: 'Months gone',  right: true, w: '90px'  },
    { label: 'Last platform',            w: '110px'  },
    { label: 'Peak Rev',     right: true, w: '84px'  },
    { label: 'Peak month',   right: true, w: '96px'  },
  ];

  const ths = headers.map(h =>
    `<th style="text-align:${h.right ? 'right' : 'left'};min-width:${h.w || 'auto'}">${h.label}</th>`
  ).join('');

  const rows = churners.map((c, i) => {
    const gone = monthDiff(c.lastMonth, CURRENT_MONTH);

    // Urgency signal
    let urgencyColor, urgencyLabel;
    if (gone <= 2) {
      urgencyColor = 'var(--red)';
      urgencyLabel = gone === 1 ? '1 month' : '2 months';
    } else if (gone <= 6) {
      urgencyColor = 'var(--amber)';
      urgencyLabel = gone + ' months';
    } else {
      urgencyColor = 'var(--ink-faint)';
      urgencyLabel = gone + ' months';
    }

    // Friendly month label
    const lastLabel  = DATA.months[c.lastMonth]  ? DATA.months[c.lastMonth].label  : c.lastMonth;
    const peakLabel  = DATA.months[c.peakMonth]  ? DATA.months[c.peakMonth].label  : c.peakMonth;
    const buCls      = { LCS1:'badge-green', LCS2:'badge-blue', MM1:'badge-amber', MM2:'badge-red' }[c.bu] || 'badge-gray';

    const platCls = c.lastPlat === 'CTV' ? 'badge-green'
      : c.lastPlat === 'Mobile'          ? 'badge-blue'
      : c.lastPlat === 'Mobile+CTV'      ? 'badge-amber'
      : 'badge-gray';

    return `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${i + 1}</td>
      <td style="font-weight:500">${c.name}</td>
      <td><span class="badge ${buCls}">${c.bu}</span></td>
      <td style="font-size:12px;color:var(--ink-soft)">${c.category}</td>
      <td style="font-size:12px;color:var(--ink-soft)">${c.agency}</td>
      <td style="text-align:right;font-size:12px;color:var(--ink-soft)">${lastLabel}</td>
      <td style="text-align:right">
        <span style="font-size:12px;font-weight:500;color:${urgencyColor}">${urgencyLabel}</span>
      </td>
      <td><span class="badge ${platCls}">${c.lastPlat}</span></td>
      <td style="text-align:right;font-family:var(--mono);font-weight:500;color:var(--ink)">${fmtNum(c.peakRev)} Cr</td>
      <td style="text-align:right;font-size:12px;color:var(--ink-soft)">${peakLabel}</td>
    </tr>`;
  }).join('');

  panel.innerHTML = `<div style="overflow-x:auto"><table class="ptable">
    <thead><tr>${ths}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ── Month difference helper ────────────────────────
function monthDiff(from, to) {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
// Toggle brand rows
function toggleBrands(idx, btn) {
  const brandRows = document.querySelectorAll(`#brands-${idx}`);
  const isHidden = brandRows[0]?.style.display === 'none';
  brandRows.forEach(r => r.style.display = isHidden ? 'table-row' : 'none');
  btn.textContent = isHidden ? '−' : '+';
}
// ── Client Deep-Dive ──────────────────────────────
function openClientDive(clientName) {
  if (!DATA || !CURRENT_MONTH) return;

  // ── Gather 27-month history for this client ───────
  const history = [];
  DATA.available_months.forEach(mkey => {
    const mdata = DATA.months[mkey];
    if (!mdata) return;
    const client = (mdata.top_clients || []).find(c => c.name === clientName);
    history.push({
      mkey,
      label:      mdata.label || mkey,
      del_rev:    client ? r2(client.del_rev    || 0) : 0,
      ctv_rev:    client ? r2(client.ctv_rev    || 0) : 0,
      mobile_rev: client ? r2(client.mobile_rev || 0) : 0,
      video_rev:  client ? r2(client.video_rev  || 0) : 0,
      display_rev:client ? r2(client.display_rev|| 0) : 0,
      booked_rev: client ? r2((client.booked_rev|| 0) / 10000000) : 0,
      bu:         client ? client.bu       : '—',
      category:   client ? client.category : '—',
      agency:     client ? client.agency   : '—',
    });
  });

  const currentEntry  = history.find(h => h.mkey === CURRENT_MONTH) || {};
  const activeMonths  = history.filter(h => h.del_rev > 0);
  const peakEntry     = activeMonths.reduce((best, h) => h.del_rev > (best.del_rev || 0) ? h : best, {});
  const firstEntry    = activeMonths[0] || {};
  const avgRev        = activeMonths.length
    ? r2(activeMonths.reduce((t, h) => t + h.del_rev, 0) / activeMonths.length)
    : 0;
  const totalRev      = r2(activeMonths.reduce((t, h) => t + h.del_rev, 0));

  // ── Populate header ───────────────────────────────
  document.getElementById('dive-name').textContent = clientName;
  const buCls = { LCS1:'badge-green', LCS2:'badge-blue', MM1:'badge-amber', MM2:'badge-red' }[currentEntry.bu] || 'badge-gray';
  document.getElementById('dive-meta').innerHTML =
    `<span class="badge ${buCls}" style="margin-right:6px">${currentEntry.bu || '—'}</span>` +
    `<span style="margin-right:6px">${currentEntry.category || '—'}</span>` +
    (currentEntry.agency && currentEntry.agency !== '—' ? `<span style="color:var(--ink-faint)">·</span> <span style="margin-left:6px">${currentEntry.agency}</span>` : '');

  // ── Sparkline ─────────────────────────────────────
  const currentIdx  = history.findIndex(h => h.mkey === CURRENT_MONTH);
  const pointColors = history.map((h, i) =>
    i === currentIdx ? '#3B82F6' : h.del_rev > 0 ? 'rgba(59,130,246,0.5)' : 'rgba(203,213,225,0.3)'
  );
  const pointSizes  = history.map((h, i) => i === currentIdx ? 5 : h.del_rev > 0 ? 3 : 0);

  if (diveChart) diveChart.destroy();
  const ctx = document.getElementById('dive-chart')?.getContext('2d');
  if (ctx) {
    diveChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels:   history.map(h => h.label),
        datasets: [{
          data:                history.map(h => h.del_rev),
          borderColor:         'rgba(59,130,246,0.8)',
          backgroundColor:     'rgba(59,130,246,0.06)',
          borderWidth:         2,
          pointBackgroundColor: pointColors,
          pointRadius:         pointSizes,
          tension:             0.3,
          fill:                true,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => fmtNum(ctx.raw) + ' Cr' }
        }},
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45, maxTicksLimit: 10 } },
          y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, callback: v => v + ' Cr' } }
        }
      }
    });
  }

  // ── Stats row ─────────────────────────────────────
  document.getElementById('dive-stats').innerHTML = [
    { label: 'This Month',     val: fmtNum(currentEntry.del_rev || 0) + ' Cr', sub: 'Delivered revenue' },
    { label: 'Peak Month',     val: fmtNum(peakEntry.del_rev || 0) + ' Cr',   sub: peakEntry.label || '—' },
    { label: 'Avg Monthly',    val: fmtNum(avgRev) + ' Cr',                    sub: activeMonths.length + ' active months' },
    { label: 'First Appeared', val: firstEntry.label || '—',                   sub: 'Earliest month on record' },
  ].map(s => `
    <div class="dive-stat">
      <div class="dive-stat-label">${s.label}</div>
      <div class="dive-stat-val">${s.val}</div>
      <div class="dive-stat-sub">${s.sub}</div>
    </div>`
  ).join('');

  // ── Revenue mix bars ──────────────────────────────
  const totalPlatRev = (currentEntry.ctv_rev || 0) + (currentEntry.mobile_rev || 0);
  const totalAdRev   = (currentEntry.video_rev || 0) + (currentEntry.display_rev || 0);
  const mixItems = [
    { label: 'CTV',     val: currentEntry.ctv_rev    || 0, total: totalPlatRev || 1, color: '#10B981' },
    { label: 'Mobile',  val: currentEntry.mobile_rev || 0, total: totalPlatRev || 1, color: '#3B82F6' },
    { label: 'Video',   val: currentEntry.video_rev  || 0, total: totalAdRev   || 1, color: '#8B5CF6' },
    { label: 'Display', val: currentEntry.display_rev|| 0, total: totalAdRev   || 1, color: '#F59E0B' },
  ];
  document.getElementById('dive-mix').innerHTML = mixItems.map(m => {
    const pct = m.total > 0 ? Math.round((m.val / m.total) * 100) : 0;
    return `<div class="mix-row">
      <div class="mix-label">${m.label}</div>
      <div class="mix-bar-bg"><div class="mix-bar-fill" style="width:${pct}%;background:${m.color}"></div></div>
      <div class="mix-val">${fmtNum(m.val)} Cr</div>
    </div>`;
  }).join('');

  // ── Gemini talk points ────────────────────────────
  const geminiSection = document.getElementById('dive-gemini-section');
  const geminiContent = document.getElementById('dive-gemini-content');

  if (CONFIG?.GEMINI_API_KEY) {
    geminiSection.style.display = 'block';
    geminiContent.innerHTML = '<div style="color:var(--ink-soft);font-size:12px;display:flex;align-items:center;gap:8px"><div style="width:12px;height:12px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite"></div>Generating talk points...</div>';

    const prompt = `You are a senior revenue analyst at JioStar. Based on this client's data, generate exactly 3 concise sales talk points for a call with ${clientName}.

Client data:
- BU: ${currentEntry.bu}, Category: ${currentEntry.category}, Agency: ${currentEntry.agency || 'Direct'}
- This month revenue: ${fmtNum(currentEntry.del_rev || 0)} Cr
- Peak revenue: ${fmtNum(peakEntry.del_rev || 0)} Cr (${peakEntry.label || '—'})
- Average monthly revenue: ${fmtNum(avgRev)} Cr over ${activeMonths.length} months
- Platform preference: CTV ${fmtNum(currentEntry.ctv_rev || 0)} Cr, Mobile ${fmtNum(currentEntry.mobile_rev || 0)} Cr
- Video ${fmtNum(currentEntry.video_rev || 0)} Cr, Display ${fmtNum(currentEntry.display_rev || 0)} Cr
- First appeared: ${firstEntry.label || '—'}

Return ONLY 3 talk points as plain text, one per line, starting with a bullet •. No preamble. No headers. Each point max 25 words. Focus on upsell angles, platform gaps, or category opportunities.`;

    fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.GEMINI_MODEL + ':generateContent?key=' + CONFIG.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
        }),
      }
    )
    .then(r => r.json())
    .then(data => {
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const points = reply.split('\n').filter(l => l.trim().startsWith('•'));
      geminiContent.innerHTML = points.map(p =>
        `<div class="talk-point">${p.trim()}</div>`
      ).join('') || '<div style="color:var(--ink-soft);font-size:12px">No talk points generated.</div>';
    })
    .catch(() => {
      geminiContent.innerHTML = '<div style="color:var(--ink-soft);font-size:12px">Talk points unavailable.</div>';
    });
  } else {
    geminiSection.style.display = 'none';
  }

  // ── Open drawer ───────────────────────────────────
  const overlay = document.getElementById('dive-overlay');
  const drawer  = document.getElementById('dive-drawer');
  overlay.style.display = 'block';
  overlay.classList.add('open');
  drawer.style.display  = 'flex';
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeClientDive() {
  const overlay = document.getElementById('dive-overlay');
  const drawer  = document.getElementById('dive-drawer');
  overlay.style.display = 'none';
  overlay.classList.remove('open');
  drawer.style.display  = 'none';
  drawer.classList.remove('open');
  document.body.style.overflow = '';
  if (diveChart) { diveChart.destroy(); diveChart = null; }
}

// Close on ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeClientDive();
});

// ── Query ─────────────────────────────────────────
function setQuickQuery(t) {
  document.getElementById('query-input').value = t;
  document.getElementById('query-input').focus();
}

function closeAnswer() {
  document.getElementById('query-answer-area').style.display = 'none';
  document.getElementById('query-input').value = '';
}

function buildDataContext() {
  if (!DATA || !CURRENT_MONTH) return '';
  const md = DATA.months[CURRENT_MONTH];
  if (!md) return '';
  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[lyMonthKey(CURRENT_MONTH)]    || null;

  const activeFilters = { month: md.label, bu: CURRENT_BU, platform: CURRENT_PLATFORM, adType: CURRENT_ADTYPE, format: CURRENT_FORMAT, category: CURRENT_CATEGORY, agency: CURRENT_AGENCY };

  // BU summary — full comparative
  const buSummary = ['LCS1','LCS2','MM1','MM2','Others'].map(function(bu) {
    const b = md.bu[bu] || {};
    return bu + ': Del Rev ' + fmtNum(b.del_rev) + ' Cr, Booked ' + fmtNum(r2((b.booked_rev||0)/10000000)) + ' Cr, Clients ' + (b.clients||0) + ', vs LM ' + (b.growth_vs_lm ?? '—') + '%, vs LY ' + (b.growth_vs_ly ?? '—') + '%';
  }).join('\n');

  // Platform summary — full comparative
  const platSummary = ['CTV','Mobile','Mobile+CTV'].map(function(p) {
    const pl = md.platform[p] || {};
    return p + ': Del Rev ' + fmtNum(pl.del_rev) + ' Cr, Booked ' + fmtNum(r2((pl.booked_rev||0)/10000000)) + ' Cr, Clients ' + (pl.clients||0) + ', vs LM ' + (pl.growth_vs_lm ?? '—') + '%, vs LY ' + (pl.growth_vs_ly ?? '—') + '%';
  }).join('\n');

  // Ad Type summary — with vs LM and vs LY
  const videoData   = md.ad_type && md.ad_type.Video   ? md.ad_type.Video   : {};
  const displayData = md.ad_type && md.ad_type.Display ? md.ad_type.Display : {};
  const priorVideo   = priorMd && priorMd.ad_type && priorMd.ad_type.Video   ? priorMd.ad_type.Video   : {};
  const priorDisplay = priorMd && priorMd.ad_type && priorMd.ad_type.Display ? priorMd.ad_type.Display : {};
  const lyVideo      = lyMd    && lyMd.ad_type    && lyMd.ad_type.Video      ? lyMd.ad_type.Video      : {};
  const lyDisplay    = lyMd    && lyMd.ad_type    && lyMd.ad_type.Display    ? lyMd.ad_type.Display    : {};
  const vMom = priorVideo.del_rev   > 0 ? r2(((videoData.del_rev   - priorVideo.del_rev)   / priorVideo.del_rev)   * 100) : null;
  const vLy  = lyVideo.del_rev      > 0 ? r2(((videoData.del_rev   - lyVideo.del_rev)      / lyVideo.del_rev)      * 100) : null;
  const dMom = priorDisplay.del_rev > 0 ? r2(((displayData.del_rev - priorDisplay.del_rev) / priorDisplay.del_rev) * 100) : null;
  const dLy  = lyDisplay.del_rev    > 0 ? r2(((displayData.del_rev - lyDisplay.del_rev)    / lyDisplay.del_rev)    * 100) : null;
  const adTypeSummary =
    'Video: Del Rev ' + fmtNum(videoData.del_rev) + ' Cr, Booked ' + fmtNum(r2((videoData.booked_rev||0)/10000000)) + ' Cr, vs LM ' + (vMom ?? '—') + '%, vs LY ' + (vLy ?? '—') + '%\n' +
    'Display: Del Rev ' + fmtNum(displayData.del_rev) + ' Cr, Booked ' + fmtNum(r2((displayData.booked_rev||0)/10000000)) + ' Cr, vs LM ' + (dMom ?? '—') + '%, vs LY ' + (dLy ?? '—') + '%';

  // Categories — with vs LM and vs LY
  const catSummary = (md.categories || []).slice(0,10).map(function(c,i) {
    const prior = ((priorMd && priorMd.categories) || []).find(function(x){return x.name===c.name;});
    const ly    = ((lyMd    && lyMd.categories)    || []).find(function(x){return x.name===c.name;});
    const momPct = prior && prior.del_rev > 0 ? r2(((c.del_rev - prior.del_rev)/prior.del_rev)*100) : null;
    const lyPct  = ly    && ly.del_rev    > 0 ? r2(((c.del_rev - ly.del_rev)   /ly.del_rev)   *100) : null;
    return (i+1) + '. ' + c.name + ': ' + fmtNum(c.del_rev) + ' Cr (' + c.clients + ' clients), vs LM: ' + (momPct !== null ? (momPct > 0 ? '+' : '') + momPct + '%' : '—') + ', vs LY: ' + (lyPct !== null ? (lyPct > 0 ? '+' : '') + lyPct + '%' : '—');
  }).join('\n');

  // Agencies — with vs LM and vs LY
  const agSummary = (md.agencies || []).slice(0,9).map(function(ag,i) {
    const prior = ((priorMd && priorMd.agencies) || []).find(function(x){return x.name===ag.name;});
    const ly    = ((lyMd    && lyMd.agencies)    || []).find(function(x){return x.name===ag.name;});
    const momPct = prior && prior.del_rev > 0 ? r2(((ag.del_rev - prior.del_rev)/prior.del_rev)*100) : null;
    const lyPct  = ly    && ly.del_rev    > 0 ? r2(((ag.del_rev - ly.del_rev)   /ly.del_rev)   *100) : null;
    return (i+1) + '. ' + ag.name + ': ' + fmtNum(ag.del_rev) + ' Cr (' + ag.clients + ' clients), vs LM: ' + (momPct !== null ? (momPct > 0 ? '+' : '') + momPct + '%' : '—') + ', vs LY: ' + (lyPct !== null ? (lyPct > 0 ? '+' : '') + lyPct + '%' : '—');
  }).join('\n');

  // Top 20 clients — with vs LM comparison
  const clientSummary = (md.top_clients || []).slice(0,20).map(function(c,i) {
    const priorClient = ((priorMd && priorMd.top_clients) || []).find(function(x){return x.name===c.name;});
    const momPct = priorClient && priorClient.del_rev > 0 ? r2(((c.del_rev - priorClient.del_rev)/priorClient.del_rev)*100) : null;
    return (i+1) + '. ' + c.name + ' (' + c.bu + ') — Del Rev ' + fmtNum(c.del_rev) + ' Cr, Booked ' + fmtNum(r2((c.booked_rev||0)/10000000)) + ' Cr, vs LM: ' + (momPct !== null ? (momPct > 0 ? '+' : '') + momPct + '%' : '—') + ', Category: ' + (c.category||'—') + ', Agency: ' + (c.agency||'—');
  }).join('\n');

  // Overall
  const overall = 'Month: ' + md.label + ' | Total Del Rev: ' + fmtNum(md.total_del_rev) + ' Cr | Active Clients: ' + md.total_clients +
    (priorMd ? ' | vs Prior Month (' + priorMd.label + '): ' + (md.vs_prior_month && md.vs_prior_month.change_pct != null ? md.vs_prior_month.change_pct : '—') + '%' : '') +
    (lyMd    ? ' | vs Last Year: '   + (md.vs_last_year  && md.vs_last_year.change_pct  != null ? md.vs_last_year.change_pct  : '—') + '%' : '');

  return '=== JIOSTAR DIGITAL AD REVENUE — ' + md.label + ' ===\n\nOVERALL: ' + overall +
    '\n\nACTIVE FILTERS: ' + JSON.stringify(activeFilters) +
    '\n\nBU BREAKDOWN:\n' + buSummary +
    '\n\nPLATFORM SPLIT:\n' + platSummary +
    '\n\nAD TYPE:\n' + adTypeSummary +
    '\n\nTOP CATEGORIES (with growth):\n' + catSummary +
    '\n\nAGENCY PERFORMANCE (with growth):\n' + agSummary +
    '\n\nTOP 20 CLIENTS:\n' + clientSummary;
}

async function submitQuery() {
  const input = document.getElementById('query-input');
  const question = input.value.trim();
  if (!question) return;

  const answerArea    = document.getElementById('query-answer-area');
  const answerContent = document.getElementById('answer-content');

  answerArea.style.display = 'block';
  answerContent.innerHTML = '<div style="display:flex;align-items:center;gap:10px;color:var(--ink-soft);font-size:13px;padding:8px 0"><div style="width:16px;height:16px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0"></div>Gemini is analyzing your data...</div>';

  const dataContext = buildDataContext();
  const systemPrompt = 'You are a Revenue Intelligence Analyst for JioStar, India\'s leading digital streaming platform. Answer questions from senior revenue leaders clearly and precisely using only the data provided. Format responses as clean HTML (use <table>, <strong>, <ul> tags). Use Cr as the revenue unit. Highlight trends with ↑ or ↓. Do NOT use markdown, only HTML. You have memory of this conversation — if the user asks follow-up questions, refer to your previous answers.';

  // Add current question to history
  CONVERSATION_HISTORY.push({
    role: 'user',
    parts: [{ text: 'Here is the current JioStar revenue data:\n\n' + dataContext + '\n\n---\n\nQuestion: ' + question }]
  });

  // Keep only last 5 exchanges (10 messages)
  if (CONVERSATION_HISTORY.length > 10) {
    CONVERSATION_HISTORY = CONVERSATION_HISTORY.slice(-10);
  }

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.GEMINI_MODEL + ':generateContent?key=' + CONFIG.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: CONVERSATION_HISTORY,
          generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err && err.error ? err.error.message : 'HTTP ' + res.status);
    }

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';

    // Add Gemini's reply to history
    CONVERSATION_HISTORY.push({
      role: 'model',
      parts: [{ text: reply }]
    });

    const historyCount = Math.floor(CONVERSATION_HISTORY.length / 2);
    const clearBtn = historyCount > 1
      ? `<button onclick="clearConversation()" style="margin-left:auto;font-size:11px;padding:2px 8px;border-radius:5px;border:1px solid var(--border);background:var(--surface);color:var(--ink-soft);cursor:pointer">Clear (${historyCount} exchanges)</button>`
      : '';

    answerContent.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:11px;color:var(--ink-soft)">
        <span>💬 ${historyCount > 1 ? historyCount + ' exchanges in this session' : 'New conversation'}</span>
        ${clearBtn}
      </div>
      <div class="gemini-answer">${reply}</div>`;

  } catch(err) {
    answerContent.innerHTML = `<div style="color:var(--red);font-size:13px">⚠️ Error: ${err.message}</div>`;
    console.error('Gemini error:', err);
  }
updateRecentQueries(question);
  input.value = '';
}
async function briefMe() {
  const btn         = document.getElementById('brief-me-btn');
  const answerArea  = document.getElementById('query-answer-area');
  const answerContent = document.getElementById('answer-content');

  btn.disabled    = true;
  btn.innerHTML   = '<div style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite"></div> Briefing...';
  answerArea.style.display  = 'block';
  answerContent.innerHTML   = '<div style="display:flex;align-items:center;gap:10px;color:var(--ink-soft);font-size:13px;padding:8px 0"><div style="width:16px;height:16px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0"></div> Gemini is writing the brief...</div>';

  const dataContext = buildDataContext();
  const md          = DATA.months[CURRENT_MONTH];
  const nextMKey    = nextMonthKey(CURRENT_MONTH);
  const nextMd      = DATA.months[nextMKey] || null;
  const nextBooked  = nextMd
    ? r2(['LCS1','LCS2','MM1','MM2'].reduce((t, bu) => t + (nextMd.bu[bu] ? (nextMd.bu[bu].booked_rev || 0) / 10000000 : 0), 0))
    : null;

  const briefPrompt = `You are a senior Revenue Intelligence Analyst at JioStar, India's leading digital streaming platform. 
Write a crisp executive brief for ${md.label} based ONLY on the data provided below.

STRICT OUTPUT FORMAT — use exactly these HTML sections in order, no deviations:

<div class="brief-headline">Write ONE punchy sentence summarising the single most important revenue story this month. Max 20 words.</div>

<div class="brief-section"><span class="brief-label">Overall Performance</span>Write 2–3 sentences covering total delivered revenue, growth vs last month, and growth vs last year. Use exact numbers from the data.</div>

<div class="brief-section"><span class="brief-label">BU Pulse</span>One line per BU (LCS1, LCS2, MM1, MM2). Format: BU name — revenue — vs LM growth. Call out the standout and the laggard.</div>

<div class="brief-section"><span class="brief-label">Winners This Month</span>Top 2 stories of growth — can be a category, agency, or client. Include the exact Cr movement and % change. Frame as momentum.</div>

<div class="brief-section"><span class="brief-label">Watch List</span>Top 2 declines that need attention. Include exact numbers. Frame as risks to address, not failures. Be direct.</div>

<div class="brief-section"><span class="brief-label">Forward Signal</span>${nextBooked !== null ? `Next month has ₹${fmtNum(nextBooked)} Cr in confirmed bookings.` : 'Next month pipeline data unavailable.'} Based on this and seasonal patterns in the data, write 2 sentences on what to expect and what to watch.</div>

RULES:
- Only use data provided. No assumptions.
- Use ₹ and Cr notation throughout.
- Use ↑ for growth, ↓ for decline.
- No markdown. Only the HTML structure above.
- Total length: 250–320 words maximum.

DATA:
${dataContext}`;

  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.GEMINI_MODEL + ':generateContent?key=' + CONFIG.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: briefPrompt }] }],
          generationConfig: { temperature: 0.15, maxOutputTokens: 1500 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message || 'HTTP ' + res.status);
    }

    const data  = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';

    answerContent.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:11px;color:var(--ink-soft)">
        <span>✦ Brief generated for ${md.label}</span>
      </div>
      <div class="brief-output">${reply}</div>`;

  } catch(err) {
    answerContent.innerHTML = `<div style="color:var(--red);font-size:13px">⚠️ Error: ${err.message}</div>`;
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<span style="font-size:15px">✦</span> Brief Me';
  }
}

function clearConversation() {
  CONVERSATION_HISTORY = [];
  document.getElementById('query-answer-area').style.display = 'none';
  document.getElementById('query-input').value = '';
}
// ── Export / Copy ──────────────────────────────────
function exportDashboardPDF() {
  window.print();
}

function exportPanel(panelId, filename) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const table = panel.querySelector('table');
  if (!table) return;

  const rows = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('th, td').forEach(td => {
      // Strip "Cr", badges, buttons — get clean text
      let text = td.innerText || td.textContent || '';
      text = text.replace(/\s*Cr\s*/g, '')  // remove Cr
                 .replace(/[↑↓→]/g, '')      // remove arrows
                 .replace(/\+/g, '')          // remove + signs
                 .replace(/\n/g, ' ')         // flatten newlines
                 .trim();
      cells.push(text);
    });
    if (cells.some(c => c !== '')) rows.push(cells.join('\t'));
  });

  const tsv = rows.join('\n');
  navigator.clipboard.writeText(tsv).then(() => {
    // Flash feedback on button
    const btn = document.querySelector(`[data-export="${panelId}"]`);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied!';
      btn.style.background = 'var(--green)';
      btn.style.color = 'white';
      setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = ''; }, 2000);
    }
  });
}

function copyGeminiAnswer() {
  const content = document.getElementById('answer-content');
  if (!content) return;
  const text = content.innerText || content.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-answer-btn');
    if (btn) {
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = '⎘ Copy'; }, 2000);
    }
  });
}function updateRecentQueries(question) {
  const container = document.getElementById('recent-queries');
  if (!container) return;

  // Get existing queries
  let queries = JSON.parse(sessionStorage.getItem('recentQueries') || '[]');
  
  // Add new query, remove duplicates, keep last 5
  queries = [question, ...queries.filter(q => q !== question)].slice(0, 5);
  sessionStorage.setItem('recentQueries', JSON.stringify(queries));

  // Render
  container.style.display = queries.length ? 'flex' : 'none';
  container.innerHTML = queries.map(q =>
    `<button class="recent-query-btn" onclick="setQuickQuery('${q.replace(/'/g, "\\'")}')" title="${q}">${q}</button>`
  ).join('');
}
// ── Meeting Mode ──────────────────────────────────
let MEETING_SLIDE = 0;

const MEETING_SLIDES = [
  { title: 'BU Breakdown',        panelId: 'bu-panel'       },
  { title: 'Platform Split',      panelId: 'platform-panel' },
  { title: 'Ad Type Breakdown',   panelId: 'adtype-panel'   },
  { title: 'Category Leaderboard',panelId: 'category-panel' },
  { title: 'Agency Performance',  panelId: 'agency-panel'   },
  { title: 'Top Clients',         panelId: 'clients-panel'  },
  { title: 'Churner Watch',       panelId: 'churner-panel'  },
];

function enterMeetingMode() {
  const overlay = document.getElementById('meeting-overlay');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Populate KPI strip from existing kpi-row
  const kpiRow  = document.getElementById('kpi-row');
  const strip   = document.getElementById('meeting-kpi-strip');
  if (kpiRow && strip) {
    strip.innerHTML = '';
    Array.from(kpiRow.children).forEach(card => {
      const clone = card.cloneNode(true);
      clone.classList.add('meeting-kpi-mini');
      // shrink values
      const val = clone.querySelector('.kpi-value');
      if (val) val.style.fontSize = '18px';
      strip.appendChild(clone);
    });
  }

  // Month + meta
  const md = DATA?.months[CURRENT_MONTH];
  if (md) {
    document.getElementById('meeting-month').textContent = md.label;
    document.getElementById('meeting-meta').textContent =
      fmtInt(md.total_clients) + ' clients · ' + fmtNum(md.total_del_rev) + ' Cr delivered';
  }

  // Build dots
  buildMeetingDots();
  renderMeetingSlide();

  // Keyboard navigation
  document.addEventListener('keydown', meetingKeyHandler);
}

function exitMeetingMode() {
  const overlay = document.getElementById('meeting-overlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', meetingKeyHandler);
}

function meetingKeyHandler(e) {
  if (e.key === 'Escape')      exitMeetingMode();
  if (e.key === 'ArrowRight')  meetingNext();
  if (e.key === 'ArrowLeft')   meetingPrev();
}

function meetingNext() {
  MEETING_SLIDE = (MEETING_SLIDE + 1) % MEETING_SLIDES.length;
  renderMeetingSlide();
}

function meetingPrev() {
  MEETING_SLIDE = (MEETING_SLIDE - 1 + MEETING_SLIDES.length) % MEETING_SLIDES.length;
  renderMeetingSlide();
}

function buildMeetingDots() {
  const dotsEl = document.getElementById('meeting-dots');
  if (!dotsEl) return;
  dotsEl.innerHTML = MEETING_SLIDES.map((_, i) =>
    `<div class="meeting-dot${i === MEETING_SLIDE ? ' active' : ''}" onclick="jumpMeetingSlide(${i})"></div>`
  ).join('');
}

function jumpMeetingSlide(i) {
  MEETING_SLIDE = i;
  renderMeetingSlide();
}

function renderMeetingSlide() {
  const slide   = MEETING_SLIDES[MEETING_SLIDE];
  const content = document.getElementById('meeting-slide-content');
  const title   = document.getElementById('meeting-slide-title');
  const counter = document.getElementById('meeting-slide-counter');

  if (!slide || !content) return;

  title.textContent   = slide.title;
  counter.textContent = `${MEETING_SLIDE + 1} / ${MEETING_SLIDES.length}`;

  // Clone the panel content into the slide
  const source = document.getElementById(slide.panelId);
  if (source) {
    content.innerHTML = '';
    const clone = source.cloneNode(true);
    clone.style.background = 'transparent';
    content.appendChild(clone);
  } else {
    content.innerHTML = `<div style="color:rgba(255,255,255,0.4);font-size:14px;padding:24px">No data to display.</div>`;
  }

  // Update dots
  document.querySelectorAll('.meeting-dot').forEach((d, i) => {
    d.classList.toggle('active', i === MEETING_SLIDE);
  });
}
// ── Formatters ────────────────────────────────────
function fmtNum(n){const v=Number(n)||0; return v>=5?v.toFixed(1):v.toFixed(2);}
function fmtInt(n){return Math.round(Number(n)||0).toLocaleString('en-IN');}
function r2(n) { return Math.round((Number(n)||0)*100)/100; }
function priorMonthKey(yyyymm) {
  let y = parseInt(yyyymm.slice(0,4));
  let m = parseInt(yyyymm.slice(5,7)) - 1;
  if (m < 1) { m = 12; y--; }
  return y + '-' + String(m).padStart(2,'0');
}
function lyMonthKey(yyyymm) {
  return (parseInt(yyyymm.slice(0,4)) - 1) + '-' + yyyymm.slice(5,7);
}
function nextMonthKey(yyyymm) {
  let y = parseInt(yyyymm.slice(0,4));
  let m = parseInt(yyyymm.slice(5,7)) + 1;
  if (m > 12) { m = 1; y++; }
  return y + '-' + String(m).padStart(2,'0');
}
function formatFieldKey(fmt) {
  const map = {
    'Preroll':            'preroll_rev',
    'Midroll':            'midroll_rev',
    'Integration':        'integ_rev',
    'Spots':              'spots_rev',
    'Billboard':          'billboard_rev',
    'Breakout Billboard': 'breakout_rev',
    'Pause Ads':          'pause_rev',
    'Display and Frames': 'frames_rev',
    'Fence Ads':          'fence_rev',
    'Untagged':           'untagged_rev',
  };
  return map[fmt] || null;
}