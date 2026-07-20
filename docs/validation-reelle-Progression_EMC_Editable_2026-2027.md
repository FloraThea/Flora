# Validation réelle — Progression EMC

- Fichier : `/Users/camille/flora/tests/validation/progression/Progression_EMC_Editable_2026-2027.xlsx`
- Date du test : 2026-07-20T11:52:52.003Z
- Extraction brute : `/Users/camille/flora/tests/validation/resultats_attendus/Progression_EMC_Editable_2026-2027-extraction-brute.json`

## Feuilles analysées

- **Progression EMC** : 60 lignes × 5 colonnes, 20 fusions, 214 cellules non vides

### Signaux détectés (feuille active)

- Dates : 34 (2026-09-07, 2026-09-14, 2026-09-21, 2026-09-28, 2026-10-05…)
- Semaines : S1, S2, S3, S4, S5, S6, S7, S8, S9
- Périodes : PÉRIODE 1, PÉRIODE 2, PÉRIODE 3, PÉRIODE 4, PÉRIODE 5
- Séances (échantillon) : Séance | 1. Qui suis-je ? | 2. Que veut dire « être différent » ? | 3. Comment exprimer ses émotions ? | 4. Comment prendre soin de soi ?

## Statistiques

- Lignes pédagogiques attendues : **34**
- Lignes importées : **34**
- Dates interprétées : **34/34**
- Périodes attendues/obtenues : **1, 2, 3, 4, 5** / **1, 2, 3, 4, 5**
- Identiques : **34**
- Incorrectes : **0**
- Perdues : **0**

## Corrections appliquées

- Bandeaux PÉRIODE N sans sous-titre (ex. « PÉRIODE 1 » seul) reconnus via parsePeriodBanner générique
- Dates JJ/MM complétées via année scolaire extraite du document (2026-2027)
- Colonnes Domaine → domaine, Séance → seance, Semaine S1… → weekNumber
- Exclusion des lignes vacances / fériés / pied de page

## Persistance Supabase

- Changement d'onglet (liste) : ✓
- Actualisation (reload) : ✓
- Reconnexion : ✓
- Vérification Supabase : ✓
- Résultat global : ✓ OK — visible=true, reload=true, rows=34/34

## Échantillon de comparaison (10 premières lignes)

| Ligne | Semaine | Date source | Date interprétée | Période | Domaine | Séance | Statut |
|------|---------|-------------|------------------|---------|---------|--------|--------|
| 4 | S1 | 07/09/2026 | 2026-09-07 | 1 | Réfléchir / Débattre | 1. Qui suis-je ? | identique |
| 5 | S2 | 14/09/2026 | 2026-09-14 | 1 | Réfléchir / Débattre | 2. Que veut dire « être différent » ? | identique |
| 6 | S3 | 21/09/2026 | 2026-09-21 | 1 | Réfléchir / Débattre | 3. Comment exprimer ses émotions ? | identique |
| 7 | S4 | 28/09/2026 | 2026-09-28 | 1 | Découvrir / Enquêter | 4. Comment prendre soin de soi ? | identique |
| 8 | S5 | 05/10/2026 | 2026-10-05 | 1 | Découvrir / Enquêter | 5. Pourquoi faut-il prendre soin de ses  | identique |
| 9 | S6 | 12/10/2026 | 2026-10-12 | 1 | Découvrir / Enquêter | 6. Quelles difficultés rencontrent les e | identique |
| 14 | S1 | 02/11/2026 | 2026-11-02 | 2 | Découvrir / Enquêter | 7. Quels sont les symboles de la Républi | identique |
| 15 | S2 | 09/11/2026 | 2026-11-09 | 2 | Découvrir / Enquêter | 8. Quelles sont les différentes croyance | identique |
| 16 | S3 | 16/11/2026 | 2026-11-16 | 2 | Agir / S'engager | 9. Pourquoi doit-on être poli ? | identique |
| 17 | S4 | 23/11/2026 | 2026-11-23 | 2 | Agir / S'engager | 10. Comment lutter contre le racisme ? | identique |

## Limites restantes

- Aucune différence bloquante détectée sur les 34 lignes pédagogiques.

