# Validation réelle — Analyse Théa BO EVAR

- Base URL : `http://localhost:3001`
- Fichier : `tests/validation/referentiel/Programme_EVAR_elementaire-405261.pdf`
- Date : 2026-07-21

## Import (extraction HTTP)

| Critère | Résultat |
|---------|----------|
| Pages | 18 |
| Caractères | 52 423 |
| Type PDF | text (sans OCR) |
| Matière inférée | EMC |
| Sections EVAR | 4 (Principes, Contenus, Organisation, Programmation par niveau) |
| Statut post-import | TEXT_EXTRACTED |

**Statut : OK**

## Analyse Théa (Gemini)

### Exécution aboutie (session précédente, logs serveur)

Lors d'un run complet avant épuisement du quota Gemini, le pipeline a traité les 4 sections :

| Section | Items extraits |
|---------|----------------|
| Principes et cadre EVAR | 18 |
| Contenus et progressivité | 25–27 |
| Organisation et mise en œuvre | 54–62 |
| Programmation par niveau | 203–208 |

Le document est passé en **ANALYZED** avec insertion en base (`referentiels`).

### Limites rencontrées en validation automatisée

1. **Limite Vercel Hobby (300 s)** : l'analyse BO est découpée en ticks progressifs (`POST /api/centre-ressources/analyze` = un bloc par requête).
2. **Quota Gemini free tier** : limite **20 requêtes/jour** pour `gemini-2.5-flash`. Les relances de test ont épuisé le quota (`429 RESOURCE_EXHAUSTED`).

Le test `npm run test:validation:bo-analyze` utilise **HTTP + polling Supabase** pour attendre le statut `ANALYZED` malgré la coupure HTTP en dev.

**Statut actuel : pipeline validé via logs serveur ; test auto bloqué par quota API jusqu'à reset quotidien.**

## Fixtures import (DOCX / PNG / PDF scanné)

| Fixture | Résultat |
|---------|----------|
| `documents_divers/exemple.docx` | 86 caractères (mammoth) |
| `documents_divers/exemple.png` | 71 caractères (OCR image) |
| `documents_divers/scan_ocr_test.pdf` | 100 caractères, `pdfKind=scanned`, `usedOcr=true` |

Campagne globale : **9/9 OK** — voir `docs/validation-campagne-import.md`.

## Relancer l'analyse Théa

```bash
npm run dev   # noter le port (ex. 3001)
FLORA_VALIDATION_BASE_URL=http://localhost:3001 npm run test:validation:bo-analyze
```

Prérequis : `GEMINI_API_KEY` avec quota disponible (~5–8 appels Gemini pour l'EVAR complet).
