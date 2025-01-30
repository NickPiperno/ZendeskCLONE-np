import { EntityRecognitionAgent } from '../entity-recognition-agent';
import { OpenAI } from '@langchain/openai';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock OpenAI and Supabase
jest.mock('@langchain/openai');
jest.mock('@supabase/supabase-js');

describe('EntityRecognitionAgent', () => {
  let agent: EntityRecognitionAgent;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockSupabase: jest.Mocked<SupabaseClient>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mocks
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>;
    mockSupabase = new SupabaseClient('', '') as jest.Mocked<SupabaseClient>;

    // Create agent instance
    agent = new EntityRecognitionAgent(mockOpenAI, mockSupabase);
  });

  describe('recognizeEntities', () => {
    it('should recognize KB article entities', async () => {
      const input = 'Show me article KB-123 about security best practices';
      
      // Mock OpenAI response
      mockOpenAI.invoke = jest.fn().mockResolvedValue({
        entities: [
          {
            type: 'ArticleID',
            value: 'KB-123',
            confidence: 0.95
          }
        ]
      });

      const result = await agent.recognizeEntities(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'ArticleID',
        value: 'KB-123',
        confidence: 0.95
      });
    });

    it('should recognize ticket entities with status and priority', async () => {
      const input = 'Update ticket TK-456 status to high priority';
      
      mockOpenAI.invoke = jest.fn().mockResolvedValue({
        entities: [
          {
            type: 'TicketID',
            value: 'TK-456',
            confidence: 0.92
          },
          {
            type: 'Priority',
            value: 'high',
            confidence: 0.88
          }
        ]
      });

      const result = await agent.recognizeEntities(input);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        type: 'TicketID',
        value: 'TK-456',
        confidence: 0.92
      });
      expect(result).toContainEqual({
        type: 'Priority',
        value: 'high',
        confidence: 0.88
      });
    });

    it('should recognize team entities with skills', async () => {
      const input = 'Find team members with JavaScript skills';
      
      mockOpenAI.invoke = jest.fn().mockResolvedValue({
        entities: [
          {
            type: 'SkillName',
            value: 'JavaScript',
            confidence: 0.96
          }
        ]
      });

      const result = await agent.recognizeEntities(input);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'SkillName',
        value: 'JavaScript',
        confidence: 0.96
      });
    });

    it('should filter out low confidence entities', async () => {
      const input = 'Show me something about tickets';
      
      mockOpenAI.invoke = jest.fn().mockResolvedValue({
        entities: [
          {
            type: 'TicketID',
            value: 'unknown',
            confidence: 0.3 // Below threshold
          }
        ]
      });

      const result = await agent.recognizeEntities(input);

      expect(result).toHaveLength(0);
    });

    it('should handle invalid entity types', async () => {
      const input = 'Process this invalid request';
      
      mockOpenAI.invoke = jest.fn().mockResolvedValue({
        entities: [
          {
            type: 'InvalidType',
            value: 'something',
            confidence: 0.9
          }
        ]
      });

      await expect(agent.recognizeEntities(input)).rejects.toThrow('Invalid entity type');
    });

    it('should handle API errors gracefully', async () => {
      const input = 'Test error handling';
      
      mockOpenAI.invoke = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(agent.recognizeEntities(input)).rejects.toThrow('Failed to recognize entities');
    });
  });
}); 