import { SupabaseClient } from "@supabase/supabase-js";
import { OperationMonitor } from "../../monitoring/operation-monitor";
import { KBRollbackService } from "./kb-rollback";
import { TicketRollbackService } from "./ticket-rollback";
import { TeamRollbackService } from "./team-rollback";
import { RollbackRecord } from "./types";

export class RollbackService {
  private kbRollback: KBRollbackService;
  private ticketRollback: TicketRollbackService;
  private teamRollback: TeamRollbackService;

  constructor(
    private supabase: SupabaseClient,
    private operationMonitor: OperationMonitor
  ) {
    this.kbRollback = new KBRollbackService(supabase);
    this.ticketRollback = new TicketRollbackService(supabase);
    this.teamRollback = new TeamRollbackService(supabase);
  }

  // Create a rollback record before performing an operation
  async createRollbackPoint(params: {
    domain: 'kb' | 'ticket' | 'team',
    operation: string,
    entityId: string,
    currentState: Record<string, any>
  }): Promise<string> {
    const rollbackRecord = {
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
        await this.kbRollback.rollback(record);
        break;
      case 'ticket':
        await this.ticketRollback.rollback(record);
        break;
      case 'team':
        await this.teamRollback.rollback(record);
        break;
      default:
        throw new Error(`Unsupported domain: ${record.domain}`);
    }
  }

  // Get rollback history for an entity
  async getRollbackHistory(params: {
    domain: 'kb' | 'ticket' | 'team',
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