# Tech Stack Rules

This document outlines best practices, limitations, and conventions for each of the selected technologies in our AutoCRM project. By adhering to these guidelines, we can maintain consistency, performance, and scalability throughout our codebase.

---

## 1. Node.js & TypeScript

### Best Practices
1. Use the latest Long-Term Support (LTS) version of Node.js for stability and security.
2. Enable strict mode in TypeScript (strict, noImplicitAny, strictNullChecks).
3. Organize the application into modular folders (e.g., routes, controllers, services).
4. Use environment variables for configuration. Never hardcode credentials.
5. Maintain clean, meaningful names for variables and functions.

### Limitations
1. High concurrency can require additional optimization beyond Node's single-threaded event loop.
2. Inconsistent or erroneous type definitions in external libraries can cause type issues.

### Common Pitfalls
1. Overusing "any" or ignoring type errors leads to bugs.
2. Mixing callback-based and async/await code in the same functions creates confusion.
3. Unhandled promise rejections can crash the application.

---

## 2. Vite & React

### Best Practices
1. Leverage Vite's fast development server and hot module replacement.
2. Favor functional components in React with hooks for state management.
3. Use code splitting and lazy-loading for large components or heavy logic.
4. Keep components small and focused; separate logic into hooks or helpers.
5. Apply accessibility (ARIA) attributes to interactive elements.

### Limitations
1. Vite's architecture is heavily reliant on ES modules; be cautious with CommonJS libraries.
2. React requires additional libraries for complex global state management or side effects.

### Common Pitfalls
1. Neglecting SSR requirements—Vite is primarily a client bundler (Next.js or a server integration is needed for SSR).
2. Large, monolithic components reduce reusability and testability.

---

## 3. Tailwind CSS & Shadcn UI

### Best Practices
1. Use Tailwind utility classes for consistent, responsive styling.
2. Rely on Shadcn UI components for accessible, prebuilt UI patterns.
3. Keep utility overrides minimal; consider using Tailwind config for shared styles.
4. Extract reusable class sets into Tailwind components or partials if used often.

### Limitations
1. Tailwind classes can become verbose; consider refactoring if class lists grow unwieldy.
2. Shadcn UI primarily provides headless components; some assembly may be required.

### Common Pitfalls
1. Duplicating style logic across multiple components instead of centralizing.
2. Missing or incorrect ARIA attributes within custom Shadcn UI integrations.

---

## 4. Supabase (Database, Auth, Realtime)

### Best Practices
1. Utilize Supabase's row-level security for fine-grained data access.
2. Store and query data via TypeScript auto-generated interfaces.
3. Use built-in full-text search for queries instead of introducing external search engines for MVP.
4. Embrace Realtime features for live updates on tickets or chat functionality.
5. Consolidate background jobs with PostgreSQL's LISTEN/NOTIFY when possible.

### Limitations
1. The free tier enforces usage limits on database size, file storage, and monthly requests.
2. Complex analytical queries may require third-party analytics tools or data warehousing.

### Common Pitfalls
1. Not synchronizing newly added Postgres tables with Supabase's generated types.
2. Exceeding the free-tier quotas and facing unexpected latencies or restrictions.

---

## 5. AWS Amplify (Hosting & CI/CD)

### Best Practices
1. Maintain separate Amplify environments for development, staging, and production.
2. Automate tests in GitHub Actions or similar before deploying to Amplify.
3. Use Amplify's built-in monitoring and logs for error tracking (or integrate third-party solutions).
4. Utilize AWS Identity and Access Management (IAM) for controlling resource access.

### Limitations
1. Amplify can incur costs quickly if usage scales—monitor usage against free tier.
2. Deep customization may require manually configuring AWS services.

### Common Pitfalls
1. Forgetting to remove resources when cleaning up environments, leading to unexpected charges.
2. Storing secrets in the Amplify console without employing AWS Parameter Store or Secrets Manager.

---

## 6. OpenAI + LangChain (AI/Chatbot)

### Best Practices
1. Cache repeated AI queries to reduce costs (e.g., store recent queries in memory or the database).
2. Use temperature, max tokens, and relevant prompt engineering to control spending and unpredictability.
3. Sanitize user inputs thoroughly before sending them to the API.
4. Validate AI outputs if the results significantly affect user experience or data integrity.

### Limitations
1. OpenAI usage is paid per token—unexpected usage spikes can become costly.
2. Some features require large context window, which can be expensive or slow.

### Common Pitfalls
1. Missing error handling for rate-limited or failed requests.
2. Not aligning AI logic with user privacy rules or compliance standards.

---

## 7. Jest (Testing & QA)

### Best Practices
1. Use ts-jest for seamless TypeScript integration.
2. Keep unit tests focused on single functionality; maintain clear "Arrange–Act–Assert" pattern.
3. For component tests, pair Jest with React Testing Library to simulate user interactions.
4. Gather coverage reports to identify untested or under-tested sections.

### Limitations
1. Jest does not cover true end-to-end browser automation (Playwright or Cypress might be needed if advanced E2E is required).
2. Snapshot tests can become brittle if misused.

### Common Pitfalls
1. Large test files can become difficult to manage—split into logical test suites.
2. Skipping tests frequently reduces coverage and can mask production bugs.

---

## Best-Practice Conventions

1. Keep environment variables in a .env file, never commit them to version control.  
2. Use strongly typed function parameters, return values, and advanced TypeScript features (like generics) for clarity.  
3. Lint and format code with ESLint + Prettier to maintain consistency.  
4. Follow the "conventional commits" format for Git messages.  
5. Strive for minimal side effects in code—favor pure functions and descriptive naming.

---

## Conclusion

By adhering to these rules, we ensure a cleaner, more efficient, and robust codebase. The selected technologies, when used with the outlined best practices and conventions, equip us to build a scalable, maintainable CRM system. Frequent reviews and updates to these rules will help address evolving project requirements and technologies. 