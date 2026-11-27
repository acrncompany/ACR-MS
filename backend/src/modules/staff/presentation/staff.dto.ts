import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '../../auth/domain/password-policy.js';

const emptyToNull = (v: unknown): unknown => (typeof v === 'string' && v.trim() === '' ? null : v);

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable());

const phone = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{8,15}$/, 'Enter a valid phone number')
    .nullable(),
);

const isoDate = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Not a real date')
    .nullable(),
);

const today = (): string => new Date().toISOString().slice(0, 10);

const name = z.string().trim().min(1).max(120);
const email = z.string().trim().toLowerCase().email().max(254);
const uuid = z.string().uuid();

/** Date of birth must be in the past; joining cannot be before birth. */
function datesAreSane(v: { dateOfBirth?: string | null; dateOfJoining?: string | null }): boolean {
  if (v.dateOfBirth && v.dateOfBirth > today()) return false;
  if (v.dateOfBirth && v.dateOfJoining && v.dateOfJoining < v.dateOfBirth) return false;
  return true;
}
const datesMessage = {
  message: 'Date of birth must be in the past and not after the date of joining',
  path: ['dateOfBirth'],
};

export const createStaffSchema = z
  .object({
    name,
    email,
    phone: phone.default(null),
    address: optionalText(500).default(null),
    dateOfBirth: isoDate.default(null),
    dateOfJoining: isoDate.default(null),
    positionId: uuid,
    managerId: uuid.nullable().optional(),
    /** Either an admin-chosen password, or `generateTemporaryPassword: true` (shown once). */
    password: z.string().max(PASSWORD_MAX_LENGTH).optional(),
    generateTemporaryPassword: z.boolean().optional(),
  })
  .strict()
  .refine(datesAreSane, datesMessage);

/** The employee code, id and status are not editable: unknown keys are rejected. */
export const updateStaffSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    phone: phone.optional(),
    address: optionalText(500).optional(),
    dateOfBirth: isoDate.optional(),
    dateOfJoining: isoDate.optional(),
    positionId: uuid.optional(),
    managerId: uuid.nullable().optional(),
  })
  .strict()
  .refine(datesAreSane, datesMessage);

export const listStaffQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : null)),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? null : v === 'true')),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const staffIdParam = uuid;

export type CreateStaffDto = z.infer<typeof createStaffSchema>;
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;
export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>;
