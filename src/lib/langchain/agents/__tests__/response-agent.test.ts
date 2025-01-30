import { ResponseAgent } from '../response-agent';
import { SupabaseClient } from '@supabase/supabase-js';
import { chatModel } from '../index';
import { AIMessageChunk } from '@langchain/core/messages';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../index', () => ({
  chatModel: {
    invoke: jest.fn()
  }
}));

describe('ResponseAgent', () => {
  let agent: ResponseAgent;
  let mockSupabase: jest.Mocked<SupabaseClient>;
  const mockChatModel = chatModel as jest.Mocked<typeof chatModel>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = new SupabaseClient('', '') as jest.Mocked<SupabaseClient>;
    agent = new ResponseAgent(mockSupabase);
  });

  describe('success responses', () => {
    it('should format KB article view response', async () => {
      const request = {
        domain: 'kb' as const,
        operation: 'view_article',
        result: {
          title: 'Test Article',
          content: 'This is a test article content.'
        }
      };

      mockChatModel.invoke.mockResolvedValue(new AIMessageChunk({
        content: 'Here is the article "Test Article". This is a test article content.'
      }));

      const response = await agent.process(request);
      expect(response).toContain('Test Article');
      expect(response).toContain('test article content');
    });

    it('should format ticket creation response', async () => {
      const request = {
        domain: 'ticket' as const,
        operation: 'create_ticket',
        result: {
          id: 'TK-123',
          priority: 'high'
        }
      };

      mockChatModel.invoke.mockResolvedValue(new AIMessageChunk({
        content: 'New ticket #TK-123 has been created with high priority.'
      }));

      const response = await agent.process(request);
      expect(response).toContain('TK-123');
      expect(response).toContain('high priority');
    });

    it('should handle unknown operation gracefully', async () => {
      const request = {
        domain: 'kb' as const,
        operation: 'unknown_operation',
        result: { data: 'test' }
      };

      const response = await agent.process(request);
      expect(response).toBe(JSON.stringify({ data: 'test' }, null, 2));
    });
  });

  describe('error responses', () => {
    it('should format not found error', async () => {
      const request = {
        domain: 'kb' as const,
        operation: 'view_article',
        result: {},
        error: {
          code: 'not_found',
          message: 'Article not found',
          details: { articleId: 'KB-123' }
        }
      };

      mockChatModel.invoke.mockResolvedValue(new AIMessageChunk({
        content: 'The requested article could not be found.'
      }));

      const response = await agent.process(request);
      expect(response).toContain('could not be found');
    });

    it('should format permission denied error', async () => {
      const request = {
        domain: 'ticket' as const,
        operation: 'update_status',
        result: {},
        error: {
          code: 'permission_denied',
          message: 'Insufficient permissions',
          details: { requiredRole: 'admin' }
        }
      };

      mockChatModel.invoke.mockResolvedValue(new AIMessageChunk({
        content: 'You do not have permission to update the ticket status.'
      }));

      const response = await agent.process(request);
      expect(response).toContain('do not have permission');
    });

    it('should handle unknown error type', async () => {
      const request = {
        domain: 'team' as const,
        operation: 'assign_member',
        result: {},
        error: {
          code: 'unknown_error',
          message: 'Something went wrong'
        }
      };

      mockChatModel.invoke.mockResolvedValue(new AIMessageChunk({
        content: 'An unexpected error occurred. Please try again or contact support.'
      }));

      const response = await agent.process(request);
      expect(response).toContain('unexpected error occurred');
    });
  });

  describe('operation history', () => {
    it('should retrieve and format operation history', async () => {
      const mockOperations = [
        {
          domain: 'kb',
          operation: 'create_article',
          result: { title: 'New Article' },
          timestamp: '2024-01-01T00:00:00Z'
        },
        {
          domain: 'ticket',
          operation: 'update_status',
          result: { id: 'TK-123', status: 'closed' },
          timestamp: '2024-01-01T00:00:00Z'
        }
      ];

      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: mockOperations })
            })
          })
        })
      });

      const history = await agent.getOperationHistory('user123', 2);
      expect(history).toHaveLength(2);
      expect(history[0]).toContain('Article "New Article"');
      expect(history[1]).toContain('TK-123');
    });

    it('should handle empty operation history', async () => {
      mockSupabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: null })
            })
          })
        })
      });

      const history = await agent.getOperationHistory('user123');
      expect(history).toEqual([]);
    });
  });
}); 