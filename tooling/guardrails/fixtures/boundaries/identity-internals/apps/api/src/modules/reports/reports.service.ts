import { SessionGuard } from '../identity/http/session.guard.js';
export class ReportsService { guard = new SessionGuard(); }
