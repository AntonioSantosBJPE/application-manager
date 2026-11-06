import { Writable } from 'node:stream';
import { Controller, Get, Header, Logger, Module, type INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { createApp } from '../../create-app.js';
import { Public } from '../../modules/identity/index.js';
import { withoutInvitationToken } from './logging.module.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

/** Collects every line pino writes, as raw text. */
class LogCapture extends Writable {
  lines: string[] = [];
  override _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
    this.lines.push(...chunk.toString().split('\n').filter(Boolean));
    done();
  }
}

/**
 * A route that logs through Nest's Logger, as application code inside a request does. It is public
 * because what this file proves is the log line, not the access rule (AUTH-19).
 */
@Public()
@Controller('log-probe')
class LogProbeController {
  private readonly logger = new Logger(LogProbeController.name);

  @Get()
  handle(): string {
    this.logger.log('handling log probe');
    return 'ok';
  }

  /** Answers with a session cookie, as the login does (AUTH-01). */
  @Get('cookie')
  @Header('set-cookie', 'am_session=session-token-value; Path=/; HttpOnly')
  cookie(): string {
    return 'ok';
  }
}

/** The public invitation route, so the token in its path is logged by a real request (INV-05). */
@Public()
@Controller('invitations')
class InvitationProbeController {
  @Get(':token')
  inspect(): string {
    return 'ok';
  }
}

describe('request logging', () => {
  const capture = new LogCapture();
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    @Module({
      imports: [
        AppModule.forRoot(
          {
            databaseUrl: 'postgres://unused:unused@localhost:1/unused',
            webPublicUrl: 'http://localhost:3000',
            sessionCookieSecure: false,
            port: 0,
            logLevel: 'info',
          },
          { logDestination: capture },
        ),
      ],
      controllers: [LogProbeController, InvitationProbeController],
    })
    class TestModule {}

    app = await createApp(TestModule);
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    capture.lines = [];
  });

  /** Sends one request and waits until both its application line and its completion line are written. */
  async function request(path = '/log-probe', headers: Record<string, string> = {}) {
    const response = await fetch(`${baseUrl}${path}`, { headers });
    expect(response.status).toBe(200);
    await expect.poll(() => capture.lines.some((l) => l.includes('request completed'))).toBe(true);
    return { response, lines: capture.lines.map((l) => JSON.parse(l) as Record<string, unknown>) };
  }

  it('writes json lines with level, time, msg and requestId', async () => {
    const { response, lines } = await request();
    const requestId = response.headers.get('x-request-id');

    expect(lines.map((l) => l.msg)).toEqual(['handling log probe', 'request completed']);
    for (const line of lines) {
      expect(levels).toContain(line.level);
      expect(typeof line.time).toBe('string');
      expect(new Date(line.time as string).toISOString()).toBe(line.time);
      expect(typeof line.msg).toBe('string');
      expect(line.requestId).toBe(requestId);
    }
  });

  it('reuses x-request-id and returns it', async () => {
    for (const sent of ['web-7f3a.req_42', 'a'.repeat(128)]) {
      capture.lines = [];
      const { response, lines } = await request('/log-probe', { 'x-request-id': sent });

      expect(response.headers.get('x-request-id')).toBe(sent);
      expect(lines).toHaveLength(2);
      expect(lines.every((l) => l.requestId === sent)).toBe(true);
    }

    // Also when the body parser rejects the request before any route runs.
    capture.lines = [];
    const sent = 'bad-body.req_7';
    const rejected = await fetch(`${baseUrl}/health`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': sent },
      body: '{bad',
    });
    expect(rejected.status).toBe(400);
    expect(rejected.headers.get('x-request-id')).toBe(sent);
    await expect.poll(() => capture.lines.some((l) => l.includes('request'))).toBe(true);
    const lines = capture.lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.requestId === sent)).toBe(true);
  });

  it('generates an id and returns it when the header is absent', async () => {
    const { response, lines } = await request();
    const requestId = response.headers.get('x-request-id');

    expect(requestId).toMatch(uuid);
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.requestId === requestId)).toBe(true);
  });

  it('replaces a malformed x-request-id with a generated id', async () => {
    for (const malformed of ['a'.repeat(129), 'id with spaces', '<script>', 'id;drop']) {
      capture.lines = [];
      const { response, lines } = await request('/log-probe', { 'x-request-id': malformed });
      const requestId = response.headers.get('x-request-id');

      expect(requestId).toMatch(uuid);
      expect(lines.every((l) => l.requestId === requestId)).toBe(true);
    }
  });

  it('keeps the cookie set-cookie and internal ip out of the json lines', async () => {
    const cookie = 'am_session=session-token-value';
    const internalIp = '203.0.113.42';
    const { lines } = await request('/log-probe/cookie', { cookie, 'x-am-client-ip': internalIp });
    const raw = capture.lines.join('\n');

    expect(raw).not.toContain('session-token-value');
    expect(raw).not.toContain(internalIp);
    expect(raw).not.toContain(cookie);
    for (const line of lines) {
      const req = line.req as { headers: Record<string, unknown> } | undefined;
      expect(req?.headers.cookie).toBe('[redacted]');
      expect(req?.headers['x-am-client-ip']).toBe('[redacted]');
      const res = line.res as { headers: Record<string, unknown> } | undefined;
      expect(res?.headers['set-cookie']).toBe('[redacted]');
    }
  });

  it('replaces the invitation token in the logged url', async () => {
    const token = 'test-invitation-token';
    const { lines } = await request(`/invitations/${token}`);
    const raw = capture.lines.join('\n');

    expect(raw).not.toContain(token);
    for (const line of lines) {
      expect((line.req as { url?: string }).url).toBe('/invitations/[token]');
    }

    // The session routes keep their path; only the token segment is replaced.
    expect(withoutInvitationToken(`/invitations/${token}/accept?x=1`)).toBe('/invitations/[token]/accept?x=1');
    expect(withoutInvitationToken('/health')).toBe('/health');
  });
});
