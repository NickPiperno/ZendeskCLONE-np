import { z } from 'zod';
import { BaseAgent } from './types';
import { ChatModel } from '../types';
import { ChatOpenAI } from '@langchain/openai';

// Define database operation types
const OperationType = z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);

// Define database table types
const TableName = z.enum(['teams', 'team_members', 'team_schedules', 'user_skills', 'skills']);

// Define core Team operations
const TeamOperations = z.enum([
  'skill_match',        // Find team members with specific skills
  'team_member_add',    // Add member to team
  'skill_update',       // Update member skills
  'schedule_update',    // Update team schedule
  'schedule_generate'   // Generate new schedule
]);

type TeamOperation = z.infer<typeof TeamOperations>;

// Define team member schema
const TeamMemberSchema = z.object({
  user_id: z.string(),
  team_id: z.string().optional(),
  role: z.string().optional(),
  skills: z.array(z.object({
    skill_id: z.string(),
    proficiency_level: z.number()
  })).optional()
});

// Define schedule schema
const ScheduleSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  user_id: z.string().uuid(),
  day_of_week: z.number().min(0).max(6),  // 0-6 for Sunday-Saturday
  start_time: z.string(),  // HH:mm format
  end_time: z.string(),    // HH:mm format
  shift_type: z.enum(['regular', 'on_call', 'backup']),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
});

// Define input schema
const teamAgentInputSchema = z.object({
  operation: TeamOperations,
  parameters: z.record(z.any()),
  context: z.any().optional()
});

// Define enums for team-related data
const ShiftType = z.enum(['regular', 'on_call', 'backup']);
const TeamRole = z.enum(['member', 'lead', 'manager']);

// Define team agent output schema
const TeamAgentOutput = z.object({
  action: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
  table: z.enum(['teams', 'team_members', 'team_schedules', 'user_skills']),
  data: z.object({
    // Team fields
    team_id: z.string().uuid().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    is_active: z.boolean().optional(),
    
    // Team member fields
    user_id: z.string().uuid().optional(),
    role: TeamRole.optional(),
    
    // Schedule fields
    day_of_week: z.number().min(0).max(6).optional(),
    start_time: z.string().optional(),  // HH:mm format
    end_time: z.string().optional(),    // HH:mm format
    shift_type: ShiftType.optional(),
    
    // Skill fields
    skill_id: z.string().uuid().optional(),
    proficiency_level: z.number().min(1).max(5).optional(),
    
    // Search fields
    select: z.array(z.string()).optional(),
    transform: z.enum(['skill_match', 'schedule_optimize']).optional()
  }).passthrough(),
  conditions: z.array(z.record(z.any())).optional(),
  rpcCalls: z.array(z.object({
    function: z.string(),
    params: z.record(z.any())
  })).optional()
});

type TeamOutput = z.infer<typeof TeamAgentOutput>;

// Update PROMPT_TEMPLATE to include new examples
const PROMPT_TEMPLATE = `You are a Team Agent responsible for managing team composition and scheduling.
Your core responsibilities are:
1. Finding team members with specific skills
2. Managing team member assignments
3. Updating team member skills
4. Managing team schedules

Current Request:
{input}

Context:
{context}

You must respond with a JSON object following this structure:

{
  "action": "INSERT" | "SELECT" | "UPDATE" | "DELETE",
  "table": "teams" | "team_members" | "team_schedules" | "user_skills",
  "data": {
    // For team operations:
    "team_id": uuid,                  // Required for existing team
    "name": string,                   // Required for new team
    "description": string,            // Optional
    "is_active": boolean,             // Optional
    
    // For team member operations:
    "user_id": uuid,                  // Required for member operations
    "role": "member" | "lead" | "manager",  // Optional
    
    // For schedule operations:
    "day_of_week": number,            // 0-6 for Sunday-Saturday
    "start_time": string,             // HH:mm format
    "end_time": string,               // HH:mm format
    "shift_type": "regular" | "on_call" | "backup",
    
    // For skill operations:
    "skill_id": uuid,                 // Required for skill operations
    "proficiency_level": number,      // 1-5 scale
    
    // For search operations:
    "select": string[],               // Fields to select
    "transform": "skill_match" | "schedule_optimize"  // Optional transformation
  },
  "conditions": [                     // Optional search/update conditions
    { "field": "value" }
  ],
  "rpcCalls": [                      // Optional RPC calls
    {
      "function": string,            // Function name
      "params": {                    // Function parameters
        "key": "value"
      }
    }
  ]
}

Example responses for different operations:

For skill matching:
{
  "action": "SELECT",
  "table": "user_skills",
  "data": {
    "select": ["user_id", "skill_id", "proficiency_level"],
    "transform": "skill_match"
  },
  "conditions": [
    { "skill_id": ["typescript", "react"] },
    { "proficiency_level": { "gte": 3 } }
  ]
}

For schedule update:
{
  "action": "UPDATE",
  "table": "team_schedules",
  "data": {
    "team_id": "team_01234567-89ab-cdef-0123-456789abcdef",
    "user_id": "user_01234567-89ab-cdef-0123-456789abcdef",
    "day_of_week": 1,
    "start_time": "09:00",
    "end_time": "17:00",
    "shift_type": "regular"
  },
  "conditions": [
    { "team_id": "team_01234567-89ab-cdef-0123-456789abcdef" },
    { "user_id": "user_01234567-89ab-cdef-0123-456789abcdef" }
  ],
  "rpcCalls": [
    {
      "function": "notify_schedule_update",
      "params": {
        "team_id": "team_01234567-89ab-cdef-0123-456789abcdef",
        "user_id": "user_01234567-89ab-cdef-0123-456789abcdef",
        "type": "schedule_change"
      }
    }
  ]
}

For team member addition:
{
  "action": "INSERT",
  "table": "team_members",
  "data": {
    "team_id": "team_01234567-89ab-cdef-0123-456789abcdef",
    "user_id": "user_01234567-89ab-cdef-0123-456789abcdef",
    "role": "member"
  },
  "rpcCalls": [
    {
      "function": "update_team_capacity",
      "params": { "team_id": "team_01234567-89ab-cdef-0123-456789abcdef" }
    }
  ]
}

Analyze the input and context, then generate the appropriate operation.`;

export class TeamAgent implements BaseAgent {
  name = "Team Agent";
  description = "Manages team composition and scheduling";

  constructor(
    private llm: ChatModel
  ) {}

  async process(input: { 
    operation: z.infer<typeof TeamOperations>;
    parameters: any;
    context: any;
  }): Promise<string> {
    try {
      console.group('👥 Team Agent');
      console.log('Input:', input);

      // Map operations to database actions
      const operationMap = {
        skill_match: 'SELECT',
        team_member_add: 'INSERT',
        skill_update: 'UPDATE',
        schedule_update: 'UPDATE',
        schedule_generate: 'INSERT'
      } as const;

      const prompt = PROMPT_TEMPLATE
        .replace('{input}', JSON.stringify({
          operation: input.operation,
          parameters: input.parameters
        }))
        .replace('{context}', JSON.stringify(input.context));

      const response = await this.llm.invoke(prompt);
      
      if (!response || typeof response.content !== 'string') {
        throw new Error('Invalid LLM response format');
      }

      // Parse and validate the response
      const result = JSON.parse(response.content);
      
      // Ensure the action matches the operation
      result.action = operationMap[input.operation];
      
      const validated = TeamAgentOutput.parse(result);

      console.log('Generated Output:', validated);
      console.groupEnd();
      return JSON.stringify(validated);
    } catch (error) {
      console.error('Team operation failed:', error);
      console.groupEnd();
      throw error;
    }
  }
}

// Export singleton instance
export const teamAgent = new TeamAgent(new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0
})); 