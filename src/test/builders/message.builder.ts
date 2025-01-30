import { ChatMessage } from '@/modules/ai/types/chat.types';

export const createChatMessage = (overrides?: Partial<ChatMessage>): ChatMessage => ({
  id: 'msg_' + Math.random().toString(36).substr(2, 9),
  content: 'Test message content',
  role: 'user',
  timestamp: new Date().toISOString(),
  ...overrides
});

export const createSystemMessage = (content: string): ChatMessage => 
  createChatMessage({ role: 'system', content });

export const createUserMessage = (content: string): ChatMessage => 
  createChatMessage({ role: 'user', content });

export const createAssistantMessage = (content: string): ChatMessage => 
  createChatMessage({ role: 'assistant', content });

export const createMarkdownResponse = (): ChatMessage => 
  createAssistantMessage(`# Heading 1
## Heading 2

This is *italic* and this is **bold** text.

> This is a blockquote
> With multiple lines
> And some *formatting*

Here's a list:
- Item 1
- Item 2
  - Nested item 2.1
  - Nested item 2.2
    - Deeply nested 2.2.1
- Item 3

Here's a table:
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

Here's some \`inline code\` and a code block:

\`\`\`typescript
const hello = (name: string) => {
  console.log(\`Hello, \${name}!\`);
};
\`\`\`

And finally a [link](https://example.com)`
);

export const createLoadingMessage = (): ChatMessage => 
  createChatMessage({ 
    id: 'loading',
    role: 'assistant',
    content: '',
    isLoading: true 
  });

export const createErrorMessage = (error: string): ChatMessage => 
  createChatMessage({ 
    role: 'system',
    content: error,
    error: true
  }); 