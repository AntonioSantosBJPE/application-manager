import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { loadEnv, type ApiEnv } from './config/env.js';

let env: ApiEnv;
try {
  env = loadEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const app = await NestFactory.create(AppModule.forRoot(env), { bufferLogs: true });
app.useLogger(app.get(Logger));
await app.listen(env.port);
