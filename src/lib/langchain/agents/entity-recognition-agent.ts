import { BaseAgent } from './types';
import { ChatModel } from '../types';
import { z } from 'zod';

// Define entity types based on our database schema
const EntityTypes = z.enum([
  'team', 'ticket', 'article', 'skill', 'profile', 'team_member', 'user_skill', 'team_schedule'
]);

type EntityType = z.infer<typeof EntityTypes>;

// Define confidence score type
const ConfidenceScore = z.number().min(0).max(1);

const PROMPT_TEMPLATE = `You are an entity recognition agent that identifies and extracts structured entities from user input.
Your task is to analyze the input and context to identify relevant entities that match our database schema.

Database Schema:
- Teams: id (uuid), name (string), description (string), is_active (boolean)
- Tickets: id (uuid), title (string), description (string), status (enum), priority (enum), assigned_to (uuid)
- Skills: id (uuid), name (string), category (string), description (string), is_active (boolean)
- Users: id (uuid), full_name (string), role (string), email (string), is_active (boolean)
- User Skills: user_id (uuid), skill_id (uuid), proficiency_level (1-5)
- Team Members: team_id (uuid), user_id (uuid), is_team_lead (boolean)
- Team Schedules: team_id (uuid), day_of_week (0-6), start_time (time), end_time (time)
- KB Articles: id (uuid), title (string), content (string), category (technical/product/how_to/troubleshooting), is_published (boolean)
- AI Documents: id (uuid), content (string), metadata (json), document_type (kb/ticket/team), vector_search (array)

Input Request: {input}
Context: {context}

Instructions:
1. Analyze the input and context to identify entities that match our schema
2. For each entity, determine:
   - The entity type (team, ticket, article, skill, etc.)
   - The relevant properties based on our schema
   - A confidence score (0-1) for the identification
3. Return a JSON object with an "entities" field containing all identified entities
4. Each entity should include type, value, confidence, and any relevant metadata
5. DO NOT include example entities in the output
6. Only return entities that are actually present in the input/context

Response Format:
{
  "entities": {
    "team": [{
      "id": "uuid or null if new",
      "name": "string",
      "description": "string (optional)",
      "is_active": boolean,
      "confidence": number
    }],
    "ticket": [{
      "id": "uuid or null if new",
      "title": "string",
      "description": "string",
      "status": "open|in_progress|resolved|closed",
      "priority": "low|medium|high|urgent",
      "assigned_to": "uuid (optional)",
      "confidence": number
    }],
    "skill": [{
      "id": "uuid or null if new",
      "name": "string",
      "category": "string",
      "confidence": number,
      "metadata": {
        "subType": "required|optional",
        "format": "uuid"
      }
    }],
    "article": [{
      "id": "uuid or null if new",
      "title": "string",
      "content": "string (optional)",
      "category": "technical|product|how_to|troubleshooting",
      "is_published": boolean,
      "confidence": number,
      "metadata": {
        "article_type": "string",
        "target_audience": "string[]",
        "platform": "string",
        "feature": "string",
        "related_tickets": "string[]",
        "tags": "string[]"
      }
    }],
    "ai_document": [{
      "id": "uuid or null if new",
      "content": "string",
      "document_type": "kb|ticket|team",
      "confidence": number,
      "metadata": {
        "source": "internal|external",
        "reference_type": "string",
        "reference_id": "string"
      }
    }]
  }
}

Remember:
- Only include entities that are actually present in the input/context
- Do not include example entities in your response
- Ensure all confidence scores are between 0 and 1
- Include metadata only when relevant to the entity type
- Return an empty array for entity types not found in the input/context
- For KB articles, always include category and metadata.article_type
- For AI documents, always specify document_type and source in metadata

Now analyze the input and context to identify the relevant entities:`;

// Define common entity fields
const BaseEntitySchema = z.object({
  confidence: z.number().min(0).max(1)
});

// Define specific entity schemas that exactly match our database
const TeamEntitySchema = BaseEntitySchema.extend({
  id: z.string().uuid().optional(),
    name: z.string(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  isNew: z.boolean().optional()
});

const TeamMemberEntitySchema = BaseEntitySchema.extend({
  team_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  is_team_lead: z.boolean().optional()
});

const TicketEntitySchema = BaseEntitySchema.extend({
  id: z.string().uuid().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigned_to: z.string().uuid().optional(),
  filter: z.object({
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
    assigned_to: z.string().uuid().optional(),
    timeframe: z.string().optional(),
    subject_matter: z.object({
      type: z.string(),
      keywords: z.array(z.string()),
      matches: z.array(z.string())
    }).optional()
  }).optional()
});

const SkillEntitySchema = BaseEntitySchema.extend({
  id: z.string().uuid().optional(),
  name: z.string(),
  category: z.enum(['technical', 'product', 'language', 'soft_skill']),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  metadata: z.object({
    subType: z.enum(['required', 'member']),
    format: z.enum(['uuid', 'reference', 'name'])
  })
}).strict();

const UserSkillEntitySchema = BaseEntitySchema.extend({
  user_id: z.string().uuid().optional(),
  skill_id: z.string().uuid().optional(),
  proficiency_level: z.number().min(1).max(5).optional()
});

const ProfileEntitySchema = BaseEntitySchema.extend({
  id: z.string().uuid().optional(),
  full_name: z.string(),
  role: z.string().optional(),
  email: z.string().optional(),
  is_active: z.boolean().optional()
});

const ArticleEntitySchema = BaseEntitySchema.extend({
  id: z.string().uuid().optional(),
  title: z.string(),
  category: z.enum(['technical', 'product', 'how_to', 'troubleshooting']),
  content: z.string().optional(),
  is_published: z.boolean().optional(),
  isNew: z.boolean().optional()
});

const TeamScheduleEntitySchema = BaseEntitySchema.extend({
  team_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  day_of_week: z.number().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  is_active: z.boolean().optional()
});

// Define the output schema for recognized entities
const EntityRecognitionOutputSchema = z.object({
  entities: z.record(z.string(), z.union([
    TeamEntitySchema,
    TeamMemberEntitySchema,
    TicketEntitySchema,
    SkillEntitySchema,
    UserSkillEntitySchema,
    ProfileEntitySchema,
    TeamScheduleEntitySchema,
    ArticleEntitySchema
  ]).array())
});

export type EntityRecognitionOutput = z.infer<typeof EntityRecognitionOutputSchema>;

export class EntityRecognitionAgent implements BaseAgent {
  name = "Entity Recognition Agent";
  description = "Packages and validates entities from RAG context for task routing";

  constructor(
    private llm: ChatModel
  ) {}

  private parseInput(input: { request: any; context: any } | string): { request: any; context: any } {
    if (typeof input === 'string') {
      return JSON.parse(input);
    }
    return input;
  }

  private extractRequestAndContext(parsedInput: any): { request: any; context: any } {
    let request, context;

    if (parsedInput.request && parsedInput.context) {
      // RAG output format
      request = parsedInput.request;
      context = parsedInput.context;
    } else if (parsedInput.context?.processedInput) {
      // Processed input format
      request = parsedInput.context.processedInput;
      context = parsedInput.context;
    } else {
      // Default format
      request = parsedInput.request || parsedInput;
      context = parsedInput.context || {};
    }

    return { request, context };
  }

  private extractSkillEntities(context: any, request: any): any[] {
    if (!context?.relevantSkills?.length && !request?.memberCriteria) {
      return [];
    }

    if (context?.relevantSkills?.length > 0) {
      return context.relevantSkills.map((skill: any) => ({
        type: 'skill',
        name: skill.name,
        category: skill.category.toLowerCase(),
        id: skill.id,
        description: skill.description,
        confidence: 0.95,
        metadata: {
          subType: 'required',
          format: 'uuid',
          name: skill.name,
          category: skill.category.toLowerCase(),
          proficiency_level: skill.proficiency_level || request?.criteria?.proficiency_level
        }
      }));
    }

    return [{
      type: 'skill',
      name: request.memberCriteria,
      category: 'language',
      confidence: 0.95,
      metadata: {
        subType: 'required',
        format: 'name',
        proficiency_level: request?.criteria?.proficiency_level || 2
      }
    }];
  }

  private extractTicketEntities(context: any, request: any): any[] {
    if (!context?.ticket && !request?.criteria?.ticketName) {
      return [];
    }

    if (context?.ticket) {
      return [{
        type: 'ticket',
        id: context.ticket.id,
        title: context.ticket.title,
        status: context.ticket.status,
        priority: context.ticket.priority,
        confidence: 0.95,
        metadata: {
          subType: 'reference',
          format: 'uuid'
        }
      }];
    }

    return [{
      type: 'ticket',
      title: request.criteria.ticketName,
      confidence: 0.95,
      metadata: {
        subType: 'reference',
        format: 'name'
      }
    }];
  }

  private extractTeamEntities(context: any): any[] {
    if (!context?.existingTeams?.length) {
      return [];
    }

    return context.existingTeams.map((team: any) => ({
      type: 'team',
      id: team.id,
      name: team.name,
      confidence: 0.95,
      metadata: {
        subType: 'reference',
        format: 'uuid'
      }
    }));
  }

  private extractTeamMemberEntities(context: any): any[] {
    if (!context?.qualifiedAgents?.length) {
      return [];
    }

    return context.qualifiedAgents.map((agent: any) => ({
      type: 'team_member',
      id: agent.id,
      name: agent.full_name,
      confidence: 0.95,
      metadata: {
        subType: 'reference',
        format: 'uuid',
        proficiency_level: agent.proficiency_level,
        current_teams: agent.current_teams
      }
    }));
  }

  private validateAndPackageEntities(entities: Record<string, any[]>): string {
    const output = EntityRecognitionOutputSchema.parse({ entities });
    return JSON.stringify(output);
  }

  async process(input: { request: any; context: any } | string): Promise<string> {
    try {
      const parsedInput = this.parseInput(input);
      const { request, context } = this.extractRequestAndContext(parsedInput);

      const entities: Record<string, any[]> = {
        skill: this.extractSkillEntities(context, request),
        ticket: this.extractTicketEntities(context, request),
        team: this.extractTeamEntities(context),
        team_member: this.extractTeamMemberEntities(context)
      };

      return this.validateAndPackageEntities(entities);
    } catch (error) {
      console.error('Entity recognition failed:', error);
      throw error;
    }
  }
} 
