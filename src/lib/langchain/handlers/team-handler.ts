import { z } from "zod";
import { BaseAgent } from "../agents";
import { SupabaseClient } from "@supabase/supabase-js";

// Define Team operation schemas
const skillSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  level: z.enum(['beginner', 'intermediate', 'expert']),
  category: z.string(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
});

const teamMemberSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  team_id: z.string(),
  skills: z.array(skillSchema).optional(),
  availability: z.enum(['available', 'busy', 'away', 'offline']).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
});

const teamSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  lead_id: z.string().optional(),
  required_skills: z.array(z.string()).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
});

type Skill = z.infer<typeof skillSchema>;
type TeamMember = z.infer<typeof teamMemberSchema>;
type Team = z.infer<typeof teamSchema>;

export class TeamHandler implements BaseAgent {
  name = "Team Handler";
  description = "Handles team management and skill matching operations";
  
  constructor(private supabase: SupabaseClient) {}

  async process(input: {
    operation: 'view' | 'assign' | 'update_skills',
    entities: Record<string, any>,
    context?: any
  }): Promise<string> {
    try {
      switch (input.operation) {
        case 'view':
          return await this.viewTeam(input.entities);
        case 'assign':
          return await this.assignMember(input.entities);
        case 'update_skills':
          return await this.updateSkills(input.entities);
        default:
          throw new Error(`Unsupported operation: ${input.operation}`);
      }
    } catch (error) {
      console.error("Team operation failed:", error);
      throw new Error(`Failed to perform team operation: ${input.operation}`);
    }
  }

  private async viewTeam(entities: Record<string, any>): Promise<string> {
    const teamId = entities.team_id?.[0]?.value;
    if (!teamId) {
      throw new Error("Team ID not provided");
    }

    const { data, error } = await this.supabase
      .from('teams')
      .select(`
        *,
        members:team_members (
          id,
          name,
          role,
          skills
        ),
        lead:team_members!lead_id (
          id,
          name,
          role
        )
      `)
      .eq('id', teamId)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Team not found");

    return JSON.stringify(data, null, 2);
  }

  private async assignMember(entities: Record<string, any>): Promise<string> {
    const teamId = entities.team_id?.[0]?.value;
    const memberId = entities.member_id?.[0]?.value;

    if (!teamId || !memberId) {
      throw new Error("Both team ID and member ID are required");
    }

    // First, check if the member has required skills
    const { data: team } = await this.supabase
      .from('teams')
      .select('required_skills')
      .eq('id', teamId)
      .single();

    const { data: member } = await this.supabase
      .from('team_members')
      .select('skills')
      .eq('id', memberId)
      .single();

    if (team?.required_skills && member?.skills) {
      const hasRequiredSkills = this.validateSkillMatch(
        team.required_skills,
        member.skills
      );
      if (!hasRequiredSkills) {
        throw new Error("Member does not have all required skills for this team");
      }
    }

    // Update team assignment
    const { data, error } = await this.supabase
      .from('team_members')
      .update({ 
        team_id: teamId,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)
      .select(`
        *,
        team:teams (
          id,
          name,
          description
        )
      `)
      .single();

    if (error) throw error;
    return JSON.stringify(data, null, 2);
  }

  private async updateSkills(entities: Record<string, any>): Promise<string> {
    const memberId = entities.team_id?.[0]?.value; // Using team_id as it represents member in this context
    const skillName = entities.skill_name?.[0]?.value;

    if (!memberId || !skillName) {
      throw new Error("Both member ID and skill name are required");
    }

    // Get current skills
    const { data: currentData } = await this.supabase
      .from('team_members')
      .select('skills')
      .eq('id', memberId)
      .single();

    // Update skills array
    const currentSkills = currentData?.skills || [];
    const updatedSkills = this.updateSkillsList(currentSkills, skillName);

    // Save updated skills
    const { data, error } = await this.supabase
      .from('team_members')
      .update({ 
        skills: updatedSkills,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;
    return JSON.stringify(data, null, 2);
  }

  // Helper method to validate skill matching
  private validateSkillMatch(requiredSkills: string[], memberSkills: Skill[]): boolean {
    const memberSkillNames = memberSkills.map(skill => skill.name);
    return requiredSkills.every(skill => memberSkillNames.includes(skill));
  }

  // Helper method to update skills list
  private updateSkillsList(currentSkills: Skill[], newSkillName: string): Skill[] {
    const existingSkillIndex = currentSkills.findIndex(
      skill => skill.name === newSkillName
    );

    if (existingSkillIndex >= 0) {
      // Update existing skill
      return currentSkills.map((skill, index) =>
        index === existingSkillIndex
          ? { ...skill, updated_at: new Date().toISOString() }
          : skill
      );
    } else {
      // Add new skill
      return [...currentSkills, {
        name: newSkillName,
        level: 'beginner',
        category: 'general',
        created_at: new Date().toISOString()
      }];
    }
  }
}

// Export factory function
export const createTeamHandler = (supabase: SupabaseClient): TeamHandler => {
  return new TeamHandler(supabase);
}; 
