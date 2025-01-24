/**
 * cache.ts
 * Service for handling client-side caching using localStorage and memory cache.
 * Implements TTL (Time To Live) and LRU (Least Recently Used) strategies.
 */

interface CacheItem<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

class CacheService {
  private memoryCache: Map<string, CacheItem<any>>;
  private readonly maxItems: number;

  constructor(maxItems = 100) {
    this.memoryCache = new Map<string, CacheItem<any>>();
    this.maxItems = maxItems;
  }

  /**
   * Set a value in both memory and localStorage with TTL
   */
  set<T>(key: string, value: T, ttlMinutes = 5): void {
    // Early return for invalid keys
    if (!key) return;

    const item: CacheItem<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    };

    // Memory cache
    if (this.memoryCache.size >= this.maxItems) {
      const entries = Array.from(this.memoryCache.entries());
      if (entries.length > 0) {
        const [oldestKey] = entries[0];
        this.memoryCache.delete(oldestKey);
      }
    }

    // Only set if we have a valid key
    if (typeof key === 'string') {
      this.memoryCache.set(key, item);
      try {
        localStorage.setItem(key, JSON.stringify(item));
      } catch (error) {
        console.warn('LocalStorage write failed:', error);
      }
    }
  }

  /**
   * Get a value from cache (memory first, then localStorage)
   */
  get<T>(key: string): T | null {
    // Early return for invalid keys
    if (!key) return null;

    // Only proceed if we have a valid key
    if (typeof key === 'string') {
      // Try memory cache first
      const memoryItem = this.memoryCache.get(key);
      if (memoryItem && this.isValid(memoryItem)) {
        return memoryItem.value;
      }

      // Try localStorage if not in memory
      try {
        const storedItem = localStorage.getItem(key);
        if (storedItem) {
          const item: CacheItem<T> = JSON.parse(storedItem);
          if (this.isValid(item)) {
            this.memoryCache.set(key, item);
            return item.value;
          }
          localStorage.removeItem(key);
        }
      } catch (error) {
        console.warn('LocalStorage read failed:', error);
      }
    }

    return null;
  }

  /**
   * Remove item from both caches
   */
  remove(key: string): void {
    // Early return for invalid keys
    if (!key) return;

    // Only proceed if we have a valid key
    if (typeof key === 'string') {
      this.memoryCache.delete(key);
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('LocalStorage remove failed:', error);
      }
    }
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.memoryCache.clear();
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('LocalStorage clear failed:', error);
    }
  }

  /**
   * Check if a cached item is still valid
   */
  private isValid<T>(item: CacheItem<T>): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }
}

export const cache = new CacheService(); 