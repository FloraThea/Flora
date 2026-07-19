# Validation réelle — Emploi du temps rentrée

- Fichier : `/Users/camille/flora/tests/validation/emploi_du_temps/emploi_du_temps_rentree.xlsx`
- Date du test : 2026-07-19T08:21:19.227Z
- Extraction brute : `/Users/camille/flora/tests/validation/resultats_attendus/emploi_du_temps_rentree-extraction-brute.json`

## Feuilles analysées

- **Feuil1** : 19 lignes × 5 colonnes, 18 fusions, 66 cellules non vides, fusions : B16:B18, C11:C12, E11:E12, D11:D12, B11:B12…

### Signaux détectés

- Jours : Lundi, Mardi, Jeudi, Vendredi
- Horaires/colonnes détectés via parseur EDT

## Statistiques

- Créneaux attendus : **56**
- Créneaux importés : **56**
- Horaires identiques : **56**
- Textes source conservés : **56**
- Créneaux incorrects : **0**
- Créneaux perdus : **0**
- Créneaux dupliqués : **0**

## Corrections appliquées

- Fin de créneau calculée depuis la dernière ligne fusionnée de chaque colonne/jour
- Contenu cellule conservé intégralement dans rawLabel et subject (texte visible)
- Matière Flora normalisée stockée dans normalizedSubject (couleurs/filtres uniquement)

## Persistance Supabase

- Changement d'onglet (liste) : ✓
- Actualisation (reload) : ✓
- Reconnexion : ✓
- Vérification Supabase : ✓
- Résultat global : ✓ OK — visible=true, reload=true, slots=56/56

## Comparaison complète (56 créneaux)

| Jour | Cellule source | Début source | Fin source | Texte source | Début importé | Fin importée | Texte importé | Statut |
|------|----------------|--------------|------------|--------------|---------------|--------------|---------------|--------|
| Lundi | 2:2 | 08:30 | 08:55 | Rituels : Copie des devoirs - Chaque jou | 08:30 | 08:55 | Rituels : Copie des devoirs - Chaque jou | identique |
| Mardi | 2:3 | 08:30 | 08:55 | Rituels : Copie des devoirs - Chaque jou | 08:30 | 08:55 | Rituels : Copie des devoirs - Chaque jou | identique |
| Jeudi | 2:4 | 08:30 | 08:55 | Rituels : Copie des devoirs - Chaque jou | 08:30 | 08:55 | Rituels : Copie des devoirs - Chaque jou | identique |
| Vendredi | 2:5 | 08:30 | 08:55 | Rituels : Copie des devoirs - Chaque jou | 08:30 | 08:55 | Rituels : Copie des devoirs - Chaque jou | identique |
| Lundi | 3:2 | 08:55 | 09:10 | Dictée (Dictée et Histoire des Arts) | 08:55 | 09:10 | Dictée (Dictée et Histoire des Arts) | identique |
| Mardi | 3:3 | 08:55 | 09:10 | Découverte des mots (Dictée et Histoire  | 08:55 | 09:10 | Découverte des mots (Dictée et Histoire  | identique |
| Jeudi | 3:4 | 08:55 | 09:10 | Dictée (Dictée et Histoire des Arts) | 08:55 | 09:10 | Dictée (Dictée et Histoire des Arts) | identique |
| Vendredi | 3:5 | 08:55 | 09:10 | Dictée (Dictée et Histoire des Arts) | 08:55 | 09:10 | Dictée (Dictée et Histoire des Arts) | identique |
| Lundi | 4:2 | 09:10 | 10:00 | Mathématiques (MHM) | 09:10 | 10:00 | Mathématiques (MHM) | identique |
| Mardi | 4:3 | 09:10 | 10:00 | Mathématiques (MHM) | 09:10 | 10:00 | Mathématiques (MHM) | identique |
| Jeudi | 4:4 | 09:10 | 10:00 | Mathématiques (MHM) | 09:10 | 10:00 | Mathématiques (MHM) | identique |
| Vendredi | 4:5 | 09:10 | 10:00 | Mathématiques (MHM) | 09:10 | 10:00 | Mathématiques (MHM) | identique |
| Lundi | 5:2 | 10:00 | 10:15 | Récréation | 10:00 | 10:15 | Récréation | identique |
| Mardi | 5:3 | 10:00 | 10:15 | Récréation | 10:00 | 10:15 | Récréation | identique |
| Jeudi | 5:4 | 10:00 | 10:15 | Récréation | 10:00 | 10:15 | Récréation | identique |
| Vendredi | 5:5 | 10:00 | 10:15 | Récréation | 10:00 | 10:15 | Récréation | identique |
| Lundi | 6:2 | 10:15 | 11:00 | Conjugaison (Réussir en grammaire) | 10:15 | 11:00 | Conjugaison (Réussir en grammaire) | identique |
| Mardi | 6:3 | 10:15 | 10:30 | Correction dictée | 10:15 | 10:30 | Correction dictée | identique |
| Jeudi | 6:4 | 10:15 | 11:00 | Grammaire (Réussir en grammaire) | 10:15 | 11:00 | Grammaire (Réussir en grammaire) | identique |
| Vendredi | 6:5 | 10:15 | 11:00 | Grammaire (Réussir en grammaire) | 10:15 | 11:00 | Grammaire (Réussir en grammaire) | identique |
| Mardi | 7:3 | 10:30 | 11:30 | EPS | 10:30 | 11:30 | EPS | identique |
| Lundi | 8:2 | 11:00 | 11:30 | Calcul mental | 11:00 | 11:30 | Calcul mental | identique |
| Jeudi | 8:4 | 11:00 | 11:30 | Lexique | 11:00 | 11:30 | Lexique | identique |
| Vendredi | 8:5 | 11:00 | 11:30 | Lexique | 11:00 | 11:30 | Lexique | identique |
| Lundi | 9:2 | 11:30 | 13:30 | Déjeuner | 11:30 | 13:30 | Déjeuner | identique |
| Mardi | 9:3 | 11:30 | 13:30 | Déjeuner | 11:30 | 13:30 | Déjeuner | identique |
| Jeudi | 9:4 | 11:30 | 13:30 | Déjeuner | 11:30 | 13:30 | Déjeuner | identique |
| Vendredi | 9:5 | 11:30 | 13:30 | Déjeuner | 11:30 | 13:30 | Déjeuner | identique |
| Lundi | 10:2 | 13:30 | 13:45 | Chut! Je lis… | 13:30 | 13:45 | Chut! Je lis… | identique |
| Mardi | 10:3 | 13:30 | 13:45 | Chut! Je lis… | 13:30 | 13:45 | Chut! Je lis… | identique |
| Jeudi | 10:4 | 13:30 | 13:45 | Chut! Je lis… | 13:30 | 13:45 | Chut! Je lis… | identique |
| Vendredi | 10:5 | 13:30 | 13:45 | Chut! Je lis… | 13:30 | 13:45 | Chut! Je lis… | identique |
| Lundi | 11:2 | 13:45 | 14:15 | Production d'écrit | 13:45 | 14:15 | Production d'écrit | identique |
| Mardi | 11:3 | 13:45 | 14:15 | Conjugaison (Réussir en grammaire) | 13:45 | 14:15 | Conjugaison (Réussir en grammaire) | identique |
| Jeudi | 11:4 | 13:45 | 14:15 | Poésie | 13:45 | 14:15 | Poésie | identique |
| Vendredi | 11:5 | 13:45 | 14:15 | Lecture compréhension | 13:45 | 14:15 | Lecture compréhension | identique |
| Lundi | 13:2 | 14:15 | 15:00 | Anglais | 14:15 | 15:00 | Anglais | identique |
| Mardi | 13:3 | 14:15 | 15:00 | Histoire | 14:15 | 15:00 | Histoire | identique |
| Jeudi | 13:4 | 14:15 | 14:45 | Lecture fluence | 14:15 | 14:45 | Lecture fluence | identique |
| Vendredi | 13:5 | 14:15 | 14:45 | Lecture fluence | 14:15 | 14:45 | Lecture fluence | identique |
| Jeudi | 14:4 | 14:45 | 15:00 | Français | 14:45 | 15:00 | Français | identique |
| Vendredi | 14:5 | 14:45 | 15:00 | Français | 14:45 | 15:00 | Français | identique |
| Lundi | 15:2 | 15:00 | 15:15 | Récréation | 15:00 | 15:15 | Récréation | identique |
| Mardi | 15:3 | 15:00 | 15:15 | Récréation | 15:00 | 15:15 | Récréation | identique |
| Jeudi | 15:4 | 15:00 | 15:15 | Récréation | 15:00 | 15:15 | Récréation | identique |
| Vendredi | 15:5 | 15:00 | 15:15 | Récréation | 15:00 | 15:15 | Récréation | identique |
| Lundi | 16:2 | 15:15 | 16:15 | Histoire des arts - Arts plastiques | 15:15 | 16:15 | Histoire des arts - Arts plastiques | identique |
| Mardi | 16:3 | 15:15 | 15:45 | Orthographe (Dictée et histoire des arts | 15:15 | 15:45 | Orthographe (Dictée et histoire des arts | identique |
| Jeudi | 16:4 | 15:15 | 15:45 | Géographie | 15:15 | 15:45 | Géographie | identique |
| Vendredi | 16:5 | 15:15 | 15:45 | Sciences | 15:15 | 15:45 | Sciences | identique |
| Mardi | 18:3 | 15:45 | 16:15 | EMC | 15:45 | 16:15 | EMC | identique |
| Vendredi | 18:5 | 15:45 | 16:15 | Education musicale | 15:45 | 16:15 | Education musicale | identique |
| Lundi | 19:2 | 16:15 | 16:30 | Cartable - Lecture offerte | 16:15 | 16:30 | Cartable - Lecture offerte | identique |
| Mardi | 19:3 | 16:15 | 16:30 | Cartable - Lecture offerte | 16:15 | 16:30 | Cartable - Lecture offerte | identique |
| Jeudi | 19:4 | 16:15 | 16:30 | Cartable - Lecture offerte | 16:15 | 16:30 | Cartable - Lecture offerte | identique |
| Vendredi | 19:5 | 16:15 | 16:30 | Cartable - Lecture offerte | 16:15 | 16:30 | Cartable - Lecture offerte | identique |

## Preuve Lundi / Mardi 10:15

- Lundi 10:15–11:00 : identique — « Conjugaison (Réussir en grammaire) »
- Mardi 10:15–10:30 : identique — « Correction dictée »

## Limites restantes

- Tous les créneaux sont importés avec horaires et textes source identiques au fichier Excel.

