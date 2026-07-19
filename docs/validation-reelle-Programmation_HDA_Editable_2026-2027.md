# Validation réelle — Programmation HDA

- Fichier : `/Users/camille/flora/tests/validation/programmation/Programmation_HDA_Editable_2026-2027.xlsx`
- Date du test : 2026-07-19T08:20:41.433Z
- Extraction brute : `/Users/camille/flora/tests/validation/resultats_attendus/Programmation_HDA_Editable_2026-2027-extraction-brute.json`

## Feuilles analysées

- **Programmation HDA** : 60 lignes × 5 colonnes, 20 fusions, 180 cellules non vides

## Statistiques

- Lignes pédagogiques attendues : **35**
- Lignes importées : **35**
- Dates interprétées : **35/35**
- Identiques : **35**
- Incorrectes : **0**
- Perdues : **0**

## Corrections appliquées

- Parsing multi-périodes (bandeaux PÉRIODE + en-têtes répétés par section)
- Dates JJ/MM complétées via année scolaire extraite du document (2026-2027)
- Colonne Œuvre → objectif (normalisation œ → oe)
- Colonne Artiste → remarques, Époque → domaine
- Semaine S1/S2… reconnue via contexte colonne Semaine
- Exclusion des lignes vacances / fériés / pied de page

## Persistance Supabase

- Résultat : ✓ OK
- Détail : visible=true, reload=true, rows=35/35

## Échantillon de comparaison (10 premières lignes)

| Ligne | Semaine | Date source | Date interprétée | Période | Œuvre | Statut |
|------|---------|-------------|------------------|---------|-------|--------|
| 5 | S1 | 07/09 | 2026-09-07 | 1 | Peinture bleue | identique |
| 6 | S2 | 14/09 | 2026-09-14 | 1 | Jaune, bleu et noir | identique |
| 7 | S3 | 21/09 | 2026-09-21 | 1 | La Chambre à Arles | identique |
| 8 | S4 | 28/09 | 2026-09-28 | 1 | Mobile | identique |
| 9 | S5 | 05/10 | 2026-10-05 | 1 | L'Oiseau de feu | identique |
| 10 | S6 | 12/10 | 2026-10-12 | 1 | L'Empire des lumières | identique |
| 15 | S1 | 02/11 | 2026-11-02 | 2 | La Petite Châtelaine | identique |
| 16 | S2 | 09/11 | 2026-11-09 | 2 | L'Automne | identique |
| 17 | S3 | 16/11 | 2026-11-16 | 2 | L'Homme de Vitruve | identique |
| 18 | S4 | 23/11 | 2026-11-23 | 2 | Mes grands-parents, mes parents et moi | identique |

## Limites restantes

- Aucune différence bloquante détectée sur les 35 lignes pédagogiques.

