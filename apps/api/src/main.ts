import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv, type ApiEnv } from './config/env.js';

let env: ApiEnv;
try {
  env = loadEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const app = await NestFactory.create(AppModule);
await app.listen(env.port);
