export interface UserEntity {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  employeeCode: string;
  passwordHash: string;
  mustChangePassword: boolean;
  status: 'ACTIVE' | 'DISABLED';
  positionId: string | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
}

/** Outcome of recording a failed password attempt. */
export interface LoginFailureResult {
  failedLoginCount: number;
  /** True when this very failure locked the account. */
  lockedNow: boolean;
  lockedUntil: Date | null;
}

/** A person who can be picked in a dropdown (assignment, client team, manager). */
export interface ActiveUser {
  id: string;
  name: string;
  employeeCode: string;
  positionId: string | null;
}
