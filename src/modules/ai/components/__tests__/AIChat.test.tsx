/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIChat } from '../AIChat';
import { useAuth } from '@/lib/auth/AuthContext';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import '@testing-library/jest-dom';
import { mockAuthContext } from '@/test/builders/auth.mocks';
import { mockApiHandlers } from '@/test/builders/api.mocks';
import { createUserMessage, createMarkdownResponse } from '@/test/builders/message.builder';

// Mock the auth context
jest.mock('@/lib/auth/AuthContext', () => ({
  useAuth: jest.fn()
}));

// Mock the API service
jest.mock('@/modules/ai/services/chat.service', () => ({
  sendMessage: jest.fn()
}));

describe('AIChat', () => {
  // Setup default mocks
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue(mockAuthContext.authenticated);
  });

  // Reset all mocks after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders chat button for agent users', () => {
    render(<AIChat />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not render for non-agent users', () => {
    (useAuth as jest.Mock).mockReturnValue(mockAuthContext.unauthenticated);
    const { container } = render(<AIChat />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens chat window when button is clicked', async () => {
    render(<AIChat />);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('shows empty state when no messages', async () => {
    render(<AIChat />);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    expect(screen.getByText('No messages yet. Start a conversation!')).toBeInTheDocument();
  });

  it('handles message submission', async () => {
    const testMessage = 'Hello AI';
    const mockResponse = 'This is a test response';
    
    // Mock the API response
    const { sendMessage } = require('@/modules/ai/services/chat.service');
    sendMessage.mockImplementation(() => mockApiHandlers.success(mockResponse));

    render(<AIChat />);
    
    // Open chat window
    const button = screen.getByRole('button');
    await userEvent.click(button);
    
    // Type and submit a message
    const input = screen.getByPlaceholderText('Ask a question...');
    await userEvent.type(input, testMessage);
    const submitButton = screen.getByRole('button', { name: 'Send' });
    await userEvent.click(submitButton);
    
    // Check if user message appears
    const userMessageElement = screen.getByText(testMessage);
    expect(userMessageElement).toBeInTheDocument();
    
    // Wait for AI response
    await waitFor(() => {
      expect(screen.getByText(mockResponse)).toBeInTheDocument();
    });
  });

  it('shows loading state during message submission', async () => {
    // Mock a delayed response
    const { sendMessage } = require('@/modules/ai/services/chat.service');
    sendMessage.mockImplementation(() => mockApiHandlers.success('Response'));

    render(<AIChat />);
    
    // Open chat window
    const button = screen.getByRole('button');
    await userEvent.click(button);
    
    // Submit a message
    const input = screen.getByPlaceholderText('Ask a question...');
    await userEvent.type(input, 'Test message');
    const submitButton = screen.getByRole('button', { name: 'Send' });
    await userEvent.click(submitButton);
    
    // Check for loading state
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays markdown formatting in responses', async () => {
    // Mock markdown response
    const { sendMessage } = require('@/modules/ai/services/chat.service');
    sendMessage.mockImplementation(() => mockApiHandlers.success(createMarkdownResponse().content));

    render(<AIChat />);
    
    // Open chat window
    const button = screen.getByRole('button');
    await userEvent.click(button);
    
    // Submit a message
    const input = screen.getByPlaceholderText('Ask a question...');
    await userEvent.type(input, 'Show markdown');
    const submitButton = screen.getByRole('button', { name: 'Send' });
    await userEvent.click(submitButton);
    
    // Wait for response and check markdown rendering
    await waitFor(() => {
      // Check headings
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      
      // Check text formatting
      const italicText = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'em' && content.includes('italic');
      });
      expect(italicText).toHaveClass('italic');
      
      const boldText = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'strong' && content.includes('bold');
      });
      expect(boldText).toHaveClass('font-bold');
      
      // Check blockquote
      const blockquote = screen.getByText(/This is a blockquote/);
      expect(blockquote.closest('blockquote')).toHaveClass('border-l-4');
      
      // Check nested lists
      const lists = screen.getAllByRole('list');
      expect(lists).toHaveLength(4); // Main list + nested lists + final list
      
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(6); // Total list items
      
      // Verify list nesting
      expect(lists[0]).toHaveClass('ml-0'); // Top level
      expect(lists[1]).toHaveClass('ml-4'); // First nesting
      expect(lists[2]).toHaveClass('ml-8'); // Second nesting
      
      // Check table
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(3); // Header + 2 data rows
      expect(screen.getAllByRole('cell')).toHaveLength(4); // 4 data cells
      
      // Check code
      const inlineCode = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'code' && content.includes('inline code');
      });
      expect(inlineCode).toHaveClass('inline-code');
      
      const codeBlocks = screen.getAllByRole('code');
      const typescriptBlock = codeBlocks.find(block => 
        block.className.includes('language-typescript')
      );
      expect(typescriptBlock).toBeDefined();
      expect(typescriptBlock).toHaveTextContent(/const hello/);
      
      // Check link
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveClass('text-blue-500');
    });
  });

  it('handles network errors gracefully', async () => {
    // Mock network error
    const { sendMessage } = require('@/modules/ai/services/chat.service');
    sendMessage.mockImplementation(() => mockApiHandlers.networkError());

    render(<AIChat />);
    
    // Open chat window and submit message
    const button = screen.getByRole('button');
    await userEvent.click(button);
    const input = screen.getByPlaceholderText('Ask a question...');
    await userEvent.type(input, 'Test message');
    const submitButton = screen.getByRole('button', { name: 'Send' });
    await userEvent.click(submitButton);
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('handles timeout errors gracefully', async () => {
    // Mock timeout error
    const { sendMessage } = require('@/modules/ai/services/chat.service');
    sendMessage.mockImplementation(() => mockApiHandlers.timeoutError());

    render(<AIChat />);
    
    // Open chat window and submit message
    const button = screen.getByRole('button');
    await userEvent.click(button);
    const input = screen.getByPlaceholderText('Ask a question...');
    await userEvent.type(input, 'Test message');
    const submitButton = screen.getByRole('button', { name: 'Send' });
    await userEvent.click(submitButton);
    
    // Wait for loading state to disappear
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    
    // Check for timeout error message
    await waitFor(() => {
      expect(screen.getByText(/Request timeout/)).toBeInTheDocument();
    });
  });
}); 