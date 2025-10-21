import { describe, it, expect } from 'vitest';
import { 
  validateRequest, 
  createTraceSchema, 
  createEvaluationSchema,
  formatValidationErrors 
} from '@/lib/validation';

describe('Validation', () => {
  describe('createTraceSchema', () => {
    it('should validate correct trace data', () => {
      const data = {
        name: 'Test Trace',
        traceId: 'trace-123',
        organizationId: 1,
        status: 'pending' as const,
      };

      const result = validateRequest(createTraceSchema, data);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Trace');
      }
    });

    it('should reject missing required fields', () => {
      const data = {
        name: 'Test Trace',
        // Missing traceId and organizationId
      };

      const result = validateRequest(createTraceSchema, data);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const data = {
        name: 'Test Trace',
        traceId: 'trace-123',
        organizationId: 1,
        status: 'invalid-status',
      };

      const result = validateRequest(createTraceSchema, data);
      
      expect(result.success).toBe(false);
    });
  });

  describe('createEvaluationSchema', () => {
    it('should validate correct evaluation data', () => {
      const data = {
        name: 'Test Evaluation',
        type: 'unit-testing',
        organizationId: 1,
        createdBy: 'user-123',
      };

      const result = validateRequest(createEvaluationSchema, data);
      
      expect(result.success).toBe(true);
    });

    it('should validate execution settings', () => {
      const data = {
        name: 'Test Evaluation',
        type: 'unit-testing',
        organizationId: 1,
        createdBy: 'user-123',
        executionSettings: {
          timeout: 30,
          batchSize: 10,
        },
      };

      const result = validateRequest(createEvaluationSchema, data);
      
      expect(result.success).toBe(true);
    });

    it('should reject invalid timeout', () => {
      const data = {
        name: 'Test Evaluation',
        type: 'unit-testing',
        organizationId: 1,
        createdBy: 'user-123',
        executionSettings: {
          timeout: 10000, // Too large
        },
      };

      const result = validateRequest(createEvaluationSchema, data);
      
      expect(result.success).toBe(false);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format Zod errors correctly', () => {
      const data = {
        name: '',
        organizationId: -1,
      };

      const result = validateRequest(createTraceSchema, data);
      
      if (!result.success) {
        const formatted = formatValidationErrors(result.errors);
        expect(formatted.message).toBe('Validation failed');
        expect(formatted.fields).toBeDefined();
      }
    });
  });
});

