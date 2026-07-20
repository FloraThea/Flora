# Moteur Pédagogique Intelligent 2.0 (MPI)

Flora analyse automatiquement l'ensemble des documents pédagogiques importés ou modifiés, **sans jamais les modifier**. Elle propose des corrections, un pilotage annuel et des exports.

## Fonctionnalités

| Partie | Service / API | Page |
|--------|---------------|------|
| Cohérence auto | `analyzePedagogicalCoherence()` · `triggerPedagogicalAnalysis()` · `GET /api/pedagogical/coherence` | Pilotage pédagogique |
| Pilotage 36 semaines | `buildWeeklyPilotage()` · `GET /api/pedagogical/pilotage` | `/pilotage-pedagogique` |
| Couverture BO | `computeBoCoverageReport()` · `GET /api/pedagogical/coverage` | Pilotage pédagogique |
| Historique | `change-history.ts` · `GET/POST /api/pedagogical/history` | Pilotage pédagogique |
| Recherche | `searchPedagogicalDocuments()` · `GET /api/pedagogical/search` | Pilotage pédagogique |
| Liens documents | `buildDocumentChain()` · `buildDocumentChainByCompetence()` · `GET /api/pedagogical/chain` | Pilotage pédagogique |
| Suggestions | `buildPedagogicalSuggestions()` · `GET /api/pedagogical/suggestions` | Pilotage pédagogique |
| Export | `exportPedagogicalYear()` · `POST /api/pedagogical/export` | Pilotage pédagogique |

## Déclenchement automatique

L'analyse de cohérence est relancée après :

- import programmation (`/api/programmation/import`)
- import progression (`/api/progression/import`)
- modification séance (`/api/seances/update`)

Via `triggerPedagogicalAnalysis()` qui invalide le cache et recalcule les alertes.

## Détections de cohérence

- Compétence oubliée (programmation ↔ progression)
- Progression incomplète / ne couvre pas l'année
- Séquence sans séance · séance sans objectif · sans durée
- Programmation importée sans progression
- Doublons de titres
- Incohérences de dates (hors année, semaine invalide)
- Niveau incohérent avec le profil
- Objectifs manquants sur les compétences

## Principes

- **Jamais de modification automatique** des documents importés.
- **IA explicable** : chaque alerte indique `reason`, `sources`, `proposal`.
- **Performance** : cache TTL (90–120 s), pagination semaines (12/page), recherche paginée.
- **Corbeille** : documents supprimés exclus via `onlyActive()`.

## Tests

```bash
tsx lib/pedagogical/run-intelligence-tests.ts
npm run build
```

## Navigation

Entrée **Pilotage pédagogique** dans la barre latérale, après le Planificateur annuel.
