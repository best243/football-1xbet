// services/thesportsdb.js — TheSportsDB (gratuit, clé publique = 3)
// Utilisé pour : logos équipes, couleurs, infos visuelles
// Limite : 30 req/min — on cache agressivement (24 h par équipe)

const axios = require('axios');
const cache = require('./cache');

const BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const TTL  = 24 * 60 * 60 * 1000; // 24 h

// Recherche un logo par nom d'équipe
async function fetchTeamInfo(teamName) {
  const key = `tsdb:${teamName.toLowerCase().replace(/\s+/g, '_')}`;
  return cache.getOrSet(key, async () => {
    const res  = await axios.get(`${BASE}/searchteams.php`, {
      params: { t: teamName }, timeout: 5000,
    });
    const team = res.data?.teams?.[0];
    if (!team) return null;
    return {
      logo:    team.strTeamBadge   || null,
      thumb:   team.strTeamFanart1 || team.strTeamBadge || null,
      stadium: team.strStadium     || null,
      country: team.strCountry     || null,
      color:   team.strColour1     || null,   // ex: "Red"
      color2:  team.strColour2     || null,
    };
  }, TTL);
}

// Recherche par ID football-data.org (certaines équipes ont leur ID mappé)
async function fetchTeamById(tsdbId) {
  if (!tsdbId) return null;
  const key = `tsdb:id:${tsdbId}`;
  return cache.getOrSet(key, async () => {
    const res  = await axios.get(`${BASE}/lookupteam.php`, {
      params: { id: tsdbId }, timeout: 5000,
    });
    const team = res.data?.teams?.[0];
    if (!team) return null;
    return { logo: team.strTeamBadge, stadium: team.strStadium };
  }, TTL);
}

// Enrichit un tableau de matchs avec les logos — batch avec délai pour respecter la limite
async function enrichMatchesWithLogos(matches) {
  const enriched = [...matches];
  const teams    = new Set();

  matches.forEach(m => {
    if (!m.homeCrest) teams.add(m.home);
    if (!m.awayCrest) teams.add(m.away);
  });

  // Résoudre logos en parallèle (max 5 simultanés pour ne pas surcharger l'API)
  const teamNames = [...teams];
  const logoMap   = {};

  for (let i = 0; i < teamNames.length; i += 5) {
    const batch   = teamNames.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map(async name => {
      const info = await fetchTeamInfo(name);
      return { name, logo: info?.logo || null };
    }));
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value.logo) {
        logoMap[r.value.name] = r.value.logo;
      }
    });
    if (i + 5 < teamNames.length) await sleep(500); // 500 ms entre les batches
  }

  enriched.forEach(m => {
    if (!m.homeCrest && logoMap[m.home]) m.homeCrest = logoMap[m.home];
    if (!m.awayCrest && logoMap[m.away]) m.awayCrest = logoMap[m.away];
  });

  return enriched;
}

// Couleur CSS depuis le nom anglais retourné par TheSportsDB
const COLOR_NAMES = {
  red: '#e53935', blue: '#1e88e5', green: '#43a047', yellow: '#f5a623',
  black: '#1a1a1a', white: '#f5f5f5', orange: '#fb8c00', purple: '#8e24aa',
  maroon: '#880e4f', navy: '#1a237e', gold: '#fdd835', claret: '#880e4f',
  amber: '#ffb300', sky: '#29b6f6', grey: '#757575', gray: '#757575',
  royal: '#1565c0', crimson: '#c62828', lime: '#9e9d24', teal: '#00897b',
};

function cssColor(colorName) {
  if (!colorName) return '#333';
  const lower = colorName.toLowerCase().trim();
  return COLOR_NAMES[lower] || '#333';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { fetchTeamInfo, fetchTeamById, enrichMatchesWithLogos, cssColor };
