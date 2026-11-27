import { z } from 'zod';

/** The code and key are server-made: unknown keys (code, key, tenantId...) are rejected. */
export const createOrganisationTypeSchema = z
  .object({ name: z.string().trim().min(1).max(100) })
  .strict();

/** Only the name can change: the code is permanent and the key stays stable for the clients. */
export const updateOrganisationTypeSchema = createOrganisationTypeSchema;

export const listOrganisationTypesQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : null)),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateOrganisationTypeDto = z.infer<typeof createOrganisationTypeSchema>;
export type UpdateOrganisationTypeDto = z.infer<typeof updateOrganisationTypeSchema>;
export type ListOrganisationTypesQuery = z.infer<typeof listOrganisationTypesQuerySchema>;
