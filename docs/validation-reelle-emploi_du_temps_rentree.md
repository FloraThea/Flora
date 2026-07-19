# Validation réelle — Emploi du temps rentrée

- Fichier : `/Users/camille/flora/tests/validation/emploi_du_temps/emploi_du_temps_rentree.xlsx`
- Date du test : 2026-07-19T01:10:56.854Z
- Extraction brute : `/Users/camille/flora/tests/validation/resultats_attendus/emploi_du_temps_rentree-extraction-brute.json`

## Feuilles analysées

- **Feuil1** : 19 lignes × 5 colonnes, 18 fusions, 66 cellules non vides, fusions : B16:B18, C11:C12, E11:E12, D11:D12, B11:B12…

### Signaux détectés

- Jours : Lundi, Mardi, Jeudi, Vendredi
- Horaires/colonnes détectés via parseur EDT

## Statistiques

- Créneaux attendus : **56**
- Créneaux importés : **56**
- Identiques : **28**
- Transformées correctement (matière mappée) : **28**
- Incorrectes : **0**
- Perdues : **0**

## Corrections appliquées

- Grille jours-en-colonnes / horaires-en-lignes reconnue automatiquement
- Contenu cellule conservé intégralement dans rawLabel (aucune perte de texte)
- Matières mappées via alias génériques (Rituels, Français, Mathématiques, etc.)

## Persistance Supabase

- Changement d'onglet (liste) : ✓
- Actualisation (reload) : ✓
- Reconnexion : ✓
- Vérification Supabase : ✓
- Résultat global : ✓ OK — visible=true, reload=true, slots=56/56

## Échantillon de comparaison (10 premiers créneaux)

| Jour | Horaire | Texte source | Matière interprétée | Statut |
|------|---------|--------------|---------------------|--------|
| Lundi | 08:30-08:55 | Rituels : Copie des devoirs - Chaque jour com | Français | transformée_correctement |
| Mardi | 08:30-08:55 | Rituels : Copie des devoirs - Chaque jour com | Français | transformée_correctement |
| Jeudi | 08:30-08:55 | Rituels : Copie des devoirs - Chaque jour com | Français | transformée_correctement |
| Vendredi | 08:30-08:55 | Rituels : Copie des devoirs - Chaque jour com | Français | transformée_correctement |
| Lundi | 08:55-09:10 | Dictée (Dictée et Histoire des Arts) | Français | transformée_correctement |
| Mardi | 08:55-09:10 | Découverte des mots (Dictée et Histoire des A | Français | transformée_correctement |
| Jeudi | 08:55-09:10 | Dictée (Dictée et Histoire des Arts) | Français | transformée_correctement |
| Vendredi | 08:55-09:10 | Dictée (Dictée et Histoire des Arts) | Français | transformée_correctement |
| Lundi | 09:10-10:00 | Mathématiques (MHM) | Mathématiques | identique |
| Mardi | 09:10-10:00 | Mathématiques (MHM) | Mathématiques | identique |

## Limites restantes

- Tous les créneaux sont importés avec le texte cellule intact (`rawLabel`). Le mapping matière est une transformation attendue.
- Le texte complémentaire (`customText`) reste vide à l'import : le contenu complet est conservé dans `rawLabel`, `label` et `metadata.importSource`.

