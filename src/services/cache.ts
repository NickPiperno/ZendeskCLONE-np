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
    if (typeof key !== 'string' || key.length === 0) {
      console.warn('Cache key must be a non-empty string');
      return;
    }

    const item: CacheItem<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    };

    // Memory cache
    if (this.memoryCache.size >= this.maxItems) {
      // Remove oldest item if cache is full (LRU)
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }
    this.memoryCache.set(key, item);

    // LocalStorage cache
    try {
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.warn('LocalStorage write failed:', error);
    }
  }

  /**
   * Get a value from cache (memory first, then localStorage)
   */
  get<T>(key: string): T | null {
    if (typeof key !== 'string' || key.length === 0) {
      console.warn('Cache key must be a non-empty string');
      return null;
    }

    // Try memory cache first
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem) {
      if (this.isValid(memoryItem)) {
        return memoryItem.value;
      }
      this.memoryCache.delete(key);
    }

    // Try localStorage if not in memory
    try {
      const storedItem = localStorage.getItem(key);
      if (storedItem) {
        const item: CacheItem<T> = JSON.parse(storedItem);
        if (this.isValid(item)) {
          // Refresh memory cache
          this.memoryCache.set(key, item);
          return item.value;
        }
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('LocalStorage read failed:', error);
    }

    return null;
  }

  /**
   * Remove item from both caches
   */
  remove(key: string): void {
    if (typeof key !== 'string' || key.length === 0) {
      console.warn('Cache key must be a non-empty string');
      return;
    }
    
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('LocalStorage remove failed:', error);
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