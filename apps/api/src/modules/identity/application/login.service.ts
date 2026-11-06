import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_MAX_LENGTH, type Role } from '@am/contracts';
import { CLOCK, type Clock } from '../../../infra/clock/clock.js';
import { normalizeEmail } from '../domain/credentials.js';
import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher.js';
import { SessionService, type CreatedSession } from './session.service.js';
import { LoginAttemptsRepository } from '../infra/login-attempts.repository.js';
import { UsersRepository } from '../infra/users.repository.js';

/** Which entrance answered: a member enters at `/auth/login`, an admin at `/auth/admin/login` (AD-005). */
export interface LoginInput {
  email: string;
  password: string;
  ip: string;
  entrance: Role;
}

/** What a login answers: a session, one refusal the caller cannot tell apart, or a wait. */
export type LoginResult =
  | { kind: 'session'; session: CreatedSession }
  | { kind: 'refused' }
  | { kind: 'blocked'; retryAfterSeconds: number };

/**
 * The single login rule (AUTH-01..AUTH-04, LOCK-01..LOCK-08). Every way a credential can be refused
 * ends the same: `refused`, which the controller answers as one `401`. The entrance is a role, so a
 * valid credential used on the other entrance is refused like a wrong password and reveals no role.
 */
@Injectable()
export class LoginService {
  constructor(
    private readonly users: UsersRepository,
    private readonly attempts: LoginAttemptsRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * A session for valid credentials of the entrance, a refusal, or the lockout wait.
   *
   * The attempt is counted before any password work: a reservation is written inside the transaction
   * that counts the windows, so a burst cannot slip more than the limit past it, and a blocked
   * attempt does no hashing and leaves no new row (LOCK-05).
   *
   * The verifier then runs once on every counted attempt, against the real hash or the dummy one, so
   * an unknown email costs the same work as a wrong password (AUTH-04). A password past the maximum
   * is refused without hashing (EDGE-03); it was already counted as a failure, like a wrong one.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const email = normalizeEmail(input.email);
    const now = this.clock.now();
    const reservation = await this.attempts.reserveFailure({ email, ip: input.ip, now });
    if (!reservation.allowed) return { kind: 'blocked', retryAfterSeconds: reservation.retryAfterSeconds };

    const user = await this.users.findByEmail(email);
    const verified =
      input.password.length > PASSWORD_MAX_LENGTH
        ? false
        : user === undefined
          ? await this.hasher.verifyDummy(input.password)
          : await this.hasher.verify(user.passwordHash, input.password);
    // A wrong password, an unknown email and the other entrance all leave the reserved failure behind.
    if (user === undefined || !verified || user.role !== input.entrance) return { kind: 'refused' };

    await this.attempts.recordSuccess({ attemptId: reservation.attemptId, email, ip: input.ip });
    // A login drops what already expired and keeps the sessions still in use (AUTH-13).
    await this.sessions.deleteExpiredOfUser(user.id);
    return { kind: 'session', session: await this.sessions.create(user.id) };
  }
}
