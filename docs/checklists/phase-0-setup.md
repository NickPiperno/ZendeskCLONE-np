# Phase 0: Initial Project Setup

This file provides a checklist to set up the development environment and configure the base tooling needed to start coding. It covers installing dependencies, initializing tooling, and ensuring basic configuration for your local environment.

---

## Flattened Task List

[ ] BACKEND: Install or update to the latest LTS version of Node.js (via nvm or official installer).  
[ ] BACKEND: Confirm Node/ npm installation by running "node -v" and "npm -v".  
[ ] BOTH: Install Git if not already installed (version control).  
[ ] BOTH: Clone or initialize a repository for the project.  
[ ] BOTH: (Optional) Set up Git hooks for pre-commit linting or testing.  
[ ] FRONTEND: Install Vite, React, and core dev dependencies if starting from scratch ("npm install vite react react-dom --save-dev").  
[ ] BOTH: Install and configure TypeScript, ESLint, and Prettier for code consistency.  
[ ] BOTH: Create and set up tsconfig.json, .eslintrc, and .prettierrc based on docs/rules/codebase-best-practices.md.  
[ ] BOTH: Create a new .env file (never commit) and add placeholders for SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY.  
[ ] BOTH: Verify environment variables are loaded properly (via dotenv).  
[ ] BOTH: Install recommended IDE extensions (ESLint, Prettier, Tailwind IntelliSense, etc.).  
[ ] BOTH: Configure Yarn or pnpm if not using npm and set up a CI/CD system (GitHub Actions, AWS Amplify).  
[ ] BACKEND: Run "npm run dev" or "yarn dev" to verify Vite starts successfully and TypeScript compiles.  
[ ] BOTH: Confirm linting and formatting run properly with no errors.

---

## References
- docs/rules/codebase-best-practices.md for recommended file structures and linting guidelines.
- docs/active-workflows/backend-workflow.md (if relevant) for backend-specific setups.
- nvm or the official Node.js site for managing Node versions: https://nodejs.org

Once these setup tasks are completed, you're ready to proceed to Phase 1 (Project Setup & Basic Architecture). 