// match.js — Page de match dynamique (style 1xbet)
const API = window.location.origin;
let socket, matchData = null, hlsInst = null, chatUsername = null;

const STREAM_SOURCES = [
  { label:'Source 1 · HLS', url:'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', type:'m3u8', note:'Flux test public' },
  { label:'Source 2 · Apple', url:'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8', type:'m3u8', note:'Demo officiel Apple' },
  { label:'Source 3 · YouTube', url:'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1', type:'youtube', note:'Lofi Radio (démo)' },
];

async function init() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { showErr('Aucun match spécifié.'); return; }
  try { matchData = JSON.parse(sessionStorage.getItem('fl_m')||'null'); } catch(_){}
  if (!matchData || matchData.id !== id) {
    const res = await fetch(`${API}/api/matches/${id}`).catch(()=>null);
    matchData  = res ? await res.json() : null;
  }
  if (!matchData) { showErr('Match introuvable.'); return; }

  document.title = `${matchData.home} vs ${matchData.away} — FootLive`;
  renderHeader();
  renderSources();
  loadSource(STREAM_SOURCES[0]);

  const pred = PRONO.predict(matchData);
  document.getElementById('prono-detail').innerHTML = PRONO.renderDetail(matchData, pred);

  initChat(id);
  buildBookmakers();

  // Mini pronostic sidebar
  const qps = document.getElementById('quick-pred-sidebar');
  if (qps) {
    const m=matchData;
    qps.innerHTML = `
      <div style="margin-bottom:.75rem">
        <div style="font-size:.72rem;color:var(--text2);margin-bottom:.5rem">${m.home} vs ${m.away}</div>
        <div style="display:flex;gap:3px">
          <div class="fm-prob-box" style="flex:1"><span class="fm-pl">1 · ${m.homeS}</span><span class="fm-pv">${pred.hw}%</span></div>
          <div class="fm-prob-box" style="flex:1"><span class="fm-pl">X</span><span class="fm-pv">${pred.dr}%</span></div>
          <div class="fm-prob-box" style="flex:1"><span class="fm-pl">2 · ${m.awayS}</span><span class="fm-pv">${pred.aw}%</span></div>
        </div>
      </div>
      <div class="pred-verdict ${pred.vc}" style="font-size:.75rem">
        🤖 ${pred.verdict} — Confiance ${pred.conf}%
      </div>`;
  }

  socket = io(API, { transports:['websocket','polling'] });
  socket.on('connect',     () => socket.emit('join', id));
  socket.on('scoreUpdate', data => { matchData.hs=data.hs; matchData.as=data.as; matchData.min=data.min; refreshScore(); });
  socket.on('chat',        msg  => appendChatMsg(msg));
}

function avatar(s, c, crest) {
  if (crest) return `<img class="mh-avatar mh-avatar-img" src="${crest}" alt="${s}"
    onerror="this.outerHTML='<div class=\\'mh-avatar\\' style=\\'background:${c};color:#fff\\'>${s}</div>'">`;
  const r=parseInt((c+'000000').slice(1,3),16),g=parseInt((c+'000000').slice(3,5),16),b=parseInt((c+'000000').slice(5,7),16);
  const fg=(r*299+g*587+b*114)/1000>145?'#111':'#fff';
  return `<div class="mh-avatar" style="background:${c};color:${fg}">${s}</div>`;
}

function renderHeader() {
  const m=matchData;
  document.getElementById('mh-league').innerHTML = `${m.flag} ${m.league}`;
  document.getElementById('mh-home').innerHTML   = `${avatar(m.homeS,m.homeC,m.homeCrest)}<span class="mh-name">${m.home}</span>`;
  document.getElementById('mh-away').innerHTML   = `${avatar(m.awayS,m.awayC,m.awayCrest)}<span class="mh-name">${m.away}</span>`;
  refreshScore();
}

function refreshScore() {
  const m=matchData;
  const isLive=m.status==='LIVE', isFT=m.status==='FT';
  let scoreHtml;
  if (isLive||isFT) {
    scoreHtml=`<span class="${isLive?'live-score-big':''}">${m.hs}</span><span class="sep">-</span><span class="${isLive?'live-score-big':''}">${m.as}</span>`;
  } else {
    scoreHtml=`<span style="font-size:1.4rem;color:var(--text2)">${m.time}</span>`;
  }
  document.getElementById('mh-score').innerHTML=scoreHtml;
  document.getElementById('mh-score').className=`mh-score${isLive?' live-score-big':''}`;
  const badge=document.getElementById('mh-badge');
  if (isLive)  badge.innerHTML=`<span class="badge-live">⚡ ${m.min}'</span>`;
  else if(isFT) badge.innerHTML=`<span class="badge-ft">FT</span>`;
  else          badge.innerHTML=`<span class="badge-ns">${m.time}</span>`;
}

function renderSources() {
  document.getElementById('sources-bar').innerHTML =
    `<span class="sources-label">Source :</span>` +
    STREAM_SOURCES.map((s,i)=>`
      <button class="src-btn${i===0?' active':''}" onclick="switchSrc(${i})">
        ${s.label}<small>${s.note}</small>
      </button>`).join('');
}

function switchSrc(i) {
  document.querySelectorAll('.src-btn').forEach((b,j)=>b.classList.toggle('active',i===j));
  loadSource(STREAM_SOURCES[i]);
}

function loadSource(src) {
  const pc=document.getElementById('player-container');
  const err=document.getElementById('stream-error');
  err.style.display='none';
  if (hlsInst) { hlsInst.destroy(); hlsInst=null; }
  if (src.type==='youtube') {
    pc.innerHTML=`<iframe class="stream-iframe" src="${src.url}" allow="autoplay;fullscreen;encrypted-media" allowfullscreen></iframe>`;
    return;
  }
  pc.innerHTML=`<video id="hls-video" class="stream-video" controls playsinline muted></video>
    <div id="vid-load" class="vid-loading"><div class="spinner"></div>Chargement…</div>`;
  const v=document.getElementById('hls-video');
  if (typeof Hls==='undefined') { streamErr('HLS.js indisponible.'); return; }
  if (Hls.isSupported()) {
    hlsInst=new Hls({enableWorker:true,lowLatencyMode:true});
    hlsInst.loadSource(src.url);
    hlsInst.attachMedia(v);
    hlsInst.on(Hls.Events.MANIFEST_PARSED,()=>{ document.getElementById('vid-load')?.remove(); v.play().catch(()=>{}); });
    hlsInst.on(Hls.Events.ERROR,(_,d)=>{ if(d.fatal) streamErr('Flux indisponible — essayez une autre source.'); });
  } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
    v.src=src.url; document.getElementById('vid-load')?.remove(); v.play().catch(()=>{});
  } else {
    streamErr('Navigateur non compatible HLS. Utilisez Chrome/Firefox.');
  }
}

function streamErr(msg) {
  document.getElementById('vid-load')?.remove();
  const pc=document.getElementById('player-container');
  pc.innerHTML=`<div class="stream-placeholder"><span class="ph-icon">📺</span><p>${msg}</p></div>`;
  const err=document.getElementById('stream-error');
  err.textContent=msg; err.style.display='block';
}

function initChat(matchId) {
  fetch(`${API}/api/matches/${matchId}/chat`)
    .then(r=>r.json()).then(msgs=>{ msgs.forEach(appendChatMsg); scrollChat(); }).catch(()=>{});
  document.getElementById('chat-username-form').addEventListener('submit', e => {
    e.preventDefault();
    const u=document.getElementById('chat-username-input').value.trim();
    if (u.length<2) return;
    chatUsername=u.slice(0,25);
    document.getElementById('chat-login').style.display='none';
    document.getElementById('chat-room').style.display='flex';
  });
  document.getElementById('chat-msg-form').addEventListener('submit', e => {
    e.preventDefault();
    const input=document.getElementById('chat-msg-input');
    const msg=input.value.trim();
    if (!msg||!chatUsername||!socket) return;
    socket.emit('chat',{matchId,username:chatUsername,message:msg});
    input.value='';
  });
}

function appendChatMsg(msg) {
  const box=document.getElementById('chat-messages');
  const empty=box.querySelector('.chat-empty');
  if (empty) empty.remove();
  const el=document.createElement('div');
  el.className='chat-msg';
  el.innerHTML=`<span class="cmu">${esc(msg.username)}</span><span class="cmt">${esc(msg.message)}</span>`;
  box.appendChild(el);
  scrollChat();
}

function scrollChat() {
  const box=document.getElementById('chat-messages');
  if (box) box.scrollTop=box.scrollHeight;
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function buildBookmakers() {
  const BM=[
    {name:'Betclic',url:'https://www.betclic.fr',offer:"200€ offerts",color:'#ff6b00'},
    {name:'Winamax',url:'https://www.winamax.fr',offer:'100% 1er dépôt',color:'#d40000'},
    {name:'PMU',url:'https://www.pmu.fr',offer:'150€ freebets',color:'#004899'},
  ];
  document.getElementById('bm-list').innerHTML=`
    <div class="bm-warn">⚠️ 18+ uniquement. Risque de dépendance.
      <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener">09 74 75 13 13</a></div>
    ${BM.map(b=>`
      <a href="${b.url}" target="_blank" rel="noopener nofollow sponsored" class="bm-item">
        <div><div class="bm-name" style="color:${b.color}">${b.name}</div>
             <div class="bm-offer">${b.offer}</div></div>
        <span class="bm-cta">→</span>
      </a>`).join('')}
    <div class="bm-legal">Publicité — Paris réservés aux +18 ans.</div>`;
}

function showErr(msg) {
  document.getElementById('match-wrap').innerHTML=`<div class="err-msg">❌ ${msg} <a onclick="history.back()" style="color:var(--yellow);cursor:pointer">← Retour</a></div>`;
}

document.addEventListener('DOMContentLoaded', init);
