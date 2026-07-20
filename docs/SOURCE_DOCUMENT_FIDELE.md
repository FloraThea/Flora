# Copie fidèle du fichier importé (Parts 22–37)

## Principe

Flora conserve **deux représentations distinctes** pour chaque document importé :

1. **`source_document`** — copie fidèle du fichier (affichage, export, impression, comparaison).
2. **Tables pédagogiques Flora** — interprétation structurée (liens, cahier journal, filtres).

L'interprétation ne modifie jamais la copie fidèle.

## Stockage

Migration : `supabase/migrations/20250719200000_source_document.sql`

| Table | Colonne | Contenu |
|-------|---------|---------|
| `programmations` | `source_document` (jsonb) | Feuilles, cellules, fusions, styles |
| `progressions` | `source_document` (jsonb) | Idem |

Structure JSON (`lib/import/source-document.ts`) :

- `sheets[]` : nom, dimensions, `mergedRanges`, grille `rows[][]`
- Chaque cellule : `displayValue` (texte exact), `rawValue`, `style` optionnel
- `activeSheetIndex` : feuille utilisée pour l'interprétation pédagogique

Fallback si migration non appliquée : `original_import.sourceDocument` ou `metadata.source_document`.

## Extraction à l'import

`lib/import/extract-source-document.ts` :

- **Excel** : toutes les feuilles, plage complète `!ref`, cellules vides, `!merges`, styles basiques
- **CSV / texte collé** : toutes les lignes (y compris vides)
- **PDF / image** : lignes de texte extrait (OCR)

Branché dans `parse-programmation.ts` → persisté via `programmation-import-service` et `progression-import-service`.

## Affichage

Composant : `components/pedagogical/FaithfulSourceTableView.tsx`

- Onglets par feuille Excel (noms recopiés à l'identique)
- Table HTML avec `rowSpan` / `colSpan`
- Retours à la ligne (`white-space: pre-wrap`)
- Défilement horizontal sur mobile
- Édition cellule par cellule + annulation locale

Toggle : **Vue fidèle au fichier** (défaut après import) / **Vue structurée Flora**

Pages : Programmation, Progression.

## API

`PATCH /api/source-document/cell`

```json
{
  "entityType": "programmation" | "progression",
  "entityId": "uuid",
  "sheetIndex": 0,
  "row": 0,
  "col": 0,
  "displayValue": "texte modifié"
}
```

## Export

`lib/import/source-document-export.ts` :

- Export Excel fidèle (mêmes feuilles, fusions, textes)
- Impression via fenêtre dédiée

## Comparaison source ↔ Flora

`lib/import/compare-source-document.ts` — vérifie feuilles, dimensions, textes cellule par cellule.

Tests : `lib/import/run-source-document-tests.ts`

## Documents existants

Les programmations/progressions déjà en base **ne sont pas modifiées**. Seuls les nouveaux imports reçoivent `source_document`. La vue structurée reste disponible pour tous.

## Séquences / séances

Pas de pipeline d'import dédié aujourd'hui. Le modèle `source_document` est prêt à être étendu aux tables `sequences` et `seances` lorsque l'import y sera branché.
