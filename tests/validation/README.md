# Bibliothèque de validation permanente Flora

Ce dossier contient les **documents pédagogiques réels** utilisés comme référence officielle du projet.

## Structure

```
tests/validation/
  manifest.json                 # Registre des documents de référence
  programmation/                # Fichiers source (ne jamais modifier automatiquement)
  progression/
  emploi_du_temps/
  guides_maitre/
  documents_divers/
  resultats_attendus/           # Snapshots JSON de référence (baseline)
  captures/reference/           # Captures d'écran de référence
  captures/current/             # Captures générées (gitignored)
  rapports/                     # Rapports automatiques (gitignored)
  lib/                          # Moteur d'extraction et comparaison
  run-validation-suite.ts       # Suite principale
  run-screenshot-validation.ts  # Captures UI (Playwright)
```

## Documents de référence actuels

| ID | Fichier | Type |
|----|---------|------|
| `programmation_hda` | Programmation_HDA_Editable_2026-2027.xlsx | Programmation |
| `progression_emc` | Progression_EMC_Editable_2026-2027.xlsx | Progression |
| `emploi_du_temps_rentree` | emploi_du_temps_rentree.xlsx | Emploi du temps |
| `guide_mhm_ce1_ce2` | MHM_CE1_CE2_GUIDE.pdf | Guide du maître |

## Commandes

```bash
# Comparer avec les résultats attendus (CI / avant prod)
npm run test:validation

# Regénérer la baseline après validation manuelle d'un nouveau comportement correct
npm run test:validation:baseline

# Test réel parseur + Supabase direct (sans serveur HTTP)
npm run test:validation:real

# Enchaînement HTTP complet analyze → save (serveur dev requis + cookie auth)
npm run dev
npm run test:validation:api

# Persistance navigateur : onglets, refresh, reconnexion (Playwright + serveur dev)
npm run test:validation:browser

# Inclure la vérification Supabase (custom_text, etc.)
npm run test:validation:persistence

# Captures d'écran (serveur dev requis + Playwright)
npm run dev
npm run test:validation:screenshots
npm run test:validation:screenshots:baseline
```

## Règle fondamentale

**Aucune évolution n'est terminée tant que `npm run test:validation` ne passe pas.**

## Ajouter un nouveau document

1. Placer le fichier dans le sous-dossier approprié.
2. Ajouter une entrée dans `manifest.json`.
3. Exécuter `npm run test:validation:baseline`.
4. Vérifier manuellement le snapshot dans `resultats_attendus/`.
5. Commiter le fichier source **et** le snapshot JSON.

## Ce qui est vérifié

- **Programmation / Progression** : dates, jours, périodes, semaines, séquences, séances, compétences, ordre des lignes, correspondance cellule source ↔ interprétation.
- **Emploi du temps** : matières, sous-matières, texte complémentaire, horaires, duplication, export, affichage.
- **Guides du maître** : extraction PDF, classification, mots-clés pédagogiques, méthode détectée (MHM, etc.).

## Rapport

Chaque exécution produit :

- `rapports/latest.md` — rapport lisible
- `rapports/latest.json` — rapport machine

Contenu : documents testés, statistiques, différences, note de fiabilité /100.

## Variables d'environnement optionnelles

| Variable | Usage |
|----------|-------|
| `FLORA_VALIDATION_BASE_URL` | URL du serveur dev (défaut `http://localhost:3000` — utiliser le port affiché par `npm run dev`) |
| `FLORA_VALIDATION_EMAIL` | Compte test pour persistance Supabase |
| `FLORA_VALIDATION_PASSWORD` | Mot de passe du compte test |
