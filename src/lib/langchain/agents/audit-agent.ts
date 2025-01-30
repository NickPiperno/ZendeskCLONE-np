import { BaseAgent } from './types';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

// Define audit request schema to match the audit logs table
const auditRequestSchema = z.object({
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE', 'SELECT']),
  domain: z.enum(['kb', 'ticket', 'team']),
  changes: z.array(z.object({
    type: z.string(),
    table: z.string(),
    data: z.record(z.any())
  })),
  timestamp: z.string(),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

type AuditRequest = z.infer<typeof auditRequestSchema>;

// Map domain to table names
const domainTableMap = {
  kb: 'kb_articles',
  ticket: 'tickets',
  team: 'teams'
} as const;

export class AuditAgent implements BaseAgent {
  name = "Audit Agent";
  description = "Tracks and logs all system operations and changes";

  constructor(
    private supabase: SupabaseClient,
    private responseAgent?: BaseAgent
  ) {}

  async process(input: string | AuditRequest): Promise<string> {
    try {
      // Parse and validate input
      const request = typeof input === 'string' 
        ? JSON.parse(input) as AuditRequest 
        : input;
      const validatedRequest = auditRequestSchema.parse(request);

      // Extract old and new data from changes
      const change = validatedRequest.changes[0] || null;
      const tableName = change ? change.table : domainTableMap[validatedRequest.domain];
      const recordId = change?.data?.id || null;

      // Get client info from metadata if available
      const clientInfo = validatedRequest.metadata?.clientInfo || {};

      // Create audit log entry
      const { data: auditRecord, error } = await this.supabase
        .from('audit_logs')
        .insert({
          created_at: validatedRequest.timestamp,
          user_id: validatedRequest.userId,
          action_type: validatedRequest.operation,
          table_name: tableName,
          record_id: recordId,
          old_data: change?.type === 'UPDATE' ? change.data.old : null,
          new_data: change?.type === 'UPDATE' ? change.data.new : change?.data,
          user_agent: 'AI'  // Fixed value to indicate AI operation
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create audit log: ${error.message}`);
      }

      const result = {
        auditRecord,
        response: {
          operation: validatedRequest.operation,
          domain: validatedRequest.domain,
          timestamp: validatedRequest.timestamp,
          success: true
        }
      };

      // Forward to response agent if provided
      if (this.responseAgent) {
        await this.responseAgent.process(result);
      }

      return JSON.stringify(result);
    } catch (error) {
      console.error('Audit logging failed:', error);
      throw new Error(`Failed to log operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 
