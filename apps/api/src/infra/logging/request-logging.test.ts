import { Writable } from 'node:stream';
import { Controller, Get, Logger, Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoNestLogger } from 'nestjs-pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';

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

/** A route that logs through Nest's Logger, as application code inside a request does. */
@Controller('log-probe')
class LogProbeController {
  private readonly logger = new Logger(LogProbeController.name);

  @Get()
  handle(): string {
    this.logger.log('handling log probe');
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
          { databaseUrl: 'postgres://unused:unused@localhost:1/unused', port: 0, logLevel: 'info' },
          { logDestination: capture },
        ),
      ],
      controllers: [LogProbeController],
    })
    class TestModule {}

    app = await NestFactory.create(TestModule, { bufferLogs: true });
    app.useLogger(app.get(PinoNestLogger));
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
  async function request(headers: Record<string, string> = {}) {
    const response = await fetch(`${baseUrl}/log-probe`, { headers });
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
      const { response, lines } = await request({ 'x-request-id': sent });

      expect(response.headers.get('x-request-id')).toBe(sent);
      expect(lines).toHaveLength(2);
      expect(lines.every((l) => l.requestId === sent)).toBe(true);
    }
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
      const { response, lines } = await request({ 'x-request-id': malformed });
      const requestId = response.headers.get('x-request-id');

      expect(requestId).toMatch(uuid);
      expect(lines.every((l) => l.requestId === requestId)).toBe(true);
    }
  });
});
