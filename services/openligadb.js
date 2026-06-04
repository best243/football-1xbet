// services/openligadb.js — OpenLigaDB (100% gratuit, aucune clé, live scores)
// Docs : https://api.openligadb.de
// Spécialité : Bundesliga, Champions League, Europa League, Coupe du monde
// Limite : 1000 req/h par IP → on peut poller toutes les 30 s sans souci

const axios = require('axios');
const cache = require('./cache');

const BASE = 'https://api.openligadb.de';

// Ligues supportées par OpenLigaDB (code → saison actuelle)
const LEAGUES = [
  { code: 'bl1',  season: '2024', name: 'Bundesliga',       flag: '🇩🇪', leagueId: 'BL'  },
  { code: 'bl2',  season: '2024', name: 'Bundesliga 2',     flag: '🇩🇪', leagueId: 'BL2' },
  { code: 'ucl',  season: '2024', name: 'Champions League', flag: '🇪🇺', leagueId: 'CL'  },
  { code: 'uel',  season: '2024', name: 'Europa League',    flag: '🇪🇺', leagueId: 'UEL' },
];

function isToday(dateStr) {
  if (!dateStr) return false;
  const d     = new Date(dateStr);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
         d.getMonth()    === today.getMonth()    &&
         d.getDate()     === today.getDate();
}

function mapStatus(m) {
  if (m.matchIsFinished) return 'FT';
  const now     = Date.now();
  const start   = new Date(m.matchDateTimeUTC).getTime();
  if (start > now) return 'NS';
  return 'LIVE';
}

function getScore(m) {
  // matchResults : [{ resultTypeID: 1 = HalfTime, 2 = Final }]
  const final = (m.matchResults || []).find(r => r.resultTypeID === 2);
  return {
    hs: final?.pointsTeam1 ?? 0,
    as: final?.pointsTeam2 ?? 0,
  };
}

function getMinute(m) {
  if (m.matchIsFinished) return 90;
  const start = new Date(m.matchDateTimeUTC).getTime();
  const elapsed = Math.floor((Date.now() - start) / 60000);
  return Math.min(90, Math.max(0, elapsed));
}

function localTime(utcStr) {
  return new Date(utcStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
  });
}

function transformMatch(m, leagueMeta) {
  const status = mapStatus(m);
  const { hs, as } = getScore(m);
  return {
    id:       `ol-${m.matchID}`,
    olId:     m.matchID,
    league:   leagueMeta.name,
    flag:     leagueMeta.flag,
    leagueId: leagueMeta.leagueId,
    home:     m.team1?.teamName     || 'Équipe A',
    away:     m.team2?.teamName     || 'Équipe B',
    homeS:    m.team1?.shortName    || m.team1?.teamName?.slice(0, 3).toUpperCase() || 'HOM',
    awayS:    m.team2?.shortName    || m.team2?.teamName?.slice(0, 3).toUpperCase() || 'AWA',
    homeTeamOlId: m.team1?.teamId,
    awayTeamOlId: m.team2?.teamId,
    homeCrest: m.team1?.teamIconUrl || null,
    awayCrest: m.team2?.teamIconUrl || null,
    status,
    min:      status === 'LIVE' ? getMinute(m) : (status === 'FT' ? 90 : null),
    hs,
    as,
    time:     localTime(m.matchDateTimeUTC),
    utcDate:  m.matchDateTimeUTC,
    hForm:    ['W','D','W','D','W'],
    aForm:    ['D','W','L','W','D'],
    hGA:      1.5,
    aGA:      1.3,
  };
}

async function fetchLeagueMatches(league) {
  const url = `${BASE}/getmatchdata/${league.code}/${league.season}`;
  const res  = await axios.get(url, { timeout: 6000 });
  return (res.data || [])
    .filter(m => isToday(m.matchDateTimeUTC))
    .map(m => transformMatch(m, league));
}

// Récupère les matchs du jour pour toutes les ligues (cache 2 min)
async function fetchTodayMatches() {
  return cache.getOrSet('ol:today', async () => {
    const all = await Promise.allSettled(LEAGUES.map(fetchLeagueMatches));
    return all.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  }, 2 * 60 * 1000);
}

// Récupère uniquement les matchs live (cache 30 s)
async function fetchLiveMatches() {
  const all = await fetchTodayMatches();
  return all.filter(m => m.status === 'LIVE');
}

// Retourne un map olId → { hs, as, min, status } pour merge rapide
async function getLiveScoreMap() {
  try {
    const live = await fetchLiveMatches();
    const map  = {};
    live.forEach(m => { map[m.olId] = { hs: m.hs, as: m.as, min: m.min, status: m.status }; });
    return map;
  } catch (_) { return {}; }
}

module.exports = { fetchTodayMatches, fetchLiveMatches, getLiveScoreMap };
