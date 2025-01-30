import { SupabaseClient } from "@supabase/supabase-js";
import { BaseAgent } from "../agents";

interface CircuitBreakerConfig {
  maxRequests: number;        // Maximum requests allowed in the time window
  timeWindowMs: number;       // Time window in milliseconds
  timeoutMs: number;         // Operation timeout in milliseconds
  resetTimeoutMs: number;    // Time to wait before resetting circuit breaker
  maxRetries: number;        // Maximum number of retries before failing
}

interface OperationStats {
  requests: number;
  failures: number;
  lastFailure: Date | null;
  lastReset: Date;
  isOpen: boolean;
}

type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker implements BaseAgent {
  name = "Circuit Breaker";
  description = "Manages rate limiting, timeouts, and fallback strategies";

  private stats: Map<string, OperationStats> = new Map();
  private state: CircuitBreakerState = 'CLOSED';
  
  constructor(
    private supabase: SupabaseClient,
    private config: CircuitBreakerConfig = {
      maxRequests: 100,      // 100 requests
      timeWindowMs: 60000,   // per minute
      timeoutMs: 5000,       // 5 seconds
      resetTimeoutMs: 30000, // 30 seconds
      maxRetries: 3
    }
  ) {}

  async process(input: {
    operation: string;
    execute: () => Promise<any>;
    fallback?: () => Promise<any>;
  }): Promise<any> {
    // Check circuit state
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        return this.handleFallback(input.fallback);
      }
    }

    // Check rate limit
    if (!this.checkRateLimit(input.operation)) {
      throw new Error('Rate limit exceeded');
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(input.execute);
      
      // If successful in HALF_OPEN state, close the circuit
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.resetStats(input.operation);
      }
      
      return result;
    } catch (error) {
      await this.handleFailure(input.operation, error);
      
      // If in HALF_OPEN state, any failure opens the circuit
      if (this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
      }
      
      // Check if we should open the circuit
      if (this.shouldOpenCircuit(input.operation)) {
        this.state = 'OPEN';
        return this.handleFallback(input.fallback);
      }
      
      throw error;
    }
  }

  private checkRateLimit(operation: string): boolean {
    const stats = this.getStats(operation);
    const now = new Date();
    
    // Reset counter if time window has passed
    if (now.getTime() - stats.lastReset.getTime() > this.config.timeWindowMs) {
      this.resetStats(operation);
      return true;
    }
    
    // Check if under rate limit
    return stats.requests < this.config.maxRequests;
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), this.config.timeoutMs)
      )
    ]) as Promise<T>;
  }

  private async handleFailure(operation: string, error: any): Promise<void> {
    const stats = this.getStats(operation);
    stats.failures++;
    stats.lastFailure = new Date();
    
    // Log the failure
    await this.supabase.from('circuit_breaker_logs').insert({
      operation,
      error: error instanceof Error ? error.message : 'Unknown error',
      state: this.state,
      timestamp: new Date().toISOString()
    });
  }

  private shouldOpenCircuit(operation: string): boolean {
    const stats = this.getStats(operation);
    return stats.failures >= this.config.maxRetries;
  }

  private shouldAttemptReset(): boolean {
    const lastFailure = Array.from(this.stats.values())
      .reduce((latest, stats) => 
        stats.lastFailure && (!latest || stats.lastFailure > latest) 
          ? stats.lastFailure 
          : latest
      , null as Date | null);
    
    return lastFailure 
      ? (new Date().getTime() - lastFailure.getTime()) > this.config.resetTimeoutMs
      : true;
  }

  private async handleFallback(fallback?: () => Promise<any>): Promise<any> {
    if (fallback) {
      return await fallback();
    }
    throw new Error('Circuit breaker is open and no fallback provided');
  }

  private getStats(operation: string): OperationStats {
    if (!this.stats.has(operation)) {
      this.stats.set(operation, {
        requests: 0,
        failures: 0,
        lastFailure: null,
        lastReset: new Date(),
        isOpen: false
      });
    }
    return this.stats.get(operation)!;
  }

  private resetStats(operation: string): void {
    this.stats.set(operation, {
      requests: 0,
      failures: 0,
      lastFailure: null,
      lastReset: new Date(),
      isOpen: false
    });
  }
}

// Export factory function
export const createCircuitBreaker = (
  supabase: SupabaseClient,
  config?: CircuitBreakerConfig
): CircuitBreaker => {
  return new CircuitBreaker(supabase, config);
}; 