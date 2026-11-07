/**
 * The public API of the identity module. Another module imports from here and nowhere else: the
 * guard, the access declarations, the user type and the password hasher port are what it needs (EDGE-08).
 */
export { IdentityModule, type IdentityModuleOptions } from './identity.module.js';
export {
  AnySession,
  CurrentUser,
  Public,
  Roles,
  type AccessDeclaration,
  type AuthenticatedRequest,
  type AuthenticatedUser,
} from './http/access.decorators.js';
export {
  PASSWORD_HASHER,
  argon2idPasswordHasher,
  type PasswordHasher,
  type PhcHash,
} from './application/password-hasher.js';
export { runIdentityCli, EXIT_OK, EXIT_REFUSED, EXIT_USAGE, type CliIo } from './cli/run-identity-cli.js';
export { promptHidden } from './cli/hidden-prompt.js';
