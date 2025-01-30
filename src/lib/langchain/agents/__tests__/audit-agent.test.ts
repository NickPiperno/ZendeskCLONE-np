import { AuditAgent } from '../audit-agent';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('@supabase/supabase-js');

describe('AuditAgent', () => {
  let agent: AuditAgent;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock Supabase client
    mockSupabase = new SupabaseClient('', '') as jest.Mocked<SupabaseClient>;
    
    // Create agent instance
    agent = new AuditAgent(mockSupabase);
  });

  describe('operation logging', () => {
    it('should log operation with entities', async () => {
      const request = {
        operation: 'create_ticket',
        domain: 'ticket' as const,
        action: 'create' as const,
        userId: 'user123',
        entities: [
          { type: 'TicketID', value: 'TK-123' },
          { type: 'Priority', value: 'high' }
        ]
      };

      // Mock Supabase responses
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user123', role: 'agent' }
            })
          })
        })
      });

      const result = await agent.process(request);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.operationId).toBeDefined();
      expect(parsed.message).toContain('create_ticket');
    });

    it('should log state changes', async () => {
      const request = {
        operation: 'update_status',
        domain: 'ticket' as const,
        action: 'update' as const,
        userId: 'user123',
        entities: [{ type: 'TicketID', value: 'TK-123' }],
        oldState: { status: 'open' },
        newState: { status: 'in_progress' }
      };

      // Mock Supabase responses
      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'user123', role: 'agent' }
            })
          })
        })
      });

      const result = await agent.process(request);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
    });

    it('should handle missing record ID gracefully', async () => {
      const request = {
        operation: 'create_article',
        domain: 'kb' as const,
        action: 'create' as const,
        userId: 'user123'
      };

      await expect(agent.process(request)).rejects.toThrow('Could not determine record ID');
    });
  });

  describe('history retrieval', () => {
    it('should retrieve operation history', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [
                  { operationId: 'op1', domain: 'ticket', operation: 'create' },
                  { operationId: 'op2', domain: 'ticket', operation: 'update' }
                ],
                error: null
              })
            })
          })
        })
      });

      const history = await agent.getOperationHistory({
        domain: 'ticket',
        limit: 2
      });

      expect(history).toHaveLength(2);
      expect(history[0].domain).toBe('ticket');
    });

    it('should retrieve state history', async () => {
      mockSupabase.rpc = jest.fn().mockResolvedValue({
        data: [
          { created_at: '2024-01-01', action_type: 'UPDATE', changes: { status: { old: 'open', new: 'closed' } } }
        ],
        error: null
      });

      const history = await agent.getStateHistory('tickets', 'TK-123');

      expect(history).toHaveLength(1);
      expect(history[0].action_type).toBe('UPDATE');
    });
  });
}); 