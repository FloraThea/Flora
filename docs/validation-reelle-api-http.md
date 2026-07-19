# Validation réelle — enchaînement API HTTP

- Base URL : `http://localhost:3001`
- Compte test : `flora-api-real-1784462989616@test.flora.local`
- Date : 2026-07-19T12:11:39.552Z

## Parcours testé

1. `POST /api/auth/link-profile` (cookie `flora-auth-token`)
2. `POST /api/*/import` multipart `action=analyze`
3. `POST /api/*/import` JSON `action=save`
4. `GET` list + details
5. `DELETE /api/auth/link-profile` + reconnexion + revérification list

## Résultats

| Module | Titre | Attendu | Enregistré | Liste | Détails | Reconnexion |
|--------|-------|---------|------------|-------|---------|-------------|
| programmation | API — Programmation HDA 1784462990826 | 35 | 35 | ✓ | ✓ | ✓ |
| progression | API — Progression EMC 1784462994730 | 34 | 34 | ✓ | ✓ | ✓ |
| emploi_du_temps | API — EDT rentrée 1784462997046 | 56 | 56 | ✓ | ✓ | ✓ |

## Statut

✓ Tous les imports HTTP analyze → save → reload sont conformes.

