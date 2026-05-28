# 🎾 PadelTournoi

Application PWA de gestion de tournois de padel — temps réel, mobile-first.

---

## ✅ Fonctionnalités

- Inscription des équipes (doublettes) en ligne via lien partagé
- Génération automatique des poules (tirage au sort)
- Saisie des scores en temps réel (synchronisé pour tous)
- Classement de poule automatique (pts / goal-difference)
- Génération automatique du tableau de phase finale (bracket)
- Arbre de phase finale avec propagation des vainqueurs
- Podium et palmarès final
- Mode organisateur protégé par code
- Installable sur téléphone (PWA)

---

## 🚀 Déploiement — Étape par étape

### ÉTAPE 1 — Configurer Supabase (base de données)

1. Va sur **supabase.com** et ouvre ton projet
2. Dans le menu gauche, clique sur **SQL Editor**
3. Clique **New Query**
4. Copie-colle tout le contenu du fichier `supabase-schema.sql`
5. Clique **Run** — tu devrais voir "Success"
6. Va dans **Settings > API**
7. Note :
   - **Project URL** (ex: `https://abcdef.supabase.co`)
   - **anon public key** (longue chaîne JWT)

### ÉTAPE 2 — Configurer les variables d'environnement

1. Copie le fichier `.env.example` en `.env` :
   ```
   cp .env.example .env
   ```
2. Ouvre `.env` et remplis tes clés :
   ```
   VITE_SUPABASE_URL=https://TONPROJET.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

### ÉTAPE 3 — Mettre le code sur GitHub

1. Va sur **github.com** et crée un **nouveau repository** (ex: `padel-tournoi`)
2. Sur ton ordinateur, ouvre un terminal dans ce dossier et tape :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/TONUSERNAME/padel-tournoi.git
   git push -u origin main
   ```

### ÉTAPE 4 — Déployer sur Vercel

1. Va sur **vercel.com**
2. Clique **Add New Project**
3. Sélectionne ton repo GitHub `padel-tournoi`
4. Dans **Environment Variables**, ajoute :
   - `VITE_SUPABASE_URL` → ta valeur
   - `VITE_SUPABASE_ANON_KEY` → ta valeur
5. Clique **Deploy**
6. En 2 minutes, ton site est en ligne à une URL type `padel-tournoi.vercel.app`

### ÉTAPE 5 — Tester

1. Ouvre l'URL sur ton téléphone
2. Crée un tournoi → note bien ton **code organisateur**
3. Inscris quelques équipes
4. Active le mode organisateur avec ton code
5. Génère les poules → saisis des scores → génère la finale !

---

## 📱 Installer sur téléphone

### iPhone (Safari) :
- Ouvre le site dans Safari
- Tape le bouton **Partager** (carré avec flèche)
- **Sur l'écran d'accueil**

### Android (Chrome) :
- Ouvre le site dans Chrome
- Menu **⋮** > **Ajouter à l'écran d'accueil**

---

## 🔧 Développement local

```bash
npm install
npm run dev
```
Ouvre `http://localhost:5173`

---

## 🏗️ Architecture

```
padel-tournoi/
├── index.html              # Point d'entrée HTML
├── vite.config.js          # Config Vite + PWA
├── supabase-schema.sql     # Schéma base de données
├── .env.example            # Template variables d'env
├── public/
│   └── manifest.json       # Manifest PWA
└── src/
    ├── main.js             # App principale (routing, pages, actions)
    ├── styles.css          # Styles globaux
    └── lib/
        ├── supabase.js     # Client Supabase + toutes les requêtes DB
        └── tournament.js   # Logique métier (poules, bracket, classement)
```

---

## 💡 Prochaines évolutions possibles

- Notifications push (prévenir les joueurs de leur prochain match)
- QR code d'inscription automatique
- Historique des tournois
- Profils joueurs avec statistiques
- Format simple (sans poules, bracket direct)
- Export PDF du tableau

---

## 🆘 Problèmes fréquents

**"Tournoi introuvable"** → Vérifie que l'ID dans l'URL est correct

**Scores ne se sauvegardent pas** → Vérifie tes clés Supabase dans `.env`

**Site ne se déploie pas sur Vercel** → Vérifie que les variables d'env sont bien ajoutées dans Vercel (pas seulement dans `.env`)
