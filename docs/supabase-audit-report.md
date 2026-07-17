# Audit Flora ↔ Supabase

Date : 2026-07-16  
Périmètre : 54 tables publiques, 28 migrations, ~30 fichiers services avec requêtes Supabase.

## Synthèse exécutive

| Priorité | Nombre | Exemples |
|----------|--------|----------|
| **Bloquant** | 4 | `link_mode` absent en prod, colonne `matiere` inexistante sur `progression_rows`, EDT journal vs profil JSON |
| **Important** | 12 | Pas de filtre utilisateur sur programmations/progressions, désactivation EDT globale, RLS anon ouverte |
| **Mineur** | 15+ | Types TS obsolètes, erreurs silencieuses, logs manquants |

### Corrections appliquées dans cette session

- Repli `link_mode` (schema-compat) + migration `20250716200000_supabase_schema_reconcile.sql`
- `agenda-sync` : suppression colonne fantôme `matiere`
- `hours-calculator` : `start_time`/`end_time` + filtre EDT actif
- EDT : désactivation `is_active` scoping profil ; rattachement EDT legacy sans `teacher_profile_id`
- Journal : `listJournalsInRange` filtrable par profil
- Agenda : `dismissAgendaReminder` avec contrôle profil
- Logs `[SupabaseAudit]` + tests `lib/supabase/run-schema-audit-tests.ts`

---

## Diagnostic par module

| Module | Fonctionnalité | Table Supabase | Requête / fichier | Problème | Cause probable | Gravité | Correction | Migration | Test |
|--------|----------------|----------------|-------------------|----------|----------------|---------|------------|-----------|------|
| Auth | Session | — | Pas d'auth Supabase | Aucune isolation `auth.uid()` | Modèle single-tenant anon | Important | RLS + auth (manuel) | Oui | — |
| Profil | Lecture/écriture | `teacher_profiles`, `teacher_preferences`, `teacher_methods`, `teacher_projects` | `profile-service.ts` | `limit(1)` sans user_id | Première ligne globale | Important | Filtrer par auth (futur) | Non | Existant |
| Profil | EDT JSON | `teacher_profiles.timetables` | `profile-service.ts:36` | DEFAULT_TIMETABLE injecté | Fallback démo | Important | Ne pas confondre avec EDT DB | Non | — |
| EDT | Chargement actif | `timetable_schedules`, `timetable_slots` | `timetable-service.ts` | Journal ≠ EDT si `teacher_profile_id` null | Chemins divergents | **Bloquant** | Rattachement legacy | Non | Audit tests |
| EDT | Variantes | `timetable_schedules` | `activateScheduleVariant` | Désactivait TOUS les EDT | Pas de filtre profil | Important | **Corrigé** scope profil | Non | — |
| EDT | Import primary | `timetable_schedules` | `timetable-import-service.ts` | `is_active` false si pas primary | Import non primary | Important | **Corrigé** scope profil | Non | — |
| EDT | Heures | `timetable_slots` | `hours-calculator.ts` | Colonnes `start`/`end` | Schéma renommé | **Bloquant** | **Corrigé** | Non | Audit tests |
| Agenda | Feed | `agenda_events`, `agenda_tasks` | `agenda-service.ts` | Erreur vs vide | Throw Supabase | Important | Messages FR | Tables agenda | `run-agenda-tests` |
| Agenda | Sync progressions | `progression_rows` | `agenda-sync.ts:274` | Colonne `matiere` | Colonne absente | **Bloquant** | **Corrigé** | Non | Audit tests |
| Agenda | Rappels dismiss | `agenda_reminders` | `reminders/route.ts` | Pas de filtre profil | Update direct | Important | **Corrigé** | Non | — |
| Programmation | CRUD | `programmations`, `programming_*` | `programmation-service.ts` | Pas de `teacher_profile_id` | Schéma global | Important | Colonne + RLS (futur) | Oui | Existant |
| Programmation | Import lot | `programming_import_batches/files` | `programmation-import-batch-service.ts` | Tables absentes prod | Migration non appliquée | **Bloquant** | Migration reconcile | **20250716200000** | Import batch tests |
| Progression | Sauvegarde | `progressions` | `progression-service.ts` | `link_mode` PGRST204 | Migration absente | **Bloquant** | schema-compat + migration | **20250714120000**, **20250716200000** | Audit tests |
| Progression | Indépendante | `progressions` | insert | `programmation_id` NOT NULL legacy | Migration absente | Important | Migration reconcile | **20250714120000** | — |
| Progression | Types | — | `types.ts` | `programmation_id: string` | TS obsolète | Mineur | **Corrigé** nullable | Non | Build |
| Séquences | CRUD | `sequences` | `sequence-service.ts` | Pas filtre profil | Schéma global | Important | Futur | link_mode migration | Independent tests |
| Séances | CRUD | `seances` | `seance-service.ts` | `teacher_profile_id` souvent null | Optionnel à l'insert | Important | Toujours renseigner | Non | — |
| Journal | EDT jour | `timetable_*` | `journal-timetable.ts` | « Aucun EDT » avec EDT vide | 0 slots / mauvais profil | **Bloquant** | Rattachement legacy | Non | journal-view tests |
| Journal | Liste | `journals` | `journal-service.ts` | Pas filtre profil | Paramètre absent | Important | **Corrigé** param optionnel | Non | — |
| Journal | Entrées | `journal_entries` | `journal-entry-service.ts` | assertEntryOwnedByProfile OK | — | — | — | Non | journal tests |
| Bibliothèque | Documents | `documents` + relations | `document-service.ts` | Pas owner ; fallback select(*) | RLS anon ouverte | Important | user_id sur documents | Oui | — |
| Référiel BO | Compétences | `referentiels` | `referentiel-service.ts` | Erreur → `[]` silencieux | catch implicite | Mineur | Logger + message | Non | — |
| Référiel BO | Activation | `bo_documents` | `bo-document-service.ts` | Désactive par matière globalement | Pas scope profil | Important | Scope profil | Non | — |
| Imports docs | Pipeline | `document_import_jobs` etc. | `ImportQueue.ts` | Pas lien teacher | metadata user_id seul | Important | FK profil | Non | — |
| Stockage | Ressources | `storage.objects` | migrations | Bucket `resources` anon | RLS permissive | Important | Auth storage | Existant | — |
| RLS | Toutes tables pédagogiques | * | migrations | `using (true)` anon | Dev single-tenant | Important | Policies auth.uid() | Oui | Manuel |
| RLS | Agenda | `agenda_*` | `20250714160000` | `teacher_profile_id IS NOT NULL` | OK partiel | — | — | Appliquer | — |

---

## Relations pédagogiques facultatives

| Relation | Colonne(s) | NOT NULL en migration cible | Code gère null | Front exige parent |
|----------|------------|----------------------------|----------------|-------------------|
| Progression sans programmation | `progressions.programmation_id` | Non (14120000) | Oui | Non (import standalone) |
| Ligne progression | `progression_rows.programmation_id` | Non | Oui | — |
| Séquence sans progression | `sequences.progression_id`, `progression_row_id` | Non | Oui | IndependentSequenceForm OK |
| Séance sans séquence | `seances.sequence_id`, `sequence_session_id` | Non | Oui | IndependentSeanceForm OK |
| Journal sans séance | `journal_entries.seance_id` | Nullable | Oui | — |
| Mode liaison | `link_mode` sur progressions/sequences/seances | Oui avec default | schema-compat | — |

**Colonnes encore NOT NULL légitimes :** `progression_rows.progression_id`, `progression_rows.tab_id`, `programming_tables.programmation_id`.

---

## Isolation utilisateur

| Table | Colonne owner | Filtrée dans requêtes | RLS |
|-------|---------------|----------------------|-----|
| `teacher_profiles` | id | limit(1) global | anon all |
| `timetable_schedules` | `teacher_profile_id` | Partiel (**amélioré**) | anon all |
| `agenda_events` | `teacher_profile_id` | Oui | not null check |
| `journals` | `teacher_profile_id` | Partiel (**amélioré**) | anon all |
| `programmations` | **Aucune** | Non | anon all |
| `progressions` | **Aucune** | Non | anon all |
| `documents` | **Aucune** | Non | anon all |
| `programming_import_batches` | `teacher_profile_id` | batchId seul | anon all |

**Risque :** en multi-utilisateur, fuite de données entre enseignants. Acceptable en démo single-tenant ; **bloquant** en production multi-tenant.

---

## Année scolaire

- Source : `teacher_profiles.school_year` (texte, pas FK)
- Utilisée : programmations, EDT schedules, agenda insert, journals, 108h
- **Non filtrée** : `loadActiveScheduleForProfile`, listes progressions/programmations
- Risque : mélange d'années si plusieurs jeux de données

---

## Migrations

| Fichier | Statut attendu prod | Impact si absent |
|---------|---------------------|------------------|
| `20250714120000_optional_pedagogical_relations.sql` | Requis | PGRST204 link_mode, NOT NULL programmation |
| `20250714170000_programming_import_batches.sql` | Requis | Import programmation batch |
| `20250714160000_agenda_rls.sql` | Requis | Agenda feed erreur |
| `20250716200000_supabase_schema_reconcile.sql` | **Nouveau** | Réconciliation idempotente |

### SQL à exécuter dans Supabase (production)

Exécuter le contenu de :

```
supabase/migrations/20250714120000_optional_pedagogical_relations.sql
supabase/migrations/20250714170000_programming_import_batches.sql
supabase/migrations/20250714160000_agenda_rls.sql
supabase/migrations/20250716200000_supabase_schema_reconcile.sql
```

Ou : `supabase db push` (après lien projet).

---

## Fichiers modifiés (audit)

- `lib/supabase/audit-log.ts` (nouveau)
- `lib/supabase/run-schema-audit-tests.ts` (nouveau)
- `supabase/migrations/20250716200000_supabase_schema_reconcile.sql` (nouveau)
- `lib/agenda/agenda-sync.ts`
- `lib/agenda/agenda-service.ts`
- `lib/pedagogical/hours-calculator.ts`
- `lib/timetable/timetable-service.ts`
- `lib/timetable/import/timetable-import-service.ts`
- `lib/journal/journal-service.ts`
- `lib/progression/types.ts`
- `lib/progression/progression-service.ts`
- `lib/sequences/sequence-service.ts`
- `app/api/agenda/reminders/route.ts`
- `app/api/emploi-du-temps/route.ts`
- `package.json` (script test)

---

## Problèmes restant à traiter manuellement

1. **Appliquer migrations prod** (voir `docs/stabilization-report.md` §6)
2. **Activer Supabase Auth** + lier `teacher_profiles.user_id`
3. **Brancher** progression/EDT/documents sur `UnifiedImportEngine`
4. **RLS tables enfant** (timetable_slots, journal_entries, programming_tables)
5. **ESLint** : 16 erreurs React Compiler préexistantes (`set-state-in-effect`)
6. **`teacher_profile_id` insert documents** (pipeline import)
7. **Cloudflare R2** : vérifier si utilisé (AWS SDK présent ; pas de requête Supabase directe)

### Statut post-stabilisation (2026-07-16)

- Build + tests : **OK**
- Code audit bloquants : **corrigés**
- Rapport complet : `docs/stabilization-report.md`
5. **Appliquer migrations** sur Supabase production (flora-lilac.vercel.app)
6. **Générer types Supabase** (`supabase gen types`) pour aligner TS ↔ schéma

---

## Résultats commandes

| Commande | Résultat |
|----------|----------|
| TypeScript / build | OK |
| Tests (`npm test`) | OK (incl. Supabase audit 4/4) |
| Lint | 64 problèmes préexistants (19 errors, 45 warnings) — non introduits par cet audit |
| Supabase CLI | Non vérifié (non installé ou hors PATH) |
