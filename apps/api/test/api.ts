import { Writable } from 'node:stream';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from '../src/app.module.js';

/** Starts the real AppModule on a random port against `databaseUrl`; logs are discarded. */
export async function startApi(databaseUrl: string) {
  const discard = new Writable({ write: (_chunk, _encoding, done) => done() });
  const app = await NestFactory.create(
    AppModule.forRoot({ databaseUrl, port: 0, logLevel: 'info' }, { logDestination: discard }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  await app.listen(0, '127.0.0.1');
  return { baseUrl: await app.getUrl(), close: () => app.close() };
}
