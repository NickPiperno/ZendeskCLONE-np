Previous Attempts Review
1. First Try (Operation Chain):
   ❌ Failed because:
   - Lost method chaining
   - Operations were executed in wrong order
   - No proper table mapping

2. Second Try (Proxy-based):
   ❌ Failed because:
   - TypeScript complexity with Proxy
   - Lost type safety
   - Hard to maintain state

3. Third Try (State-based):
   ❌ Failed because:
   - Mixed array operations with item filters
   - Didn't handle single() correctly
   - RPC mocks weren't consistent

## Key Learnings
1. State Management:
   - Keeping state is good, but we need clear separation of concerns
   - Array operations vs item filters need different handling
   - Table mapping should be type-safe

2. Method Chaining:
   - Methods must return consistent types
   - Single() needs special handling
   - Join operations need proper type merging

3. RPC Handling:
   - Mock data structure must match real DB exactly
   - Need proper error handling
   - User authentication checks were inconsistent