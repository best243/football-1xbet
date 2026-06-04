// chatbot.js — FootBot IA : pronostics & analyses en direct
const FOOTBOT = (() => {

  let botMatches = [], isOpen = false, isTyping = false, msgCount = 0, fetchedAt = 0;
  const API_BASE = window.location.origin;
  const TYPING_DELAY = 900;

  // ── Normalisation ────────────────────────────────────────────────────────────
  function norm(s) {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/['']/g, "'");
  }

  // ── Fetch matchs (cache 60 s) ────────────────────────────────────────────────
  async function fetchMatches() {
    if (Date.now() - fetchedAt < 60000 && botMatches.length) return botMatches;
    try {
      const r = await fetch(`${API_BASE}/api/matches`);
      botMatches = await r.json();
      fetchedAt  = Date.now();
    } catch (_) {}
    return botMatches;
  }

  // ── Trouver un match dans le message ─────────────────────────────────────────
  function findMatch(msg, matches) {
    const m = norm(msg);
    for (const match of matches) {
      const tokens = [
        match.home, match.away, match.homeS, match.awayS,
        ...match.home.split(' '), ...match.away.split(' ')
      ].map(norm);
      if (tokens.some(t => t.length > 2 && m.includes(t))) return match;
    }
    return null;
  }

  // ── Détection d'intention ────────────────────────────────────────────────────
  function detectIntent(msg, matches) {
    const m = norm(msg);
    if (/\b(bonjour|salut|hello|coucou|bonsoir|hey)\b/.test(m))           return 'GREET';
    if (/\b(aide|help|quoi|que peux|capable|commande|comment)\b/.test(m)) return 'HELP';
    if (/\b(live|direct|en cours|maintenant|joue)\b/.test(m))             return 'LIVE';
    if (/\b(venir|prochain|programme|ce soir|horaire)\b/.test(m))         return 'UPCOMING';
    if (/\b(termin|fini|resultat|score final)\b/.test(m))                 return 'FINISHED';
    if (/\b(meilleur|top|fiable|sur|certain|confiance|recommande)\b/.test(m)) return 'BEST';
    if (/\b(tous|liste|programme complet)\b/.test(m))                     return 'ALL';
    if (/\b(resume|bilan|recap|synthese)\b/.test(m))                      return 'SUMMARY';
    if (/\b(stat|forme|performance|historique)\b/.test(m)) {
      const match = findMatch(msg, matches);
      return match ? { intent: 'STATS', match } : 'STATS_NONAME';
    }
    if (/\b(pronostic|analyse|prediction|qui va gagner|gagne|chance|probabilite|favori|score|cote)\b/.test(m)) {
      const match = findMatch(msg, matches);
      return match ? { intent: 'PRED', match } : 'PRED_NONAME';
    }
    const match = findMatch(msg, matches);
    if (match) return { intent: 'PRED', match };
    return 'UNKNOWN';
  }

  // ── Routeur de réponses ──────────────────────────────────────────────────────
  function respond(intent, matches) {
    if (typeof intent === 'object') {
      if (intent.intent === 'PRED')  return buildPredCard(intent.match);
      if (intent.intent === 'STATS') return buildStatsCard(intent.match);
    }
    switch (intent) {
      case 'GREET':        return buildGreet(matches);
      case 'HELP':         return buildHelp();
      case 'LIVE':         return buildLiveList(matches);
      case 'UPCOMING':     return buildUpcomingList(matches);
      case 'FINISHED':     return buildFinishedList(matches);
      case 'BEST':         return buildBestPred(matches);
      case 'ALL':          return buildAllList(matches);
      case 'SUMMARY':      return buildSummary(matches);
      case 'PRED_NONAME':  return `<div class="fb-text">🤔 Pour quel match ?<br><em>"Analyse PSG"</em>, <em>"Pronostic Real Madrid"</em></div>`;
      case 'STATS_NONAME': return `<div class="fb-text">📊 Précisez l'équipe : <em>"Stats Bayern"</em></div>`;
      default:             return `<div class="fb-text">❓ Je n'ai pas compris. Tapez <strong>aide</strong>.</div>`;
    }
  }

  // ── Constructeurs de messages ────────────────────────────────────────────────
  function buildGreet(matches) {
    const live = matches.filter(m => m.status === 'LIVE').length;
    return `<div class="fb-text">
      👋 Bonjour ! Je suis <strong>FootBot</strong>, votre assistant IA.<br><br>
      📡 <strong>${live} match${live>1?'s':''} en direct</strong> / ${matches.length} au programme.<br><br>
      <span class="fb-chip" onclick="FOOTBOT.ask('Matchs en direct')">🔴 Live</span>
      <span class="fb-chip" onclick="FOOTBOT.ask('Meilleur pronostic')">⭐ Top</span>
      <span class="fb-chip" onclick="FOOTBOT.ask('Résumé')">📈 Résumé</span>
    </div>`;
  }

  function buildHelp() {
    return `<div class="fb-text">
      <strong>🤖 Commandes FootBot</strong><br><br>
      🔴 <em>"Matchs en direct"</em><br>
      📅 <em>"Matchs à venir"</em><br>
      ✅ <em>"Résultats"</em><br>
      🔮 <em>"Pronostic PSG"</em><br>
      📊 <em>"Stats Arsenal"</em><br>
      ⭐ <em>"Meilleur pronostic"</em><br>
      📈 <em>"Résumé du jour"</em><br><br>
      <em>Ou tapez directement un nom d'équipe !</em>
    </div>`;
  }

  function buildLiveList(matches) {
    const live = matches.filter(m => m.status === 'LIVE');
    if (!live.length) return `<div class="fb-text">📭 Aucun match en direct.</div>`;
    const rows = live.map(m => {
      const pred = PRONO.predict(m);
      return `<div class="fb-match-row" onclick="FOOTBOT.ask('Analyse ${m.home}')">
        <span class="fb-flag">${m.flag}</span>
        <div class="fb-mr-teams">
          <span>${m.home}</span><span class="fb-mr-score">${m.hs}–${m.as}</span><span>${m.away}</span>
        </div>
        <span class="fb-mr-min live-pulse-sm">${m.min}'</span>
        <span class="fb-mr-fav ${pred.vc}">${pred.vc==='home'?'1':pred.vc==='draw'?'X':'2'} ${Math.max(pred.hw,pred.dr,pred.aw)}%</span>
      </div>`;
    }).join('');
    return `<div class="fb-text"><strong>🔴 ${live.length} match${live.length>1?'s':''} en direct</strong></div>
      ${rows}<div class="fb-text-sm">Cliquez pour analyser</div>`;
  }

  function buildUpcomingList(matches) {
    const ns = matches.filter(m => m.status === 'NS');
    if (!ns.length) return `<div class="fb-text">📭 Pas de match à venir.</div>`;
    const rows = ns.map(m => {
      const pred = PRONO.predict(m);
      const fav  = pred.vc==='home'?m.homeS:pred.vc==='away'?m.awayS:'Nul';
      return `<div class="fb-match-row" onclick="FOOTBOT.ask('Analyse ${m.home}')">
        <span class="fb-flag">${m.flag}</span>
        <div class="fb-mr-teams">
          <span>${m.home}</span><span class="fb-mr-score ns">${m.time}</span><span>${m.away}</span>
        </div>
        <span class="fb-mr-fav ${pred.vc}">${fav}</span>
      </div>`;
    }).join('');
    return `<div class="fb-text"><strong>📅 ${ns.length} match${ns.length>1?'s':''} à venir</strong></div>${rows}`;
  }

  function buildFinishedList(matches) {
    const ft = matches.filter(m => m.status === 'FT');
    if (!ft.length) return `<div class="fb-text">Aucun match terminé.</div>`;
    const rows = ft.map(m => `
      <div class="fb-match-row">
        <span class="fb-flag">${m.flag}</span>
        <div class="fb-mr-teams">
          <span ${m.hs>m.as?'style="font-weight:700"':''}>${m.home}</span>
          <span class="fb-mr-score">${m.hs}–${m.as}</span>
          <span ${m.as>m.hs?'style="font-weight:700"':''}>${m.away}</span>
        </div>
        <span class="fb-mr-fav" style="color:var(--text3)">FT</span>
      </div>`).join('');
    return `<div class="fb-text"><strong>✅ ${ft.length} terminé${ft.length>1?'s':''}</strong></div>${rows}`;
  }

  function buildAllList(matches) {
    const byLeague = {};
    matches.forEach(m => { if(!byLeague[m.league]) byLeague[m.league]=[]; byLeague[m.league].push(m); });
    let html = `<div class="fb-text"><strong>📋 ${matches.length} matchs au programme</strong></div>`;
    for (const [league, ms] of Object.entries(byLeague)) {
      html += `<div class="fb-league-label">${ms[0].flag} ${league}</div>`;
      ms.forEach(m => {
        html += `<div class="fb-match-row sm" onclick="FOOTBOT.ask('Analyse ${m.home}')">
          <div class="fb-mr-teams" style="font-size:.72rem">
            <span>${m.homeS}</span>
            <span class="fb-mr-score">${m.status!=='NS'?`${m.hs}–${m.as}`:''}</span>
            <span>${m.awayS}</span>
          </div>
          <span class="fb-mr-min" style="color:var(--text3)">${m.status==='NS'?m.time:m.status==='LIVE'?m.min+"'":''}</span>
        </div>`;
      });
    }
    return html;
  }

  function buildBestPred(matches) {
    const active = matches.filter(m => m.status !== 'FT');
    if (!active.length) return `<div class="fb-text">Aucun match disponible.</div>`;
    const ranked = active
      .map(m => { const pred=PRONO.predict(m); return {m,pred,maxP:Math.max(pred.hw,pred.dr,pred.aw)}; })
      .sort((a,b) => b.maxP - a.maxP);
    let html = `<div class="fb-text">⭐ <strong>Paris le plus fiable du jour</strong></div>`;
    html += buildPredCard(ranked[0].m);
    if (ranked.length > 1) {
      html += `<div class="fb-text-sm">Autres pronostics fiables :</div>`;
      ranked.slice(1,3).forEach(({m,pred}) => {
        const fav = pred.vc==='home'?m.home:pred.vc==='away'?m.away:'Nul';
        html += `<div class="fb-match-row sm" onclick="FOOTBOT.ask('Analyse ${m.home}')">
          <span class="fb-flag">${m.flag}</span>
          <div class="fb-mr-teams"><span>${m.homeS} vs ${m.awayS}</span></div>
          <span class="fb-mr-fav ${pred.vc}">${fav} ${Math.max(pred.hw,pred.dr,pred.aw)}%</span>
        </div>`;
      });
    }
    return html;
  }

  function buildSummary(matches) {
    const live=matches.filter(m=>m.status==='LIVE').length;
    const ns=matches.filter(m=>m.status==='NS').length;
    const ft=matches.filter(m=>m.status==='FT').length;
    const best=[...matches].filter(m=>m.status!=='FT')
      .map(m=>({m,pred:PRONO.predict(m)}))
      .sort((a,b)=>Math.max(b.pred.hw,b.pred.dr,b.pred.aw)-Math.max(a.pred.hw,a.pred.dr,a.pred.aw))[0];
    return `<div class="fb-text">
      <strong>📈 Résumé du jour</strong><br><br>
      🔴 En direct : <strong>${live}</strong><br>
      📅 À venir : <strong>${ns}</strong><br>
      ✅ Terminés : <strong>${ft}</strong><br>
      📊 Total : <strong>${matches.length}</strong><br><br>
      ${best?`⭐ Pari fiable du moment : <span class="fb-chip" onclick="FOOTBOT.ask('Analyse ${best.m.home}')" style="cursor:pointer">
        ${best.m.homeS} vs ${best.m.awayS} (${Math.max(best.pred.hw,best.pred.dr,best.pred.aw)}%)</span>`:''}
    </div>`;
  }

  function buildPredCard(m) {
    const pred = PRONO.predict(m);
    const isLive=m.status==='LIVE', isFT=m.status==='FT';
    const statusHtml = isLive
      ? `<span class="fb-badge-live">⚡ ${m.min}'</span>`
      : isFT ? `<span class="fb-badge-ft">FT · ${m.hs}–${m.as}</span>`
             : `<span class="fb-badge-ns">📅 ${m.time}</span>`;
    const vc = {home:'#3daa57',draw:'#f5a623',away:'#2979ff'}[pred.vc];
    const bar=(val,cls,lbl)=>`<div class="fb-bar-row">
      <span class="fb-bl">${lbl}</span>
      <div class="fb-bar-track"><div class="fb-bar-fill ${cls}" style="width:${val}%"></div></div>
      <span class="fb-bv">${val}%</span></div>`;
    const fmLine=(form,lbl)=>{
      const c={W:{bg:'#3daa57',l:'V'},D:{bg:'#f5a623',l:'N'},L:{bg:'#e5332e',l:'D'}};
      return `<div class="fb-form-line"><span class="fb-fl">${lbl}</span>
        ${form.map(r=>`<span class="fb-fbadge" style="background:${c[r].bg}">${c[r].l}</span>`).join('')}</div>`;
    };
    return `<div class="fb-pred-card">
      <div class="fb-pc-header">
        <span class="fb-flag">${m.flag}</span>
        <div>
          <div class="fb-pc-league">${m.league}</div>
          <div class="fb-pc-teams">${m.home} <span>vs</span> ${m.away}</div>
        </div>
        ${statusHtml}
      </div>
      ${isLive?`<div class="fb-score-live">${m.hs} – ${m.as}</div>`:''}
      <div class="fb-bars">
        ${bar(pred.hw,'h',`1·${m.homeS}`)}
        ${bar(pred.dr,'d','X·Nul')}
        ${bar(pred.aw,'a',`2·${m.awayS}`)}
      </div>
      <div class="fb-verdict" style="border-left-color:${vc}">
        🤖 <strong>${pred.verdict}</strong> | 💪 Confiance : <strong>${pred.conf}%</strong>
      </div>
      <div class="fb-form-block">
        ${fmLine(m.hForm, m.homeS)}
        ${fmLine(m.aForm, m.awayS)}
      </div>
      <div class="fb-lambda">📐 λ dom=${pred.hl} | λ ext=${pred.al}</div>
      <div class="fb-legal">⚠️ À titre éducatif — pas de conseil de pari</div>
    </div>`;
  }

  function buildStatsCard(m) {
    const pred=PRONO.predict(m);
    const pct=f=>Math.round(f.reduce((s,r)=>s+(r==='W'?3:r==='D'?1:0),0)/(f.length*3)*100);
    const bar10=p=>'█'.repeat(Math.round(p/10))+'░'.repeat(10-Math.round(p/10));
    return `<div class="fb-pred-card">
      <div class="fb-pc-header">
        <span class="fb-flag">${m.flag}</span>
        <div>
          <div class="fb-pc-league">${m.league}</div>
          <div class="fb-pc-teams">${m.home} vs ${m.away}</div>
        </div>
      </div>
      <div class="fb-text" style="margin:0">
        <strong>📊 Forme (5 derniers matchs)</strong><br><br>
        <strong>${m.home}</strong><br>
        Forme : ${m.hForm.join('-')} | Score : ${pct(m.hForm)}%<br>
        <code style="font-size:.72rem;color:var(--yellow)">${bar10(pct(m.hForm))}</code><br>
        Moy. buts : ${m.hGA}/match | λ=${pred.hl}<br><br>
        <strong>${m.away}</strong><br>
        Forme : ${m.aForm.join('-')} | Score : ${pct(m.aForm)}%<br>
        <code style="font-size:.72rem;color:var(--blue)">${bar10(pct(m.aForm))}</code><br>
        Moy. buts : ${m.aGA}/match | λ=${pred.al}
      </div>
    </div>`;
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────────
  function addMsg(html, role='bot') {
    const box = document.getElementById('fb-messages');
    if (!box) return;
    const wrap = document.createElement('div');
    wrap.className = `fb-msg fb-msg-${role}`;
    wrap.innerHTML = html;
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
    msgCount++;
  }

  function addUserMsg(text) {
    addMsg(`<div class="fb-text">${esc(text)}</div>`, 'user');
  }

  function showTyping() {
    const box = document.getElementById('fb-messages');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'fb-msg fb-msg-bot';
    el.id = 'fb-typing';
    el.innerHTML = '<div class="fb-typing"><span></span><span></span><span></span></div>';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  function hideTyping() { document.getElementById('fb-typing')?.remove(); }

  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Pipeline message ──────────────────────────────────────────────────────────
  async function processMessage(text) {
    if (!text.trim() || isTyping) return;
    isTyping = true;
    addUserMsg(text);
    showTyping();
    const matches = await fetchMatches();
    const intent  = detectIntent(text, matches);
    await new Promise(r => setTimeout(r, TYPING_DELAY));
    hideTyping();
    addMsg(respond(intent, matches), 'bot');
    isTyping = false;
  }

  // ── API publique ──────────────────────────────────────────────────────────────
  function ask(text) {
    const inp = document.getElementById('fb-input');
    if (inp) inp.value = text;
    processMessage(text);
  }

  function toggle() {
    const win = document.getElementById('fb-window');
    const btn = document.getElementById('fb-btn');
    if (!win) return;
    isOpen = !isOpen;
    win.style.display = isOpen ? 'flex' : 'none';
    btn.classList.toggle('open', isOpen);
    document.getElementById('fb-notif')?.remove();
    if (isOpen && msgCount === 0) {
      setTimeout(async () => {
        const matches = await fetchMatches();
        addMsg(buildGreet(matches), 'bot');
      }, 200);
    }
    if (isOpen) setTimeout(() => document.getElementById('fb-input')?.focus(), 100);
  }

  function send() {
    const inp = document.getElementById('fb-input');
    if (!inp) return;
    const txt = inp.value.trim();
    if (!txt) return;
    inp.value = '';
    processMessage(txt);
  }

  // ── Injection widget ──────────────────────────────────────────────────────────
  function inject() {
    if (document.getElementById('fb-widget')) return;
    const widget = document.createElement('div');
    widget.id = 'fb-widget';
    widget.innerHTML = `
      <div id="fb-window" style="display:none">
        <div class="fb-header">
          <div class="fb-header-left">
            <span class="fb-bot-avatar">🤖</span>
            <div>
              <div class="fb-bot-name">FootBot IA</div>
              <div class="fb-bot-sub">Pronostics football en direct</div>
            </div>
          </div>
          <div class="fb-header-right">
            <button class="fb-hbtn" onclick="FOOTBOT.ask('Aide')" title="Aide">?</button>
            <button class="fb-hbtn" onclick="FOOTBOT.toggle()" title="Réduire">−</button>
          </div>
        </div>
        <div class="fb-quick-btns">
          <button onclick="FOOTBOT.ask('Matchs en direct')">🔴 Live</button>
          <button onclick="FOOTBOT.ask('Meilleur pronostic')">⭐ Top</button>
          <button onclick="FOOTBOT.ask('Matchs à venir')">📅 À venir</button>
          <button onclick="FOOTBOT.ask('Résumé du jour')">📈 Résumé</button>
        </div>
        <div id="fb-messages" class="fb-messages"></div>
        <div class="fb-input-wrap">
          <input id="fb-input" type="text"
            placeholder="Ex: Analyse PSG vs Marseille…"
            onkeydown="if(event.key==='Enter')FOOTBOT.send()"
            autocomplete="off" maxlength="120"/>
          <button id="fb-send-btn" onclick="FOOTBOT.send()">➤</button>
        </div>
        <div class="fb-footer-note">⚠️ Pronostics à titre éducatif — pas de conseil de pari</div>
      </div>
      <button id="fb-btn" onclick="FOOTBOT.toggle()" title="FootBot IA — Pronostics">
        <span id="fb-btn-icon">🤖</span>
        <span class="fb-pulse-ring"></span>
      </button>`;
    document.body.appendChild(widget);

    setTimeout(() => {
      if (!isOpen) {
        const notif = document.createElement('div');
        notif.id = 'fb-notif';
        notif.className = 'fb-notif';
        notif.textContent = '💬 Demandez un pronostic !';
        notif.onclick = () => FOOTBOT.toggle();
        document.getElementById('fb-widget').appendChild(notif);
      }
    }, 3000);
  }

  function init() { inject(); fetchMatches(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { toggle, ask, send };
})();

window.FOOTBOT = FOOTBOT;
