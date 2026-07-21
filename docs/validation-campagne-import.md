# Campagne de validation — import Flora

- Date : 2026-07-21T06:22:16.010Z
- Résultat global : **9/9** tests OK

## Synthèse par format

| Format | Document | Statut | Détail | Durée |
|--------|----------|--------|--------|-------|
| PDF | Guide du maître MHM CE1/CE2 | ✓ OK | 50 pages, 107727 caractères, type=text, OCR=non | 2887 ms |
| PDF | Bulletin officiel EVAR (utilisateur) | ✓ OK | 18 pages, 52423 caractères, type=text, OCR=non | 116 ms |
| PDF | Bulletin officiel EVAR (fixture) | ✓ OK | 18 pages, 52423 caractères, type=text, OCR=non | 100 ms |
| PDF | PDF scanné OCR | ✓ OK | 1 pages, 100 caractères, type=scanned, OCR=oui | 688 ms |
| XLSX | Programmation HDA | ✓ OK | 60 lignes grille → 35 lignes structurées (Programmation HDA) | 25 ms |
| XLSX | Progression EMC | ✓ OK | 60 lignes grille → 34 lignes structurées (Progression EMC) | 11 ms |
| XLSX | Emploi du temps rentrée | ✓ OK | 56 créneaux EDT structurés | 16 ms |
| DOCX | Document Word exemple | ✓ OK | 86 caractères via docx-text | 251 ms |
| PNG | Image PNG exemple | ✓ OK | 71 caractères via ocr-image | 86 ms |

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

### PDF — Bulletin officiel EVAR (fixture)

- Fichier : `/Users/camille/flora/tests/validation/referentiel/Programme_EVAR_elementaire-405261.pdf`
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

### PDF — PDF scanné OCR

- Fichier : `/Users/camille/flora/tests/validation/documents_divers/scan_ocr_test.pdf`
- Taille : 456.7 Ko
- Étape testée : extraction
- Analyse bibliothèque supportée : oui
- Pages : 1
- Caractères extraits : 100
- Type PDF détecté : scanned
- Couche texte : oui
- OCR utilisé : oui
- Méthode : pdf-ocr
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

### DOCX — Document Word exemple

- Fichier : `/Users/camille/flora/tests/validation/documents_divers/exemple.docx`
- Taille : 1.8 Ko
- Étape testée : extraction
- Analyse bibliothèque supportée : oui
- Caractères extraits : 86
- OCR utilisé : non
- Méthode : docx-text
- Résultat : SUCCÈS

### PNG — Image PNG exemple

- Fichier : `/Users/camille/flora/tests/validation/documents_divers/exemple.png`
- Taille : 14.2 Ko
- Étape testée : extraction
- Analyse bibliothèque supportée : oui
- Pages : 1
- Caractères extraits : 71
- OCR utilisé : oui
- Méthode : ocr-image
- Résultat : SUCCÈS

## Notes

- Les PDF textuels (guide du maître, Bulletin officiel) ne doivent **pas** déclencher l'OCR.
- DOCX/PPTX/XLSX bibliothèque : upload OK, extraction/analyse automatique en attente d'implémentation.
- PNG/JPG : OCR Tesseract si fichier image déposé dans la bibliothèque.
- Pour tester un Bulletin officiel local : `FLORA_VALIDATION_BO_PDF=chemin/vers/fichier.pdf`.

