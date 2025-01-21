# Phase 4: Administrative Control & Routing Intelligence

Per @project-overview.md (Administrative Control) and @user-flow.md (Administrative Journey), we'll add features for managing teams, routing tickets, and load balancing.

---

## Flattened Task List

[ ] FRONTEND: Create “AdminConsole” page/section displaying teams, roles, and routing rules.  
[ ] FRONTEND: Provide UI flows to add/edit teams, assign skill sets to agents, set coverage schedules.  
[ ] FRONTEND: Integrate reactive status icons or badges to show team availability.  
[ ] BACKEND: Build DB schema for roles/permissions, team membership, and skill sets.  
[ ] BACKEND: Implement rule-based assignment logic (match new tickets by skill/priority).  
[ ] BACKEND: Add load balancing logic to distribute tickets across available agents.  
[ ] BACKEND: Ensure role-based access control (RBAC) in Supabase or a custom mechanism.

---

## References
- @project-overview.md → "Team Management" & "Routing Intelligence."  
- @user-flow.md → "Administrative Journey" & load balancing.  
- @tech-stack-rules.md → Lean on row-level security or a custom approach for complex permissions.  
- @codebase-best-practices.md → Keep role-based logic modular and documented.  