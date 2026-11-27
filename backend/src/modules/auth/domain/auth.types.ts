/** Who a verified access token belongs to. Built by the server, never read from a request body. */
export interface AuthIdentity {
  userId: string;
  tenantId: string;
  sessionId: string;
  /** An admin set a temporary password; only change-password, me and logout are allowed. */
  mustChangePassword?: boolean;
}

/** Network details of the caller, kept on the session and in audit entries. */
export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
}

/** What login and refresh produce. The refresh token travels only in the httpOnly cookie. */
export interface AuthResult {
  accessToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/** Same message for every authentication failure, so responses do not leak the reason. */
export const AUTH_REQUIRED = 'Authentication required';
