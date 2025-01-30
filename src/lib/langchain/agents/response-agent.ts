import { BaseAgent } from './types';
import { ChatModel } from '../types';
import { z } from 'zod';

// Define response data types
interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
}

interface Article {
  id: string;
  title: string;
  content: string;
}

interface Team {
  id: string;
  name: string;
  description: string;
  members: string[];
}

type ResponseData = Ticket | Article | Team | Ticket[] | Article[] | Team[];

// Define response request schema
const responseRequestSchema = z.object({
  domain: z.enum(['kb', 'ticket', 'team']),
  operation: z.string(),
  result: z.object({
    data: z.any(),
    changes: z.array(z.any()).optional(),
    error: z.any().optional(),
    message: z.string().optional()
  }),
  auditRecord: z.object({
    id: z.string(),
    created_at: z.string(),
    action_type: z.string(),
    table_name: z.string(),
    record_id: z.string().optional(),
    old_data: z.any().optional(),
    new_data: z.any().optional()
  }).optional(),
  context: z.any().optional()
});

type ResponseRequest = z.infer<typeof responseRequestSchema>;

// Define template structure type
type ResponseTemplate = {
  success: string;
  suggestion: string;
};

type DomainOperations = {
  kb: {
    kb_search: ResponseTemplate;
    kb_create: ResponseTemplate;
    kb_update: ResponseTemplate;
  };
  ticket: {
    ticket_search: ResponseTemplate;
    ticket_create: ResponseTemplate;
    ticket_update: ResponseTemplate;
  };
  team: {
    team_search: ResponseTemplate;
    team_assign: ResponseTemplate;
    team_skill_search: ResponseTemplate;
  };
};

// Response templates for different scenarios
const RESPONSE_TEMPLATES: DomainOperations = {
  kb: {
    kb_search: {
      success: 'Here is the article "{data.title}". {data.content}',
      suggestion: 'You might also be interested in these related articles: {context.kbArticles.map(a => a.title).join(", ")}'
    },
    kb_create: {
      success: 'Article "{data.title}" has been created successfully.',
      suggestion: 'Would you like to add this article to any categories or tag it for better searchability?'
    },
    kb_update: {
      success: 'Article "{data.title}" has been updated.',
      suggestion: 'Consider reviewing related articles to ensure consistency.'
    }
  },
  ticket: {
    ticket_search: {
      success: 'Ticket #{data.id} - {data.title}\nStatus: {data.status}\nPriority: {data.priority}',
      suggestion: 'Similar tickets that might be relevant: {context.similarTickets.map(t => `#${t.id}`).join(", ")}'
    },
    ticket_create: {
      success: 'New ticket #{data.id} has been created with {data.priority} priority.',
      suggestion: 'Would you like to assign this ticket to a team member or add more details?'
    },
    ticket_update: {
      success: 'Ticket #{data.id} {data.skill ? `has been updated with ${data.skill} skill (proficiency ${data.proficiency})` : `has been updated to ${data.status}`}',
      suggestion: 'Previous solutions that worked: {context.previousSolutions.map(s => s.title).join(", ")}'
    }
  },
  team: {
    team_search: {
      success: 'Team {data.name}\nMembers: {data.members.join(", ")}',
      suggestion: 'You can view team capacity and current assignments for more details.'
    },
    team_assign: {
      success: '{data.member} has been assigned to team {data.name}.',
      suggestion: 'Would you like to set up any onboarding tasks or notifications?'
    },
    team_skill_search: {
      success: 'Found {data.length} team members with required skills.',
      suggestion: 'Consider team workload and availability when making assignments.'
    }
  }
} as const;

// Error message templates
const ERROR_TEMPLATES = {
  not_found: 'The requested {entity} could not be found.',
  permission_denied: 'You do not have permission to {action}.',
  validation_failed: 'The operation failed due to invalid data: {details}',
  update_conflict: 'Another user has modified this {entity}. Please refresh and try again.',
  skill_mismatch: 'Required skill {skill} not found in available team members.',
  capacity_exceeded: 'Team {team} has reached maximum capacity.',
  unknown_error: 'An unexpected error occurred. Please try again or contact support.'
} as const;

export class ResponseAgent implements BaseAgent {
  name = "Response Agent";
  description = "Formats responses with context and suggestions";
  
  constructor(
    private llm: ChatModel
  ) {}

  async process(input: string | ResponseRequest): Promise<string> {
    try {
      // Parse and validate input
      const request = typeof input === 'string' 
        ? JSON.parse(input) as ResponseRequest 
        : input;
      const validatedRequest = responseRequestSchema.parse(request);
      
      if (validatedRequest.result.error) {
        return `Error: ${validatedRequest.result.error.message || 'Unknown error'}`;
      }

      const { domain, operation, result, context, auditRecord } = validatedRequest;

      // If there's a message in the result and no changes, use that message directly
      if (result.message && (!result.changes || result.changes.length === 0)) {
        return result.message;
      }
      
      // Get response template with proper type inference
      const domainTemplates = RESPONSE_TEMPLATES[domain as keyof DomainOperations];
      if (!domainTemplates) {
        return this.formatGenericResponse(result, domain, operation);
      }

      const template = domainTemplates[operation as keyof typeof domainTemplates] as ResponseTemplate | undefined;
      if (!template) {
        return this.formatGenericResponse(result, domain, operation);
      }

      // Format main response
      const response = this.formatTemplate(template.success, {
        data: result.data,
        context,
        audit: auditRecord
      });

      // Add suggestion if available
      const suggestion = context && template.suggestion ? 
        '\n\n' + this.formatTemplate(template.suggestion, { data: result.data, context }) : '';

      // Add change summary if available
      const changes = auditRecord?.old_data && auditRecord?.new_data ? 
        '\n\nChanges made:\n' + this.formatChanges(auditRecord.old_data, auditRecord.new_data) : '';

      return response + changes + suggestion;
    } catch (error) {
      console.error('Response generation failed:', error);
      throw error;
    }
  }

  private formatTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/{([^}]+)}/g, (_: string, path: string) => {
      const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], data);
      return value?.toString() ?? '';
    });
  }

  private formatGenericResponse(result: any, domain: string, operation: string): string {
    if (Array.isArray(result.data)) {
      const items = result.data.map((item: any) => 
        `- ${item.id || ''}: ${item.title || item.name || JSON.stringify(item)}`
      ).join('\n');
      return `Found ${result.data.length} ${domain} items:\n${items}`;
    }
    return `${operation} operation completed successfully for ${domain}.`;
  }

  private formatChanges(oldData: any, newData: any): string {
    const changes: string[] = [];
    Object.keys(newData).forEach(key => {
      if (oldData[key] !== newData[key]) {
        changes.push(`- ${key}: ${oldData[key]} → ${newData[key]}`);
      }
    });
    return changes.join('\n');
  }
} 
