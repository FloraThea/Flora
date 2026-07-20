const DEFAULT_TTL_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const cache = new Map<string, CacheEntry>();

export function getPedagogicalCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setPedagogicalCache(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidatePedagogicalCache(profileId?: string): void {
  if (!profileId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${profileId}:`)) cache.delete(key);
  }
}

export function pilotageCacheKey(profileId: string, matiere?: string): string {
  return `${profileId}:pilotage:${matiere ?? "all"}`;
}

export function coherenceCacheKey(profileId: string): string {
  return `${profileId}:coherence`;
}
