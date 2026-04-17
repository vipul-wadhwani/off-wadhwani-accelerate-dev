/**
 * Simple in-memory TTL cache for the Test Framework module.
 * No external dependencies — portable across any branch.
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

class TtlCache {
    private store = new Map<string, CacheEntry<unknown>>();

    set<T>(key: string, value: T, ttlMs: number): void {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    get<T>(key: string): T | null {
        const entry = this.store.get(key) as CacheEntry<T> | undefined;
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    invalidate(key: string): void {
        this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }

    size(): number {
        return this.store.size;
    }
}

export const cache = new TtlCache();

export const TTL = {
    VENTURES_LIST: 5 * 60 * 1000,   // 5 minutes
    VENTURE_CONTEXT: 5 * 60 * 1000, // 5 minutes per (ventureId, feature)
} as const;
