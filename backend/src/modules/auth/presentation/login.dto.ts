import { z } from 'zod';

// Deliberately no tenant field: the tenant comes from the request host.
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginDto = z.infer<typeof loginSchema>;
