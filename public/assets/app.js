// app.js — Page d'accueil — dynamic 1xbet style
const API = window.location.origin;
let socket, allMatches = [], activeFilter = 'all', activeLeague = 'all';

function connectSocket() {
  socket = io(API, { transports: ['websocket','polling'] });
  socket.on('connect', () => {
    document.getElementById('conn-dot').style.background = '#3daa57';
  });
  socket.on('disconnect', () => {
    document.getElementById('conn-dot').style.background = '#e5332e';
  });
  socket.on('globalScore', ({ id, hs, as, min }) => {
    const m = allMatches.find(x => x.id === id);
    if (!m) return;
    m.hs = hs; m.as = as; m.min = min;
    patchMatchRow(id, hs, as, min);
    patchTicker(id, hs, as);
    updateLiveCount();
    updateFeaturedIfNeeded(id);
  });
}

function patchMatchRow(id, hs, as, min) {
  const row = document.querySelector(`.match-row[data-id="${id}"]`);
  if (!row) return;
  const scores = row.querySelectorAll('.score-inline');
  if (scores[0]) scores[0].textContent = hs;
  if (scores[1]) scores[1].textContent = as;
  const tb = row.querySelector('.time-badge');
  if (tb && tb.classList.contains('live')) tb.textContent = `${min}'`;
}

function patchTicker(id, hs, as) {
  const items = document.querySelectorAll(`.ticker-item[data-id="${id}"] .t-score`);
  items.forEach(el => el.textContent = `${hs}-${as}`);
}

function updateFeaturedIfNeeded(id) {
  const fw = document.getElementById('featured-widget');
  if (fw && fw.dataset.id === id) {
    const m = allMatches.find(x => x.id === id);
    if (m) {
      const el = fw.querySelector('.fm-score');
      if (el) el.textContent = `${m.hs} - ${m.as}`;
      const st = fw.querySelector('.fm-status');
      if (st) st.textContent = `${m.min}'`;
    }
  }
}

async function loadMatches() {
  try {
    const res  = await fetch(`${API}/api/matches`);
    allMatches = await res.json();
    renderAll();
    buildTicker();
    buildLeagueSidebar();
    buildRightSidebar();
    const lu = document.getElementById('last-update');
    if (lu) lu.textContent = 'MAJ : ' + new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  } catch (e) { console.error('Erreur fetch matchs', e); }
}

function renderAll() {
  const filtered = filterMatches();
  const grouped  = groupByLeague(filtered);
  let html = '';
  if (!filtered.length) {
    html = `<div class="no-matches"><div class="no-matches-icon">⚽</div>Aucun match trouvé</div>`;
  } else {
    for (const [league, matches] of Object.entries(grouped)) {
      html += renderLeagueBlock(league, matches);
    }
  }
  document.getElementById('matches-container').innerHTML = html;
  updateLiveCount();
}

function filterMatches() {
  return allMatches.filter(m => {
    if (activeFilter === 'live'  && m.status !== 'LIVE') return false;
    if (activeFilter === 'today' && m.status === 'FT')   return false;
    if (activeFilter === 'ft'    && m.status !== 'FT')   return false;
    if (activeLeague !== 'all'   && m.leagueId !== activeLeague) return false;
    return true;
  });
}

function groupByLeague(matches) {
  const groups = {};
  matches.forEach(m => {
    if (!groups[m.league]) groups[m.league] = [];
    groups[m.league].push(m);
  });
  return groups;
}

function renderLeagueBlock(league, matches) {
  const sample    = matches[0];
  const liveCount = matches.filter(m => m.status === 'LIVE').length;
  const badge     = liveCount ? `<span class="league-live-count">LIVE ${liveCount}</span>` : '';
  return `
  <div class="league-block" data-league="${league}">
    <div class="league-head" onclick="toggleLeague(this)">
      <span class="league-flag">${sample.flag}</span>
      <span class="league-name">${league}</span>
      ${badge}
      <span class="league-match-count">${matches.length} match${matches.length>1?'s':''}</span>
      <span class="league-toggle">▼</span>
    </div>
    <div class="league-rows">${matches.map(renderMatchRow).join('')}</div>
  </div>`;
}

function toggleLeague(head) {
  head.closest('.league-block').classList.toggle('collapsed');
}

function renderMatchRow(m) {
  const isLive = m.status === 'LIVE';
  const isFT   = m.status === 'FT';
  const pred   = PRONO.predict(m);

  const timeCol = isLive
    ? `<div class="time-badge live">${m.min}'</div><div class="live-pulse">LIVE</div>`
    : isFT ? `<div class="time-badge ft">FT</div>`
           : `<div class="time-badge ns">${m.time}</div>`;

  const homeWinner = isFT && m.hs > m.as;
  const awayWinner = isFT && m.as > m.hs;

  // Utilise le vrai logo si disponible, sinon un point coloré
  const homeDot = m.homeCrest
    ? `<img class="team-crest" src="${m.homeCrest}" alt="" onerror="this.outerHTML='<span class=\\'team-dot\\' style=\\'background:${m.homeC}\\'></span>'">`
    : `<span class="team-dot" style="background:${m.homeC}"></span>`;
  const awayDot = m.awayCrest
    ? `<img class="team-crest" src="${m.awayCrest}" alt="" onerror="this.outerHTML='<span class=\\'team-dot\\' style=\\'background:${m.awayC}\\'></span>'">`
    : `<span class="team-dot" style="background:${m.awayC}"></span>`;

  const teamsCol = `
    <div class="team-line">
      ${homeDot}
      <span class="team-name-txt ${homeWinner?'winner':''}">${m.home}</span>
      <span class="score-inline ${isLive?'live-score':''}">${isLive||isFT?m.hs:''}</span>
    </div>
    <div class="team-line">
      ${awayDot}
      <span class="team-name-txt ${awayWinner?'winner':''}">${m.away}</span>
      <span class="score-inline ${isLive?'live-score':''}">${isLive||isFT?m.as:''}</span>
    </div>`;

  const probsCol = `
    <div class="prob-box" onclick="selProb(this,'${m.id}','1')" title="${m.homeS} gagne">
      <span class="pb-label">1</span><span class="pb-val">${pred.hw}%</span>
    </div>
    <div class="prob-box" onclick="selProb(this,'${m.id}','X')" title="Match nul">
      <span class="pb-label">X</span><span class="pb-val">${pred.dr}%</span>
    </div>
    <div class="prob-box" onclick="selProb(this,'${m.id}','2')" title="${m.awayS} gagne">
      <span class="pb-label">2</span><span class="pb-val">${pred.aw}%</span>
    </div>`;

  return `
  <div class="match-row" data-id="${m.id}" onclick="goMatch('${m.id}',event)">
    <div class="mr-time">${timeCol}</div>
    <div class="mr-teams">${teamsCol}</div>
    <div class="mr-probs">${probsCol}</div>
    <div class="mr-action">
      <button class="btn-stream" title="Voir le flux" onclick="goMatch('${m.id}',event)">▶</button>
    </div>
  </div>`;
}

function selProb(el, matchId, key) {
  const row = document.querySelector(`.match-row[data-id="${matchId}"]`);
  if (!row) return;
  row.querySelectorAll('.prob-box').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
}

function goMatch(id, e) {
  if (e && e.target.closest('.prob-box')) return;
  const m = allMatches.find(x => x.id === id);
  if (m) { try { sessionStorage.setItem('fl_m', JSON.stringify(m)); } catch(_){} }
  window.location.href = `/match.html?id=${id}`;
}

function buildTicker() {
  const live = allMatches.filter(m => m.status === 'LIVE');
  const ticker = document.querySelector('.ticker');
  if (!ticker) return;
  if (!live.length) {
    // Pas de match live : afficher les prochains matchs dans le ticker
    const upcoming = allMatches.filter(m => m.status === 'NS').slice(0, 8);
    if (!upcoming.length) { ticker.style.display = 'none'; return; }
    ticker.style.display = 'flex';
    const items = [...upcoming, ...upcoming].map(m => `
      <span class="ticker-item" data-id="${m.id}" onclick="goMatch('${m.id}',event)">
        ${m.flag} <strong>${m.homeS}</strong>
        <span class="t-score" style="color:var(--text2)">${m.time}</span>
        <strong>${m.awayS}</strong>
      </span>`).join('');
    document.querySelector('.ticker-inner').innerHTML = items;
    document.querySelector('.ticker-label').innerHTML = '📅 À VENIR';
    return;
  }
  ticker.style.display = 'flex';
  document.querySelector('.ticker-label').innerHTML = '⚽ LIVE';
  const items = [...live, ...live].map(m => `
    <span class="ticker-item" data-id="${m.id}" onclick="goMatch('${m.id}',event)">
      ${m.flag} <strong>${m.homeS}</strong>
      <span class="t-score">${m.hs}-${m.as}</span>
      <strong>${m.awayS}</strong>
      <span class="t-live">${m.min}'</span>
    </span>`).join('');
  document.querySelector('.ticker-inner').innerHTML = items;
}

function buildLeagueSidebar() {
  const leagues = {};
  allMatches.forEach(m => {
    if (!leagues[m.leagueId]) leagues[m.leagueId] = { name: m.league, flag: m.flag, count: 0 };
    leagues[m.leagueId].count++;
  });
  let html = `<li class="league-item ${activeLeague==='all'?'active':''}" onclick="filterLeague('all',this)">
    <span>Toutes les ligues</span><span class="league-count">${allMatches.length}</span></li>`;
  for (const [id, l] of Object.entries(leagues)) {
    html += `<li class="league-item ${activeLeague===id?'active':''}" onclick="filterLeague('${id}',this)">
      <span>${l.flag} ${l.name}</span><span class="league-count">${l.count}</span></li>`;
  }
  document.getElementById('league-list').innerHTML = html;
  updateLiveCount();
}

function filterLeague(id, el) {
  activeLeague = id;
  document.querySelectorAll('.league-item').forEach(x => x.classList.remove('active'));
  el.classList.add('active');
  renderAll();
}

function setFilter(tab, el) {
  activeFilter = tab;
  document.querySelectorAll('.filter-tab, .htab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAll();
}

function updateLiveCount() {
  const live = allMatches.filter(m => m.status === 'LIVE').length;
  const el1 = document.getElementById('live-count');
  const el2 = document.getElementById('live-count-badge');
  if (el1) el1.textContent = live;
  if (el2) el2.textContent = live;
}

function buildRightSidebar() {
  buildFeaturedMatch();
  buildQuickPreds();
  buildBookmakers();
}

function buildFeaturedMatch() {
  const live = allMatches.filter(m => m.status === 'LIVE');
  const m    = live[0] || allMatches[0];
  if (!m) return;
  const pred = PRONO.predict(m);
  const isLive = m.status === 'LIVE';
  const isFT   = m.status === 'FT';
  function avatar(initials, color, crest) {
    if (crest) return `<img class="fm-avatar fm-avatar-img" src="${crest}" alt="${initials}"
      onerror="this.outerHTML='<div class=\\'fm-avatar\\' style=\\'background:${color};color:#fff\\'>${initials}</div>'">`;
    const r=parseInt((color+'000000').slice(1,3),16);
    const g=parseInt((color+'000000').slice(3,5),16);
    const b=parseInt((color+'000000').slice(5,7),16);
    const fg=(r*299+g*587+b*114)/1000>145?'#111':'#fff';
    return `<div class="fm-avatar" style="background:${color};color:${fg}">${initials}</div>`;
  }
  const fw = document.getElementById('featured-widget');
  if (!fw) return;
  fw.innerHTML = `
    <div class="fm-league">${m.flag} ${m.league}${isLive?` · <span style="color:var(--red)">${m.min}'</span>`:''}</div>
    <div class="fm-teams">
      <div class="fm-team">${avatar(m.homeS,m.homeC,m.homeCrest)}<span class="fm-name">${m.home}</span></div>
      <div>
        ${isLive||isFT?`<div class="fm-score">${m.hs}<span style="color:var(--text3);font-size:1.2rem;margin:0 .2rem">-</span>${m.as}</div>`
          :`<div class="fm-score" style="font-size:1.2rem;color:var(--text2)">${m.time}</div>`}
        <div class="fm-status">${isLive?`Live ${m.min}'`:isFT?'Terminé':'À venir'}</div>
      </div>
      <div class="fm-team">${avatar(m.awayS,m.awayC,m.awayCrest)}<span class="fm-name">${m.away}</span></div>
    </div>
    <div class="fm-probs">
      <div class="fm-prob-box"><span class="fm-pl">1</span><span class="fm-pv">${pred.hw}%</span></div>
      <div class="fm-prob-box"><span class="fm-pl">X</span><span class="fm-pv">${pred.dr}%</span></div>
      <div class="fm-prob-box"><span class="fm-pl">2</span><span class="fm-pv">${pred.aw}%</span></div>
    </div>
    <div class="btn-watch" onclick="goMatch('${m.id}',event)">▶ Regarder le match</div>`;
  fw.dataset.id = m.id;
}

function buildQuickPreds() {
  const container = document.getElementById('quick-preds');
  if (!container) return;
  container.innerHTML = allMatches.slice(0,6).map(m => {
    const pred = PRONO.predict(m);
    return `<div class="quick-pred-item">
      <span class="qp-teams">${m.homeS} vs ${m.awayS}</span>
      <span class="qp-verdict ${pred.vc}">${pred.vc==='home'?'1':pred.vc==='draw'?'X':'2'} ${Math.max(pred.hw,pred.dr,pred.aw)}%</span>
    </div>`;
  }).join('');
}

const BOOKMAKERS = [
  {name:'Betclic',url:'https://www.betclic.fr',offer:"Jusqu'à 200€",color:'#ff6b00'},
  {name:'Winamax',url:'https://www.winamax.fr',offer:'100% 1er dépôt',color:'#d40000'},
  {name:'PMU',url:'https://www.pmu.fr',offer:'150€ freebets',color:'#004899'},
];

function buildBookmakers() {
  const el = document.getElementById('bookmakers-wrap');
  if (!el) return;
  el.innerHTML = `
    <div class="bm-warn">⚠️ Les paris comportent des risques. 18+ uniquement.
      <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener">09 74 75 13 13</a></div>
    ${BOOKMAKERS.map(b=>`
      <a href="${b.url}" target="_blank" rel="noopener nofollow sponsored" class="bm-item">
        <div><div class="bm-name" style="color:${b.color}">${b.name}</div>
             <div class="bm-offer">${b.offer}</div></div>
        <span class="bm-cta">→</span>
      </a>`).join('')}
    <div class="bm-legal">Publicité. Risque de dépendance. Appelez le 09 74 75 13 13.</div>`;
}

// ── Mini player chaînes sport live ────────────────────────────────────────────

let _chHls = null;

function initChannelPlayer() {
  const btns = document.getElementById('channel-btns');
  if (!btns || typeof LIVE_CHANNELS === 'undefined' || !LIVE_CHANNELS.length) return;

  btns.innerHTML = LIVE_CHANNELS.map((c, i) => `
    <button class="ch-btn${i === 0 ? ' active' : ''}" onclick="loadChannel(${i})">
      <span class="ch-flag">${c.flag}</span>
      <span class="ch-info"><span class="ch-name">${c.name}</span><span class="ch-note">${c.note}</span></span>
    </button>`).join('');

  // Charger la 1ère chaîne automatiquement (muet par défaut)
  loadChannel(0);
}

function loadChannel(i) {
  document.querySelectorAll('.ch-btn').forEach((b, j) => b.classList.toggle('active', i === j));
  const ch = LIVE_CHANNELS[i];
  const pc = document.getElementById('channel-player');
  if (!pc || !ch) return;

  // Détruire l'instance HLS précédente
  if (_chHls) { _chHls.destroy(); _chHls = null; }

  if (ch.type === 'youtube') {
    pc.innerHTML = `<iframe class="ch-iframe" src="${ch.url}"
      allow="autoplay;fullscreen;encrypted-media" allowfullscreen></iframe>`;
    return;
  }

  // HLS
  pc.innerHTML = `
    <video id="ch-video" class="ch-video" controls playsinline muted></video>
    <div class="ch-loading"><div class="spinner" style="width:24px;height:24px;border-width:2px"></div></div>`;

  const v = document.getElementById('ch-video');

  if (typeof Hls !== 'undefined' && Hls.isSupported()) {
    _chHls = new Hls({ enableWorker: true, lowLatencyMode: true });
    _chHls.loadSource(ch.url);
    _chHls.attachMedia(v);
    _chHls.on(Hls.Events.MANIFEST_PARSED, () => {
      pc.querySelector('.ch-loading')?.remove();
      v.play().catch(() => {});
    });
    _chHls.on(Hls.Events.ERROR, (_, d) => {
      if (d.fatal) pc.innerHTML = `<div class="ch-error">📺 Flux indisponible<br><small>Essayez une autre chaîne</small></div>`;
    });
  } else if (v && v.canPlayType('application/vnd.apple.mpegurl')) {
    v.src = ch.url;
    pc.querySelector('.ch-loading')?.remove();
    v.play().catch(() => {});
  } else {
    pc.innerHTML = `<div class="ch-error">📺 HLS non supporté<br><small>Utilisez Chrome ou Firefox</small></div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  connectSocket();
  loadMatches();
  setInterval(loadMatches, 60000);
  initChannelPlayer();
});
