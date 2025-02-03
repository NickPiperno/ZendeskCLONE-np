import { BaseAgent } from './types';
import { ChatModel } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Define core operation types
const DatabaseOperationType = z.enum(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);

// Define database operation schema
const DatabaseOperation = z.object({
  action: DatabaseOperationType,
  table: z.string(),
  data: z.record(z.any()),
  conditions: z.array(z.record(z.any())).optional(),
  batch_operations: z.array(z.object({
    action: DatabaseOperationType,
    table: z.string(),
    data: z.record(z.any()),
    conditions: z.array(z.record(z.any())).optional()
  })).optional()
});

// Define execution result schema
const ExecutionResult = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  message: z.string().optional()
});

type DBOperation = z.infer<typeof DatabaseOperation>;
type ExecResult = z.infer<typeof ExecutionResult>;

export class ExecutionAgent implements BaseAgent {
  name = "Execution Agent";
  description = "Executes database operations and RPC calls";

  constructor(
    private llm: ChatModel,
    private supabase: SupabaseClient
  ) {}

  async process(input: string | DBOperation): Promise<string> {
    try {
      console.group('⚡ Execution Agent');
      console.log('Input:', input);

      // Parse input if it's a string
      const operation = typeof input === 'string' 
        ? JSON.parse(input) as DBOperation
        : input;

      // Validate operation
      const validatedOp = DatabaseOperation.parse(operation);
      
      // Execute the operation
      const result = await this.executeOperation(validatedOp);
      
      // Format and return result
      const response = ExecutionResult.parse({
        success: true,
        data: result.data,
        message: result.message
      });

      console.log('Operation Result:', response);
      console.groupEnd();
      return JSON.stringify(response);
    } catch (error) {
      console.error('Execution failed:', error);
      console.groupEnd();
      throw error;
    }
  }

  private async executeOperation(operation: DBOperation): Promise<ExecResult> {
    const { action, table, data, conditions = [], batch_operations = [] } = operation;

    try {
      // Execute the main database operation
      let mainResult;
      switch (action) {
        case 'SELECT': {
          let query = this.supabase.from(table).select();
          
          // Apply conditions
          for (const condition of conditions) {
            const [field, value] = Object.entries(condition)[0];
            query = query.eq(field, value);
          }
          
          const { data: results, error } = await query;
          if (error) throw error;
          
          mainResult = { 
            success: true,
            data: results,
            message: `Retrieved ${results.length} records from ${table}`
          };
          break;
        }

        case 'INSERT': {
          const { data: insertedData, error } = await this.supabase
            .from(table)
            .insert([data])
            .select();

          if (error) throw error;

          mainResult = {
            success: true,
            data: insertedData,
            message: `Successfully inserted record into ${table}`
          };

          // If this was a ticket creation and we have batch operations for skills
          if (table === 'tickets' && batch_operations.length > 0) {
            console.log('Processing batch operations for ticket skills');
            const ticketId = insertedData[0].id;

            // Process each batch operation (like adding skills)
            for (const batchOp of batch_operations) {
              if (batchOp.table === 'ticket_skills') {
                // Only include the required fields for ticket_skills table
                const skillData = {
                  ticket_id: ticketId,
                  skill_id: batchOp.data.skill_id,
                  required_proficiency: batchOp.data.required_proficiency
                };

                console.log('Adding skill to ticket:', skillData);
                const { error: skillError } = await this.supabase
                  .from(batchOp.table)
                  .insert([skillData]);

                if (skillError) {
                  console.error('Failed to add skill to ticket:', skillError);
                  throw skillError;
                }
              }
            }

            mainResult.message += ' with associated skills';
          }
          break;
        }

        case 'UPDATE': {
          const { data: updatedData, error } = await this.supabase
            .from(table)
            .update(data)
            .match(conditions[0])
            .select();

          if (error) throw error;

          mainResult = {
            success: true,
            data: updatedData,
            message: `Successfully updated record in ${table}`
          };

          // Handle batch operations for ticket updates
          if (table === 'tickets' && batch_operations.length > 0) {
            console.log('Processing batch operations for ticket skills');
            const ticketId = conditions[0].id;

            // Process each batch operation (like adding skills)
            for (const batchOp of batch_operations) {
              if (batchOp.table === 'ticket_skills') {
                // Only include the required fields for ticket_skills table
                const skillData = {
                  ticket_id: ticketId,
                  skill_id: batchOp.data.skill_id,
                  required_proficiency: batchOp.data.required_proficiency
                };

                console.log('Adding skill to ticket:', skillData);
                const { error: skillError } = await this.supabase
                  .from(batchOp.table)
                  .insert([skillData]);

                if (skillError) {
                  console.error('Failed to add skill to ticket:', skillError);
                  throw skillError;
                }
              }
            }

            mainResult.message += ' with associated skills';
          }
          break;
        }

        case 'DELETE': {
          const { error } = await this.supabase
            .from(table)
            .delete()
            .match(conditions[0]);

          if (error) throw error;

          mainResult = {
            success: true,
            message: `Successfully deleted record from ${table}`
          };
          break;
        }

        default:
          throw new Error(`Unsupported operation: ${action}`);
      }

      return mainResult;
    } catch (error) {
      console.error(`Operation failed:`, error);
      throw error;
    }
  }
} 