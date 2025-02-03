import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Input } from '@/ui/components/input';
import { ScrollArea } from '@/ui/components/scroll-area';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/AuthContext';
import ReactMarkdown from 'react-markdown';
import { ChangeEvent, FormEvent } from 'react';
import { sendMessage } from '../services/chat.service';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'processing';
  content: string;
  error?: boolean;
  isNew?: boolean;
}

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { profile } = useAuth();

  // Scroll to bottom when new messages arrive
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Only show for agents and admins
  if (!profile || !['agent', 'admin'].includes(profile.role)) {
    return null;
  }

  const addProcessingStep = (step: string) => {
    setMessages(prev => [...prev, { role: 'processing', content: step, isNew: true }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input, isNew: true };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Remove isNew flag after animation
    setTimeout(() => {
      setMessages(prev => 
        prev.map(msg => 
          msg === userMessage ? { ...msg, isNew: false } : msg
        )
      );
    }, 300);

    try {
      const response = await sendMessage(input, (step) => {
        setMessages(prev => [...prev, { role: 'processing', content: step, isNew: true }]);
      });

      // Clear processing messages and add assistant response
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: typeof response === 'string' ? response : response.message.content,
        isNew: true
      };
      setMessages(prev => [...prev.filter(msg => msg.role !== 'processing'), assistantMessage]);
      
      // Remove isNew flag after animation
      setTimeout(() => {
        setMessages(prev => 
          prev.map(msg => 
            msg === assistantMessage ? { ...msg, isNew: false } : msg
          )
        );
      }, 300);
    } catch (error) {
      let errorMessage: string;
      if (error instanceof Error) {
        if (error.message === 'Request timeout') {
          errorMessage = 'Request timeout';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = 'An error occurred while sending the message.';
        }
      } else {
        errorMessage = 'An error occurred while sending the message.';
      }
      
      // Clear processing messages and add error message
      const systemMessage: Message = { role: 'system', content: errorMessage, error: true };
      setMessages(prev => [...prev.filter(msg => msg.role !== 'processing'), systemMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      {/* Toggle Button */}
      <Button
        variant="default"
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:scale-105 active:scale-95"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 
          <X className="h-6 w-6 transition-transform duration-200 transform rotate-0 hover:rotate-90" /> : 
          <MessageCircle className="h-7 w-7 transition-transform duration-200 transform hover:scale-110" />
        }
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="absolute bottom-20 right-0 w-[450px] h-[600px] shadow-2xl flex flex-col bg-background/95 backdrop-blur-sm border-2 rounded-2xl transition-all duration-300 animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-t-xl">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <h3 className="font-semibold text-lg">AI Assistant</h3>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsOpen(false)} 
              className="hover:bg-primary-foreground/10 rounded-full transition-transform duration-200 hover:scale-105"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-4 flex flex-col">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No messages yet. Start a conversation!</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex flex-col rounded-2xl p-4',
                    'transition-all duration-300',
                    'w-fit max-w-[85%]',
                    message.isNew && 'animate-in slide-in-from-bottom-3 fade-in',
                    message.role === 'user'
                      ? 'ml-auto bg-primary text-primary-foreground shadow-md hover:shadow-lg'
                      : message.role === 'processing'
                      ? 'bg-muted/50 text-muted-foreground font-mono text-sm flex items-center gap-2'
                      : message.error
                      ? 'bg-destructive/10 text-destructive shadow hover:shadow-md'
                      : 'bg-muted shadow hover:shadow-md'
                  )}
                >
                  {message.role === 'processing' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{message.content}</span>
                    </>
                  ) : (
                    <ReactMarkdown 
                      className={cn(
                        "prose prose-sm dark:prose-invert",
                        "break-words whitespace-pre-wrap",
                        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                        message.isNew && 'animate-in fade-in duration-300'
                      )}
                      components={{
                        h1: ({ children }) => (
                          <h1 role="heading" aria-level={1} className="text-xl font-bold mt-4 first:mt-0">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 role="heading" aria-level={2} className="text-lg font-semibold mt-3 first:mt-0">
                            {children}
                          </h2>
                        ),
                        code: ({ children }) => (
                          <code className="bg-muted-foreground/20 rounded px-1 break-all">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-muted-foreground/20 rounded p-2 overflow-x-auto max-w-full my-2">
                            {children}
                          </pre>
                        ),
                        p: ({ children }) => (
                          <p className="mt-2 first:mt-0 break-words whitespace-pre-wrap">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside mt-2 first:mt-0 space-y-1">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside mt-2 first:mt-0 space-y-1">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="break-words whitespace-pre-wrap">
                            {children}
                          </li>
                        ),
                        a: ({ href, children }) => (
                          <a 
                            href={href} 
                            className="text-primary hover:underline break-all"
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            {children}
                          </a>
                        )
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                </div>
              ))}
              {isLoading && (
                <div 
                  role="status" 
                  className="flex items-center gap-2 py-2 animate-in slide-in-from-bottom-3 fade-in"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground animate-pulse">
                    Typing...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-6 border-t bg-background/95 backdrop-blur-sm rounded-b-2xl">
            <div className="flex gap-3">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1 shadow-sm focus-visible:ring-primary"
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={isLoading}
                className="shrink-0 rounded-full h-10 w-10 shadow hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
} 