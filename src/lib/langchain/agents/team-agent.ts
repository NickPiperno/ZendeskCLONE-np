import { BaseAgent, ChatModel } from '../types';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { supabase } from '@/services/supabase';

// Define input schema
const teamAgentInputSchema = z.object({
  operation: z.enum(['team_search', 'team_assign', 'team_skill_search']),
  parameters: z.record(z.any()),
  context: z.any().optional()
});

// Define output schema for execution agent
const teamAgentOutputSchema = z.object({
  operation: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
  table: z.enum(['teams', 'team_members', 'team_skills']),
  data: z.record(z.any()),
  conditions: z.array(z.record(z.any())),
  responseTemplate: z.object({
    success: z.string(),
    error: z.string()
  })
});

type TeamAgentInput = z.infer<typeof teamAgentInputSchema>;
type TeamAgentOutput = z.infer<typeof teamAgentOutputSchema>;

export class TeamAgent implements BaseAgent {
  name = "Team Agent";
  description = "Manages team operations and skill matching";

  constructor(
    private llm: ChatModel
  ) {}

  async process(input: string | TeamAgentInput): Promise<string> {
    try {
      // Parse input
      const parsedInput = typeof input === 'string' 
        ? JSON.parse(input) 
        : input;
      const validatedInput = teamAgentInputSchema.parse(parsedInput);

      // Process based on operation
      let result: TeamAgentOutput;
      switch (validatedInput.operation) {
        case 'team_search':
          result = await this.handleSearch(validatedInput);
          break;
        case 'team_assign':
          result = await this.handleAssign(validatedInput);
          break;
        case 'team_skill_search':
          result = await this.handleSkillSearch(validatedInput);
          break;
        default:
          throw new Error(`Unsupported operation: ${validatedInput.operation}`);
      }

      // Validate and return result
      return JSON.stringify(teamAgentOutputSchema.parse(result));
    } catch (error) {
      console.error('Team agent processing failed:', error);
      throw error;
    }
  }

  private async handleSearch(input: TeamAgentInput): Promise<TeamAgentOutput> {
    const { parameters } = input;
    return {
      operation: 'SELECT',
      table: 'teams',
      data: {},
      conditions: [
        ...(parameters.teamId ? [{ id: parameters.teamId }] : []),
        ...(parameters.name ? [{ name: parameters.name }] : [])
      ],
      responseTemplate: {
        success: 'Found {count} teams matching your criteria',
        error: 'No teams found matching your criteria'
      }
    };
  }

  private async handleAssign(input: TeamAgentInput): Promise<TeamAgentOutput> {
    const { parameters } = input;

    // Validate and normalize team ID
    if (!parameters.teamId || !this.isValidUUID(parameters.teamId)) {
      if (parameters.teamName) {
        const searchResult = await this.findTeamByName(parameters.teamName);
        if (searchResult?.id) {
          parameters.teamId = searchResult.id;
        } else {
          throw new Error(`Could not find team with name: ${parameters.teamName}`);
        }
      } else {
        throw new Error('Valid team identifier (UUID or name) is required for assignment');
      }
    }

    // Validate and normalize member ID
    if (!parameters.memberId || !this.isValidUUID(parameters.memberId)) {
      if (parameters.memberName) {
        const searchResult = await this.findMemberByName(parameters.memberName);
        if (searchResult?.id) {
          parameters.memberId = searchResult.id;
        } else {
          throw new Error(`Could not find team member with name: ${parameters.memberName}`);
        }
      } else {
        throw new Error('Valid member identifier (UUID or name) is required for assignment');
      }
    }

    return {
      operation: 'UPDATE',
      table: 'team_members',
      data: {
        team_id: parameters.teamId,
        updated_at: new Date().toISOString()
      },
      conditions: [{ id: parameters.memberId }],
      responseTemplate: {
        success: 'Team member assigned successfully',
        error: 'Failed to assign team member: {error}'
      }
    };
  }

  private async handleSkillSearch(input: TeamAgentInput): Promise<TeamAgentOutput> {
    const { parameters } = input;

    // If team is specified, validate team ID
    if (parameters.teamId && !this.isValidUUID(parameters.teamId)) {
      if (parameters.teamName) {
        const searchResult = await this.findTeamByName(parameters.teamName);
        if (searchResult?.id) {
          parameters.teamId = searchResult.id;
        }
      }
    }

    return {
      operation: 'SELECT',
      table: 'team_members',
      data: {},
      conditions: [
        ...(parameters.teamId ? [{ team_id: parameters.teamId }] : []),
        ...(parameters.skills ? [{ 'skills ?&': parameters.skills }] : [])
      ],
      responseTemplate: {
        success: 'Found {count} team members with required skills',
        error: 'No team members found with the required skills'
      }
    };
  }

  // Helper method to validate UUID
  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  // Helper method to find team by name
  private async findTeamByName(name: string): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();

    if (error || !data) {
      console.error('Error finding team by name:', error);
      return null;
    }

    return { id: data.id };
  }

  // Helper method to find team member by name
  private async findMemberByName(name: string): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('team_members')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();

    if (error || !data) {
      console.error('Error finding team member by name:', error);
      return null;
    }

    return { id: data.id };
  }
}

// Export singleton instance
export const teamAgent = new TeamAgent(new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0
})); 