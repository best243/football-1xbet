require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const cron       = require('node-cron');
const path       = require('path');
const aggregator = require('./services/aggregator');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── État runtime ───────────────────────────────────────────────────────────────
let matches     = [];    // cache principal des matchs
let chatHistory = {};    // matchId → messages[]
let initialized = false;

// ── Prédiction Poisson (identique au client) ───────────────────────────────────
const FACT = [1,1,2,6,24,120,720,5040,40320,362880,3628800];
function poissonPmf(k, l) { return l<=0?(k===0?1:0):Math.exp(-l)*Math.pow(l,k)/FACT[Math.min(k,10)]; }
function formScore(form) { return form.reduce((s,r)=>s+(r==='W'?3:r==='D'?1:0),0)/(form.length*3); }
function predict(m) {
  const hf=formScore(m.hForm), af=formScore(m.aForm);
  const hl=Math.max(0.3,m.hGA*(0.35+hf*0.95)+0.15);
  const al=Math.max(0.2,m.aGA*(0.35+af*0.95));
  let hw=0,dr=0,aw=0;
  for(let i=0;i<=7;i++) for(let j=0;j<=7;j++){
    const p=poissonPmf(i,hl)*poissonPmf(j,al);
    i>j?hw+=p:i===j?dr+=p:aw+=p;
  }
  const t=hw+dr+aw;
  hw=Math.round(hw/t*100); dr=Math.round(dr/t*100); aw=100-hw-dr;
  return{hw,dr,aw,conf:Math.min(95,Math.round(48+Math.max(hw,dr,aw)*0.52)),hl:hl.toFixed(2),al:al.toFixed(2)};
}

// ── Chargement initial des matchs ──────────────────────────────────────────────
async function loadMatches() {
  try {
    matches = await aggregator.getMatches();
    matches.forEach(m => { if (!chatHistory[m.id]) chatHistory[m.id] = []; });
    initialized = true;
    console.log(`✅ ${matches.length} matchs chargés`);
  } catch (e) {
    console.error('Erreur chargement matchs :', e.message);
    if (!initialized) { matches = aggregator.MOCK; initialized = true; }
  }
}

// ── REST API ───────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const apis = {
    'football-data.org': !!process.env.FOOTBALL_DATA_KEY && process.env.FOOTBALL_DATA_KEY !== 'votre_cle_ici',
    'openligadb':        true,  // toujours disponible
    'thesportsdb':       true,  // toujours disponible
  };
  res.json({ ok: true, ts: Date.now(), matchCount: matches.length, apis });
});

app.get('/api/matches', (req, res) => {
  res.json(matches);
});

app.get('/api/matches/:id', (req, res) => {
  const m = matches.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Match introuvable' });
  res.json(m);
});

app.get('/api/predict/:id', (req, res) => {
  const m = matches.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Match introuvable' });
  res.json({ matchId: m.id, home: m.home, away: m.away, ...predict(m) });
});

app.get('/api/matches/:id/chat', (req, res) => {
  res.json(chatHistory[req.params.id] || []);
});

// ── WebSocket ──────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('join',  id => socket.join(`m:${id}`));
  socket.on('leave', id => socket.leave(`m:${id}`));

  socket.on('chat', ({ matchId, username, message }) => {
    if (!message || message.length > 280) return;
    const clean = message.replace(/<[^>]*>/g, '').trim().slice(0, 280);
    const msg   = { username: (username||'Anonyme').slice(0,25), message: clean, ts: Date.now() };
    if (!chatHistory[matchId]) chatHistory[matchId] = [];
    chatHistory[matchId].push(msg);
    io.to(`m:${matchId}`).emit('chat', msg);
  });
});

// ── Cron : refresh scores live toutes les 30 s ────────────────────────────────
cron.schedule('*/30 * * * * *', async () => {
  if (!initialized) return;

  // 1. Rafraîchir depuis les API réelles
  const { matches: updated, changed } = await aggregator.refreshLiveScores(matches);
  if (changed) matches = updated;

  // 2. Simulation si données mock (min + but aléatoire)
  const isMock = matches.some(m => m.id?.startsWith('m00'));
  if (isMock) {
    matches.forEach(m => {
      if (m.status !== 'LIVE') return;
      if (m.min < 90) m.min = (m.min||0) + 1;
      if (Math.random() < 0.028) Math.random() < 0.52 ? m.hs++ : m.as++;
    });
  }

  // 3. Push WebSocket pour chaque match live
  matches.forEach(m => {
    if (m.status !== 'LIVE') return;
    const payload = { id: m.id, hs: m.hs, as: m.as, min: m.min };
    io.to(`m:${m.id}`).emit('scoreUpdate', payload);
    io.emit('globalScore', payload);
  });
});

// Reload complet toutes les 10 min (calendrier + nouveaux matchs)
cron.schedule('*/10 * * * *', async () => {
  console.log('[CRON] Rechargement complet des matchs…');
  await loadMatches();
  io.emit('matchesReloaded', { count: matches.length });
});

// ── Démarrage ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4001;
server.listen(PORT, async () => {
  console.log(`\n⚽  FootLive [3 API] → http://localhost:${PORT}`);
  console.log(`   football-data.org : ${process.env.FOOTBALL_DATA_KEY && process.env.FOOTBALL_DATA_KEY !== 'votre_cle_ici' ? '✅ Configuré' : '⚠️  Pas de clé (mode mock)'}`);
  console.log(`   OpenLigaDB        : ✅ Actif (Bundesliga / CL)`);
  console.log(`   TheSportsDB       : ✅ Actif (logos équipes)`);
  console.log('');
  await loadMatches();
});
