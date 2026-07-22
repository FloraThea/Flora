# Rapport — correction moteur PDF (Node / Vercel)

Date : 2026-07-22

## Symptôme

Tous les PDF échouaient en production (Vercel) avec :

```
Failed to load external module pdf-parse-… : ReferenceError: DOMMatrix is not defined
```

## Bibliothèque identifiée

| Composant | Version | Rôle |
|-----------|---------|------|
| **pdf-parse** | **2.4.5** | API Flora (`PDFParse`, `getText`, `getInfo`, `getScreenshot`) |
| **pdfjs-dist** (transitive) | **5.4.296** | Moteur Mozilla PDF.js embarqué par pdf-parse |
| **@napi-rs/canvas** | **0.1.80** | Polyfill Node pour rendu OCR (`DOMMatrix`, `ImageData`, `Path2D`) |

Fichiers concernés avant correction :

- `lib/documents/extraction/pdf-extractor.ts`
- `lib/programming/import/extract-pdf-pages.ts`
- `tests/validation/lib/pdf-raw-extraction.ts`

## Cause exacte

1. **pdf-parse v2** s’appuie sur **pdfjs-dist 5.x**, qui expose deux builds :
   - `pdfjs-dist/build/pdf.mjs` — build **navigateur / generic** → utilise `DOMMatrix` dès le chargement du module
   - `pdfjs-dist/legacy/build/pdf.mjs` — build **Node legacy** → polyfill via `@napi-rs/canvas`

2. Flora importait `pdf-parse` via **`await import("pdf-parse")` (ESM)** dans des routes Serverless Next.js, avec **`pdfjs-dist` listé dans `serverExternalPackages`**.

3. Sur Vercel, la résolution du module externalisé chargeait parfois le build **non-legacy** de pdfjs-dist (`main: build/pdf.mjs`). En Node sans APIs navigateur, l’évaluation du module échoue immédiatement :

   ```
   Warning: Please use the `legacy` build in Node.js environments.
   ReferenceError: DOMMatrix is not defined
   ```

4. Ce n’est **pas** un bug de contenu PDF : c’est un **mauvais build pdf.js en environnement serveur**.

## Correction appliquée

### 1. Runtime Node dédié

Nouveau module : `lib/documents/extraction/pdf-node-runtime.ts`

- Charge **pdf-parse via `createRequire("pdf-parse")`** → build **CJS Node** avec legacy pdf.js inliné (pas de résolution ESM/browser).
- Installe les polyfills **`DOMMatrix` / `ImageData` / `Path2D`** depuis `@napi-rs/canvas` avant tout rendu (OCR).
- Aucune référence à `window`, `document`, ou import direct de `pdfjs-dist/build/pdf.mjs`.

### 2. Branchement du pipeline

- `pdf-extractor.ts`, `extract-pdf-pages.ts`, scripts de validation → `createNodePdfParser()`.

### 3. Dépendances & Next.js

- `@napi-rs/canvas@0.1.80` en dépendance directe.
- `pdf-parse@2.4.5` dans **`serverExternalPackages`** + **`outputFileTracingIncludes`** (présent dans `node_modules` sur Vercel).
- Chargement **uniquement via `require("pdf-parse")`** (build CJS legacy inliné) — **pas de `import("pdf-parse")`** (Turbopack bundlait pdfjs-dist navigateur → DOMMatrix).
- Polyfills dans `pdf-dom-polyfills.ts` (`@napi-rs/canvas` ou repli minimal).

### 4. Tests

- `run-pdf-extraction-tests.ts` : cas « sans `DOMMatrix` préalable » + guides MHM / BO.

## Bibliothèque retenue

**pdf-parse 2.4.5** (build CJS Node), avec **pdfjs-dist 5.4.296 legacy** inliné et **@napi-rs/canvas** pour le rendu OCR.

Alternative écartée : pdf-parse v1.x (API différente, incompatible avec `PDFParse` / `getScreenshot`).

## Vérification

```bash
npm run build
tsx lib/documents/extraction/run-pdf-extraction-tests.ts
node scripts/test-pdf-extraction.mjs
```

Après déploiement Vercel : import PDF bibliothèque + BO + programmation.
