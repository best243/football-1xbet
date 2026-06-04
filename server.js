const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const cron   = require('node-cron');
const path   = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Données matchs ────────────────────────────────────────────────────────────
const MATCHES = [
  { id:'1001', league:'Ligue 1',       flag:'🇫🇷', leagueId:'L1',
    home:'Paris Saint-Germain', away:'Olympique de Marseille', homeS:'PSG', awayS:'OM',
    homeC:'#001E62', awayC:'#2196F3',
    status:'LIVE', min:67, hs:2, as:1, time:'20:45',
    hForm:['W','W','D','W','L'], aForm:['L','W','D','D','W'], hGA:2.4, aGA:1.6 },
  { id:'1006', league:'Ligue 1',       flag:'🇫🇷', leagueId:'L1',
    home:'Olympique Lyonnais', away:'OGC Nice', homeS:'OL', awayS:'OGCN',
    homeC:'#0066B2', awayC:'#D30000',
    status:'NS', min:null, hs:0, as:0, time:'21:00',
    hForm:['D','W','L','W','D'], aForm:['W','D','W','D','L'], hGA:1.7, aGA:1.5 },
  { id:'1007', league:'Ligue 1',       flag:'🇫🇷', leagueId:'L1',
    home:'AS Monaco', away:'Stade de Reims', homeS:'ASM', awayS:'RMS',
    homeC:'#E60012', awayC:'#BC0020',
    status:'FT', min:90, hs:2, as:0, time:'18:00',
    hForm:['W','D','W','W','D'], aForm:['L','L','D','W','L'], hGA:2.0, aGA:1.1 },
  { id:'1002', league:'La Liga',       flag:'🇪🇸', leagueId:'LIGA',
    home:'Real Madrid', away:'FC Barcelona', homeS:'RMA', awayS:'FCB',
    homeC:'#FEBE10', awayC:'#A50044',
    status:'LIVE', min:34, hs:0, as:1, time:'21:00',
    hForm:['W','W','W','D','W'], aForm:['W','D','W','W','W'], hGA:2.1, aGA:2.3 },
  { id:'1008', league:'La Liga',       flag:'🇪🇸', leagueId:'LIGA',
    home:'Atlético Madrid', away:'Sevilla FC', homeS:'ATM', awayS:'SEV',
    homeC:'#CE3524', awayC:'#D01111',
    status:'LIVE', min:89, hs:2, as:0, time:'20:00',
    hForm:['W','W','D','W','W'], aForm:['D','L','W','D','L'], hGA:1.9, aGA:1.2 },
  { id:'1003', league:'Premier League',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', leagueId:'PL',
    home:'Manchester City', away:'Liverpool', homeS:'MCI', awayS:'LIV',
    homeC:'#6CABDD', awayC:'#C8102E',
    status:'NS', min:null, hs:0, as:0, time:'17:30',
    hForm:['W','D','W','W','W'], aForm:['W','W','D','L','W'], hGA:2.8, aGA:2.2 },
  { id:'1009', league:'Premier League',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', leagueId:'PL',
    home:'Chelsea FC', away:'Arsenal', homeS:'CHE', awayS:'ARS',
    homeC:'#034694', awayC:'#EF0107',
    status:'LIVE', min:55, hs:1, as:1, time:'19:30',
    hForm:['D','W','W','L','W'], aForm:['W','W','W','D','W'], hGA:1.8, aGA:2.0 },
  { id:'1010', league:'Premier League',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', leagueId:'PL',
    home:'Tottenham Hotspur', away:'Manchester United', homeS:'TOT', awayS:'MUN',
    homeC:'#132257', awayC:'#DA291C',
    status:'FT', min:90, hs:2, as:2, time:'14:00',
    hForm:['L','W','D','W','L'], aForm:['W','D','L','D','W'], hGA:1.6, aGA:1.7 },
  { id:'1004', league:'Serie A',       flag:'🇮🇹', leagueId:'SA',
    home:'Juventus FC', away:'AC Milan', homeS:'JUV', awayS:'MIL',
    homeC:'#2c2c2c', awayC:'#C0272D',
    status:'LIVE', min:72, hs:0, as:2, time:'18:00',
    hForm:['D','W','L','D','W'], aForm:['W','D','W','D','L'], hGA:1.5, aGA:1.7 },
  { id:'1011', league:'Serie A',       flag:'🇮🇹', leagueId:'SA',
    home:'Inter Milan', away:'Fiorentina', homeS:'INT', awayS:'FIO',
    homeC:'#0068A8', awayC:'#6B2D8B',
    status:'FT', min:90, hs:3, as:0, time:'15:00',
    hForm:['W','W','W','W','D'], aForm:['L','D','L','W','D'], hGA:2.4, aGA:1.3 },
  { id:'1012', league:'Serie A',       flag:'🇮🇹', leagueId:'SA',
    home:'AS Roma', away:'SSC Napoli', homeS:'ROM', awayS:'NAP',
    homeC:'#8B1A1A', awayC:'#003DA5',
    status:'NS', min:null, hs:0, as:0, time:'20:00',
    hForm:['D','W','D','L','W'], aForm:['W','W','W','D','L'], hGA:1.6, aGA:2.1 },
  { id:'1005', league:'Bundesliga',    flag:'🇩🇪', leagueId:'BL',
    home:'Bayern Munich', away:'Borussia Dortmund', homeS:'FCB', awayS:'BVB',
    homeC:'#DC052D', awayC:'#FDE100',
    status:'LIVE', min:41, hs:3, as:1, time:'18:30',
    hForm:['W','W','W','W','D'], aForm:['W','L','W','D','W'], hGA:3.1, aGA:2.0 },
  { id:'1013', league:'Bundesliga',    flag:'🇩🇪', leagueId:'BL',
    home:'Bayer Leverkusen', away:'RB Leipzig', homeS:'B04', awayS:'RBL',
    homeC:'#E32221', awayC:'#CC0000',
    status:'NS', min:null, hs:0, as:0, time:'19:00',
    hForm:['W','W','D','W','W'], aForm:['W','D','W','W','D'], hGA:2.3, aGA:1.9 },
  { id:'1014', league:'Liga Portugal', flag:'🇵🇹', leagueId:'LP',
    home:'FC Porto', away:'SL Benfica', homeS:'POR', awayS:'BEN',
    homeC:'#003087', awayC:'#C01B14',
    status:'NS', min:null, hs:0, as:0, time:'20:45',
    hForm:['W','D','W','W','L'], aForm:['W','W','W','D','W'], hGA:1.9, aGA:2.0 },
];

const STATE = {};
MATCHES.forEach(m => { STATE[m.id] = { hs: m.hs, as: m.as, min: m.min }; });
const chatHistory = {};
MATCHES.forEach(m => { chatHistory[m.id] = []; });

// ─── REST API ──────────────────────────────────────────────────────────────────
app.get('/api/matches', (req, res) => res.json(MATCHES.map(m => ({ ...m, ...STATE[m.id] }))));

app.get('/api/matches/:id', (req, res) => {
  const m = MATCHES.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json({ ...m, ...STATE[m.id] });
});

app.get('/api/predict/:id', (req, res) => {
  const m = MATCHES.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json({ matchId: m.id, ...predict(m) });
});

app.get('/api/matches/:id/chat', (req, res) => res.json(chatHistory[req.params.id] || []));
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ─── WebSocket ─────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('join',  id => socket.join(`m:${id}`));
  socket.on('leave', id => socket.leave(`m:${id}`));
  socket.on('chat', ({ matchId, username, message }) => {
    if (!message || message.length > 280) return;
    const clean = message.replace(/<[^>]*>/g, '').trim().slice(0, 280);
    const msg = { username: (username || 'Anonyme').slice(0, 25), message: clean, ts: Date.now() };
    if (chatHistory[matchId]) chatHistory[matchId].push(msg);
    io.to(`m:${matchId}`).emit('chat', msg);
  });
});

// ─── Simulation scores ─────────────────────────────────────────────────────────
cron.schedule('*/30 * * * * *', () => {
  MATCHES.forEach(m => {
    if (m.status !== 'LIVE') return;
    const s = STATE[m.id];
    if (s.min < 90) s.min++;
    if (Math.random() < 0.028) Math.random() < 0.52 ? s.hs++ : s.as++;
    const payload = { id: m.id, hs: s.hs, as: s.as, min: s.min };
    io.to(`m:${m.id}`).emit('scoreUpdate', payload);
    io.emit('globalScore', payload);
  });
});

// ─── Prédiction Poisson ────────────────────────────────────────────────────────
function formScore(form) {
  return form.reduce((s, r) => s + (r==='W'?3:r==='D'?1:0), 0) / (form.length * 3);
}
const FACT = [1,1,2,6,24,120,720,5040,40320,362880,3628800];
function poissonPmf(k, l) { return l<=0?(k===0?1:0):Math.exp(-l)*Math.pow(l,k)/FACT[Math.min(k,10)]; }
function predict(m) {
  const hf = formScore(m.hForm), af = formScore(m.aForm);
  const hl = Math.max(0.3, m.hGA*(0.35+hf*0.95)+0.15);
  const al = Math.max(0.2, m.aGA*(0.35+af*0.95));
  let hw=0, dr=0, aw=0;
  for (let i=0;i<=7;i++) for (let j=0;j<=7;j++) {
    const p = poissonPmf(i,hl)*poissonPmf(j,al);
    i>j?hw+=p:i===j?dr+=p:aw+=p;
  }
  const t=hw+dr+aw;
  hw=Math.round(hw/t*100); dr=Math.round(dr/t*100); aw=100-hw-dr;
  return { hw, dr, aw, conf: Math.min(95,Math.round(48+Math.max(hw,dr,aw)*0.52)), hl:hl.toFixed(2), al:al.toFixed(2) };
}

const PORT = process.env.PORT || 4001;
server.listen(PORT, () => console.log(`⚽  FootLive → http://localhost:${PORT}`));
