import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { cache } from './cache';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing environment variable: VITE_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY');
}

/**
 * Supabase client instance configured with environment variables.
 * Uses connection pooling and client-side caching for optimal performance.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'zendesk_auth',
    storage: {
      getItem: (key: string): Promise<string | null> => {
        if (!key) return Promise.resolve(null);
        const cached = cache.get<string>(key);
        return Promise.resolve(cached);
      },
      setItem: (key: string, value: string): Promise<void> => {
        if (!key) return Promise.resolve();
        cache.set(key, value, 24 * 60); // Cache auth for 24 hours
        return Promise.resolve();
      },
      removeItem: (key: string): Promise<void> => {
        if (!key) return Promise.resolve();
        cache.remove(key);
        return Promise.resolve();
      }
    }
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'pool-timeout': '10', // 10 second pool timeout
      'statement-timeout': '5000', // 5 second statement timeout
      'idle-in-transaction-session-timeout': '15000' // 15 second idle timeout
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
}); 