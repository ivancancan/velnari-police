import { Logger as NestLogger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { Logger as TypeOrmLogger, LoggerOptions, QueryRunner } from 'typeorm';

// Custom TypeORM logger that forwards slow queries and query errors to Sentry.
// Falls back to a Nest logger in dev so developers can still see issues in stdout.
//
// Thresholds:
//   - query error: always logged + sent to Sentry
//   - slow query (> SLOW_QUERY_MS): warning + Sentry breadcrumb (not a full event
//     to avoid noise) with captureMessage if > SLOW_QUERY_CRITICAL_MS.
const SLOW_QUERY_MS = 500;            // log threshold
const SLOW_QUERY_CRITICAL_MS = 2_000; // capture to Sentry as warning event

export class SentryTypeOrmLogger implements TypeOrmLogger {
  private readonly logger = new NestLogger('TypeORM');

  constructor(private readonly options: LoggerOptions = 'all') {}

  logQuery(query: string, parameters?: unknown[], _queryRunner?: QueryRunner): void {
    if (this.options === 'all' || (Array.isArray(this.options) && this.options.includes('query'))) {
      this.logger.debug(this.trim(query, parameters));
    }
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    const msg = error instanceof Error ? error.message : error;
    this.logger.error(`Query failed: ${msg}`);
    this.logger.error(`  SQL: ${this.trim(query, parameters)}`);
    Sentry.captureException(error instanceof Error ? error : new Error(msg), {
      tags: { component: 'typeorm' },
      extra: { query: this.trim(query, parameters) },
    });
  }

  logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    if (time < SLOW_QUERY_MS) return;
    const trimmed = this.trim(query, parameters);
    this.logger.warn(`Slow query (${time}ms): ${trimmed}`);

    // Always drop a breadcrumb for context on subsequent errors.
    Sentry.addBreadcrumb({
      category: 'query',
      level: 'warning',
      message: `Slow query ${time}ms`,
      data: { query: trimmed, durationMs: time },
    });

    // Escalate to a Sentry event only for critically slow queries — otherwise
    // normal app traffic floods Sentry with noise.
    if (time >= SLOW_QUERY_CRITICAL_MS) {
      Sentry.captureMessage(`Slow query ${time}ms`, {
        level: 'warning',
        tags: { component: 'typeorm', threshold: 'critical' },
        extra: { query: trimmed, durationMs: time },
      });
    }
  }

  logSchemaBuild(message: string): void {
    this.logger.log(message);
  }

  logMigration(message: string): void {
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    if (level === 'warn') this.logger.warn(String(message));
    else this.logger.log(String(message));
  }

  /** Trim huge queries so Sentry payloads stay bounded. */
  private trim(query: string, parameters?: unknown[]): string {
    const MAX = 1_000;
    const q = query.length > MAX ? `${query.slice(0, MAX)}…` : query;
    if (!parameters || parameters.length === 0) return q;
    try {
      const p = JSON.stringify(parameters);
      return `${q} -- params: ${p.length > 200 ? p.slice(0, 200) + '…' : p}`;
    } catch {
      return q;
    }
  }
}
