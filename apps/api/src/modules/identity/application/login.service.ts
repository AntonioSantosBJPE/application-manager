import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_MAX_LENGTH, type Role } from '@am/contracts';
import { normalizeEmail } from '../domain/credentials.js';
import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher.js';
import { SessionService, type CreatedSession } from './session.service.js';
import { UsersRepository } from '../infra/users.repository.js';

/** Which entrance answered: a member enters at `/auth/login`, an admin at `/auth/admin/login` (AD-005). */
export interface LoginInput {
  email: string;
  password: string;
  ip: string;
  entrance: Role;
}

/**
 * The single login rule (AUTH-01..AUTH-04). Every way a credential can be refused ends the same:
 * `undefined`, which the controller answers as one `401`. The entrance is a role, so a valid
 * credential used on the other entrance is refused like a wrong password and reveals no role.
 */
@Injectable()
export class LoginService {
  constructor(
    private readonly users: UsersRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  /**
   * A session for valid credentials of the entrance, or `undefined` when they are refused.
   *
   * The verifier runs once on every attempt that is not oversized, against the real hash or the
   * dummy one, so an unknown email costs the same work as a wrong password (AUTH-04). A password
   * past the maximum is refused without hashing (EDGE-03).
   */
  async login(input: LoginInput): Promise<CreatedSession | undefined> {
    const email = normalizeEmail(input.email);
    const user = await this.users.findByEmail(email);
    const verified =
      input.password.length > PASSWORD_MAX_LENGTH
        ? false
        : user === undefined
          ? await this.hasher.verifyDummy(input.password)
          : await this.hasher.verify(user.passwordHash, input.password);
    if (user === undefined || !verified || user.role !== input.entrance) return undefined;

    // A login drops what already expired and keeps the sessions still in use (AUTH-13).
    await this.sessions.deleteExpiredOfUser(user.id);
    return this.sessions.create(user.id);
  }
}
