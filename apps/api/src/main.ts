import 'reflect-metadata';
import { AppModule } from './app.module.js';
import { loadEnv, type ApiEnv } from './config/env.js';
import { createApp } from './create-app.js';

let env: ApiEnv;
try {
  env = loadEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const app = await createApp(AppModule.forRoot(env));
await app.listen(env.port);
