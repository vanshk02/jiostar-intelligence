// ============================================================
//   JIOSTAR INTELLIGENCE — ui.js  v7
//   Full tables with headers, growth cols, cross-filtering,
//   expandable brands, booked rev everywhere
// ============================================================

let DATA = null;
let CURRENT_MONTH    = null;
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
// ── Render all ────────────────────────────────────
function renderAll() {
  const md = DATA.months[CURRENT_MONTH]; if (!md) return;
  renderHeader(md); renderKPIs(md);
  renderBU(md); renderPlatform(md); renderAdType(md);
  renderCategories(md); renderAgencies(md); renderClients(md); renderFlags(md);
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

  // ── Top BU ─────────────────────────────────────────────────
  const topBU = ['LCS1','LCS2','MM1','MM2'].map(b => {
    if (!anyFilterActive) return { name: b, rev: md.bu[b] ? md.bu[b].del_rev : 0 };
    const buClients = filterClientsByBU(filteredClients, b);
    return { name: b, rev: r2(buClients.reduce((t,c) => t + clientRevForFilters(c), 0)) };
  }).sort((a,b) => b.rev - a.rev)[0];

  // ── Booked Ach% ────────────────────────────────────────────
  const achPct = totalBooked > 0 ? r2((totalRev / totalBooked) * 100) : 0;

  document.getElementById('kpi-row').innerHTML = [
    kpiCard('Total Del Rev',  totalRev,         'Cr', momC),
    kpiCard('Active Clients', totalClients,     '',   lyC),
    kpiCard('CTV Rev',        adjCTV,           'Cr', null, 'incl. Mob+CTV split'),
    kpiCard('Mobile Rev',     adjMobile,        'Cr', null, 'incl. Mob+CTV split'),
    kpiCard('Video Rev',      videoRev,         'Cr', null, 'of filtered revenue'),
    kpiCard('Display Rev',    displayRev,       'Cr', null, 'of filtered revenue'),
    kpiCard('Top BU',         topBU.rev,        'Cr', null, topBU.name+' leading'),
    kpiCard('Booked Ach%',    achPct,           '%',  null, 'del vs booked'),
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
      <td style="font-weight:500">${cat.name}</td>
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
      <td><span style="font-weight:500">${c.name}</span>${expandBtn}</td>
      <td><span class="badge badge-blue">${c.bu}</span></td>
      <td style="font-family:var(--mono);font-weight:500;text-align:right">${fmtNum(rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right">${fmtNum(booked)} Cr</td>
      <td style="font-size:12px;color:var(--ink-soft)">${c.category||'—'}</td>
      <td style="font-size:12px;color:var(--ink-soft)">${c.agency||'—'}</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.video_rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.display_rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.ctv_rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.mobile_rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.mobilectv_rev)} Cr</td>
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
          <th>Agency</th>
          <th style="text-align:right;min-width:68px">Video</th>
          <th style="text-align:right;min-width:68px">Display</th>
          <th style="text-align:right;min-width:68px">CTV</th>
          <th style="text-align:right;min-width:68px">Mobile</th>
          <th style="text-align:right;min-width:68px">Mob+CTV</th>
          <th style="text-align:right;min-width:52px">Share</th>
        </tr></thead>
        <tbody>${rowsHtml}${totalRow}</tbody>
      </table>
    </div>`;
}

// Toggle brand rows
function toggleBrands(idx, btn) {
  const brandRows = document.querySelectorAll(`#brands-${idx}`);
  const isHidden = brandRows[0]?.style.display === 'none';
  brandRows.forEach(r => r.style.display = isHidden ? 'table-row' : 'none');
  btn.textContent = isHidden ? '−' : '+';
}

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
  const systemPrompt = 'You are a Revenue Intelligence Analyst for JioStar, India\'s leading digital streaming platform. Answer questions from senior revenue leaders clearly and precisely using only the data provided. Format responses as clean HTML (use <table>, <strong>, <ul> tags). Use Cr as the revenue unit. Highlight trends with ↑ or ↓. Do NOT use markdown, only HTML.';
  const userMessage = 'Here is the current JioStar revenue data:\n\n' + dataContext + '\n\n---\n\nQuestion: ' + question;
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.GEMINI_MODEL + ':generateContent?key=' + CONFIG.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
tools: [{ googleSearch: {} }],
        }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err && err.error ? err.error.message : 'HTTP ' + res.status);
    }
    const data = await res.json();
    const reply = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] ? data.candidates[0].content.parts[0].text : 'No response from Gemini.';
    answerContent.innerHTML = '<div class="gemini-answer">' + reply + '</div>';
  } catch(err) {
    answerContent.innerHTML = '<div style="color:var(--red);font-size:13px">⚠️ Error: ' + err.message + '</div>';
    console.error('Gemini error:', err);
  }
}
// ── Export / Copy ──────────────────────────────────
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