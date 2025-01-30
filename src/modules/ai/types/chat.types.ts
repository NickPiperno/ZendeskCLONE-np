export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  content: string;
  role: ChatRole;
  timestamp: string;
  isLoading?: boolean;
  error?: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ChatResponse {
  message: ChatMessage;
  error?: string;
} 