import { z } from "zod";
import { BaseAgent } from "../agents";
import { SupabaseClient } from "@supabase/supabase-js";

// Define Ticket operation schemas
const ticketSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigned_to: z.string().optional(),
  created_by: z.string(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  tags: z.array(z.string()).optional()
});

type Ticket = z.infer<typeof ticketSchema>;

export class TicketHandler implements BaseAgent {
  name = "Ticket Handler";
  description = "Handles ticket operations including CRUD and assignments";
  
  constructor(private supabase: SupabaseClient) {}

  async process(input: {
    operation: 'view' | 'create' | 'update' | 'assign',
    entities: Record<string, any>,
    context?: any
  }): Promise<string> {
    try {
      switch (input.operation) {
        case 'view':
          return await this.viewTicket(input.entities);
        case 'create':
          return await this.createTicket(input.entities);
        case 'update':
          return await this.updateTicket(input.entities);
        case 'assign':
          return await this.assignTicket(input.entities);
        default:
          throw new Error(`Unsupported operation: ${input.operation}`);
      }
    } catch (error) {
      console.error("Ticket operation failed:", error);
      throw new Error(`Failed to perform ticket operation: ${input.operation}`);
    }
  }

  private async viewTicket(entities: Record<string, any>): Promise<string> {
    const ticketId = entities.ticket_id?.[0]?.value;
    if (!ticketId) {
      throw new Error("Ticket ID not provided");
    }

    const { data, error } = await this.supabase
      .from('tickets')
      .select(`
        *,
        assigned_to (
          id,
          name,
          team
        )
      `)
      .eq('id', ticketId)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Ticket not found");

    return JSON.stringify(data, null, 2);
  }

  private async createTicket(entities: Record<string, any>): Promise<string> {
    // Extract status and priority if provided
    const status = entities.status?.[0]?.value || 'open';
    const priority = entities.priority?.[0]?.value || 'medium';

    // Prepare ticket data
    const ticketData = {
      ...entities,
      status,
      priority,
      created_at: new Date().toISOString()
    };

    // Validate ticket data
    const validatedData = ticketSchema.parse(ticketData);

    const { data, error } = await this.supabase
      .from('tickets')
      .insert(validatedData)
      .select()
      .single();

    if (error) throw error;
    return JSON.stringify(data, null, 2);
  }

  private async updateTicket(entities: Record<string, any>): Promise<string> {
    const ticketId = entities.ticket_id?.[0]?.value;
    if (!ticketId) {
      throw new Error("Ticket ID not provided for update");
    }

    // Prepare update data
    const updateData = {
      ...entities,
      updated_at: new Date().toISOString()
    };

    // Validate update data
    const validatedData = ticketSchema.partial().parse(updateData);

    const { data, error } = await this.supabase
      .from('tickets')
      .update(validatedData)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return JSON.stringify(data, null, 2);
  }

  private async assignTicket(entities: Record<string, any>): Promise<string> {
    const ticketId = entities.ticket_id?.[0]?.value;
    const assigneeId = entities.team_id?.[0]?.value;

    if (!ticketId || !assigneeId) {
      throw new Error("Both ticket ID and assignee ID are required");
    }

    // Update ticket assignment
    const { data, error } = await this.supabase
      .from('tickets')
      .update({
        assigned_to: assigneeId,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select(`
        *,
        assigned_to (
          id,
          name,
          team
        )
      `)
      .single();

    if (error) throw error;
    return JSON.stringify(data, null, 2);
  }

  // Helper method to validate ticket status
  private validateStatus(status: string): boolean {
    return ['open', 'in_progress', 'pending', 'resolved', 'closed'].includes(status);
  }

  // Helper method to validate ticket priority
  private validatePriority(priority: string): boolean {
    return ['low', 'medium', 'high', 'urgent'].includes(priority);
  }
}

// Export factory function
export const createTicketHandler = (supabase: SupabaseClient): TicketHandler => {
  return new TicketHandler(supabase);
}; 