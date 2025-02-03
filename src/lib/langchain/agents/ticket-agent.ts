import { BaseAgent, ChatModel } from '../types';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';

// Input Types - What we expect from user/LLM
interface TicketSkill {
  skillName: string;
  proficiencyLevel: number;
  skillId: string;  // Required UUID from RAG agent
}

// Input Validation Schemas
const TicketSkillSchema = z.object({
  skillName: z.string(),
  proficiencyLevel: z.number().min(1).max(5),
  skillId: z.string().uuid()  // Required UUID from RAG agent
}) satisfies z.ZodType<TicketSkill>;

const TicketInputSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  skills: z.preprocess(
    (arg) => (Array.isArray(arg) ? arg : arg ? [arg] : []),
    z.array(TicketSkillSchema).optional()
  )
}).passthrough();

// Add a stricter schema for ticket creation
const TicketCreationSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  priority: z.string(),
  metadata: z.record(z.any()).optional(),
  skills: z.preprocess(
    (arg) => (Array.isArray(arg) ? arg : arg ? [arg] : []),
    z.array(TicketSkillSchema).optional()
  )
}).passthrough();

const TicketSkillInputSchema = z.object({
  ticket_id: z.string().uuid(),
  skill_id: z.string().uuid().optional(),
  proficiency_level: z.number().min(1).max(5),
  skill_name: z.string().optional()
}).passthrough();

// Database Schemas - Exactly matching @schema.md
const DatabaseTicketSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  priority: z.string(),
  assigned_to: z.string().uuid().optional(),
  created_by: z.string().uuid().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
  deleted: z.boolean().optional(),
  deleted_at: z.string().datetime().optional()
}).strict(); // No extra fields allowed

const DatabaseTicketSkillSchema = z.object({
  ticket_id: z.string().uuid(),
  skill_id: z.string().uuid(),
  required_proficiency: z.number().min(1).max(5)
}).strict(); // No extra fields allowed

// Execution Schema - What the execution agent needs
const ExecutionTicketSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  metadata: z.record(z.any()).optional()
}).passthrough();

// Helper for validating UUID or placeholder
const uuidOrPlaceholder = z.string().refine(
  (val) => {
    // Check if it's a placeholder or a valid UUID
    return val.startsWith('{{') && val.endsWith('}}') || 
           /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
  },
  {
    message: "Must be a valid UUID or a placeholder (e.g., {{TICKET_ID}})"
  }
);

const ExecutionTicketSkillSchema = z.object({
  ticket_id: uuidOrPlaceholder,
  skill_id: uuidOrPlaceholder.optional(),
  required_proficiency: z.number().min(1).max(5),
  skill_name: z.string() // For skill lookup
}).passthrough();

// Operation types
const TicketOperations = z.enum([
    'ticket_search', 
    'ticket_create', 
    'ticket_update',
    'ticket_bulk_search',
    'ticket_bulk_update',
  'ticket_analytics',
  'ticket_skill_add',
  'ticket_skill_remove'
]);

type TicketOperationType = z.infer<typeof TicketOperations>;

// Input schema for the agent
const ticketAgentInputSchema = z.object({
  operation: TicketOperations,
  parameters: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    urgency: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    skills: z.preprocess(
      (arg) => (Array.isArray(arg) ? arg : arg ? [arg] : []),
      z.array(z.object({
        skillId: z.string().uuid(),     // Required UUID
        skillName: z.string(),
        proficiencyLevel: z.number().min(1).max(5)
      })).optional()
    ),
    ticketId: z.string().uuid().optional(),  // Changed from ticket_id to ticketId
    skill_id: z.string().uuid().optional(),
    proficiency_level: z.number().min(1).max(5).optional(),
    assigned_to: z.string().uuid().optional(),  // Only use assigned_to for consistency
    updates: z.object({
      requiredSkills: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        category: z.string(),
        description: z.string().optional(),
        proficiency_level: z.number().min(1).max(5).optional()
      })).optional(),
      skills: z.array(z.object({
        id: z.string().uuid(),
        name: z.string(),
        proficiency_level: z.number().min(1).max(5)
      })).optional(),
      assigned_to: z.string().uuid().optional()  // Add assigned_to to updates
    }).optional()
  }).passthrough(),
  context: z.object({
    requiredSkills: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      category: z.string(),
      description: z.string().optional(),
      proficiency_level: z.number().min(1).max(5).optional()
    })).optional(),
    ticket: z.object({
      id: z.string().uuid().optional()
    }).optional()
  }).passthrough()
});

type TicketAgentInput = z.infer<typeof ticketAgentInputSchema>;

// Operation schema for execution agent
const OperationSchema = z.object({
  action: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
  table: z.enum(['tickets', 'ticket_skills']),
  data: z.union([ExecutionTicketSchema, ExecutionTicketSkillSchema]),
  conditions: z.array(z.record(z.any())).optional()
});

// Output schema that supports batch operations
const TicketAgentOutput = z.object({
  action: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
  table: z.enum(['tickets', 'ticket_skills']),
  data: z.union([ExecutionTicketSchema, ExecutionTicketSkillSchema]),
  conditions: z.array(z.record(z.any())).optional(),
  batch_operations: z.array(OperationSchema).optional()
});

type TicketOutput = z.infer<typeof TicketAgentOutput>;

const PROMPT_TEMPLATE = `You are a Ticket Agent responsible for managing support tickets and their required skills.
Your core responsibilities are:
1. Creating and updating tickets
2. Managing ticket skill requirements
3. Searching for relevant tickets
4. Analyzing ticket patterns

Current Request:
{input}

Context:
{context}

You must respond with a JSON object following this structure:

{
  "action": "SELECT" | "INSERT" | "UPDATE" | "DELETE",
  "table": "tickets" | "ticket_skills",
  "data": {
    // For tickets table operations:
    "title": string,                  // Title of the ticket
    "description": string,            // Description of the issue
    "status": string,                 // Current status of the ticket
    "priority": string,               // Ticket priority level
    "assigned_to": uuid,              // UUID of assigned team member
    "created_by": uuid,               // UUID of ticket creator
    "metadata": object,               // Additional metadata as JSONB
    
    // For ticket_skills table operations:
    "ticket_id": uuid,                // UUID of the ticket
    "skill_id": uuid,                 // UUID of the required skill
    "required_proficiency": number,   // Required proficiency level (1-5)
    
    // For SELECT operations:
    "select": string[]                // Fields to select
  },
  "conditions": [                     // Optional search/update conditions
    { "field": "value" }
  ]
}

Database Schema:

tickets table:
- id: UUID PRIMARY KEY
- title: TEXT NOT NULL
- description: TEXT
- status: TEXT
- priority: TEXT
- assigned_to: UUID (References profiles(id))
- created_by: UUID (References profiles(id))
- created_at: TIMESTAMPTZ DEFAULT NOW()
- updated_at: TIMESTAMPTZ DEFAULT NOW()
- metadata: JSONB
- deleted: BOOLEAN DEFAULT false
- deleted_at: TIMESTAMPTZ

ticket_skills table:
- id: UUID PRIMARY KEY
- ticket_id: UUID (References tickets(id))
- skill_id: UUID (References skills(id))
- required_proficiency: INTEGER CHECK (required_proficiency BETWEEN 1 AND 5)

Available Operations and Their Mappings:
1. ticket_create      -> { action: "INSERT", table: "tickets" }
2. ticket_update      -> { action: "UPDATE", table: "tickets" }
3. ticket_search      -> { action: "SELECT", table: "tickets" }
4. ticket_bulk_search -> { action: "SELECT", table: "tickets" }
5. ticket_bulk_update -> { action: "UPDATE", table: "tickets" }
6. ticket_analytics   -> { action: "SELECT", table: "tickets" }
7. ticket_skill_add   -> { action: "INSERT", table: "ticket_skills" }
8. ticket_skill_remove -> { action: "DELETE", table: "ticket_skills" }

Example responses for different operations:

For ticket creation:
{
  "action": "INSERT",
  "table": "tickets",
  "data": {
    "title": "Email Access Issue",
    "description": "User cannot access email",
    "status": "open",
    "priority": "high",
    "metadata": {
      "source": "email",
      "platform": "outlook"
    }
  }
}

For ticket update:
{
  "action": "UPDATE",
  "table": "tickets",
  "data": {
    "status": "in_progress",
    "assigned_to": "123e4567-e89b-12d3-a456-426614174000"
  },
  "conditions": [
    { "id": "123e4567-e89b-12d3-a456-426614174111" }
  ]
}

For ticket search:
{
  "action": "SELECT",
  "table": "tickets",
  "data": {
    "select": ["id", "title", "status", "priority", "assigned_to", "created_by"]
  },
  "conditions": [
    { "status": "open" },
    { "priority": "high" }
  ]
}

For ticket analytics:
{
  "action": "SELECT",
  "table": "tickets",
  "data": {
    "select": ["status", "priority", "created_at", "created_by"],
    "metrics": ["count", "average_resolution_time"]
  },
  "conditions": [
    {
      "created_at": {
        "gte": "2024-01-01",
        "lte": "2024-03-01"
      }
    }
  ]
}

For adding a skill requirement:
{
  "action": "INSERT",
  "table": "ticket_skills",
  "data": {
    "ticket_id": "123e4567-e89b-12d3-a456-426614174000",
    "skill_id": "987fdebc-a89b-12d3-a456-426614174000",
    "required_proficiency": 3
  }
}

For removing a skill requirement:
{
  "action": "DELETE",
  "table": "ticket_skills",
  "conditions": [
    { "ticket_id": "123e4567-e89b-12d3-a456-426614174000" },
    { "skill_id": "987fdebc-a89b-12d3-a456-426614174000" }
  ]
}

Important Rules:
1. For tickets INSERT: include all required fields (title, description, status, priority)
2. For ticket_skills INSERT: include all required fields (ticket_id, skill_id, required_proficiency)
3. For ticket_skills operations: required_proficiency must be between 1 and 5
4. For UPDATE/DELETE operations: always specify conditions
5. For SELECT operations: always specify fields to select
6. Only use fields that exist in the respective table schema
7. Timestamps and deletion flags are managed by the database

Analyze the input and context, then generate the appropriate response matching the schema above.`;

export class TicketAgent implements BaseAgent {
  name = "Ticket Agent";
  description = "Manages support tickets and their lifecycle";

  constructor(
    private llm: ChatModel
  ) {}

  async process(input: TicketAgentInput): Promise<string> {
    try {
      console.group('🎫 Ticket Agent');
      console.log('Input:', input);

      // Validate input first
      const validatedInput = ticketAgentInputSchema.parse(input);
      console.log('Validated input:', validatedInput);

      // Special handling for ticket creation with skills
      if (validatedInput.operation === 'ticket_create') {
        // Check if ticket details are nested in a "ticket" field
        const ticketDetails = validatedInput.parameters.ticket || validatedInput.parameters;
        const ticketParams = TicketCreationSchema.parse(ticketDetails);
        console.log('Validated ticket parameters:', ticketParams);

        // First validate against database schema
        const dbTicketData = DatabaseTicketSchema.parse({
          title: ticketParams.title,
          description: ticketParams.description,
          status: ticketParams.status,
          priority: ticketParams.priority,
          metadata: ticketParams.metadata
        });
        console.log('Validated against database schema:', dbTicketData);

        // Then create ticket operation for execution
        const ticketOperation: TicketOutput = {
          action: 'INSERT',
          table: 'tickets',
          data: ExecutionTicketSchema.parse({
            ...dbTicketData
          }),
          conditions: []
        };

        // Use skills from parameters (which now have proper UUIDs)
        const skills = validatedInput.parameters.skills || [];
        if (skills.length > 0) {
          const skillOperations = skills.map((skill) => {
            return {
              action: 'INSERT' as const,
              table: 'ticket_skills' as const,
              data: ExecutionTicketSkillSchema.parse({
                ticket_id: '{{TICKET_ID}}',  // Only ticket_id remains as placeholder
                skill_id: skill.skillId,     // Use the UUID from parameters
                required_proficiency: skill.proficiencyLevel,
                skill_name: skill.skillName  // For reference only
              }),
              conditions: []
            };
          });

          ticketOperation.batch_operations = skillOperations;
        }

        const validated = TicketAgentOutput.parse(ticketOperation);
        console.log('Final validated output:', validated);
        console.groupEnd();
        return JSON.stringify(validated);
      }

      // For all other operations, use the lenient schema
      const ticketDetails = validatedInput.parameters.ticket || validatedInput.parameters;
      const ticketParams = TicketInputSchema.parse(ticketDetails);
      console.log('Validated ticket parameters:', ticketParams);

      // Special handling for ticket updates
      if (validatedInput.operation === 'ticket_update') {
        // Only include fields that were provided in the parameters
        const updateData: Record<string, any> = {};
        
        if (ticketParams.title) updateData.title = ticketParams.title;
        if (ticketParams.description) updateData.description = ticketParams.description;
        if (ticketParams.status) updateData.status = ticketParams.status;
        if (ticketParams.priority) updateData.priority = ticketParams.priority;
        if (ticketParams.metadata) updateData.metadata = ticketParams.metadata;
        
        // Handle assignment updates
        const assignedTo = validatedInput.parameters.assigned_to || validatedInput.parameters.updates?.assigned_to;
        if (assignedTo) {
          updateData.assigned_to = assignedTo;
        }

        // Ensure we have a ticket ID
        if (!validatedInput.parameters.ticketId) {
          throw new Error('Ticket ID is required for updates');
        }

        // Get skills from either requiredSkills or skills array
        const skills = validatedInput.parameters.updates?.requiredSkills || validatedInput.parameters.updates?.skills;

        // Ensure we have some data to update
        if (Object.keys(updateData).length === 0 && !skills?.length) {
          throw new Error('No fields to update were provided');
        }

        const ticketOperation: TicketOutput = {
          action: 'UPDATE',
          table: 'tickets',
          data: ExecutionTicketSchema.parse(updateData),
          conditions: [{ id: validatedInput.parameters.ticketId }]
        };

        // Handle skill updates if present
        if (skills && skills.length > 0) {
          const skillOperations = skills.map((skill) => ({
            action: 'INSERT' as const,
            table: 'ticket_skills' as const,
            data: ExecutionTicketSkillSchema.parse({
              ticket_id: validatedInput.parameters.ticketId,
              skill_id: skill.id,
              required_proficiency: skill.proficiency_level || 2,
              skill_name: skill.name
            }),
            conditions: []
          }));

          ticketOperation.batch_operations = skillOperations;
        }

        const validated = TicketAgentOutput.parse(ticketOperation);
        console.log('Final validated output:', validated);
        console.groupEnd();
        return JSON.stringify(validated);
      }

      // Special handling for standalone skill addition
      if (validatedInput.operation === 'ticket_skill_add') {
        // Get skill info from context if available
        const contextSkill = validatedInput.context.requiredSkills?.[0];
        const ticketId = validatedInput.parameters.ticketId || validatedInput.context.ticket?.id;
        
        if (!ticketId) {
          throw new Error('Ticket ID is required for adding skills');
        }
        
        // Validate skill input parameters
        const skillParams = TicketSkillInputSchema.parse({
          ticket_id: ticketId,
          skill_id: validatedInput.parameters.skill_id || contextSkill?.id,
          proficiency_level: validatedInput.parameters.proficiency_level || contextSkill?.proficiency_level || 2,
          skill_name: contextSkill?.name || ''
        });
        console.log('Validated skill parameters:', skillParams);

        // First validate against database schema
        const dbSkillData = DatabaseTicketSkillSchema.parse({
          ticket_id: skillParams.ticket_id,
          skill_id: skillParams.skill_id || '{{SKILL_ID}}',
          required_proficiency: skillParams.proficiency_level
        });
        console.log('Validated against database schema:', dbSkillData);

        const skillOperation: TicketOutput = {
          action: 'INSERT',
          table: 'ticket_skills',
          data: ExecutionTicketSkillSchema.parse({
            ...dbSkillData,
            skill_name: skillParams.skill_name // Add execution-specific field
          }),
          conditions: []
        };

        const validated = TicketAgentOutput.parse(skillOperation);
        console.log('Generated Output:', validated);
        console.groupEnd();
        return JSON.stringify(validated);
      }

      // Map operations to database actions
      const operationMap: Record<TicketOperationType, 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'> = {
        ticket_search: 'SELECT',
        ticket_create: 'INSERT',
        ticket_update: 'UPDATE',
        ticket_bulk_search: 'SELECT',
        ticket_bulk_update: 'UPDATE',
        ticket_analytics: 'SELECT',
        ticket_skill_add: 'INSERT',
        ticket_skill_remove: 'DELETE'
      };

      // For other operations, use the LLM
      const prompt = PROMPT_TEMPLATE
        .replace('{input}', JSON.stringify({
          operation: validatedInput.operation,
          parameters: validatedInput.parameters
        }))
        .replace('{context}', JSON.stringify(validatedInput.context));

      const response = await this.llm.invoke(prompt);
      
      if (!response || typeof response.content !== 'string') {
        throw new Error('Invalid LLM response format');
      }

      // Parse the response
      const result = JSON.parse(response.content);
      
      // Ensure the action matches the operation
      result.action = operationMap[validatedInput.operation];

      // For all other operations, proceed as normal
      const validated = TicketAgentOutput.parse(result);

      console.log('Generated Output:', validated);
      console.groupEnd();
      return JSON.stringify(validated);
    } catch (error) {
      console.error('Ticket operation failed:', error);
      console.groupEnd();
      throw error;
    }
  }
}

// Export singleton instance
export const ticketAgent = new TicketAgent(new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0
})); 