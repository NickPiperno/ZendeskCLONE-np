import { BaseAgent } from './types';
import { z } from 'zod';

// Define the output schema
const ProcessedInputSchema = z.object({
  rawInput: z.string(),
  ticketRefs: z.array(z.string()),
  topic: z.string().optional(),
  requestType: z.string()
});

type ProcessedInput = z.infer<typeof ProcessedInputSchema>;

export class InputProcessorAgent implements BaseAgent {
  name = "Input Processor Agent";
  description = "Processes and normalizes raw user input for RAG processing";

  private ticketRefPatterns = [
    /\#(\d+)/g,                    // #1234
    /ticket[:\s]+(\d+)/gi,         // ticket: 1234 or ticket 1234
    /TK[-\s]?(\d+)/gi,            // TK-1234 or TK1234
  ];

  private requestTypePatterns = {
    ticket_search: [
      /find.*ticket/i,
      /search.*ticket/i,
      /similar.*ticket/i,
      /related.*ticket/i
    ],
    ticket_update: [
      /update.*ticket/i,
      /change.*ticket/i,
      /modify.*ticket/i,
      /set.*ticket/i
    ],
    ticket_create: [
      /create.*ticket/i,
      /new.*ticket/i,
      /open.*ticket/i,
      /make.*ticket/i
    ]
  };

  async process(input: string): Promise<string> {
    try {
      const processed = await this.processInput(input);
      return JSON.stringify(processed);
    } catch (error) {
      console.error('Input processing failed:', error);
      throw new Error('Failed to process input');
    }
  }

  private async processInput(input: string): Promise<ProcessedInput> {
    // Clean and normalize input
    const normalizedInput = this.normalizeText(input);

    // Extract ticket references
    const ticketRefs = this.extractTicketRefs(normalizedInput);

    // Determine request type
    const requestType = this.determineRequestType(normalizedInput);

    // Extract topic (everything after the ticket reference, excluding common words)
    const topic = this.extractTopic(normalizedInput);

    // Construct and validate output
    const processed: ProcessedInput = {
      rawInput: input,
      ticketRefs,
      requestType,
      ...(topic && { topic })
    };

    return ProcessedInputSchema.parse(processed);
  }

  private normalizeText(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private extractTicketRefs(input: string): string[] {
    const refs = new Set<string>();
    
    for (const pattern of this.ticketRefPatterns) {
      const matches = input.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          refs.add(match[1]);
        }
      }
    }

    return Array.from(refs);
  }

  private determineRequestType(input: string): string {
    for (const [type, patterns] of Object.entries(this.requestTypePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return type;
        }
      }
    }
    
    // Default to search if we can't determine the type but have ticket references
    if (this.extractTicketRefs(input).length > 0) {
      return 'ticket_search';
    }
    
    return 'unknown';
  }

  private extractTopic(input: string): string | undefined {
    // Remove ticket references and common words
    let cleaned = input;
    
    // Remove ticket reference patterns
    this.ticketRefPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // Remove common words and request type indicators
    const commonWords = [
      'ticket', 'please', 'can', 'you', 'help', 'me', 'find', 'search',
      'similar', 'to', 'about', 'the', 'a', 'an', 'show', 'get'
    ];
    
    cleaned = cleaned
      .split(' ')
      .filter(word => !commonWords.includes(word.toLowerCase()))
      .join(' ')
      .trim();
    
    return cleaned || undefined;
  }
} 