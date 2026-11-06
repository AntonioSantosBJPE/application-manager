/**
 * The public API of the identity module. Another module imports from here and nowhere else: the
 * guard, the access declarations and the user type are the only things it needs (EDGE-08).
 */
export { IdentityModule } from './identity.module.js';
export {
  AnySession,
  CurrentUser,
  Public,
  Roles,
  type AccessDeclaration,
  type AuthenticatedRequest,
  type AuthenticatedUser,
} from './http/access.decorators.js';
