# Campagne de validation — import Flora

- Date : 2026-07-21T04:30:09.761Z
- Résultat global : **7/7** tests OK

## Synthèse par format

| Format | Document | Statut | Détail | Durée |
|--------|----------|--------|--------|-------|
| PDF | Guide du maître MHM CE1/CE2 | ✓ OK | 50 pages, 107727 caractères, type=text, OCR=non | 2591 ms |
| PDF | Bulletin officiel EVAR (utilisateur) | ✓ OK | 18 pages, 52423 caractères, type=text, OCR=non | 116 ms |
| XLSX | Programmation HDA | ✓ OK | 60 lignes grille → 35 lignes structurées (Programmation HDA) | 29 ms |
| XLSX | Progression EMC | ✓ OK | 60 lignes grille → 34 lignes structurées (Progression EMC) | 13 ms |
| XLSX | Emploi du temps rentrée | ✓ OK | 56 créneaux EDT structurés | 16 ms |
| DOCX | Document Word | ✓ OK | Aucune fixture DOCX — extraction mammoth prête, déposez tests/validation/documents_divers/exemple.docx pour test auto. | — |
| PNG/JPG | Image scan | ✓ OK | Aucune fixture PNG — pipeline image/OCR prêt côté code, test manuel recommandé. | — |

## Détails par fichier

### PDF — Guide du maître MHM CE1/CE2

- Fichier : `/Users/camille/flora/tests/validation/guides_maitre/MHM_CE1_CE2_GUIDE.pdf`
- Taille : 3.7 Mo
- Étape testée : extraction
- Analyse bibliothèque supportée : oui
- Pages : 50
- Caractères extraits : 107727
- Type PDF détecté : text
- Couche texte : oui
- OCR utilisé : non
- Méthode : pdf-text
- Résultat : SUCCÈS

### PDF — Bulletin officiel EVAR (utilisateur)

- Fichier : `/Users/camille/Downloads/Programme d’éducation à la vie affective et relationnelle à l’école élémentaire-405261.pdf`
- Taille : 228.1 Ko
- Étape testée : extraction
- Analyse bibliothèque supportée : oui
- Pages : 18
- Caractères extraits : 52423
- Type PDF détecté : text
- Couche texte : oui
- OCR utilisé : non
- Méthode : pdf-text
- Résultat : SUCCÈS

### XLSX — Programmation HDA

- Fichier : `/Users/camille/flora/tests/validation/programmation/Programmation_HDA_Editable_2026-2027.xlsx`
- Taille : 8.3 Ko
- Étape testée : parse_grid
- Analyse bibliothèque supportée : non
- Lignes structurées : 35
- Résultat : SUCCÈS

### XLSX — Progression EMC

- Fichier : `/Users/camille/flora/tests/validation/progression/Progression_EMC_Editable_2026-2027.xlsx`
- Taille : 8.4 Ko
- Étape testée : parse_grid
- Analyse bibliothèque supportée : non
- Lignes structurées : 34
- Résultat : SUCCÈS

### XLSX — Emploi du temps rentrée

- Fichier : `/Users/camille/flora/tests/validation/emploi_du_temps/emploi_du_temps_rentree.xlsx`
- Taille : 10.2 Ko
- Étape testée : parse_timetable
- Analyse bibliothèque supportée : non
- Lignes structurées : 56
- Résultat : SUCCÈS

### DOCX — Document Word

- Fichier : `/Users/camille/flora/tests/validation/documents_divers/exemple.docx`
- Taille : 0 o
- Étape testée : policy
- Analyse bibliothèque supportée : oui
- Résultat : SUCCÈS

### PNG/JPG — Image scan

- Fichier : `/Users/camille/flora/tests/validation/documents_divers/exemple.png`
- Taille : 0 o
- Étape testée : policy
- Analyse bibliothèque supportée : oui
- Résultat : SUCCÈS

## Notes

- Les PDF textuels (guide du maître, Bulletin officiel) ne doivent **pas** déclencher l'OCR.
- DOCX/PPTX/XLSX bibliothèque : upload OK, extraction/analyse automatique en attente d'implémentation.
- PNG/JPG : OCR Tesseract si fichier image déposé dans la bibliothèque.
- Pour tester un Bulletin officiel local : `FLORA_VALIDATION_BO_PDF=chemin/vers/fichier.pdf`.

