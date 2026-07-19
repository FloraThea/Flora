# Validation réelle — Guide MHM CE1 CE2

- Fichier : `/Users/camille/flora/tests/validation/guides_maitre/MHM_CE1_CE2_GUIDE.pdf`
- Date du test : 2026-07-19T08:20:51.953Z
- Extraction brute : `/Users/camille/flora/tests/validation/resultats_attendus/MHM_CE1_CE2_GUIDE-extraction-brute.json`

## Document analysé

- **MHM_CE1_CE2_GUIDE.pdf** : 50 pages PDF, 108663 caractères extraits, 50 pages non vides

### Signaux détectés (ensemble du document)

- Type document : **programmation**
- Méthode : **MHM**
- Mots-clés pédagogiques : compétence, objectif, matériel, séance, séquence, MHM
- Compétences (occurrences) : 6
- Objectifs (occurrences) : 12
- Matériel (occurrences) : 30
- Séances repérées dans le texte : pages avec contenu séance — 20

## Statistiques

- Pages attendues : **50**
- Pages extraites : **50**
- Texte extrait : **108663** caractères
- Champs comparés identiques : **6/6**

## Corrections appliquées

- Extraction PDF page par page via pdf-parse (même pipeline que la bibliothèque Flora)
- Classification DocumentClassifier + MetadataExtractor (étape pré-analyse UI)
- Méthode MHM détectée via pattern générique filename + texte

## Persistance Supabase

- Changement d'onglet (liste) : ✓
- Actualisation (reload) : ✓
- Reconnexion : ✓
- Vérification Supabase : ✓
- Résultat global : ✓ OK — visible=true, reload=true, text=108663/108663

## Comparaison source / interprété / Supabase

| Champ | Source | Interprété | Enregistré | Relu | Statut |
|-------|--------|------------|------------|------|--------|
| pageCount | 50 | 50 | 50 | 50 | identique |
| textLength | 108663 | 108663 | 108663 | 108663 | identique |
| methode | MHM | MHM | MHM | MHM | identique |
| documentType | programmation | programmation | programmation | programmation | identique |
| competenceMatches | 6 | 6 | 6 | 6 | identique |
| objectifMatches | 12 | 12 | 12 | 12 | identique |

## Aperçu prévisualisation (800 premiers caractères)

```
Nathan est un éditeur qui s’engage pour la préservation
de l’environnement et qui utilise du papier fabriqué à partir
de bois provenant de forêts gérées de manière responsable.
Nicolas Pinel
Inspecteur de l’Éducation Nationale
Guide des séances
Troisième édition
CE2	CE1

-- 1 of 50 --

ISBN : 978-2-09124352-8
© Éditions Nathan 2019 – 25 avenue Pierre de Coubertin, 75013 PARIS.

-- 2 of 50 --

3
Avant-propos
Ce guide contient les présentations détaillées des séances, à l’identique de ce que vous trouve-
rez sur le site MHM. Toutefois, il vous permet d’accéder à une version couleur, reliée et de qualité, que
vous pourrez consulter avec plaisir et qui vous évitera des impressions fastidieuses. De plus, l’inté-
gralité des fiches à photocopier nécessaires aux modules ont été regroupées dans ce
```

## Limites restantes

- L'analyse IA complète (Gemini/Théa) n'est pas exécutée dans ce test batch — seuls l'extraction PDF, la classification et les métadonnées déterministes sont validés.
- Le type « programmation » provient du classificateur (mot-clé dans les 6000 premiers caractères) ; le document reste identifiable comme guide MHM via `methode` et mots-clés.

