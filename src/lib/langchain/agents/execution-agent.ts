import { BaseAgent } from './types';
import { ChatModel } from '../types';
import { PromptTemplate } from "@langchain/core/prompts";
import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { RoutingResult } from './task-router-agent';
import { ticketAgent } from './ticket-agent';

// Define execution request schema
const executionRequestSchema = z.object({
  domain: z.enum(['kb', 'ticket', 'team']),
  operation: z.string(),
  parameters: z.record(z.any()),
  entities: z.array(z.object({
    type: z.string(),
    value: z.string()
  })),
  context: z.any().optional(),
  user: z.object({
    id: z.string(),
    role: z.string()
  }).optional()
});

type ExecutionRequest = z.infer<typeof executionRequestSchema>;

// Define database operation schema
const dbOperationSchema = z.object({
  domain: z.enum(['kb', 'ticket', 'team']),
  operation: z.string(),
  parameters: z.record(z.any()),
  entities: z.array(z.object({
    type: z.string(),
    value: z.string(),
    confidence: z.number()
  })),
  context: z.any().optional()
});

type DBOperation = z.infer<typeof dbOperationSchema>;

// Operation type mapping
const operationTypeMap = {
  'kb_search': 'SELECT',
  'kb_create': 'INSERT',
  'kb_update': 'UPDATE',
  'ticket_search': 'SELECT',
  'ticket_create': 'INSERT',
  'ticket_update': 'UPDATE',
  'team_search': 'SELECT',
  'team_assign': 'UPDATE',
  'team_skill_search': 'SELECT'
} as const;

// Validation rules per domain
const VALIDATION_RULES = {
  kb: {
    view_article: ['must_exist'],
    create_article: ['must_have_title', 'must_have_content', 'must_have_category'],
    update_article: ['must_exist', 'must_have_changes']
  },
  ticket: {
    view_ticket: ['must_exist'],
    create_ticket: ['must_have_title', 'must_have_description', 'valid_priority'],
    update_status: ['must_exist', 'valid_status_transition'],
    update_priority: ['must_exist', 'valid_priority'],
    list_tickets: [] // No strict validation needed as all parameters are optional
  },
  team: {
    view_team: ['must_exist'],
    assign_member: ['must_exist', 'valid_member', 'skill_requirements'],
    find_by_skill: ['valid_skill_name']
  }
} as const;

export class ExecutionAgent implements BaseAgent {
  name = "Execution Agent";
  description = "Executes operations based on routing decisions";

  constructor(
    private llm: ChatModel,
    private supabase: SupabaseClient,
    private auditAgent?: BaseAgent,
    private errorHandler?: BaseAgent
  ) {}

  async process(input: string | RoutingResult): Promise<string> {
    try {
      console.group('⚡ Execution Agent');
      console.log('Input:', input);

      // Parse input if it's a string, otherwise use it directly
      const routingResult = typeof input === 'string' 
        ? JSON.parse(input) as RoutingResult 
        : input;

      console.log('Routing Result:', routingResult);

      // Execute the operation
      const result = await this.executeOperation(routingResult);
      console.log('Operation Result:', result);

      // Format response
      const response = await this.formatResponse(result, routingResult);
      console.log('Formatted Response:', response);

      console.groupEnd();
      return response;
    } catch (error) {
      console.error('Execution failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  private async executeOperation(input: RoutingResult | {
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    data: Record<string, any>,
    conditions: Array<Record<string, any>>,
    responseTemplate: { success: string, error: string }
  }): Promise<any> {
    console.group('Operation Execution');

    try {
      // Handle RoutingResult type input
      if ('parameters' in input && 'domain' in input) {
        const routing = input as RoutingResult;
        console.log('Operation Parameters:', routing.parameters);
        
        const { operation } = routing;
        const { internalOperation, ...params } = routing.parameters;

        // Log the operation being attempted
        console.log('Attempting Operation:', {
          operation,
          internalOperation,
          parameters: params
        });

        let result;
        switch (routing.domain) {
          case 'ticket':
            // Use ticket agent for ticket operations
            const ticketOperation = await ticketAgent.process({
              operation: operation as any,
              parameters: params,
              context: routing.context
            });
            result = await this.executeAgentOperation(JSON.parse(ticketOperation));
            break;
          // ... other domain cases ...
          default:
            throw new Error(`Unsupported domain: ${routing.domain}`);
        }

        console.log('Operation Success:', result);
        console.groupEnd();
        return result;
      }
      
      // Handle direct operation input
      return await this.executeAgentOperation(input);
    } catch (error) {
      console.error('Operation failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  private async executeAgentOperation(operation: {
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    table: string,
    data: Record<string, any>,
    conditions: Array<Record<string, any>>,
    responseTemplate: { success: string, error: string },
    rpcCalls?: Array<{ function: string; params: Record<string, any> }>,
    message?: string
  }): Promise<any> {
    const { operation: op, table, data, conditions } = operation;
    let changes = [];

    console.log('Database Operation:', {
      operation: op,
      table,
      data,
      conditions
    });

    switch (table) {
      case 'tickets':
        switch (op) {
          case 'SELECT':
            // If we have a title but no ID, try to find the ticket by title first
            if (data.title && !data.id) {
              const searchResult = await this.executeRPC('search_tickets', { 
                search_query: data.title 
              });
              if (searchResult.data?.[0]?.id) {
                data.id = searchResult.data[0].id;
              }
            }
            
            if (data.id && this.isValidUUID(data.id)) {
              return await this.executeRPC('get_customer_ticket_timeline', { 
                p_ticket_id: data.id 
              });
            } else {
              return await this.executeRPC('get_customer_ticket_summary', {});
            }

          case 'INSERT':
            const ticketResult = await this.executeRPC('create_ticket', {
              p_title: data.title,
              p_description: data.description,
              p_status: data.status || 'open',
              p_priority: data.priority || 'medium',
              p_user_id: data.user_id
            });
            changes = [{ type: 'INSERT', table, data: ticketResult.data }];
            return { data: ticketResult.data, changes };

          case 'UPDATE':
            if (data.status) {
              // If we have a title but no valid ID in conditions, try to find the ticket
              if (!conditions[0]?.id && data.ticket_id && !this.isValidUUID(data.ticket_id)) {
                console.log('Attempting to find ticket ID by title:', data.ticket_id);
                const searchResult = await this.executeRPC('search_kb_articles', { 
                  search_query: data.ticket_id 
                });
                if (searchResult.data?.[0]?.id) {
                  conditions[0] = { id: searchResult.data[0].id };
                }
              }

              if (!conditions[0]?.id || !this.isValidUUID(conditions[0].id)) {
                throw new Error('Valid ticket UUID is required for status update');
              }

              // If there's a message indicating no change needed, return early
              if (operation.message) {
                console.log('No changes needed:', operation.message);
                return { 
                  data: data, 
                  message: operation.message,
                  changes: [] // Empty changes array to indicate no changes were made
                };
              }

              // Execute any RPC calls defined by the domain agent
              if (operation.rpcCalls) {
                for (const rpcCall of operation.rpcCalls) {
                  await this.executeRPC(rpcCall.function, rpcCall.params);
                }
              }

              // Update the record
              const { data: updateData, error: updateError } = await this.supabase
                .from(table)
                .update(data)
                .eq('id', conditions[0].id);

              if (updateError) throw updateError;

              changes = [{ type: 'UPDATE', table, data: { id: conditions[0].id, ...data } }];
              return { data: updateData || { status: 'updated' }, changes };
            }
            break;
        }
        break;

      case 'ticket_skills':
        switch (op) {
          case 'UPDATE':
            // First get the skill ID from the skill name
            const { data: skillData, error: skillError } = await this.supabase
              .from('skills')
              .select('id')
              .ilike('name', data.skill_name)
              .single();

            if (skillError || !skillData) {
              throw new Error(`Skill "${data.skill_name}" not found`);
            }

            // Add the skill to the ticket
            const { data: ticketSkill, error: addError } = await this.supabase
              .from('ticket_skills')
              .insert({
                ticket_id: conditions[0].ticket_id,
                skill_id: skillData.id,
                required_proficiency: data.required_proficiency
              })
              .select()
              .single();

            if (addError) {
              throw new Error(`Failed to add skill: ${addError.message}`);
            }

            changes = [{
              type: 'INSERT',
              table: 'ticket_skills',
              data: ticketSkill
            }];

            return {
              data: {
                ...ticketSkill,
                skill_name: data.skill_name
              },
              changes
            };
        }
        break;

      case 'kb_articles':
        switch (op) {
          case 'SELECT':
            const { data: articles } = await this.supabase.rpc('search_kb_articles', {
              search_query: data.query || '',
              p_category_id: data.category_id
            });
            return { data: articles, changes: [] };
        }
        break;

      case 'teams':
        switch (op) {
          case 'SELECT':
            if (data.skills) {
              const { data: skills } = await this.supabase.rpc('get_all_user_skills');
              return { data: skills, changes: [] };
            }
            break;
          case 'INSERT':
            const { data: team } = await this.supabase.rpc('create_team', {
              p_name: data.name,
              p_description: data.description,
              p_is_active: true
            });
            changes = [{ type: 'INSERT', table, data: team }];
            return { data: team, changes };
          case 'UPDATE':
            if (data.member_id && conditions[0]?.id) {
              await this.supabase.rpc('add_team_member', {
                p_team_id: conditions[0].id,
                p_user_id: data.member_id,
                p_is_team_lead: data.is_team_lead || false
              });
              changes = [{ type: 'UPDATE', table, data: { team_id: conditions[0].id, member_id: data.member_id } }];
              return { data: { status: 'member_added' }, changes };
            }
            break;
        }
        break;
    }

    throw new Error(`Unsupported operation: ${op} for table: ${table}`);
  }

  private getTableForDomain(domain: string): string {
    const tableMap = {
      kb: 'kb_articles',
      ticket: 'tickets',
      team: 'teams'
    };
    return tableMap[domain as keyof typeof tableMap] || domain;
  }

  private buildConditions(parameters: Record<string, any>): Array<Record<string, any>> {
    const conditions = [];
    // Use ticket_id if available, fallback to id
    if (parameters.ticket_id && this.isValidUUID(parameters.ticket_id)) {
      conditions.push({ id: parameters.ticket_id });
    } else if (parameters.id && this.isValidUUID(parameters.id)) {
      conditions.push({ id: parameters.id });
    }
    if (parameters.status) conditions.push({ status: parameters.status });
    if (parameters.priority) conditions.push({ priority: parameters.priority });
    return conditions;
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private async verifySupabaseConnection(): Promise<boolean> {
    try {
      // Try a simple RPC call to verify connection
      await this.supabase.rpc('get_database_size');
      return true;
    } catch (error) {
      console.error('Supabase connection verification failed:', error);
      return false;
    }
  }

  private async executeRPC(functionName: string, params: Record<string, any>): Promise<any> {
    try {
      // Verify connection before attempting RPC
      const isConnected = await this.verifySupabaseConnection();
      if (!isConnected) {
        throw new Error('Supabase client is not properly connected');
      }

      console.log(`Executing RPC function: ${functionName}`, { params });
      const { data, error } = await this.supabase.rpc(functionName, params);

      if (error) {
        console.error(`RPC function ${functionName} failed:`, error);
        throw error;
      }

      console.log(`RPC function ${functionName} succeeded:`, { data });
      return { data };
    } catch (error) {
      console.error(`RPC function ${functionName} failed with error:`, error);
      throw error;
    }
  }

  private async findTicketByTitle(title: string): Promise<string | null> {
    if (!title) return null;

    try {
      const { data, error } = await this.supabase
        .from('tickets')
        .select('id')
        .ilike('title', title)
        .limit(1)
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('Failed to find ticket by title:', error);
      return null;
    }
  }

  private async formatResponse(result: any, routing: RoutingResult): Promise<string> {
    try {
      // If there's a message in the result and no changes, this indicates a "no change needed" case
      if (result.message && (!result.changes || result.changes.length === 0)) {
        return JSON.stringify({
          status: 'success',
          operation: routing.operation,
          domain: routing.domain,
          data: result.data,
          message: result.message
        });
      }

      // For normal updates
      const response = {
        status: 'success',
        operation: routing.operation,
        domain: routing.domain,
        data: result.data || result,
        message: `Successfully executed ${routing.operation} operation`
      };

      return JSON.stringify(response);
    } catch (error) {
      console.error('Failed to format response:', error);
      throw error;
    }
  }
}

// Note: ExecutionAgent instance should be created with an injected Supabase client 