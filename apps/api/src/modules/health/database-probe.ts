import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../infra/database/database.module.js';
import { databaseTimeoutMs } from '../../infra/database/pool.js';

export type DatabaseState = 'up' | 'down';

/** `SELECT 1` that answers `down` when the database errors or takes longer than the timeout. */
@Injectable()
export class DatabaseProbe {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async check(timeoutMs = databaseTimeoutMs): Promise<DatabaseState> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<DatabaseState>((resolve) => {
      timer = setTimeout(() => resolve('down'), timeoutMs);
    });
    const query = this.db.execute(sql`select 1`).then(
      (): DatabaseState => 'up',
      (): DatabaseState => 'down',
    );
    try {
      return await Promise.race([query, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
