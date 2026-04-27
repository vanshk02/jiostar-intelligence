// ============================================================
//   JIOSTAR INTELLIGENCE — ui.js  v6
//   Bar = CSS gradient on row background. No z-index issues.
// ============================================================

let DATA = null;
let CURRENT_MONTH    = null;
let CURRENT_BU       = 'all';
let CURRENT_PLATFORM = 'all';
let CURRENT_ADTYPE   = 'all';
let CURRENT_FORMAT   = 'all';
let CURRENT_CATEGORY = 'all';
let CURRENT_AGENCY   = 'all';

const BAR_COLOR = 'rgba(59,130,246,0.10)';

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
  } catch (e) {
    document.getElementById('freshness-dot').className = 'freshness-dot error';
    document.getElementById('freshness-label').textContent = 'Data load failed';
    document.getElementById('page-title').textContent = 'Error loading data';
    document.getElementById('page-sub').textContent = 'Check that data/summary.json is in the data/ folder';
    console.error(e);
  }
}

// ── Dropdowns ─────────────────────────────────────
function populateMonthDropdown() {
  const sel = document.getElementById('month-select');
  sel.innerHTML = '';
  DATA.available_months.slice().reverse().forEach(m => {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = DATA.months[m] ? DATA.months[m].label : m;
    sel.appendChild(o);
  });
}

function populateCategoryDropdown() {
  const md = DATA.months[CURRENT_MONTH]; if (!md) return;
  const sel = document.getElementById('category-select');
  while (sel.options.length > 1) sel.remove(1);
  (md.categories||[]).forEach(c => {
    const o = document.createElement('option'); o.value = c.name; o.textContent = c.name; sel.appendChild(o);
  });
}

function populateAgencyDropdown() {
  const md = DATA.months[CURRENT_MONTH]; if (!md) return;
  const sel = document.getElementById('agency-select');
  while (sel.options.length > 1) sel.remove(1);
  (md.agencies||[]).forEach(a => {
    const o = document.createElement('option'); o.value = a.name; o.textContent = a.name; sel.appendChild(o);
  });
}

function attachListeners() {
  document.getElementById('month-select').addEventListener('change', e => {
    CURRENT_MONTH = e.target.value;
    CURRENT_CATEGORY = 'all'; CURRENT_AGENCY = 'all';
    document.getElementById('category-select').value = 'all';
    document.getElementById('agency-select').value = 'all';
    populateCategoryDropdown(); populateAgencyDropdown(); renderAll();
  });
  ['bu','platform','adtype','format','category','agency'].forEach(id => {
    document.getElementById(id + '-select').addEventListener('change', e => {
      if (id === 'bu')       CURRENT_BU       = e.target.value;
      if (id === 'platform') CURRENT_PLATFORM = e.target.value;
      if (id === 'adtype')   { CURRENT_ADTYPE = e.target.value; CURRENT_FORMAT = 'all'; document.getElementById('format-select').value = 'all'; }
      if (id === 'format')   CURRENT_FORMAT   = e.target.value;
      if (id === 'category') CURRENT_CATEGORY = e.target.value;
      if (id === 'agency')   CURRENT_AGENCY   = e.target.value;
      renderAll();
    });
  });
}

// ── Render all ────────────────────────────────────
function renderAll() {
  const md = DATA.months[CURRENT_MONTH]; if (!md) return;
  renderHeader(md); renderKPIs(md);
  renderBU(md); renderPlatform(md); renderAdType(md);
  renderCategories(md); renderAgencies(md); renderClients(md);
}

// ── Header ────────────────────────────────────────
function renderHeader(md) {
  document.getElementById('page-title').textContent = md.label;
  document.getElementById('page-sub').textContent   = 'Revenue Intelligence · JioStar';
  let meta = fmtInt(md.total_clients) + ' active clients';
  if (md.vs_prior_month && md.vs_prior_month.change_pct !== null) {
    const p = md.vs_prior_month.change_pct;
    meta += '  ·  ' + (p >= 0 ? '+' : '') + p + '% vs ' + md.vs_prior_month.label;
  }
  document.getElementById('topbar-meta').textContent = meta;
}

// ── KPI Cards ─────────────────────────────────────
function renderKPIs(md) {
  const momC = md.vs_prior_month && md.vs_prior_month.change_pct !== null
    ? { pct: md.vs_prior_month.change_pct, label: 'vs ' + md.vs_prior_month.label } : null;
  const lyC  = md.vs_last_year  && md.vs_last_year.change_pct   !== null
    ? { pct: md.vs_last_year.change_pct,   label: 'vs ' + md.vs_last_year.label   } : null;
  const vPct = md.total_del_rev > 0 ? Math.round((md.ad_type.Video.del_rev / md.total_del_rev) * 100) : 0;
  const topBU = ['LCS1','LCS2','MM1','MM2']
    .map(b => ({ name: b, rev: md.bu[b] ? md.bu[b].del_rev : 0 }))
    .sort((a,b) => b.rev - a.rev)[0];
  document.getElementById('kpi-row').innerHTML = [
    kpiCard('Total Del Rev',  md.total_del_rev, 'Cr', momC),
    kpiCard('Active Clients', md.total_clients, '',   lyC),
    kpiCard('Video Share',    vPct,             '%',  null, 'of total revenue'),
    kpiCard('Top BU',         topBU.rev,        'Cr', null, topBU.name + ' leading'),
  ].join('');
}

function kpiCard(label, val, unit, ch, note) {
  let c = '';
  if (ch) {
    const cls = ch.pct > 0 ? 'up' : ch.pct < 0 ? 'down' : 'flat';
    const arr = ch.pct > 0 ? '↑' : ch.pct < 0 ? '↓' : '→';
    c = `<div class="kpi-change ${cls}">${arr} ${ch.pct > 0 ? '+' : ''}${Math.abs(ch.pct)}% <span style="color:var(--ink-soft);font-size:11px">${ch.label}</span></div>`;
  } else if (note) { c = `<div class="kpi-change flat">${note}</div>`; }
  return `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value">${unit===''?fmtInt(val):fmtNum(val)}<span class="kpi-unit"> ${unit}</span></div>${c}</div>`;
}

// ── Core row builder ──────────────────────────────
// Bar is a CSS linear-gradient on the row background.
// No absolute positioning. No z-index. Content never obscured.
function row(barPct, dimmed, cells) {
  const bg = barPct > 0
    ? `background:linear-gradient(to right,${BAR_COLOR} ${barPct}%,transparent ${barPct}%);`
    : '';
  const opacity = dimmed ? 'opacity:0.3;' : '';
  return `<div style="display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--surface-2);${bg}${opacity}">
    ${cells}
  </div>`;
}

function subRow(dimmed, cells) {
  const opacity = dimmed ? 'opacity:0.3;' : '';
  return `<div style="display:flex;align-items:center;gap:8px;padding:7px 14px 7px 30px;border-bottom:1px solid var(--surface-2);${opacity}">
    ${cells}
  </div>`;
}

// Cell helpers — each returns an inline-styled span
const S = {
  name:  t => `<span style="flex:1;min-width:0;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)">${t}</span>`,
  sub:   t => `<span style="flex:1;min-width:0;font-size:12px;color:var(--ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t}</span>`,
  rev:   t => `<span style="flex-shrink:0;font-family:var(--mono);font-size:12px;font-weight:500;white-space:nowrap;min-width:76px;text-align:right;color:var(--ink)">${t} Cr</span>`,
  pct:   t => `<span style="flex-shrink:0;font-size:11px;color:var(--ink-soft);white-space:nowrap;min-width:34px;text-align:right">${t}%</span>`,
  info:  t => `<span style="flex-shrink:0;font-size:11px;color:var(--ink-soft);white-space:nowrap;min-width:52px;text-align:right">${t}</span>`,
  num:   t => `<span style="flex-shrink:0;font-family:var(--mono);font-size:11px;color:var(--ink-soft);min-width:18px">${t}</span>`,
  badge: (t, cls, w) => `<span class="badge ${cls}" style="flex-shrink:0;min-width:${w||'44px'};text-align:center">${t}</span>`,
};

// ── BU Breakdown ──────────────────────────────────
function renderBU(md) {
  const buList = ['LCS1','LCS2','MM1','MM2','Others'];
  const total  = md.total_del_rev || 1;
  document.getElementById('bu-panel').innerHTML = buList.map(bu => {
    const b      = md.bu[bu] || {};
    const rev    = b.del_rev || 0;
    const pct    = Math.round((rev / total) * 100);
    const vShare = rev > 0 ? Math.round(((b.video_rev||0) / rev) * 100) : 0;
    const active = CURRENT_BU === 'all' || CURRENT_BU === bu;
    const cls    = CURRENT_BU === bu ? 'badge-green' : 'badge-blue';
    return row(pct, !active,
      S.badge(bu, cls, '48px') +
      S.sub((b.clients||0) + ' clients') +
      S.rev(fmtNum(rev)) +
      S.info(vShare + '% Vid') +
      S.pct(pct)
    );
  }).join('');
}

// ── Platform Split ────────────────────────────────
function renderPlatform(md) {
  const total  = md.total_del_rev || 1;
  const clsMap = { CTV:'badge-green', Mobile:'badge-blue', 'Mobile+CTV':'badge-amber' };
  document.getElementById('platform-panel').innerHTML = ['CTV','Mobile','Mobile+CTV'].map(p => {
    const pl   = md.platform[p] || {};
    const rev  = pl.del_rev || 0;
    const pct  = Math.round((rev / total) * 100);
    const active = CURRENT_PLATFORM === 'all' || CURRENT_PLATFORM === p;
    const cls  = CURRENT_PLATFORM === p ? 'badge-green' : clsMap[p];
    return row(pct, !active,
      S.badge(p, cls, '78px') +
      S.sub((pl.clients||0) + ' clients') +
      S.rev(fmtNum(rev)) +
      S.pct(pct)
    );
  }).join('');
}

// ── Ad Type ───────────────────────────────────────
function renderAdType(md) {
  const total    = md.total_del_rev || 1;
  const vFormats = ['Preroll','Midroll','Integration','Spots'];
  const dFormats = ['Billboard','Breakout Billboard','Pause Ads','Display and Frames','Fence Ads','Untagged'];

  const typeRow = (name, data, cls) => {
    const rev    = data.del_rev || 0;
    const pct    = Math.round((rev / total) * 100);
    const fmts   = Object.values(data.formats||{}).filter(v => v > 0).length;
    const active = CURRENT_ADTYPE === 'all' || CURRENT_ADTYPE === name;
    const bCls   = CURRENT_ADTYPE === name ? 'badge-green' : cls;
    return row(pct, !active,
      S.badge(name, bCls, '58px') +
      S.sub(fmts + ' formats') +
      S.rev(fmtNum(rev)) +
      S.pct(pct)
    );
  };

  const fmtRow = (name, rev) => {
    const active = CURRENT_FORMAT === 'all' || CURRENT_FORMAT === name;
    return subRow(!active, S.sub(name) + S.rev(fmtNum(rev)));
  };

  let html = '';
  if (CURRENT_ADTYPE === 'all' || CURRENT_ADTYPE === 'Video') {
    html += typeRow('Video', md.ad_type.Video, 'badge-blue');
    const vf = md.ad_type.Video.formats || {};
    html += vFormats.filter(f => (vf[f]||0) > 0)
      .sort((a,b) => (vf[b]||0) - (vf[a]||0))
      .map(f => fmtRow(f, vf[f]||0)).join('');
  }
  if (CURRENT_ADTYPE === 'all' || CURRENT_ADTYPE === 'Display') {
    html += typeRow('Display', md.ad_type.Display, 'badge-amber');
    const df = md.ad_type.Display.formats || {};
    html += dFormats.filter(f => (df[f]||0) > 0)
      .sort((a,b) => (df[b]||0) - (df[a]||0))
      .map(f => fmtRow(f, df[f]||0)).join('');
  }
  document.getElementById('adtype-panel').innerHTML = html;
}

// ── Categories ────────────────────────────────────
function renderCategories(md) {
  const cats   = (md.categories||[]).slice(0,10);
  const maxRev = cats[0] ? cats[0].del_rev : 1;
  document.getElementById('category-panel').innerHTML = cats.map((c,i) => {
    const pct    = Math.round((c.del_rev / maxRev) * 100);
    const active = CURRENT_CATEGORY === 'all' || CURRENT_CATEGORY === c.name;
    return row(pct, !active,
      S.num(i+1) +
      S.name(c.name) +
      S.rev(fmtNum(c.del_rev)) +
      S.pct(c.pct_of_total)
    );
  }).join('');
}

// ── Agencies ──────────────────────────────────────
function renderAgencies(md) {
  const agencies = (md.agencies||[]).slice(0,9);
  const maxRev   = agencies[0] ? agencies[0].del_rev : 1;
  document.getElementById('agency-panel').innerHTML = agencies.map(a => {
    const pct    = Math.round((a.del_rev / maxRev) * 100);
    const vShare = a.del_rev > 0 ? Math.round((a.video_rev / a.del_rev) * 100) : 0;
    const active = CURRENT_AGENCY === 'all' || CURRENT_AGENCY === a.name;
    return row(pct, !active,
      S.name(a.name) +
      S.rev(fmtNum(a.del_rev)) +
      S.info(a.clients + ' cl.') +
      S.info(vShare + '% V')
    );
  }).join('');
}

// ── Top Clients ───────────────────────────────────
function renderClients(md) {
  let clients = (md.top_clients||[]).slice();
  if (CURRENT_BU       !== 'all') clients = clients.filter(c => c.bu       === CURRENT_BU);
  if (CURRENT_CATEGORY !== 'all') clients = clients.filter(c => c.category === CURRENT_CATEGORY);
  if (CURRENT_AGENCY   !== 'all') clients = clients.filter(c => c.agency   === CURRENT_AGENCY);
  if (CURRENT_PLATFORM === 'CTV')        clients.sort((a,b) => b.ctv_rev     - a.ctv_rev);
  else if (CURRENT_PLATFORM === 'Mobile') clients.sort((a,b) => b.mobile_rev  - a.mobile_rev);
  if (CURRENT_ADTYPE === 'Video')         clients.sort((a,b) => b.video_rev   - a.video_rev);
  else if (CURRENT_ADTYPE === 'Display')  clients.sort((a,b) => b.display_rev - a.display_rev);
  clients = clients.slice(0,20);

  const parts = [CURRENT_BU,CURRENT_PLATFORM,CURRENT_ADTYPE,CURRENT_FORMAT,CURRENT_CATEGORY,CURRENT_AGENCY]
    .filter(v => v !== 'all');
  document.getElementById('clients-panel-title').textContent =
    'Top Clients' + (parts.length ? '  —  ' + parts.join(' · ') : '');

  if (!clients.length) {
    document.getElementById('clients-panel').innerHTML =
      '<div style="padding:24px 18px;color:var(--ink-soft);font-size:13px">No clients match the selected filters.</div>';
    return;
  }

  const revCol   = CURRENT_PLATFORM==='CTV'     ? 'ctv_rev'
                 : CURRENT_PLATFORM==='Mobile'  ? 'mobile_rev'
                 : CURRENT_ADTYPE==='Video'     ? 'video_rev'
                 : CURRENT_ADTYPE==='Display'   ? 'display_rev' : 'del_rev';
  const revLabel = CURRENT_PLATFORM==='CTV'     ? 'CTV Rev'
                 : CURRENT_PLATFORM==='Mobile'  ? 'Mobile Rev'
                 : CURRENT_ADTYPE==='Video'     ? 'Video Rev'
                 : CURRENT_ADTYPE==='Display'   ? 'Display Rev' : 'Del Rev';

  document.getElementById('clients-panel').innerHTML = `
    <div style="overflow-x:auto">
      <table class="clients-table">
        <thead><tr>
          <th>#</th><th>Client</th><th>BU</th><th>Category</th>
          <th>Agency</th><th>${revLabel}</th><th>Video</th><th>CTV</th><th>Mobile</th><th>Deals</th>
        </tr></thead>
        <tbody>${clients.map((c,i) => `<tr>
          <td class="rank">${i+1}</td>
          <td class="client-name">${c.name}</td>
          <td><span class="badge badge-blue">${c.bu}</span></td>
          <td style="color:var(--ink-soft);font-size:12px">${c.category||'—'}</td>
          <td style="color:var(--ink-soft);font-size:12px">${c.agency||'—'}</td>
          <td class="rev-val">${fmtNum(c[revCol])} Cr</td>
          <td class="rev-val" style="color:var(--ink-soft)">${fmtNum(c.video_rev)} Cr</td>
          <td class="rev-val" style="color:var(--ink-soft)">${fmtNum(c.ctv_rev)} Cr</td>
          <td class="rev-val" style="color:var(--ink-soft)">${fmtNum(c.mobile_rev)} Cr</td>
          <td><span class="badge badge-gray">${c.deal_count} deal${c.deal_count!==1?'s':''}</span></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

// ── Query ─────────────────────────────────────────
function setQuickQuery(t) { document.getElementById('query-input').value = t; document.getElementById('query-input').focus(); }
function closeAnswer()    { document.getElementById('query-answer-area').style.display='none'; document.getElementById('query-input').value=''; }
async function submitQuery() {
  if (!document.getElementById('query-input').value.trim()) return;
  document.getElementById('query-answer-area').style.display = 'block';
  document.getElementById('answer-content').innerHTML =
    '<div style="color:var(--ink-soft);font-size:13px">⏳ Gemini connects on Day 6. Data panels are live below. ✓</div>';
}

// ── Formatters ────────────────────────────────────
function fmtNum(n) { return (Number(n)||0).toFixed(2); }
function fmtInt(n) { return Math.round(Number(n)||0).toLocaleString('en-IN'); }
