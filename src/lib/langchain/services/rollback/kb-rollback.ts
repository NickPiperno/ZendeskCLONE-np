import { SupabaseClient } from "@supabase/supabase-js";
import { RollbackRecord } from "./types";

export class KBRollbackService {
  constructor(private supabase: SupabaseClient) {}

  async rollback(record: RollbackRecord): Promise<void> {
    // For KB operations, we need to handle both article content and metadata
    const { error } = await this.supabase
      .from('kb_articles')
      .update({
        ...record.previous_state,
        updated_at: new Date().toISOString(),
        rollback_from: record.current_state.version || null
      })
      .eq('id', record.entity_id);

    if (error) throw error;

    // If there are any associated tags or categories, restore those as well
    if (record.previous_state.tags || record.previous_state.categories) {
      const { error: relationError } = await this.supabase
        .from('kb_article_relations')
        .upsert({
          article_id: record.entity_id,
          tags: record.previous_state.tags || [],
          categories: record.previous_state.categories || [],
          updated_at: new Date().toISOString()
        });

      if (relationError) throw relationError;
    }
  }
} 