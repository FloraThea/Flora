# Flora — Déploiement mobile et PWA

Flora est une application Next.js installable sur iPhone et Android (PWA). Ce guide couvre le déploiement sur Vercel et l’installation sur smartphone.

## Prérequis

- Compte [Vercel](https://vercel.com) connecté à GitHub
- Projet Supabase configuré (URL + clé anon + connexion Postgres pour les migrations)
- Bucket Cloudflare R2 pour les documents (clés S3, jamais exposées côté client)
- Clé API Gemini (analyse de documents)

## Commandes de vérification locale

```bash
npm install
npm run build
npm run dev
```

- `npm run build` doit se terminer sans erreur TypeScript.
- `npm run dev` lance l’app sur http://localhost:3000 — testez le menu mobile (hamburger) et les tableaux larges (scroll horizontal).

## Déployer sur Vercel

1. **Pousser le dépôt** sur GitHub (sans `.env.local` — voir section sécurité).
2. **Importer le projet** dans Vercel : *Add New → Project* → sélectionner le repo `flora`.
3. **Framework** : Next.js (détecté automatiquement).
4. **Build command** : `npm run build` (défaut).
5. **Output** : `.next` (défaut Next.js).
6. **Variables d’environnement** : ajouter toutes celles listées ci-dessous (Production + Preview si besoin).
7. **Deploy** — après le premier déploiement, ouvrir l’URL Vercel depuis un smartphone pour tester l’installation PWA.

### Migrations Supabase en production

Après le premier déploiement :

1. Ouvrir `https://votre-domaine.vercel.app/administration`
2. Définir `FLORA_ADMIN_SECRET` dans Vercel, puis utiliser le bouton « Appliquer les migrations »  
   **ou** exécuter les fichiers SQL dans `supabase/migrations/` via le SQL Editor Supabase.

## Variables d’environnement (Vercel)

| Variable | Obligatoire | Exposée client | Description |
|----------|-------------|----------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Oui | Oui | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Oui | Oui | Clé anon Supabase (RLS) |
| `SUPABASE_DATABASE_URL` | Oui* | Non | URI Postgres (migrations, port 5432) |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Oui** | Non | ID compte Cloudflare |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Oui** | Non | Clé d’accès S3 R2 |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Oui** | Non | Secret S3 R2 |
| `CLOUDFLARE_R2_BUCKET_NAME` | Oui** | Non | Nom du bucket (ex. `flora-documents`) |
| `CLOUDFLARE_R2_ENDPOINT` | Oui** | Non | `https://ACCOUNT_ID.r2.cloudflarestorage.com` |
| `GEMINI_API_KEY` | Oui | Non | API Google Gemini |
| `FLORA_STORAGE_PROVIDER` | Non | Non | `cloudflare_r2` (défaut) ou `supabase` |
| `FLORA_MAX_UPLOAD_BYTES` | Non | Non | Taille max upload (défaut 500 Mo) |
| `FLORA_ADMIN_SECRET` | Recommandé | Non | Secret pour `/administration` en prod |
| `FLORA_AUTO_MIGRATE` | Non | Non | `true` pour migrations au démarrage (optionnel) |

\* Requis pour les migrations automatiques et l’administration.  
\*\* Requis si `FLORA_STORAGE_PROVIDER=cloudflare_r2`.

**Ne jamais** préfixer les clés R2 ou Gemini par `NEXT_PUBLIC_`.

Référence complète : fichier `.env.example` à la racine du projet.

## Sécurité Git

- `.gitignore` ignore `.env*` et `.vercel`.
- Ne commitez **jamais** `.env.local`, clés R2, clés service Supabase, ni `FLORA_ADMIN_SECRET`.
- Les clés Supabase anon sont publiques par design ; la sécurité repose sur les RLS Supabase.

## Installer Flora sur iPhone

1. Ouvrir **Safari** (obligatoire pour l’installation PWA sur iOS).
2. Aller sur l’URL de production Flora (ex. `https://flora.vercel.app`).
3. Appuyer sur le bouton **Partager** (carré avec flèche).
4. Choisir **« Sur l’écran d’accueil »**.
5. Confirmer le nom **Flora**, puis **Ajouter**.

L’icône 🌿 apparaît sur l’écran d’accueil. L’app s’ouvre en mode plein écran (`standalone`).

## Installer Flora sur Android

1. Ouvrir **Chrome** sur l’URL de production.
2. Si proposé : appuyer sur **« Installer »** ou **« Ajouter à l’écran d’accueil »** dans la bannière.
3. Sinon : menu **⋮** → **« Installer l’application »** ou **« Ajouter à l’écran d’accueil »**.

Le manifest PWA (`/manifest.webmanifest`) et le service worker (`/sw.js`) permettent l’installation native.

## PWA — éléments techniques

| Fichier | Rôle |
|---------|------|
| `app/manifest.ts` | Nom, couleurs, icônes, `display: standalone` |
| `app/layout.tsx` | Métadonnées, viewport, `theme-color`, Apple Web App |
| `app/icon.tsx` / `app/apple-icon.tsx` | Icônes générées |
| `public/icons/flora-icon.svg` | Icône SVG |
| `public/sw.js` | Service worker minimal (installation Android) |
| `components/PwaRegister.tsx` | Enregistrement du SW au chargement |

Couleurs Flora : vert sauge `#4a6752`, fond `#f4f7f2`.

## Vérifications post-déploiement

- [ ] Page d’accueil / planificateur annuel charge correctement
- [ ] Connexion Supabase (données programmation, progression, EDT)
- [ ] Upload bibliothèque (R2) depuis un fichier test
- [ ] Menu mobile et navigation latérale
- [ ] Installation PWA depuis Safari (iOS) et Chrome (Android)
- [ ] `GET /api/pedagogical/status` répond (moteur pédagogique)

## Dépannage

| Problème | Piste |
|----------|--------|
| Build Vercel échoue | Relancer `npm run build` en local, corriger les erreurs TypeScript |
| Données vides | Vérifier `NEXT_PUBLIC_SUPABASE_*` dans Vercel |
| Upload échoue | Vérifier les 5 variables R2 ; logs fonction Vercel |
| Pas d’icône iOS | Utiliser Safari ; vider cache ; revérifier `/apple-icon` |
| Migrations manquantes | `/administration` ou SQL Editor Supabase |
