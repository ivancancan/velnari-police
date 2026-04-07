import { AuditInterceptor } from './audit.interceptor';
import { of } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { DataSource } from 'typeorm';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  const mockRepository = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({}),
  };
  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue(mockRepository),
  };

  beforeEach(() => {
    interceptor = new AuditInterceptor(mockDataSource as unknown as DataSource);
    jest.clearAllMocks();
    mockDataSource.getRepository.mockReturnValue(mockRepository);
    mockRepository.create.mockReturnValue({});
    mockRepository.save.mockResolvedValue({});
  });

  const mockContext = (method: string, userId?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          url: '/api/incidents',
          ip: '127.0.0.1',
          user: userId ? { sub: userId } : undefined,
        }),
      }),
      getHandler: jest.fn().mockReturnValue({ name: 'create' }),
      getClass: jest.fn().mockReturnValue({ name: 'IncidentsController' }),
    }) as unknown as ExecutionContext;

  const mockHandler: CallHandler = {
    handle: () => of({ id: 'new-uuid' }),
  };

  it('no registra auditoria para metodos GET', (done) => {
    const ctx = mockContext('GET');
    interceptor.intercept(ctx, mockHandler).subscribe({
      complete: () => {
        expect(mockRepository.save).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('registra auditoria para metodos POST con usuario autenticado', (done) => {
    const ctx = mockContext('POST', 'user-uuid-1');
    interceptor.intercept(ctx, mockHandler).subscribe({
      complete: () => {
        // save is fire-and-forget, wait a tick
        setImmediate(() => {
          expect(mockRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
              action: 'create',
              actorId: 'user-uuid-1',
            }),
          );
          done();
        });
      },
    });
  });

  it('no registra auditoria si no hay usuario autenticado', (done) => {
    const ctx = mockContext('POST', undefined);
    interceptor.intercept(ctx, mockHandler).subscribe({
      complete: () => {
        setImmediate(() => {
          expect(mockRepository.save).not.toHaveBeenCalled();
          done();
        });
      },
    });
  });
});
