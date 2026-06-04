// channels.js — Chaînes sportives gratuites (sources légales free-to-air)
// Ajouter vos propres sources légales ici.
// ⚠️ N'ajoutez PAS de chaînes payantes (beIN, Canal+, Sky) — flux non autorisés.

const LIVE_CHANNELS = [
  {
    id:   'equidia',
    name: 'Equidia Live',
    flag: '🐎',
    type: 'm3u8',
    // Source : ParaTV / iptv-org — chaîne hippisme française gratuite en clair
    url:  '/api/relay?url=' + encodeURIComponent(
      'https://raw.githubusercontent.com/Paradise-91/ParaTV/main/streams/equidia/live2.m3u8'
    ),
    note: 'Sport équestre · Gratuit FR',
  },
  {
    id:   'france24',
    name: 'France 24',
    flag: '🌍',
    type: 'youtube',
    // Chaîne YouTube officielle France 24 — live 24/7, couvre le sport international
    url:  'https://www.youtube.com/embed/l8PMl7tUDIE?autoplay=1&mute=1',
    note: 'Info & sport · YouTube officiel',
  },
  {
    id:   'euronews',
    name: 'Euronews',
    flag: '🇪🇺',
    type: 'youtube',
    // Chaîne YouTube officielle Euronews — live 24/7
    url:  'https://www.youtube.com/embed/MWrPmHTu-OI?autoplay=1&mute=1',
    note: 'Actu sport Europe · YouTube officiel',
  },
];

// Pour ajouter vos propres chaînes m3u8 légales :
// { id:'mychanel', name:'Ma Chaîne', flag:'🇫🇷', type:'m3u8',
//   url:'/api/relay?url=' + encodeURIComponent('https://votre-url.m3u8'), note:'Description' }
