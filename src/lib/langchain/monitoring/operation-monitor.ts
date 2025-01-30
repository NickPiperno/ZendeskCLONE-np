import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";

// Define monitoring schemas
const operationLogSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  domain: z.enum(['kb', 'ticket', 'team', 'system']),
  operation: z.string(),
  user_id: z.string().optional(),
  duration_ms: z.number(),
  status: z.enum(['success', 'failure', 'partial']),
  entities: z.record(z.array(z.object({
    type: z.string(),
    value: z.string()
  }))).optional(),
  metadata: z.record(z.any()).optional(),
  error: z.object({
    code: z.string(),
    message: z.string()
  }).optional()
});

type OperationLog = z.infer<typeof operationLogSchema>;
type OperationDomain = 'kb' | 'ticket' | 'team' | 'system';

export class OperationMonitor {
  private operationStart: Record<string, number> = {};

  constructor(private supabase: SupabaseClient) {}

  // Start tracking an operation
  startOperation(operationId: string): void {
    this.operationStart[operationId] = Date.now();
  }

  // Log a completed operation
  async logOperation(params: {
    operationId: string,
    domain: OperationDomain,
    operation: string,
    status: 'success' | 'failure' | 'partial',
    userId?: string,
    entities?: Record<string, Array<{ type: string, value: string }>>,
    metadata?: Record<string, any>,
    error?: { code: string, message: string }
  }): Promise<void> {
    const startTime = this.operationStart[params.operationId];
    if (!startTime) {
      throw new Error(`No start time found for operation: ${params.operationId}`);
    }

    const duration = Date.now() - startTime;
    delete this.operationStart[params.operationId];

    const operationLog: OperationLog = {
      id: params.operationId,
      timestamp: new Date().toISOString(),
      domain: params.domain,
      operation: params.operation,
      user_id: params.userId,
      duration_ms: duration,
      status: params.status,
      entities: params.entities,
      metadata: params.metadata,
      error: params.error
    };

    // Store operation log
    const { error } = await this.supabase
      .from('operation_logs')
      .insert(operationLog);

    if (error) {
      console.error("Failed to log operation:", error);
      throw error;
    }
  }

  // Get operation metrics
  async getMetrics(params: {
    domain?: 'kb' | 'ticket' | 'team' | 'system',
    operation?: string,
    timeRange?: { start: Date, end: Date },
    userId?: string
  } = {}): Promise<{
    total_operations: number,
    success_rate: number,
    avg_duration: number,
    error_rate: number
  }> {
    let query = this.supabase
      .from('operation_logs')
      .select('*');

    // Apply filters
    if (params.domain) {
      query = query.eq('domain', params.domain);
    }
    if (params.operation) {
      query = query.eq('operation', params.operation);
    }
    if (params.userId) {
      query = query.eq('user_id', params.userId);
    }
    if (params.timeRange) {
      query = query
        .gte('timestamp', params.timeRange.start.toISOString())
        .lte('timestamp', params.timeRange.end.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const operations = data || [];
    const totalOps = operations.length;
    if (totalOps === 0) {
      return {
        total_operations: 0,
        success_rate: 0,
        avg_duration: 0,
        error_rate: 0
      };
    }

    const successfulOps = operations.filter(op => op.status === 'success').length;
    const totalDuration = operations.reduce((sum, op) => sum + op.duration_ms, 0);
    const failedOps = operations.filter(op => op.status === 'failure').length;

    return {
      total_operations: totalOps,
      success_rate: (successfulOps / totalOps) * 100,
      avg_duration: totalDuration / totalOps,
      error_rate: (failedOps / totalOps) * 100
    };
  }

  // Get recent operations
  async getRecentOperations(limit: number = 10): Promise<OperationLog[]> {
    const { data, error } = await this.supabase
      .from('operation_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // Get operation history for an entity
  async getEntityHistory(params: {
    entityType: string,
    entityValue: string,
    limit?: number
  }): Promise<OperationLog[]> {
    const { data, error } = await this.supabase
      .from('operation_logs')
      .select('*')
      .contains('entities', {
        [params.entityType]: [{ value: params.entityValue }]
      })
      .order('timestamp', { ascending: false })
      .limit(params.limit || 10);

    if (error) throw error;
    return data || [];
  }
}

// Export factory function
export const createOperationMonitor = (supabase: SupabaseClient): OperationMonitor => {
  return new OperationMonitor(supabase);
}; 