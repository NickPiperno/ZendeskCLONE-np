# Phase AI-0: Package Setup & TypeScript Configuration

## Tasks

[x] BACKEND: Add LangChain dependencies to package.json:
   ```json
   {
     "dependencies": {
       "@langchain/core": "^0.1.5",
       "@langchain/community": "^0.0.10",
       "@langchain/openai": "^0.0.11",
       "langchain": "^0.1.2"
     }
   }
   ```

[x] BACKEND: Add Supabase vector store dependencies:
   ```json
   {
     "dependencies": {
       "@supabase/supabase-js": "^2.39.0"
     }
   }
   ```

[x] BACKEND: Configure TypeScript for LangChain:
   - Update tsconfig.json:
     ```json
     {
       "compilerOptions": {
         "target": "ES2020",
         "module": "ES2020",
         "paths": {
           "@langchain/*": ["./node_modules/@langchain/*"],
           "@lib/*": ["./src/lib/*"]
         },
         "moduleResolution": "bundler",
         "noEmit": true,
         "allowImportingTsExtensions": true,
         "verbatimModuleSyntax": true
       }
     }
     ```

[x] BACKEND: Set up environment variables:
   - Create .env.example with required keys:
     ```
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     VITE_OPENAI_API_KEY=your_openai_key
     ```
   - Document required API keys in README
   - Add environment type declarations

[x] BACKEND: Set up AI module structure:
   ```
   src/
   ├─ modules/
   │  └─ ai/                    # AI feature module
   │     ├─ components/         # AI-specific UI components
   │     │  └─ ChatInterface.tsx
   │     ├─ types/             # AI-specific types
   │     │  ├─ agents.ts       # Agent types (base + domain)
   │     │  ├─ documents.ts    # AI document types
   │     │  └─ index.ts        # Type exports
   │     ├─ services/          # AI service implementations
   │     │  ├─ agents/         # Agent implementations
   │     │  └─ vectorstore.ts  # Vector store setup
   │     └─ hooks/             # AI-specific hooks
   ```

[x] BACKEND: Create base agent type definitions in new structure:
   - Move and update agent types to src/modules/ai/types/agents.ts
   - Move document types to src/modules/ai/types/documents.ts
   - Create type index file

[x] BACKEND: Verify all imports resolve correctly:
   - Test LangChain imports
   - Validate Supabase client setup
   - Check environment variable typing

---

## References

- [@tech-stack.md](../../project-info/tech-stack.md) – Package versions and compatibility
- [@codebase-best-practices.md](../../rules/codebase-best-practices.md) - Project structure guidelines
- [LangChain JS/TS Documentation](https://js.langchain.com/docs/introduction)
- [Supabase Vector Store Documentation](https://js.langchain.com/docs/integrations/vectorstores/supabase)

---

## Completion Criteria

- All TypeScript errors resolved
- Package imports working correctly
- Environment variables properly typed
- Base agent types defined and importable
- Module structure follows codebase best practices 