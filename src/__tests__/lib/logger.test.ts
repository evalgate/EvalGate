import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, createModuleLogger } from '@/lib/logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('should log info messages', () => {
    logger.info('Test message');
    
    expect(console.log).toHaveBeenCalled();
    const logOutput = (console.log as any).mock.calls[0][0];
    expect(logOutput).toContain('Test message');
    expect(logOutput).toContain('info');
  });

  it('should log errors with stack traces', () => {
    const error = new Error('Test error');
    logger.error('Error occurred', error);
    
    expect(console.error).toHaveBeenCalled();
    const logOutput = (console.error as any).mock.calls[0][0];
    expect(logOutput).toContain('Error occurred');
    expect(logOutput).toContain('Test error');
  });

  it('should include metadata in logs', () => {
    logger.info('Test with metadata', { userId: '123', action: 'create' });
    
    expect(console.log).toHaveBeenCalled();
    const logOutput = (console.log as any).mock.calls[0][0];
    expect(logOutput).toContain('userId');
    expect(logOutput).toContain('123');
  });

  it('should create child loggers with context', () => {
    const moduleLogger = createModuleLogger('auth');
    moduleLogger.info('Auth event');
    
    expect(console.log).toHaveBeenCalled();
    const logOutput = (console.log as any).mock.calls[0][0];
    expect(logOutput).toContain('auth');
    expect(logOutput).toContain('Auth event');
  });

  it('should log warnings', () => {
    logger.warn('Warning message');
    
    expect(console.warn).toHaveBeenCalled();
    const logOutput = (console.warn as any).mock.calls[0][0];
    expect(logOutput).toContain('Warning message');
  });
});

