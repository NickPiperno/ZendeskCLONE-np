import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { OperationMonitor } from "../monitoring/operation-monitor";

type OperationDomain = 'kb' | 'ticket' | 'team' | 'system';

// Define rollback schemas
const rollbackRecordSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  domain: z.enum(['kb', 'ticket', 'team', 'system']),
  operation: z.string(),
  entity_id: z.string(),
  previous_state: z.record(z.any()),
  current_state: z.record(z.any()),
  status: z.enum(['pending', 'completed', 'failed']),
  error: z.object({
    code: z.string(),
    message: z.string()
  }).optional()
});

type RollbackRecord = z.infer<typeof rollbackRecordSchema>;

export class RollbackService {
  constructor(
    private supabase: SupabaseClient,
    private operationMonitor: OperationMonitor
  ) {}

  // Create a rollback record before performing an operation
  async createRollbackPoint(params: {
    domain: Exclude<OperationDomain, 'system'>,
    operation: string,
    entityId: string,
    currentState: Record<string, any>
  }): Promise<string> {
    const rollbackRecord: Omit<RollbackRecord, 'id'> = {
      timestamp: new Date().toISOString(),
      domain: params.domain,
      operation: params.operation,
      entity_id: params.entityId,
      previous_state: params.currentState,
      current_state: {},
      status: 'pending'
    };

    const { data, error } = await this.supabase
      .from('rollback_records')
      .insert(rollbackRecord)
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  // Update rollback record after operation completion
  async updateRollbackPoint(
    rollbackId: string,
    newState: Record<string, any>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('rollback_records')
      .update({
        current_state: newState,
        status: 'completed'
      })
      .eq('id', rollbackId);

    if (error) throw error;
  }

  // Perform rollback for a specific operation
  async rollback(rollbackId: string): Promise<void> {
    // Start monitoring
    this.operationMonitor.startOperation(`rollback-${rollbackId}`);

    try {
      // Get rollback record
      const { data: record, error } = await this.supabase
        .from('rollback_records')
        .select()
        .eq('id', rollbackId)
        .single();

      if (error) throw error;
      if (!record) throw new Error(`Rollback record not found: ${rollbackId}`);

      // Execute domain-specific rollback
      await this.executeDomainRollback(record);

      // Update rollback record status
      await this.supabase
        .from('rollback_records')
        .update({ status: 'completed' })
        .eq('id', rollbackId);

      // Log successful rollback
      await this.operationMonitor.logOperation({
        operationId: `rollback-${rollbackId}`,
        domain: 'system',
        operation: 'rollback',
        status: 'success',
        entities: {
          target: [{ type: record.domain, value: record.entity_id }]
        },
        metadata: {
          original_operation: record.operation,
          rollback_timestamp: new Date().toISOString()
        }
      });

    } catch (err) {
      // Update rollback record status to failed
      await this.supabase
        .from('rollback_records')
        .update({
          status: 'failed',
          error: {
            code: err instanceof Error ? err.name : 'UNKNOWN_ERROR',
            message: err instanceof Error ? err.message : 'Unknown error occurred'
          }
        })
        .eq('id', rollbackId);

      // Log failed rollback
      await this.operationMonitor.logOperation({
        operationId: `rollback-${rollbackId}`,
        domain: 'system',
        operation: 'rollback',
        status: 'failure',
        error: {
          code: err instanceof Error ? err.name : 'UNKNOWN_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error occurred'
        }
      });

      throw err;
    }
  }

  private async executeDomainRollback(record: RollbackRecord): Promise<void> {
    switch (record.domain) {
      case 'kb':
        await this.rollbackKBOperation(record);
        break;
      case 'ticket':
        await this.rollbackTicketOperation(record);
        break;
      case 'team':
        await this.rollbackTeamOperation(record);
        break;
      default:
        throw new Error(`Unsupported domain: ${record.domain}`);
    }
  }

  private async rollbackKBOperation(record: RollbackRecord): Promise<void> {
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

  private async rollbackTicketOperation(record: RollbackRecord): Promise<void> {
    const { error } = await this.supabase
      .from('tickets')
      .update(record.previous_state)
      .eq('id', record.entity_id);

    if (error) throw error;
  }

  private async rollbackTeamOperation(record: RollbackRecord): Promise<void> {
    // For team operations, we might need to handle both team and member updates
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
      const { error } = await this.supabase
        .from('teams')
        .update(record.previous_state)
        .eq('id', record.entity_id);

      if (error) throw error;
    }
  }

  // Get rollback history for an entity
  async getRollbackHistory(params: {
    domain: Exclude<OperationDomain, 'system'>,
    entityId: string,
    limit?: number
  }): Promise<RollbackRecord[]> {
    const { data, error } = await this.supabase
      .from('rollback_records')
      .select()
      .match({
        domain: params.domain,
        entity_id: params.entityId
      })
      .order('timestamp', { ascending: false })
      .limit(params.limit || 10);

    if (error) throw error;
    return data;
  }
}

// Export factory function
export const createRollbackService = (
  supabase: SupabaseClient,
  operationMonitor: OperationMonitor
): RollbackService => {
  return new RollbackService(supabase, operationMonitor);
}; 