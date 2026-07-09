# Stockage Flora — Cloudflare R2

Flora stocke les **nouveaux documents** dans **Cloudflare R2** via une couche d'abstraction (`StorageService`). Supabase reste utilisé pour l'authentification, PostgreSQL, pgvector, les métadonnées et les Edge Functions.

## Architecture

```
Application
    └── StorageService  (lib/storage/StorageService.ts)
            ├── CloudflareR2Provider   ← défaut (nouveaux imports)
            └── SupabaseStorageProvider ← legacy (anciens fichiers)
```

Aucun module métier n'appelle R2 directement : tout passe par `storageService`.

## Variables d'environnement

Ajoutez ces variables dans **`.env.local`** à la racine du projet (côté serveur uniquement — **ne jamais** préfixer par `NEXT_PUBLIC_`) :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `CLOUDFLARE_R2_ACCOUNT_ID` | ID compte Cloudflare | `a1b2c3...` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Clé d'accès R2 | `...` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Secret R2 | `...` |
| `CLOUDFLARE_R2_BUCKET_NAME` | Nom du bucket | `flora-documents` |
| `CLOUDFLARE_R2_ENDPOINT` | Endpoint S3 API | `https://<account_id>.r2.cloudflarestorage.com` |

### Variables optionnelles

| Variable | Description | Défaut |
|----------|-------------|--------|
| `FLORA_STORAGE_PROVIDER` | `cloudflare_r2` ou `supabase` | `cloudflare_r2` |
| `FLORA_STORAGE_SIGNED_URL_TTL_SECONDS` | Durée URL signées (secondes) | `3600` |
| `FLORA_MAX_UPLOAD_BYTES` | Taille max upload | `524288000` (500 Mo) |

### Où les placer

1. Copiez `.env.example` vers `.env.local`
2. Renseignez les 5 variables R2 obligatoires
3. Redémarrez le serveur de dev : `npm run dev`

Les clés R2 se créent dans **Cloudflare Dashboard → R2 → Manage R2 API Tokens**.

## Structure des fichiers dans R2

```
documents/
  {userId}/
    guides/
    bo/
    programmations/
    progressions/
    evaluations/
    albums/
    images/
    archives/
      {uuid}-{nom-fichier-sécurisé}
```

- **`userId`** : ID profil enseignant (`teacher_profiles.id`)
- **UUID** : identifiant unique par objet (évite les collisions)
- **Privé** : accès uniquement via URL signées (`getSignedUrl()`)

## Flux d'import documentaire

1. **Préparation** — validation taille/format, création session DB, `CreateMultipartUpload` R2
2. **Upload** — morceaux envoyés au serveur → `UploadPart` R2 (multipart natif, sans merge Supabase)
3. **Vérification** — `CompleteMultipartUpload` + contrôle métadonnées objet
4. **Métadonnées Supabase** — insertion ligne `documents` avec `storage_provider: cloudflare_r2`
5. **Analyse IA** — extraction, OCR, titres, chapitres, matières, niveau, cycle, méthode
6. **Indexation** — segments + embeddings pgvector

## API StorageService

| Méthode | Rôle |
|---------|------|
| `upload()` | Upload simple (PutObject) |
| `download()` | Téléchargement (GetObject) |
| `delete()` | Suppression |
| `exists()` | Vérification présence |
| `getSignedUrl()` | URL signée temporaire |
| `getMetadata()` | HeadObject |
| `move()` | Copie + suppression |
| `list()` | Liste par préfixe |
| `createMultipartUpload()` | Début upload multipart |
| `uploadPart()` | Partie multipart |
| `completeMultipartUpload()` | Finalisation |
| `abortMultipartUpload()` | Annulation |

## Tester la connexion R2

### 1. Health check API

```bash
curl http://localhost:3000/api/storage/health
```

Réponse attendue :

```json
{
  "ok": true,
  "provider": "cloudflare_r2",
  "bucket": "flora-documents",
  "message": "Connexion Cloudflare R2 opérationnelle."
}
```

Si une variable manque :

```json
{
  "ok": false,
  "missingEnv": ["CLOUDFLARE_R2_SECRET_ACCESS_KEY"],
  "error": "Configuration Cloudflare R2 incomplète. Variable(s) manquante(s) : ..."
}
```

### 2. Import test via l'UI

1. Ouvrir **Bibliothèque**
2. Importer un PDF (< 500 Mo)
3. Observer la barre de progression (6 étapes)
4. Vérifier les logs serveur `[import/init] Session R2 prête`

### 3. Vérifier l'objet dans R2

**Cloudflare Dashboard → R2 → flora-documents → documents/{userId}/...**

Ou via AWS CLI compatible S3 :

```bash
aws s3 ls s3://flora-documents/documents/ \
  --endpoint-url "$CLOUDFLARE_R2_ENDPOINT"
```

### 4. Vérifier les métadonnées Supabase

Dans la table `documents`, le champ `metadata` doit contenir :

```json
{
  "storage_provider": "cloudflare_r2",
  "storage_bucket": "flora-documents",
  "document_category": "guides",
  "user_id": "..."
}
```

## Logs en cas d'erreur

Les erreurs storage loguent :

- étape / opération
- provider (`cloudflare_r2`)
- bucket
- clé R2 (`storagePath`)
- taille, type MIME, nom fichier
- userId, sessionId, documentId
- réponse Cloudflare / AWS SDK brute

Rechercher dans les logs : `[storage] Échec` ou `[import-pipeline] Échec`.

## Mode legacy Supabase Storage

Pour basculer temporairement :

```env
FLORA_STORAGE_PROVIDER=supabase
```

Les documents déjà stockés avec `metadata.storage_provider = "supabase"` continuent d'être lus via le provider legacy, même en mode R2 par défaut.

## Checklist de validation migration

- [ ] Les 5 variables `CLOUDFLARE_R2_*` sont dans `.env.local`
- [ ] `GET /api/storage/health` retourne `"ok": true`
- [ ] Import d'un PDF affiche les 6 étapes de progression
- [ ] L'objet apparaît dans le bucket R2 sous `documents/{userId}/...`
- [ ] La ligne `documents` contient `storage_provider: cloudflare_r2`
- [ ] L'analyse se termine (`document_import_jobs.status = completed`)
- [ ] Les segments / embeddings sont créés
- [ ] Aucun appel Supabase Storage lors d'un nouvel import (vérifier logs)
- [ ] URL signée fonctionne (`storageService.getSignedUrl()`)
- [ ] Message clair si une variable d'environnement manque
