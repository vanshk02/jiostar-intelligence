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
let CURRENT_CLIENT   = 'all';
let SEARCH_CLIENT = '';
const MAIN_BUS = ['LCS1','LCS2','MM1','MM2'];
let VIEW_MODE     = 'monthly';
let AGG_PRIOR_KEY = null;
let AGG_LY_KEY    = null;
function filterClientsByBU(clients, buName) {
  if (buName === 'all')    return clients;
  if (buName === 'Others') return clients.filter(c => !MAIN_BUS.includes(c.bu));
  return clients.filter(c => c.bu === buName);
}

// ══════════════════════════════════════════════════════════════
//  QUARTERLY / YEARLY AGGREGATION
// ══════════════════════════════════════════════════════════════

function getFYInfo(yyyymm) {
  const y = parseInt(yyyymm.slice(0,4));
  const m = parseInt(yyyymm.slice(5,7));
  let fyNum, qNum;
  if (m >= 4) { fyNum = y + 1; qNum = Math.floor((m - 4) / 3) + 1; }
  else         { fyNum = y;     qNum = 4; }
  return { fyNum, fy: 'FY' + String(fyNum).slice(2), q: 'Q' + qNum, qNum };
}

function getQuarterMonthKeys(yyyymm) {
  const { fyNum, qNum } = getFYInfo(yyyymm);
  const startByQ = [null, [fyNum-1,4], [fyNum-1,7], [fyNum-1,10], [fyNum,1]];
  const [sy, sm]  = startByQ[qNum];
  return [0,1,2].map(i => {
    let mm = sm + i, yy = sy;
    if (mm > 12) { mm -= 12; yy++; }
    return yy + '-' + String(mm).padStart(2,'0');
  });
}

function getFYMonthKeys(yyyymm) {
  const { fyNum } = getFYInfo(yyyymm);
  return Array.from({length:12}, (_,i) => {
    let mm = 4 + i, yy = fyNum - 1;
    if (mm > 12) { mm -= 12; yy++; }
    return yy + '-' + String(mm).padStart(2,'0');
  });
}

function getPriorPeriodKeys(keys) {
  if (!keys.length) return [];
  const n = keys.length;
  const [fy, fm] = keys[0].split('-').map(Number);
  return Array.from({length:n}, (_,i) => {
    let mm = fm - n + i, yy = fy;
    while (mm < 1) { mm += 12; yy--; }
    return yy + '-' + String(mm).padStart(2,'0');
  });
}

function getLYPeriodKeys(keys) {
  return keys.map(k => (parseInt(k.slice(0,4))-1) + '-' + k.slice(5));
}

function getPeriodLabel(keys) {
  if (!keys || !keys.length) return '';
  if (keys.length === 1) return DATA.months[keys[0]]?.label || keys[0];
  if (keys.length === 3) { const { fy, q } = getFYInfo(keys[0]); return q + ' ' + fy; }
  if (keys.length === 12) return getFYInfo(keys[0]).fy;
  return (DATA.months[keys[0]]?.label||keys[0]) + '–' + (DATA.months[keys[keys.length-1]]?.label||keys[keys.length-1]);
}

const AGG_SUM_FIELDS = [
  'del_rev','booked_rev','ctv_rev','mobile_rev','mobilectv_rev','video_rev','display_rev',
  'ctv_video_rev','ctv_display_rev','mobile_video_rev','mob_video_rev','mob_display_rev','mobile_display_rev',
  'mobilectv_video_rev','mobilectv_display_rev',
  // format rev (no platform)
  'preroll_rev','midroll_rev','integ_rev','spots_rev',
  'billboard_rev','breakout_rev','pause_rev','frames_rev','fence_rev','untagged_rev',
  // CTV × format
  'ctv_preroll_rev','ctv_midroll_rev','ctv_integ_rev','ctv_spots_rev',
  'ctv_billboard_rev','ctv_breakout_rev','ctv_pause_rev','ctv_frames_rev','ctv_fence_rev','ctv_untagged_rev',
  // Mobile × format
  'mob_preroll_rev','mob_midroll_rev','mob_integ_rev','mob_spots_rev',
  'mob_billboard_rev','mob_breakout_rev','mob_pause_rev','mob_frames_rev','mob_fence_rev','mob_untagged_rev',
  // Mobile+CTV × format
  'mctv_preroll_rev','mctv_midroll_rev','mctv_integ_rev','mctv_spots_rev',
  'mctv_billboard_rev','mctv_breakout_rev','mctv_pause_rev','mctv_frames_rev','mctv_fence_rev','mctv_untagged_rev',
  // booked
  'ctv_booked','mobile_booked','mobilectv_booked','video_booked','display_booked',
  'ctv_video_booked','ctv_display_booked','mobile_video_booked','mobile_display_booked',
  'mobilectv_video_booked','mobilectv_display_booked',
  'ctv_preroll_booked','ctv_midroll_booked','ctv_integ_booked','ctv_spots_booked',
  'ctv_billboard_booked','ctv_breakout_booked','ctv_pause_booked','ctv_frames_booked','ctv_fence_booked','ctv_untagged_booked',
  'mob_preroll_booked','mob_midroll_booked','mob_integ_booked','mob_spots_booked',
  'mob_billboard_booked','mob_breakout_booked','mob_pause_booked','mob_frames_booked','mob_fence_booked','mob_untagged_booked',
  'mctv_preroll_booked','mctv_midroll_booked','mctv_integ_booked','mctv_spots_booked',
  'mctv_billboard_booked','mctv_breakout_booked','mctv_pause_booked','mctv_frames_booked','mctv_fence_booked','mctv_untagged_booked',
  // impressions
  'preroll_imp','midroll_imp','ctv_preroll_imp','ctv_midroll_imp',
  'mob_preroll_imp','mob_midroll_imp','mctv_preroll_imp','mctv_midroll_imp',
  // client counts
  'clients','ctv_clients','mobile_clients','mobilectv_clients','video_clients','display_clients',
];

function sumObjFields(objects) {
  const result = {};
  AGG_SUM_FIELDS.forEach(f => {
    let total = 0, hasAny = false;
    objects.forEach(obj => { if (obj && obj[f] != null) { total += obj[f]; hasAny = true; } });
    result[f] = (f === 'booked_rev') ? (hasAny ? r2(total) : null) : (hasAny ? r2(total) : 0);
  });
  return result;
}

function aggregateMonths(monthKeys) {
  const validKeys = (monthKeys || []).filter(k => k && DATA.months[k]);
  if (!validKeys.length) return null;
  const months = validKeys.map(k => DATA.months[k]);

  const totalDelRev = r2(months.reduce((t,m) => t + (m.total_del_rev||0), 0));
  const allClientNames = new Set();
  months.forEach(m => (m.top_clients||[]).forEach(c => { if (c.del_rev>0) allClientNames.add(c.name); }));

  const buAgg = {};
  ['LCS1','LCS2','MM1','MM2','Others'].forEach(bu => {
    buAgg[bu] = sumObjFields(months.map(m => m.bu?.[bu] || {}));
  });

  const platAgg = {};
  ['CTV','Mobile','Mobile+CTV'].forEach(p => {
    platAgg[p] = sumObjFields(months.map(m => m.platform?.[p] || {}));
  });

  const catMap = {};
  const catClientSets = {};
  months.forEach(m => {
    (m.categories||[]).forEach(cat => {
      if (!catMap[cat.name]) { catMap[cat.name] = {name:cat.name, del_rev:0, video_rev:0, display_rev:0, booked_rev:null, clients:0}; catClientSets[cat.name] = new Set(); }
      const e = catMap[cat.name];
      e.del_rev += cat.del_rev||0; e.video_rev += cat.video_rev||0; e.display_rev += cat.display_rev||0;
      if (cat.booked_rev != null) { e.booked_rev = (e.booked_rev||0) + cat.booked_rev; }
    });
  });
  // Derive client counts from the aggregated top_clients pool
  months.forEach(m => {
    (m.top_clients||[]).forEach(c => {
      if (!c.del_rev || !c.category) return;
      if (catClientSets[c.category]) catClientSets[c.category].add(c.name);
    });
  });
  Object.keys(catMap).forEach(name => { catMap[name].clients = catClientSets[name]?.size || 0; });

  const agMap = {};
  const agClientSets = {};
  months.forEach(m => {
    (m.agencies||[]).forEach(ag => {
      if (!agMap[ag.name]) { agMap[ag.name] = {name:ag.name, del_rev:0, video_rev:0, display_rev:0, booked_rev:null, clients:0}; agClientSets[ag.name] = new Set(); }
      const e = agMap[ag.name];
      e.del_rev += ag.del_rev||0; e.video_rev += ag.video_rev||0; e.display_rev += ag.display_rev||0;
      if (ag.booked_rev != null) { e.booked_rev = (e.booked_rev||0) + ag.booked_rev; }
    });
  });
  months.forEach(m => {
    (m.top_clients||[]).forEach(c => {
      if (!c.del_rev || !c.agency) return;
      if (agClientSets[c.agency]) agClientSets[c.agency].add(c.name);
    });
  });
  Object.keys(agMap).forEach(name => { agMap[name].clients = agClientSets[name]?.size || 0; });

  const adTypeAgg = {};
  ['Video','Display'].forEach(at => {
    const summed = sumObjFields(months.map(m => m.ad_type?.[at] || {}));
    const formats = {};
    months.forEach(m => { Object.entries(m.ad_type?.[at]?.formats||{}).forEach(([fmt,rev]) => { formats[fmt] = (formats[fmt]||0) + rev; }); });
    adTypeAgg[at] = { ...summed, formats };
  });

  const clientMap = {};
  months.forEach(m => {
    (m.top_clients||[]).forEach(c => {
      if (!clientMap[c.name]) {
        clientMap[c.name] = { name:c.name, bu:c.bu, category:c.category, agency:c.agency };
        AGG_SUM_FIELDS.forEach(f => { clientMap[c.name][f] = (f==='booked_rev') ? null : 0; });
      }
      const cd = clientMap[c.name];
      AGG_SUM_FIELDS.forEach(f => {
        if (c[f] != null) {
          if (f === 'booked_rev') { cd.booked_rev = (cd.booked_rev||0) + c[f]; }
          else { cd[f] = (cd[f]||0) + c[f]; }
        }
      });
      if (c.category_rev_map) {
        if (!cd.category_rev_map) cd.category_rev_map = {};
        Object.entries(c.category_rev_map).forEach(([k,v]) => { cd.category_rev_map[k] = (cd.category_rev_map[k]||0) + v; });
      }
      if (c.agency_rev_map) {
        if (!cd.agency_rev_map) cd.agency_rev_map = {};
        Object.entries(c.agency_rev_map).forEach(([k,v]) => { cd.agency_rev_map[k] = (cd.agency_rev_map[k]||0) + v; });
      }
      if (c.brands)           cd.brands           = c.brands;
    });
  });

  const ecpmRows = [];
  months.forEach(m => { (m.ecpm_data?.rows||[]).forEach(r => ecpmRows.push({...r})); });

  const priorKeys = getPriorPeriodKeys(validKeys);
  const lyKeys    = getLYPeriodKeys(validKeys);
  const sumRevForKeys = ks => r2(ks.reduce((t,k) => t + (DATA.months[k]?.total_del_rev||0), 0));
  const priorTotalRev = sumRevForKeys(priorKeys);
  const lyTotalRev    = sumRevForKeys(lyKeys);

  ['LCS1','LCS2','MM1','MM2','Others'].forEach(bu => {
    const pR = r2(priorKeys.reduce((t,k) => t+(DATA.months[k]?.bu?.[bu]?.del_rev||0), 0));
    const lR = r2(lyKeys.reduce((t,k)    => t+(DATA.months[k]?.bu?.[bu]?.del_rev||0), 0));
    buAgg[bu].growth_vs_lm = pR>0 ? r2(((buAgg[bu].del_rev-pR)/pR)*100) : null;
    buAgg[bu].growth_vs_ly = lR>0 ? r2(((buAgg[bu].del_rev-lR)/lR)*100) : null;
  });
  ['CTV','Mobile','Mobile+CTV'].forEach(p => {
    const pR = r2(priorKeys.reduce((t,k) => t+(DATA.months[k]?.platform?.[p]?.del_rev||0), 0));
    const lR = r2(lyKeys.reduce((t,k)    => t+(DATA.months[k]?.platform?.[p]?.del_rev||0), 0));
    platAgg[p].growth_vs_lm = pR>0 ? r2(((platAgg[p].del_rev-pR)/pR)*100) : null;
    platAgg[p].growth_vs_ly = lR>0 ? r2(((platAgg[p].del_rev-lR)/lR)*100) : null;
  });

  return {
    label:          getPeriodLabel(validKeys),
    total_del_rev:  totalDelRev,
    total_clients:  allClientNames.size,
    vs_prior_month: priorTotalRev>0 ? { change_pct: r2(((totalDelRev-priorTotalRev)/priorTotalRev)*100), label: getPeriodLabel(priorKeys) } : null,
    vs_last_year:   lyTotalRev>0    ? { change_pct: r2(((totalDelRev-lyTotalRev)/lyTotalRev)*100),       label: getPeriodLabel(lyKeys) }    : null,
    bu: buAgg, platform: platAgg,
    categories: Object.values(catMap).sort((a,b) => b.del_rev-a.del_rev),
    agencies:   Object.values(agMap).sort((a,b)  => b.del_rev-a.del_rev),
    top_clients: Object.values(clientMap).filter(c=>c.del_rev>0).sort((a,b)=>b.del_rev-a.del_rev),
    ad_type: adTypeAgg, ecpm_data: { rows: ecpmRows },
    _periodKeys: validKeys, _priorKeys: priorKeys, _lyKeys: lyKeys,
  };
}

function setViewMode(mode) {
  VIEW_MODE = mode;
  document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('vm-' + mode);
  if (btn) btn.classList.add('active');
  const currentRef = CURRENT_MONTH;
  populateMonthDropdown();
  const sel = document.getElementById('month-select');
  if (mode === 'quarterly') {
    const qFirst = getQuarterMonthKeys(currentRef)[0];
    const opt = Array.from(sel.options).find(o => o.value === qFirst);
    sel.value = opt ? opt.value : sel.options[0]?.value;
  } else if (mode === 'yearly') {
    const { fyNum } = getFYInfo(currentRef);
    const aprilKey  = (fyNum-1) + '-04';
    const opt = Array.from(sel.options).find(o => o.value === aprilKey);
    sel.value = opt ? opt.value : sel.options[0]?.value;
  } else {
    const opt = Array.from(sel.options).find(o => o.value === currentRef);
    sel.value = opt ? opt.value : sel.options[0]?.value;
  }
  CURRENT_MONTH = sel.value;
  renderAll();
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
    CURRENT_MONTH = DATA.current_month;
    populateMonthDropdown();
    populateCategoryDropdown();
    populateAgencyDropdown();
    attachListeners();
    document.getElementById('month-select').value = CURRENT_MONTH;
    renderAll();
    populateClientDatalist();
    initScrollSpy();
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
  const lbl = document.getElementById('period-select-label');
  if (lbl) lbl.textContent = VIEW_MODE === 'monthly' ? 'Month' : VIEW_MODE === 'quarterly' ? 'Quarter' : 'Year';

  if (VIEW_MODE === 'monthly') {
    DATA.available_months.slice().reverse().forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = DATA.months[m] ? DATA.months[m].label : m;
      sel.appendChild(o);
    });
    return;
  }
  if (VIEW_MODE === 'quarterly') {
    const seen = new Set();
    DATA.available_months.slice().reverse().forEach(m => {
      const { fy, q, fyNum, qNum } = getFYInfo(m);
      const qKey = fy + '-' + q; if (seen.has(qKey)) return; seen.add(qKey);
      const startByQ = [null,[fyNum-1,4],[fyNum-1,7],[fyNum-1,10],[fyNum,1]];
      const [sy, sm] = startByQ[qNum];
      const o = document.createElement('option');
      o.value = sy + '-' + String(sm).padStart(2,'0'); o.textContent = q + ' ' + fy;
      sel.appendChild(o);
    });
    return;
  }
  const seen = new Set();
  DATA.available_months.slice().reverse().forEach(m => {
    const { fy, fyNum } = getFYInfo(m); if (seen.has(fy)) return; seen.add(fy);
    const o = document.createElement('option');
    o.value = (fyNum-1) + '-04'; o.textContent = fy;
    sel.appendChild(o);
  });
}
function populateCategoryDropdown() {
  const sel = document.getElementById('category-select');
  while (sel.options.length > 1) sel.remove(1);
  const seen = new Set();
  DATA.available_months.forEach(mkey => {
    (DATA.months[mkey]?.categories || []).forEach(c => { if (c.name) seen.add(c.name); });
  });
  [...seen].sort().forEach(name => {
    const o = document.createElement('option'); o.value = name; o.textContent = name; sel.appendChild(o);
  });
}
function populateAgencyDropdown() {
  const sel = document.getElementById('agency-select');
  while (sel.options.length > 1) sel.remove(1);
  const seen = new Set();
  DATA.available_months.forEach(mkey => {
    (DATA.months[mkey]?.agencies || []).forEach(a => { if (a.name) seen.add(a.name); });
  });
  [...seen].sort().forEach(name => {
    const o = document.createElement('option'); o.value = name; o.textContent = name; sel.appendChild(o);
  });
}
function attachListeners() {
  document.getElementById('month-select').addEventListener('change', e => {
    CURRENT_MONTH=e.target.value; CURRENT_CATEGORY='all'; CURRENT_AGENCY='all'; CURRENT_CLIENT='all'; SEARCH_CLIENT='';
    const _m1=document.getElementById('client-filter-input'); if(_m1) _m1.value='';
    const _m2=document.getElementById('client-filter-clear'); if(_m2) _m2.style.display='none';
    document.getElementById('category-select').value='all';
    document.getElementById('agency-select').value='all';
    populateCategoryDropdown(); populateAgencyDropdown(); renderAll();
  });
  const _cfi = document.getElementById('client-filter-input');
  if (_cfi) {
    _cfi.addEventListener('input',  e => handleClientFilterInput(e.target.value));
    _cfi.addEventListener('change', e => handleClientFilterInput(e.target.value));
  }

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
  const priorMd = DATA.months[AGG_PRIOR_KEY || priorMonthKey(CURRENT_MONTH)] || null;
  const flags = [];

  const classify = (pct, label, type) => {
    if (pct === null || pct === undefined) return;
    if (pct <= -20)      flags.push({ cls:'flag-red',   icon:'🔴', text: label+' '+pct+'% vs LM',  label, type, pct });
    else if (pct <= -10) flags.push({ cls:'flag-amber', icon:'🟡', text: label+' '+pct+'% vs LM',  label, type, pct });
    else if (pct >= 20)  flags.push({ cls:'flag-green', icon:'🟢', text: label+' +'+pct+'% vs LM', label, type, pct });
  };

  const anyFilterActive = CURRENT_BU !== 'all' || CURRENT_PLATFORM !== 'all' ||
    CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all' ||
    CURRENT_ADTYPE !== 'all' || CURRENT_FORMAT !== 'all';

  // ── Revenue for a client under active platform/adtype filters ──
  const getClientRev = (c) => {
    if (CURRENT_PLATFORM === 'CTV')        return c.ctv_rev       ?? 0;
    if (CURRENT_PLATFORM === 'Mobile')     return c.mobile_rev    ?? 0;
    if (CURRENT_PLATFORM === 'Mobile+CTV') return c.mobilectv_rev ?? 0;
    if (CURRENT_ADTYPE   === 'Video')      return c.video_rev     ?? 0;
    if (CURRENT_ADTYPE   === 'Display')    return c.display_rev   ?? 0;
    return c.del_rev ?? 0;
  };

  // ── Filtered client pool for any month (BU + Category + Agency) ──
  const getPool = (monthData) => {
    if (!monthData) return [];
    let cs = (monthData.top_clients || []).slice();
    cs = filterClientsByBU(cs, CURRENT_BU);
    if (CURRENT_CATEGORY !== 'all') cs = cs.filter(c => c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
    if (CURRENT_AGENCY   !== 'all') cs = cs.filter(c => c.agency   === CURRENT_AGENCY   || (c.agency_rev_map   && c.agency_rev_map[CURRENT_AGENCY]   > 0));
    if (CURRENT_CLIENT   !== 'all') cs = cs.filter(c => c.name === CURRENT_CLIENT);
    return cs;
  };

  // ── BU flags — skip if a specific BU is already selected ──────
  if (CURRENT_BU === 'all') {
    ['LCS1','LCS2','MM1','MM2'].forEach(bu => {
      if (!anyFilterActive) {
        const b = md.bu[bu] || {};
        classify(b.growth_vs_lm ?? null, bu, 'BU');
      } else {
        // Compute BU rev from clients (respects platform/adtype/category/agency filters)
        const currPool  = getPool(md).filter(c => c.bu === bu);
        const priorPool = getPool(priorMd).filter(c => c.bu === bu);
        const currRev   = r2(currPool.reduce((t,c)  => t + getClientRev(c), 0));
        const priorRev  = r2(priorPool.reduce((t,c) => t + getClientRev(c), 0));
        const pct = priorRev > 0 ? r2(((currRev - priorRev) / priorRev) * 100) : null;
        classify(pct, bu, 'BU');
      }
    });
  }

  // ── Platform flags — skip if a specific platform is already selected ──
  if (CURRENT_PLATFORM === 'all') {
    ['CTV','Mobile','Mobile+CTV'].forEach(p => {
      const platKey = p === 'CTV' ? 'ctv_rev' : p === 'Mobile' ? 'mobile_rev' : 'mobilectv_rev';
      if (!anyFilterActive) {
        const pl = md.platform[p] || {};
        classify(pl.growth_vs_lm ?? null, p, 'Platform');
      } else {
        const currPool  = getPool(md);
        const priorPool = getPool(priorMd);
        const currRev   = r2(currPool.reduce((t,c)  => t + (c[platKey] ?? 0), 0));
        const priorRev  = r2(priorPool.reduce((t,c) => t + (c[platKey] ?? 0), 0));
        const pct = priorRev > 0 ? r2(((currRev - priorRev) / priorRev) * 100) : null;
        classify(pct, p, 'Platform');
      }
    });
  }

  // ── Category flags — skip if a specific category is already selected ──
  if (CURRENT_CATEGORY === 'all') {
    if (!anyFilterActive) {
      (md.categories || []).slice(0,10).forEach(cat => {
        if (!priorMd) return;
        const prior = (priorMd.categories || []).find(c => c.name === cat.name);
        if (!prior || prior.del_rev <= 0) return;
        const pct = r2(((cat.del_rev - prior.del_rev) / prior.del_rev) * 100);
        classify(pct, cat.name, 'Category');
      });
    } else {
      const currPool  = getPool(md);
      const priorPool = getPool(priorMd);
      const currCat = {}, priorCat = {};
      currPool.forEach(c  => { if (c.category) currCat[c.category]  = (currCat[c.category]  || 0) + getClientRev(c); });
      priorPool.forEach(c => { if (c.category) priorCat[c.category] = (priorCat[c.category] || 0) + getClientRev(c); });
      Object.entries(currCat).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([catName, currRev]) => {
        const priorRev = priorCat[catName] ?? 0;
        if (priorRev <= 0) return;
        classify(r2(((currRev - priorRev) / priorRev) * 100), catName, 'Category');
      });
    }
  }

  // ── Agency flags — skip if a specific agency is already selected ──
  if (CURRENT_AGENCY === 'all') {
    if (!anyFilterActive) {
      (md.agencies || []).forEach(ag => {
        if (!priorMd) return;
        const prior = (priorMd.agencies || []).find(a => a.name === ag.name);
        if (!prior || prior.del_rev <= 0) return;
        const pct = r2(((ag.del_rev - prior.del_rev) / prior.del_rev) * 100);
        classify(pct, ag.name, 'Agency');
      });
    } else {
      const currPool  = getPool(md);
      const priorPool = getPool(priorMd);
      const currAg = {}, priorAg = {};
      currPool.forEach(c  => { if (c.agency) currAg[c.agency]  = (currAg[c.agency]  || 0) + getClientRev(c); });
      priorPool.forEach(c => { if (c.agency) priorAg[c.agency] = (priorAg[c.agency] || 0) + getClientRev(c); });
      Object.entries(currAg).forEach(([agName, currRev]) => {
        const priorRev = priorAg[agName] ?? 0;
        if (priorRev <= 0) return;
        classify(r2(((currRev - priorRev) / priorRev) * 100), agName, 'Agency');
      });
    }
  }

  const row = document.getElementById('flags-row');
  if (!flags.length) { row.style.display = 'none'; return; }

  const order = { 'flag-red': 0, 'flag-amber': 1, 'flag-green': 2 };
  flags.sort((a, b) => order[a.cls] - order[b.cls]);

  const filterLabel = [CURRENT_BU, CURRENT_PLATFORM, CURRENT_ADTYPE, CURRENT_CATEGORY, CURRENT_AGENCY]
    .filter(v => v !== 'all').join(' · ');
  const headerText = filterLabel
    ? '📊 Auto Diagnostics [' + filterLabel + '] — click any flag for client breakdown'
    : '📊 Auto Diagnostics — click any flag for client breakdown';

  row.style.display = 'flex';
  row.innerHTML = '<div style="width:100%;font-size:11px;font-weight:600;color:var(--ink-soft);letter-spacing:0.05em;text-transform:uppercase;padding-bottom:4px">' + headerText + '</div>' +
    flags.map(function(f) {
      var safeName = f.label.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return '<span class="flag-pill ' + f.cls + '" onclick="openDiagDrilldown(\'' + f.type + '\',\'' + safeName + '\',' + f.pct + ')" style="cursor:pointer" title="Click to see who drove this">' + f.icon + ' ' + f.text + ' ↗</span>';
    }).join('');
}
// ── Diagnostic Drill-down ─────────────────────────
function openDiagDrilldown(type, name, pct, showLY = false) {
  const md      = DATA.months[CURRENT_MONTH]; if (!md) return;
  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)]; if (!priorMd) return;
  const lyMd = DATA.months[lyMonthKey(CURRENT_MONTH)] || null;

  // Get revenue for a client given entity type
  const getEntityRev = (c) => {
    if (type === 'Platform') {
      if (name === 'CTV')        return c.ctv_rev       ?? 0;
      if (name === 'Mobile')     return c.mobile_rev    ?? 0;
      if (name === 'Mobile+CTV') return c.mobilectv_rev ?? 0;
    }
    const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    if (f !== 'all') { const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null; if (!base) return 0; if (p === 'CTV') return c[`ctv_${base}_rev`]??0; if (p === 'Mobile') return c[`mob_${base}_rev`]??0; if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`]??0; return c[fk]??0; }
    if (a === 'Video')   { if (p === 'CTV') return c.ctv_video_rev??0;   if (p === 'Mobile') return c.mob_video_rev??0;   if (p === 'Mobile+CTV') return c.mobilectv_video_rev??0;   return c.video_rev??0; }
    if (a === 'Display') { if (p === 'CTV') return c.ctv_display_rev??0; if (p === 'Mobile') return c.mob_display_rev??0; if (p === 'Mobile+CTV') return c.mobilectv_display_rev??0; return c.display_rev??0; }
    if (p === 'CTV')        return c.ctv_rev        ?? 0;
    if (p === 'Mobile')     return c.mobile_rev     ?? 0;
    if (p === 'Mobile+CTV') return c.mobilectv_rev  ?? 0;
    return c.del_rev ?? 0;
  };

  // Filter clients belonging to this entity
  const filterForEntity = (clients) => {
    if (type === 'BU') {
      if (name === 'Others') return clients.filter(c => !MAIN_BUS.includes(c.bu));
      return clients.filter(c => c.bu === name);
    }
    if (type === 'Platform') return clients; // all clients — we use entity-specific rev field
    if (type === 'Category') return clients.filter(c => c.category === name || (c.category_rev_map && c.category_rev_map[name] > 0));
    if (type === 'Agency')   return clients.filter(c => c.agency   === name || (c.agency_rev_map   && c.agency_rev_map[name]   > 0));
    return clients;
  };

  const currClients  = filterForEntity(md.top_clients      || []);
  const priorClients = filterForEntity(priorMd.top_clients || []);

  const currNames  = new Set(currClients.map(c  => c.name));
  const priorNames = new Set(priorClients.map(c => c.name));
  const priorRevMap = Object.fromEntries(priorClients.map(c => [c.name, getEntityRev(c)]));
  // ── Actual entity-level delta from stored data ─────────────
  let actualCurrRev = null, actualPriorRev = null;
  if (type === 'BU') {
    actualCurrRev  = md.bu[name]?.del_rev ?? null;
    actualPriorRev = priorMd.bu[name]?.del_rev ?? null;
  } else if (type === 'Platform') {
    actualCurrRev  = md.platform[name]?.del_rev ?? null;
    actualPriorRev = priorMd.platform[name]?.del_rev ?? null;
  } else if (type === 'Category') {
    actualCurrRev  = (md.categories || []).find(c => c.name === name)?.del_rev ?? null;
    actualPriorRev = (priorMd.categories || []).find(c => c.name === name)?.del_rev ?? null;
  } else if (type === 'Agency') {
    actualCurrRev  = (md.agencies || []).find(a => a.name === name)?.del_rev ?? null;
    actualPriorRev = (priorMd.agencies || []).find(a => a.name === name)?.del_rev ?? null;
  }
  const actualDelta = (actualCurrRev !== null && actualPriorRev !== null)
    ? r2(actualCurrRev - actualPriorRev) : null;

  // 1. Churned — in prior, not in current
  const churned = priorClients
    .filter(c => !currNames.has(c.name) && getEntityRev(c) > 0)
    .map(c => ({ name: c.name, bu: c.bu || '—', category: c.category || '—', priorRev: getEntityRev(c), currRev: 0, delta: -getEntityRev(c) }))
    .sort((a, b) => a.delta - b.delta);

  // 2. Declined — in both, revenue went down
  const declined = currClients
    .map(c => ({ name: c.name, bu: c.bu || '—', category: c.category || '—', priorRev: priorRevMap[c.name] ?? 0, currRev: getEntityRev(c), delta: r2(getEntityRev(c) - (priorRevMap[c.name] ?? 0)) }))
    .filter(c => c.delta < -0.01 && c.priorRev > 0)
    .sort((a, b) => a.delta - b.delta);

  // 3. Grew — in current, revenue went up
  const grew = currClients
    .map(c => ({ name: c.name, bu: c.bu || '—', category: c.category || '—', priorRev: priorRevMap[c.name] ?? 0, currRev: getEntityRev(c), delta: r2(getEntityRev(c) - (priorRevMap[c.name] ?? 0)) }))
    .filter(c => c.delta > 0.01)
    .sort((a, b) => b.delta - a.delta);

  // 4. New clients (weren't in prior at all)
  const newClients = currClients
    .filter(c => !priorNames.has(c.name) && getEntityRev(c) > 0.01)
    .map(c => ({ name: c.name, bu: c.bu || '—', category: c.category || '—', priorRev: 0, currRev: getEntityRev(c), delta: getEntityRev(c) }))
    .sort((a, b) => b.delta - a.delta);

  const totalDelta    = r2([...churned, ...declined].reduce((t, c) => t + c.delta, 0));
  const totalPositive = r2([...grew, ...newClients].reduce((t, c) => t + c.delta, 0));
  const sign = pct >= 0 ? '+' : '';
  const pctColor = pct <= -10 ? 'var(--red)' : pct >= 10 ? 'var(--green)' : 'var(--amber)';

  // ── Header ────────────────────────────────────────────────
  document.getElementById('diag-header').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between">
      <div>
        <div style="font-size:16px;font-weight:600;color:var(--ink)">${name} — Client Breakdown</div>
        <div id="diag-stats">
          <div style="font-size:12px;color:var(--ink-soft);margin-top:3px">${type} · ${md.label} vs ${priorMd.label}</div>
          <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <span style="font-size:13px;font-weight:600;color:${pctColor}">${sign}${pct}% overall</span>
            ${actualDelta !== null ? `<span style="font-size:12px;font-weight:600;color:${actualDelta>=0?'var(--green)':'var(--red)'};font-family:var(--mono)">${actualDelta>=0?'+':''}${fmtNum(actualDelta)} Cr actual move</span>` : ''}
          </div>
          <div style="margin-top:6px;font-size:11px;color:var(--ink-soft);background:var(--surface);padding:5px 8px;border-radius:6px;border:1px solid var(--border)">
            ⚠️ Breakdown below covers <strong>top clients only</strong> — smaller clients not in the list may account for the remaining gap
          </div>
          <div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap">
            ${totalDelta < 0 ? `<span style="font-size:12px;color:var(--red);font-family:var(--mono)">${fmtNum(totalDelta)} Cr from churned + declined (top clients)</span>` : ''}
            ${totalPositive > 0 ? `<span style="font-size:12px;color:var(--green);font-family:var(--mono)">+${fmtNum(totalPositive)} Cr from grew + new (top clients)</span>` : ''}
          </div>
        </div>
      </div>
      <button onclick="closeDiagDrilldown()" style="background:none;border:none;font-size:18px;color:var(--ink-soft);cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1">✕</button>
    </div>
    ${showLY && lyMd ? `<div style="display:flex;gap:6px;margin-top:10px">
      <button id="diag-tab-lm" onclick="switchDiagTab('lm')" style="padding:4px 14px;border-radius:20px;border:1px solid var(--accent);background:var(--accent);color:#fff;font-size:12px;font-weight:500;cursor:pointer;font-family:var(--font)">vs Last Month</button>
      <button id="diag-tab-ly" onclick="switchDiagTab('ly')" style="padding:4px 14px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--ink-soft);font-size:12px;font-weight:500;cursor:pointer;font-family:var(--font)">vs Last Year</button>
    </div>` : ''}`;
    
  // ── Client table builder ──────────────────────────────────
  const clientTable = (list, emptyMsg) => {
    if (!list.length) return `<div style="padding:12px 0;color:var(--ink-soft);font-size:12px">${emptyMsg}</div>`;
    return `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table class="ptable" style="min-width:480px;width:100%">
        <thead><tr>
          <th style="min-width:24px">#</th>
          <th style="min-width:140px">Client</th>
          <th style="min-width:50px">BU</th>
          <th style="text-align:right;min-width:72px">LM Rev</th>
          <th style="text-align:right;min-width:72px">Now</th>
          <th style="text-align:right;min-width:72px">Delta</th>
        </tr></thead>
        <tbody>
          ${list.map((c, i) => `<tr>
            <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${i+1}</td>
            <td style="font-weight:500;font-size:12px">${c.name}</td>
            <td><span class="badge ${({LCS1:'badge-green',LCS2:'badge-blue',MM1:'badge-amber',MM2:'badge-red'}[c.bu]||'badge-gray')}" style="font-size:9px">${c.bu}</span></td>
            <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--ink-soft)">${c.priorRev > 0 ? fmtNum(c.priorRev)+' Cr' : '—'}</td>
            <td style="text-align:right;font-family:var(--mono);font-size:12px">${c.currRev > 0 ? fmtNum(c.currRev)+' Cr' : '<span style="color:var(--ink-faint)">—</span>'}</td>
            <td style="text-align:right;font-family:var(--mono);font-size:12px;font-weight:600;color:${c.delta>=0?'var(--green)':'var(--red)'}">${c.delta>=0?'+':''}${fmtNum(c.delta)} Cr</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  };

  // ── Section builder ───────────────────────────────────────
  const section = (icon, title, subtitle, bgColor, list, emptyMsg) => `
    <div style="margin-top:16px">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:${bgColor};border-radius:8px 8px 0 0;border:1px solid var(--border)">
        <span style="font-size:14px">${icon}</span>
        <div>
          <div style="font-size:12px;font-weight:600;color:var(--ink)">${title} <span style="color:var(--ink-soft);font-weight:400">(${list.length} client${list.length!==1?'s':''})</span></div>
          ${subtitle ? `<div style="font-size:11px;color:var(--ink-soft)">${subtitle}</div>` : ''}
        </div>
      </div>
      <div style="border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;overflow-x:auto">
        ${clientTable(list, emptyMsg)}
      </div>
    </div>`;

  _diagLMContent =
    section('🔴', 'Churned',     `Were active in ${priorMd.label}, zero spend this month`,  'var(--red-soft)',       churned,    'No churned clients — good sign!') +
    section('🟡', 'Declined',    `Still active but reduced spend vs ${priorMd.label}`,        'var(--amber-soft)',     declined,   'No declines — all active clients held or grew.') +
    section('🆕', 'New Clients', `Weren't active in ${priorMd.label}, appeared this month`,  'rgba(59,130,246,0.08)', newClients, `No new clients in ${md.label}.`) +
    section('🟢', 'Grew',        `Active in both months, revenue increased`,                   'var(--green-soft)',     grew,       'No clients grew — all were flat or declined.');

  if (showLY && lyMd) {
    const lyClientsF = filterForEntity(lyMd.top_clients || []);
    const lyNames    = new Set(lyClientsF.map(c => c.name));
    const lyRevMap   = Object.fromEntries(lyClientsF.map(c => [c.name, getEntityRev(c)]));
    const churnedLY  = lyClientsF.filter(c => !currNames.has(c.name) && getEntityRev(c)>0).map(c=>({name:c.name,bu:c.bu||'—',category:c.category||'—',priorRev:getEntityRev(c),currRev:0,delta:-getEntityRev(c)})).sort((a,b)=>a.delta-b.delta);
    const declinedLY = currClients.map(c=>({name:c.name,bu:c.bu||'—',category:c.category||'—',priorRev:lyRevMap[c.name]??0,currRev:getEntityRev(c),delta:r2(getEntityRev(c)-(lyRevMap[c.name]??0))})).filter(c=>c.delta<-0.01&&c.priorRev>0).sort((a,b)=>a.delta-b.delta);
    const grewLY     = currClients.map(c=>({name:c.name,bu:c.bu||'—',category:c.category||'—',priorRev:lyRevMap[c.name]??0,currRev:getEntityRev(c),delta:r2(getEntityRev(c)-(lyRevMap[c.name]??0))})).filter(c=>c.delta>0.01).sort((a,b)=>b.delta-a.delta);
    const newLY      = currClients.filter(c=>!lyNames.has(c.name)&&getEntityRev(c)>0.01).map(c=>({name:c.name,bu:c.bu||'—',category:c.category||'—',priorRev:0,currRev:getEntityRev(c),delta:getEntityRev(c)})).sort((a,b)=>b.delta-a.delta);
    _diagLYContent =
      section('🔴', 'Churned',     `Were active in ${lyMd.label}, zero spend this month`,  'var(--red-soft)',       churnedLY,  'No churned clients!') +
      section('🟡', 'Declined',    `Still active but reduced spend vs ${lyMd.label}`,        'var(--amber-soft)',     declinedLY, 'No declines.') +
      section('🆕', 'New Clients', `Weren't active in ${lyMd.label}, appeared this month`,  'rgba(59,130,246,0.08)', newLY,      'No new clients.') +
      section('🟢', 'Grew',        `Active in both, revenue increased vs ${lyMd.label}`,     'var(--green-soft)',     grewLY,     'No clients grew.');
    const lyActCurr  = type==='Category' ? (md.categories||[]).find(c=>c.name===name)?.del_rev??null : type==='Agency' ? (md.agencies||[]).find(a=>a.name===name)?.del_rev??null : null;
    const lyActPrior = type==='Category' ? (lyMd.categories||[]).find(c=>c.name===name)?.del_rev??null : type==='Agency' ? (lyMd.agencies||[]).find(a=>a.name===name)?.del_rev??null : null;
    const lyActDelta = lyActCurr!==null&&lyActPrior!==null ? r2(lyActCurr-lyActPrior) : null;
    const lyPct_     = lyActCurr!==null&&lyActPrior!==null&&lyActPrior>0 ? r2(((lyActCurr-lyActPrior)/lyActPrior)*100) : 0;
    const lyTotNeg   = r2([...churnedLY,...declinedLY].reduce((t,c)=>t+c.delta,0));
    const lyTotPos   = r2([...grewLY,...newLY].reduce((t,c)=>t+c.delta,0));
    const lyPctCol_  = lyPct_<=-10?'var(--red)':lyPct_>=10?'var(--green)':'var(--amber)';
    _diagLYStats = '<div style="font-size:12px;color:var(--ink-soft);margin-top:3px">'+type+' \u00b7 '+md.label+' vs '+lyMd.label+'</div>'
      +'<div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><span style="font-size:13px;font-weight:600;color:'+lyPctCol_+'">'+(lyPct_>=0?'+':'')+lyPct_+'% overall</span>'+(lyActDelta!==null?'<span style="font-size:12px;font-weight:600;color:'+(lyActDelta>=0?'var(--green)':'var(--red)')+';font-family:var(--mono)">'+(lyActDelta>=0?'+':'')+fmtNum(lyActDelta)+' Cr actual move</span>':'')+'</div>'
      +'<div style="margin-top:6px;font-size:11px;color:var(--ink-soft);background:var(--surface);padding:5px 8px;border-radius:6px;border:1px solid var(--border)">⚠️ Breakdown below covers <strong>top clients only</strong> — smaller clients not in the list may account for the remaining gap</div>'
      +'<div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap">'+(lyTotNeg<0?'<span style="font-size:12px;color:var(--red);font-family:var(--mono)">'+fmtNum(lyTotNeg)+' Cr from churned + declined (top clients)</span>':'')+(lyTotPos>0?'<span style="font-size:12px;color:var(--green);font-family:var(--mono)">+'+fmtNum(lyTotPos)+' Cr from grew + new (top clients)</span>':'')+'</div>';
  }

  _diagLMStats = '<div style="font-size:12px;color:var(--ink-soft);margin-top:3px">'+type+' \u00b7 '+md.label+' vs '+priorMd.label+'</div>'
    +'<div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><span style="font-size:13px;font-weight:600;color:'+pctColor+'">'+sign+pct+'% overall</span>'+(actualDelta!==null?'<span style="font-size:12px;font-weight:600;color:'+(actualDelta>=0?'var(--green)':'var(--red)')+';font-family:var(--mono)">'+(actualDelta>=0?'+':'')+fmtNum(actualDelta)+' Cr actual move</span>':'')+'</div>'
    +'<div style="margin-top:6px;font-size:11px;color:var(--ink-soft);background:var(--surface);padding:5px 8px;border-radius:6px;border:1px solid var(--border)">⚠️ Breakdown below covers <strong>top clients only</strong> — smaller clients not in the list may account for the remaining gap</div>'
    +'<div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap">'+(totalDelta<0?'<span style="font-size:12px;color:var(--red);font-family:var(--mono)">'+fmtNum(totalDelta)+' Cr from churned + declined (top clients)</span>':'')+(totalPositive>0?'<span style="font-size:12px;color:var(--green);font-family:var(--mono)">+'+fmtNum(totalPositive)+' Cr from grew + new (top clients)</span>':'')+'</div>';

  document.getElementById('diag-content').innerHTML = _diagLMContent;

  // ── Open drawer ───────────────────────────────────────────
  const overlay = document.getElementById('diag-overlay');
  const drawer  = document.getElementById('diag-drawer');
  overlay.style.display = 'block';
  drawer.style.display  = 'flex';
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDiagDrilldown() {
  document.getElementById('diag-overlay').style.display = 'none';
  const drawer = document.getElementById('diag-drawer');
  drawer.style.display  = 'none';
  drawer.classList.remove('open');
  document.body.style.overflow = '';
}
function switchDiagTab(tab) {
  document.getElementById('diag-content').innerHTML = tab === 'lm' ? _diagLMContent : _diagLYContent;
  const statsEl = document.getElementById('diag-stats');
  if (statsEl) statsEl.innerHTML = tab === 'lm' ? _diagLMStats : _diagLYStats;
  const lmBtn = document.getElementById('diag-tab-lm');
  const lyBtn = document.getElementById('diag-tab-ly');
  if (lmBtn) { lmBtn.style.background = tab==='lm'?'var(--accent)':'transparent'; lmBtn.style.color = tab==='lm'?'#fff':'var(--ink-soft)'; lmBtn.style.borderColor = tab==='lm'?'var(--accent)':'var(--border)'; }
  if (lyBtn) { lyBtn.style.background = tab==='ly'?'var(--accent)':'transparent'; lyBtn.style.color = tab==='ly'?'#fff':'var(--ink-soft)'; lyBtn.style.borderColor = tab==='ly'?'var(--accent)':'var(--border)'; }
}
let buChart = null;
let platformChart = null;
let bubbleChart = null;
let diveChart = null;
let DIVE_FROM = null;
let DIVE_TO   = null;
let _diveHistory = [];
let _diagLMContent = '';
let _diagLYContent = '';
let _diagLMStats = '';
let _diagLYStats = '';

function renderCharts(md) {
  const lyMd = DATA.months[lyMonthKey(CURRENT_MONTH)] || null;

  // ── BU Bar Chart ──────────────────────────────────
  const buLabels = ['LCS1','LCS2','MM1','MM2','Others'];
  const buCurr   = buLabels.map(b => md.bu[b] ? r2(md.bu[b].del_rev) : 0);
  const buLY     = buLabels.map(b => lyMd && lyMd.bu[b] ? r2(lyMd.bu[b].del_rev) : 0);

  const barLabelPlugin = {
    id: 'barLabels',
    afterDatasetsDraw(chart) {
      const { ctx, data } = chart;
      ctx.save();
      data.datasets.forEach((dataset, di) => {
        chart.getDatasetMeta(di).data.forEach((bar, i) => {
          const val = dataset.data[i];
          if (!val) return;
          ctx.fillStyle = '#475569';
          ctx.font = '500 10px DM Sans, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(val + ' Cr', bar.x, bar.y - 4);
        });
      });
      ctx.restore();
    }
  };

  if (buChart) buChart.destroy();
  const buCtx = document.getElementById('bu-chart').getContext('2d');
  buChart = new Chart(buCtx, {
    type: 'bar',
    plugins: [barLabelPlugin],
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

  const doughnutLabelPlugin = {
    id: 'doughnutLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dataset = chart.data.datasets[0];
      const total = dataset.data.reduce((a, b) => a + b, 0);
      ctx.save();
      chart.getDatasetMeta(0).data.forEach((arc, i) => {
        const val = dataset.data[i];
        if (!val) return;
        const pct = Math.round((val / total) * 100);
        if (pct < 5) return;
        const angle = (arc.startAngle + arc.endAngle) / 2;
        const r = (arc.innerRadius + arc.outerRadius) / 2;
        const x = arc.x + r * Math.cos(angle);
        const y = arc.y + r * Math.sin(angle);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pct + '%', x, y);
      });
      ctx.restore();
    }
  };

  if (platformChart) platformChart.destroy();
  const platCtx = document.getElementById('platform-chart').getContext('2d');
  platformChart = new Chart(platCtx, {
    type: 'doughnut',
    plugins: [doughnutLabelPlugin],
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
    return 'rgba(139,92,246,0.55)';
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
        { x: left, y: cy,   w: cx - left,   h: bottom - cy, color: 'rgba(139,92,246,0.04)' },
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
        { text: 'SCALE UP',          color: 'rgba(16,185,129,0.7)',  x: cx + 8,   y: top + 14    },
        { text: 'REVIVE & PROTECT',  color: 'rgba(245,158,11,0.7)',  x: left + 8, y: top + 14    },
        { text: 'BUILD MOMENTUM',    color: 'rgba(59,130,246,0.7)',  x: cx + 8,   y: bottom - 10 },
        { text: 'UNTAPPED',          color: 'rgba(139,92,246,0.7)',  x: left + 8, y: bottom - 10 },
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
  if (VIEW_MODE === 'monthly') {
    const md = DATA.months[CURRENT_MONTH]; if (!md) return;
    AGG_PRIOR_KEY = null; AGG_LY_KEY = null;
    _renderAllWith(md); return;
  }
  const currentKeys = VIEW_MODE === 'quarterly' ? getQuarterMonthKeys(CURRENT_MONTH) : getFYMonthKeys(CURRENT_MONTH);
  const md = aggregateMonths(currentKeys); if (!md) return;
  const aggPrior = aggregateMonths(getPriorPeriodKeys(currentKeys));
  const aggLY    = aggregateMonths(getLYPeriodKeys(currentKeys));
  DATA.months['__AGG_CURR__']  = md;
  DATA.months['__AGG_PRIOR__'] = aggPrior || {};
  DATA.months['__AGG_LY__']    = aggLY    || {};
  AGG_PRIOR_KEY = aggPrior ? '__AGG_PRIOR__' : null;
  AGG_LY_KEY    = aggLY    ? '__AGG_LY__'    : null;
  const saved = CURRENT_MONTH; CURRENT_MONTH = '__AGG_CURR__';
  _renderAllWith(md);
  CURRENT_MONTH = saved; AGG_PRIOR_KEY = null; AGG_LY_KEY = null;
}
function _renderAllWith(md) {
  renderHeader(md); renderKPIs(md); renderCharts(md); renderBubbleMap(md);
  renderBU(md); renderPlatform(md); renderAdType(md);
  renderCategories(md); renderAgencies(md); renderClients(md);
  if (VIEW_MODE === 'monthly') { renderCohort(); renderChurners(); }
  else {
    ['cohort-panel','churner-panel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="padding:20px 18px;color:var(--ink-soft);font-size:13px">📅 Switch to <strong>Monthly</strong> view to see this data.</div>';
    });
  }
  renderFlags(md); renderPillBar(); renderSectionBadges();
}

// ── Header ────────────────────────────────────────
function renderHeader(md) {
  document.getElementById('page-title').textContent = md.label;
  document.getElementById('page-sub').textContent = 'Revenue Intelligence · JioStar';
  const colOf = p => p > 0 ? 'var(--green)' : p < 0 ? 'var(--red)' : 'var(--ink-soft)';

  const anyFilterActive = CURRENT_BU !== 'all' || CURRENT_PLATFORM !== 'all' ||
    CURRENT_ADTYPE !== 'all' || CURRENT_FORMAT !== 'all' ||
    CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all' || CURRENT_CLIENT !== 'all';

  let headerClientCount;
  if (!anyFilterActive) {
    headerClientCount = md.total_clients;
  } else {
    const clientRevForHeader = (c) => {
      const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
      if (f !== 'all') { const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null; if (!base) return 0; if (p === 'CTV') return c[`ctv_${base}_rev`]??0; if (p === 'Mobile') return c[`mob_${base}_rev`]??0; if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`]??0; return c[fk]??0; }
      if (a === 'Video')   { if (p === 'CTV') return c.ctv_video_rev??0; if (p === 'Mobile') return c.mob_video_rev??0; if (p === 'Mobile+CTV') return c.mobilectv_video_rev??0; return c.video_rev??0; }
      if (a === 'Display') { if (p === 'CTV') return c.ctv_display_rev??0; if (p === 'Mobile') return c.mob_display_rev??0; if (p === 'Mobile+CTV') return c.mobilectv_display_rev??0; return c.display_rev??0; }
      if (p === 'CTV') return c.ctv_rev??0; if (p === 'Mobile') return c.mobile_rev??0; if (p === 'Mobile+CTV') return c.mobilectv_rev??0;
      return c.del_rev??0;
    };
    let pool = (md.top_clients||[]).slice();
    pool = filterClientsByBU(pool, CURRENT_BU);
    if (CURRENT_CATEGORY !== 'all') pool = pool.filter(c => c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
    if (CURRENT_AGENCY   !== 'all') pool = pool.filter(c => c.agency   === CURRENT_AGENCY   || (c.agency_rev_map   && c.agency_rev_map[CURRENT_AGENCY]   > 0));
    if (CURRENT_CLIENT   !== 'all') pool = pool.filter(c => c.name === CURRENT_CLIENT);
    headerClientCount = pool.filter(c => clientRevForHeader(c) > 0).length;
  }

  let metaHtml = `<span>${fmtInt(headerClientCount)} active clients</span>`;
  if (md.vs_prior_month && md.vs_prior_month.change_pct !== null) {
    const p = md.vs_prior_month.change_pct;
    metaHtml += ` <span style="color:var(--ink-faint)">·</span> <span style="color:${colOf(p)};white-space:nowrap">Del Rev ${p>=0?'+':''}${p}% vs ${md.vs_prior_month.label}</span>`;
  }
  if (md.vs_last_year && md.vs_last_year.change_pct !== null) {
    const p = md.vs_last_year.change_pct;
    metaHtml += ` <span style="color:var(--ink-faint)">·</span> <span style="color:${colOf(p)};white-space:nowrap">Del Rev ${p>=0?'+':''}${p}% vs ${md.vs_last_year.label}</span>`;
  }
  document.getElementById('topbar-meta').innerHTML = metaHtml;
}

// ── KPI Cards ─────────────────────────────────────
function renderKPIs(md) {
  const momC = md.vs_prior_month?.change_pct != null ? { pct: md.vs_prior_month.change_pct, label: 'vs '+md.vs_prior_month.label } : null;
  const lyC  = md.vs_last_year?.change_pct   != null ? { pct: md.vs_last_year.change_pct,   label: 'vs '+md.vs_last_year.label   } : null;

  const anyFilterActive = CURRENT_BU !== 'all' || CURRENT_PLATFORM !== 'all' ||
    CURRENT_ADTYPE !== 'all' || CURRENT_FORMAT !== 'all' ||
    CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all' || CURRENT_CLIENT !== 'all';
  const priorMd = DATA.months[AGG_PRIOR_KEY || priorMonthKey(CURRENT_MONTH)] || null;

  // ── Get filtered clients pool ──────────────────────────────
  let filteredClients = (md.top_clients || []).slice();
  filteredClients = filterClientsByBU(filteredClients, CURRENT_BU);
  if (CURRENT_CATEGORY !== 'all') filteredClients = filteredClients.filter(c =>
    c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
  if (CURRENT_AGENCY !== 'all') filteredClients = filteredClients.filter(c =>
    c.agency === CURRENT_AGENCY || (c.agency_rev_map && c.agency_rev_map[CURRENT_AGENCY] > 0));
  if (CURRENT_CLIENT !== 'all') filteredClients = filteredClients.filter(c => c.name === CURRENT_CLIENT);

  // ── Client rev for platform/adtype/format filters ──────────
  const clientRevForFilters = (c) => {
    const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    const _vBs = ['preroll','midroll','integ','spots'];
    const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
    if (f !== 'all') {
      const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      // Cross-type mismatch: adtype=Display but video format selected (or vice versa) → 0
      if (a === 'Display' && _vBs.includes(base)) return 0;
      if (a === 'Video'   && _dBs.includes(base)) return 0;
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
    totalBooked  = ['LCS1','LCS2','MM1','MM2'].reduce((t,b) => t + (md.bu[b] && md.bu[b].booked_rev != null ? md.bu[b].booked_rev : 0), 0);
  } else {
    const agScale = (c) => {
      if (CURRENT_AGENCY === 'all') return 1;
      if (c.agency_rev_map && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
      return c.agency === CURRENT_AGENCY ? 1 : 0;
    };
    const catScale = (c) => {
      if (CURRENT_CATEGORY === 'all') return 1;
      if (c.category_rev_map && c.del_rev > 0) return (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev;
      return c.category === CURRENT_CATEGORY ? 1 : 0;
    };
    totalRev     = r2(filteredClients.reduce((t,c) => t + clientRevForFilters(c) * agScale(c) * catScale(c), 0));
    totalClients = filteredClients.filter(c => clientRevForFilters(c) * agScale(c) * catScale(c) > 0).length;
    totalBooked  = r2(filteredClients.reduce((t,c) => {
      const cr = clientRevForFilters(c) * agScale(c) * catScale(c);
      return t + (c.booked_rev != null && c.del_rev > 0 ? c.booked_rev * (cr/c.del_rev) : 0);
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
    const _gCTV = (c) => {
      if (CURRENT_PLATFORM === 'Mobile' || CURRENT_PLATFORM === 'Mobile+CTV') return 0;
      const _f = CURRENT_FORMAT, _a = CURRENT_ADTYPE;
      if (_f !== 'all') { const fk = formatFieldKey(_f); const base = fk ? fk.replace('_rev','') : null; return base ? (c[`ctv_${base}_rev`] ?? 0) : 0; }
      if (_a === 'Video') return c.ctv_video_rev ?? 0;
      if (_a === 'Display') return c.ctv_display_rev ?? 0;
      return c.ctv_rev ?? 0;
    };
    const _gMob = (c) => {
      if (CURRENT_PLATFORM === 'CTV' || CURRENT_PLATFORM === 'Mobile+CTV') return 0;
      const _f = CURRENT_FORMAT, _a = CURRENT_ADTYPE;
      if (_f !== 'all') { const fk = formatFieldKey(_f); const base = fk ? fk.replace('_rev','') : null; return base ? (c[`mob_${base}_rev`] ?? 0) : 0; }
      if (_a === 'Video') return c.mob_video_rev ?? 0;
      if (_a === 'Display') return c.mob_display_rev ?? 0;
      return c.mobile_rev ?? 0;
    };
    const _gMCTV = (c) => {
      if (CURRENT_PLATFORM === 'CTV' || CURRENT_PLATFORM === 'Mobile') return 0;
      const _f = CURRENT_FORMAT, _a = CURRENT_ADTYPE;
      if (_f !== 'all') { const fk = formatFieldKey(_f); const base = fk ? fk.replace('_rev','') : null; return base ? (c[`mctv_${base}_rev`] ?? 0) : 0; }
      if (_a === 'Video') return c.mobilectv_video_rev ?? 0;
      if (_a === 'Display') return c.mobilectv_display_rev ?? 0;
      return c.mobilectv_rev ?? 0;
    };
    const _kpiAgScale  = (c) => { if (CURRENT_AGENCY   === 'all') return 1; if (c.agency_rev_map   && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY]     || 0) / c.del_rev; return c.agency    === CURRENT_AGENCY   ? 1 : 0; };
    const _kpiCatScale = (c) => { if (CURRENT_CATEGORY === 'all') return 1; if (c.category_rev_map && c.del_rev > 0) return (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev; return c.category === CURRENT_CATEGORY ? 1 : 0; };
    const pureCTV    = r2(filteredClients.reduce((t,c) => t + _gCTV(c)  * _kpiAgScale(c) * _kpiCatScale(c), 0));
    const pureMobile = r2(filteredClients.reduce((t,c) => t + _gMob(c)  * _kpiAgScale(c) * _kpiCatScale(c), 0));
    const mobCTV     = r2(filteredClients.reduce((t,c) => t + _gMCTV(c) * _kpiAgScale(c) * _kpiCatScale(c), 0));
    const pureTotal  = pureCTV + pureMobile;
    const stPureCTV  = md.platform['CTV']    ? md.platform['CTV'].del_rev    : 0;
    const stPureMob  = md.platform['Mobile'] ? md.platform['Mobile'].del_rev : 0;
    const stTotal    = stPureCTV + stPureMob;
    const ctvRatio   = pureTotal > 0 ? pureCTV / pureTotal : (stTotal > 0 ? stPureCTV / stTotal : 0.5);
    const mobRatio   = pureTotal > 0 ? pureMobile / pureTotal : (stTotal > 0 ? stPureMob / stTotal : 0.5);
    adjCTV    = r2(pureCTV    + mobCTV * ctvRatio);
    adjMobile = r2(pureMobile + mobCTV * mobRatio);
  }

  // ── Video / Display ────────────────────────────────────────
  let videoRev, displayRev;
  // When adtype filter is set to one type, the other must be 0
  const _adTypeIsVideo   = CURRENT_ADTYPE === 'Video';
  const _adTypeIsDisplay = CURRENT_ADTYPE === 'Display';
  if (!anyFilterActive) {
    videoRev   = _adTypeIsDisplay ? 0 : (md.ad_type && md.ad_type.Video   ? md.ad_type.Video.del_rev   : 0);
    displayRev = _adTypeIsVideo   ? 0 : (md.ad_type && md.ad_type.Display ? md.ad_type.Display.del_rev : 0);
  } else {
    const _vBases = ['preroll','midroll','integ','spots'];
    const _dBases = ['billboard','breakout','pause','frames','fence','untagged'];
    const _getVid = (c) => {
      const _f = CURRENT_FORMAT, _p = CURRENT_PLATFORM;
      if (_f !== 'all') {
        const fk = formatFieldKey(_f); const base = fk ? fk.replace('_rev','') : null;
        if (!base || !_vBases.includes(base)) return 0;
        if (_p === 'CTV')        return c[`ctv_${base}_rev`]  ?? 0;
        if (_p === 'Mobile')     return c[`mob_${base}_rev`]  ?? 0;
        if (_p === 'Mobile+CTV') return c[`mctv_${base}_rev`] ?? 0;
        return c[fk] ?? 0;
      }
      if (_p === 'CTV')        return c.ctv_video_rev        ?? 0;
      if (_p === 'Mobile')     return c.mob_video_rev        ?? 0;
      if (_p === 'Mobile+CTV') return c.mobilectv_video_rev  ?? 0;
      return c.video_rev ?? 0;
    };
    const _getDisp = (c) => {
      const _f = CURRENT_FORMAT, _p = CURRENT_PLATFORM;
      if (_f !== 'all') {
        const fk = formatFieldKey(_f); const base = fk ? fk.replace('_rev','') : null;
        if (!base || !_dBases.includes(base)) return 0;
        if (_p === 'CTV')        return c[`ctv_${base}_rev`]  ?? 0;
        if (_p === 'Mobile')     return c[`mob_${base}_rev`]  ?? 0;
        if (_p === 'Mobile+CTV') return c[`mctv_${base}_rev`] ?? 0;
        return c[fk] ?? 0;
      }
      if (_p === 'CTV')        return c.ctv_display_rev        ?? 0;
      if (_p === 'Mobile')     return c.mob_display_rev        ?? 0;
      if (_p === 'Mobile+CTV') return c.mobilectv_display_rev  ?? 0;
      return c.display_rev ?? 0;
    };
    const _kpiAgScale2  = (c) => { if (CURRENT_AGENCY   === 'all') return 1; if (c.agency_rev_map   && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY]     || 0) / c.del_rev; return c.agency    === CURRENT_AGENCY   ? 1 : 0; };
    const _kpiCatScale2 = (c) => { if (CURRENT_CATEGORY === 'all') return 1; if (c.category_rev_map && c.del_rev > 0) return (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev; return c.category === CURRENT_CATEGORY ? 1 : 0; };
    videoRev   = _adTypeIsDisplay ? 0 : r2(filteredClients.reduce((t,c) => t + _getVid(c)  * _kpiAgScale2(c) * _kpiCatScale2(c), 0));
    displayRev = _adTypeIsVideo   ? 0 : r2(filteredClients.reduce((t,c) => t + _getDisp(c) * _kpiAgScale2(c) * _kpiCatScale2(c), 0));
  }

  // ── Biggest Mover — fully filter-aware ────────────────────────
  const MAIN_BUS_M = new Set(['LCS1','LCS2','MM1','MM2']);

  // Step 1: Build filtered client pool for any month
  // Applies BU + Category + Agency filters (Platform/AdType/Format handled by getMoverRev)
  const buildMoverPool = (monthData) => {
    if (!monthData) return [];
    let cs = (monthData.top_clients || []).slice();
    cs = filterClientsByBU(cs, CURRENT_BU);
    if (CURRENT_CATEGORY !== 'all') cs = cs.filter(c => c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
    if (CURRENT_AGENCY   !== 'all') cs = cs.filter(c => c.agency   === CURRENT_AGENCY   || (c.agency_rev_map   && c.agency_rev_map[CURRENT_AGENCY]   > 0));
    if (CURRENT_CLIENT   !== 'all') cs = cs.filter(c => c.name === CURRENT_CLIENT);
    return cs;
  };

  // Step 2: Revenue for a client under current Platform/AdType/Format filters
  // clientRevForFilters is already defined above — reuse it directly
  const getMoverRev = clientRevForFilters;

  const moverCurr  = buildMoverPool(md);
  const moverPrior = buildMoverPool(priorMd);
  const priorRevMap = Object.fromEntries(moverPrior.map(c => [c.name, getMoverRev(c)]));
  const pickTop = arr => arr.filter(m => m.delta !== 0).sort((a,b) => Math.abs(b.delta)-Math.abs(a.delta))[0] || null;

  // BU: show "—" when a specific BU filter is active (no cross-BU comparison possible)
  // Otherwise: group filtered pool by BU, compare delta
  const topBUMover = CURRENT_BU !== 'all' ? null : (() => {
    const buRev = (pool, buName) => r2(
      (buName === 'Others'
        ? pool.filter(c => !MAIN_BUS_M.has(c.bu))
        : pool.filter(c => c.bu === buName)
      ).reduce((t, c) => t + getMoverRev(c), 0)
    );
    return pickTop(['LCS1','LCS2','MM1','MM2','Others'].map(bu => {
      const cR = buRev(moverCurr, bu), pR = buRev(moverPrior, bu);
      return { name: bu, delta: r2(cR - pR), pct: pR > 0 ? r2(((cR-pR)/pR)*100) : null };
    }));
  })();

  // Client: always shown — respects every active filter simultaneously
  const topClientMover = pickTop(moverCurr.map(c => {
    const cR = getMoverRev(c), pR = priorRevMap[c.name] ?? 0;
    return { name: c.name, delta: r2(cR - pR), pct: pR > 0 ? r2(((cR-pR)/pR)*100) : null };
  }));

  // Category: show "—" when category filter is active
  // Otherwise: group filtered pool by category, compare delta
  const topCatMover = CURRENT_CATEGORY !== 'all' ? null : (() => {
    const cCat = {}, pCat = {};
    moverCurr.forEach(c  => { if (c.category) cCat[c.category] = (cCat[c.category]||0) + getMoverRev(c); });
    moverPrior.forEach(c => { if (c.category) pCat[c.category] = (pCat[c.category]||0) + getMoverRev(c); });
    return pickTop(Object.keys(cCat).map(cat => {
      const cR = cCat[cat], pR = pCat[cat] ?? 0;
      return { name: cat, delta: r2(cR - pR), pct: pR > 0 ? r2(((cR-pR)/pR)*100) : null };
    }));
  })();

  // ── eCPM Card ──────────────────────────────────────────────
  const ecpmVal   = computeEcpm(md);
  const priorEcpm = computeEcpm(DATA.months[AGG_PRIOR_KEY || priorMonthKey(CURRENT_MONTH)] || null);
  const lyEcpm    = computeEcpm(DATA.months[AGG_LY_KEY    || lyMonthKey(CURRENT_MONTH)]    || null);
 
  const ecpmMomPct = (ecpmVal !== null && priorEcpm !== null && priorEcpm > 0)
    ? r2(((ecpmVal - priorEcpm) / priorEcpm) * 100) : null;
  const ecpmLyPct  = (ecpmVal !== null && lyEcpm    !== null && lyEcpm    > 0)
    ? r2(((ecpmVal - lyEcpm)    / lyEcpm)    * 100) : null;

  // ── Filter-aware comparison helpers ─────────────────────────────────────────
  const lyMd  = DATA.months[AGG_LY_KEY || lyMonthKey(CURRENT_MONTH)] || null;
  const lmLbl = priorMd?.label || 'LM';
  const lyLbl = lyMd?.label    || 'LY';

  // Apply BU + Category + Agency filters to any month's client pool
  // Platform/AdType/Format are applied via clientRevForFilters when summing revenue
  const getFilteredPool = (monthData) => {
    if (!monthData) return [];
    let cs = (monthData.top_clients || []).slice();
    cs = filterClientsByBU(cs, CURRENT_BU);
    if (CURRENT_CATEGORY !== 'all') cs = cs.filter(c =>
      c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
    if (CURRENT_AGENCY !== 'all') cs = cs.filter(c =>
      c.agency === CURRENT_AGENCY || (c.agency_rev_map && c.agency_rev_map[CURRENT_AGENCY] > 0));
    if (CURRENT_CLIENT !== 'all') cs = cs.filter(c => c.name === CURRENT_CLIENT);
    return cs;
  };
  const priorPool = getFilteredPool(priorMd);
  const lyPool    = getFilteredPool(lyMd);

  // ── Issue 2: Total Del Rev — filter-aware LM + LY comparisons ────────────────
  const kpiAgScale = (c) => {
    if (CURRENT_AGENCY === 'all') return 1;
    if (c.agency_rev_map && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
    return c.agency === CURRENT_AGENCY ? 1 : 0;
  };
  const priorRevF = priorMd
    ? (!anyFilterActive ? priorMd.total_del_rev : r2(priorPool.reduce((t,c) => t + clientRevForFilters(c) * kpiAgScale(c), 0)))
    : null;
  const lyRevF = lyMd
    ? (!anyFilterActive ? lyMd.total_del_rev    : r2(lyPool.reduce((t,c)    => t + clientRevForFilters(c) * kpiAgScale(c), 0)))
    : null;
  const revMomPct = priorRevF !== null && priorRevF > 0 ? r2(((totalRev - priorRevF) / priorRevF) * 100) : null;
  const revLyPct  = lyRevF    !== null && lyRevF    > 0 ? r2(((totalRev - lyRevF)    / lyRevF)    * 100) : null;
  const revMomC   = revMomPct !== null ? { pct: revMomPct, label: 'vs ' + lmLbl } : null;
  const revLyC    = revLyPct  !== null ? { pct: revLyPct,  label: 'vs ' + lyLbl  } : null;

  // ── Issue 1: Active Clients — filter-aware CLIENT COUNT comparisons ─────────
  const priorClientCount = priorMd
    ? (!anyFilterActive ? priorMd.total_clients : priorPool.filter(c => clientRevForFilters(c) * kpiAgScale(c) > 0).length)
    : null;
  const lyClientCount = lyMd
    ? (!anyFilterActive ? lyMd.total_clients    : lyPool.filter(c    => clientRevForFilters(c) * kpiAgScale(c) > 0).length)
    : null;
  const clientMomPct = priorClientCount !== null && priorClientCount > 0 ? r2(((totalClients - priorClientCount) / priorClientCount) * 100) : null;
  const clientLyPct  = lyClientCount    !== null && lyClientCount    > 0 ? r2(((totalClients - lyClientCount)    / lyClientCount)    * 100) : null;
  const clientMomC   = clientMomPct !== null ? { pct: clientMomPct, label: 'vs ' + lmLbl } : null;
  const clientLyC    = clientLyPct  !== null ? { pct: clientLyPct,  label: 'vs ' + lyLbl  } : null;

  // ── Issue 3: CTV / Mobile — filter-aware, both LM and LY ────────────────────
  const getPlatRev = (pool, monthData) => {
    if (!monthData) return { ctv: null, mobile: null };
    if (!anyFilterActive) {
      const pC  = monthData.platform['CTV']        ? monthData.platform['CTV'].del_rev        : 0;
      const pM  = monthData.platform['Mobile']     ? monthData.platform['Mobile'].del_rev     : 0;
      const pMC = monthData.platform['Mobile+CTV'] ? monthData.platform['Mobile+CTV'].del_rev : 0;
      const tot = pC + pM; const cR = tot > 0 ? pC/tot : 0.5; const mR = tot > 0 ? pM/tot : 0.5;
      return { ctv: r2(pC + pMC*cR), mobile: r2(pM + pMC*mR) };
    }
    const _pCTV  = (c) => { if (CURRENT_PLATFORM === 'Mobile' || CURRENT_PLATFORM === 'Mobile+CTV') return 0; const _f=CURRENT_FORMAT,_a=CURRENT_ADTYPE; if(_f!=='all'){const fk=formatFieldKey(_f);const base=fk?fk.replace('_rev',''):null;return base?(c[`ctv_${base}_rev`]??0):0;} if(_a==='Video')return c.ctv_video_rev??0;if(_a==='Display')return c.ctv_display_rev??0;return c.ctv_rev??0; };
    const _pMob  = (c) => { if (CURRENT_PLATFORM === 'CTV' || CURRENT_PLATFORM === 'Mobile+CTV') return 0; const _f=CURRENT_FORMAT,_a=CURRENT_ADTYPE; if(_f!=='all'){const fk=formatFieldKey(_f);const base=fk?fk.replace('_rev',''):null;return base?(c[`mob_${base}_rev`]??0):0;} if(_a==='Video')return c.mob_video_rev??0;if(_a==='Display')return c.mob_display_rev??0;return c.mobile_rev??0; };
    const _pMCTV = (c) => { if (CURRENT_PLATFORM === 'CTV' || CURRENT_PLATFORM === 'Mobile') return 0; const _f=CURRENT_FORMAT,_a=CURRENT_ADTYPE; if(_f!=='all'){const fk=formatFieldKey(_f);const base=fk?fk.replace('_rev',''):null;return base?(c[`mctv_${base}_rev`]??0):0;} if(_a==='Video')return c.mobilectv_video_rev??0;if(_a==='Display')return c.mobilectv_display_rev??0;return c.mobilectv_rev??0; };
    const pC  = r2(pool.reduce((t,c) => t + _pCTV(c)  * kpiAgScale(c), 0));
    const pM  = r2(pool.reduce((t,c) => t + _pMob(c)  * kpiAgScale(c), 0));
    const pMC = r2(pool.reduce((t,c) => t + _pMCTV(c) * kpiAgScale(c), 0));
    const tot = pC + pM;
    const stC = monthData.platform['CTV']    ? monthData.platform['CTV'].del_rev    : 0;
    const stM = monthData.platform['Mobile'] ? monthData.platform['Mobile'].del_rev : 0;
    const stT = stC + stM;
    const cR = tot > 0 ? pC/tot : (stT > 0 ? stC/stT : 0.5);
    const mR = tot > 0 ? pM/tot : (stT > 0 ? stM/stT : 0.5);
    return { ctv: r2(pC + pMC*cR), mobile: r2(pM + pMC*mR) };
  };
  const priorPlat = getPlatRev(priorPool, priorMd);
  const lyPlat    = getPlatRev(lyPool,    lyMd);
  const ctvMomPct  = priorPlat.ctv    !== null && priorPlat.ctv    > 0 ? r2(((adjCTV    - priorPlat.ctv)    / priorPlat.ctv)    * 100) : null;
  const mobMomPct  = priorPlat.mobile !== null && priorPlat.mobile > 0 ? r2(((adjMobile - priorPlat.mobile) / priorPlat.mobile) * 100) : null;
  const ctvLyPct   = lyPlat.ctv       !== null && lyPlat.ctv       > 0 ? r2(((adjCTV    - lyPlat.ctv)       / lyPlat.ctv)       * 100) : null;
  const mobLyPct   = lyPlat.mobile    !== null && lyPlat.mobile    > 0 ? r2(((adjMobile - lyPlat.mobile)    / lyPlat.mobile)    * 100) : null;
  const ctvMomC    = ctvMomPct !== null ? { pct: ctvMomPct, label: 'vs ' + lmLbl } : null;
  const mobMomC    = mobMomPct !== null ? { pct: mobMomPct, label: 'vs ' + lmLbl } : null;
  const ctvLyC     = ctvLyPct  !== null ? { pct: ctvLyPct,  label: 'vs ' + lyLbl  } : null;
  const mobLyC     = mobLyPct  !== null ? { pct: mobLyPct,  label: 'vs ' + lyLbl  } : null;

  // ── Issue 4: Video / Display — filter-aware, both LM and LY ─────────────────
  const getAdTypeRev = (pool, monthData) => {
    if (!monthData) return { video: null, display: null };
    if (!anyFilterActive) return {
      video:   monthData.ad_type?.Video?.del_rev   ?? null,
      display: monthData.ad_type?.Display?.del_rev ?? null
    };
    const _vBs = ['preroll','midroll','integ','spots'];
    const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
    const _atVid  = (c) => { const _f=CURRENT_FORMAT,_p=CURRENT_PLATFORM; if(_f!=='all'){const fk=formatFieldKey(_f);const base=fk?fk.replace('_rev',''):null;if(!base||!_vBs.includes(base))return 0;if(_p==='CTV')return c[`ctv_${base}_rev`]??0;if(_p==='Mobile')return c[`mob_${base}_rev`]??0;if(_p==='Mobile+CTV')return c[`mctv_${base}_rev`]??0;return c[fk]??0;} if(_p==='CTV')return c.ctv_video_rev??0;if(_p==='Mobile')return c.mob_video_rev??0;if(_p==='Mobile+CTV')return c.mobilectv_video_rev??0;return c.video_rev??0; };
    const _atDisp = (c) => { const _f=CURRENT_FORMAT,_p=CURRENT_PLATFORM; if(_f!=='all'){const fk=formatFieldKey(_f);const base=fk?fk.replace('_rev',''):null;if(!base||!_dBs.includes(base))return 0;if(_p==='CTV')return c[`ctv_${base}_rev`]??0;if(_p==='Mobile')return c[`mob_${base}_rev`]??0;if(_p==='Mobile+CTV')return c[`mctv_${base}_rev`]??0;return c[fk]??0;} if(_p==='CTV')return c.ctv_display_rev??0;if(_p==='Mobile')return c.mob_display_rev??0;if(_p==='Mobile+CTV')return c.mobilectv_display_rev??0;return c.display_rev??0; };
    return {
      video:   r2(pool.reduce((t,c) => t + _atVid(c)  * kpiAgScale(c), 0)),
      display: r2(pool.reduce((t,c) => t + _atDisp(c) * kpiAgScale(c), 0))
    };
  };
  const priorAT = getAdTypeRev(priorPool, priorMd);
  const lyAT    = getAdTypeRev(lyPool,    lyMd);
  const vidMomPct  = priorAT.video   !== null && priorAT.video   > 0 ? r2(((videoRev   - priorAT.video)   / priorAT.video)   * 100) : null;
  const dispMomPct = priorAT.display !== null && priorAT.display > 0 ? r2(((displayRev - priorAT.display) / priorAT.display) * 100) : null;
  const vidLyPct   = lyAT.video      !== null && lyAT.video      > 0 ? r2(((videoRev   - lyAT.video)      / lyAT.video)      * 100) : null;
  const dispLyPct  = lyAT.display    !== null && lyAT.display    > 0 ? r2(((displayRev - lyAT.display)    / lyAT.display)    * 100) : null;
  const vidMomC    = vidMomPct  !== null ? { pct: vidMomPct,  label: 'vs ' + lmLbl } : null;
  const dispMomC   = dispMomPct !== null ? { pct: dispMomPct, label: 'vs ' + lmLbl } : null;
  const vidLyC     = vidLyPct   !== null ? { pct: vidLyPct,   label: 'vs ' + lyLbl  } : null;
  const dispLyC    = dispLyPct  !== null ? { pct: dispLyPct,  label: 'vs ' + lyLbl  } : null;

  // Video/Display share (unchanged)
  const totalRevForShare = videoRev + displayRev || 1;
  const videoPct   = Math.round((videoRev   / totalRevForShare) * 100);
  const displayPct = Math.round((displayRev / totalRevForShare) * 100);

  

  document.getElementById('kpi-row').innerHTML = [
    `<div class="kpi-card">
      <div class="kpi-label">Total Del Rev</div>
      <div class="kpi-value">${fmtNum(totalRev)}<span class="kpi-unit"> Cr</span></div>
      ${revMomC ? `<div class="kpi-change ${revMomC.pct>0?'up':revMomC.pct<0?'down':'flat'}">${revMomC.pct>0?'↑':revMomC.pct<0?'↓':'→'} ${revMomC.pct>0?'+':''}${Math.abs(revMomC.pct)}% <span style="color:var(--ink-soft);font-size:11px">${revMomC.label}</span></div>` : ''}
      ${revLyC  ? `<div class="kpi-change ${revLyC.pct>0?'up':revLyC.pct<0?'down':'flat'}">${revLyC.pct>0?'↑':revLyC.pct<0?'↓':'→'} ${revLyC.pct>0?'+':''}${Math.abs(revLyC.pct)}% <span style="color:var(--ink-soft);font-size:11px">${revLyC.label}</span></div>` : ''}
    </div>`,
    `<div class="kpi-card">
      <div class="kpi-label">Active Clients</div>
      <div class="kpi-value">${fmtInt(totalClients)}<span class="kpi-unit"> </span></div>
      ${clientMomC ? `<div class="kpi-change ${clientMomC.pct>0?'up':clientMomC.pct<0?'down':'flat'}">${clientMomC.pct>0?'↑':clientMomC.pct<0?'↓':'→'} ${clientMomC.pct>0?'+':''}${Math.abs(clientMomC.pct)}% <span style="color:var(--ink-soft);font-size:11px">${clientMomC.label}</span></div>` : ''}
      ${clientLyC  ? `<div class="kpi-change ${clientLyC.pct>0?'up':clientLyC.pct<0?'down':'flat'}">${clientLyC.pct>0?'↑':clientLyC.pct<0?'↓':'→'} ${clientLyC.pct>0?'+':''}${Math.abs(clientLyC.pct)}% <span style="color:var(--ink-soft);font-size:11px">${clientLyC.label}</span></div>` : ''}
    </div>`,
    kpiCard('CTV Rev',        adjCTV,        'Cr', ctvMomC,  ctvMomC  ? null : 'incl. Mob+CTV split', ctvLyC),
    kpiCard('Mobile Rev',     adjMobile,     'Cr', mobMomC,  mobMomC  ? null : 'incl. Mob+CTV split', mobLyC),
    kpiCard('Video Rev',      videoRev,      'Cr', vidMomC,  vidMomC  ? null : videoPct  + '% of total ad rev', vidLyC),
    kpiCard('Display Rev',    displayRev,    'Cr', dispMomC, dispMomC ? null : displayPct + '% of total ad rev', dispLyC),
    `<div class="kpi-card">
      <div class="kpi-label">Biggest Mover vs Last Month</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
        ${[
          {label:'BU',       mover: topBUMover},
          {label:'Client',   mover: topClientMover},
          {label:'Category', mover: topCatMover},
        ].map(({label, mover}) => mover
          ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--surface);border-radius:7px;gap:6px">
               <div style="display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden">
                 <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-soft);flex-shrink:0">${label}</span>
                 <span style="font-size:12px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${mover.name}">${mover.name}</span>
               </div>
               <span style="font-family:var(--mono);font-size:11px;font-weight:600;flex-shrink:0;color:${mover.delta>=0?'var(--green)':'var(--red)'}">${mover.delta>=0?'+':''}${fmtNum(mover.delta)} Cr</span>
             </div>`
          : `<div style="padding:5px 8px;background:var(--surface);border-radius:7px">
               <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-soft);margin-right:6px">${label}</span>
               <span style="font-size:11px;color:var(--ink-soft)">No prior data</span>
             </div>`
        ).join('')}
      </div>
    </div>`,
    ecpmVal !== null
      ? `<div class="kpi-card">
          <div class="kpi-label">eCPM</div>
          <div class="kpi-value">₹${fmtNum(ecpmVal)}<span class="kpi-unit"> </span></div>
          <div style="font-size:11px;color:var(--ink-soft);margin-bottom:4px">${CURRENT_FORMAT === 'Preroll' ? 'Preroll only' : CURRENT_FORMAT === 'Midroll' ? 'Midroll only' : 'Preroll + Midroll'} · excl. Mediation</div>
          ${ecpmMomPct !== null ? `<div class="kpi-change ${ecpmMomPct>=0?'up':'down'}">${ecpmMomPct>=0?'↑':'↓'} ${Math.abs(ecpmMomPct)}% <span style="color:var(--ink-soft);font-size:11px">vs ${DATA.months[priorMonthKey(CURRENT_MONTH)]?.label||'LM'}</span></div>` : ''}
          ${ecpmLyPct  !== null ? `<div class="kpi-change ${ecpmLyPct>=0?'up':'down'}">${ecpmLyPct>=0?'↑':'↓'} ${Math.abs(ecpmLyPct)}% <span style="color:var(--ink-soft);font-size:11px">vs ${DATA.months[lyMonthKey(CURRENT_MONTH)]?.label||'LY'}</span></div>` : ''}
        </div>`
      : kpiCard('eCPM', 0, '', null, 'No Preroll/Midroll data for this filter'),
  ].join('');
}
function kpiCard(label,val,unit,ch,note,ch2) {
  let c='';
  if(ch){const cls=ch.pct>0?'up':ch.pct<0?'down':'flat';const arr=ch.pct>0?'↑':ch.pct<0?'↓':'→';c=`<div class="kpi-change ${cls}">${arr} ${ch.pct>0?'+':''}${Math.abs(ch.pct)}% <span style="color:var(--ink-soft);font-size:11px">${ch.label}</span></div>`;}
  else if(note){c=`<div class="kpi-change flat">${note}</div>`;}
  if(ch2){const cls2=ch2.pct>0?'up':ch2.pct<0?'down':'flat';const arr2=ch2.pct>0?'↑':ch2.pct<0?'↓':'→';c+=`<div class="kpi-change ${cls2}">${arr2} ${ch2.pct>0?'+':''}${Math.abs(ch2.pct)}% <span style="color:var(--ink-soft);font-size:11px">${ch2.label}</span></div>`;}
  return `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value">${unit===''?fmtInt(val):fmtNum(val)}<span class="kpi-unit"> ${unit}</span></div>${c}</div>`;
}
function computeEcpm(md) {
  if (!md || !md.ecpm_data || !md.ecpm_data.rows) return null;
  if (CURRENT_ADTYPE === 'Display') return null;
  if (CURRENT_FORMAT !== 'all' && !['Preroll','Midroll'].includes(CURRENT_FORMAT)) return null;

  const needsClientPool = CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all' || CURRENT_CLIENT !== 'all';

  if (!needsClientPool) {
    // Fast path — use pre-aggregated ecpm_data rows
    let rows = md.ecpm_data.rows;
    if (CURRENT_BU !== 'all') {
      if (CURRENT_BU === 'Others') {
        const MAIN = new Set(['LCS1','LCS2','MM1','MM2']);
        rows = rows.filter(r => !MAIN.has(r.bu));
      } else {
        rows = rows.filter(r => r.bu === CURRENT_BU);
      }
    }
    if (CURRENT_PLATFORM !== 'all') rows = rows.filter(r => r.platform === CURRENT_PLATFORM);
    if (CURRENT_FORMAT   !== 'all') rows = rows.filter(r => r.format   === CURRENT_FORMAT);
    if (!rows.length) return null;
    const totalRevCr = rows.reduce((t, r) => t + r.rev_cr, 0);
    const totalImp   = rows.reduce((t, r) => t + r.imp,    0);
    return totalImp > 0 ? r2((totalRevCr * 10000000 / totalImp) * 1000) : null;
  }

  // Category/Agency/Client filter active — aggregate from top_clients
  let clients = (md.top_clients || []).slice();
  clients = filterClientsByBU(clients, CURRENT_BU);
  if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c => c.category === CURRENT_CATEGORY);
  if (CURRENT_AGENCY   !== 'all') clients = clients.filter(c => c.agency   === CURRENT_AGENCY);
  if (CURRENT_CLIENT   !== 'all') clients = clients.filter(c => c.name     === CURRENT_CLIENT);
  if (CURRENT_CLIENT   !== 'all') clients = clients.filter(c => c.name     === CURRENT_CLIENT);
  clients = clients.filter(c => c.bu !== 'Mediation');

  const getImpAndRev = (c) => {
    const p = CURRENT_PLATFORM, f = CURRENT_FORMAT;
    if (f === 'Preroll') {
      if (p === 'CTV')        return { imp: c.ctv_preroll_imp  || 0, rev: c.ctv_preroll_rev  || 0 };
      if (p === 'Mobile')     return { imp: c.mob_preroll_imp  || 0, rev: c.mob_preroll_rev  || 0 };
      if (p === 'Mobile+CTV') return { imp: c.mctv_preroll_imp || 0, rev: c.mctv_preroll_rev || 0 };
      return { imp: c.preroll_imp || 0, rev: c.preroll_rev || 0 };
    }
    if (f === 'Midroll') {
      if (p === 'CTV')        return { imp: c.ctv_midroll_imp  || 0, rev: c.ctv_midroll_rev  || 0 };
      if (p === 'Mobile')     return { imp: c.mob_midroll_imp  || 0, rev: c.mob_midroll_rev  || 0 };
      if (p === 'Mobile+CTV') return { imp: c.mctv_midroll_imp || 0, rev: c.mctv_midroll_rev || 0 };
      return { imp: c.midroll_imp || 0, rev: c.midroll_rev || 0 };
    }
    // Preroll + Midroll combined
    if (p === 'CTV')        return { imp: (c.ctv_preroll_imp  || 0) + (c.ctv_midroll_imp  || 0), rev: (c.ctv_preroll_rev  || 0) + (c.ctv_midroll_rev  || 0) };
    if (p === 'Mobile')     return { imp: (c.mob_preroll_imp  || 0) + (c.mob_midroll_imp  || 0), rev: (c.mob_preroll_rev  || 0) + (c.mob_midroll_rev  || 0) };
    if (p === 'Mobile+CTV') return { imp: (c.mctv_preroll_imp || 0) + (c.mctv_midroll_imp || 0), rev: (c.mctv_preroll_rev || 0) + (c.mctv_midroll_rev || 0) };
    return { imp: (c.preroll_imp || 0) + (c.midroll_imp || 0), rev: (c.preroll_rev || 0) + (c.midroll_rev || 0) };
  };

  let totalRevCr = 0, totalImp = 0;
  clients.forEach(c => {
    const { imp, rev } = getImpAndRev(c);
    totalRevCr += rev;
    totalImp   += imp;
  });
  return totalImp > 0 ? r2((totalRevCr * 10000000 / totalImp) * 1000) : null;
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
      const _vBs = ['preroll','midroll','integ','spots'];
      const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
      if (a === 'Video'   && _dBs.includes(base)) return 0;
      if (a === 'Display' && _vBs.includes(base)) return 0;
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
      const _vBs = ['preroll','midroll','integ','spots'];
      const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
      if (a === 'Video'   && _dBs.includes(base)) return 0;
      if (a === 'Display' && _vBs.includes(base)) return 0;
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

  const needsClientFilter = CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all' || CURRENT_CLIENT !== 'all';

  const getFilteredData = (buName, monthData) => {
    if (!monthData) return { rev: 0, booked: 0, clients: 0 };
    const b = monthData.bu[buName] || {};

    if (!needsClientFilter) {
      const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
      let booked, clientCount;
      const _vBs = ['preroll','midroll','integ','spots'];
      const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];

      // Booked cross-cuts (stored in Cr already from JSONExporter sumWhere on BOOKED_REV, still raw INR → divide)
      if (f !== 'all') {
        // Format active — platform-aware exact fields
        const fk   = formatFieldKey(f);
        const base = fk ? fk.replace('_rev','') : null;
        // Cross-type mismatch: adtype=Display + video format (or vice versa) → booked = 0
        if ((a === 'Display' && _vBs.includes(base)) || (a === 'Video' && _dBs.includes(base))) {
          booked      = 0;
          clientCount = 0;
        } else if (p === 'CTV') {
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

      const _buClients = (monthData.top_clients || []).filter(c =>
        buName === 'Others'
          ? !MAIN_BUS.includes(c.bu) && clientRev(c) > 0
          : c.bu === buName && clientRev(c) > 0
      );
      return {
rev:     r2(buRevFromStored(b)),
booked:  booked != null ? r2(booked) : null,
clients: _buClients.length,
};
    }

    // Category/Agency/Client filter active — aggregate from top_clients
    let clients = (monthData.top_clients || []).slice();
    clients = filterClientsByBU(clients, buName);
    if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c => c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
    if (CURRENT_AGENCY   !== 'all') clients = clients.filter(c => c.agency   === CURRENT_AGENCY   || (c.agency_rev_map   && c.agency_rev_map[CURRENT_AGENCY]   > 0));
    if (CURRENT_CLIENT   !== 'all') clients = clients.filter(c => c.name === CURRENT_CLIENT);
    const hasBooked = clients.some(c => c.booked_rev != null);
    const buAgScale = (c) => {
      if (CURRENT_AGENCY === 'all') return 1;
      if (c.agency_rev_map && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
      return c.agency === CURRENT_AGENCY ? 1 : 0;
    };
const buCatScale = (c) => {
  if (CURRENT_CATEGORY === 'all') return 1;
  if (c.category_rev_map && c.del_rev > 0) return (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev;
  return c.category === CURRENT_CATEGORY ? 1 : 0;
};
return {
  rev:     r2(clients.reduce((t, c) => t + clientRev(c) * buAgScale(c) * buCatScale(c), 0)),
  booked:  hasBooked ? r2(clients.reduce((t, c) => { const cr = clientRev(c) * buAgScale(c) * buCatScale(c); return t + (c.del_rev > 0 ? (c.booked_rev || 0) * (cr / c.del_rev) : 0); }, 0)) : null,
  clients: clients.filter(c => clientRev(c) * buAgScale(c) * buCatScale(c) > 0).length,
};
  };

  const anyFilterActive = CURRENT_PLATFORM !== 'all' || CURRENT_ADTYPE !== 'all'
    || CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all' || CURRENT_FORMAT !== 'all' || CURRENT_CLIENT !== 'all';

  const priorMd = DATA.months[AGG_PRIOR_KEY || priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[AGG_LY_KEY    || lyMonthKey(CURRENT_MONTH)]    || null;

  const headers = [
    {label:'BU',      w:'60px'},
    {label:'Del Rev', right:true, w:'76px'},
    {label:'Booked',  right:true, w:'76px'},
    {label:'LM Rev',  right:true, w:'72px'},
    {label:'MoM',     right:true, w:'62px'},
    {label:'LY Rev',  right:true, w:'72px'},
    {label:'YoY',     right:true, w:'62px'},
    {label:'CTV%',    right:true, w:'58px'},
    {label:'Clients', right:true, w:'58px'},
  ];
  // ── CTV% helper — % of currently filtered revenue that came from CTV ──
  const buCtvPct = (bu, monthData) => {
    if (!monthData) return null;
    if (CURRENT_PLATFORM === 'CTV')        return 100;
    if (CURRENT_PLATFORM === 'Mobile')     return 0;
    if (CURRENT_PLATFORM === 'Mobile+CTV') return null;

    const b = monthData.bu[bu] || {};

    // When category/agency/client filter is active, we cannot trust stored b.ctv_rev
    // because it is unfiltered. We must aggregate CTV rev from top_clients
    // using the same filter logic as getFilteredData.
    if (needsClientFilter) {
      let clients = (monthData.top_clients || []).slice();
      clients = filterClientsByBU(clients, bu);
      if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c => c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
      if (CURRENT_AGENCY   !== 'all') clients = clients.filter(c => c.agency   === CURRENT_AGENCY   || (c.agency_rev_map   && c.agency_rev_map[CURRENT_AGENCY]   > 0));
      if (CURRENT_CLIENT   !== 'all') clients = clients.filter(c => c.name === CURRENT_CLIENT);

      let filteredCtvRev = 0, filteredTotalRev = 0;
      clients.forEach(c => {
        const agScale  = (CURRENT_AGENCY === 'all' || !c.agency_rev_map || c.del_rev <= 0) ? 1 : (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
        const catScale = (CURRENT_CATEGORY === 'all' || !c.category_rev_map || c.del_rev <= 0) ? 1 : (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev;
        const scale    = agScale * catScale;
        // Total filtered rev for this client (same as getFilteredData)
        filteredTotalRev += clientRev(c) * scale;
        // CTV rev for this client under active adtype/format, scaled same way
        const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
        let cRev = 0;
        if (f !== 'all') {
          const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
          cRev = base ? (c['ctv_' + base + '_rev'] ?? 0) : 0;
        } else if (a === 'Video')   { cRev = c.ctv_video_rev   ?? 0; }
        else if (a === 'Display')   { cRev = c.ctv_display_rev ?? 0; }
        else                        { cRev = c.ctv_rev         ?? 0; }
        filteredCtvRev += cRev * scale;
      });

      if (filteredTotalRev <= 0) return null;
      return Math.round((filteredCtvRev / filteredTotalRev) * 100);
    }

    // No category/agency/client filter — safe to use stored BU fields directly
    const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    let ctvRev = 0;
    if (f !== 'all') {
      const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
      ctvRev = base ? (b['ctv_' + base + '_rev'] ?? 0) : 0;
    } else if (a === 'Video')   { ctvRev = b.ctv_video_rev   ?? 0; }
    else if (a === 'Display')   { ctvRev = b.ctv_display_rev ?? 0; }
    else                        { ctvRev = b.ctv_rev ?? 0; }

    const totalRevStored = r2(buRevFromStored(b));
    if (!totalRevStored || totalRevStored <= 0) return null;
    return Math.round((ctvRev / totalRevStored) * 100);
  };

  const rows = buList.map(bu => {
    const b       = md.bu[bu] || {};
    const isActive = CURRENT_BU === 'all' || CURRENT_BU === bu;
    const cls      = CURRENT_BU === bu ? 'badge-green' : 'badge-blue';

    let rev, bookedCr, clients, momPct, loyPct, lmRev, lyRev;

    if (anyFilterActive) {
      const curr  = getFilteredData(bu, md);
      const prior = getFilteredData(bu, priorMd);
      const ly    = getFilteredData(bu, lyMd);
      rev      = curr.rev;
      bookedCr = curr.booked;
      clients  = bu === 'Others' ? '—' : curr.clients;
      lmRev    = prior.rev > 0 ? prior.rev : null;
      lyRev    = ly.rev    > 0 ? ly.rev    : null;
      momPct   = lmRev !== null ? r2(((curr.rev - lmRev) / lmRev) * 100) : null;
      loyPct   = lyRev !== null ? r2(((curr.rev - lyRev) / lyRev) * 100) : null;
    } else {
      rev      = activeRevField(b);
      bookedCr = b.booked_rev != null ? r2(b.booked_rev) : null;
      clients  = bu === 'Others' ? '—' : (b.clients || 0);
      momPct   = b.growth_vs_lm ?? null;
      loyPct   = b.growth_vs_ly ?? null;
      const priorB = priorMd ? (priorMd.bu[bu] || {}) : {};
      const lyB    = lyMd    ? (lyMd.bu[bu]    || {}) : {};
      lmRev = r2(activeRevField(priorB) || 0) > 0 ? r2(activeRevField(priorB)) : null;
      lyRev = r2(activeRevField(lyB)    || 0) > 0 ? r2(activeRevField(lyB))    : null;
    }

    const ctvPct = buCtvPct(bu, md);
    const ctvPctDisplay = CURRENT_PLATFORM === 'Mobile' ? '<span style="color:var(--ink-faint)">0%</span>'
      : ctvPct === null ? '—'
      : ctvPct === 100  ? '<span style="color:var(--green);font-weight:600">100%</span>'
      : `<span style="color:var(--accent);font-weight:500">${ctvPct}%</span>`;
    return `<tr style="${!isActive?'opacity:0.3':''}">
      <td><span class="badge ${cls}">${bu}</span></td>
      <td style="text-align:right;font-family:var(--mono);font-weight:500">${fmtNum(rev)} Cr</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${bookedCr != null ? fmtNum(bookedCr) + ' Cr' : '—'}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${lmRev !== null ? fmtNum(lmRev) + ' Cr' : '—'}</td>
      <td style="text-align:right">${growthBadge(momPct)}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${lyRev !== null ? fmtNum(lyRev) + ' Cr' : '—'}</td>
      <td style="text-align:right">${growthBadge(loyPct)}</td>
      <td style="text-align:right">${ctvPctDisplay}</td>
      <td style="text-align:right;color:var(--ink-soft)">${clients}</td>
    </tr>`;
  }).join('');

  // Calculate totals from what's displayed
  let totalRev = 0, totalBooked = 0, totalClients = 0, totalLmRev = 0, totalLyRev = 0;
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
      if (prior.rev > 0) { totalMomNum += curr.rev - prior.rev; totalMomDen += prior.rev; totalLmRev += prior.rev; }
      if (ly.rev    > 0) { totalLyNum  += curr.rev - ly.rev;    totalLyDen  += ly.rev;    totalLyRev += ly.rev;    }
    } else {
      rev      = activeRevField(b);
      bookedCr = b.booked_rev != null ? r2(b.booked_rev) : null;
      clients  = bu === 'Others' ? 0 : (b.clients || 0);
      const priorB = priorMd ? (priorMd.bu[bu] || {}) : {};
      const lyB    = lyMd    ? (lyMd.bu[bu]    || {}) : {};
      const pRev   = r2(activeRevField(priorB) || 0);
      const lRev   = r2(activeRevField(lyB)    || 0);
      if (pRev > 0) { totalMomNum += rev - pRev; totalMomDen += pRev; totalLmRev += pRev; }
      if (lRev > 0) { totalLyNum  += rev - lRev; totalLyDen  += lRev; totalLyRev += lRev; }
    }
    totalRev     += rev;
    if (bookedCr != null) totalBooked  += bookedCr;
    totalClients += clients;
  });

  const totalMomPct = totalMomDen > 0 ? r2((totalMomNum / totalMomDen) * 100) : null;
  const totalLyPct  = totalLyDen  > 0 ? r2((totalLyNum  / totalLyDen)  * 100) : null;

  // CTV% for total row
  const totalCtvPct = (() => {
    if (CURRENT_PLATFORM === 'CTV')        return 100;
    if (CURRENT_PLATFORM === 'Mobile')     return 0;
    if (CURRENT_PLATFORM === 'Mobile+CTV') return null;
    let grandCtvRev = 0;
    buList.forEach(bu => {
      const isActive = CURRENT_BU === 'all' || CURRENT_BU === bu;
      if (!isActive) return;
      if (needsClientFilter) {
        let clients = (md.top_clients || []).slice();
        clients = filterClientsByBU(clients, bu);
        if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c => c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
        if (CURRENT_AGENCY   !== 'all') clients = clients.filter(c => c.agency   === CURRENT_AGENCY   || (c.agency_rev_map   && c.agency_rev_map[CURRENT_AGENCY]   > 0));
        if (CURRENT_CLIENT   !== 'all') clients = clients.filter(c => c.name === CURRENT_CLIENT);
        clients.forEach(c => {
          const agScale  = (CURRENT_AGENCY === 'all' || !c.agency_rev_map || c.del_rev <= 0) ? 1 : (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
          const catScale = (CURRENT_CATEGORY === 'all' || !c.category_rev_map || c.del_rev <= 0) ? 1 : (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev;
          const scale    = agScale * catScale;
          const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
          let cRev = 0;
          if (f !== 'all') {
            const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
            cRev = base ? (c['ctv_' + base + '_rev'] ?? 0) : 0;
          } else if (a === 'Video')   { cRev = c.ctv_video_rev   ?? 0; }
          else if (a === 'Display')   { cRev = c.ctv_display_rev ?? 0; }
          else                        { cRev = c.ctv_rev         ?? 0; }
          grandCtvRev += cRev * scale;
        });
      } else {
        const b = md.bu[bu] || {};
        const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
        if (f !== 'all') {
          const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
          grandCtvRev += base ? (b['ctv_' + base + '_rev'] ?? 0) : 0;
        } else if (a === 'Video')   { grandCtvRev += b.ctv_video_rev   ?? 0; }
        else if (a === 'Display')   { grandCtvRev += b.ctv_display_rev ?? 0; }
        else                        { grandCtvRev += b.ctv_rev ?? 0; }
      }
    });
    return totalRev > 0 ? Math.round((grandCtvRev / totalRev) * 100) : null;
  })();
  const totalCtvDisplay = CURRENT_PLATFORM === 'Mobile' ? '0%'
    : totalCtvPct === null ? '—'
    : totalCtvPct + '%';

  const totalRow = '<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">' +
    '<td><span class="badge badge-gray">Total</span></td>' +
    '<td style="text-align:right;font-family:var(--mono);font-weight:600">' + fmtNum(r2(totalRev)) + ' Cr</td>' +
    '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + (totalBooked > 0 ? fmtNum(r2(totalBooked)) + ' Cr' : '—') + '</td>' +
    '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + (totalLmRev > 0 ? fmtNum(r2(totalLmRev)) + ' Cr' : '—') + '</td>' +
    '<td style="text-align:right">' + growthBadge(totalMomPct) + '</td>' +
    '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + (totalLyRev > 0 ? fmtNum(r2(totalLyRev)) + ' Cr' : '—') + '</td>' +
    '<td style="text-align:right">' + growthBadge(totalLyPct) + '</td>' +
    '<td style="text-align:right;font-weight:600;color:var(--accent)">' + totalCtvDisplay + '</td>' +
    '<td style="text-align:right;color:var(--ink-soft)">' + (() => {
      const allBUClients = new Set();
      (md.top_clients || []).forEach(c => {
        const buFilter = CURRENT_BU === 'all' || c.bu === CURRENT_BU || (CURRENT_BU === 'Others' && !MAIN_BUS.includes(c.bu));
        if (!buFilter) return;
        if (CURRENT_CATEGORY !== 'all' && c.category !== CURRENT_CATEGORY && !(c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0)) return;
        if (CURRENT_AGENCY   !== 'all' && c.agency   !== CURRENT_AGENCY   && !(c.agency_rev_map   && c.agency_rev_map[CURRENT_AGENCY]   > 0)) return;
        if (CURRENT_CLIENT   !== 'all' && c.name     !== CURRENT_CLIENT)   return;
        if (clientRev(c) > 0) allBUClients.add(c.name);
      });
      return fmtInt(allBUClients.size);
    })() + '</td>' +
    '</tr>';

  document.getElementById('bu-panel').innerHTML = ptable(headers, rows + totalRow);
}

// ── Platform Split ────────────────────────────────
function renderPlatform(md) {
  const platforms = ['CTV','Mobile','Mobile+CTV'];
  const clsMap = {CTV:'badge-green',Mobile:'badge-blue','Mobile+CTV':'badge-amber'};

  const platformRevFromStored = (pl) => {
    const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    if (f !== 'all') {
      const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      const _vBs = ['preroll','midroll','integ','spots'];
      const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
      if (a === 'Video'   && _dBs.includes(base)) return 0;
      if (a === 'Display' && _vBs.includes(base)) return 0;
      return pl[fk] ?? 0;
    }
    if (a === 'Video')   return pl.video_rev   ?? 0;
    if (a === 'Display') return pl.display_rev ?? 0;
    return pl.del_rev ?? 0;
  };

  const platformBookedFromStored = (pl) => {
    const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    const _vBs = ['preroll','midroll','integ','spots'];
    const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
    let booked;
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      // Cross-type mismatch → booked = 0
      if (base && a === 'Display' && _vBs.includes(base)) return 0;
      if (base && a === 'Video'   && _dBs.includes(base)) return 0;
      // Platform objects don't store per-format booked — use adtype-level as best available
      if (a === 'Video')   booked = pl.video_booked   ?? pl.booked_rev;
      else if (a === 'Display') booked = pl.display_booked ?? pl.booked_rev;
      else booked = pl.booked_rev;
    } else if (a === 'Video')   booked = pl.video_booked   ?? pl.booked_rev;
    else if (a === 'Display')   booked = pl.display_booked ?? pl.booked_rev;
    else                        booked = pl.booked_rev;
    return booked != null ? r2(booked) : null;
  };

  const platformClientsFromStored = (pl) => {
    const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    const _vBs = ['preroll','midroll','integ','spots'];
    const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (base && a === 'Display' && _vBs.includes(base)) return 0;
      if (base && a === 'Video'   && _dBs.includes(base)) return 0;
      // Platform objects don't store per-format client counts — use adtype-level as best available
      if (a === 'Video')   return pl.video_clients   ?? pl.clients;
      if (a === 'Display') return pl.display_clients ?? pl.clients;
      return pl.clients;
    }
    if (a === 'Video')   return pl.video_clients   ?? pl.clients;
    if (a === 'Display') return pl.display_clients ?? pl.clients;
    return pl.clients;
  };

  const needsClientFilterPlat = CURRENT_BU !== 'all' || CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all' || CURRENT_CLIENT !== 'all';
  const anyPlatFilterActive   = needsClientFilterPlat || CURRENT_ADTYPE !== 'all' || CURRENT_FORMAT !== 'all' || CURRENT_CLIENT !== 'all';

  const priorMd = DATA.months[AGG_PRIOR_KEY || priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[AGG_LY_KEY    || lyMonthKey(CURRENT_MONTH)]    || null;

  const getFilteredDataForPlatform = (platformName, monthData) => {
    if (!monthData) return { rev: 0, booked: 0, clients: 0 };
    const pl = monthData.platform[platformName] || {};

    // When only category/agency/BU/client filters are active (no platform/adtype/format filter),
    // use stored platform rev and compute clients from the filtered client pool
    if (!needsClientFilterPlat) {
      return {
        rev:     r2(platformRevFromStored(pl)),
        booked:  platformBookedFromStored(pl),
        clients: platformClientsFromStored(pl),
      };
    }

    // When category/agency/BU/client filter is active but NO platform/adtype/format filter,
    // use stored rev but count clients from filtered pool
    const p_inner = CURRENT_PLATFORM, a_inner = CURRENT_ADTYPE, f_inner = CURRENT_FORMAT;
    if (p_inner === 'all' && a_inner === 'all' && f_inner === 'all') {
      let filteredForCount = (monthData.top_clients || []).slice();
      filteredForCount = filterClientsByBU(filteredForCount, CURRENT_BU);
      if (CURRENT_CATEGORY !== 'all') filteredForCount = filteredForCount.filter(c => c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
      if (CURRENT_AGENCY   !== 'all') filteredForCount = filteredForCount.filter(c => c.agency   === CURRENT_AGENCY   || (c.agency_rev_map   && c.agency_rev_map[CURRENT_AGENCY]   > 0));
      if (CURRENT_CLIENT   !== 'all') filteredForCount = filteredForCount.filter(c => c.name === CURRENT_CLIENT);
      const platKey_inner = platformName === 'CTV' ? 'ctv_rev' : platformName === 'Mobile' ? 'mobile_rev' : 'mobilectv_rev';
      // Rev: sum filtered clients' platform rev (proportioned by agency scale if needed)
      const agScaleInner = (c) => {
        if (CURRENT_AGENCY === 'all') return 1;
        if (c.agency_rev_map && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
        return c.agency === CURRENT_AGENCY ? 1 : 0;
      };
      const platCatScaleInner = (c) => {
        if (CURRENT_CATEGORY === 'all') return 1;
        if (c.category_rev_map && c.del_rev > 0) return (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev;
        return c.category === CURRENT_CATEGORY ? 1 : 0;
      };
      const rev_inner = r2(filteredForCount.reduce((t, c) => t + (c[platKey_inner] || 0) * agScaleInner(c) * platCatScaleInner(c), 0));
      const platClientCount_inner = filteredForCount.filter(c => (c[platKey_inner] || 0) * platCatScaleInner(c) > 0).length;
      let bookedSum_inner = 0;
      filteredForCount.forEach(c => {
        const pv = (c[platKey_inner] || 0) * agScaleInner(c) * platCatScaleInner(c);
        if (pv > 0) bookedSum_inner += c.del_rev > 0 ? (c.booked_rev || 0) * (pv / c.del_rev) : 0;
      });
      return { rev: rev_inner, booked: bookedSum_inner > 0 ? r2(bookedSum_inner) : null, clients: platClientCount_inner };
    }

    let clients = (monthData.top_clients || []).slice();
    clients = filterClientsByBU(clients, CURRENT_BU);
    if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c => c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
    if (CURRENT_AGENCY   !== 'all') clients = clients.filter(c => c.agency   === CURRENT_AGENCY   || (c.agency_rev_map   && c.agency_rev_map[CURRENT_AGENCY]   > 0));
    if (CURRENT_CLIENT   !== 'all') clients = clients.filter(c => c.name === CURRENT_CLIENT);

    const platAgScale = (c) => {
      if (CURRENT_AGENCY === 'all') return 1;
      if (c.agency_rev_map && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
      return c.agency === CURRENT_AGENCY ? 1 : 0;
    };
    const platKey = platformName === 'CTV' ? 'ctv_rev' : platformName === 'Mobile' ? 'mobile_rev' : 'mobilectv_rev';
    const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    let rev = 0;
    clients.forEach(c => {
      let val = 0;
      if (f !== 'all') {
        const fk   = formatFieldKey(f);
        const base = fk ? fk.replace('_rev', '') : null;
        if (!base || (a==='Video' && ['billboard','breakout','pause','frames','fence','untagged'].includes(base)) || (a==='Display' && ['preroll','midroll','integ','spots'].includes(base))) { val = 0; }
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
      const platCatScale = (() => {
        if (CURRENT_CATEGORY === 'all') return 1;
        if (c.category_rev_map && c.del_rev > 0) return (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev;
        return c.category === CURRENT_CATEGORY ? 1 : 0;
      })();
      rev += val * platAgScale(c) * platCatScale;
    });
    // Approximate platform booked using platform rev ratio, count only platform-active clients
    const _vBsP = ['preroll','midroll','integ','spots'];
    const _dBsP = ['billboard','breakout','pause','frames','fence','untagged'];
    let bookedSum = 0;
    let platClientCount = 0;
    clients.forEach(c => {
      // Use the exact same field that rev uses, so booked/clients match the filter
      let activeVal = 0;
      if (f !== 'all') {
        const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
        // Cross-type mismatch → activeVal stays 0
        if (base && !((a==='Video' && _dBsP.includes(base)) || (a==='Display' && _vBsP.includes(base)))) {
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
        bookedSum += c.del_rev > 0 ? (c.booked_rev || 0) * (activeVal / c.del_rev) : 0;
      }
    });
    // Booked: use stored BU fields scoped to platform — never sum from clients (over-counts)
    let booked;
    const buData = (CURRENT_BU !== 'all' && CURRENT_CATEGORY === 'all' && CURRENT_AGENCY === 'all') ? monthData.bu[CURRENT_BU] || {} : null;
    if (buData) {
      const a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
      if (f !== 'all') {
        const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
        // Cross-type mismatch → booked = 0
        if (base && ((a==='Display' && _vBsP.includes(base)) || (a==='Video' && _dBsP.includes(base)))) {
          booked = 0;
        } else if (platformName==='CTV')         booked = buData['ctv_' +base+'_booked'] ?? buData.ctv_booked    ?? buData.booked_rev;
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
      booked = booked != null ? r2(booked) : null;
    } else {
      booked = bookedSum > 0 ? r2(bookedSum) : null;
    }

    return { rev: r2(rev), booked, clients: platClientCount };
  };

  const headers = [
    {label:'Platform', w:'90px'},
    {label:'Del Rev',  right:true, w:'80px'},
    {label:'Booked',   right:true, w:'80px'},
    {label:'Target',   right:true, w:'70px'},
    {label:'Ach%',     right:true, w:'60px'},
    {label:'LM Rev',   right:true, w:'80px'},
    {label:'vs LM',    right:true, w:'72px'},
    {label:'LY Rev',   right:true, w:'80px'},
    {label:'vs LY',    right:true, w:'72px'},
    {label:'Clients',  right:true, w:'60px'},
  ];

  const rows = platforms.map(p => {
    const pl = md.platform[p] || {};
    const isActive = CURRENT_PLATFORM === 'all' || CURRENT_PLATFORM === p;
    const cls = CURRENT_PLATFORM === p ? 'badge-green' : clsMap[p];
    let rev, bookedCr, clients, momPct, loyPct;

    let lmRev, lyRev;
    if (anyPlatFilterActive) {
      const curr  = getFilteredDataForPlatform(p, md);
      const prior = getFilteredDataForPlatform(p, priorMd);
      const ly    = getFilteredDataForPlatform(p, lyMd);
      rev      = curr.rev;
      bookedCr = curr.booked;
      clients  = curr.clients;
      lmRev    = prior.rev > 0 ? prior.rev : null;
      lyRev    = ly.rev    > 0 ? ly.rev    : null;
      momPct   = lmRev !== null ? r2(((curr.rev - lmRev) / lmRev) * 100) : null;
      loyPct   = lyRev !== null ? r2(((curr.rev - lyRev) / lyRev) * 100) : null;
    } else {
      rev      = pl.del_rev ?? 0;
      bookedCr = pl.booked_rev != null ? r2(pl.booked_rev) : null;
      clients  = pl.clients || 0;
      momPct   = pl.growth_vs_lm ?? null;
      loyPct   = pl.growth_vs_ly ?? null;
      const priorPl = priorMd ? (priorMd.platform[p] || {}) : {};
      const lyPl    = lyMd    ? (lyMd.platform[p]    || {}) : {};
      lmRev = r2(platformRevFromStored(priorPl) || 0) > 0 ? r2(platformRevFromStored(priorPl)) : null;
      lyRev = r2(platformRevFromStored(lyPl)    || 0) > 0 ? r2(platformRevFromStored(lyPl))    : null;
    }

    return '<tr style="' + (!isActive ? 'opacity:0.3' : '') + '">' +
      '<td><span class="badge ' + cls + '">' + p + '</span></td>' +
      '<td style="text-align:right;font-family:var(--mono);font-weight:500">' + fmtNum(rev) + ' Cr</td>' +
      '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + (bookedCr != null ? fmtNum(bookedCr) + ' Cr' : '—') + '</td>' +
      '<td style="text-align:right;color:var(--ink-soft)">—</td>' +
      '<td style="text-align:right;color:var(--ink-soft)">—</td>' +
      '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + (lmRev !== null ? fmtNum(lmRev) + ' Cr' : '—') + '</td>' +
      '<td style="text-align:right">' + growthBadge(momPct) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + (lyRev !== null ? fmtNum(lyRev) + ' Cr' : '—') + '</td>' +
      '<td style="text-align:right">' + growthBadge(loyPct) + '</td>' +
      '<td style="text-align:right;color:var(--ink-soft)">' + clients + '</td>' +
    '</tr>';
  }).join('');

  // Total row
  let totalRev = 0, totalBooked = 0, totalClients = 0, totalLmRev = 0, totalLyRev = 0;
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
      if (prior.rev > 0) { totalMomNum += curr.rev - prior.rev; totalMomDen += prior.rev; totalLmRev += prior.rev; }
      if (ly.rev    > 0) { totalLyNum  += curr.rev - ly.rev;    totalLyDen  += ly.rev;    totalLyRev += ly.rev;    }
    } else {
      rev      = pl.del_rev ?? 0;
      bookedCr = pl.booked_rev != null ? r2(pl.booked_rev) : null;
      clients  = pl.clients || 0;
      const priorPl = priorMd ? (priorMd.platform[p] || {}) : {};
      const lyPl    = lyMd    ? (lyMd.platform[p]    || {}) : {};
      const pRev    = r2(platformRevFromStored(priorPl) || 0);
      const lRev    = r2(platformRevFromStored(lyPl)    || 0);
      if (pRev > 0) { totalMomNum += rev - pRev; totalMomDen += pRev; totalLmRev += pRev; }
      if (lRev > 0) { totalLyNum  += rev - lRev; totalLyDen  += lRev; totalLyRev += lRev; }
    }
    totalRev += rev; if (bookedCr != null) totalBooked += bookedCr; totalClients += clients;
  });

  const totalMomPct = totalMomDen > 0 ? r2((totalMomNum / totalMomDen) * 100) : null;
  const totalLyPct  = totalLyDen  > 0 ? r2((totalLyNum  / totalLyDen)  * 100) : null;

  const totalRow = '<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">' +
    '<td><span class="badge badge-gray">Total</span></td>' +
    '<td style="text-align:right;font-family:var(--mono);font-weight:600">' + fmtNum(r2(totalRev)) + ' Cr</td>' +
    '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + (totalBooked > 0 ? fmtNum(r2(totalBooked)) + ' Cr' : '—') + '</td>' +
    '<td style="text-align:right;color:var(--ink-soft)">—</td>' +
    '<td style="text-align:right;color:var(--ink-soft)">—</td>' +
    '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + (totalLmRev > 0 ? fmtNum(r2(totalLmRev)) + ' Cr' : '—') + '</td>' +
    '<td style="text-align:right">' + growthBadge(totalMomPct) + '</td>' +
    '<td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">' + (totalLyRev > 0 ? fmtNum(r2(totalLyRev)) + ' Cr' : '—') + '</td>' +
    '<td style="text-align:right">' + growthBadge(totalLyPct) + '</td>' +
    '<td style="text-align:right;color:var(--ink-soft)">' + (() => {
      const _a = CURRENT_ADTYPE, _f = CURRENT_FORMAT;
      const _vBsT = ['preroll','midroll','integ','spots'];
      const _dBsT = ['billboard','breakout','pause','frames','fence','untagged'];
      const allPlatClients = new Set();
      (md.top_clients || []).forEach(c => {
        // Apply BU filter
        const buOk = CURRENT_BU === 'all' || c.bu === CURRENT_BU || (CURRENT_BU === 'Others' && !MAIN_BUS.includes(c.bu));
        if (!buOk) return;
        // Apply category filter
        if (CURRENT_CATEGORY !== 'all' && c.category !== CURRENT_CATEGORY && !(c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0)) return;
        // Apply agency filter
        if (CURRENT_AGENCY !== 'all' && c.agency !== CURRENT_AGENCY && !(c.agency_rev_map && c.agency_rev_map[CURRENT_AGENCY] > 0)) return;
        if (CURRENT_CLIENT !== 'all' && c.name !== CURRENT_CLIENT) return;
        // Compute revenue under active platform/adtype/format
        const getPlatRev = (platName) => {
          const platKey = platName === 'CTV' ? 'ctv_rev' : platName === 'Mobile' ? 'mobile_rev' : 'mobilectv_rev';
          if (_f !== 'all') {
            const fk = formatFieldKey(_f); const base = fk ? fk.replace('_rev','') : null;
            if (!base) return 0;
            if ((_a === 'Display' && _vBsT.includes(base)) || (_a === 'Video' && _dBsT.includes(base))) return 0;
            if (platName === 'CTV')        return c[`ctv_${base}_rev`]  || 0;
            if (platName === 'Mobile')     return c[`mob_${base}_rev`]  || 0;
            if (platName === 'Mobile+CTV') return c[`mctv_${base}_rev`] || 0;
            return c[fk] || 0;
          }
          if (_a === 'Video')   { if (platName==='CTV') return c.ctv_video_rev||0; if (platName==='Mobile') return c.mob_video_rev||0; if (platName==='Mobile+CTV') return c.mobilectv_video_rev||0; }
          if (_a === 'Display') { if (platName==='CTV') return c.ctv_display_rev||0; if (platName==='Mobile') return c.mob_display_rev||0; if (platName==='Mobile+CTV') return c.mobilectv_display_rev||0; }
          return c[platKey] || 0;
        };
        const platsToCheck = CURRENT_PLATFORM === 'all' ? ['CTV','Mobile','Mobile+CTV'] : [CURRENT_PLATFORM];
        const totalPlatRev = platsToCheck.reduce((t, pl) => t + getPlatRev(pl), 0);
        if (totalPlatRev > 0) allPlatClients.add(c.name);
      });
      return fmtInt(allPlatClients.size);
    })() + '</td>' +
  '</tr>';

  document.getElementById('platform-panel').innerHTML = ptable(headers, rows + totalRow);
}

// ── Ad Type ───────────────────────────────────────
function renderAdType(md) {
  const vFormats = ['Preroll','Midroll','Integration','Spots'];
  const dFormats = ['Billboard','Breakout Billboard','Pause Ads','Display and Frames','Fence Ads','Untagged'];
  const allBUs   = ['LCS1','LCS2','MM1','MM2','Others'];

  const priorMd = DATA.months[AGG_PRIOR_KEY || priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[AGG_LY_KEY    || lyMonthKey(CURRENT_MONTH)]    || null;

  const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
  const needsClientFilter = CURRENT_BU !== 'all' || CURRENT_CATEGORY !== 'all' || CURRENT_AGENCY !== 'all' || CURRENT_CLIENT !== 'all';
  const anyFilterActive   = needsClientFilter || p !== 'all' || f !== 'all' || CURRENT_CLIENT !== 'all';
  const activeBUs = CURRENT_BU !== 'all' ? [CURRENT_BU] : allBUs;

  const buAdTypeRev = (b, isVideo) => {
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      const _vBs = ['preroll','midroll','integ','spots'];
      const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
      if (isVideo  && _dBs.includes(base)) return 0;
      if (!isVideo && _vBs.includes(base)) return 0;
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
      let scale = 1;
      if (CURRENT_CATEGORY !== 'all') {
        const catRev = (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY]) || 0;
        scale *= c.del_rev > 0 ? catRev / c.del_rev : 0;
      }
      if (CURRENT_AGENCY !== 'all') {
        const agRev = (c.agency_rev_map && c.agency_rev_map[CURRENT_AGENCY]) || 0;
        scale *= c.del_rev > 0 ? agRev / c.del_rev : 0;
      }
      return scale;
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
    if (CURRENT_CLIENT !== 'all') clients = clients.filter(c => c.name === CURRENT_CLIENT);
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
booked:  stored.booked_rev != null ? r2(stored.booked_rev) : null,
clients: clientCount,
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

    return { rev: r2(rev), booked: bookedRaw > 0 ? r2(bookedRaw) : null, clients: clientCount };
  };

  const getFormatData = (fmt, adType, monthData) => {
    if (!monthData) return { rev: 0, booked: 0, clients: 0 };
    const fk = formatFieldKey(fmt);
    const base = fk ? fk.replace('_rev','') : null;
    if (!base) return { rev: 0, booked: 0, clients: 0 };

    // clientFormatRevFull: platform-aware but with fallback to unplatformed field
    // Used for both client-path rev AND client counting
    const clientFmtRev = (c) => {
      if (p === 'CTV')        return c[`ctv_${base}_rev`]  ?? c[fk] ?? 0;
      if (p === 'Mobile')     return c[`mob_${base}_rev`]  ?? c[fk] ?? 0;
      if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`] ?? c[fk] ?? 0;
      return c[fk] ?? 0;
    };

    const filteredClients = getFilteredClients(monthData);
    let rev = 0, bookedRaw = 0, clientCount = 0;

    if (!anyFilterActive) {
      // No filters at all: use stored format rev (aggregated), client-loop for count
      rev = monthData.ad_type?.[adType]?.formats?.[fmt] ?? 0;
      // Booked: use unplatformed BU stored field (p is 'all' here since anyFilterActive=false)
      activeBUs.forEach(buName => {
        bookedRaw += (monthData.bu[buName] || {})[`${base}_booked`] ?? 0;
      });
      clientCount = (monthData.top_clients || []).filter(c => clientFmtRev(c) > 0).length;
      return { rev: r2(rev), booked: bookedRaw > 0 ? r2(bookedRaw) : null, clients: clientCount };
    }

    // With any filter active (platform, BU, category, agency, format, client):
    // Always aggregate from clients — BU stored fields lack platform×display-format cross-cuts
    const fmtAgScale = (c) => {
      if (CURRENT_AGENCY === 'all') return 1;
      if (c.agency_rev_map && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
      return c.agency === CURRENT_AGENCY ? 1 : 0;
    };
    const allClients = needsClientFilter ? filteredClients : getFilteredClients(monthData);
    const fmtCatScale = (c) => { if (CURRENT_CATEGORY === 'all') return 1; if (c.category_rev_map && c.del_rev > 0) return (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev; return c.category === CURRENT_CATEGORY ? 1 : 0; };
    rev = allClients.reduce((t, c) => t + clientFmtRev(c) * fmtAgScale(c) * fmtCatScale(c), 0);

    // Booked: pro-rate by format rev share of each client's total del_rev
    bookedRaw = allClients.reduce((t, c) => {
      const totalClientRev = c.del_rev || 0;
      if (totalClientRev <= 0) return t;
      const fmtClientRev = clientFmtRev(c) * fmtAgScale(c) * fmtCatScale(c);
      return t + (c.booked_rev || 0) * (fmtClientRev / totalClientRev);
    }, 0);

    clientCount = allClients.filter(c => clientFmtRev(c) * fmtAgScale(c) * fmtCatScale(c) > 0).length;
    return { rev: r2(rev), booked: bookedRaw > 0 ? r2(bookedRaw) : null, clients: clientCount };
  };
  // ── CTV% helpers ──────────────────────────────────────────────────────
  // IMPORTANT: clientRev(c, isVideo) already applies catScale*agScale internally.
  // Do NOT multiply by scale again here — that causes >100% values.
  // For numerator (CTV rev), apply the same catScale*agScale manually since
  // c.ctv_video_rev is a raw field with no built-in scaling.

  const _getCatAgScale = (c) => {
    let scale = 1;
    if (CURRENT_CATEGORY !== 'all') {
      const catRev = (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY]) || 0;
      scale *= c.del_rev > 0 ? catRev / c.del_rev : 0;
    }
    if (CURRENT_AGENCY !== 'all') {
      const agRev = (c.agency_rev_map && c.agency_rev_map[CURRENT_AGENCY]) || 0;
      scale *= c.del_rev > 0 ? agRev / c.del_rev : 0;
    }
    return scale;
  };

  const adTypeCtvPct = (adType, monthData) => {
    if (!monthData) return null;
    if (CURRENT_PLATFORM === 'CTV')        return 100;
    if (CURRENT_PLATFORM === 'Mobile')     return 0;
    if (CURRENT_PLATFORM === 'Mobile+CTV') return null;

    const isVideo = adType === 'Video';
    if (f !== 'all') {
      if (isVideo  && dFormats.includes(f)) return null;
      if (!isVideo && vFormats.includes(f)) return null;
    }

    // ad_type stored object has NO ctv breakdown fields — always compute from clients
    const clients = needsClientFilter ? getFilteredClients(monthData) : (monthData.top_clients || []);
    let ctvRev = 0, totalRev = 0;
    clients.forEach(c => {
      const scale = _getCatAgScale(c);
      if (scale === 0) return;
      // Denominator: clientRev already applies scale internally
      totalRev += clientRev(c, isVideo);
      // Numerator: raw CTV field × scale applied manually
      let cRev = 0;
      if (f !== 'all') {
        const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
        cRev = base ? (c['ctv_' + base + '_rev'] ?? 0) : 0;
      } else if (isVideo)  { cRev = c.ctv_video_rev   ?? 0; }
      else                 { cRev = c.ctv_display_rev ?? 0; }
      ctvRev += cRev * scale;
    });
    if (totalRev <= 0) return null;
    return Math.round((ctvRev / totalRev) * 100);
  };

  const fmtCtvPct = (fmt, adType, monthData) => {
    if (!monthData) return null;
    if (CURRENT_PLATFORM === 'CTV')        return 100;
    if (CURRENT_PLATFORM === 'Mobile')     return 0;
    if (CURRENT_PLATFORM === 'Mobile+CTV') return null;

    const fk = formatFieldKey(fmt);
    const base = fk ? fk.replace('_rev','') : null;
    if (!base) return null;

    // ad_type stored object has NO ctv breakdown fields — always compute from clients
    const clients = needsClientFilter ? getFilteredClients(monthData) : (monthData.top_clients || []);
    let ctvRev = 0, totalRev = 0;
    clients.forEach(c => {
      const scale = _getCatAgScale(c);
      if (scale === 0) return;
      // Denominator: raw format rev × scale
      totalRev += (c[fk] ?? 0) * scale;
      // Numerator: CTV slice of that format × same scale
      ctvRev += (c['ctv_' + base + '_rev'] ?? 0) * scale;
    });
    if (totalRev <= 0) return null;
    return Math.round((ctvRev / totalRev) * 100);
  };

  const renderCtvPct = (pct) => {
    if (CURRENT_PLATFORM === 'Mobile') return '<span style="color:var(--ink-faint)">0%</span>';
    if (pct === null || pct === undefined) return '<span style="color:var(--ink-faint)">—</span>';
    if (pct === 0)   return '<span style="color:var(--ink-faint)">0%</span>';
    if (pct === 100) return '<span style="color:var(--green);font-weight:600">100%</span>';
    return `<span style="color:var(--accent);font-weight:500">${pct}%</span>`;
  };  

  // ── Build table ────────────────────────────────────────────────────────
  const headers = [
    {label:'Type / Format', w:'140px'},
    {label:'Del Rev',  right:true, w:'80px'},
    {label:'Booked',   right:true, w:'80px'},
    {label:'LM Rev',   right:true, w:'80px'},
    {label:'vs LM',    right:true, w:'72px'},
    {label:'LY Rev',   right:true, w:'80px'},
    {label:'vs LY',    right:true, w:'72px'},
    {label:'CTV%',     right:true, w:'58px'},
    {label:'Clients',  right:true, w:'60px'},
    {label:'Share',    right:true, w:'52px'},
  ];

  const videoData   = (a === 'all' || a === 'Video')   ? getAdTypeData('Video',   md) : { rev:0, booked:0, clients:0 };
  const displayData = (a === 'all' || a === 'Display') ? getAdTypeData('Display', md) : { rev:0, booked:0, clients:0 };
  const shareDenom  = (videoData.rev + displayData.rev) || 1;

  let rows = '';
  let totalRevSum = 0, totalBookedSum = 0, totalLmRevSum = 0, totalLyRevSum = 0;
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
    const ctvPct = adTypeCtvPct(adType, md);

    rows += `<tr style="${!isTypeActive ? 'opacity:0.3' : ''}background:var(--surface)">
      <td style="font-weight:500"><span class="badge ${badgeCls}">${adType}</span></td>
      <td style="text-align:right;font-family:var(--mono);font-weight:500">${fmtNum(curr.rev)} Cr</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${curr.booked != null ? fmtNum(curr.booked) + ' Cr' : '—'}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${prior.rev > 0 ? fmtNum(r2(prior.rev)) + ' Cr' : '—'}</td>
      <td style="text-align:right">${growthBadge(momPct)}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${ly.rev > 0 ? fmtNum(r2(ly.rev)) + ' Cr' : '—'}</td>
      <td style="text-align:right">${growthBadge(loyPct)}</td>
      <td style="text-align:right">${renderCtvPct(ctvPct)}</td>
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
        const fdPrior   = getFormatData(fmt, adType, priorMd);
        const fdLy      = getFormatData(fmt, adType, lyMd);
        const fmtMomPct = fdPrior.rev > 0 ? r2(((fd.rev - fdPrior.rev) / fdPrior.rev) * 100) : null;
        const fmtLoyPct = fdLy.rev    > 0 ? r2(((fd.rev - fdLy.rev)    / fdLy.rev)    * 100) : null;
        rows += `<tr style="${!isFmtActive ? 'opacity:0.3' : ''}">
          <td style="padding-left:24px;color:var(--ink-soft);font-size:12px">${fmt}</td>
          <td style="text-align:right;font-family:var(--mono);font-size:12px">${fmtNum(fd.rev)} Cr</td>
          <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--ink-soft)">${fd.booked != null ? fmtNum(fd.booked) + ' Cr' : '—'}</td>
          <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--ink-soft)">${fdPrior.rev > 0 ? fmtNum(r2(fdPrior.rev)) + ' Cr' : '—'}</td>
          <td style="text-align:right;font-size:12px">${growthBadge(fmtMomPct)}</td>
          <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--ink-soft)">${fdLy.rev > 0 ? fmtNum(r2(fdLy.rev)) + ' Cr' : '—'}</td>
          <td style="text-align:right;font-size:12px">${growthBadge(fmtLoyPct)}</td>
          <td style="text-align:right;font-size:12px">${renderCtvPct(fmtCtvPct(fmt, adType, md))}</td>
          <td style="text-align:right;font-size:12px;color:var(--ink-soft)">${fd.clients}</td>
          <td style="text-align:right;font-size:12px;color:var(--ink-soft)">${fmtShare}%</td>
        </tr>`;
      });
    }

    if (isTypeActive) {
      totalRevSum    += curr.rev;
      totalBookedSum += curr.booked;
      if (prior.rev > 0) { totalMomNum += curr.rev - prior.rev; totalMomDen += prior.rev; totalLmRevSum += prior.rev; }
      if (ly.rev    > 0) { totalLyNum  += curr.rev - ly.rev;    totalLyDen  += ly.rev;    totalLyRevSum += ly.rev;    }
    }
  });

  const totalMomPct = totalMomDen > 0 ? r2((totalMomNum / totalMomDen) * 100) : null;
  const totalLyPct  = totalLyDen  > 0 ? r2((totalLyNum  / totalLyDen)  * 100) : null;

  const totalUniqueClients = (() => {
    const fc = getFilteredClients(md);
    const _a = CURRENT_ADTYPE;
    if (_a === 'Video')   return fc.filter(c => clientRev(c, true)  > 0).length;
    if (_a === 'Display') return fc.filter(c => clientRev(c, false) > 0).length;
    return fc.filter(c => clientRev(c, true) > 0 || clientRev(c, false) > 0).length;
  })();

  const totalCtvPct = (() => {
    if (CURRENT_PLATFORM === 'CTV')        return 100;
    if (CURRENT_PLATFORM === 'Mobile')     return 0;
    if (CURRENT_PLATFORM === 'Mobile+CTV') return null;

    const activeTypes = ['Video','Display'].filter(at => {
      if (a !== 'all' && a !== at) return false;
      if (f !== 'all') {
        const isVid = at === 'Video';
        if (isVid  && dFormats.includes(f)) return false;
        if (!isVid && vFormats.includes(f)) return false;
      }
      return true;
    });

    let grandCtvRev = 0, grandTotalRev = 0;

    if (needsClientFilter) {
      const clients = getFilteredClients(md);
      clients.forEach(c => {
        const scale = _getCatAgScale(c);
        activeTypes.forEach(at => {
          const isVid = at === 'Video';
          // Denominator: clientRev already applies scale internally — do NOT multiply again
          grandTotalRev += clientRev(c, isVid);
          // Numerator: raw CTV field × scale (applied manually)
          let cRev = 0;
          if (f !== 'all') {
            const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
            cRev = base ? (c['ctv_' + base + '_rev'] ?? 0) : 0;
          } else if (isVid)  { cRev = c.ctv_video_rev   ?? 0; }
          else               { cRev = c.ctv_display_rev ?? 0; }
          grandCtvRev += cRev * scale;
        });
      });
    } else {
      // ad_type stored has no CTV breakdown — must use top_clients
      const clients = md.top_clients || [];
      clients.forEach(c => {
        activeTypes.forEach(at => {
          const isVid = at === 'Video';
          grandTotalRev += clientRev(c, isVid);   // scale=1 since no cat/ag filter here
          let cRev = 0;
          if (f !== 'all') {
            const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
            cRev = base ? (c['ctv_' + base + '_rev'] ?? 0) : 0;
          } else if (isVid)  { cRev = c.ctv_video_rev   ?? 0; }
          else               { cRev = c.ctv_display_rev ?? 0; }
          grandCtvRev += cRev;
        });
      });
    }
    return grandTotalRev > 0 ? Math.round((grandCtvRev / grandTotalRev) * 100) : null;
  })();

  const totalRow = `<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">
    <td><span class="badge badge-gray">Total</span></td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600">${fmtNum(r2(totalRevSum))} Cr</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${totalBookedSum > 0 ? fmtNum(r2(totalBookedSum)) + ' Cr' : '—'}</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${totalLmRevSum > 0 ? fmtNum(r2(totalLmRevSum)) + ' Cr' : '—'}</td>
    <td style="text-align:right">${growthBadge(totalMomPct)}</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${totalLyRevSum > 0 ? fmtNum(r2(totalLyRevSum)) + ' Cr' : '—'}</td>
    <td style="text-align:right">${growthBadge(totalLyPct)}</td>
    <td style="text-align:right;font-weight:600;color:var(--accent)">${renderCtvPct(totalCtvPct)}</td>
    <td style="text-align:right;color:var(--ink-soft)">${fmtInt(totalUniqueClients)}</td>
    <td style="text-align:right;color:var(--ink-soft)">100%</td>
  </tr>`;

  document.getElementById('adtype-panel').innerHTML = ptable(headers, rows + totalRow);
}

// ── Categories ────────────────────────────────────
function renderCategories(md) {
  const priorMd = DATA.months[AGG_PRIOR_KEY || priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[AGG_LY_KEY    || lyMonthKey(CURRENT_MONTH)]    || null;

  const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
  const anyFilterActive = CURRENT_BU !== 'all' || CURRENT_AGENCY !== 'all' ||
                          CURRENT_CATEGORY !== 'all' ||
                          p !== 'all' || a !== 'all' || f !== 'all' || CURRENT_CLIENT !== 'all';

  // ── Client rev for platform × adtype × format filters (no category scaling) ──
  const clientRevForFilters = (c) => {
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      const _vBs = ['preroll','midroll','integ','spots'];
      const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
      if (a === 'Video'   && _dBs.includes(base)) return 0;
      if (a === 'Display' && _vBs.includes(base)) return 0;
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
    if (CURRENT_CLIENT !== 'all') clients = clients.filter(c => c.name === CURRENT_CLIENT);
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
        booked:  stored.booked_rev != null ? r2(stored.booked_rev) : null,
        clients: stored.clients || 0,
      };
    }

    // All filtered cases: aggregate from clients
    // Primary filter: c.category === catName (always populated, no map needed)
    // Secondary: also catch multi-category clients via category_rev_map if available
    const baseClients = getBaseClients(monthData);

    let rev = 0, bookedRaw = 0;
    const clientSet = new Set();

    const catAgScale = (c) => {
      if (CURRENT_AGENCY === 'all') return 1;
      if (c.agency_rev_map && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
      return c.agency === CURRENT_AGENCY ? 1 : 0;
    };

    baseClients.forEach(c => {
      let catScale;
      if (c.category_rev_map && Object.keys(c.category_rev_map).length > 0 && c.del_rev > 0) {
        catScale = (c.category_rev_map[catName] || 0) / c.del_rev;
        if (catScale <= 0) return;
      } else if (c.category === catName) {
        catScale = 1;
      } else {
        return;
      }

      const filteredRev = clientRevForFilters(c) * catAgScale(c);
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

    return { rev: r2(rev), booked: bookedRaw > 0 ? r2(bookedRaw) : null, clients: clientSet.size };
  };

  // ── Build rows ──────────────────────────────────────────────────────────
  const catListRaw = md.categories || [];
  const allRevsRaw = catListRaw.map(cat => getCatData(cat.name, md));
  const catPairs   = catListRaw.map((cat, i) => ({ cat, rev: allRevsRaw[i] })).sort((a, b) => b.rev.rev - a.rev.rev);
  const catList    = catPairs.map(p => p.cat);
  const allRevs    = catPairs.map(p => p.rev);
  const shareDenom = allRevs.reduce((t, d) => t + d.rev, 0) || 1;

  // ── CTV% helper — always client-loop based to keep numerator/denominator scope identical ──
  const catCtvPct = (catName, monthData) => {
    if (CURRENT_PLATFORM === 'Mobile')     return 0;
    if (CURRENT_PLATFORM === 'Mobile+CTV') return null;
    if (!monthData) return null;
    const baseClients = getBaseClients(monthData);
    let ctvRev = 0, totalRev = 0;
    const catAgScale = (c) => {
      if (CURRENT_AGENCY === 'all') return 1;
      if (c.agency_rev_map && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
      return c.agency === CURRENT_AGENCY ? 1 : 0;
    };
    baseClients.forEach(c => {
      let catScale;
      if (c.category_rev_map && Object.keys(c.category_rev_map).length > 0 && c.del_rev > 0) {
        catScale = (c.category_rev_map[catName] || 0) / c.del_rev;
        if (catScale <= 0) return;
      } else if (c.category === catName) {
        catScale = 1;
      } else {
        return;
      }
      const scale = catScale * catAgScale(c);
      totalRev += clientRevForFilters(c) * scale;
      // CTV numerator: same catScale+agScale applied to ctv_rev slice
      const f = CURRENT_FORMAT, a = CURRENT_ADTYPE;
      let cRev = 0;
      if (f !== 'all') {
        const fk = formatFieldKey(f);
        const base = fk ? fk.replace('_rev','') : null;
        cRev = base ? (c[`ctv_${base}_rev`] ?? 0) : 0;
      } else if (a === 'Video')   { cRev = c.ctv_video_rev   ?? 0; }
        else if (a === 'Display') { cRev = c.ctv_display_rev ?? 0; }
        else                      { cRev = c.ctv_rev         ?? 0; }
      ctvRev += cRev * scale;
    });
    return totalRev > 0 ? Math.round((ctvRev / totalRev) * 100) : null;
  };

  const renderCtvPct = (pct) => {
    if (CURRENT_PLATFORM === 'Mobile') return '<span style="color:var(--ink-faint)">0%</span>';
    if (pct === null || pct === undefined) return '<span style="color:var(--ink-faint)">—</span>';
    if (pct === 0)   return '<span style="color:var(--ink-faint)">0%</span>';
    if (pct === 100) return '<span style="color:var(--green);font-weight:600">100%</span>';
    return `<span style="color:var(--accent);font-weight:500">${pct}%</span>`;
  };

  const headers = [
    {label:'#',       w:'28px'},
    {label:'Category'},
    {label:'Del Rev', right:true, w:'80px'},
    {label:'Booked',  right:true, w:'80px'},
    {label:'MoM',     right:true, w:'72px'},
    {label:'YoY',     right:true, w:'72px'},
    {label:'CTV%',    right:true, w:'60px'},
    {label:'Clients', right:true, w:'60px'},
    {label:'Share',   right:true, w:'52px'},
  ];

  let rows = '';
  let totalRev = 0, totalBooked = 0, totalLmRev = 0, totalLyRev = 0;
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

    const ctvPct = catCtvPct(cat.name, md);
    rows += `<tr style="${!isActive ? 'opacity:0.3' : ''}">
      <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${i+1}</td>
      <td style="font-weight:500;cursor:pointer" onclick="openDiagDrilldown('Category','${cat.name.replace(/'/g,"\\'")}',${momPct ?? 0},true)"><span style="color:var(--accent);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px">${cat.name}</span> ${momPct !== null ? (momPct >= 20 ? '<span style="color:var(--green);font-size:11px">↑↑</span>' : momPct >= 5 ? '<span style="color:var(--green);font-size:11px">↑</span>' : momPct <= -20 ? '<span style="color:var(--red);font-size:11px">↓↓</span>' : momPct <= -5 ? '<span style="color:var(--red);font-size:11px">↓</span>' : '') : ''}</td>
      <td style="text-align:right;font-family:var(--mono);font-weight:500">${fmtNum(curr.rev)} Cr</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${curr.booked != null ? fmtNum(curr.booked) + ' Cr' : '—'}</td>
      <td style="text-align:right">${growthBadge(momPct)}</td>
      <td style="text-align:right">${growthBadge(loyPct)}</td>
      <td style="text-align:right">${renderCtvPct(ctvPct)}</td>
      <td style="text-align:right;color:var(--ink-soft)">${curr.clients || '—'}</td>
      <td style="text-align:right;color:var(--ink-soft)">${share}%</td>
    </tr>`;

    if (isActive) {
      totalRev    += curr.rev;
      if (curr.booked != null) totalBooked += curr.booked;
      if (prior.rev > 0) { totalMomNum += curr.rev - prior.rev; totalMomDen += prior.rev; totalLmRev += prior.rev; }
      if (ly.rev    > 0) { totalLyNum  += curr.rev - ly.rev;    totalLyDen  += ly.rev;    totalLyRev += ly.rev;    }
    }
  });

  const totalMomPct = totalMomDen > 0 ? r2((totalMomNum / totalMomDen) * 100) : null;
  const totalLyPct  = totalLyDen  > 0 ? r2((totalLyNum  / totalLyDen)  * 100) : null;

  // Total unique clients across filtered base pool
  // Always compute from clients — respects category, BU, agency, platform, adtype, format
  const totalUniqueClients = (() => {
    const anyRealFilterActive = CURRENT_BU !== 'all' || CURRENT_CATEGORY !== 'all' ||
      CURRENT_AGENCY !== 'all' || p !== 'all' || a !== 'all' || f !== 'all' || CURRENT_CLIENT !== 'all';
    if (!anyRealFilterActive) return md.total_clients || 0;
    // Build client pool: filter by BU + agency (base), then additionally by category
    let pool = (md.top_clients || []).slice();
    pool = filterClientsByBU(pool, CURRENT_BU);
    if (CURRENT_AGENCY !== 'all') pool = pool.filter(c =>
      c.agency === CURRENT_AGENCY || (c.agency_rev_map && c.agency_rev_map[CURRENT_AGENCY] > 0));
    if (CURRENT_CATEGORY !== 'all') pool = pool.filter(c =>
      c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
    if (CURRENT_CLIENT !== 'all') pool = pool.filter(c => c.name === CURRENT_CLIENT);
    return pool.filter(c => clientRevForFilters(c) > 0).length;
  })();

  const totalCtvPct = (() => {
    if (CURRENT_PLATFORM === 'Mobile')     return 0;
    if (CURRENT_PLATFORM === 'Mobile+CTV') return null;
    const baseClients = getBaseClients(md);
    let ctvRev = 0, totalRevForCtv = 0;
    const catAgScale = (c) => {
      if (CURRENT_AGENCY === 'all') return 1;
      if (c.agency_rev_map && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
      return c.agency === CURRENT_AGENCY ? 1 : 0;
    };
    baseClients.forEach(c => {
      // For the total row, apply category filter too (same as totalUniqueClients)
      if (CURRENT_CATEGORY !== 'all') {
        const inCat = c.category === CURRENT_CATEGORY ||
          (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0);
        if (!inCat) return;
        const catScale = c.category_rev_map && c.del_rev > 0
          ? (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev
          : 1;
        const scale = catScale * catAgScale(c);
        totalRevForCtv += clientRevForFilters(c) * scale;
        const f2 = CURRENT_FORMAT, a2 = CURRENT_ADTYPE;
        let cRev = 0;
        if (f2 !== 'all') {
          const fk = formatFieldKey(f2);
          const base = fk ? fk.replace('_rev','') : null;
          cRev = base ? (c[`ctv_${base}_rev`] ?? 0) : 0;
        } else if (a2 === 'Video')   { cRev = c.ctv_video_rev   ?? 0; }
          else if (a2 === 'Display') { cRev = c.ctv_display_rev ?? 0; }
          else                       { cRev = c.ctv_rev         ?? 0; }
        ctvRev += cRev * scale;
      } else {
        const scale = catAgScale(c);
        totalRevForCtv += clientRevForFilters(c) * scale;
        const f2 = CURRENT_FORMAT, a2 = CURRENT_ADTYPE;
        let cRev = 0;
        if (f2 !== 'all') {
          const fk = formatFieldKey(f2);
          const base = fk ? fk.replace('_rev','') : null;
          cRev = base ? (c[`ctv_${base}_rev`] ?? 0) : 0;
        } else if (a2 === 'Video')   { cRev = c.ctv_video_rev   ?? 0; }
          else if (a2 === 'Display') { cRev = c.ctv_display_rev ?? 0; }
          else                       { cRev = c.ctv_rev         ?? 0; }
        ctvRev += cRev * scale;
      }
    });
    return totalRevForCtv > 0 ? Math.round((ctvRev / totalRevForCtv) * 100) : null;
  })();

  const totalRow = `<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">
    <td></td>
    <td><span class="badge badge-gray">Total</span></td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600">${fmtNum(r2(totalRev))} Cr</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${totalBooked > 0 ? fmtNum(r2(totalBooked)) + ' Cr' : '—'}</td>
    <td style="text-align:right">${growthBadge(totalMomPct)}</td>
    <td style="text-align:right">${growthBadge(totalLyPct)}</td>
    <td style="text-align:right;font-weight:600;color:var(--accent)">${renderCtvPct(totalCtvPct)}</td>
    <td style="text-align:right;color:var(--ink-soft)">${fmtInt(totalUniqueClients)}</td>
    <td style="text-align:right;color:var(--ink-soft)">100%</td>
  </tr>`;

  let untaggedCatHtml = '';
  if (CURRENT_CATEGORY === 'all') {
    const grandTotalCat = !anyFilterActive
      ? md.total_del_rev
      : r2(getBaseClients(md).reduce((t, c) => t + clientRevForFilters(c), 0));
    const taggedCatSum   = allRevs.reduce((t, d) => t + d.rev, 0);
    const untaggedCatRev = r2(grandTotalCat - taggedCatSum);
    if (untaggedCatRev > 0.01) {
      const untaggedCatShare   = grandTotalCat > 0 ? Math.round((untaggedCatRev / grandTotalCat) * 100) : 0;
      const knownCats          = new Set(catList.map(c => c.name));
      const untaggedCatClients = (md.top_clients || []).filter(c => c.del_rev > 0 && (!c.category || !knownCats.has(c.category))).length;
      untaggedCatHtml = `<tr style="background:var(--amber-soft)">
        <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${catList.length + 1}</td>
        <td style="font-weight:500;color:var(--amber);font-style:italic">
          Untagged
          <span style="font-size:10px;font-weight:600;background:var(--amber);color:#fff;padding:1px 6px;border-radius:8px;margin-left:5px">No Category</span>
        </td>
        <td style="text-align:right;font-family:var(--mono);font-weight:500;color:var(--amber)">${fmtNum(untaggedCatRev)} Cr</td>
        <td style="text-align:right;color:var(--ink-soft)">—</td>
        <td style="text-align:right;color:var(--ink-soft)">—</td>
        <td style="text-align:right;color:var(--ink-soft)">—</td>
        <td style="text-align:right;color:var(--ink-soft)">—</td>
        <td style="text-align:right;color:var(--ink-soft)">${untaggedCatClients || '—'}</td>
        <td style="text-align:right;color:var(--ink-soft)">${untaggedCatShare}%</td>
      </tr>`;
    }
  }
  document.getElementById('category-panel').innerHTML = ptable(headers, rows + untaggedCatHtml + totalRow);
}

// ── Agencies ──────────────────────────────────────
function renderAgencies(md) {
  const priorMd = DATA.months[AGG_PRIOR_KEY || priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[AGG_LY_KEY    || lyMonthKey(CURRENT_MONTH)]    || null;

  const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
  const anyFilterActive = CURRENT_BU !== 'all' || CURRENT_CATEGORY !== 'all' ||
                          p !== 'all' || a !== 'all' || f !== 'all' || CURRENT_CLIENT !== 'all';

  // ── Client rev for platform × adtype × format filters only ─────────────
  const clientRevForFilters = (c) => {
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      const _vBs = ['preroll','midroll','integ','spots'];
      const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
      if (a === 'Video'   && _dBs.includes(base)) return 0;
      if (a === 'Display' && _vBs.includes(base)) return 0;
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
    if (CURRENT_CLIENT !== 'all') clients = clients.filter(c => c.name === CURRENT_CLIENT);
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
        booked:  stored.booked_rev != null ? r2(stored.booked_rev) : null,
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
      if (c.agency_rev_map && Object.keys(c.agency_rev_map).length > 0 && c.del_rev > 0) {
        agScale = (c.agency_rev_map[agName] || 0) / c.del_rev;
        if (agScale <= 0) return;
      } else if (c.agency === agName) {
        agScale = 1;
      } else {
        return;
      }

      const filteredRev  = clientRevForFilters(c);
      const agCatScale = (() => {
        if (CURRENT_CATEGORY === 'all') return 1;
        if (c.category_rev_map && c.del_rev > 0) return (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev;
        return c.category === CURRENT_CATEGORY ? 1 : 0;
      })();
      const contribution = filteredRev * agScale * agCatScale;
      if (contribution <= 0) return;

      rev       += contribution;
      bookedRaw += c.del_rev > 0
        ? (c.booked_rev || 0) * (contribution / c.del_rev)
        : 0;
      clientSet.add(c.name);
    });

    return { rev: r2(rev), booked: bookedRaw > 0 ? r2(bookedRaw) : null, clients: clientSet.size };
  };

  // ── Build rows ──────────────────────────────────────────────────────────
  const agListRaw  = md.agencies || [];
  const allRevsRaw = agListRaw.map(ag => getAgData(ag.name, md));
  const agPairs    = agListRaw.map((ag, i) => ({ ag, rev: allRevsRaw[i] })).sort((a, b) => b.rev.rev - a.rev.rev);
  const agList     = agPairs.map(p => p.ag);
  const allRevs    = agPairs.map(p => p.rev);
  const shareDenom = allRevs.reduce((t, d) => t + d.rev, 0) || 1;

  // ── CTV% helper — client-loop based; numerator and denominator always same scope ──
  const agCtvPct = (agName, monthData) => {
    if (CURRENT_PLATFORM === 'Mobile')     return 0;
    if (CURRENT_PLATFORM === 'Mobile+CTV') return null;
    if (!monthData) return null;
    const baseClients = getBaseClients(monthData);
    let ctvRev = 0, totalRev = 0;
    baseClients.forEach(c => {
      let agScale;
      if (c.agency_rev_map && Object.keys(c.agency_rev_map).length > 0 && c.del_rev > 0) {
        agScale = (c.agency_rev_map[agName] || 0) / c.del_rev;
        if (agScale <= 0) return;
      } else if (c.agency === agName) {
        agScale = 1;
      } else {
        return;
      }
      const agCatScale = (() => {
        if (CURRENT_CATEGORY === 'all') return 1;
        if (c.category_rev_map && c.del_rev > 0) return (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev;
        return c.category === CURRENT_CATEGORY ? 1 : 0;
      })();
      const scale = agScale * agCatScale;
      totalRev += clientRevForFilters(c) * scale;
      let cRev = 0;
      if (f !== 'all') {
        const fk = formatFieldKey(f);
        const base = fk ? fk.replace('_rev','') : null;
        cRev = base ? (c[`ctv_${base}_rev`] ?? 0) : 0;
      } else if (a === 'Video')   { cRev = c.ctv_video_rev   ?? 0; }
        else if (a === 'Display') { cRev = c.ctv_display_rev ?? 0; }
        else                      { cRev = c.ctv_rev         ?? 0; }
      ctvRev += cRev * scale;
    });
    return totalRev > 0 ? Math.round((ctvRev / totalRev) * 100) : null;
  };

  const renderCtvPct = (pct) => {
    if (CURRENT_PLATFORM === 'Mobile') return '<span style="color:var(--ink-faint)">0%</span>';
    if (pct === null || pct === undefined) return '<span style="color:var(--ink-faint)">—</span>';
    if (pct === 0)   return '<span style="color:var(--ink-faint)">0%</span>';
    if (pct === 100) return '<span style="color:var(--green);font-weight:600">100%</span>';
    return `<span style="color:var(--accent);font-weight:500">${pct}%</span>`;
  };

  const headers = [
    {label:'#',       w:'28px'},
    {label:'Agency'},
    {label:'Del Rev', right:true, w:'80px'},
    {label:'Booked',  right:true, w:'80px'},
    {label:'MoM',     right:true, w:'72px'},
    {label:'YoY',     right:true, w:'72px'},
    {label:'CTV%',    right:true, w:'60px'},
    {label:'Clients', right:true, w:'60px'},
    {label:'Share',   right:true, w:'52px'},
  ];

  let rows = '';
  let totalRev = 0, totalBooked = 0, totalLmRev = 0, totalLyRev = 0;
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

    const ctvPct = agCtvPct(ag.name, md);
    rows += `<tr style="${!isActive ? 'opacity:0.3' : ''}">
      <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${i+1}</td>
      <td style="font-weight:500;cursor:pointer" onclick="openDiagDrilldown('Agency','${ag.name.replace(/'/g,"\\'")}',${momPct ?? 0},true)"><span style="color:var(--accent);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px">${ag.name}</span></td>
      <td style="text-align:right;font-family:var(--mono);font-weight:500">${fmtNum(curr.rev)} Cr</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${curr.booked != null ? fmtNum(curr.booked) + ' Cr' : '—'}</td>
      <td style="text-align:right">${growthBadge(momPct)}</td>
      <td style="text-align:right">${growthBadge(loyPct)}</td>
      <td style="text-align:right">${renderCtvPct(ctvPct)}</td>
      <td style="text-align:right;color:var(--ink-soft)">${curr.clients || '—'}</td>
      <td style="text-align:right;color:var(--ink-soft)">${share}%</td>
    </tr>`;

    if (isActive) {
      totalRev    += curr.rev;
      totalBooked += curr.booked;
      if (prior.rev > 0) { totalMomNum += curr.rev - prior.rev; totalMomDen += prior.rev; totalLmRev += prior.rev; }
      if (ly.rev    > 0) { totalLyNum  += curr.rev - ly.rev;    totalLyDen  += ly.rev;    totalLyRev += ly.rev;    }
    }
  });

  const totalMomPct = totalMomDen > 0 ? r2((totalMomNum / totalMomDen) * 100) : null;
  const totalLyPct  = totalLyDen  > 0 ? r2((totalLyNum  / totalLyDen)  * 100) : null;

  const totalUniqueClients = (() => {
    if (!anyFilterActive) return (md.agencies || []).reduce((t, ag) => t + (ag.clients||0), 0);
    const bc = getBaseClients(md);
    return bc.filter(c => clientRevForFilters(c) > 0).length;
  })();

  const totalCtvPct = (() => {
    if (CURRENT_PLATFORM === 'Mobile')     return 0;
    if (CURRENT_PLATFORM === 'Mobile+CTV') return null;
    const baseClients = getBaseClients(md);
    let ctvRev = 0, totalRevForCtv = 0;
    baseClients.forEach(c => {
      const agCatScale = (() => {
        if (CURRENT_CATEGORY === 'all') return 1;
        if (c.category_rev_map && c.del_rev > 0) return (c.category_rev_map[CURRENT_CATEGORY] || 0) / c.del_rev;
        return c.category === CURRENT_CATEGORY ? 1 : 0;
      })();
      if (agCatScale <= 0) return;
      // For total row, no agency filter — all clients in base pool contribute at full agency weight
      totalRevForCtv += clientRevForFilters(c) * agCatScale;
      let cRev = 0;
      if (f !== 'all') {
        const fk = formatFieldKey(f);
        const base = fk ? fk.replace('_rev','') : null;
        cRev = base ? (c[`ctv_${base}_rev`] ?? 0) : 0;
      } else if (a === 'Video')   { cRev = c.ctv_video_rev   ?? 0; }
        else if (a === 'Display') { cRev = c.ctv_display_rev ?? 0; }
        else                      { cRev = c.ctv_rev         ?? 0; }
      ctvRev += cRev * agCatScale;
    });
    return totalRevForCtv > 0 ? Math.round((ctvRev / totalRevForCtv) * 100) : null;
  })();

  const totalRow = `<tr style="background:var(--surface);font-weight:600;border-top:2px solid var(--border)">
    <td></td>
    <td><span class="badge badge-gray">Total</span></td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600">${fmtNum(r2(totalRev))} Cr</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${totalBooked > 0 ? fmtNum(r2(totalBooked)) + ' Cr' : '—'}</td>
    <td style="text-align:right">${growthBadge(totalMomPct)}</td>
    <td style="text-align:right">${growthBadge(totalLyPct)}</td>
    <td style="text-align:right;font-weight:600;color:var(--accent)">${renderCtvPct(totalCtvPct)}</td>
    <td style="text-align:right;color:var(--ink-soft)">${fmtInt(totalUniqueClients)}</td>
    <td style="text-align:right;color:var(--ink-soft)">100%</td>
  </tr>`;

  let untaggedAgHtml = '';
  if (CURRENT_AGENCY === 'all') {
    const grandTotalAg = !anyFilterActive
      ? md.total_del_rev
      : r2(getBaseClients(md).reduce((t, c) => t + clientRevForFilters(c), 0));
    const taggedAgSum   = allRevs.reduce((t, d) => t + d.rev, 0);
    const untaggedAgRev = r2(grandTotalAg - taggedAgSum);
    if (untaggedAgRev > 0.01) {
      const untaggedAgShare   = grandTotalAg > 0 ? Math.round((untaggedAgRev / grandTotalAg) * 100) : 0;
      const knownAgs          = new Set(agList.map(a => a.name));
      const untaggedAgClients = (md.top_clients || []).filter(c => c.del_rev > 0 && (!c.agency || !knownAgs.has(c.agency))).length;
      untaggedAgHtml = `<tr style="background:var(--amber-soft)">
        <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${agList.length + 1}</td>
        <td style="font-weight:500;color:var(--amber);font-style:italic">
          Untagged
          <span style="font-size:10px;font-weight:600;background:var(--amber);color:#fff;padding:1px 6px;border-radius:8px;margin-left:5px">No Agency</span>
        </td>
        <td style="text-align:right;font-family:var(--mono);font-weight:500;color:var(--amber)">${fmtNum(untaggedAgRev)} Cr</td>
        <td style="text-align:right;color:var(--ink-soft)">—</td>
        <td style="text-align:right;color:var(--ink-soft)">—</td>
        <td style="text-align:right;color:var(--ink-soft)">—</td>
        <td style="text-align:right;color:var(--ink-soft)">—</td>
        <td style="text-align:right;color:var(--ink-soft)">${untaggedAgClients || '—'}</td>
        <td style="text-align:right;color:var(--ink-soft)">${untaggedAgShare}%</td>
      </tr>`;
    }
  }
  document.getElementById('agency-panel').innerHTML = ptable(headers, rows + untaggedAgHtml + totalRow);
}

// ── Top Clients ───────────────────────────────────
function renderClients(md) {
  const priorMd = DATA.months[AGG_PRIOR_KEY || priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[AGG_LY_KEY    || lyMonthKey(CURRENT_MONTH)]    || null;
  const lyClientNames    = new Set((lyMd?.top_clients    || []).map(c => c.name));
  const priorClientNames = new Set((priorMd?.top_clients || []).map(c => c.name));
  const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;

  // ── Same clientRevForFilters as other tables ─────────────────────────
  const clientRevForFilters = (c) => {
    const _vBs = ['preroll','midroll','integ','spots'];
    const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
    if (f !== 'all') {
      const fk = formatFieldKey(f);
      const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      if (a === 'Display' && _vBs.includes(base)) return 0;
      if (a === 'Video'   && _dBs.includes(base)) return 0;
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
  if (CURRENT_CLIENT !== 'all') clients = clients.filter(c => c.name === CURRENT_CLIENT);

  // ── Attach filtered rev to each client, then sort + slice ────────────
  const agScale = (c) => {
    if (CURRENT_AGENCY === 'all') return 1;
    if (c.agency_rev_map && c.del_rev > 0) return (c.agency_rev_map[CURRENT_AGENCY] || 0) / c.del_rev;
    return c.agency === CURRENT_AGENCY ? 1 : 0;
  };
  clients = clients.map(c => ({
    ...c,
    _filteredRev:    r2(clientRevForFilters(c) * agScale(c)),
    _filteredBooked: c.booked_rev != null && c.del_rev > 0
? r2(c.booked_rev * (clientRevForFilters(c) * agScale(c) / c.del_rev))
: null,
  }));
  clients.sort((a, b) => b._filteredRev - a._filteredRev);
  clients = clients.filter(c => c._filteredRev > 0);
  const searchTerm = SEARCH_CLIENT.trim().toLowerCase();
  if (searchTerm) {
    clients = clients.filter(c => c.name.toLowerCase().includes(searchTerm));
  } else {
    clients = clients.slice(0, 20);
  }

  // ── Panel title ──────────────────────────────────────────────────────
  const parts = [CURRENT_BU, p, a, f, CURRENT_CATEGORY, CURRENT_AGENCY].filter(v => v !== 'all');
  document.getElementById('clients-panel-title').textContent = searchTerm
    ? `Search: "${SEARCH_CLIENT}" — ${clients.length} result${clients.length !== 1 ? 's' : ''}`
    : 'Top Clients' + (parts.length ? '  —  ' + parts.join(' · ') : '');

  if (!clients.length) {
    document.getElementById('clients-panel').innerHTML = `
      <div style="padding:10px 18px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
        <span style="font-size:13px;color:var(--ink-soft)">🔍</span>
        <input type="text" id="client-search-input"
          placeholder="Search any client by name..."
          value="${SEARCH_CLIENT.replace(/"/g,'&quot;')}"
          oninput="SEARCH_CLIENT=this.value;renderClients(DATA.months[CURRENT_MONTH])"
          style="flex:1;padding:5px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:inherit;background:var(--surface);color:var(--ink);outline:none"/>
        ${SEARCH_CLIENT ? `<button onclick="SEARCH_CLIENT='';renderClients(DATA.months[CURRENT_MONTH])" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--ink-soft);padding:2px 6px">✕</button>` : ''}
      </div>
      <div style="padding:24px 18px;color:var(--ink-soft);font-size:13px">
        ${searchTerm ? `No results for "<strong>${SEARCH_CLIENT}</strong>" — try a different name.` : 'No clients match the selected filters.'}
      </div>`;
    const _si = document.getElementById('client-search-input');
    if (_si && SEARCH_CLIENT) { _si.focus(); _si.setSelectionRange(_si.value.length, _si.value.length); }
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
    const priorClientForBrand = (priorMd?.top_clients || []).find(pc => pc.name === c.name);
    const lyClientForBrand    = (lyMd?.top_clients    || []).find(lc => lc.name === c.name);
    const brandRows = hasBrands ? c.brands.map(b => {
      const priorBrand = (priorClientForBrand?.brands || []).find(pb => pb.name === b.name);
      const lyBrand    = (lyClientForBrand?.brands    || []).find(lb => lb.name === b.name);
      const bLmRev     = priorBrand ? r2(priorBrand.del_rev || 0) : 0;
      const bLyRev     = lyBrand    ? r2(lyBrand.del_rev    || 0) : 0;
      const bMomPct    = bLmRev > 0 ? r2(((b.del_rev - bLmRev) / bLmRev) * 100) : null;
      const bLoyPct    = bLyRev > 0 ? r2(((b.del_rev - bLyRev) / bLyRev) * 100) : null;
      const bBooked    = (c.booked_rev != null && c.del_rev > 0 && b.del_rev > 0)
        ? r2(c.booked_rev * (b.del_rev / c.del_rev)) : null;
      return `<tr class="brand-row" id="brands-${i}" style="display:none;background:var(--surface)">
    <td colspan="14" style="padding:5px 12px 5px 44px;border-bottom:1px solid var(--surface-2)">
      <div style="display:flex;align-items:center;gap:14px">
        <span style="font-size:11px;color:var(--ink-soft);min-width:270px">↳ ${b.name}</span>
        <span style="font-family:var(--mono);font-size:11px;font-weight:500;color:var(--ink)">${fmtNum(b.del_rev)} Cr</span>
        ${bBooked != null ? `<span style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">bkd ${fmtNum(bBooked)} Cr</span>` : '<span style="color:var(--ink-faint);font-size:11px">—</span>'}
        ${bMomPct !== null ? `<span style="font-size:10px;color:var(--ink-soft)">vs LM</span>${growthBadge(bMomPct)}` : ''}
        ${bLoyPct !== null ? `<span style="font-size:10px;color:var(--ink-soft)">vs LY</span>${growthBadge(bLoyPct)}` : ''}
      </div>
    </td>
  </tr>`;
    
    }).join('') : '';

    const expandBtn = hasBrands
      ? `<button onclick="toggleBrands(${i},this)" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--accent);padding:0 4px;font-family:var(--mono)">+</button>`
      : '';

    return `<tr>
      <td class="rank">${i+1}</td>
      <td><span style="font-weight:500;cursor:pointer;color:var(--accent);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px" onclick="openClientDive('${c.name.replace(/'/g, "\\'")}')">${c.name}</span>${expandBtn}</td>
      <td><span class="badge badge-blue">${c.bu}</span></td>
      <td style="font-family:var(--mono);font-weight:500;text-align:right">${fmtNum(rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right">${booked != null ? fmtNum(booked) + ' Cr' : '—'}</td>
      <td style="font-size:12px;color:var(--ink-soft)">${c.category||'—'}</td>
<td style="font-size:11px">${lyClientNames.has(c.name) ? '<span style="color:var(--green)">🔄 Retained</span>' : '<span style="color:var(--accent)">🆕 New</span>'}</td>
      <td style="font-size:12px;color:var(--ink-soft)">${c.agency||'—'}</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.video_rev)} Cr</td>
      <td style="font-family:var(--mono);color:var(--ink-soft);text-align:right;font-size:12px">${fmtNum(c.display_rev)} Cr</td>
      <td style="text-align:right;font-size:12px">${(() => {
        if (p === 'Mobile') return '<span style="color:var(--ink-faint)">0%</span>';
        if (p === 'Mobile+CTV') return '<span style="color:var(--ink-faint)">—</span>';
        // Filter-aware CTV numerator: same dimension logic as clientRevForFilters but for CTV slice
        let ctvNum = 0;
        if (f !== 'all') {
          const fk = formatFieldKey(f);
          const base = fk ? fk.replace('_rev','') : null;
          ctvNum = base ? (c[`ctv_${base}_rev`] ?? 0) : 0;
        } else if (a === 'Video')   { ctvNum = c.ctv_video_rev   ?? 0; }
          else if (a === 'Display') { ctvNum = c.ctv_display_rev ?? 0; }
          else                      { ctvNum = c.ctv_rev         ?? 0; }
        const denom = c._filteredRev;
        if (!denom) return '<span style="color:var(--ink-faint)">—</span>';
        const pct = Math.round((ctvNum / denom) * 100);
        if (pct === 0)   return '<span style="color:var(--ink-faint)">0%</span>';
        if (pct === 100) return '<span style="color:var(--green);font-weight:600">100%</span>';
        return `<span style="color:var(--accent);font-weight:500">${pct}%</span>`;
      })()}</td>
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
    <td style="text-align:right;font-family:var(--mono);color:var(--ink-soft)">${totalBooked > 0 ? fmtNum(r2(totalBooked)) + ' Cr' : '—'}</td>
    <td colspan="6"></td>
    <td style="text-align:right;color:var(--ink-soft)">100%</td>
  </tr>`;

  document.getElementById('clients-panel').innerHTML = `
    <div style="padding:10px 18px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
      <span style="font-size:13px;color:var(--ink-soft)">🔍</span>
      <input type="text" id="client-search-input"
        placeholder="Search any client by name..."
        value="${SEARCH_CLIENT.replace(/"/g,'&quot;')}"
        oninput="SEARCH_CLIENT=this.value;renderClients(DATA.months[CURRENT_MONTH])"
        style="flex:1;padding:5px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:inherit;background:var(--surface);color:var(--ink);outline:none"/>
      ${SEARCH_CLIENT ? `<button onclick="SEARCH_CLIENT='';renderClients(DATA.months[CURRENT_MONTH])" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--ink-soft);padding:2px 6px">✕</button>` : ''}
    </div>
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
          <th style="text-align:right;min-width:60px">CTV%</th>
          <th style="text-align:right;min-width:68px">Mobile</th>
          <th style="text-align:right;min-width:68px">Mob+CTV</th>
          <th style="min-width:60px">Health</th>
          <th style="text-align:right;min-width:52px">Share</th>
        </tr></thead>
        <tbody>${rowsHtml}${totalRow}</tbody>
      </table>
    </div>`;

  const _si = document.getElementById('client-search-input');
  if (_si && SEARCH_CLIENT) { _si.focus(); _si.setSelectionRange(_si.value.length, _si.value.length); }
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
// ── Churner Watch (NEW LOGIC) ─────────────────────
// Only looks at LM and LY same month
// Churner = was in LM or LY but missing from current month
function renderChurners() {
  const panel = document.getElementById('churner-panel');
  if (!panel || !DATA || !CURRENT_MONTH) return;

  const md      = DATA.months[CURRENT_MONTH]; if (!md) return;
  const priorMd = DATA.months[AGG_PRIOR_KEY || priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[lyMonthKey(CURRENT_MONTH)]    || null;

  const currentNames = new Set((md.top_clients || []).map(c => c.name));

  const _churnRevForFilters = (c) => {
    const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    if (f !== 'all') { const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null; if (!base) return 0; if (p === 'CTV') return c[`ctv_${base}_rev`]??0; if (p === 'Mobile') return c[`mob_${base}_rev`]??0; if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`]??0; return c[fk]??0; }
    if (a === 'Video')   { if (p === 'CTV') return c.ctv_video_rev??0;   if (p === 'Mobile') return c.mob_video_rev??0;   if (p === 'Mobile+CTV') return c.mobilectv_video_rev??0;   return c.video_rev??0; }
    if (a === 'Display') { if (p === 'CTV') return c.ctv_display_rev??0; if (p === 'Mobile') return c.mob_display_rev??0; if (p === 'Mobile+CTV') return c.mobilectv_display_rev??0; return c.display_rev??0; }
    if (p === 'CTV') return c.ctv_rev??0; if (p === 'Mobile') return c.mobile_rev??0; if (p === 'Mobile+CTV') return c.mobilectv_rev??0;
    return c.del_rev??0;
  };
  // Current month's filter-aware active client set
  const currFilteredRevMap = {};
  (md.top_clients || []).forEach(c => { const rv = _churnRevForFilters(c); if (rv > 0) currFilteredRevMap[c.name] = rv; });

  const buildChurners = (refMd) => {
    if (!refMd) return [];
    return (refMd.top_clients || [])
      .filter(c => _churnRevForFilters(c) >= 0.1)
      .filter(c => !currFilteredRevMap[c.name])
      .filter(c => {
        if (CURRENT_BU !== 'all' && CURRENT_BU !== 'Others' && c.bu !== CURRENT_BU) return false;
        if (CURRENT_BU === 'Others' && MAIN_BUS.includes(c.bu)) return false;
        if (CURRENT_CATEGORY !== 'all' && c.category !== CURRENT_CATEGORY) return false;
        if (CURRENT_AGENCY   !== 'all' && c.agency   !== CURRENT_AGENCY)   return false;
        if (CURRENT_CLIENT   !== 'all' && c.name     !== CURRENT_CLIENT)   return false;
        return true;
      })
      .map(c => {
        const ctvRev  = c.ctv_rev       || 0;
        const mobRev  = c.mobile_rev    || 0;
        const mctvRev = c.mobilectv_rev || 0;
        const platPeak = Math.max(ctvRev, mobRev, mctvRev);
        const platLabel = CURRENT_PLATFORM !== 'all' ? CURRENT_PLATFORM
          : platPeak === 0 ? '—' : platPeak === ctvRev ? 'CTV' : platPeak === mobRev ? 'Mobile' : 'Mobile+CTV';
        return {
          name:     c.name,
          bu:       c.bu       || '—',
          category: c.category || '—',
          agency:   c.agency   || '—',
          lastRev:  r2(_churnRevForFilters(c)),
          lastPlat: platLabel,
        };
      })
      .sort((a, b) => b.lastRev - a.lastRev);
  };

  const lmChurners = buildChurners(priorMd);
  const lyChurners = buildChurners(lyMd);

  const renderChurnerBlock = (churners, title, accentColor, refLabel) => {
    if (!churners.length) return `
      <div style="flex:1;min-width:300px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="padding:12px 14px;background:${accentColor}10;border-bottom:1px solid var(--border)">
          <div style="font-size:11px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.05em">${title}</div>
          <div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:2px">0 churned vs ${refLabel}</div>
        </div>
        <div style="padding:16px;color:var(--ink-soft);font-size:12px">No churned clients vs ${refLabel}.</div>
      </div>`;

    const rowsHtml = churners.map((c, i) => {
      const buCls   = { LCS1:'badge-green', LCS2:'badge-blue', MM1:'badge-amber', MM2:'badge-red' }[c.bu] || 'badge-gray';
      const platCls = c.lastPlat === 'CTV' ? 'badge-green' : c.lastPlat === 'Mobile' ? 'badge-blue' : c.lastPlat === 'Mobile+CTV' ? 'badge-amber' : 'badge-gray';
      return `<tr>
        <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${i+1}</td>
        <td style="font-weight:500;font-size:12px">${c.name}</td>
        <td><span class="badge ${buCls}" style="font-size:9px">${c.bu}</span></td>
        <td style="font-size:12px;color:var(--ink-soft)">${c.category}</td>
        <td style="font-size:12px;color:var(--ink-soft)">${c.agency}</td>
        <td><span class="badge ${platCls}" style="font-size:9px">${c.lastPlat}</span></td>
        <td style="text-align:right;font-family:var(--mono);font-size:11px;font-weight:500">${fmtNum(c.lastRev)} Cr</td>
      </tr>`;
    }).join('');

    return `
      <div style="flex:1;min-width:300px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="padding:12px 14px;background:${accentColor}10;border-bottom:1px solid var(--border)">
          <div style="font-size:11px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.05em">${title}</div>
          <div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:2px">${churners.length} churned vs ${refLabel}</div>
        </div>
        <div style="overflow-x:auto">
          <table class="ptable" style="font-size:12px">
            <thead><tr>
              <th style="min-width:24px">#</th>
              <th>Client</th>
              <th>BU</th>
              <th>Category</th>
              <th>Agency</th>
              <th>Last Platform</th>
              <th style="text-align:right;min-width:70px">Last Rev</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>`;
  };

  panel.innerHTML = `
    <div style="padding:12px 18px;font-size:12px;color:var(--ink-soft);border-bottom:1px solid var(--border)">
      Clients active in <strong style="color:var(--ink)">${priorMd?.label || '—'}</strong> or <strong style="color:var(--ink)">${lyMd?.label || '—'}</strong> but missing in <strong style="color:var(--ink)">${md.label}</strong>
    </div>
    <div style="display:flex;gap:14px;padding:14px;flex-wrap:wrap">
      ${renderChurnerBlock(lmChurners, 'Churned vs Last Month', '#EF4444', priorMd?.label || '—')}
      ${renderChurnerBlock(lyChurners, 'Churned vs Last Year Same Month', '#F59E0B', lyMd?.label || '—')}
    </div>`;
}


// ── New Client Cohort Health (NEW LOGIC) ──────────
// Two cohorts: clients new in LM, clients new in LY same month
// Check if they're still active in current month
function renderCohort() {
  const panel = document.getElementById('cohort-panel');
  if (!panel || !DATA || !CURRENT_MONTH) return;

  const md      = DATA.months[CURRENT_MONTH]; if (!md) return;
  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[lyMonthKey(CURRENT_MONTH)]    || null;

  if (!priorMd && !lyMd) {
    panel.innerHTML = '<div style="padding:20px 18px;color:var(--ink-soft);font-size:13px">No comparison data available.</div>';
    return;
  }

  // New clients = active in current month but NOT in ref month
  const _cohortRevForFilters = (c) => {
    const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    if (f !== 'all') { const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null; if (!base) return 0; if (p === 'CTV') return c[`ctv_${base}_rev`]??0; if (p === 'Mobile') return c[`mob_${base}_rev`]??0; if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`]??0; return c[fk]??0; }
    if (a === 'Video')   { if (p === 'CTV') return c.ctv_video_rev??0;   if (p === 'Mobile') return c.mob_video_rev??0;   if (p === 'Mobile+CTV') return c.mobilectv_video_rev??0;   return c.video_rev??0; }
    if (a === 'Display') { if (p === 'CTV') return c.ctv_display_rev??0; if (p === 'Mobile') return c.mob_display_rev??0; if (p === 'Mobile+CTV') return c.mobilectv_display_rev??0; return c.display_rev??0; }
    if (p === 'CTV') return c.ctv_rev??0; if (p === 'Mobile') return c.mobile_rev??0; if (p === 'Mobile+CTV') return c.mobilectv_rev??0;
    return c.del_rev??0;
  };

  const buildCohort = (refMd) => {
    if (!refMd) return { label: '—', clients: [] };
    // Reference month's filtered revenue map — a client "existed" only if they had revenue in this filter context
    const refFilteredRevMap = {};
    (refMd.top_clients || []).forEach(c => { const rv = _cohortRevForFilters(c); if (rv > 0) refFilteredRevMap[c.name] = rv; });

    // Apply all active filters to current month pool
    let pool = (md.top_clients || []).slice();
    pool = filterClientsByBU(pool, CURRENT_BU);
    if (CURRENT_CATEGORY !== 'all') pool = pool.filter(c => c.category === CURRENT_CATEGORY || (c.category_rev_map && c.category_rev_map[CURRENT_CATEGORY] > 0));
    if (CURRENT_AGENCY   !== 'all') pool = pool.filter(c => c.agency   === CURRENT_AGENCY   || (c.agency_rev_map   && c.agency_rev_map[CURRENT_AGENCY]   > 0));
    if (CURRENT_CLIENT   !== 'all') pool = pool.filter(c => c.name === CURRENT_CLIENT);

    const newClients = pool
      .filter(c => !refFilteredRevMap[c.name] && _cohortRevForFilters(c) >= 0.1)
      .map(c => ({
        name:     c.name,
        bu:       c.bu       || '—',
        category: c.category || '—',
        agency:   c.agency   || '—',
        currRev:  r2(_cohortRevForFilters(c)),
      }))
      .sort((a, b) => b.currRev - a.currRev);
    return { label: refMd.label, clients: newClients };
  };

  const lmCohort = buildCohort(priorMd);
  const lyCohort = buildCohort(lyMd);

  const renderCohortBlock = (cohort, title, accentColor) => {
    const { label, clients } = cohort;
    if (!clients.length) return `
      <div style="flex:1;min-width:300px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="padding:12px 14px;background:${accentColor}10;border-bottom:1px solid var(--border)">
          <div style="font-size:11px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.05em">${title}</div>
          <div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:2px">0 new clients vs ${label}</div>
        </div>
        <div style="padding:16px;color:var(--ink-soft);font-size:12px">No new clients vs ${label}.</div>
      </div>`;

    const rowsHtml = clients.map((c, i) => {
      const buCls = { LCS1:'badge-green', LCS2:'badge-blue', MM1:'badge-amber', MM2:'badge-red' }[c.bu] || 'badge-gray';
      return `<tr>
        <td style="font-family:var(--mono);font-size:11px;color:var(--ink-soft)">${i+1}</td>
        <td style="font-weight:500;font-size:12px">${c.name}</td>
        <td><span class="badge ${buCls}" style="font-size:9px">${c.bu}</span></td>
        <td style="font-size:12px;color:var(--ink-soft)">${c.category}</td>
        <td style="font-size:12px;color:var(--ink-soft)">${c.agency}</td>
        <td style="text-align:right;font-family:var(--mono);font-size:11px;font-weight:500">${fmtNum(c.currRev)} Cr</td>
      </tr>`;
    }).join('');

    return `
      <div style="flex:1;min-width:300px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div style="padding:12px 14px;background:${accentColor}10;border-bottom:1px solid var(--border)">
          <div style="font-size:11px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.05em">${title}</div>
          <div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:2px">${md.label} · ${clients.length} new clients vs ${label}</div>
        </div>
        <div style="overflow-x:auto">
          <table class="ptable" style="font-size:12px">
            <thead><tr>
              <th style="min-width:24px">#</th>
              <th>Client</th>
              <th>BU</th>
              <th>Category</th>
              <th>Agency</th>
              <th style="text-align:right;min-width:70px">Rev</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>`;
  };

  panel.innerHTML = `
    <div style="padding:12px 18px;font-size:12px;color:var(--ink-soft);border-bottom:1px solid var(--border)">
      New clients in <strong style="color:var(--ink)">${md.label}</strong> — who wasn't active in <strong style="color:var(--ink)">${priorMd?.label || '—'}</strong> or <strong style="color:var(--ink)">${lyMd?.label || '—'}</strong>?
    </div>
    <div style="display:flex;gap:14px;padding:14px;flex-wrap:wrap">
      ${renderCohortBlock(lmCohort, 'New vs Last Month', '#3B82F6')}
      ${renderCohortBlock(lyCohort, 'New vs Last Year Same Month', '#8B5CF6')}
    </div>`;
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
  // Helper: get filter-aware revenue for a client in openClientDive
  const _diveClientRev = (c) => {
    if (!c) return 0;
    const p = CURRENT_PLATFORM, a = CURRENT_ADTYPE, f = CURRENT_FORMAT;
    const _vBs = ['preroll','midroll','integ','spots'];
    const _dBs = ['billboard','breakout','pause','frames','fence','untagged'];
    if (f !== 'all') {
      const fk = formatFieldKey(f); const base = fk ? fk.replace('_rev','') : null;
      if (!base) return 0;
      if (a === 'Display' && _vBs.includes(base)) return 0;
      if (a === 'Video'   && _dBs.includes(base)) return 0;
      if (p === 'CTV')        return c[`ctv_${base}_rev`]  ?? 0;
      if (p === 'Mobile')     return c[`mob_${base}_rev`]  ?? 0;
      if (p === 'Mobile+CTV') return c[`mctv_${base}_rev`] ?? 0;
      return c[fk] ?? 0;
    }
    if (a === 'Video') { if (p==='CTV') return c.ctv_video_rev??0; if (p==='Mobile') return c.mob_video_rev??0; if (p==='Mobile+CTV') return c.mobilectv_video_rev??0; return c.video_rev??0; }
    if (a === 'Display') { if (p==='CTV') return c.ctv_display_rev??0; if (p==='Mobile') return c.mob_display_rev??0; if (p==='Mobile+CTV') return c.mobilectv_display_rev??0; return c.display_rev??0; }
    if (p === 'CTV')        return c.ctv_rev        ?? 0;
    if (p === 'Mobile')     return c.mobile_rev     ?? 0;
    if (p === 'Mobile+CTV') return c.mobilectv_rev  ?? 0;
    return c.del_rev ?? 0;
  };

  DATA.available_months.forEach(mkey => {
    const mdata = DATA.months[mkey];
    if (!mdata) return;
    const client = (mdata.top_clients || []).find(c => c.name === clientName);
    const filtRev = _diveClientRev(client);
    history.push({
      mkey,
      label:      mdata.label || mkey,
      del_rev:    filtRev,
      ctv_rev:    client ? r2(client.ctv_rev    || 0) : 0,
      mobile_rev: client ? r2(client.mobile_rev || 0) : 0,
      video_rev:  client ? r2(client.video_rev  || 0) : 0,
      display_rev:client ? r2(client.display_rev|| 0) : 0,
      booked_rev: client && client.booked_rev != null
        ? r2(client.booked_rev * (client.del_rev > 0 ? filtRev / client.del_rev : 1))
        : null,
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
  _diveHistory = history;
  DIVE_FROM = history[0]?.mkey || null;
  DIVE_TO   = history[history.length - 1]?.mkey || null;

  // Inject range picker before the canvas (idempotent — reuses existing div on reopen)
  const _canvas = document.getElementById('dive-chart');
  if (_canvas && _canvas.parentElement) {
    let _picker = _canvas.parentElement.querySelector('.dive-range-picker');
    if (!_picker) {
      _picker = document.createElement('div');
      _picker.className = 'dive-range-picker';
      _canvas.parentElement.insertBefore(_picker, _canvas);
    }
    const _opts = history.map(h => `<option value="${h.mkey}">${h.label}</option>`).join('');
    _picker.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0 6px;flex-wrap:wrap">
        <span style="font-size:11px;color:var(--ink-soft);font-weight:500">Show range:</span>
        <select id="dive-from-sel" onchange="DIVE_FROM=this.value;_renderDiveChart()"
          style="font-size:11px;padding:3px 7px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--ink);font-family:inherit;cursor:pointer">${_opts}</select>
        <span style="font-size:11px;color:var(--ink-soft)">→</span>
        <select id="dive-to-sel" onchange="DIVE_TO=this.value;_renderDiveChart()"
          style="font-size:11px;padding:3px 7px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--ink);font-family:inherit;cursor:pointer">${_opts}</select>
      </div>`;
    document.getElementById('dive-from-sel').value = DIVE_FROM;
    document.getElementById('dive-to-sel').value   = DIVE_TO;
  }

  // ── Stats row ─────────────────────────────────────
  document.getElementById('dive-stats').innerHTML = [
    { label: 'This Month',     val: fmtNum(currentEntry.del_rev || 0) + ' Cr', sub: 'Delivered revenue',      id: ''                 },
    { label: 'This Period',    val: '—',                                         sub: 'Sum of selected range', id: 'dive-stat-period' },
    { label: 'Peak Month',     val: fmtNum(peakEntry.del_rev || 0) + ' Cr',   sub: peakEntry.label || '—',   id: ''                 },
    { label: 'Avg Monthly',    val: fmtNum(avgRev) + ' Cr',                    sub: activeMonths.length + ' active months', id: '' },
    { label: 'First Appeared', val: firstEntry.label ? (firstEntry.mkey === DATA.available_months[0] ? firstEntry.label + ' <span style="opacity:0.55;font-size:0.82em;font-family:var(--font);font-weight:400">(earlier)</span>' : firstEntry.label) : '—', sub: firstEntry.mkey === DATA.available_months[0] ? "Data starts Apr '24 — client may be older" : 'Earliest month on record', id: '' },
  ].map(s => `
    <div class="dive-stat"${s.id ? ` id="${s.id}"` : ''}>
      <div class="dive-stat-label">${s.label}</div>
      <div class="dive-stat-val">${s.val}</div>
      <div class="dive-stat-sub">${s.sub}</div>
    </div>`
  ).join('');

  // ── Revenue mix bars + period stat — handled by _renderDiveChart ──────
  _renderDiveChart();

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

function _renderDiveChart() {
  const from = DIVE_FROM || _diveHistory[0]?.mkey;
  const to   = DIVE_TO   || _diveHistory[_diveHistory.length - 1]?.mkey;
  const filtered = _diveHistory.filter(h => h.mkey >= from && h.mkey <= to);
  if (!filtered.length) return;

  const currentIdx  = filtered.findIndex(h => h.mkey === CURRENT_MONTH);
  const pointColors = filtered.map((h, i) =>
    i === currentIdx ? '#3B82F6' : h.del_rev > 0 ? 'rgba(59,130,246,0.5)' : 'rgba(203,213,225,0.3)'
  );
  const pointSizes  = filtered.map((h, i) => i === currentIdx ? 5 : h.del_rev > 0 ? 3 : 0);

  if (diveChart) diveChart.destroy();
  const ctx = document.getElementById('dive-chart')?.getContext('2d');
  if (!ctx) return;
  diveChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels:   filtered.map(h => h.label),
      datasets: [{
        data:                filtered.map(h => h.del_rev),
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
        callbacks: { label: c => fmtNum(c.raw) + ' Cr' }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45, maxTicksLimit: 10 } },
        y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, callback: v => v + ' Cr' } }
      }
    }
  });

  // ── Update "This Period" stat card ────────────────────
  const periodRev = r2(filtered.reduce((t, h) => t + h.del_rev, 0));
  const periodEl  = document.getElementById('dive-stat-period');
  if (periodEl) {
    periodEl.querySelector('.dive-stat-val').textContent = fmtNum(periodRev) + ' Cr';
    const fromLbl = filtered[0]?.label || '';
    const toLbl   = filtered[filtered.length - 1]?.label || '';
    periodEl.querySelector('.dive-stat-sub').textContent =
      filtered.length === 1 ? fromLbl : fromLbl + ' → ' + toLbl;
  }

  // ── Update revenue mix bars for selected period ────────
  const mixEl = document.getElementById('dive-mix');
  if (mixEl) {
    const pCTV     = r2(filtered.reduce((t, h) => t + (h.ctv_rev     || 0), 0));
    const pMobile  = r2(filtered.reduce((t, h) => t + (h.mobile_rev  || 0), 0));
    const pVideo   = r2(filtered.reduce((t, h) => t + (h.video_rev   || 0), 0));
    const pDisplay = r2(filtered.reduce((t, h) => t + (h.display_rev || 0), 0));
    const platTotal = (pCTV + pMobile)   || 1;
    const adTotal   = (pVideo + pDisplay) || 1;
    mixEl.innerHTML = [
      { label: 'CTV',     val: pCTV,     total: platTotal, color: '#10B981' },
      { label: 'Mobile',  val: pMobile,  total: platTotal, color: '#3B82F6' },
      { label: 'Video',   val: pVideo,   total: adTotal,   color: '#8B5CF6' },
      { label: 'Display', val: pDisplay, total: adTotal,   color: '#F59E0B' },
    ].map(m => {
      const pct = Math.round((m.val / m.total) * 100);
      return `<div class="mix-row">
        <div class="mix-label">${m.label}</div>
        <div class="mix-bar-bg"><div class="mix-bar-fill" style="width:${pct}%;background:${m.color}"></div></div>
        <div class="mix-val">${fmtNum(m.val)} Cr</div>
      </div>`;
    }).join('');
  }
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
    return bu + ': Del Rev ' + fmtNum(b.del_rev) + ' Cr, Booked ' + (b.booked_rev != null ? fmtNum(b.booked_rev) + ' Cr' : '—') + ', Clients ' + (b.clients||0) + ', vs LM ' + (b.growth_vs_lm ?? '—') + '%, vs LY ' + (b.growth_vs_ly ?? '—') + '%';
  }).join('\n');

  // Platform summary — full comparative
  const platSummary = ['CTV','Mobile','Mobile+CTV'].map(function(p) {
    const pl = md.platform[p] || {};
    return p + ': Del Rev ' + fmtNum(pl.del_rev) + ' Cr, Booked ' + (pl.booked_rev != null ? fmtNum(pl.booked_rev) + ' Cr' : '—') + ', Clients ' + (pl.clients||0) + ', vs LM ' + (pl.growth_vs_lm ?? '—') + '%, vs LY ' + (pl.growth_vs_ly ?? '—') + '%';
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
    'Video: Del Rev ' + fmtNum(videoData.del_rev) + ' Cr, Booked ' + (videoData.booked_rev != null ? fmtNum(videoData.booked_rev) + ' Cr' : '—') + ', vs LM ' + (vMom ?? '—') + '%, vs LY ' + (vLy ?? '—') + '%\n' +
    'Display: Del Rev ' + fmtNum(displayData.del_rev) + ' Cr, Booked ' + (displayData.booked_rev != null ? fmtNum(displayData.booked_rev) + ' Cr' : '—') + ', vs LM ' + (dMom ?? '—') + '%, vs LY ' + (dLy ?? '—') + '%';

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
    return (i+1) + '. ' + c.name + ' (' + c.bu + ') — Del Rev ' + fmtNum(c.del_rev) + ' Cr, Booked ' + (c.booked_rev != null ? fmtNum(c.booked_rev) + ' Cr' : '—') + ', vs LM: ' + (momPct !== null ? (momPct > 0 ? '+' : '') + momPct + '%' : '—') + ', Category: ' + (c.category||'—') + ', Agency: ' + (c.agency||'—');
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
    ? r2(['LCS1','LCS2','MM1','MM2'].reduce((t, bu) => t + (nextMd.bu[bu] && nextMd.bu[bu].booked_rev != null ? nextMd.bu[bu].booked_rev : 0), 0))
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
      let text = td.innerText || td.textContent || '';
      text = text.replace(/\s*Cr\s*/g, '').replace(/[↑↓→]/g, '')
                 .replace(/\+/g, '').replace(/\n/g, ' ').trim();
      cells.push(text);
    });
    if (cells.some(c => c !== '')) rows.push(cells);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const monthLabel = CURRENT_MONTH && DATA.months[CURRENT_MONTH]
    ? DATA.months[CURRENT_MONTH].label : '';
  const sheetName = (filename || panelId).slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const fname = (filename || panelId) + (monthLabel ? '_' + monthLabel : '') + '.xlsx';
  XLSX.writeFile(wb, fname);

  const btn = document.querySelector(`[data-export="${panelId}"]`);
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Downloaded!';
    btn.style.background = 'var(--green)';
    btn.style.color = 'white';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = ''; }, 2000);
  }
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
// ── Active Filter Pill Bar ────────────────────────
function renderPillBar() {
  const bar      = document.getElementById('pill-bar');
  const pillList = document.getElementById('pill-list');
  if (!bar || !pillList) return;

  const activeFilters = [
    { key: 'bu',       val: CURRENT_BU,       label: CURRENT_BU,       setter: () => { CURRENT_BU='all';       document.getElementById('bu-select').value='all'; } },
    { key: 'platform', val: CURRENT_PLATFORM, label: CURRENT_PLATFORM, setter: () => { CURRENT_PLATFORM='all'; document.getElementById('platform-select').value='all'; } },
    { key: 'adtype',   val: CURRENT_ADTYPE,   label: CURRENT_ADTYPE,   setter: () => { CURRENT_ADTYPE='all';   document.getElementById('adtype-select').value='all'; } },
    { key: 'format',   val: CURRENT_FORMAT,   label: CURRENT_FORMAT,   setter: () => { CURRENT_FORMAT='all';   document.getElementById('format-select').value='all'; } },
    { key: 'category', val: CURRENT_CATEGORY, label: CURRENT_CATEGORY, setter: () => { CURRENT_CATEGORY='all'; document.getElementById('category-select').value='all'; } },
    { key: 'agency',   val: CURRENT_AGENCY,   label: CURRENT_AGENCY,   setter: () => { CURRENT_AGENCY='all';   document.getElementById('agency-select').value='all'; } },
    { key: 'client',   val: CURRENT_CLIENT,   label: '👤 ' + CURRENT_CLIENT, setter: () => { CURRENT_CLIENT='all'; const _pi=document.getElementById('client-filter-input'); if(_pi) _pi.value=''; const _pc=document.getElementById('client-filter-clear'); if(_pc) _pc.style.display='none'; } },
  ].filter(f => f.val !== 'all');

  if (!activeFilters.length) {
    bar.style.display = 'none';
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    return;
  }

  bar.style.display = 'flex';
  pillList.innerHTML = activeFilters.map((f, i) =>
    `<span style="
      display:inline-flex;align-items:center;gap:5px;
      font-size:11px;font-weight:500;
      padding:3px 10px;border-radius:20px;
      background:var(--accent-soft);color:var(--accent);
      border:1px solid rgba(59,130,246,0.25);cursor:pointer;
    " onclick="removePill(${i})">${f.label} <span style="font-size:10px;opacity:.6">×</span></span>`
  ).join('');

  // Store setters for onclick use
  window._pillSetters = activeFilters.map(f => f.setter);
}

function removePill(i) {
  window._pillSetters[i]();
  renderAll();
}

function clearAllFilters() {
  CURRENT_BU='all'; CURRENT_PLATFORM='all'; CURRENT_ADTYPE='all';
  CURRENT_FORMAT='all'; CURRENT_CATEGORY='all'; CURRENT_AGENCY='all';
  ['bu','platform','adtype','format','category','agency'].forEach(id => {
    document.getElementById(id+'-select').value = 'all';
  });
  renderAll();
}
function setClientFilter(name) {
  CURRENT_CLIENT = (CURRENT_CLIENT === name) ? 'all' : name;
  SEARCH_CLIENT  = '';
  renderAll();
}

function populateClientDatalist() {
  const list = document.getElementById('client-filter-datalist');
  if (!list || !DATA) return;
  const seen = new Set();
  DATA.available_months.forEach(mkey => {
    (DATA.months[mkey]?.top_clients || []).forEach(c => { if (c.name) seen.add(c.name); });
  });
  list.innerHTML = [...seen].sort()
    .map(name => `<option value="${name.replace(/"/g,'&quot;')}"></option>`).join('');
}

function handleClientFilterInput(val) {
  const clearBtn = document.getElementById('client-filter-clear');
  if (!val.trim()) {
    CURRENT_CLIENT = 'all';
    if (clearBtn) clearBtn.style.display = 'none';
    renderAll(); return;
  }
  if (clearBtn) clearBtn.style.display = 'block';
  const list = document.getElementById('client-filter-datalist');
  const options = list ? Array.from(list.options).map(o => o.value) : [];
  if (options.includes(val.trim())) { CURRENT_CLIENT = val.trim(); renderAll(); }
}

function clearClientFilter() {
  CURRENT_CLIENT = 'all';
  const input = document.getElementById('client-filter-input');
  if (input) input.value = '';
  const btn = document.getElementById('client-filter-clear');
  if (btn) btn.style.display = 'none';
  renderAll();
}

function applyPreset(filterType, value) {
  // If already active — toggle off
  const isActive =
    (filterType === 'bu'       && CURRENT_BU       === value) ||
    (filterType === 'platform' && CURRENT_PLATFORM === value) ||
    (filterType === 'adtype'   && CURRENT_ADTYPE   === value);

  // Reset all first for clean state
  CURRENT_BU='all'; CURRENT_PLATFORM='all'; CURRENT_ADTYPE='all';
  CURRENT_FORMAT='all'; CURRENT_CATEGORY='all'; CURRENT_AGENCY='all'; CURRENT_CLIENT='all';
  const _ca1=document.getElementById('client-filter-input'); if(_ca1) _ca1.value='';
  const _ca2=document.getElementById('client-filter-clear'); if(_ca2) _ca2.style.display='none';
  ['bu','platform','adtype','format','category','agency'].forEach(id => {
    document.getElementById(id+'-select').value = 'all';
  });

  // Apply the chosen preset (unless toggling off)
  if (!isActive) {
    if (filterType === 'bu') {
      CURRENT_BU = value;
      document.getElementById('bu-select').value = value;
    } else if (filterType === 'platform') {
      CURRENT_PLATFORM = value;
      document.getElementById('platform-select').value = value;
    } else if (filterType === 'adtype') {
      CURRENT_ADTYPE = value;
      document.getElementById('adtype-select').value = value;
    }
  }

  // Update active state on buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (!isActive) {
    event.target.classList.add('active');
  }

  renderAll();
}
// ── Section header badges ─────────────────────────
function renderSectionBadges() {
  const md      = DATA?.months[CURRENT_MONTH]; if (!md) return;
  const priorMd = DATA.months[priorMonthKey(CURRENT_MONTH)] || null;
  const lyMd    = DATA.months[lyMonthKey(CURRENT_MONTH)]    || null;

  const badge = (text, color) =>
    `<span class="sec-badge" style="background:${color}18;color:${color};border:1px solid ${color}30">${text}</span>`;

  // ── Revenue Split ─────────────────────────────────
  const topBU = ['LCS1','LCS2','MM1','MM2']
    .map(b => ({ name: b, rev: md.bu[b] ? md.bu[b].del_rev : 0 }))
    .sort((a,b) => b.rev - a.rev)[0];
  const revBadges = document.getElementById('badges-revenue');
  if (revBadges && topBU) {
    const momPct = md.vs_prior_month?.change_pct;
    const momCol = momPct == null ? '#64748B' : momPct >= 0 ? '#10B981' : '#EF4444';
    const momTxt = momPct == null ? '' : ` · ${momPct >= 0 ? '+' : ''}${momPct}% vs LM`;
    revBadges.innerHTML =
      badge(`${topBU.name} leads · ${fmtNum(topBU.rev)} Cr`, '#3B82F6') +
      badge(`${fmtNum(md.total_del_rev)} Cr total${momTxt}`, momCol);
  }

  // ── Categories ────────────────────────────────────
  const topCat   = (md.categories || [])[0];
  const catBadges = document.getElementById('badges-categories');
  if (catBadges && topCat) {
    const priorCat  = (priorMd?.categories || []).find(c => c.name === topCat.name);
    const bigMover  = (md.categories || []).reduce((best, cat) => {
      const prior = (priorMd?.categories || []).find(c => c.name === cat.name);
      if (!prior || prior.del_rev <= 0) return best;
      const pct = ((cat.del_rev - prior.del_rev) / prior.del_rev) * 100;
      return Math.abs(pct) > Math.abs(best.pct || 0) ? { name: cat.name, pct: r2(pct) } : best;
    }, {});
    const moverCol  = bigMover.pct > 0 ? '#10B981' : '#EF4444';
    const moverTxt  = bigMover.name
      ? `${bigMover.name} ${bigMover.pct > 0 ? '↑' : '↓'} ${Math.abs(bigMover.pct)}%`
      : 'No prior data';
    catBadges.innerHTML =
      badge(`${topCat.name} · ${fmtNum(topCat.del_rev)} Cr`, '#10B981') +
      badge(moverTxt, moverCol);
  }

  // ── Clients ───────────────────────────────────────
  const lyClientNames   = new Set((lyMd?.top_clients || []).map(c => c.name));
  const newClientsCount = (md.top_clients || []).filter(c => !lyClientNames.has(c.name)).length;
  const cliBadges = document.getElementById('badges-clients');
  if (cliBadges) {
    cliBadges.innerHTML =
      badge(`${fmtInt(md.total_clients)} active clients`, '#8B5CF6') +
      badge(`${newClientsCount} new vs last year`, '#3B82F6');
  }

  // ── Watch List ────────────────────────────────────
  if (VIEW_MODE !== 'monthly') {
    const wb = document.getElementById('badges-watchlist');
    if (wb) wb.innerHTML = badge('Switch to Monthly for churn data', '#64748B');
    return;
  }
  const currentNames = new Set((md.top_clients || []).map(c => c.name));
  let redChurners = 0, amberChurners = 0;
  const seenChurners = new Set();
  DATA.available_months.forEach(mkey => {
    if (mkey >= CURRENT_MONTH) return;
    const gone  = monthDiff(mkey, CURRENT_MONTH);
    if (gone > 12) return;
    const mdata = DATA.months[mkey]; if (!mdata) return;
    (mdata.top_clients || []).forEach(c => {
      if (currentNames.has(c.name) || seenChurners.has(c.name)) return;
      seenChurners.add(c.name);
      if (gone <= 2)      redChurners++;
      else if (gone <= 6) amberChurners++;
    });
  });

  // Cohort retention rate
  const cohortMKey = (() => {
    let y = parseInt(CURRENT_MONTH.slice(0,4));
    let m = parseInt(CURRENT_MONTH.slice(5,7)) - 12;
    while (m < 1) { m += 12; y--; }
    return y + '-' + String(m).padStart(2,'0');
  })();
  const cohortMd   = DATA.months[cohortMKey];
  const priorNames = new Set();
  DATA.available_months.filter(k => k < cohortMKey).forEach(k => {
    (DATA.months[k]?.top_clients || []).forEach(c => priorNames.add(c.name));
  });
  const cohortClients  = cohortMd
    ? (cohortMd.top_clients || []).filter(c => !priorNames.has(c.name))
    : [];
  const retainedCount  = cohortClients.filter(c => currentNames.has(c.name)).length;
  const retentionRate  = cohortClients.length > 0
    ? Math.round((retainedCount / cohortClients.length) * 100) : null;

  const watchBadges = document.getElementById('badges-watchlist');
  if (watchBadges) {
    const churnerCol = redChurners > 0 ? '#EF4444' : amberChurners > 0 ? '#F59E0B' : '#10B981';
    const churnerTxt = redChurners > 0
      ? `${redChurners} critical churner${redChurners > 1 ? 's' : ''}`
      : amberChurners > 0
        ? `${amberChurners} at-risk churner${amberChurners > 1 ? 's' : ''}`
        : 'No critical churners';
    const retTxt = retentionRate !== null ? `${retentionRate}% cohort retention` : 'Cohort data loading';
    const retCol = retentionRate === null ? '#64748B' : retentionRate >= 60 ? '#10B981' : retentionRate >= 40 ? '#F59E0B' : '#EF4444';
    watchBadges.innerHTML =
      badge(churnerTxt, churnerCol) +
      badge(retTxt, retCol);
  }
}
// ── Section nav + collapse ────────────────────────
function toggleSec(secId) {
  const body = document.getElementById('body-' + secId);
  const chev = document.getElementById('chev-' + secId);
  if (!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  chev.classList.toggle('open', !isOpen);
}

function jumpToSection(secId, btn) {
  // Update nav active state
  document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Open that section
  const body = document.getElementById('body-' + secId);
  const chev = document.getElementById('chev-' + secId);
  if (body && !body.classList.contains('open')) {
    body.classList.add('open');
    chev.classList.add('open');
  }
  // Scroll to it
  const block = document.getElementById(secId);
  if (block) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// ── Section nav scroll spy ────────────────────────
function initScrollSpy() {
  const sections = ['sec-revenue','sec-categories','sec-clients','sec-watchlist'];
  const buttons  = document.querySelectorAll('.snav-btn');
  const main     = document.querySelector('.main');
  if (!main) return;

  main.addEventListener('scroll', () => {
    let activeIdx = 0;
    sections.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top <= 160) activeIdx = i;
    });
    buttons.forEach((b, i) => b.classList.toggle('active', i === activeIdx));
  }, { passive: true });
}
// ── Formatters ────────────────────────────────────
function fmtNum(n){const v=Number(n)||0; return v.toFixed(1);}
function fmtInt(n){return Math.round(Number(n)||0).toLocaleString('en-IN');}
function r2(n) { return Math.round((Number(n)||0)*100)/100; }
function priorMonthKey(yyyymm) {
  if (AGG_PRIOR_KEY && yyyymm === '__AGG_CURR__') return AGG_PRIOR_KEY;
  const y0 = parseInt(yyyymm.slice(0,4)), m0 = parseInt(yyyymm.slice(5,7));
  if (isNaN(y0) || isNaN(m0)) return yyyymm;
  let y = y0, m = m0 - 1;
  if (m < 1) { m = 12; y--; }
  return y + '-' + String(m).padStart(2,'0');
}
function lyMonthKey(yyyymm) {
  if (AGG_LY_KEY && yyyymm === '__AGG_CURR__') return AGG_LY_KEY;
  const y = parseInt(yyyymm.slice(0,4));
  if (isNaN(y)) return yyyymm;
  return (y - 1) + '-' + yyyymm.slice(5,7);
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
