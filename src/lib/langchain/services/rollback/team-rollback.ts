import { SupabaseClient } from "@supabase/supabase-js";
import { RollbackRecord } from "./types";

export class TeamRollbackService {
  constructor(private supabase: SupabaseClient) {}

  async rollback(record: RollbackRecord): Promise<void> {
    // For team operations, we need to handle both team and member updates
    if (record.operation === 'assign_member') {
      const { error } = await this.supabase
        .from('team_members')
        .update({
          team_id: record.previous_state.team_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.previous_state.member_id);

      if (error) throw error;
    } else {
      // For other team operations (update team details, skills, etc.)
      const { error } = await this.supabase
        .from('teams')
        .update({
          ...record.previous_state,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.entity_id);

      if (error) throw error;

      // If skills were updated, restore those as well
      if (record.previous_state.skills) {
        const { error: skillsError } = await this.supabase
          .from('team_skills')
          .upsert({
            team_id: record.entity_id,
            skills: record.previous_state.skills,
            updated_at: new Date().toISOString()
          });

        if (skillsError) throw skillsError;
      }
    }
  }
} 