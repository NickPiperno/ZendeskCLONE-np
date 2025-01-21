# Codebase Best Practices

This document unifies guidelines from our Tech Stack, Tech Stack Rules, UI Rules, and Theme Rules to ensure our AI-first codebase remains modular, scalable, and easy to understand. Every file should begin with a brief explanation of its purpose, and each function should include clear comments or JSDoc-style annotations. To maintain readability for AI tools, aim to keep individual files under 250 lines.

---

## 1. Project Structure

Below is a recommended file and folder layout for AutoCRM, leveraging Vite + React, Tailwind + Shadcn UI, and Supabase. Organizing by feature or domain module helps keep the codebase logical and maintainable.

```
auto-crm/
├─ .env                  // Environment variables (DO NOT commit to repo)
├─ package.json         // Dependencies and scripts
├─ docs/               // Project documentation and rules
├─ vite.config.ts      // Vite configuration
├─ README.md           // Project overview and local development steps
├─ src/
│  ├─ modules/         // Feature-based modules
│  │  ├─ home/
│  │  │  └─ pages/
│  │  │     └─ WelcomePage.tsx    // Landing page
│  │  ├─ dashboard/
│  │  │  └─ pages/
│  │  │     └─ DashboardPage.tsx  // Main dashboard view
│  │  ├─ tickets/
│  │  │  ├─ components/
│  │  │  │  └─ TicketCard.tsx    // Single-ticket display card
│  │  │  ├─ hooks/
│  │  │  │  └─ useTicketData.ts  // Data fetching with Supabase
│  │  │  ├─ types/
│  │  │  │  └─ ticket.types.ts   // Ticket-specific types and interfaces
│  │  │  ├─ pages/
│  │  │  │  └─ TicketsPage.tsx   // Tickets management view
│  │  ├─ settings/
│  │  │  └─ pages/
│  │  │     └─ SettingsPage.tsx  // User/system settings
│  │  └─ auth/                   // Authentication module
│  │     ├─ components/
│  │     ├─ hooks/
│  │     ├─ types/
│  │     │  └─ user.types.ts     // User-specific types and interfaces
│  │     └─ pages/
│  │
│  ├─ ui/              // Shared UI components & layouts
│  │  ├─ components/
│  │  │  ├─ button.tsx          // Generic button component
│  │  │  └─ ...other components
│  │  └─ layout/
│  │     ├─ App.tsx            // Root application component
│  │     └─ MainLayout.tsx     // Common layout wrapper
│  │
│  ├─ lib/             // Shared utilities
│  │  └─ utils.ts             // Helper functions
│  │
│  ├─ services/        // External service integrations
│  │  ├─ supabase.ts         // Supabase client
│  │  └─ types.ts            // Shared service/database types
│  │
│  ├─ main.tsx              // Application entry point
│  ├─ index.css            // Global styles
│  └─ vite-env.d.ts       // Vite type definitions
│
├─ tests/              // Test files
│  ├─ home/
│  ├─ dashboard/
│  ├─ tickets/
│  └─ settings/
```

---

## 2. File Naming Conventions

1. Use **PascalCase** for React component filenames (e.g., TicketCard.tsx).  
2. Use **camelCase** for utility or hook files (e.g., useTicketData.ts).  
3. Group type definitions in a **types/** directory, using naming that reflects their domain (e.g., ticketTypes.ts).  
4. Barrel files (index.ts) can re-export items to simplify imports within each module.

---

## 3. Types Organization

1. **Module-Specific Types**
   - Place types in a `types/` directory within their respective feature module
   - Example: `modules/tickets/types/ticket.types.ts` for ticket-related types
   - Keep types close to the components and logic that use them

2. **Shared Types**
   - Place shared service/database types in `services/types.ts`
   - Example: Database schema types that span multiple modules
   - Keep the types minimal and focused on the service layer

3. **Type File Structure**
   - Use clear, descriptive names (e.g., `user.types.ts`, `ticket.types.ts`)
   - Export interfaces and types with meaningful names
   - Include proper JSDoc comments for complex types

Example of a well-organized types file:
```ts
// modules/tickets/types/ticket.types.ts
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface Ticket {
  id: string
  title: string
  // ... other properties
}
```

---

## 4. File Header Documentation

• At the top of each file, include a brief comment describing the file's purpose.  
• Example:  
  ```ts
  /**
   * TicketDashboard.tsx
   * This file renders the main interface for managing tickets,
   * fetching data from Supabase, and handling user interactions.
   */
  ```

---

## 5. Function-Level Comments

• Surround functions with concise, self-explanatory comments or JSDoc/TSDoc-style annotations, specifying parameters and return types.  
• Example:
  ```ts
  /**
   * Fetches ticket data from Supabase and filters by user ID.
   * @param userId - The ID of the currently logged-in user.
   * @returns A promise resolving to an array of Ticket objects.
   */
  export async function fetchTickets(userId: string): Promise<Ticket[]> {
    // ...
  }
  ```

---

## 6. Modular Development

1. **Domain-Centric Modules**: Group related pages, components, hooks, types, and logic by feature (e.g., tickets, auth).  
2. **Single Responsibility**: Keep each file focused. Split code into smaller modules if it grows too large.  
3. **Shared Components**: Place reusable UI elements in src/ui/components and domain-specific ones in their respective module.

---

## 7. Reflecting Our Tech Stack & Rules

1. **Vite + React**  
   - Keep components functional.  
   - Utilize code splitting for large or infrequently used components.  
2. **Tailwind CSS + Shadcn UI**  
   - Ensure consistent design tokens in skeuomorphicTheme.ts and minimal inline overrides.  
   - Follow accessible markup guidelines (roles, aria-label, etc.).  
3. **Supabase**  
   - Centralize client config in src/services/supabase.ts.  
   - Use row-level security and server-side hooking where possible.  
4. **Jest for Testing**  
   - Keep tests near their components in a mirrored folder structure or in tests/.  
   - Maintain small, focused test files.

---

## 8. Readability & AI Tool Friendliness

• **Line Limit**: Aim for under 250 lines per file to facilitate Cursor's AI reading.  
• **Comment-Driven Documentation**: Provide short, meaningful inline comments or docstrings.  
• **Naming & Clarity**: Prefer descriptive function/variable names (e.g., handleTicketAssignment).

---

## 9. Scalability Considerations

1. **Performance**: Use lazy loading, memoization, or caching where appropriate.  
2. **Architecture**: As the codebase grows, introduce feature flags or environment-based configs.  
3. **Memory Usage**: Offload large data computations to server-side or background jobs as our real-time features expand.

---

## 10. Ongoing Maintenance

1. **Version Control**:  
   - Follow conventional commits (e.g., feat: new ticket view).  
   - Commit small, logical changes for better traceability.  
2. **CI/CD**:  
   - Integrate linting, type checks, and Jest tests into GitHub Actions or Amplify.  
3. **Documentation Updates**:  
   - Keep README and relevant docs (ui-rules.md, theme-rules.md) current.  
   - Provide change logs for major updates or file reorganizations.

---

## Conclusion

By applying these practices, we uphold a clear, coherent, and scalable codebase that aligns with our Modern Skeuomorphic UI design, Vite + React stack, Supabase backend, and testing approach. The combination of these standards helps ensure our AI-first approach remains robust and maintainable over time.