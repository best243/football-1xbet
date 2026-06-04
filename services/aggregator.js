// services/aggregator.js — Combine les 3 API en format unifié
// Ordre de priorité : football-data.org → OpenLigaDB → mock data

const footballData = require('./footballdata');
const openLigaDB   = require('./openligadb');
const theSportsDB  = require('./thesportsdb');
const cache        = require('./cache');

// ── Couleurs équipes (fallback si TheSportsDB ne retourne pas de couleur) ───
const TEAM_COLORS = {
  // Premier League
  'Arsenal FC':'#EF0107','Chelsea FC':'#034694','Manchester City FC':'#6CABDD',
  'Liverpool FC':'#C8102E','Manchester United FC':'#DA291C',
  'Tottenham Hotspur FC':'#132257','Newcastle United FC':'#241F20',
  'West Ham United FC':'#7A263A','Brighton & Hove Albion FC':'#0057B8',
  'Aston Villa FC':'#670E36','Everton FC':'#003399','Fulham FC':'#CC0000',
  'Wolverhampton Wanderers FC':'#FDB913','Brentford FC':'#E30613',
  'Crystal Palace FC':'#1B458F','Nottingham Forest FC':'#DD0000',
  'AFC Bournemouth':'#DA291C','Arsenal':'#EF0107','Chelsea':'#034694',
  'Manchester City':'#6CABDD','Liverpool':'#C8102E','Manchester United':'#DA291C',
  'Tottenham Hotspur':'#132257','Tottenham':'#132257','Newcastle United':'#241F20',
  // La Liga
  'Real Madrid CF':'#FEBE10','FC Barcelona':'#A50044',
  'Club Atlético de Madrid':'#CE3524','Sevilla FC':'#D01111',
  'Valencia CF':'#F7A501','Villarreal CF':'#F7D117','Real Betis Balompié':'#00954C',
  'Athletic Club':'#EE2523','Real Sociedad de Fútbol':'#0A3E72',
  'Real Madrid':'#FEBE10','Barcelona':'#A50044','Atlético Madrid':'#CE3524',
  'Sevilla':'#D01111','Valencia':'#F7A501','Villarreal':'#F7D117',
  // Ligue 1
  'Paris Saint-Germain FC':'#001E62','Olympique de Marseille':'#2196F3',
  'AS Monaco FC':'#E60012','Olympique Lyonnais':'#0066B2','OGC Nice':'#D30000',
  'RC Lens':'#E30613','Stade Rennais FC 1901':'#D80026','LOSC Lille':'#C41E3A',
  'Stade de Reims':'#D10A14','Montpellier HSC':'#0050A0',
  'Paris Saint-Germain':'#001E62','Marseille':'#2196F3',
  'Monaco':'#E60012','Lyon':'#0066B2','Nice':'#D30000',
  // Bundesliga
  'FC Bayern München':'#DC052D','Borussia Dortmund':'#FDE100',
  'RasenBallsport Leipzig':'#CC0000','Bayer 04 Leverkusen':'#E32221',
  'Eintracht Frankfurt':'#E1000F','SV Werder Bremen':'#009A44',
  '1. FC Union Berlin':'#EB1923','Sport-Club Freiburg':'#CC0000',
  'Borussia VfL 1900 Mönchengladbach':'#009B5B',
  'Bayern München':'#DC052D','Bayern Munich':'#DC052D',
  'RB Leipzig':'#CC0000','Bayer Leverkusen':'#E32221',
  // Serie A
  'Juventus FC':'#2c2c2c','AC Milan':'#C0272D',
  'FC Internazionale Milano':'#0068A8','SSC Napoli':'#003DA5',
  'AS Roma':'#8B1A1A','SS Lazio':'#87CEEB','ACF Fiorentina':'#6B2D8B',
  'Atalanta BC':'#1E3A8A','Torino FC':'#8B0000','Bologna FC 1909':'#0000CD',
  'Juventus':'#2c2c2c','Inter Milan':'#0068A8','Napoli':'#003DA5',
  'Roma':'#8B1A1A','Lazio':'#87CEEB','Fiorentina':'#6B2D8B',
  // Liga Portugal
  'FC Porto':'#003087','SL Benfica':'#C01B14','Sporting CP':'#006400',
  'SC Braga':'#CC0000',
  // Champions League / Europa
  'AFC Ajax':'#D2001E','PSV':'#E62020','Feyenoord':'#CC0000',
};

// Couleurs équipes nationales (Coupe du Monde 2026)
const NATIONAL_COLORS = {
  'France':'#002395','Germany':'#000000','Spain':'#AA151B','Portugal':'#006600',
  'Argentina':'#74ACDF','Brazil':'#009C3B','England':'#FFFFFF','Netherlands':'#FF4500',
  'Belgium':'#000000','Italy':'#0066CC','Croatia':'#FF0000','Uruguay':'#75AADB',
  'Switzerland':'#FF0000','Denmark':'#C60C30','Austria':'#ED2939','Sweden':'#006AA7',
  'Poland':'#DC143C','Czechia':'#D7141A','Slovakia':'#0B4EA2','Serbia':'#C6363C',
  'Ukraine':'#005BBB','Scotland':'#003087','Wales':'#C8102E','Turkey':'#E30A17',
  'Morocco':'#006233','Senegal':'#00853F','Ivory Coast':'#F77F00','Ghana':'#006B3F',
  'Cameroon':'#007A5E','Nigeria':'#008751','Tunisia':'#E70013','Egypt':'#CE1126',
  'Algeria':'#006233','South Africa':'#007A4D','Kenya':'#006600',
  'Mexico':'#006847','United States':'#B22234','Canada':'#FF0000',
  'Ecuador':'#FFD100','Colombia':'#FCD116','Chile':'#D52B1E',
  'Peru':'#D91023','Venezuela':'#CF142B','Bolivia':'#009A44',
  'Japan':'#BC002D','South Korea':'#CD2E3A','Korea Republic':'#CD2E3A',
  'Australia':'#00008B','Iran':'#239F40','Saudi Arabia':'#006C35',
  'Qatar':'#8D1B3D','China':'#DE2910','Iraq':'#CE1126','Uzbekistan':'#1EB53A',
  'New Zealand':'#000000','Haiti':'#00209F','Scotland':'#003087',
  'Jamaica':'#000000','Honduras':'#0073CF','Panama':'#005293',
  'Costa Rica':'#002B7F','Guatemala':'#4997D0',
};

function getTeamColor(name) {
  return TEAM_COLORS[name] || NATIONAL_COLORS[name] || '#1a3a6b';
}

// ── Données mock (fallback si toutes les API échouent) ────────────────────────
const MOCK = [
  { id:'m001',league:'Ligue 1',flag:'🇫🇷',leagueId:'L1',
    home:'Paris Saint-Germain',away:'Olympique de Marseille',homeS:'PSG',awayS:'OM',
    homeC:'#001E62',awayC:'#2196F3',status:'LIVE',min:67,hs:2,as:1,time:'20:45',
    hForm:['W','W','D','W','L'],aForm:['L','W','D','D','W'],hGA:2.4,aGA:1.6},
  { id:'m002',league:'La Liga',flag:'🇪🇸',leagueId:'LIGA',
    home:'Real Madrid',away:'FC Barcelona',homeS:'RMA',awayS:'FCB',
    homeC:'#FEBE10',awayC:'#A50044',status:'LIVE',min:34,hs:0,as:1,time:'21:00',
    hForm:['W','W','W','D','W'],aForm:['W','D','W','W','W'],hGA:2.1,aGA:2.3},
  { id:'m003',league:'Premier League',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',leagueId:'PL',
    home:'Manchester City',away:'Liverpool',homeS:'MCI',awayS:'LIV',
    homeC:'#6CABDD',awayC:'#C8102E',status:'NS',min:null,hs:0,as:0,time:'17:30',
    hForm:['W','D','W','W','W'],aForm:['W','W','D','L','W'],hGA:2.8,aGA:2.2},
  { id:'m004',league:'Bundesliga',flag:'🇩🇪',leagueId:'BL',
    home:'Bayern Munich',away:'Borussia Dortmund',homeS:'FCB',awayS:'BVB',
    homeC:'#DC052D',awayC:'#FDE100',status:'LIVE',min:41,hs:3,as:1,time:'18:30',
    hForm:['W','W','W','W','D'],aForm:['W','L','W','D','W'],hGA:3.1,aGA:2.0},
  { id:'m005',league:'Serie A',flag:'🇮🇹',leagueId:'SA',
    home:'Juventus FC',away:'AC Milan',homeS:'JUV',awayS:'MIL',
    homeC:'#2c2c2c',awayC:'#C0272D',status:'FT',min:90,hs:1,as:2,time:'18:00',
    hForm:['D','W','L','D','W'],aForm:['W','D','W','D','L'],hGA:1.5,aGA:1.7},
  { id:'m006',league:'Champions League',flag:'🇪🇺',leagueId:'CL',
    home:'FC Barcelona',away:'Arsenal FC',homeS:'FCB',awayS:'ARS',
    homeC:'#A50044',awayC:'#EF0107',status:'NS',min:null,hs:0,as:0,time:'21:00',
    hForm:['W','W','D','W','W'],aForm:['W','D','W','W','D'],hGA:2.3,aGA:1.9},
];

// ── Normalisation texte pour comparaison de noms ──────────────────────────────
function norm(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\bfc\b|\bac\b|\bsc\b|\brc\b|\bsk\b|\bvfl\b|\bsv\b|\bsv\b/g, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function teamsMatch(a, b) {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Chevauchement de mots clés
  const wa = na.split(' ').filter(w => w.length > 2);
  const wb = nb.split(' ').filter(w => w.length > 2);
  return wa.some(w => wb.includes(w));
}

// ── Merging OpenLigaDB dans les matchs existants ──────────────────────────────
function mergeOpenLigaScores(matches, olMatches) {
  const merged = [...matches];
  olMatches.forEach(ol => {
    const existing = merged.find(m =>
      teamsMatch(m.home, ol.home) && teamsMatch(m.away, ol.away)
    );
    if (existing) {
      // OpenLigaDB est la source de vérité pour les scores Bundesliga/CL live
      if (ol.status === 'LIVE') {
        existing.status = 'LIVE';
        existing.hs     = ol.hs;
        existing.as     = ol.as;
        existing.min    = ol.min;
      } else if (ol.status === 'FT') {
        existing.status = 'FT';
        existing.hs     = ol.hs;
        existing.as     = ol.as;
      }
      // Ajouter logo OpenLigaDB si pas encore de logo
      if (!existing.homeCrest && ol.homeCrest) existing.homeCrest = ol.homeCrest;
      if (!existing.awayCrest && ol.awayCrest) existing.awayCrest = ol.awayCrest;
    } else {
      // Match introuvable dans football-data → l'ajouter
      merged.push(ol);
    }
  });
  return merged;
}

// ── Enrichissement avec la forme réelle ──────────────────────────────────────
async function applyRealForm(matches) {
  try {
    const { form, goals } = await footballData.buildFormMap();
    if (!Object.keys(form).length) return matches;

    return matches.map(m => {
      const hId = m.homeTeamId, aId = m.awayTeamId;
      const hForm = form[hId]?.length >= 3 ? form[hId] : m.hForm;
      const aForm = form[aId]?.length >= 3 ? form[aId] : m.aForm;
      const hGoals = goals[hId];
      const aGoals = goals[aId];
      return {
        ...m,
        hForm,
        aForm,
        hGA: hGoals?.[2] ? Number((hGoals[0] / hGoals[2]).toFixed(2)) : m.hGA,
        aGA: aGoals?.[2] ? Number((aGoals[0] / aGoals[2]).toFixed(2)) : m.aGA,
      };
    });
  } catch (_) {
    return matches;
  }
}

// ── Point d'entrée principal ──────────────────────────────────────────────────
async function getMatches() {
  return cache.getOrSet('agg:matches', async () => {
    let matches = [];
    let source  = 'mock';

    // 1. Tentative football-data.org
    if (footballData.ENABLED) {
      try {
        matches = await footballData.fetchTodayMatches();
        source  = 'football-data.org';
        console.log(`[API] football-data.org → ${matches.length} matchs`);
      } catch (e) {
        console.warn('[API] football-data.org indisponible :', e.message);
      }
    }

    // 2. Enrichissement OpenLigaDB (Bundesliga + CL live)
    try {
      const olMatches = await openLigaDB.fetchTodayMatches();
      console.log(`[API] OpenLigaDB → ${olMatches.length} matchs`);
      if (olMatches.length) {
        matches = matches.length
          ? mergeOpenLigaScores(matches, olMatches)
          : olMatches;
        if (source === 'mock') source = 'openligadb';
      }
    } catch (e) {
      console.warn('[API] OpenLigaDB indisponible :', e.message);
    }

    // 3. Fallback mock si aucune API
    if (!matches.length) {
      console.warn('[API] Toutes les API indisponibles → données mock');
      matches = MOCK;
      source  = 'mock';
    }

    // 4. Appliquer couleurs équipes
    matches = matches.map(m => ({
      ...m,
      homeC: m.homeC || getTeamColor(m.home),
      awayC: m.awayC || getTeamColor(m.away),
    }));

    // 5. Enrichissement logos TheSportsDB (sans bloquer)
    theSportsDB.enrichMatchesWithLogos(matches)
      .then(enriched => {
        // Mettre à jour le cache avec les logos
        cache.set('agg:matches', enriched, 4 * 60 * 1000);
      })
      .catch(() => {});

    // 6. Forme réelle depuis football-data.org
    if (footballData.ENABLED) {
      matches = await applyRealForm(matches);
    }

    console.log(`[AGG] ${matches.length} matchs agrégés (source: ${source})`);
    return matches;
  }, 4 * 60 * 1000); // cache 4 min
}

// Mise à jour forcée des scores live (appelée toutes les 30 s)
async function refreshLiveScores(currentMatches) {
  const updated = [...currentMatches];
  let changed   = false;

  // OpenLigaDB pour Bundesliga/CL
  try {
    const olLive = await openLigaDB.fetchLiveMatches();
    olLive.forEach(ol => {
      const m = updated.find(x => teamsMatch(x.home, ol.home) && teamsMatch(x.away, ol.away));
      if (m && (m.hs !== ol.hs || m.as !== ol.as || m.min !== ol.min)) {
        m.status = ol.status; m.hs = ol.hs; m.as = ol.as; m.min = ol.min;
        changed = true;
      }
    });
  } catch (_) {}

  // football-data.org pour tout le reste
  if (footballData.ENABLED) {
    try {
      const fdLive = await footballData.fetchLiveMatches();
      fdLive.forEach(fd => {
        const m = updated.find(x => teamsMatch(x.home, fd.home) && teamsMatch(x.away, fd.away));
        if (m) {
          if (m.hs !== fd.hs || m.as !== fd.as || m.status !== fd.status) {
            m.status = fd.status; m.hs = fd.hs; m.as = fd.as; m.min = fd.min;
            changed = true;
          }
        }
      });
    } catch (_) {}
  }

  if (changed) {
    cache.set('agg:matches', updated, 4 * 60 * 1000);
  }

  return { matches: updated, changed };
}

module.exports = { getMatches, refreshLiveScores, MOCK };
