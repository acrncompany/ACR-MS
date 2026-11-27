import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '../domain/password-policy.js';

/** Strength is checked by the server-side policy (it needs the user's email and name too). */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
