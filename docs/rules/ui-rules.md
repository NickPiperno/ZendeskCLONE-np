# UI Rules

This document provides guidelines for building responsive and accessible components for AutoCRM, referencing the user journey laid out in the [User Flow](../project-info/user-flow.md) and our chosen tech stack described in the [Tech Stack](../project-info/tech-stack.md) and [Tech Stack Rules](./tech-stack-rules.md).

---

## 1. Responsiveness & Layout

1. Follow a mobile-first approach:
   - Start with small viewports and gradually enhance layouts for larger screens.
   - Use Tailwind's responsive classes (e.g., sm:, md:, lg:) to optimize layouts.
2. Leverage grid and flex utilities:
   - Employ Tailwind's grid and flex properties for consistent alignment.
   - Use utility classes (gap-x-, gap-y-) for spacing content without nested wrappers.

---

## 2. Component Structure & Interaction

1. Prefer Functional, Declarative Components:
   - Keep components small, focusing on a single responsibility.
   - Utilize React hooks for state management and side effects.
   - Avoid excessive prop drilling by using React context or specialized data-fetching hooks.

2. Accessibility First:
   - Ensure adherence to WCAG 2.1 standards:
     - Provide descriptive labels (aria-label, aria-labelledby).
     - Include appropriate role attributes (e.g., role="dialog" for modals).
   - Shadcn UI and Tailwind can compose accessible base elements with roles, states, and ARIA tags.

3. Consistency in Control and Feedback:
   - For each user action (e.g., ticket creation, status update), acknowledge success/failure states in the UI.
   - Use standard patterns for dialogues, confirmations, and notifications to reduce confusion.

4. Integration with Supabase for Real-Time Updates:
   - Components that display live data (e.g., ticket queue, chat panel) should subscribe to Supabase Realtime events.
   - Consider providing visual feedback (e.g., loading states, partial UI skeletons) for smooth transitions.

---

## 3. Code Organization

1. Folder Structure:
   - /components: Shared, reusable UI components.
   - /hooks: Custom React hooks for data fetching, state, or logic that is reused across components.
   - /pages (or /app in newer Next.js setups): Organize user-facing routes.

2. Naming Conventions:
   - Use descriptive, self-documenting names (e.g., TicketList, AgentDashboard).
   - Capitalize React component files (e.g., TicketList.tsx).

3. Testing with Jest:
   - Keep test files (TicketList.test.tsx) alongside their corresponding component or in a __tests__ folder.
   - Write unit tests for logic, integration tests for API calls, and component tests for rendering behavior.

---

## 4. Interaction with Backend

1. Data Fetching:
   - Use Supabase client in server-side or client-side hooks with minimal duplication.
   - Employ React Suspense or loading states for improved user experience.

2. Authentication & Authorization:
   - Adhere to Supabase's row-level security rules.
   - Provide guarded routes/pages that validate user sessions before allowing access.

3. Error Handling & Logging:
   - Display user-friendly messages for predictable errors (e.g., missing fields, invalid credentials).
   - Employ Sentry or similar logging for server/client error tracking.

---

## 5. Appearance & Theming

1. Centralized Theme Configuration:
   - Keep color palettes, spacing scales, and typography in Tailwind config.
   - For Shadcn UI components, extend or override default tokens in a single theme file.

2. Adaptive Color Schemes:
   - Support dark or light modes if required by the project scope.
   - Ensure that color contrast meets accessibility guidelines (4.5:1 for text on background).

3. Modern Skeuomorphic Alignment:
   - Keep subtle shadows and gradients consistent across components.
   - Use realistic textures sparingly to maintain performance and clarity.

---

## 6. Performance Considerations

1. Bundle Splitting & Lazy Loading:
   - Import large third-party libraries or rarely used components only when needed.
2. Minimize Network Requests:
   - Batch or debounce requests to Supabase as appropriate.
3. Optimize Images:
   - Use WebP format or next-gen formats where possible.
   - Define fixed image dimensions to prevent layout shifts.

---

## 7. Security & Compliance

1. Never Hardcode Sensitive Data:
   - Store API keys, connection strings in .env files.
2. Follow Privacy Regulations:
   - For personal data, consider data minimization and encryption at rest (within Supabase).
3. Validate User Inputs:
   - On both client and server to prevent injection or malicious content.

---

## 8. Maintenance & Evolution

1. Documentation:
   - Maintain inline comments for complex logic.
   - Keep a regularly updated README or wiki for onboarding new contributors.
2. Continuous Integration:
   - Automate linting, testing, and code format checks in GitHub Actions or Amplify build pipelines.
3. Versioning & Deployment:
   - Use semantic versioning.  
   - Stage changes in development or staging environments first, then deploy to production.

---

### Conclusion

These UI Rules ensure consistency, readability, and scalability across AutoCRM's front-end. By pairing these guidelines with our [Tech Stack Rules](./tech-stack-rules.md), we can deliver an accessible and responsive user experience aligned with the user flows detailed in [User Flow](../project-info/user-flow.md). 