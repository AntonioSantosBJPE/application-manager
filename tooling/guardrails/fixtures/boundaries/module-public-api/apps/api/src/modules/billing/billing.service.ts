import { DatabaseProbe } from '../health/index.js';
export class BillingService { probe = new DatabaseProbe(); }
