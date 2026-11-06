import { z } from 'zod';

/** Password rule of the spec: no composition rule, only a length window (CLI-05, INV-08). */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** A name is required and is not blank after trimming (INV-08). */
export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 120;

/** Accounts are separate: an admin only administers, a member only uses the product (AD-005). */
export const roleSchema = z.enum(['admin', 'member']);
export type Role = z.infer<typeof roleSchema>;

/**
 * Every email that reaches the API is compared and stored lowercased without surrounding spaces
 * (EDGE-01), so the transformation belongs to the contract both ends share.
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
export type Email = z.infer<typeof emailSchema>;

export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);
export const nameSchema = z.string().trim().min(NAME_MIN_LENGTH).max(NAME_MAX_LENGTH);

/**
 * The login body accepts any non-empty password: a password outside the rule must answer the same
 * `401` as a wrong one and count a failure, not `400` (EDGE-03), so the length rule is judged by the
 * domain after the attempt is counted.
 */
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const meResponseSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const createInvitationRequestSchema = z.object({ email: emailSchema });
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

/** `inviteUrl` is built from `WEB_PUBLIC_URL`; the link is shown once, so it is part of the answer (INV-01). */
export const createInvitationResponseSchema = z.object({
  inviteUrl: z.url(),
  expiresAt: z.iso.datetime(),
});
export type CreateInvitationResponse = z.infer<typeof createInvitationResponseSchema>;

/** What `GET /invitations/:token` reveals while the invitation is still pending (INV-05). */
export const invitationDetailsSchema = z.object({
  email: z.string(),
  expiresAt: z.iso.datetime(),
});
export type InvitationDetails = z.infer<typeof invitationDetailsSchema>;

export const acceptInvitationRequestSchema = z.object({
  name: nameSchema,
  password: passwordSchema,
});
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;

/** A pending invitation as the admin list shows it; it never carries the token or its hash (ADM-05). */
export const invitationListItemSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  expiresAt: z.iso.datetime(),
});
export type InvitationListItem = z.infer<typeof invitationListItemSchema>;

export const invitationsPageSchema = z.object({
  items: z.array(invitationListItemSchema),
  nextCursor: z.string().nullable(),
  totalPending: z.number().int().nonnegative(),
});
export type InvitationsPage = z.infer<typeof invitationsPageSchema>;

/** A field that failed validation, named without its value so a rejected password is never echoed (EDGE-02). */
export const problemFieldErrorSchema = z.object({
  path: z.string(),
  code: z.string(),
});
export type ProblemFieldError = z.infer<typeof problemFieldErrorSchema>;

/** RFC 9457 body returned with `application/problem+json` for every Identity error (AUTH-17). */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  errors: z.array(problemFieldErrorSchema).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
