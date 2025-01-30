declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VITE_SUPABASE_URL: string;
      VITE_SUPABASE_ANON_KEY: string;
      VITE_OPENAI_API_KEY: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

export {}; 