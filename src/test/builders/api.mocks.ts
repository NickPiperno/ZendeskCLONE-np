import { ChatResponse } from '@/modules/ai/types/chat.types';
import { createAssistantMessage, createErrorMessage } from './message.builder';

export const mockSuccessResponse = (content: string): ChatResponse => ({
  message: createAssistantMessage(content)
});

export const mockErrorResponse = (error: string): ChatResponse => ({
  message: createErrorMessage(error),
  error
});

export const mockStreamingResponse = async function* () {
  yield { content: 'This ' };
  yield { content: 'is ' };
  yield { content: 'a ' };
  yield { content: 'streaming ' };
  yield { content: 'response.' };
};

export const mockNetworkError = (): Promise<ChatResponse> => 
  Promise.reject(new Error('Network error'));

export const mockTimeoutError = (): Promise<ChatResponse> => 
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timeout')), 100)
  );

// Mock API handlers
export const mockApiHandlers = {
  // Success response with delay
  success: (content: string = 'This is a test response') => 
    new Promise<ChatResponse>((resolve) => 
      setTimeout(() => resolve(mockSuccessResponse(content)), 500)
    ),

  // Error response
  error: (error: string = 'An error occurred') =>
    new Promise<ChatResponse>((resolve) => 
      setTimeout(() => resolve(mockErrorResponse(error)), 500)
    ),

  // Streaming response
  streaming: () => mockStreamingResponse(),

  // Network error
  networkError: () => mockNetworkError(),

  // Timeout error
  timeoutError: () => mockTimeoutError()
}; 