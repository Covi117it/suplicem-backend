interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory TTL cache with single-flight deduplication for concurrent reads.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number = 250
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      return pending;
    }

    const promise = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) this.entries.delete(oldestKey);
    }
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(key?: string): void {
    if (key === undefined) {
      this.entries.clear();
      return;
    }
    this.entries.delete(key);
  }
}
