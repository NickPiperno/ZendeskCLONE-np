# Tech Stack Options - Final Decisions

Based on our [compatibility analysis](./tech-stack-compatibility.md), here are the final technology choices for the AutoCRM project.

---

## Core Stack Decisions

### 1. Language & Runtime
**Selected**: Node.js (TypeScript)
- Provides full-stack type safety
- Excellent ecosystem compatibility
- Strong support for async operations

### 2. Front-End Framework
**Selected**: Vite (React)
- Fast development experience with HMR
- Optimized build process
- Modern tooling and excellent TypeScript support

### 3. Styling & UI Components
**Selected**: Tailwind CSS + Shadcn UI
- Utility-first styling for rapid development
- Accessible, customizable components
- Strong TypeScript integration

### 4. Database & Data Layer
**Selected**: Supabase
- PostgreSQL-based with real-time capabilities
- Built-in row-level security
- Auto-generated TypeScript types
- Native support for complex data relationships

### 5. Hosting & Deployment
**Selected**: AWS Amplify
- Streamlined CI/CD pipeline
- Integrated monitoring
- Scalable infrastructure

### 6. Authentication
**Selected**: Supabase Auth
- Built-in user management
- Multiple auth providers
- Row-level security integration

### 7. Real-Time Features
**Selected**: Supabase Realtime
- WebSocket-based real-time updates
- Native PostgreSQL integration
- Typing support for messages

### 8. AI/Chatbot Integrations
**Selected**: OpenAI + LangChain
- Using LangChain.js/TS v0.3
- Packages: @langchain/core, @langchain/community
- Vector store: Supabase pgvector
- TypeScript support
- Knowledge base integration

### 9. Testing & QA
**Selected**: Jest  
- Easy TypeScript setup  
- Well-maintained and popular in the React ecosystem
- Includes React Testing Library integration

---

## Additional Infrastructure

### 1. Caching
**Selected**: ~~Redis~~ → Local Storage + Supabase
- Browser's localStorage/sessionStorage for client
- Supabase caching capabilities
- No additional infrastructure needed

### 2. Job Queue
**Selected**: ~~Bull~~ → PostgreSQL-based queue
- Use Supabase PostgreSQL LISTEN/NOTIFY
- Scheduled jobs via database
- No additional infrastructure needed

### 3. Search
**Selected**: PostgreSQL Full-Text Search (via Supabase)
- Built into Supabase
- No additional infrastructure needed
- Good enough for initial implementation

---

The stack provides a robust foundation while maintaining simplicity in testing and monitoring. Jest is indeed capable of handling our testing needs because:

1. **Comprehensive Coverage**: Jest can handle unit, integration, and component testing
2. **React Integration**: Excellent support for React testing
3. **TypeScript Support**: Native TypeScript support with ts-jest
4. **Performance**: Fast parallel test execution
5. **Mocking**: Powerful mocking capabilities for APIs and modules
6. **CI Integration**: Easy integration with GitHub Actions
7. **Coverage Reports**: Built-in coverage reporting

This overview represents the final technology choices for the AutoCRM project. These selections prioritize ecosystem compatibility, particularly around Supabase as the core backend service. 