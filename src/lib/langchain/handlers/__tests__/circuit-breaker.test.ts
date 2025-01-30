import { CircuitBreaker } from '../circuit-breaker';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnValue({
    insert: jest.fn().mockResolvedValue({ data: null, error: null })
  })
} as unknown as SupabaseClient;

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  
  beforeEach(() => {
    // Create circuit breaker with test configuration
    circuitBreaker = new CircuitBreaker(mockSupabase, {
      maxRequests: 3,        // 3 requests
      timeWindowMs: 1000,    // per second
      timeoutMs: 100,        // 100ms timeout
      resetTimeoutMs: 500,   // 500ms reset timeout
      maxRetries: 2          // 2 retries before opening
    });
    
    jest.clearAllMocks();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const operation = 'test_operation';
      const execute = jest.fn().mockResolvedValue('success');

      // Execute requests within limit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.process({ operation, execute }))
          .resolves.toBe('success');
      }

      expect(execute).toHaveBeenCalledTimes(3);
    });

    it('should reject requests exceeding rate limit', async () => {
      const operation = 'test_operation';
      const execute = jest.fn().mockResolvedValue('success');

      // Execute requests up to limit
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.process({ operation, execute });
      }

      // Next request should fail
      await expect(circuitBreaker.process({ operation, execute }))
        .rejects.toThrow('Rate limit exceeded');
    });

    it('should reset rate limit after time window', async () => {
      const operation = 'test_operation';
      const execute = jest.fn().mockResolvedValue('success');

      // Execute requests up to limit
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.process({ operation, execute });
      }

      // Wait for time window to pass
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should allow new requests
      await expect(circuitBreaker.process({ operation, execute }))
        .resolves.toBe('success');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      const operation = 'slow_operation';
      const execute = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(circuitBreaker.process({ operation, execute }))
        .rejects.toThrow('Operation timed out');
    });

    it('should complete fast operations before timeout', async () => {
      const operation = 'fast_operation';
      const execute = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('success'), 50))
      );

      await expect(circuitBreaker.process({ operation, execute }))
        .resolves.toBe('success');
    });
  });

  describe('Circuit Breaking', () => {
    it('should open circuit after max failures', async () => {
      const operation = 'failing_operation';
      const execute = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const fallback = jest.fn().mockResolvedValue('fallback');

      // Fail up to max retries
      for (let i = 0; i < 2; i++) {
        await expect(circuitBreaker.process({ operation, execute }))
          .rejects.toThrow('Operation failed');
      }

      // Next request should trigger fallback
      await expect(circuitBreaker.process({ operation, execute, fallback }))
        .resolves.toBe('fallback');

      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('should attempt reset after timeout', async () => {
      const operation = 'resetting_operation';
      const execute = jest.fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success');
      
      // Fail twice to open circuit
      for (let i = 0; i < 2; i++) {
        await expect(circuitBreaker.process({ operation, execute }))
          .rejects.toThrow('Failed');
      }

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should attempt operation again
      await expect(circuitBreaker.process({ operation, execute }))
        .resolves.toBe('success');
    });

    it('should use fallback when circuit is open', async () => {
      const operation = 'fallback_operation';
      const execute = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const fallback = jest.fn().mockResolvedValue('fallback_result');

      // Fail enough times to open circuit
      for (let i = 0; i < 2; i++) {
        await expect(circuitBreaker.process({ operation, execute }))
          .rejects.toThrow('Operation failed');
      }

      // Should use fallback for subsequent calls
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.process({ operation, execute, fallback }))
          .resolves.toBe('fallback_result');
      }

      expect(fallback).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Logging', () => {
    it('should log failures to Supabase', async () => {
      const operation = 'logging_operation';
      const execute = jest.fn().mockRejectedValue(new Error('Test error'));

      await expect(circuitBreaker.process({ operation, execute }))
        .rejects.toThrow('Test error');

      expect(mockSupabase.from).toHaveBeenCalledWith('circuit_breaker_logs');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'logging_operation',
        error: 'Test error',
        state: 'CLOSED'
      }));
    });
  });
}); 
