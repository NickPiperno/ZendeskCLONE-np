import { z } from 'zod';
import { EntityRecognitionOutput } from './entity-recognition-agent';
import { ChatModel } from '../types';

// Define available agents
const AgentTypes = z.enum([
  'TeamAgent',
  'TicketAgent',
  'ArticleAgent'
]);

type AgentType = z.infer<typeof AgentTypes>;

// Define operation types for each agent
const TeamOperations = z.enum([
  'team_creation',
  'team_update',
  'member_add',
  'member_remove',
  'verify_user_skills'
]);

const TicketOperations = z.enum([
  'reassign_tickets',
  'update_status',
  'update_priority',
  'verify_ticket_skills'
]);

const ArticleOperations = z.enum([
  'article_creation',
  'article_update',
  'article_publish',
  'article_archive'
]);

// Define parameter schemas
const TeamParameters = z.object({
  teamName: z.string().optional(),
  teamId: z.string().uuid().optional(),
  skillRequirement: z.string().optional(),
  membershipCriteria: z.enum(['skill_match', 'role_match', 'manual']).optional(),
  isActive: z.boolean().optional()
});

const TicketParameters = z.object({
  assigneeId: z.string().uuid().optional(),
  ticketCriteria: z.object({
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
    category: z.string().optional(),
    skillRequired: z.string().optional()
  }).optional(),
  requireSkillVerification: z.boolean().optional()
});

const ArticleParameters = z.object({
  title: z.string().optional(),
  category: z.enum(['technical', 'product', 'how_to', 'troubleshooting']).optional(),
  isNew: z.boolean().optional(),
  isPublished: z.boolean().optional()
});

// Define routing output schemas
const SingleAgentRoute = z.object({
  targetAgent: AgentTypes,
  operation: z.union([TeamOperations, TicketOperations, ArticleOperations]),
  parameters: z.union([TeamParameters, TicketParameters, ArticleParameters]),
  entities: z.any(), // Original entity recognition output
  context: z.any() // Original RAG context
});

const MultiAgentRoute = z.object({
  primaryAgent: AgentTypes,
  supportingAgent: AgentTypes,
  operation: z.union([TeamOperations, TicketOperations, ArticleOperations]),
  parameters: z.union([TeamParameters, TicketParameters, ArticleParameters]),
  supportingOperation: z.union([TeamOperations, TicketOperations, ArticleOperations]).optional(),
  supportingParameters: z.union([TeamParameters, TicketParameters, ArticleParameters]).optional(),
  entities: z.any(),
  context: z.any()
});

const TaskRouteOutput = z.union([SingleAgentRoute, MultiAgentRoute]);

type TaskRoute = z.infer<typeof TaskRouteOutput>;

const PROMPT_TEMPLATE = `You are a task routing agent that analyzes entity-tagged requests and routes them to the appropriate agent(s).

Available Agents:
- TeamAgent: Handles team operations, member management, and user skill verification
- TicketAgent: Handles ticket assignments, updates, and ticket operations
- ArticleAgent: Handles knowledge base article operations

Some operations require multiple agents to coordinate. For example:
- When reassigning tickets that require specific skills, the TicketAgent needs TeamAgent to verify the assignee's skills
- When creating teams with skill requirements, the TeamAgent needs to verify each member's skills

Input: {input}
Context: {context}

Examples:

Input: {
  "entities": {
    "team": [{
      "name": "Enterprise Support",
      "isNew": true,
      "confidence": 0.98
    }],
    "skill": [{
      "name": "french_language",
      "category": "language",
      "confidence": 0.95
    }]
  }
}
Output: {
  "targetAgent": "TeamAgent",
  "operation": "team_creation",
  "parameters": {
    "teamName": "Enterprise Support",
    "skillRequirement": "french_language",
    "membershipCriteria": "skill_match",
    "isActive": true
  },
  "entities": {input.entities},
  "context": {context}
}

Input: {
  "entities": {
    "profile": [{
      "id": "sarah_uuid",
      "full_name": "Sarah",
      "confidence": 0.95
    }],
    "ticket": [{
      "filter": {
        "priority": "high",
        "subject_matter": {
          "type": "printer",
          "keywords": ["printer"]
        }
      },
      "confidence": 0.98
    }],
    "skill": [{
      "name": "printer_specialist",
      "confidence": 0.9
    }]
  }
}
Output: {
  "primaryAgent": "TicketAgent",
  "supportingAgent": "TeamAgent",
  "operation": "reassign_tickets",
  "parameters": {
    "assigneeId": "sarah_uuid",
    "ticketCriteria": {
      "priority": "high",
      "category": "printer",
      "skillRequired": "printer_specialist"
    },
    "requireSkillVerification": true
  },
  "supportingOperation": "verify_user_skills",
  "supportingParameters": {
    "userId": "sarah_uuid",
    "skillRequirement": "printer_specialist"
  },
  "entities": {input.entities},
  "context": {context}
}

Analyze the input and context, then provide a structured routing decision that matches the schema:`;

export class TaskRouter {
  name = "Task Router";
  description = "Routes entity-tagged requests to appropriate agents";

  constructor(
    private llm: ChatModel
  ) {}

  async route(input: { entities: EntityRecognitionOutput, context: any }): Promise<TaskRoute> {
    try {
      console.group('🔄 Task Router');
      console.log('Input:', input);

      const prompt = PROMPT_TEMPLATE
        .replace('{input}', JSON.stringify(input.entities))
        .replace('{context}', JSON.stringify(input.context));

      const response = await this.llm.invoke(prompt);
      
      if (!response || typeof response.content !== 'string') {
        throw new Error('Invalid LLM response format');
      }

      // Parse and validate the response
      const result = JSON.parse(response.content);
      const validated = TaskRouteOutput.parse(result);

      console.log('Routing Decision:', validated);
      console.groupEnd();
      return validated;
    } catch (error) {
      console.error('Task routing failed:', error);
      console.groupEnd();
      throw error;
    }
  }
} 