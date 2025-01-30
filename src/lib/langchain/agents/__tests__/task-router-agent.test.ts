import { TaskRouterAgent } from '../task-router-agent';
import { OpenAI } from '@langchain/openai';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock OpenAI and Supabase
jest.mock('@langchain/openai');
jest.mock('@supabase/supabase-js');

describe('TaskRouterAgent', () => {
  let agent: TaskRouterAgent;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mocks
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>;
    mockSupabase = new SupabaseClient('', '') as jest.Mocked<SupabaseClient>;

    // Create agent instance
    agent = new TaskRouterAgent(mockOpenAI, mockSupabase);
  });

  describe('routeTask', () => {
    it('should route KB article queries correctly', async () => {
      const input = {
        query: 'Show me article KB-123',
        entities: [
          { type: 'ArticleID', value: 'KB-123', confidence: 0.95 }
        ]
      };

      mockOpenAI.invoke = jest.fn().mockResolvedValue({
        domain: 'kb',
        operation: 'view_article',
        confidence: 0.92,
        parameters: {
          articleId: 'KB-123'
        }
      });

      const result = await agent.routeTask(input);

      expect(result.domain).toBe('kb');
      expect(result.operation).toBe('view_article');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.parameters).toHaveProperty('articleId', 'KB-123');
    });

    it('should route ticket operations with correct parameters', async () => {
      const input = {
        query: 'Update ticket TK-456 to high priority',
        entities: [
          { type: 'TicketID', value: 'TK-456', confidence: 0.92 },
          { type: 'Priority', value: 'high', confidence: 0.88 }
        ]
      };

      mockOpenAI.invoke = jest.fn().mockResolvedValue({
        domain: 'ticket',
        operation: 'update_priority',
        confidence: 0.89,
        parameters: {
          ticketId: 'TK-456',
          priority: 'high'
        }
      });

      const result = await agent.routeTask(input);

      expect(result.domain).toBe('ticket');
      expect(result.operation).toBe('update_priority');
      expect(result.parameters).toEqual({
        ticketId: 'TK-456',
        priority: 'high'
      });
    });

    it('should route team queries with skill matching', async () => {
      const input = {
        query: 'Find team members with JavaScript skills',
        entities: [
          { type: 'SkillName', value: 'JavaScript', confidence: 0.96 }
        ]
      };

      mockOpenAI.invoke = jest.fn().mockResolvedValue({
        domain: 'team',
        operation: 'find_by_skill',
        confidence: 0.94,
        parameters: {
          skillName: 'JavaScript'
        }
      });

      const result = await agent.routeTask(input);

      expect(result.domain).toBe('team');
      expect(result.operation).toBe('find_by_skill');
      expect(result.parameters).toHaveProperty('skillName', 'JavaScript');
    });

    it('should reject low confidence routing', async () => {
      const input = {
        query: 'Do something unclear',
        entities: []
      };

      mockOpenAI.invoke = jest.fn().mockResolvedValue({
        domain: 'kb',
        operation: 'unknown',
        confidence: 0.4,
        parameters: {}
      });

      await expect(agent.routeTask(input)).rejects.toThrow('Low confidence in task routing');
    });

    it('should validate operation parameters', async () => {
      const input = {
        query: 'Update ticket status',
        entities: [
          { type: 'Status', value: 'open', confidence: 0.9 }
        ]
      };

      mockOpenAI.invoke = jest.fn().mockResolvedValue({
        domain: 'ticket',
        operation: 'update_status',
        confidence: 0.88,
        parameters: {} // Missing required ticketId
      });

      await expect(agent.routeTask(input)).rejects.toThrow('Missing required parameters');
    });

    it('should handle API errors gracefully', async () => {
      const input = {
        query: 'Test error handling',
        entities: []
      };

      mockOpenAI.invoke = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(agent.routeTask(input)).rejects.toThrow('Failed to route task');
    });
  });
}); 