// services/footballdata.js — football-data.org (Free Tier)
// Inscription gratuite : https://www.football-data.org/client/register
// Limites : 10 req/min | Ligues : PL, PD, FL1, SA, BL1, CL, PPL, EC, DED, BSA, WC

const axios  = require('axios');
const cache  = require('./cache');

const BASE   = 'https://api.football-data.org/v4';
const KEY    = process.env.FOOTBALL_DATA_KEY;
const ENABLED = KEY && KEY !== 'votre_cle_ici';

const HEADERS = { 'X-Auth-Token': KEY };

// Mapping code competition → infos affichage
const LEAGUE_META = {
  PL:  { name: 'Premier League',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', leagueId: 'PL'   },
  PD:  { name: 'La Liga',           flag: '🇪🇸', leagueId: 'LIGA' },
  FL1: { name: 'Ligue 1',           flag: '🇫🇷', leagueId: 'L1'   },
  SA:  { name: 'Serie A',           flag: '🇮🇹', leagueId: 'SA'   },
  BL1: { name: 'Bundesliga',        flag: '🇩🇪', leagueId: 'BL'   },
  CL:  { name: 'Champions League',  flag: '🇪🇺', leagueId: 'CL'   },
  PPL: { name: 'Liga Portugal',     flag: '🇵🇹', leagueId: 'LP'   },
  DED: { name: 'Eredivisie',        flag: '🇳🇱', leagueId: 'DED'  },
  EC:  { name: 'Championship',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', leagueId: 'EC'   },
  WC:  { name: 'Coupe du monde',    flag: '🌍', leagueId: 'WC'   },
  BSA: { name: 'Série A brésilienne',flag:'🇧🇷', leagueId: 'BSA'  },
};

function mapStatus(fdStatus) {
  switch (fdStatus) {
    case 'IN_PLAY':
    case 'PAUSED':    return 'LIVE';
    case 'FINISHED':  return 'FT';
    default:          return 'NS';
  }
}

function localTime(utcDate) {
  return new Date(utcDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
  });
}

function toShort(name) {
  if (!name) return '???';
  const clean = name.replace(/ FC$| SC$| CF$| AC$| AS$| CD$/i, '').trim();
  const words = clean.split(' ');
  if (words.length === 1) return clean.slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
}

function transformMatch(m) {
  const meta = LEAGUE_META[m.competition?.code] || {
    name: m.competition?.name || 'Football',
    flag: '⚽',
    leagueId: m.competition?.code || 'FOOT',
  };

  const hs = m.score?.fullTime?.home ?? 0;
  const as = m.score?.fullTime?.away ?? 0;

  return {
    id:       `fd-${m.id}`,
    fdId:     m.id,
    league:   meta.name,
    flag:     meta.flag,
    leagueId: meta.leagueId,
    home:     m.homeTeam?.name     || 'Équipe A',
    away:     m.awayTeam?.name     || 'Équipe B',
    homeS:    m.homeTeam?.tla      || toShort(m.homeTeam?.name),
    awayS:    m.awayTeam?.tla      || toShort(m.awayTeam?.name),
    homeTeamId: m.homeTeam?.id,
    awayTeamId: m.awayTeam?.id,
    homeCrest:  m.homeTeam?.crest  || null,
    awayCrest:  m.awayTeam?.crest  || null,
    status:   mapStatus(m.status),
    min:      m.minute             ?? null,
    hs,
    as,
    time:     localTime(m.utcDate),
    utcDate:  m.utcDate,
    // Form calculé a posteriori par aggregator
    hForm:    ['W','D','W','D','W'],
    aForm:    ['D','W','L','W','D'],
    hGA:      1.5,
    aGA:      1.3,
  };
}

async function get(path, params = {}) {
  if (!ENABLED) throw new Error('football-data.org non configuré');
  const res = await axios.get(`${BASE}${path}`, { headers: HEADERS, params, timeout: 8000 });
  return res.data;
}

// Matchs du jour (cache 5 min)
async function fetchTodayMatches() {
  return cache.getOrSet('fd:today', async () => {
    const today = new Date().toISOString().split('T')[0];
    const data  = await get('/matches', { dateFrom: today, dateTo: today });
    return (data.matches || []).map(transformMatch);
  }, 5 * 60 * 1000);
}

// Matchs en cours (cache 30 s)
async function fetchLiveMatches() {
  return cache.getOrSet('fd:live', async () => {
    const data = await get('/matches', { status: 'IN_PLAY,PAUSED' });
    return (data.matches || []).map(transformMatch);
  }, 30 * 1000);
}

// Derniers matchs (7 j) pour calculer la forme des équipes (cache 1 h)
async function fetchRecentResults() {
  return cache.getOrSet('fd:recent', async () => {
    const to   = new Date(); to.setDate(to.getDate() - 1);
    const from = new Date(); from.setDate(from.getDate() - 14);
    const data = await get('/matches', {
      status:   'FINISHED',
      dateFrom: from.toISOString().split('T')[0],
      dateTo:   to.toISOString().split('T')[0],
    });
    return data.matches || [];
  }, 60 * 60 * 1000);
}

// Calcul de la forme à partir des résultats récents
async function buildFormMap() {
  try {
    const recent = await fetchRecentResults();
    const form   = {};   // teamId → ['W','D','L', ...]
    const goals  = {};   // teamId → [scored, conceded, count]

    for (const m of recent) {
      if (!m.score?.fullTime) continue;
      const hId = m.homeTeam?.id, aId = m.awayTeam?.id;
      const hg  = m.score.fullTime.home ?? 0;
      const ag  = m.score.fullTime.away ?? 0;

      if (!form[hId]) { form[hId] = []; goals[hId] = [0,0,0]; }
      if (!form[aId]) { form[aId] = []; goals[aId] = [0,0,0]; }

      form[hId].push(hg > ag ? 'W' : hg === ag ? 'D' : 'L');
      form[aId].push(ag > hg ? 'W' : ag === hg ? 'D' : 'L');

      goals[hId][0] += hg; goals[hId][1] += ag; goals[hId][2]++;
      goals[aId][0] += ag; goals[aId][1] += hg; goals[aId][2]++;
    }

    // Garder uniquement les 5 derniers
    for (const id in form) form[id] = form[id].slice(-5);
    return { form, goals };
  } catch (_) {
    return { form: {}, goals: {} };
  }
}

module.exports = { fetchTodayMatches, fetchLiveMatches, buildFormMap, ENABLED };
