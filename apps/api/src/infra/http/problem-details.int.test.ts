import { Body, Controller, Inject, Module, Post, type INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import { describe, expect, inject, it } from 'vitest';
import { acceptInvitationRequestSchema } from '@am/contracts';
import { AppModule } from '../../app.module.js';
import { createApp } from '../../create-app.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { createMigratedDatabase, dropDatabase } from '../../../test/database.js';
import { Public } from '../../modules/identity/index.js';
import { zodBody } from './zod-body.pipe.js';

/** Collects every log line pino writes, as raw text. */
class LogCapture extends Writable {
  lines: string[] = [];
  override _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
    this.lines.push(...chunk.toString().split('\n').filter(Boolean));
    done();
  }
  text(): string {
    return this.lines.join('\n');
  }
}

/**
 * Fixtures: the routes this file needs, each one failing in a way Identity has to answer for. They
 * are public because the filter is what this file proves; the access rule is proven elsewhere.
 */
@Public()
@Controller('probe')
class ProbeController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Post('validated')
  validated(@Body(zodBody(acceptInvitationRequestSchema)) body: z.output<typeof acceptInvitationRequestSchema>) {
    return { name: body.name };
  }

  @Post('throws')
  throws(): never {
    throw new Error('password=hunter2 is not a valid hash');
  }

  /**
   * A real unique violation from the driver: the shape an insert that races another one throws. Its
   * message repeats the query and, with it, the parameters the query carried (AUTH-18).
   */
  @Post('conflict')
  async conflict(@Body() body: { email?: string; hash?: string }): Promise<never> {
    const email = body.email ?? 'dup@example.com';
    const hash = body.hash ?? 'argon2-hash-value';
    // The values travel as parameters, which is what the driver's message prints in `params:`.
    await this.db.execute(
      sql`insert into identity.users (email, name, password_hash, role)
          values (${email}, 'Dup', ${hash}, 'member'), (${email}, 'Dup', ${hash}, 'member')`,
    );
    throw new Error('unreachable');
  }
}

const env = {
  webPublicUrl: 'http://localhost:3000',
  sessionCookieSecure: false,
  port: 0,
  logLevel: 'info' as const,
};

describe('problem details', () => {
  /**
   * One destination for every app this file starts: the logging module is global and only the first
   * instantiation in the process decides where the lines go, so a second app would write to stdout.
   */
  const log = new LogCapture();

  async function startProbe(databaseUrl: string): Promise<INestApplication> {
    @Module({
      imports: [AppModule.forRoot({ ...env, databaseUrl }, { logDestination: log })],
      controllers: [ProbeController],
    })
    class ProbeModule {}
    const app = await createApp(ProbeModule);
    await app.listen(0, '127.0.0.1');
    return app;
  }

  it('answers a missing route with a problem body', async () => {
    const app = await startProbe(inject('databaseUrl'));
    try {
      const response = await fetch(`${(await app.getUrl())}/no-such-route`);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      expect(body).toEqual({ type: 'about:blank', title: 'Not Found', status: 404 });
    } finally {
      await app.close();
    }
  });

  it('answers 400 without echoing the password', async () => {
    const app = await startProbe(inject('databaseUrl'));
    const secret = 'hunter2hunter2';
    try {
      const response = await fetch(`${(await app.getUrl())}/probe/validated`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '', password: secret.slice(0, 11) }),
      });
      const text = await response.text();
      const body = JSON.parse(text);

      expect(response.status).toBe(400);
      expect(body).toEqual({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid request body',
        errors: [
          { path: 'name', code: 'too_small' },
          { path: 'password', code: 'too_small' },
        ],
      });
      expect(text).not.toContain(secret.slice(0, 11));
    } finally {
      await app.close();
    }
  });

  it('every identity error uses application/problem+json', async () => {
    const app = await startProbe(inject('databaseUrl'));
    const baseUrl = await app.getUrl();
    try {
      const answers = await Promise.all([
        fetch(`${baseUrl}/no-such-route`),
        fetch(`${baseUrl}/probe/validated`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: '', password: 'short' }),
        }),
        fetch(`${baseUrl}/probe/throws`, { method: 'POST' }),
      ]);

      expect(answers.map((answer) => answer.status)).toEqual([404, 400, 500]);
      for (const answer of answers) {
        expect(answer.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      }
    } finally {
      await app.close();
    }
  });

  it('answers an unexpected error with a generic 500 and keeps the detail in the log', async () => {
    const app = await startProbe(inject('databaseUrl'));
    try {
      const response = await fetch(`${(await app.getUrl())}/probe/throws`, { method: 'POST' });
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      expect(JSON.parse(text)).toEqual({ type: 'about:blank', title: 'Internal Server Error', status: 500 });
      expect(text).not.toContain('hunter2');
    } finally {
      await app.close();
    }
  });

  it('logs a database error without the query parameters', async () => {
    // A database with the identity schema: the route provokes a real unique violation, whose driver
    // message repeats the query and its parameters.
    const database = await createMigratedDatabase(inject('databaseUrl'), 'problem_db');
    log.lines = [];
    const app = await startProbe(database.url);
    const email = 'duplicado@example.com';
    const hash = '$argon2id$v=19$m=19456,t=2,p=1$salt$derived-value';
    try {
      const response = await fetch(`${(await app.getUrl())}/probe/conflict`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, hash }),
      });

      expect(response.status).toBe(500);
      expect(JSON.parse(await response.text())).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
      });
      await expect.poll(() => log.text().includes('unhandled error')).toBe(true);

      const written = log.text();
      // Nothing the query carried reaches the log.
      expect(written).not.toContain(email);
      expect(written).not.toContain(hash);
      expect(written).not.toContain('argon2id');
      expect(written).not.toContain('params:');
      expect(written).not.toContain('Failed query');
      expect(written).not.toContain('insert into');
      // The code of the cause is kept, so the line still says what happened.
      expect(written).toContain('23505');
    } finally {
      await app.close();
      await dropDatabase(inject('databaseUrl'), database);
    }
  });
});
