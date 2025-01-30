import { ChatOpenAI } from "@langchain/openai";
import { AIMessageChunk, BaseMessage } from "@langchain/core/messages";
import { EnhancedInputProcessor } from "../enhanced-input-processor";

// Mock ChatOpenAI
jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn()
  }))
}));

// Create a mock AIMessageChunk factory
const createMockAIMessage = (content: string): AIMessageChunk => {
  const message = new AIMessageChunk(content);
  // Add required methods
  message.concat = jest.fn().mockReturnValue(message);
  return message;
};

describe('EnhancedInputProcessor', () => {
  let processor: EnhancedInputProcessor;
  let mockChatModel: jest.Mocked<ChatOpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockChatModel = new ChatOpenAI() as jest.Mocked<ChatOpenAI>;
    processor = new EnhancedInputProcessor(mockChatModel);
  });

  describe('Input Processing', () => {
    it('should process valid input with high confidence', async () => {
      const mockResponseContent = {
        command: "update ticket status",
        intent: {
          primary: "update_status",
          confidence: 0.95
        },
        entities: [{
          type: "TicketID",
          value: "TK-123",
          confidence: 0.9
        }, {
          type: "Status",
          value: "in_progress",
          confidence: 0.85
        }],
        context: {
          sessionId: "test-session",
          domain: "ticket"
        },
        validation: {
          isValid: true
        }
      };

      mockChatModel.invoke.mockResolvedValueOnce(createMockAIMessage(JSON.stringify(mockResponseContent)));

      const result = await processor.process("Change ticket TK-123 status to in progress", {
        sessionId: "test-session"
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.validation.isValid).toBe(true);
      expect(parsedResult.intent.confidence).toBeGreaterThan(0.7);
      expect(parsedResult.entities).toHaveLength(2);
    });

    it('should handle low confidence input with suggestions', async () => {
      const mockResponseContent = {
        command: "unclear command",
        intent: {
          primary: "unknown",
          confidence: 0.4
        },
        entities: [{
          type: "Unknown",
          value: "something",
          confidence: 0.3
        }],
        context: {
          sessionId: "test-session"
        },
        validation: {
          isValid: false
        }
      };

      mockChatModel.invoke.mockResolvedValueOnce(createMockAIMessage(JSON.stringify(mockResponseContent)));

      const result = await processor.process("do something with something", {
        sessionId: "test-session"
      });
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.validation.isValid).toBe(false);
      expect(parsedResult.validation.suggestions).toBeDefined();
      expect(parsedResult.validation.errors).toContain('Low confidence in intent classification');
    });

    it('should maintain session history', async () => {
      const mockResponseContent = {
        command: "view ticket",
        intent: {
          primary: "view_ticket",
          confidence: 0.9
        },
        entities: [{
          type: "TicketID",
          value: "TK-123",
          confidence: 0.95
        }],
        context: {
          sessionId: "test-session",
          domain: "ticket",
          previousCommands: ["previous command"]
        },
        validation: {
          isValid: true
        }
      };

      mockChatModel.invoke.mockResolvedValueOnce(createMockAIMessage(JSON.stringify(mockResponseContent)));

      // First command
      await processor.process("previous command", { sessionId: "test-session" });
      
      // Second command
      const result = await processor.process("show me ticket TK-123", {
        sessionId: "test-session"
      });
      
      const parsedResult = JSON.parse(result);
      expect(mockChatModel.invoke).toHaveBeenCalledTimes(2);
      expect(parsedResult.context.previousCommands).toContain("previous command");
    });

    it('should handle invalid JSON response', async () => {
      mockChatModel.invoke.mockResolvedValueOnce(createMockAIMessage("Invalid JSON response"));

      await expect(processor.process("invalid input", {
        sessionId: "test-session"
      })).rejects.toThrow('Failed to process input');
    });

    it('should handle schema validation errors', async () => {
      const mockResponseContent = {
        // Missing required fields
        command: "incomplete command",
        intent: {
          // Missing confidence
          primary: "unknown"
        }
      };

      mockChatModel.invoke.mockResolvedValueOnce(createMockAIMessage(JSON.stringify(mockResponseContent)));

      await expect(processor.process("incomplete input", {
        sessionId: "test-session"
      })).rejects.toThrow();
    });
  });
}); 
