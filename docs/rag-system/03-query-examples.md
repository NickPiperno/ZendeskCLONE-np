# Query Types & Examples

## Available Query Types

### 1. Priority-Based Queries
- High priority issues
- Urgent tickets
- Priority-specific filtering

### 2. Status-Based Queries
- Open issues
- In-progress tickets
- Resolved tickets
- Closed tickets

### 3. Feature-Based Queries
- Feature requests
- Enhancement proposals
- UI/UX improvements

### 4. Technical Queries
- Security issues
- Performance problems
- Integration challenges
- API-related tickets

### 5. Team-Based Queries
- Team member skills
- Team assignments
- Team availability

## Query Examples

### Priority Queries

**Query**: "What high priority issues need attention?"
```typescript
// Filter configuration
{
  document_type: 'ticket',
  priority: 'high'
}

// Example Response
{
  relevantDocuments: [
    {
      content: "System becomes very slow with datasets larger than 1GB",
      metadata: {
        priority: "high",
        status: "open",
        tags: ["performance", "technical", "optimization"]
      }
    },
    {
      content: "Unable to access main dashboard after login",
      metadata: {
        priority: "high",
        status: "open",
        tags: ["bug", "ui", "access"]
      }
    }
  ],
  contextCoverage: "75%"
}
```

### Feature Requests

**Query**: "What feature requests do we have for the dashboard?"
```typescript
// Filter configuration
{
  document_type: 'ticket',
  tags: ['feature', 'enhancement']
}

// Example Response
{
  relevantDocuments: [
    {
      content: "Dark mode option for better visibility",
      metadata: {
        priority: "low",
        status: "open",
        tags: ["feature", "ui", "enhancement"]
      }
    }
  ],
  contextCoverage: "100%"
}
```

### Team Queries

**Query**: "Who are the technical support team members and what are their skills?"
```typescript
// Filter configuration
{
  document_type: 'team',
  name: 'Technical Support Team'
}

// Example Response
{
  relevantDocuments: [
    {
      content: "Technical Support Team handles technical issues",
      metadata: {
        member_count: 2,
        skills: [
          "Bug Reporting",
          "Technical Troubleshooting",
          "Integration Support"
        ]
      }
    }
  ],
  contextCoverage: "100%"
}
```

## Filter Combinations

### Complex Query Example

**Query**: "Show me all high-priority security issues assigned to the technical team"
```typescript
// Filter configuration
{
  document_type: 'ticket',
  priority: 'high',
  tags: ['security'],
  assignedTeam: 'Technical Support Team'
}

// Example Response
{
  relevantDocuments: [
    {
      content: "Security vulnerability in API authentication",
      metadata: {
        priority: "high",
        status: "open",
        tags: ["security", "api", "urgent"],
        assigned_team: "Technical Support Team"
      }
    }
  ],
  contextCoverage: "85%"
}
```

## Response Format

### Standard Response Structure
```typescript
interface QueryResponse {
  relevantDocuments: Array<{
    content: string
    metadata: {
      tags: string[]
      status: string
      priority: string
      [key: string]: any
    }
  }>
  contextCoverage: string
  suggestedActions?: string[]
  relatedQueries?: string[]
}
```

### Metadata Fields
```typescript
interface DocumentMetadata {
  // Common fields
  document_type: 'ticket' | 'kb_article' | 'team'
  created_at: string
  updated_at: string
  
  // Ticket-specific fields
  status?: TicketStatus
  priority?: TicketPriority
  tags?: string[]
  assigned_to?: string
  
  // Team-specific fields
  member_count?: number
  skills?: string[]
  
  // KB article fields
  category?: string
  last_reviewed?: string
}
``` 