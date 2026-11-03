import { NestFactory } from '@nestjs/core';
import type { DynamicModule, INestApplication, Type } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

/**
 * Creates the Nest application the way production runs it (main.ts) and the tests start it.
 * Nest's built-in body parser runs before any module middleware, so a malformed body would be
 * rejected before pino-http sees the request: no `x-request-id` back and no log line (LOG-02).
 * It is turned off here and AppModule mounts the parsers after the request logger instead.
 */
export async function createApp(module: DynamicModule | Type): Promise<INestApplication> {
  const app = await NestFactory.create(module, { bufferLogs: true, bodyParser: false });
  app.useLogger(app.get(Logger));
  return app;
}
