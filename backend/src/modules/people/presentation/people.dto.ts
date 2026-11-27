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

const text = (max: number) => z.string().trim().max(max).default('');
const optionalDate = z
  .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')])
  .nullish()
  .transform((v) => (v ? v : null));
const optionalEnum = <E extends z.ZodEnum>(schema: E) =>
  z
    .union([z.literal(''), schema])
    .nullish()
    .transform((v): z.infer<E> | null => (v ? (v as z.infer<E>) : null));

const addressSchema = z
  .object({
    houseName: text(150),
    postOffice: text(100),
    district: text(100),
    pinCode: z
      .union([
        z.literal(''),
        z
          .string()
          .trim()
          .regex(/^[0-9]{4,10}$/, 'Digits only'),
      ])
      .default(''),
    state: text(100),
  })
  .strict()
  .default({ houseName: '', postOffice: '', district: '', pinCode: '', state: '' });

const emergencyContactSchema = z
  .object({ name: text(100), relation: text(50), mobNo: text(20) })
  .strict()
  .default({ name: '', relation: '', mobNo: '' });

const bankSchema = z
  .object({
    accountHolder: text(100),
    bankName: text(100),
    accountNumber: z
      .union([
        z.literal(''),
        z
          .string()
          .trim()
          .regex(/^[0-9A-Za-z]{5,34}$/, 'Letters and digits only'),
      ])
      .default(''),
    ifsc: z
      .union([
        z.literal(''),
        z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'),
      ])
      .default(''),
    branch: text(100),
  })
  .strict()
  .default({ accountHolder: '', bankName: '', accountNumber: '', ifsc: '', branch: '' });

/**
 * Employee and article share one profile. Codes and tenantId are server-made, and documents are
 * uploaded afterwards on their own endpoint: unknown keys are rejected.
 */
export const createPersonSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100).default(''),
    email: z.union([z.literal(''), z.string().trim().toLowerCase().email().max(200)]).default(''),
    mobNo: z.string().trim().max(20).default(''),
    departmentId: optionalUuid,
    designationId: optionalUuid,
    reportingManagerId: optionalUuid,
    joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    dateOfBirth: optionalDate,
    gender: optionalEnum(z.enum(['MALE', 'FEMALE'])),
    maritalStatus: optionalEnum(z.enum(['SINGLE', 'MARRIED'])),
    address: addressSchema,
    emergencyContact: emergencyContactSchema,
    idProofType: optionalEnum(
      z.enum(['AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENCE']),
    ),
    bank: bankSchema,
    status,
  })
  .strict();

export const documentKindSchema = z.enum(['id-proof', 'resume', 'passbook']);
/** Original file name of an upload (shown back to the user; the stored name is server-made). */
export const uploadQuerySchema = z.object({
  fileName: z.string().trim().max(200).optional(),
  /** Additional documents only: what the user calls the document. */
  title: z.string().trim().max(100).optional(),
});

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
export type CreatePersonDto = z.infer<typeof createPersonSchema>;
export type UploadQuery = z.infer<typeof uploadQuerySchema>;
export type ListPeopleQuery = z.infer<typeof listPeopleQuerySchema>;
