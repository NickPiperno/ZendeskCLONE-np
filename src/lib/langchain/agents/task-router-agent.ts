import { BaseAgent, ChatModel, RAGContext } from '../types';
import { z } from 'zod';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { SystemMessage } from '@langchain/core/messages';

// Define supported domains and their corresponding agents
const domainAgentMap = {
  kb: 'KB_ACTION',
  ticket: 'TICKET_ACTION',
  team: 'TEAM_ACTION'
} as const;

// Define standardized operations
const operations = {
  kb: ['draft_article', 'update_article', 'search_articles'] as const,
  ticket: [
    'ticket_search', 
    'ticket_create',
    'ticket_update',
    'ticket_bulk_search',
    'ticket_bulk_update',
    'ticket_analytics',
    'ticket_reassign'
  ] as const,
  team: [
    'team_search',
    'team_assign',
    'team_skill_search',
    'team_skill_update',
    'team_schedule_update',
    'team_schedule_generate'
  ] as const
} as const;

// Define operation mappings for backward compatibility
const operationMappings = {
  kb: {
    kb_draft: 'draft_article',
    kb_update: 'update_article',
    kb_search: 'search_articles'
  },
  ticket: {
    ticket_search: 'ticket_search',
    ticket_create: 'ticket_create',
    ticket_update: 'ticket_update',
    ticket_bulk_search: 'ticket_bulk_search',
    ticket_bulk_update: 'ticket_bulk_update',
    ticket_analytics: 'ticket_analytics',
    ticket_reassign: 'ticket_reassign'
  },
  team: {
    team_search: 'team_search',
    team_assign: 'team_assign',
    team_skill_search: 'team_skill_search',
    team_skill_update: 'team_skill_update',
    team_schedule_update: 'team_schedule_update',
    team_schedule_generate: 'team_schedule_generate'
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
  requiredSkills: {
    id: string;
    name: string;
    category: string;
    proficiencyLevel: number;
  }[];
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

// Update routing schema to use new action types
const routingResultSchema = z.object({
  targetAgent: z.enum(['KB_ACTION', 'TICKET_ACTION', 'TEAM_ACTION']),
  domain: z.enum(['kb', 'ticket', 'team']),
  operation: z.string(),
  priority: z.enum(['low', 'medium', 'high']).optional(),  // Make priority optional
  confidence: z.number().min(0).max(1),
  parameters: z.object({
    ticketId: z.string().uuid().optional(),      // Only UUID format
    ticketReference: z.string().optional(),      // TK-123 format
    ticketTitle: z.string().optional(),          // Human readable title
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    assigned_to: z.string().uuid().optional(),   // Use assigned_to consistently
    updates: z.object({
      assigned_to: z.string().uuid().optional(), // Also in updates
      requiredSkills: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        category: z.string(),
        proficiency_level: z.number().min(1).max(5).optional()
      })).optional()
    }).optional(),
    internalOperation: z.string().optional(),
    teamId: z.string().uuid().optional(),
    teamReference: z.string().optional(),
    teamName: z.string().optional(),
    memberId: z.string().uuid().optional(),
    memberReference: z.string().optional(),
    memberName: z.string().optional(),
    memberSkills: z.array(z.string()).optional(),
    requiredSkills: z.array(z.string()).optional(),
    isTeamLead: z.boolean().optional(),
    skill: z.object({
      name: z.string(),
      level: z.number()
    }).optional(),
    additionalInfo: z.object({
      skill: z.object({
        name: z.string(),
        level: z.number()
      })
    }).optional()
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
    category_id?: string;
  }>;
  context?: RAGContext & {
    resolvedCategory?: {
      id: string;
      name: string;
    };
  };
}

// Add type definition at the top with other types
interface TaskRouterOutput {
  targetAgent: string;
  domain: string;
  operation: string;
  parameters: Record<string, any>;
  confidence: number;
}

const routerPrompt = new PromptTemplate({
  template: `You are a task routing agent for a support system. Your job is to analyze user input and determine the appropriate domain and operation.

Valid domains and operations:
- kb: draft_article (create new article), update_article (modify article), search_articles (find articles)
- ticket: ticket_search, ticket_create, ticket_update, ticket_bulk_search, ticket_bulk_update, ticket_analytics, ticket_reassign
- team: team_search, team_assign, team_skill_search, team_skill_update, team_schedule_update, team_schedule_generate

Instructions:
1. Determine the most appropriate domain and operation
2. For KB operations:
   - Use draft_article for creating new articles
   - Use update_article for modifying existing articles
   - Use search_articles for finding articles
3. For team operations:
   - Use team_schedule_update for schedule changes
   - Use team_skill_update for skill updates
   - Use team_skill_search for finding members by skill
4. For ticket operations:
   - Use ticket_reassign for changing ticket assignment
   - For ticket reassignment:
     - Use the exact UUID from context.similarTickets[].assigned_to as assigned_to
     - Use the exact UUID from context.agentInfo.id as new_assigned_to
     - Do not modify or generate new UUIDs
   - Always use the assigned_to field for agent assignments
   - IMPORTANT: The assigned_to field must ALWAYS be a valid UUID. Do not use names or roles in this field.
   - If you don't have a valid UUID for assigned_to, omit the field and let the system resolve it.
5. Map entities to operation parameters
6. Provide a confidence score for the routing decision

Examples:
1. Input: "Reassign ticket TK-123 to Sarah"
   Context: {{
     "similarTickets": [{{"id": "123", "assigned_to": "987e4567-e89b-12d3-a456-426614174555"}}],
     "agentInfo": {{"id": "321e4567-e89b-12d3-a456-426614174222"}}
   }}
   Output: {{
     "targetAgent": "TICKET_ACTION",
     "domain": "ticket",
     "operation": "ticket_reassign",
     "confidence": 0.9,
     "parameters": {{
       "ticketId": "123",
       "assigned_to": "987e4567-e89b-12d3-a456-426614174555",
       "new_assigned_to": "321e4567-e89b-12d3-a456-426614174222"
     }}
   }}

2. Input: "Update ticket TK-456 and assign it to John"
   Output: {{
     "targetAgent": "TICKET_ACTION",
     "domain": "ticket",
     "operation": "ticket_update",
     "confidence": 0.9,
     "parameters": {{
       "ticketId": "456e4567-e89b-12d3-a456-426614174000",
       "updates": {{
         "assigned_to": "987e4567-e89b-12d3-a456-426614174555",
         "new_assigned_to": "321e4567-e89b-12d3-a456-426614174222"
       }}
     }}
   }}

3. Input: "Create a troubleshooting guide for login errors"
   Output: {{
     "targetAgent": "KB_ACTION",
     "domain": "kb", 
     "operation": "draft_article",
     "confidence": 0.9,
     "parameters": {{
       "article": {{
         "title": "Login Error Troubleshooting Guide",
         "description": "Guide for resolving login authentication issues"
       }}
     }}
   }}

4. Input: "Find tickets about payment failures"
   Output: {{
     "targetAgent": "TICKET_ACTION",
     "domain": "ticket",
     "operation": "ticket_search",
     "confidence": 0.8,
     "parameters": {{
       "criteria": {{
         "category": "payment",
         "status": "open"
       }}
     }}
   }}

5. Input: "Update the password reset article with new steps"
   Output: {{
     "targetAgent": "KB_ACTION", 
     "domain": "kb",
     "operation": "kb_update",
     "confidence": 0.9,
     "parameters": {{
       "article": {{
         "title": "Password Reset Guide",
         "description": "Updated steps for password reset process"
       }}
     }}
   }}

6. Input: "Find agents who know JavaScript"
   Output: {{
     "targetAgent": "TEAM_ACTION",
     "domain": "team",
     "operation": "team_skill_search",
     "confidence": 0.85,
     "parameters": {{
       "skills": ["javascript"],
       "proficiency": "any"
     }}
   }}

7. Input: "Update John's schedule to Monday and Wednesday"
   Output: {{
     "targetAgent": "TEAM_ACTION",
     "domain": "team",
     "operation": "team_schedule_update",
     "priority": "medium",
     "confidence": 0.95,
     "parameters": {{
       "memberName": "John",
       "schedule": [
         {{
           "dayOfWeek": 1,
           "startTime": "09:00",
           "endTime": "17:00"
         }},
         {{
           "dayOfWeek": 3,
           "startTime": "09:00",
           "endTime": "17:00"
         }}
       ]
     }}
   }}

8. Input: "Add TypeScript and React to Sarah's skills"
   Output: {{
     "targetAgent": "TEAM_ACTION",
     "domain": "team",
     "operation": "team_skill_update",
     "priority": "medium",
     "confidence": 0.95,
     "parameters": {{
       "memberName": "Sarah",
       "skillNames": ["TypeScript", "React"],
       "proficiencyLevels": [3, 3]
     }}
   }}

9. Input: "Add Sarah to the Backend team as lead developer"
   Output: {{
     "targetAgent": "TEAM_ACTION",
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

Input: {query}
Entities: {entities}
Context: {context}

Output a JSON object with:
- targetAgent: The agent to handle this (KB_ACTION, TICKET_ACTION, TEAM_ACTION)
- domain: The domain this belongs to (kb, ticket, team)
- operation: The specific operation to perform
- confidence: How confident you are in this routing (0-1)
- parameters: Any relevant parameters for the operation

Response:`,
  inputVariables: ["query", "entities", "context"]
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

      const formattedPrompt = await routerPrompt.format({
        query: input.query,
        entities: JSON.stringify(input.entities, null, 2),
        context: JSON.stringify(input.context, null, 2)
      });

      const response = await this.llm.invoke(formattedPrompt);
      const content = typeof response.content === 'string' 
        ? response.content 
        : Array.isArray(response.content)
          ? response.content.join('\n')
          : '';
      console.log('LLM Response:', content);

      // Parse LLM response
      const llmResult = await this.parser.invoke(content);

      const processedResult = this.processLLMResponse(llmResult, input.context);
      
      // Extract entities from the input and merge them with the LLM output parameters.
      const extractedEntities = this.extractEntities(input.entities);
      processedResult.parameters = { ...extractedEntities, ...processedResult.parameters };

      // Check for ticket updates - if assigned_to isn't a valid UUID but we have a memberId from extraction, override it.
      if (
        processedResult.domain === 'ticket' &&
        processedResult.parameters.updates &&
        processedResult.parameters.updates.assigned_to &&
        !this.isValidUUID(processedResult.parameters.updates.assigned_to) &&
        processedResult.parameters.memberId &&
        this.isValidUUID(processedResult.parameters.memberId)
      ) {
        processedResult.parameters.updates.assigned_to = processedResult.parameters.memberId;
      }

      // Only include priority for ticket operations
      const finalResult: RoutingResult = {
        ...processedResult,
        entities: input.entities || [],
        context: this.filterContextByDomain(processedResult.domain, input.context)
      };

      if (processedResult.domain === 'ticket') {
        finalResult.priority = processedResult.priority || 'medium';
      }

      // Check confidence threshold
      if (finalResult.confidence < this.confidenceThreshold) {
        console.warn(`Low confidence (${finalResult.confidence}) in task routing`);
        throw new Error(`Low confidence (${finalResult.confidence}) in task routing`);
      }

      console.log('Final Routing Result:', JSON.stringify(finalResult, null, 2));
      console.groupEnd();
      return finalResult;
    } catch (error) {
      console.error('Task routing failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  private filterContextByDomain(domain: string, context?: RAGContext): RAGContext | undefined {
    if (!context) return undefined;

    switch (domain) {
      case 'ticket':
        return {
          domain,
          similarTickets: context.similarTickets || [],
          previousSolutions: context.previousSolutions || [],
          kbArticles: [], // Don't pass KB articles to ticket agent
          resolvedCategory: context.resolvedCategory,
          agentInfo: context.agentInfo  // Preserve agentInfo in the context
        };
      case 'kb':
        return {
          domain,
          kbArticles: context.kbArticles || [],
          similarTickets: [],
          previousSolutions: [],
          resolvedCategory: context.resolvedCategory
        };
      case 'team':
        return {
          domain,
          similarTickets: [],
          kbArticles: [],
          previousSolutions: [],
          resolvedCategory: context.resolvedCategory
        };
      default:
        return context;
    }
  }

  private extractEntities(entities: TaskInput['entities']): Record<string, any> {
    const entityMap: Record<string, any> = {
      ticket: {
        id: undefined,
        reference: undefined,
        title: undefined,
        status: undefined,
        requiredSkills: []  // Add array for required skills
      } as TicketReference,
      kb: {} as KBReference,
      team: {
        name: undefined,
        requiredSkills: []
      } as TeamReference,
      teamMember: {
        name: undefined,
        skills: [],
        role: undefined,
        id: undefined // Explicitly capture id for team members
      } as TeamMemberReference
    };
    
    if (!Array.isArray(entities)) {
      if (entities && typeof entities === 'object') {
        // If entities is a single object, wrap it in an array.
        entities = [entities];
      } else {
        console.warn('Entities is not an array, returning empty map');
        return entityMap;
      }
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

        // Handling assignment fields explicitly.
        // Ensure that we only assign them when the format is a UUID.
        case 'assigned_to':
          if (format === 'uuid') {
            entityMap.assigned_to = value;
          }
          break;

        case 'assigned_to':
          if (format === 'uuid') {
            entityMap.assigned_to = value;
          }
          break;

        case 'skill':
          console.group('🔄 Task Router - Processing Skill Entity');
          console.log('Processing skill entity:', {
            type: 'skill',
            value,
            subType,
            metadata: entity.metadata
          });

          if (subType === 'member') {
            if (!entityMap.teamMember.skills) {
              entityMap.teamMember.skills = [];
            }
            entityMap.teamMember.skills.push(value);
            console.log('Added member skill:', value);
          } else if (subType === 'required') {
            console.log('Processing required skill:', {
              value,
              metadata: entity.metadata
            });

            const skillData = {
              id: value,  // This is the UUID from the entity
              name: entity.metadata?.name,
              category: entity.metadata?.category,
              proficiencyLevel: 3  // Default proficiency level
            };

            console.log('Created skill data:', skillData);
            entityMap.ticket.requiredSkills.push(skillData);
            console.log('Updated required skills:', entityMap.ticket.requiredSkills);
          }

          console.groupEnd();
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

    if (entityMap.teamMember.id || entityMap.teamMember.reference || entityMap.teamMember.name) {
      if (entityMap.teamMember.id) {
        entityMap.memberId = entityMap.teamMember.id;
      } else if (entityMap.teamMember.reference) {
        entityMap.memberReference = entityMap.teamMember.reference;
      } else {
        // Fallback: only set memberName if no id or reference is provided.
        entityMap.memberName = entityMap.teamMember.name;
      }
      if (entityMap.teamMember.role) entityMap.memberRole = entityMap.teamMember.role;
      if (entityMap.teamMember.skills?.length > 0) entityMap.memberSkills = entityMap.teamMember.skills;
      if (typeof entityMap.teamMember.isTeamLead === 'boolean') {
        entityMap.isTeamLead = entityMap.teamMember.isTeamLead;
      }
    }

    // The extracted assignment fields (if any) will be merged with the LLM output.
    // The checks above ensure these are only set when a valid UUID is provided.
    if (entityMap.assigned_to) entityMap.assigned_to = entityMap.assigned_to;
    if (entityMap.assigned_to) entityMap.assigned_to = entityMap.assigned_to;

    return entityMap;
  }

  // Implement the process method required by BaseAgent
  async process(input: TaskInput): Promise<string> {
    try {
      console.group('🔄 Task Router Agent - Starting Process');
      console.log('Input:', JSON.stringify(input, null, 2));

      // Extract category_id from entities or context
      const category_id = input.entities?.find(e => e.type === 'article')?.category_id ||
                         input.context?.resolvedCategory?.id;

      if (category_id) {
        console.log('Found category_id:', category_id);
      }

      // Get routing result
      const result = await this.routeTask(input);

      // Ensure category_id is preserved in parameters for KB operations
      if (category_id && result.parameters) {
        if (result.domain === 'kb' && result.parameters.article) {
          result.parameters.article.category_id = category_id;
        }
        result.parameters.category_id = category_id;
        console.log('Added category_id to parameters:', category_id);
      }

      console.log('Final routing result:', JSON.stringify(result, null, 2));
      console.groupEnd();

      return JSON.stringify(result);
    } catch (error) {
      console.error('Task routing failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  private processLLMResponse(response: any, context?: RAGContext): Omit<RoutingResult, 'entities' | 'context'> {
    // Normalize parameters
    let normalizedParams = { ...response.parameters };

    // For ticket updates - ensure assigned_to is always a valid UUID
    if (response.domain === 'ticket' && normalizedParams.updates?.assigned_to) {
      if (!this.isValidUUID(normalizedParams.updates.assigned_to)) {
        // If we have context with agentInfo, use that UUID
        if (context?.agentInfo?.id) {
          normalizedParams.updates.assigned_to = context.agentInfo.id;
        }
        else {
          // Remove invalid assigned_to value
          delete normalizedParams.updates.assigned_to;
        }
      }
    }

    // Convert status to snake_case if present
    if (normalizedParams.status) {
      normalizedParams.status = normalizedParams.status.toLowerCase().replace(/\s+/g, '_');
    }

    // OPTIONAL: Convert ticketReference (e.g. 'TK-123') to a UUID ticketId, if not already set.
    if (!normalizedParams.ticketId && normalizedParams.ticketReference) {
      // Skip ticket reference conversion since method doesn't exist
      console.warn('Ticket reference conversion not implemented');
    }

    // For ticket reassignment, always override assigned_to with context.agentInfo.id if available.
    if (response.operation === 'ticket_reassign') {
      normalizedParams.operation = 'ticket_update';
      // Get the current assignee from the relevant ticket in context
      const relevantTicket = context?.similarTickets?.find(ticket => 
        ticket.id === normalizedParams.ticketId
      );
      
      // Set current assigned_to from the existing ticket
      if (relevantTicket?.assigned_to) {
        normalizedParams.current_assigned_to = relevantTicket.assigned_to;
      }
      
      // Set new assigned_to from agentInfo
      if (context?.agentInfo?.id) {
        normalizedParams.new_assigned_to = context.agentInfo.id;
      }

      // Ensure we're not assigning to the same person
      if (normalizedParams.current_assigned_to === normalizedParams.new_assigned_to) {
        console.warn('Attempted to reassign ticket to the same person');
      }

      normalizedParams.updates = {
        assigned_to: normalizedParams.new_assigned_to
      };
    } else if (
      response.operation === 'ticket_update' &&
      normalizedParams.updates &&
      normalizedParams.updates.assigned_to
    ) {
      // In case of ticket_update, if the assigned_to field is not a valid UUID and an agentInfo is available, override it.
      if (!this.isValidUUID(normalizedParams.updates.assigned_to) && context && (context as any).agentInfo?.id) {
        normalizedParams.updates.assigned_to = (context as any).agentInfo.id;
      }
      if (normalizedParams.assigned_to) {
        normalizedParams.updates.assigned_to = normalizedParams.assigned_to;
      }
    }

    // For KB operations, ensure category_id is included in article parameters
    if (response.domain === 'kb') {
      const category_id = normalizedParams.category_id || (response.context?.resolvedCategory?.id);
      if (category_id) {
        normalizedParams.category_id = category_id;
        if (normalizedParams.article) {
          normalizedParams.article.category_id = category_id;
        }
      }
    }

    return {
      targetAgent: response.targetAgent,
      domain: response.domain,
      operation: normalizedParams.operation || response.operation,
      ...(response.domain === 'ticket' ? { priority: response.priority || 'medium' } : {}),
      confidence: response.confidence,
      parameters: normalizedParams
    };
  }

  private handleScheduleUpdate(params: any): Promise<any> {
    // Log received parameters
    console.log('Schedule Update Parameters:', params);

    // Check for required parameters
    const { userId, memberName, schedule } = params;
    const effectiveUserId = userId || memberName; // Use memberName as fallback

    if (!effectiveUserId || !schedule) {
      const missingParams = {
        userId: effectiveUserId,
        schedule
      };
      console.log('Missing required parameters:', missingParams);
      throw new Error('Missing required parameters: userId and schedule');
    }

    // Process schedules
    const schedules = Array.isArray(schedule) ? schedule : [schedule];
    const scheduleData = schedules.map(s => ({
      user_id: effectiveUserId,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
      is_active: true
    }));

    // Return processed schedule data as an object
    return Promise.resolve({
      data: {
        operation: 'INSERT',
        schedules: scheduleData,
        userId: effectiveUserId
      }
    });
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
} 