import localforage from 'localforage';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class CacheService {
  private static store = localforage.createInstance({
    name: 'arcgis-explorer-cache',
    storeName: 'cache',
  });

  /**
   * Get data from cache if it exists and is not expired
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const entry = await this.store.getItem<CacheEntry<T>>(key);

      if (!entry) {
        return null;
      }

      const now = Date.now();
      const isExpired = now - entry.timestamp > entry.ttl;

      if (isExpired) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set data in cache with TTL
   */
  static async set<T>(key: string, data: T, ttl: number = 3600000): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };

      await this.store.setItem(key, entry);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete specific cache entry
   */
  static async delete(key: string): Promise<void> {
    try {
      await this.store.removeItem(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear all cache
   */
  static async clear(): Promise<void> {
    try {
      await this.store.clear();
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get all cache keys
   */
  static async keys(): Promise<string[]> {
    try {
      return await this.store.keys();
    } catch (error) {
      console.error('Cache keys error:', error);
      return [];
    }
  }

  /**
   * Get cache size and statistics
   */
  static async getStats(): Promise<{
    size: number;
    entries: number;
  }> {
    try {
      const keys = await this.keys();
      return {
        entries: keys.length,
        size: 0, // Size calculation would require iterating all entries
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { entries: 0, size: 0 };
    }
  }

  /**
   * Clean expired entries
   */
  static async cleanExpired(): Promise<number> {
    try {
      const keys = await this.keys();
      let cleaned = 0;

      for (const key of keys) {
        const entry = await this.store.getItem<CacheEntry<any>>(key);
        if (entry) {
          const now = Date.now();
          const isExpired = now - entry.timestamp > entry.ttl;
          if (isExpired) {
            await this.delete(key);
            cleaned++;
          }
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Cache clean error:', error);
      return 0;
    }
  }

  // Predefined cache keys
  static readonly KEYS = {
    SERVICE_CATALOG: (baseUrl: string) => `catalog:${baseUrl}`,
    SERVICE_DETAILS: (serviceUrl: string) => `service:${serviceUrl}`,
    LAYER_DETAILS: (serviceUrl: string, layerId: number) => `layer:${serviceUrl}:${layerId}`,
    QUERY_RESULT: (serviceUrl: string, layerId: number, query: string) =>
      `query:${serviceUrl}:${layerId}:${query}`,
  };

  // Default TTL values (in milliseconds)
  static readonly TTL = {
    SHORT: 5 * 60 * 1000, // 5 minutes
    MEDIUM: 30 * 60 * 1000, // 30 minutes
    LONG: 24 * 60 * 60 * 1000, // 24 hours
    FOREVER: 365 * 24 * 60 * 60 * 1000, // 1 year
  };
}
