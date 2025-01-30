import { z } from "zod";
import { BaseAgent } from "../agents/types";
import { SupabaseClient } from "@supabase/supabase-js";

// Define error types and schemas
const errorSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  domain: z.enum(['kb', 'ticket', 'team']),
  operation: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional()
  }),
  context: z.record(z.any()).optional(),
  recovery_attempts: z.number().default(0),
  status: z.enum(['new', 'processing', 'recovered', 'failed']).default('new')
});

type ErrorRecord = z.infer<typeof errorSchema>;

// Define recovery strategies per domain and error type
const RECOVERY_STRATEGIES = {
  kb: {
    'not_found': ['reindex', 'recreate'] as const,
    'validation_failed': ['retry_with_defaults', 'notify_admin'] as const,
    'permission_denied': ['escalate_permissions', 'notify_admin'] as const
  },
  ticket: {
    'invalid_status': ['reset_to_previous', 'notify_assignee'] as const,
    'assignment_failed': ['auto_reassign', 'notify_team_lead'] as const,
    'update_conflict': ['merge_changes', 'force_update'] as const
  },
  team: {
    'skill_mismatch': ['suggest_training', 'find_alternative'] as const,
    'capacity_exceeded': ['redistribute_load', 'notify_manager'] as const,
    'invalid_assignment': ['revert_assignment', 'suggest_alternatives'] as const
  }
} as const;

type RecoveryStrategy = typeof RECOVERY_STRATEGIES[keyof typeof RECOVERY_STRATEGIES][keyof typeof RECOVERY_STRATEGIES[keyof typeof RECOVERY_STRATEGIES]][number];

export class ErrorHandler implements BaseAgent {
  name = "Error Handler";
  description = "Handles and attempts recovery for failed operations";
  
  constructor(private supabase: SupabaseClient) {}

  async process(input: {
    error: Error,
    domain: keyof typeof RECOVERY_STRATEGIES,
    operation: string,
    context?: Record<string, any>
  }): Promise<string> {
    try {
      // Create error record
      const errorRecord = await this.createErrorRecord(input);

      // Attempt recovery
      const recoveryResult = await this.attemptRecovery(errorRecord);

      // Update error record with recovery result
      const updatedRecord = await this.updateErrorRecord(
        errorRecord.id,
        recoveryResult
      );

      return JSON.stringify(updatedRecord, null, 2);
    } catch (error) {
      console.error("Error handling failed:", error);
      throw new Error("Failed to handle error and recovery");
    }
  }

  private async createErrorRecord(input: {
    error: Error,
    domain: keyof typeof RECOVERY_STRATEGIES,
    operation: string,
    context?: Record<string, any>
  }): Promise<ErrorRecord> {
    const errorRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      domain: input.domain,
      operation: input.operation,
      error: {
        code: this.categorizeError(input.error),
        message: input.error.message,
        details: input.error
      },
      context: input.context,
      recovery_attempts: 0,
      status: 'new' as const
    };

    // Store error record
    const { data, error } = await this.supabase
      .from('error_logs')
      .insert(errorRecord)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private async attemptRecovery(errorRecord: ErrorRecord): Promise<{
    success: boolean,
    strategy_used?: string,
    result?: any
  }> {
    const errorCode = errorRecord.error.code as keyof typeof RECOVERY_STRATEGIES[typeof errorRecord.domain];
    const domainStrategies = RECOVERY_STRATEGIES[errorRecord.domain];
    const strategies = (domainStrategies[errorCode] ?? []) as string[];

    // Try each recovery strategy in order
    for (const strategy of strategies) {
      try {
        const result = await this.executeRecoveryStrategy(
          strategy,
          errorRecord
        );
        if (result.success) {
          return {
            success: true,
            strategy_used: strategy,
            result: result.data
          };
        }
      } catch (error) {
        console.error(`Recovery strategy ${strategy} failed:`, error);
        continue;
      }
    }

    return { success: false };
  }

  private async updateErrorRecord(
    errorId: string,
    recoveryResult: { success: boolean, strategy_used?: string, result?: any }
  ): Promise<ErrorRecord> {
    const { data: currentRecord } = await this.supabase
      .from('error_logs')
      .select('recovery_attempts')
      .eq('id', errorId)
      .single();

    const updateData = {
      recovery_attempts: (currentRecord?.recovery_attempts || 0) + 1,
      status: recoveryResult.success ? 'recovered' : 'failed',
      last_recovery_attempt: {
        timestamp: new Date().toISOString(),
        strategy: recoveryResult.strategy_used,
        result: recoveryResult.result
      }
    };

    const { data, error } = await this.supabase
      .from('error_logs')
      .update(updateData)
      .eq('id', errorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private categorizeError(error: Error): string {
    // Map common error types to standardized error codes
    if (error.message.includes('not found')) return 'not_found';
    if (error.message.includes('permission')) return 'permission_denied';
    if (error.message.includes('validation')) return 'validation_failed';
    if (error.message.includes('conflict')) return 'update_conflict';
    if (error.message.includes('skill')) return 'skill_mismatch';
    if (error.message.includes('capacity')) return 'capacity_exceeded';
    return 'unknown_error';
  }

  private async executeRecoveryStrategy(
    strategy: string,
    errorRecord: ErrorRecord
  ): Promise<{ success: boolean, data?: any }> {
    switch (strategy) {
      case 'reindex':
        return await this.reindexContent(errorRecord);
      case 'retry_with_defaults':
        return await this.retryWithDefaults(errorRecord);
      case 'reset_to_previous':
        return await this.resetToPreviousState(errorRecord);
      case 'auto_reassign':
        return await this.autoReassign(errorRecord);
      case 'suggest_alternatives':
        return await this.findAlternatives(errorRecord);
      default:
        return { success: false };
    }
  }

  // Recovery strategy implementations
  private async reindexContent(errorRecord: ErrorRecord) {
    // Implementation for reindexing content
    return { success: true, data: { reindexed: true } };
  }

  private async retryWithDefaults(errorRecord: ErrorRecord) {
    // Implementation for retrying with default values
    return { success: true, data: { retried: true } };
  }

  private async resetToPreviousState(errorRecord: ErrorRecord) {
    // Implementation for state reset
    return { success: true, data: { reset: true } };
  }

  private async autoReassign(errorRecord: ErrorRecord) {
    // Implementation for auto reassignment
    return { success: true, data: { reassigned: true } };
  }

  private async findAlternatives(errorRecord: ErrorRecord) {
    // Implementation for finding alternatives
    return { success: true, data: { alternatives: [] } };
  }
}

// Export factory function
export const createErrorHandler = (supabase: SupabaseClient): ErrorHandler => {
  return new ErrorHandler(supabase);
}; 
