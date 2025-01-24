/**
 * audit.ts
 * Service for interacting with audit logs.
 */

import { supabase } from './supabase';

interface AuditRecord {
  created_at: string;
  user_email: string;
  action_type: string;
  changes: Record<string, any>;
}

export const AuditService = {
  /**
   * Get audit history for a specific record
   */
  async getRecordHistory(tableName: string, recordId: string): Promise<AuditRecord[]> {
    const { data, error } = await supabase
      .rpc('get_record_history', {
        p_table_name: tableName,
        p_record_id: recordId
      });

    if (error) {
      console.error('Error fetching audit history:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get recent audit logs with pagination
   */
  async getRecentLogs(page = 1, pageSize = 20) {
    const start = (page - 1) * pageSize;
    
    const { data, error, count } = await supabase
      .from('audit_logs')
      .select(`
        *,
        profiles:user_id (
          email
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(start, start + pageSize - 1);

    if (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }

    return {
      logs: data || [],
      total: count || 0,
      page,
      pageSize
    };
  },

  /**
   * Search audit logs with filters
   */
  async searchLogs({
    startDate,
    endDate,
    userId,
    tableName,
    actionType,
    page = 1,
    pageSize = 20
  }: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    tableName?: string;
    actionType?: 'INSERT' | 'UPDATE' | 'DELETE';
    page?: number;
    pageSize?: number;
  }) {
    const start = (page - 1) * pageSize;
    
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        profiles:user_id (
          email
        )
      `, { count: 'exact' });

    // Apply filters
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (tableName) {
      query = query.eq('table_name', tableName);
    }
    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(start, start + pageSize - 1);

    if (error) {
      console.error('Error searching audit logs:', error);
      throw error;
    }

    return {
      logs: data || [],
      total: count || 0,
      page,
      pageSize
    };
  }
}; 