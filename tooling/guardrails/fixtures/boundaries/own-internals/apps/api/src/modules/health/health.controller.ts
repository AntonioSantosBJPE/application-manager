import { DatabaseProbe } from './database-probe.js';
export class HealthController { probe = new DatabaseProbe(); }
