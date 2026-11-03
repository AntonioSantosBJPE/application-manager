import { DatabaseProbe } from '../health/database-probe.js';
export class BillingService { probe = new DatabaseProbe(); }
