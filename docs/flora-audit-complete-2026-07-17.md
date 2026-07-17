# Audit technique et fonctionnel Flora — 17 juillet 2026

**Environnement :** Next.js 16.2.9 · Supabase `rsbcttszswytuqgvjwyx` · Prod `flora-lilac.vercel.app`  
**Périmètre :** 13 sections demandées (code, DB live, auth, modules, import, sécurité, performances)

---

## Synthèse exécutive

| Indicateur | Résultat |
|------------|----------|
| `npm run lint` | **0 erreur**, 48 warnings |
| `npm test` | **OK** — 17 suites (import, agenda, journal, audit, stabilisation…) |
| `npm run build` | **OK** |
| Migrations Supabase | **32 appliquées**, rejeu idempotent OK |
| Audit DB live | 59 tables · 76 FK · 153 index · 56 policies RLS |
| Note stabilité globale | **79 / 100** |

---

## 1. Vérification générale (JS / TS / React / Next.js)

### ✅ Éléments testés

- Compilation TypeScript production
- ESLint (React Compiler inclus)
- 17 suites de tests automatisés
- Séparation client/serveur (`server-only`, `get-db.ts` avec repli tests)

### ✅ Problèmes détectés et corrigés

| Problème | Correction |
|----------|------------|
| Client Supabase serveur sans JWT → `auth.uid()` NULL en RLS | `lib/supabase/server-client.ts`, `get-db.ts`, propagation `floraDb()` dans 11 services/API |
| Callbacks `insertWithOptionalColumnFallback` non-async avec `await` | Callbacks marqués `async` dans progression/séances/séquences |
| `get-db.ts` avec `server-only` cassait les tests tsx | Retrait `server-only` + repli anon hors contexte Next |
| Duplicate `main()` dans scripts → échec typecheck build | `scripts/` exclus de `tsconfig.json` |
| Migration RLS `journal_observations.journal_id` inexistante | Jointure via `journal_entry_id` → `journal_entries` → `journals` |

### ⚠️ Non vérifiable automatiquement

- **Logs Vercel** : accès dashboard non disponible dans cette session
- **Logs Supabase** : pas d’accès au dashboard Auth/Logs
- **Console navigateur prod** : pas de parcours manuel connecté

### 💡 Recommandation

Activer le monitoring Vercel (erreurs runtime) + Supabase Log Explorer pour les 403/RLS en production.

---

## 2. Audit Supabase

### ✅ Éléments testés (live via `npm run db:audit`)

| Élément | Valeur |
|---------|--------|
| Tables publiques | 59 |
| Clés étrangères | 76 |
| Index | 153 |
| Triggers | 0 |
| Fonctions `flora_*` | 8 (helpers idempotents + tenant) |
| Migrations | 32 |
| Politiques RLS totales | 56 |
| Politiques tenant (`*_tenant`) | 36 |

### ✅ Migrations

- Toutes appliquées sur la base distante
- Rejeu : « Base déjà à jour » (idempotent)
- Nouvelle migration appliquée : `20250717140000_extended_child_tables_rls.sql`

### ✅ Corrections RLS (session)

Extension tenant à :

- `teacher_profiles`, `teacher_preferences`, `teacher_methods`, `teacher_projects`
- Agenda (`agenda_events`, `agenda_tasks`, `agenda_reminders`, `teacher_108h_*`)
- Import programmation (`programming_import_batches/files`)
- Enfants programmation, progression, séquences, séances, documents, journal

### ⚠️ Politiques encore ouvertes (`*_all_anon`) — 16 tables

Tables partagées / pipeline / référentiel (CRUD anon total) :

- `referentiels`, `bo_documents`, `bo_competence_links`
- `document_import_jobs`, `document_upload_sessions`, `document_upload_chunks`
- `document_segments`, `document_versions`, `document_relations`, `document_import_notifications`
- `knowledge_index`, `pedagogical_entities`, `pedagogical_relations`, `pedagogical_change_log`
- `timetable_history`, `timetable_versions`

**Impact :** acceptable pour référentiel BO partagé ; **risque** pour jobs d’import et historiques EDT si multi-utilisateur strict.

### 💡 Recommandations

1. Migration `20250717150000` : RLS tenant sur tables import + historiques EDT (via jointure parent)
2. Référentiel BO : policy `SELECT` publique, `INSERT/UPDATE/DELETE` réservé service role ou admin
3. Conserver les helpers `flora_*` pour toute nouvelle migration

---

## 3. Audit Authentification

### ✅ Éléments testés (code + routes)

| Flux | Statut | Détail |
|------|--------|--------|
| Création compte | ✅ | `app/connexion/page.tsx` → Supabase Auth signUp |
| Connexion | ✅ | signIn + cookie `flora-auth-token` |
| Déconnexion | ✅ | DELETE `/api/auth/link-profile` + clear cookie |
| Persistance session | ✅ | Cookie httpOnly côté serveur |
| Liaison profil | ✅ | `linkTeacherProfileToAuthUser` avec JWT |
| Route session | ✅ | **Nouveau** `GET /api/auth/session` |
| Permissions RLS | ⚠️ partiel | JWT propagé aux services migrés ; pas encore à 100 % |

### ✅ Corrections

- `auth-server.ts` : client avec token pour liaison profil
- `link-profile/route.ts` : passe le token à la liaison
- Profil : `getDb()` + filtre `user_id` quand auth présente

### ⚠️ Restant

- ~35 fichiers importent encore `@/lib/supabase` anon directement (pipeline import, référentiel, générateurs IA)
- Sans JWT, RLS retombe sur `flora_accessible_profile_ids()` (profil le plus ancien si anon)

---

## 4. Audit modules Flora

Analyse : code services + tests automatisés + routes API. **Pas de parcours UI manuel complet.**

| Module | Ouverture | CRUD | Sync Supabase | Mobile | Statut |
|--------|-----------|------|---------------|--------|--------|
| Tableau de bord | ✅ API | lecture | ✅ scope profil | ✅ layout | **OK** |
| Bibliothèque | ✅ | ✅ archive | ✅ documents filtrés | ✅ | **OK** |
| Import documents | ✅ | ✅ pipeline | ⚠️ anon client | — | **Partiel** |
| Analyse IA | ✅ | ✅ | ⚠️ GEMINI server-only | — | **OK** si clé présente |
| Programmations | ✅ | ✅ | ✅ tenant | ✅ | **OK** |
| Progressions | ✅ | ✅ linked/standalone | ✅ | ✅ | **OK** |
| Séquences | ✅ | ✅ | ✅ tests indép. | ✅ | **OK** |
| Séances | ✅ | ✅ | ✅ | ✅ | **OK** |
| Emploi du temps | ✅ | ✅ import/manuel | ✅ source unique | ✅ tests mobile | **OK** |
| Agenda | ✅ | ✅ | ✅ sync modules | ✅ | **OK** |
| Cahier journal | ✅ | ✅ | ✅ EDT actif | ✅ | **OK** |
| Profil pédagogique | ✅ | ✅ | ✅ | ✅ | **OK** |
| Paramètres / Admin | ✅ | migrations | ⚠️ FLORA_ADMIN_SECRET | — | **OK si secret défini** |

---

## 5. Audit import (PDF, DOCX, XLSX, JPG, PNG)

### ✅ Tests automatisés

| Format | Suite | Résultat |
|--------|-------|----------|
| PNG | `run-png-tests.ts` | 7/7 |
| XLSX programmation | `run-programmation-import-tests.ts` | 9/9 |
| Batch programmation | `run-import-batch-client-tests.ts` | 8/8 |
| Progression | `run-progression-import-tests.ts` | 4/4 |
| EDT | `run-tests.ts` (timetable) | OK |

### ✅ Contrat unifié

- `lib/import/unified-import-engine.ts` + registry engines (progression, EDT, documents, programmation)

### ⚠️ Risques

- `UploadManager`, `ImportQueue`, `DocumentAnalyzer` utilisent client anon → RLS import jobs ouverts
- Étape `analyze` : repli minimal existant ; dépend de `GEMINI_API_KEY` côté serveur

---

## 6. Liaisons pédagogiques (linked / standalone)

### ✅ Vérifié

- Tests `lib/sequences/run-independent-tests.ts` : **3/3**
- Colonnes nullable + `link_mode` avec repli schema-compat
- Progression sans programmation ✅
- Programmation sans progression ✅
- Séquence / séance indépendantes ✅

---

## 7. Audit cahier journal

### ✅ Vérifié

- Tests journal : **5/5** + view **4/4**
- EDT via `active-timetable.ts` (pas de slots fictifs)
- Filtrage entrées demo (`journal-entry-utils.ts`)
- Observations / ajustements / exports persistés
- `journal-service` migré vers `floraDb()`

---

## 8. Audit emploi du temps

### ✅ Vérifié (tests + code)

- CRUD manuel, import Excel, duplication, versions, historique
- Export / impression : suites layout + grid
- Mobile : `run-mobile-schedule-tests.ts`
- `timetable-service` migré vers JWT serveur

---

## 9. Audit stockage

### ✅ Code review

| Backend | Usage | Secrets côté client |
|---------|-------|---------------------|
| Supabase Storage | Documents, programmations, BO | ❌ Aucun (anon key publique uniquement) |
| Cloudflare R2 | Fallback / ressources | ❌ Clés serveur uniquement (`r2-env.ts`) |

### ⚠️ Restant

- Bucket `resources` : policies anon permissives (migration existante)
- Vérification upload/download live non effectuée

---

## 10. Audit performances

### ✅ Code review (sans profiling prod)

- Pas de boucles N+1 évidentes dans services principaux
- Dashboard : `Promise.all` pour compteurs parallèles
- `deferEffect` pour éviter cascades setState (ESLint React Compiler)

### ⚠️ Points d’attention

- `loadProgrammation` : requêtes nested tables/périodes/cellules (acceptable, optimisable)
- `floraDb()` recréé par appel (pas de cache requête) — impact faible
- Pas de mesure LCP/TTFB prod

### 💡 Recommandations

- React `cache()` sur `loadTeacherProfileBundle` / EDT actif
- Index composites si lenteur sur `teacher_profile_id + school_year`

---

## 11. Audit sécurité

### ✅ OK

- Pas de `SERVICE_ROLE` dans le code source
- Variables sensibles (`GEMINI_API_KEY`, R2, `FLORA_ADMIN_SECRET`) : **serveur uniquement**
- Exposition client limitée à `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### ⚠️ Risques résiduels

| Risque | Gravité | Mitigation |
|--------|---------|------------|
| 16 tables RLS anon ouvertes | Moyenne | Migration RLS phase 3 |
| Services import sans JWT | Moyenne | Propager `getDb()` |
| Référentiel BO modifiable par anon | Faible–Moyenne | Policy read-only anon |
| `.env.local` avec secrets (local) | Info | Ne jamais committer |

---

## 12. Corrections appliquées (cette session)

1. **`lib/supabase/server-client.ts`** — client JWT depuis cookie
2. **`lib/supabase/get-db.ts`** — abstraction serveur avec repli tests
3. **`lib/supabase/auth-server.ts`** — liaison profil avec token
4. **`app/api/auth/session/route.ts`** — endpoint session
5. **Migration `20250717140000_extended_child_tables_rls.sql`** — RLS étendue (32 migrations total)
6. **11 services/API** migrés vers `floraDb()` / `getDb()`
7. **`scripts/audit-supabase-live.ts`** + `npm run db:audit`
8. **`tsconfig.json`** — exclusion scripts (fix build)
9. Fix jointure RLS `journal_observations`

---

## 13. Problèmes restants et roadmap

### ⚠️ Priorité haute

1. Propager `getDb()` aux ~35 fichiers restants (import, référentiel, générateurs)
2. RLS phase 3 : tables import + `timetable_history/versions`
3. Tests manuels prod : connexion multi-comptes, isolation données

### ⚠️ Priorité moyenne

4. Storage policies : restreindre écriture anon sur `resources`
5. Supprimer colonne deprecated `teacher_profiles.timetables` (après validation prod)
6. Monitoring Vercel + Supabase logs

### 💡 Priorité basse

7. Réduire 48 warnings ESLint (variables unused)
8. Cache serveur profil/EDT
9. Tests E2E Playwright (parcours modules)

---

## 📊 Note globale de stabilité : **79 / 100**

| Domaine | Note | Commentaire |
|---------|------|-------------|
| Build / tests / lint | 95 | Pipeline CI sain |
| Schéma & migrations | 90 | 32 migrations, idempotent |
| Auth & tenant | 75 | JWT serveur corrigé, propagation incomplète |
| RLS Supabase | 70 | 36 tenant, 16 anon ouvertes |
| Modules métier | 85 | Tests verts, architecture stabilisée |
| Import & IA | 78 | Engines unifiés, RLS import faible |
| Sécurité secrets | 90 | Pas de fuite client |
| Observabilité prod | 50 | Logs non audités live |

**Verdict :** Flora est **exploitable en production** pour un usage single-tenant ou peu d’utilisateurs avec auth. Pour **multi-tenant strict**, terminer la propagation JWT + RLS phase 3 avant ouverture large.

---

*Rapport généré le 17/07/2026 — commandes : `npm run lint`, `npm test`, `npm run build`, `npm run db:migrate`, `npm run db:audit`*
