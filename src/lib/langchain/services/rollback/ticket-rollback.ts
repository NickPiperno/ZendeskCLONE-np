import { SupabaseClient } from "@supabase/supabase-js";
import { RollbackRecord } from "./types";

export class TicketRollbackService {
  constructor(private supabase: SupabaseClient) {}

  async rollback(record: RollbackRecord): Promise<void> {
    // For ticket operations, we need to handle status, assignment, and metadata
    const { error } = await this.supabase
      .from('tickets')
      .update({
        ...record.previous_state,
        updated_at: new Date().toISOString(),
        last_status: record.current_state.status || null
      })
      .eq('id', record.entity_id);

    if (error) throw error;

    // If there was an assignment change, update the assignment history
    if (record.previous_state.assigned_to !== record.current_state.assigned_to) {
      const { error: historyError } = await this.supabase
        .from('ticket_assignment_history')
        .insert({
          ticket_id: record.entity_id,
          assigned_to: record.previous_state.assigned_to,
          assigned_by: 'system',
          assigned_at: new Date().toISOString(),
          reason: 'rollback'
        });

      if (historyError) throw historyError;
    }
  }
} 