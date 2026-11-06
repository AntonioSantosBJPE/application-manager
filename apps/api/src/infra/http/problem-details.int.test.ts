import { Body, Controller, Module, Post, type INestApplication } from '@nestjs/common';
import { z } from 'zod';
import { describe, expect, inject, it } from 'vitest';
import { acceptInvitationRequestSchema } from '@am/contracts';
import { AppModule } from '../../app.module.js';
import { createApp } from '../../create-app.js';
import { zodBody } from './zod-body.pipe.js';

/** Fixtures: the routes this file needs, each one failing in a way Identity has to answer for. */
@Controller('probe')
class ProbeController {
  @Post('validated')
  validated(@Body(zodBody(acceptInvitationRequestSchema)) body: z.output<typeof acceptInvitationRequestSchema>) {
    return { name: body.name };
  }

  @Post('throws')
  throws(): never {
    throw new Error('password=hunter2 is not a valid hash');
  }
}

const env = {
  webPublicUrl: 'http://localhost:3000',
  sessionCookieSecure: false,
  port: 0,
  logLevel: 'info' as const,
};

describe('problem details', () => {
  async function startProbe(databaseUrl: string): Promise<INestApplication> {
    @Module({ imports: [AppModule.forRoot({ ...env, databaseUrl })], controllers: [ProbeController] })
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
});
