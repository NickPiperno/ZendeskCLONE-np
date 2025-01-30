import { BaseAgent, ChatModel, RAGContext } from '../types';
import { z } from 'zod';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';

// Define supported domains and their corresponding agents
const domainAgentMap = {
  kb: 'KBAgent',
  ticket: 'TicketAgent',
  team: 'TeamAgent'
} as const;

// Define standardized operations
const operations = {
  kb: ['kb_search', 'kb_create', 'kb_update'] as const,
  ticket: ['ticket_search', 'ticket_create', 'ticket_update'] as const,
  team: ['team_search', 'team_assign', 'team_skill_search', 'team_skill_update'] as const
} as const;

// Define operation mappings for backward compatibility
const operationMappings = {
  kb: {
    kb_search: 'view_article',
    kb_create: 'create_article',
    kb_update: 'update_article'
  },
  ticket: {
    ticket_search: 'view_ticket',
    ticket_create: 'create_ticket',
    ticket_update: 'update_status'
  },
  team: {
    team_search: 'view_team',
    team_assign: 'assign_member',
    team_skill_search: 'find_by_skill',
    team_skill_update: 'update_member_skills'
  }
} as const;

type Domain = keyof typeof domainAgentMap;
type Operation = typeof operations[Domain][number];

// Add reference types for all domains
interface TicketReference {
  id?: string;          // UUID format
  reference?: string;   // TK-123 format
  title?: string;       // Human readable title
  status?: string;     // Ticket status
}

interface KBReference {
  id?: string;          // UUID format
  reference?: string;   // KB-123 format
  title?: string;       // Article title
  category?: string;    // Article category
}

interface TeamMemberReference {
  id?: string;          // UUID format
  reference?: string;   // TM-123 format
  name?: string;        // Member name
  role?: string;        // Member role
  skills?: string[];    // Member skills
  isTeamLead?: boolean; // Team lead flag
}

interface TeamReference {
  id?: string;          // UUID format
  reference?: string;   // TM-123 format
  name?: string;        // Team name
  members?: TeamMemberReference[];  // Team members
  requiredSkills?: string[];       // Required skills for the team
}

// Update routing schema to be more specific about ticket parameters
const routingResultSchema = z.object({
  targetAgent: z.enum(['KBAgent', 'TicketAgent', 'TeamAgent']),
  domain: z.enum(['kb', 'ticket', 'team']),
  operation: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1),
  parameters: z.object({
    ticketId: z.string().uuid().optional(),      // Only UUID format
    ticketReference: z.string().optional(),      // TK-123 format
    ticketTitle: z.string().optional(),          // Human readable title
    status: z.string().optional(),
    priority: z.string().optional(),
    internalOperation: z.string().optional(),
    teamId: z.string().uuid().optional(),
    teamReference: z.string().optional(),
    teamName: z.string().optional(),
    memberId: z.string().uuid().optional(),
    memberReference: z.string().optional(),
    memberName: z.string().optional(),
    memberSkills: z.array(z.string()).optional(),
    requiredSkills: z.array(z.string()).optional(),
    isTeamLead: z.boolean().optional()
  }).catchall(z.any()),
  entities: z.array(z.object({
    type: z.string(),
    value: z.string(),
    confidence: z.number(),
    metadata: z.record(z.any()).optional()
  })),
  context: z.any().optional()
});

export type RoutingResult = z.infer<typeof routingResultSchema>;

// Update TaskInput interface to include metadata
interface TaskInput {
  query: string;
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
    metadata?: Record<string, any>;
  }>;
  context?: RAGContext;
}

const routerPrompt = new PromptTemplate({
  template: `You are a task routing agent for a CRM system. Analyze the user input and extracted entities to determine the appropriate domain, operation, and priority.

Available Domains and Operations:
{operations}

User Query: {query}
Extracted Entities: {entities}

Instructions:
1. Determine the most appropriate domain and operation
2. Assess priority based on:
   - Explicit priority mentions in the query
   - Urgency words ("urgent", "asap", "immediately")
   - Type of operation (create/update usually higher priority than search)
3. Map entities to operation parameters, being careful to distinguish between:
   - Ticket titles and IDs (e.g., "Backup Strategy Review" vs "TK-123" vs UUID)
   - Team names (e.g., "Frontend Team", "DevOps Team")
   - Team member names (e.g., "John Smith", "Sarah Johnson")
   - Team member skills (e.g., "JavaScript", "Python")
   - Required team skills (e.g., "needs JavaScript expert")
   - Skill updates (e.g., "add TypeScript to John's skills")
4. For ticket status updates:
   - Always identify the target status clearly
   - Valid statuses are: "open", "in_progress", "resolved", "closed"
   - For phrases like "change from X to Y", use Y as the target status
   - Convert "in progress" to "in_progress" automatically
5. Provide confidence score for the routing decision

Your response must be a valid JSON object with these fields:
- targetAgent: The agent to handle the request (KBAgent, TicketAgent, or TeamAgent)
- domain: The domain (kb, ticket, or team)
- operation: The standardized operation name
- priority: Priority level (low, medium, high)
- confidence: A number between 0 and 1
- parameters: An object containing operation parameters

Example responses:

For ticket status update: "Change Backup Strategy Review ticket from open to in progress"
{{
  "targetAgent": "TicketAgent",
  "domain": "ticket",
  "operation": "ticket_update",
  "priority": "medium",
  "confidence": 0.95,
  "parameters": {{
    "ticketTitle": "Backup Strategy Review",
    "status": "in_progress",
    "internalOperation": "update_status"
  }}
}}

For ticket status update: "Set the Database Migration ticket to in progress"
{{
  "targetAgent": "TicketAgent",
  "domain": "ticket",
  "operation": "ticket_update",
  "priority": "medium",
  "confidence": 0.95,
  "parameters": {{
    "ticketTitle": "Database Migration",
    "status": "in_progress",
    "internalOperation": "update_status"
  }}
}}

For team search: "Find JavaScript developers in the Frontend team"
{{
  "targetAgent": "TeamAgent",
  "domain": "team",
  "operation": "team_skill_search",
  "priority": "medium",
  "confidence": 0.95,
  "parameters": {{
    "teamName": "Frontend",
    "requiredSkills": ["JavaScript"]
  }}
}}

For team assignment: "Add Sarah to the Backend team as lead developer"
{{
  "targetAgent": "TeamAgent",
  "domain": "team",
  "operation": "team_assign",
  "priority": "high",
  "confidence": 0.95,
  "parameters": {{
    "teamName": "Backend",
    "memberName": "Sarah",
    "memberRole": "lead developer",
    "isTeamLead": true
  }}
}}

For skill update: "Add TypeScript and React to John's skills"
{{
  "targetAgent": "TeamAgent",
  "domain": "team",
  "operation": "team_skill_update",
  "priority": "medium",
  "confidence": 0.95,
  "parameters": {{
    "memberName": "John",
    "memberSkills": ["TypeScript", "React"],
    "updateType": "add"
  }}
}}`,
  inputVariables: ["query", "entities", "operations"]
});

export class TaskRouterAgent implements BaseAgent {
  name = "Task Router Agent";
  description = "Routes tasks to appropriate domain agents";
  
  private confidenceThreshold = 0.7;
  private parser: JsonOutputParser;

  constructor(
    private llm: ChatModel
  ) {
    this.parser = new JsonOutputParser();
  }

  async routeTask(input: TaskInput): Promise<RoutingResult> {
    try {
      console.group('🚦 Task Router Agent');
      console.log('Input:', {
        query: input.query,
        entities: input.entities,
        context: input.context
      });

      // Ensure input has required properties with defaults
      const normalizedInput = {
        query: input.query || '',
        entities: Array.isArray(input.entities) ? input.entities : [],
        context: input.context
      };

      // Extract entities into a more usable format
      const entityMap = this.extractEntities(normalizedInput.entities);
      console.log('Extracted Entity Map:', entityMap);
      
      // Format the prompt with input
      const formattedPrompt = await routerPrompt.format({
        query: normalizedInput.query,
        entities: JSON.stringify(normalizedInput.entities, null, 2),
        operations: JSON.stringify(operations, null, 2)
      });

      // Get LLM response
      const response = await this.llm.invoke(formattedPrompt);
      console.log('LLM Response:', response.content);
      
      // Parse response content
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      const parsedJson = await this.parser.invoke(content);
      console.log('Parsed Response:', parsedJson);
      
      // Validate routing result
      const validatedResult = routingResultSchema.parse({
        ...parsedJson,
        entities: normalizedInput.entities,
        context: normalizedInput.context
      });

      // Check confidence threshold
      if (validatedResult.confidence < this.confidenceThreshold) {
        console.warn(`Low confidence (${validatedResult.confidence}) in task routing`);
        throw new Error(`Low confidence (${validatedResult.confidence}) in task routing`);
      }

      // Map standardized operation to internal operation name if needed
      if (validatedResult.domain in operationMappings) {
        const domainMappings = operationMappings[validatedResult.domain as Domain];
        const mappedOperation = domainMappings[validatedResult.operation as keyof typeof domainMappings];
        if (mappedOperation) {
          validatedResult.parameters.internalOperation = mappedOperation;
          console.log('Mapped Operation:', {
            from: validatedResult.operation,
            to: mappedOperation
          });
        }
      }

      console.log('Final Routing Result:', validatedResult);
      console.groupEnd();
      return validatedResult;
    } catch (error) {
      console.error('Task routing failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  private extractEntities(entities: TaskInput['entities']): Record<string, any> {
    const entityMap: Record<string, any> = {
      ticket: {
        id: undefined,
        reference: undefined,
        title: undefined,
        status: undefined
      } as TicketReference,
      kb: {} as KBReference,
      team: {
        name: undefined,
        requiredSkills: []
      } as TeamReference,
      teamMember: {
        name: undefined,
        skills: [],
        role: undefined
      } as TeamMemberReference
    };
    
    if (!Array.isArray(entities)) {
      console.warn('Entities is not an array, returning empty map');
      return entityMap;
    }
    
    for (const entity of entities) {
      if (!entity?.type || !entity?.value) {
        continue;
      }

      const type = entity.type.toLowerCase();
      const value = entity.value;
      const format = entity.metadata?.format;
      const subType = entity.metadata?.subType;

      switch (type) {
        case 'ticket_id':
        case 'ticketid':
        case 'ticket':
          if (format === 'uuid') {
            entityMap.ticket.id = value;
          } else if (format === 'reference') {
            entityMap.ticket.reference = value;
          } else {
            // If no specific format, treat as title
            entityMap.ticket.title = value;
          }
          break;

        case 'ticket_title':
          entityMap.ticket.title = value;
          break;

        case 'status':
          // Normalize status value
          let normalizedStatus = value.toLowerCase().replace(/\s+/g, '_');
          // Handle special case for "in progress"
          if (normalizedStatus === 'in_progress' || normalizedStatus === 'in progress') {
            normalizedStatus = 'in_progress';
          }
          entityMap.ticket.status = normalizedStatus;
          break;

        // KB article entities
        case 'article_id':
        case 'articleid':
        case 'article':
          if (format === 'uuid') {
            entityMap.kb.id = value;
          } else if (format === 'reference') {
            entityMap.kb.reference = value;
          } else if (format === 'title') {
            entityMap.kb.title = value;
          }
          break;

        case 'article_category':
          entityMap.kb.category = value;
          break;

        // Team entities with subType handling
        case 'team':
          if (subType === 'name') {
            entityMap.team.name = value;
          } else if (format === 'uuid') {
            entityMap.team.id = value;
          } else if (format === 'reference') {
            entityMap.team.reference = value;
          }
          break;

        // Team member entities with subType handling
        case 'member':
          if (subType === 'name') {
            entityMap.teamMember.name = value;
          } else if (format === 'uuid') {
            entityMap.teamMember.id = value;
          } else if (format === 'reference') {
            entityMap.teamMember.reference = value;
          }
          break;

        case 'role':
          entityMap.teamMember.role = value;
          break;

        case 'skill':
          if (subType === 'member') {
            if (!entityMap.teamMember.skills) {
              entityMap.teamMember.skills = [];
            }
            entityMap.teamMember.skills.push(value);
          } else if (subType === 'required') {
            if (!entityMap.team.requiredSkills) {
              entityMap.team.requiredSkills = [];
            }
            entityMap.team.requiredSkills.push(value);
          }
          break;

        case 'is_team_lead':
          entityMap.teamMember.isTeamLead = value.toLowerCase() === 'true';
          break;

        // Common entities
        case 'priority':
          entityMap.priority = value.toLowerCase();
          break;

        default:
          // Store unknown entities with their original type
          entityMap[type] = value;
      }
    }

    // Map ticket fields to parameters
    if (entityMap.ticket.id) entityMap.ticketId = entityMap.ticket.id;
    if (entityMap.ticket.reference) entityMap.ticketReference = entityMap.ticket.reference;
    if (entityMap.ticket.title) entityMap.ticketTitle = entityMap.ticket.title;
    if (entityMap.ticket.status) entityMap.status = entityMap.ticket.status;

    // Map to parameters with clear distinction between team and member
    if (entityMap.team.name || entityMap.team.id || entityMap.team.reference) {
      if (entityMap.team.name) entityMap.teamName = entityMap.team.name;
      if (entityMap.team.id) entityMap.teamId = entityMap.team.id;
      if (entityMap.team.reference) entityMap.teamReference = entityMap.team.reference;
      if (entityMap.team.requiredSkills?.length > 0) {
        entityMap.requiredSkills = entityMap.team.requiredSkills;
      }
    }

    if (entityMap.teamMember.name || entityMap.teamMember.id || entityMap.teamMember.reference) {
      if (entityMap.teamMember.name) entityMap.memberName = entityMap.teamMember.name;
      if (entityMap.teamMember.id) entityMap.memberId = entityMap.teamMember.id;
      if (entityMap.teamMember.reference) entityMap.memberReference = entityMap.teamMember.reference;
      if (entityMap.teamMember.role) entityMap.memberRole = entityMap.teamMember.role;
      if (entityMap.teamMember.skills?.length > 0) entityMap.memberSkills = entityMap.teamMember.skills;
      if (typeof entityMap.teamMember.isTeamLead === 'boolean') {
        entityMap.isTeamLead = entityMap.teamMember.isTeamLead;
      }
    }

    return entityMap;
  }

  // Implement the process method required by BaseAgent
  async process(input: string | Record<string, any>): Promise<string> {
    try {
      // If input is a string, treat it as a query with no entities
      const taskInput: TaskInput = typeof input === 'string' 
        ? { query: input, entities: [] }
        : input as TaskInput;

      const result = await this.routeTask(taskInput);
      return JSON.stringify(result);
    } catch (error) {
      console.error('Task routing failed:', error);
      throw error;
    }
  }
} 