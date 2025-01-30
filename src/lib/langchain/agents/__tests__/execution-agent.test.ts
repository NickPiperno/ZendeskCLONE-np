import { ExecutionAgent } from '../execution-agent';
import { OpenAI } from '@langchain/openai';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock OpenAI and Supabase
jest.mock('@langchain/openai');
jest.mock('@supabase/supabase-js');

describe('ExecutionAgent', () => {
  let agent: ExecutionAgent;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mocks
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>;
    mockSupabase = new SupabaseClient('', '') as jest.Mocked<SupabaseClient>;

    // Create agent instance
    agent = new ExecutionAgent(mockOpenAI, mockSupabase);
  });

  describe('validation', () => {
    it('should validate KB article creation parameters', async () => {
      const request = {
        domain: 'kb',
        operation: 'create_article',
        parameters: {
          title: 'Test Article',
          content: 'Test content',
          category: 'Testing'
        },
        entities: [
          { type: 'CategoryName', value: 'Testing' }
        ]
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: { id: '123' } })
        })
      });

      const result = await agent.process(request);
      expect(JSON.parse(result)).toHaveProperty('id', '123');
    });

    it('should reject KB article creation with missing parameters', async () => {
      const request = {
        domain: 'kb',
        operation: 'create_article',
        parameters: {
          title: 'Test Article'
          // Missing content
        },
        entities: []
      };

      await expect(agent.process(request)).rejects.toThrow('missing required fields');
    });

    it('should validate ticket status transitions', async () => {
      const request = {
        domain: 'ticket',
        operation: 'update_status',
        parameters: {
          ticketId: 'TK-123',
          currentStatus: 'open',
          status: 'in_progress'
        },
        entities: [
          { type: 'TicketID', value: 'TK-123' },
          { type: 'Status', value: 'in_progress' }
        ]
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: { id: 'TK-123' } })
        })
      });

      const result = await agent.process(request);
      expect(JSON.parse(result)).toHaveProperty('id', 'TK-123');
    });

    it('should reject invalid ticket status transitions', async () => {
      const request = {
        domain: 'ticket',
        operation: 'update_status',
        parameters: {
          ticketId: 'TK-123',
          currentStatus: 'open',
          status: 'resolved' // Invalid transition from open
        },
        entities: [
          { type: 'TicketID', value: 'TK-123' },
          { type: 'Status', value: 'resolved' }
        ]
      };

      await expect(agent.process(request)).rejects.toThrow('invalid status transition');
    });
  });

  describe('permissions', () => {
    it('should allow admin to perform all operations', async () => {
      const request = {
        domain: 'kb',
        operation: 'create_article',
        parameters: {
          title: 'Test Article',
          content: 'Test content',
          category: 'Testing'
        },
        entities: [],
        user: {
          id: 'admin1',
          role: 'admin'
        }
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: { id: '123' } })
        })
      });

      const result = await agent.process(request);
      expect(JSON.parse(result)).toHaveProperty('id', '123');
    });

    it('should reject viewer trying to create articles', async () => {
      const request = {
        domain: 'kb',
        operation: 'create_article',
        parameters: {
          title: 'Test Article',
          content: 'Test content'
        },
        entities: [],
        user: {
          id: 'viewer1',
          role: 'viewer'
        }
      };

      await expect(agent.process(request)).rejects.toThrow('Permission denied');
    });
  });

  describe('execution', () => {
    it('should execute KB article view operation', async () => {
      const request = {
        domain: 'kb',
        operation: 'view_article',
        parameters: {
          articleId: 'KB-123'
        },
        entities: [
          { type: 'ArticleID', value: 'KB-123' }
        ]
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'KB-123',
                title: 'Test Article',
                content: 'Test content'
              }
            })
          })
        })
      });

      const result = await agent.process(request);
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('id', 'KB-123');
      expect(parsed).toHaveProperty('title', 'Test Article');
    });

    it('should handle database errors gracefully', async () => {
      const request = {
        domain: 'ticket',
        operation: 'view_ticket',
        parameters: {
          ticketId: 'TK-404'
        },
        entities: [
          { type: 'TicketID', value: 'TK-404' }
        ]
      };

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      });

      await expect(agent.process(request)).rejects.toThrow('Operation execution failed');
    });
  });
}); 