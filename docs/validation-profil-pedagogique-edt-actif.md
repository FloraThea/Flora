# Correction — Profil pédagogique et emploi du temps actif

Date : 2026-07-19

## Cause racine

### Message « Profil enregistré » + statut « Profil incomplet »

Deux logiques divergentes coexistaient :

1. **`saveTeacherProfileBundle`** marquait `status: "complete"` dès que nom, prénom, année, niveaux et méthodes étaient remplis — **sans vérifier l’emploi du temps ni les jours travaillés**.
2. **`getProfileCompletionStatus`** (utilisé par l’UI) exige en plus un emploi du temps avec créneaux et des jours travaillés.

Résultat : la sauvegarde réussissait et affichait le message de succès, mais le badge restait « Profil incomplet ».

### Emploi du temps existant non détecté

**Fichier :** `lib/timetable/timetable-service.ts` — `loadActiveScheduleForProfile()`

La détection ne cherchait qu’un schedule `is_active = true`. Or :

- un import peut enregistrer les 56 créneaux sur un schedule **inactif** (`is_active: false`) ;
- un schedule actif **vide** peut coexister (créé par `ensureActiveSchedule`) ;
- le profil lié à l’auth (`user_id`) peut différer du profil porteur de l’EDT (orphelin non relié).

Dans ces cas, `hasActiveTimetableWithSlots()` renvoyait `false` malgré un EDT visible dans le module.

## Fichiers modifiés

| Fichier | Fonction | Modification |
|---------|----------|--------------|
| `timetable-service.ts` | `loadActiveScheduleForProfile` | Fallback : schedule du profil avec le plus de créneaux ; rattachement orphelins ; promotion `is_active` |
| `auth-server.ts` | `linkTeacherProfileToAuthUser` | Liaison auth → profil orphelin ayant le plus de créneaux EDT |
| `profile-service.ts` | `saveTeacherProfileBundle` | Écriture `user_id`, relecture post-save, `status` aligné sur `getProfileCompletionStatus` |
| `profile-service.ts` | `getOrCreateTeacherProfile` | Liaison auth systématique avant chargement |
| `profile-service.ts` | `reloadTeacherProfileBundle` | Relecture non cachée après sauvegarde |
| `timetable-import-service.ts` | `saveImportedTimetable` | Synchronisation EDT actif après import |
| `app/api/profil/route.ts` | `PUT` | Vérification relecture avant réponse |
| `lib/profile/run-profile-completion-tests.ts` | — | Tests non-régression |

## Tests exécutés

```bash
npm run test:profile:completion          # 2/2 — calcul champs manquants
npm run test:validation                  # 100/100
npm run test:validation:profile-edt      # API HTTP (serveur dev requis) — import 56 créneaux + profil
```

Pour le test API complet :

```bash
npm run dev   # port affiché (3000 ou 3001)
FLORA_VALIDATION_BASE_URL=http://localhost:3000 npm run test:validation:profile-edt
```

## Confirmation du périmètre

Seules la sauvegarde du profil, la relecture du profil et la détection de l’emploi du temps actif ont été corrigées. Aucune modification visuelle ni modification des autres modules n’a été réalisée.
