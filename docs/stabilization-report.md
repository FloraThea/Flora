# Rapport de stabilisation Flora — Phase 1 à 11

Date : 2026-07-16  
Branche : stabilisation architecture (non commitée)  
Objectif : architecture cohérente, schéma Supabase aligné, source unique EDT, isolation tenant, zéro données fictives métier.

---

## Synthèse exécutive

| Critère | Résultat |
|---------|----------|
| `npm run build` | **OK** |
| `npm test` | **OK** (toutes les suites, dont audit + stabilisation) |
| `npm run lint` | **16 erreurs** restantes (préexistantes, règle React `set-state-in-effect` sur pages client) |
| Migrations prod | **À appliquer manuellement** (voir §6) |
| Re-audit code | Problèmes bloquants code **corrigés** ; RLS prod dépend des migrations |

---

## Phase 1 — Corrections audit Supabase

### Relations pédagogiques facultatives
- Migration `20250714120000` + `20250717000000` : `programmation_id`, `progression_id`, `sequence_id` nullable
- Colonne `link_mode` avec repli `schema-compat.ts` (`insertWithOptionalColumnFallback`)
- Types TS : `StoredProgression.programmation_id` nullable

### Filtres utilisateur / tenant
- Nouveau `lib/tenant/teacher-context.ts` : `requireTeacherScope()`, `tryTeacherScope()`
- `teacher_profile_id` renseigné à l'insert : programmations, progressions, séquences, séances
- Listes filtrées par profil : programmations, progressions, séquences indépendantes, séances indépendantes, documents, dashboard, agenda dismiss, journals

### Filtres année scolaire
- `listValidatedProgrammations` : filtre `school_year` + `teacher_profile_id`
- Planificateur annuel : scope profil + EDT actif

### EDT / teacher_profile_id
- Rattachement EDT legacy sans `teacher_profile_id` au profil courant
- `activateScheduleVariant` / import : scope profil (plus de désactivation globale)
- `loadProgrammationWeeklyHours` filtré par profil

### Erreurs silencieuses
- Documents : logs explicites sur repli `select('*')`
- Import programmation : `import-api-errors.ts`, timeout client 120 s, repli analyse minimale
- Agenda : messages utilisateur FR via `agenda-profile.ts`

### Colonnes obsolètes
- `agenda-sync.ts` : suppression référence `matiere` sur `progression_rows`
- `hours-calculator.ts` : colonnes `start_time`/`end_time`, EDT actif DB uniquement

---

## Phase 2 — Architecture unifiée

| Domaine | Source unique | Legacy supprimé / déprécié |
|---------|---------------|----------------------------|
| Emploi du temps | `timetable_schedules` + `timetable_slots` via `active-timetable.ts` | JSON profil non injecté ; `syncScheduleToProfile` supprimé ; UI EDT profil remplacée par lien `/emploi-du-temps` |
| Programmation | `programmation-service.ts` | Plus de `DEFAULT_TIMETABLE` demo |
| Profil | `profile-service.ts` sauve `timetables: []` | `getDefaultTimetableFromProfile` → charge EDT DB |
| Cahier journal | `journal-timetable.ts` + EDT actif | Filtrage entrées demo via `journal-entry-utils.ts` |
| Imports | Contrat `unified-import-engine.ts` | Pipeline programmation batch stabilisé ; wiring complet progression/EDT/docs **en cours** |

---

## Phase 3 — Emploi du temps (référence absolue)

**Fichiers clés :**
- `lib/timetable/active-timetable.ts` — chargement serveur EDT actif
- `lib/timetable/timetable-input-utils.ts` — utilitaires purs (client-safe)
- `lib/timetable/timetable-service.ts` — CRUD schedules/slots, rattachement legacy

**Consommateurs alignés :** programmation, profil, planificateur, heures pédagogiques, journal, dashboard.

**Migration SQL :** commentaire `DEPRECATED` sur `teacher_profiles.timetables`.

---

## Phase 4 — Cahier journal

- Pas de création de créneaux fictifs : slots depuis EDT actif uniquement
- `enrichJournalPayload` : règles d'affichage cohérentes (EDT actif requis)
- Filtrage metadata `demo`/`seed` sur entrées existantes
- Tests : `run-journal-tests.ts`, `run-journal-view-tests.ts` — **5/5 + 4/4**

---

## Phase 5 — Moteur d'import unifié

**Créé :** `lib/import/unified-import-engine.ts`

Contrat : PNG/JPG/JPEG/PDF/DOCX/XLSX, batch, fusion pages, analyse, validation, sauvegarde.

**Branché :** programmation (batch panel + service), PNG tests cross-modules.

**À finaliser :** adapter progression, EDT et documents pour implémenter `UnifiedImportEngine` (même interface, handlers module).

---

## Phase 6 — Supabase : schéma ↔ code

### Migrations créées / à appliquer (ordre)

1. `20250714120000_optional_pedagogical_relations.sql`
2. `20250714170000_programming_import_batches.sql`
3. `20250714160000_agenda_rls.sql`
4. `20250716200000_supabase_schema_reconcile.sql`
5. **`20250717000000_stabilization_architecture.sql`** (nouvelle)

### Colonnes ajoutées (`20250717000000`)
- `teacher_profiles.user_id`
- `teacher_profile_id` : programmations, progressions, sequences, documents
- `link_mode` : progressions, sequences, seances (idempotent)

### Index ajoutés
- `teacher_profiles_user_id_idx`
- `programmations_teacher_profile_id_idx`, `programmations_teacher_school_year_idx`
- `progressions_teacher_profile_id_idx`, `sequences_teacher_profile_id_idx`
- `documents_teacher_profile_id_idx`
- `timetable_schedules_teacher_active_idx`
- `journals_teacher_date_idx`

### Backfill
- Données orphelines rattachées au profil le plus ancien

### Commande prod
```bash
supabase db push
# ou exécuter les 5 fichiers SQL dans l'ordre ci-dessus
```

---

## Phase 7 — RLS

Fonctions :
- `flora_accessible_profile_ids()` — auth.uid() ou fallback single-tenant
- `flora_can_access_profile(uuid)`

Politiques tenant créées (`20250717000000`) :
- `programmations_tenant`
- `progressions_tenant`
- `sequences_tenant`
- `documents_tenant`
- `timetable_schedules_tenant`
- `journals_tenant`
- `seances_tenant`

**Tables enfant** (programming_tables, progression_rows, journal_entries, timetable_slots) : héritent via FK parent — policies dédiées **recommandées** en phase auth complète.

---

## Phase 8 — Frontend

- Profil : plus d'éditeur JSON EDT ; lien vers module EDT
- Programmation : EDT via `/api/emploi-du-temps`
- Import programmation : étape 1 débloquée (timeout, repli analyse)
- Erreurs Supabase : progression/programmation via `schema-compat` + messages route

**Reste :** 16 erreurs ESLint React Compiler sur effets client (préexistantes).

---

## Phase 9 — Tests automatiques

| Suite | Résultat |
|-------|----------|
| Timetable (grid, mobile, export) | OK |
| Programmation génération + import | OK |
| Progression import | OK |
| Séquences/séances indépendantes | OK |
| PNG import cross-modules | OK |
| Agenda | 3/3 |
| Journal + view | 9/9 |
| Supabase schema audit | 4/4 |
| Stabilisation | 3/3 |

**Couverture CRUD/RLS multi-user en prod :** nécessite migrations appliquées + tests d'intégration Supabase live (non exécutés ici sans credentials prod).

---

## Phase 10 — Build

```
npm run build  → OK
npm test       → OK
npm run lint   → 16 errors (react-hooks/set-state-in-effect, 1 no-unescaped-entities)
```

Corrections lint appliquées : `prefer-const`, `no-assign-module-variable` (2 fichiers).

---

## Phase 11 — Re-audit post-corrections

| Problème audit initial | Statut |
|------------------------|--------|
| `link_mode` absent prod | Migration + schema-compat |
| Colonne `matiere` progression_rows | Corrigé agenda-sync |
| EDT journal vs JSON profil | Source unique DB |
| Pas filtre profil programmations | Corrigé |
| Désactivation EDT globale | Corrigé scope profil |
| `hours-calculator` colonnes | Corrigé |
| Import batch tables absentes | Migration reconcile |
| RLS anon ouverte | Policies tenant (migration) |
| Auth Supabase | Préparé (`user_id`), activation manuelle |
| Données demo profil EDT | Supprimé injection DEFAULT |
| Types TS programmation_id | Nullable |

---

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `lib/tenant/teacher-context.ts` | Scope enseignant |
| `lib/timetable/active-timetable.ts` | EDT actif (serveur) |
| `lib/timetable/timetable-input-utils.ts` | Utilitaires EDT client-safe |
| `lib/import/unified-import-engine.ts` | Contrat import unifié |
| `lib/supabase/schema-compat.ts` | Repli colonnes optionnelles |
| `lib/supabase/audit-log.ts` | Journalisation audit |
| `lib/supabase/run-schema-audit-tests.ts` | Tests schéma |
| `lib/stabilization/run-stabilization-tests.ts` | Tests stabilisation |
| `lib/programming/import/build-minimal-parsed-import.ts` | Repli analyse import |
| `supabase/migrations/20250716200000_supabase_schema_reconcile.sql` | Réconciliation |
| `supabase/migrations/20250717000000_stabilization_architecture.sql` | Tenant + RLS |
| `docs/supabase-audit-report.md` | Audit initial |
| `docs/stabilization-report.md` | Ce rapport |

## Fichiers modifiés (principaux)

38 fichiers trackés + 12 nouveaux — voir `git status` pour la liste complète.

## Composants / code legacy supprimé

- Éditeur EDT JSON dans `ProfilPage.tsx` (~60 lignes)
- Injection `DEFAULT_TIMETABLE` dans sauvegarde profil
- `syncScheduleToProfile` (timetable-service)
- Fallback EDT depuis JSON profil dans programmation

## Dépendances entre modules (cible)

```
teacher_profiles
    └── timetable_schedules → timetable_slots  ← source EDT
            ├── cahier-journal (journal-timetable)
            ├── programmation (API emploi-du-temps)
            ├── planificateur (planner-service)
            └── heures pédagogiques (hours-calculator)

teacher_profile_id → programmations, progressions, sequences, seances, documents, journals, agenda
```

## Performances

Non mesurées en benchmark formel (pas de baseline prod). Améliorations attendues :
- Moins de requêtes redondantes profil/EDT JSON
- Index `teacher_profile_id` + `(teacher_profile_id, school_year)`
- Filtres profil réduisent volume données chargées

---

## Actions restantes avant production multi-tenant

1. **Appliquer les 5 migrations** sur Supabase prod
2. **Activer Supabase Auth** et lier `teacher_profiles.user_id`
3. **Brancher** progression/EDT/documents sur `UnifiedImportEngine`
4. **RLS tables enfant** (slots, entries, programming_tables)
5. **Corriger 16 erreurs ESLint** React Compiler (refactor effets client)
6. **`teacher_profile_id` à l'insert documents** (UploadManager / ImportQueue)
7. **Regénérer types** : `supabase gen types typescript`

---

## Validation locale (2026-07-16 — session 2)

```bash
npm run lint    # 0 errors, 47 warnings
npm test        # OK (toutes suites)
npm run build   # OK
npm run db:migrate  # Applique migrations prod (SUPABASE_DATABASE_URL requis)
```

### Nouveautés session 2

- Migration `20250717120000_child_tables_rls.sql` (RLS `timetable_slots`, `journal_entries`, `programming_tables`, `progression_rows`)
- Auth : `/connexion`, `/api/auth/link-profile`, `lib/supabase/auth-server.ts`, profil filtré par `user_id`
- Moteurs import : `lib/import/engines/*` + `getUnifiedImportEngine()`
- Documents : `teacher_profile_id` à l'insert/update (`UploadManager`)
- ESLint React Compiler : 0 erreur (`deferEffect` helper)
- Script : `npm run db:migrate`
