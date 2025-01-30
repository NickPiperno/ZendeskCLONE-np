# AI Chat Component Test Learnings

This document captures key learnings and best practices discovered while implementing and fixing tests for the AIChat component.

## Component Test Coverage

The AIChat component has comprehensive test coverage for:

1. Rendering behavior
   - ✅ Button rendering for agent users
   - ✅ Non-rendering for non-agent users
   - ✅ Chat window opening behavior
   - ✅ Empty state display

2. Message handling
   - ✅ Message submission
   - ✅ Loading state display
   - ✅ Markdown formatting
   - ✅ Error handling (network and timeout)

## Key Findings and Solutions

### 1. Button Accessibility Testing

**Issue**: Tests were failing because they were looking for a button with an empty name attribute.

**Solution**:
```typescript
// Updated button query to use correct accessibility name
const submitButton = screen.getByRole('button', { name: 'Send' });
```

**Best Practice**: 
- Always provide meaningful names for interactive elements
- Use consistent button labels across components and tests
- Test accessibility attributes as users would perceive them

### 2. Loading Indicator Implementation

**Issue**: Loading state wasn't properly accessible to screen readers.

**Solution**:
```typescript
// Added proper role and aria attributes to loading indicator
<div role="status" aria-live="polite">
  Loading...
</div>
```

**Best Practice**: 
- Use appropriate ARIA roles for dynamic content
- Make loading states accessible to screen readers
- Test loading indicators with proper roles

### 3. Markdown Component Mocking

**Issue**: Multiple elements with duplicate roles were being created in the react-markdown mock.

**Solution**:
```typescript
// Implemented list item grouping logic
let listItems = [];
for (const line of lines) {
  if (line.startsWith('- ')) {
    listItems.push(React.createElement('li', { key: `li-${i}` }, line.slice(2)));
  } else if (listItems.length > 0) {
    elements.push(React.createElement('ul', { key: `list-${i}`, role: 'list' }, listItems));
    listItems = [];
  }
}
```

**Best Practice**: 
- Group related elements before rendering
- Maintain proper hierarchy in mock components
- Use unique keys for list items

### 4. Markdown Heading Accessibility

**Issue**: Markdown headings weren't properly accessible and lacked correct ARIA roles.

**Solution**:
```typescript
// Added proper heading roles and aria-level attributes
React.createElement('h1', { 
  role: 'heading', 
  'aria-level': 1 
}, content);
```

**Best Practice**: 
- Ensure proper heading hierarchy
- Include appropriate ARIA roles and levels
- Test heading accessibility with screen readers

### 5. Error Message Testing

**Issue**: Tests were failing due to mismatched error message text.

**Solution**:
```typescript
// Keep error messages consistent between tests and implementation
if (error.message === 'Request timeout') {
  errorMessage = 'Request timeout'; // Exact match with test expectation
}
```

**Best Practice**:
- Use exact message matching in tests
- Define error messages as constants if used in multiple places
- Keep error messages simple and consistent

### 6. Asynchronous State Management

**Issue**: Tests were failing because they checked for error messages before loading states completed.

**Solution**:
```typescript
// Wait for loading state to disappear before checking error message
await waitFor(() => {
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

await waitFor(() => {
  expect(screen.getByText(/Request timeout/)).toBeInTheDocument();
});
```

**Best Practice**:
- Always wait for loading states to resolve
- Use `waitFor` to handle asynchronous state changes
- Check intermediate states when necessary

### 7. Mock Timing Optimization

**Issue**: Long timeouts in mocks made tests slow.

**Solution**:
```typescript
// Reduced timeout duration in mocks
export const mockTimeoutError = (): Promise<ChatResponse> => 
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timeout')), 100)
  );
```

**Best Practice**:
- Keep mock timeouts short but realistic
- Balance between test speed and reliability
- Consider using Jest's timer mocks for complex timing scenarios

### 8. Enhanced Markdown Rendering Implementation

**Issue**: Complex markdown elements required proper structure and styling while maintaining accessibility.

**Solution**:
```typescript
// Structured approach to markdown element handling
const processMarkdownElements = (content: string) => {
  // Handle nested structures
  const processNestedLists = (items: string[], level: number = 0) => {
    return React.createElement('ul', { 
      role: 'list',
      className: `ml-${level * 4}` // Progressive indentation
    }, items.map(item => /* ... */));
  };

  // Table structure with proper semantics
  const createTable = (rows: string[][]) => {
    const [headerRow, ...bodyRows] = rows;
    return React.createElement('table', {
      role: 'table',
      className: 'min-w-full border-collapse border'
    }, [
      React.createElement('thead', { key: 'thead' }, /* header cells */),
      React.createElement('tbody', { key: 'tbody' }, /* body cells */)
    ]);
  };

  // Blockquote with styling
  const createBlockquote = (content: string) => {
    return React.createElement('blockquote', {
      className: 'pl-4 border-l-4 border-gray-300 italic'
    }, content);
  };
};
```

**Best Practices**: 
- Structure and Hierarchy:
  - Maintain proper nesting for lists and other hierarchical elements
  - Use semantic HTML elements (thead, tbody for tables)
  - Implement progressive indentation for nested elements

- Accessibility:
  - Add appropriate ARIA roles for complex structures
  - Ensure proper heading hierarchy
  - Maintain keyboard navigation for interactive elements

- Styling:
  - Apply consistent spacing and indentation
  - Use border and background colors for visual separation
  - Implement hover states for interactive elements
  - Keep styling consistent with the overall theme

- Testing Considerations:
  - Test nested structures at various levels
  - Verify table structure and cell alignment
  - Check inline element combinations
  - Validate accessibility for all markdown elements

**Key Learnings**:
1. Element Structure:
   - Proper nesting requires tracking of hierarchy levels
   - Tables need explicit thead and tbody for correct semantics
   - Blockquotes should maintain formatting within their content

2. Style Implementation:
   - Use Tailwind classes consistently
   - Implement progressive spacing for nested elements
   - Apply borders and backgrounds for visual hierarchy
   - Add hover effects for better UX

3. Testing Strategy:
   - Test each markdown element type independently
   - Verify combinations of inline elements
   - Check nested structure rendering
   - Validate accessibility roles and attributes
   - Test responsive behavior of tables

## Testing Guidelines

1. **Component Isolation**
   - Mock external dependencies (auth, API calls)
   - Use builder patterns for test data
   - Keep tests focused on single behaviors

2. **Async Testing**
   - Always handle loading states
   - Use `waitFor` for async operations
   - Check intermediate states when relevant

3. **Error Handling**
   - Test both success and error paths
   - Use consistent error messages
   - Verify error state UI elements

4. **Accessibility**
   - Test ARIA roles and labels
   - Verify keyboard navigation
   - Check screen reader compatibility

## Future Considerations

1. **Performance Testing**
   - Add tests for message list performance with many messages
   - Consider testing scroll behavior
   - Monitor render performance

2. **Edge Cases**
   - Test message retry scenarios
   - Test concurrent message handling
   - Test offline behavior

3. **Integration Testing**
   - Add tests for chat service integration
   - Test WebSocket connection handling
   - Test message persistence 