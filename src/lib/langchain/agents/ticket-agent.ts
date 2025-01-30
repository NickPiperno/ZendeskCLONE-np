import { BaseAgent, ChatModel } from '../types';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { supabase } from '@/services/supabase';

// Define input schema
const ticketAgentInputSchema = z.object({
  operation: z.enum(['ticket_search', 'ticket_create', 'ticket_update']),
  parameters: z.record(z.any()),
  context: z.any().optional()
});

// Define output schema for execution agent
const ticketAgentOutputSchema = z.object({
  operation: z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']),
  table: z.enum(['tickets', 'ticket_comments', 'ticket_assignments', 'ticket_skills']),
  data: z.record(z.any()),
  conditions: z.array(z.record(z.any())),
  responseTemplate: z.object({
    success: z.string(),
    error: z.string()
  }),
  rpcCalls: z.array(z.object({
    function: z.string(),
    params: z.record(z.any())
  })).optional(),
  message: z.string().optional()
});

type TicketAgentInput = z.infer<typeof ticketAgentInputSchema>;
type TicketAgentOutput = z.infer<typeof ticketAgentOutputSchema>;

export class TicketAgent implements BaseAgent {
  name = "Ticket Agent";
  description = "Manages ticket operations and assignments";

  constructor(
    private llm: ChatModel
  ) {}

  async process(input: string | TicketAgentInput): Promise<string> {
    try {
      console.group('🎫 Ticket Agent');
      console.log('Input received:', input);

      // Parse input
      const parsedInput = typeof input === 'string' 
        ? JSON.parse(input) 
        : input;
      const validatedInput = ticketAgentInputSchema.parse(parsedInput);
      console.log('Validated input:', validatedInput);

      // Process based on operation
      let result: TicketAgentOutput;
      switch (validatedInput.operation) {
        case 'ticket_search':
          result = await this.handleSearch(validatedInput);
          break;
        case 'ticket_create':
          result = await this.handleCreate(validatedInput);
          break;
        case 'ticket_update':
          result = await this.handleUpdate(validatedInput);
          break;
        default:
          throw new Error(`Unsupported operation: ${validatedInput.operation}`);
      }

      console.log('Operation result:', result);

      // Validate and return result
      const validatedOutput = ticketAgentOutputSchema.parse(result);
      console.log('Validated output:', validatedOutput);
      console.groupEnd();
      return JSON.stringify(validatedOutput);
    } catch (error) {
      console.error('Ticket agent processing failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  private async handleSearch(input: TicketAgentInput): Promise<TicketAgentOutput> {
    const { parameters } = input;
    return {
      operation: 'SELECT',
      table: 'tickets',
      data: {},
      conditions: [
        ...(parameters.ticketId ? [{ id: parameters.ticketId }] : []),
        ...(parameters.status ? [{ status: parameters.status }] : []),
        ...(parameters.priority ? [{ priority: parameters.priority }] : []),
        ...(parameters.assignedTo ? [{ assigned_to: parameters.assignedTo }] : [])
      ],
      responseTemplate: {
        success: 'Found {count} tickets matching your criteria',
        error: 'No tickets found matching your criteria'
      }
    };
  }

  private async handleCreate(input: TicketAgentInput): Promise<TicketAgentOutput> {
    const { parameters } = input;
    return {
      operation: 'INSERT',
      table: 'tickets',
      data: {
        title: parameters.title,
        description: parameters.description,
        status: parameters.status || 'new',
        priority: parameters.priority || 'medium',
        assigned_to: parameters.assignedTo,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      conditions: [],
      responseTemplate: {
        success: 'Ticket "{title}" created successfully',
        error: 'Failed to create ticket: {error}'
      }
    };
  }

  private async handleUpdate(input: TicketAgentInput): Promise<TicketAgentOutput> {
    console.group('🔄 Handle Update');
    const { parameters } = input;
    console.log('Update parameters:', parameters);
    
    // Validate and normalize ticket ID
    if (!parameters.ticketId || !this.isValidUUID(parameters.ticketId)) {
      // Try to find ticket by title/reference if provided
      if (parameters.ticketTitle || parameters.ticketReference) {
        const searchQuery = parameters.ticketTitle || parameters.ticketReference;
        // Note: This should be replaced with your actual ticket search logic
        const searchResult = await this.findTicketByTitle(searchQuery);
        if (searchResult?.id) {
          parameters.ticketId = searchResult.id;
        } else {
          throw new Error(`Could not find ticket with title/reference: ${searchQuery}`);
        }
      } else {
        throw new Error('Valid ticket identifier (UUID, title, or reference) is required for update');
      }
    }
    
    // Handle skill update
    if (parameters.skillName) {
      return {
        operation: 'UPDATE',
        table: 'ticket_skills',
        data: {
          skill_name: parameters.skillName,
          required_proficiency: parameters.proficiency || 1
        },
        conditions: [{ ticket_id: parameters.ticketId }],
        responseTemplate: {
          success: 'Added {data.skill_name} skill with proficiency {data.proficiency} to ticket',
          error: 'Failed to add skill: {error}'
        }
      };
    }

    // Handle status update
    if (parameters.status) {
      console.log('Processing status update');
      const normalizedStatus = parameters.status.toLowerCase().replace(/\s+/g, '_');
      console.log('Normalized status:', normalizedStatus);
      
      // Check current ticket status
      const { data: currentTicket, error: ticketError } = await supabase
        .from('tickets')
        .select('status, title')
        .eq('id', parameters.ticketId)
        .single();

      console.log('Current ticket:', currentTicket);
      if (ticketError) {
        console.error('Error fetching ticket:', ticketError);
        throw new Error(`Failed to get current ticket status: ${ticketError.message}`);
      }

      // If status hasn't changed, return early with a message
      if (currentTicket && currentTicket.status === normalizedStatus) {
        console.log('Status unchanged, returning early');
        const result: TicketAgentOutput = {
          operation: 'UPDATE' as const,
          table: 'tickets' as const,
          data: { status: normalizedStatus },
          conditions: [{ id: parameters.ticketId }],
          responseTemplate: {
            success: `Ticket "${currentTicket.title}" is already ${normalizedStatus}`,
            error: 'Failed to check ticket status: {error}'
          },
          message: `Ticket "${currentTicket.title}" is already ${normalizedStatus}`
        };
        console.log('No-change result:', result);
        console.groupEnd();
        return result;
      }
      
      console.log('Preparing status update operation');
      const result: TicketAgentOutput = {
        operation: 'UPDATE' as const,
        table: 'tickets' as const,
        data: {
          status: normalizedStatus,
          updated_at: new Date().toISOString()
        },
        conditions: [{ id: parameters.ticketId }],
        responseTemplate: {
          success: 'Updated ticket status to {data.status}',
          error: 'Failed to update status: {error}'
        },
        rpcCalls: [
          {
            function: 'update_ticket_state',
            params: {
              p_ticket_id: parameters.ticketId,
              p_new_state: normalizedStatus,
              p_user_id: parameters.user_id || '00000000-0000-0000-0000-000000000000'
            }
          }
        ]
      };
      console.log('Update result:', result);
      console.groupEnd();
      return result;
    }

    // Handle priority update
    if (parameters.priority) {
      return {
        operation: 'UPDATE',
        table: 'tickets',
        data: {
          priority: parameters.priority,
          updated_at: new Date().toISOString()
        },
        conditions: [{ id: parameters.ticketId }],
        responseTemplate: {
          success: 'Updated ticket priority to {data.priority}',
          error: 'Failed to update priority: {error}'
        }
      };
    }

    // Handle assignment update
    if (parameters.assignedTo) {
      return {
        operation: 'UPDATE',
        table: 'tickets',
        data: {
          assigned_to: parameters.assignedTo,
          updated_at: new Date().toISOString()
        },
        conditions: [{ id: parameters.ticketId }],
        responseTemplate: {
          success: 'Assigned ticket to {data.assigned_to}',
          error: 'Failed to assign ticket: {error}'
        }
      };
    }

    throw new Error('No valid update parameters provided');
  }

  // Helper method to validate UUID
  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  // Helper method to find ticket by title
  private async findTicketByTitle(title: string): Promise<{ id: string } | null> {
    // Use the supabase client to search for tickets
    const { data, error } = await supabase
      .from('tickets')
      .select('id, title')
      .ilike('title', `%${title}%`)
      .limit(1)
      .single();

    if (error || !data) {
      console.error('Error finding ticket by title:', error);
      return null;
    }

    return { id: data.id };
  }

  async findSimilarTickets(query: string): Promise<any[]> {
    // Implementation needed
    throw new Error("Method not implemented");
  }

  async suggestAssignee(ticketDescription: string): Promise<string> {
    // Implementation needed
    throw new Error("Method not implemented");
  }
}

// Export singleton instance
export const ticketAgent = new TicketAgent(new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0
})); 