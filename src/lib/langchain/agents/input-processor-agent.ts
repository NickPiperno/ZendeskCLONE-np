import { BaseAgent } from './types';
import { z } from 'zod';
import { ChatModel } from '../types';

// Define valid actions and targets based on our schema
const ValidActions = z.enum(['create', 'update', 'delete', 'find', 'reassign', 'add', 'remove']);
const ValidTargets = z.enum(['team', 'ticket', 'kb_article', 'skill', 'user', 'schedule']);

// Define a flexible schema that can handle different types of requests
export const ProcessedInputSchema = z.object({
  action: ValidActions,
  target: ValidTargets,
  // Fields that match our database schema
  criteria: z.object({
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    status: z.string().optional(),
    category: z.string().optional(),
    category_id: z.string().uuid().optional(),
    skill_id: z.string().optional(),
    team_id: z.string().optional(),
    user_id: z.string().optional(),
    proficiency_level: z.number().min(1).max(5).optional(),
    is_active: z.boolean().optional(),
    timeframe: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    title: z.string().optional()
  }).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  assignee: z.string().optional(),
  reason: z.string().optional(),
  memberCriteria: z.string().optional()
});

type ProcessedInput = z.infer<typeof ProcessedInputSchema>;

const PROMPT_TEMPLATE = `You are an input processing agent that extracts structured information from user requests.
Your job is to identify the core action, target, and relevant details from the input.

Valid Actions: create, update, delete, find, reassign, add, remove
Valid Targets: team, ticket, kb_article, skill, user, schedule

Database Schema Context:
- Teams have: name, description, is_active
- Tickets have: title, description, status, priority (low/medium/high/urgent), assigned_to
- Skills have: name, description, category (technical/product/language/soft_skill), is_active
- Users have: full_name, role, email, is_active
- User Skills have: proficiency_level (1-5)
- Team Schedules have: day_of_week (0-6), start_time, end_time

User Input: {input}

Instructions:
1. Clean and normalize the input
2. Identify the primary action from valid actions
3. Identify the target from valid targets
4. Extract relevant criteria and details that match our schema
5. Format as a simple, focused JSON object with only the necessary fields
6. For skill requirements, use memberCriteria to specify the skill name
7. When processing skill names:
   - If a skill name is followed by the word "skills" (e.g., "Spanish skills"), remove "skills" and use just the skill name
   - The word "skills" after a skill name is redundant and should be ignored
   - Focus on the actual skill name for matching and identification

Examples:

Input: "Create a ticket about a printer problem and require someone with French language skills level 3"
{
  "action": "create",
  "target": "ticket",
  "description": "printer problem",
  "memberCriteria": "French language",
  "criteria": {
    "proficiency_level": 3
  }
}

Input: "Add a ticket called network issue and need someone with AWS skills proficiency 4"
{
  "action": "create",
  "target": "ticket",
  "name": "network issue",
  "memberCriteria": "AWS",
  "criteria": {
    "proficiency_level": 4
  }
}

Input: "Create a new team called 'Enterprise Support' and add all agents with Spanish skills to it"
{
  "action": "create",
  "target": "team",
  "name": "Enterprise Support",
  "description": "Team for enterprise support with Spanish language skills",
  "memberCriteria": "Spanish",
  "criteria": {
    "skill_id": "spanish_language",
    "is_active": true
  }
}

Input: "Reassign all high-priority printer issues to Sarah since she's our printer specialist"
{
  "action": "reassign",
  "target": "ticket",
  "criteria": {
    "priority": "high",
    "category": "printer",
    "status": "open"
  },
  "assignee": "Sarah",
  "reason": "specialist"
}

Input: "Find all knowledge base articles about AWS that were updated in the last month"
{
  "action": "find",
  "target": "kb_article",
  "criteria": {
    "category": "AWS",
    "timeframe": "last month",
    "metadata": {
      "type": "updated"
    }
  }
}

Input: "Add JavaScript skills to frontend team members with proficiency level 4"
{
  "action": "add",
  "target": "skill",
  "criteria": {
    "skill_id": "javascript",
    "team_id": "frontend",
    "proficiency_level": 4
  }
}

Input: "Add a Spanish skill level 2 to backup strategy review ticket"
{
  "action": "add",
  "target": "skill",
  "memberCriteria": "Spanish",
  "criteria": {
    "proficiency_level": 2,
    "title": "backup strategy review"
  }
}

Input: "Add Python skill proficiency 3 to incident response ticket"
{
  "action": "add",
  "target": "skill",
  "memberCriteria": "Python",
  "criteria": {
    "proficiency_level": 3,
    "title": "incident response"
  }
}

Analyze the input and provide a focused, minimal JSON response with only the necessary fields that match our schema:`;

export class InputProcessorAgent implements BaseAgent {
  name = "Input Processor Agent";
  description = "Processes and normalizes user input into structured actions";

  constructor(
    private llm: ChatModel
  ) {}

  async process(input: string): Promise<string> {
    try {
      const processed = await this.processWithLLM(input);
      return JSON.stringify(processed);
    } catch (error) {
      console.error('Input processing failed:', error);
      throw new Error('Failed to process input');
    }
  }

  private async processWithLLM(input: string): Promise<ProcessedInput> {
    const prompt = PROMPT_TEMPLATE.replace('{input}', input);
    const response = await this.llm.invoke(prompt);
    
    if (!response || typeof response.content !== 'string') {
      throw new Error('Invalid LLM response format');
    }

    try {
      // Clean up common JSON formatting issues
      const sanitizedContent = response.content
        .replace(/```json\s*|\s*```/g, '') // Remove code blocks
        .replace(/^Input:.*$/m, '') // Remove any "Input:" prefix lines
        .replace(/'/g, '"') // Replace single quotes with double quotes
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // Add quotes to unquoted keys
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .trim();

      console.log('Sanitized LLM response:', sanitizedContent);

      let result;
      try {
        result = JSON.parse(sanitizedContent);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        // If parsing fails, try to extract JSON from the response
        const jsonMatch = sanitizedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw parseError;
        }
      }

      // Map 'article' target to 'kb_article' for document operations
      if (result.target === 'article') {
        // Update the target in the result
        result.target = 'kb_article';
        
        // If there are criteria with document_type, update that too
        if (result.criteria?.document_type === 'article') {
          result.criteria.document_type = 'kb_article';
        }
      }

      // Create a default structure for article creation
      if (input.toLowerCase().includes('create') && input.toLowerCase().includes('guide')) {
        result = {
          action: 'create',
          target: 'kb_article',
          description: input,  // Store the full input as description for now
          criteria: {
            category: 'troubleshooting',  // This will be used to look up the category_id
            document_type: 'kb_article',
            metadata: {
              article_type: 'guide',
              target_audience: ['customers'],
              platform: input.toLowerCase().includes('mobile') ? 'mobile' : 'web'
            }
          }
        };
      }

      return ProcessedInputSchema.parse(result);
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      throw new Error('Invalid response structure from LLM');
    }
  }
} 