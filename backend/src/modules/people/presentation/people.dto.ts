import { z } from 'zod';

const status = z.enum(['Active', 'Inactive']).default('Active');
const optionalUuid = z
  .string()
  .uuid()
  .nullish()
  .transform((v) => v ?? null);

/** Codes and tenantId are server-made: unknown keys (code, tenantId...) are rejected. */
export const createDepartmentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(300).default(''),
    status,
  })
  .strict();

export const createDesignationSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    departmentId: z.string().uuid(),
    description: z.string().trim().max(300).default(''),
    status,
  })
  .strict();

export const createEmployeeSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.union([z.literal(''), z.string().trim().toLowerCase().email().max(200)]).default(''),
    phone: z.string().trim().max(20).default(''),
    departmentId: optionalUuid,
    designationId: optionalUuid,
    joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    status,
  })
  .strict();

export const listPeopleQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : null)),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;
export type CreateDesignationDto = z.infer<typeof createDesignationSchema>;
export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
export type ListPeopleQuery = z.infer<typeof listPeopleQuerySchema>;
