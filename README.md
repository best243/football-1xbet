# ⚽ FootLive — Scores Football en Direct

Site de suivi de matchs de football en direct avec thème inspiré 1xbet, pronostics IA et chatbot.

## Fonctionnalités

- 🔴 **Scores en direct** via WebSocket (Socket.io) — mise à jour toutes les 30 s
- 📊 **Pronostics IA** basés sur la distribution de Poisson (modèle Dixon-Coles)
- 🤖 **Chatbot FootBot** — analyse et pronostics par commande texte
- 🎯 **Cases 1/X/2** style 1xbet avec probabilités
- 📡 **Ticker live** scrollant en haut de page
- 🏆 14 matchs sur 6 ligues (Ligue 1, La Liga, PL, Serie A, Bundesliga, Liga Portugal)
- 💬 Chat en direct par match
- ▶️ Lecteur HLS.js + iframe YouTube/Dailymotion

## Lancer en local

```bash
npm install
npm start
# → http://localhost:4001
```

## Déploiement

### Railway (recommandé)
1. Connecter ce repo sur [railway.app](https://railway.app)
2. Railway détecte automatiquement Node.js
3. Variable d'environnement : `PORT` (Railway l'injecte automatiquement)

### Render
1. New Web Service → connecter ce repo
2. Build command : `npm install`
3. Start command : `npm start`

### Heroku
```bash
heroku create footlive-app
git push heroku main
```

## Structure

```
├── server.js          # Backend Express + Socket.io + API REST
├── public/
│   ├── index.html     # Page d'accueil (style 1xbet)
│   ├── match.html     # Page match + streaming
│   └── assets/
│       ├── style.css  # Thème 1xbet complet
│       ├── app.js     # Logique page d'accueil
│       ├── match.js   # Logique page match
│       ├── pronostic.js # Moteur Poisson IA
│       └── chatbot.js # FootBot — chatbot pronostics
```

## Commandes FootBot

| Commande | Réponse |
|---|---|
| `Matchs en direct` | Scores live + favoris |
| `Pronostic PSG` | Analyse complète avec barres |
| `Meilleur pronostic` | Paris le plus fiable du jour |
| `Résumé du jour` | Bilan complet |
| `Statistiques Bayern` | Forme + λ Poisson |

## Conformité ANJ

- Bandeau "jeu responsable" sur toutes les pages
- Numéro Joueurs Info Service : 09 74 75 13 13
- Pronostics marqués "à titre éducatif uniquement"
- `rel="nofollow sponsored"` sur liens bookmakers

---
> ⚠️ Les paris sportifs comportent un risque de dépendance. 18+ uniquement.
