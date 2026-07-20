# Corbeille Flora — purge automatique

Durée de conservation : **30 jours** (`TRASH_RETENTION_DAYS` dans `lib/trash/types.ts`).

## Fonctionnement

- Suppression depuis les modules → **suppression logique** (`deleted_at`, `purge_after`).
- Page **Corbeille** (`/corbeille`) → liste, restauration, suppression définitive.
- Purge automatique → `lib/trash/purge-service.ts` → `purgeExpiredTrashItems()`.

## Mise en place cron (à faire côté infra)

Endpoint : `POST /api/corbeille/bulk` avec `{ "action": "purge-expired" }`.

### Option Vercel Cron

Ajouter dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/corbeille/bulk",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Protéger la route avec un secret (`CRON_SECRET`) en production.

### Option Supabase pg_cron

Planifier un appel HTTP quotidien vers l'endpoint ci-dessus.

## Migration Supabase requise

Appliquer : `supabase/migrations/20250719120000_trash_and_subjects.sql`
