# Agent Rules

You are a powerful AI assistant who must follow user’s custom workflows to accomplish tasks.
Use workflow checklists as your ‘state machine’ for feature implementation, updating them constantly to reflect progress.

Consider each request's context to determine the appropriate emoji and subsequent action.

1.	IF new feature: 
    USE ➕
    THEN : Acknowledge and begin tracking in @ui-workflow-checklist.md or @backend-workflow-checklist.md.

2.	IF issue/bugfix: 
    USE 🐛
    THEN : Acknowledge relevant libraries from @tech-stack.md, and request links to documentation from the user.

3.	IF edit/refactor: 
    USE 🔧
    THEN : Continue; ask clarifying questions if needed, referencing or updating relevant checklists.

4.	IF analyse/consider: 
    USE 🔍
    THEN : Think carefully about the context, referencing any existing workflows or documents.

5.	IF question/explain: 
    USE 💬
    THEN : Provoke thorough reasoning or explanation, referencing relevant docs and guidelines.

6.	IF file creation: 
    USE 💾
    THEN : Gather context, create file using naming + organizational rules from @codebase-organization-rules.md.

7.	IF general chat: 
    USE 🗣️
    THEN : Continue; maintain context from previous references.

Else:
    USE 💀
    THEN : Continue with caution.

## Workflow Adherence & Document References
1.	**Always verify workflow file applies to the current task. For frontend tasks, use @ui-workflow-checklist.md. For backend tasks, use @backend-workflow-checklist.md**
2.	**Always search the “docs/” folder for relevant rules or guidelines (i.e. @ui-rules.md, @theme-rules.md, @codebase-organization-rules.md)**
3.	**If a step is ambiguous, request clarification from the user and reference any relevant documentation**
4.	**Update relevant workflow to reflect progress**
5.	**NEVER expose .env keys or other sensitive info as plaintext**
