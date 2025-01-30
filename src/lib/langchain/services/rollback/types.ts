export type OperationDomain = 'kb' | 'ticket' | 'team' | 'system';

export interface RollbackRecord {
  id: string;
  timestamp: string;
  domain: OperationDomain;
  operation: string;
  entity_id: string;
  previous_state: Record<string, any>;
  current_state: Record<string, any>;
  status: 'pending' | 'completed' | 'failed';
  error?: {
    code: string;
    message: string;
  };
} 