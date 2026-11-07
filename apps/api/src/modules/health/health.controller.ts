import type { HealthResponse } from '@am/contracts';
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Public } from '../identity/index.js';
import { DatabaseProbe } from './database-probe.js';

/** The part of the platform response this controller touches. */
interface StatusResponse {
  status(code: number): unknown;
}

/** `GET /health` stays reachable without a session: the platform probes it (AUTH-15). */
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly probe: DatabaseProbe) {}

  /** `200 {"status":"ok","db":"up"}` or `503 {"status":"degraded","db":"down"}` (SKEL-03, SKEL-04). */
  @Get()
  async check(@Res({ passthrough: true }) res: StatusResponse): Promise<HealthResponse> {
    if ((await this.probe.check()) === 'up') return { status: 'ok', db: 'up' };
    res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: 'degraded', db: 'down' };
  }
}
