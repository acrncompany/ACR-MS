import { z } from 'zod';
import {
  CREDENTIAL_FIELDS,
  CREDENTIAL_VALUE_MAX_LENGTH,
} from '../../credentials/domain/credential-fields.js';

/** '' and whitespace become null, so an empty form field clears an optional value. */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable().default(null),
  );

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const DIN = /^[0-9]{8}$/;
const PHONE = /^[0-9+\-\s]{8,15}$/;
/** CIN (21 characters), LLPIN (AAA-1234) or ICAI Firm Registration Number (6 digits and a letter). */
const CIN_FRN = /^([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}|[A-Z]{3}-[0-9]{4}|[0-9]{6}[A-Z]?)$/;

const phone = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().trim().regex(PHONE, 'Enter a valid phone number').nullable().default(null),
);
const email = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().trim().toLowerCase().email().max(254).nullable().default(null),
);

const isoDate = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Not a real date')
    .refine((s) => s <= new Date().toISOString().slice(0, 10), 'Date cannot be in the future')
    .nullable()
    .default(null),
);

const director = z
  .object({
    name: z.string().trim().min(1).max(120),
    din: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.string().trim().regex(DIN, 'DIN has 8 digits').nullable().default(null),
    ),
    phone,
    email,
    kycStatus: z.enum(['done', 'pending']).default('pending'),
  })
  .strict();

const clientFields = {
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  city: optionalText(100),
  email,
  phone,
  organisationType: z.string().trim().min(1).max(50),
  cinFrn: z.preprocess(
    (v) =>
      typeof v === 'string' && v.trim() === ''
        ? null
        : typeof v === 'string'
          ? v.trim().toUpperCase()
          : v,
    z.string().regex(CIN_FRN, 'Not a valid CIN, LLPIN or FRN').nullable().default(null),
  ),
  incorporationDate: isoDate,
  pan: z.string().trim().toUpperCase().regex(PAN, 'PAN looks like AABCK4521M'),
  gstin: z.preprocess(
    (v) =>
      typeof v === 'string' && v.trim() === ''
        ? null
        : typeof v === 'string'
          ? v.trim().toUpperCase()
          : v,
    z
      .string()
      .regex(GSTIN, 'GSTIN has 15 characters, e.g. 32AABCK4521M1ZA')
      .nullable()
      .default(null),
  ),
  previousAuditor: optionalText(200),
  directors: z.array(director).max(50).default([]),
  lawKeys: z
    .array(z.string().trim().min(1).max(50))
    .max(100)
    .default([])
    .transform((keys) => [...new Set(keys)]),
  teamIds: z
    .array(z.string().uuid())
    .max(200)
    .default([])
    .transform((ids) => [...new Set(ids)]),
};

/** GSTIN characters 3 to 12 are the PAN of the taxpayer. */
const gstinMatchesPan = (v: { pan: string; gstin: string | null }): boolean =>
  !v.gstin || v.gstin.slice(2, 12) === v.pan;
const gstinPanMessage = { message: 'The GSTIN does not contain this PAN', path: ['gstin'] };

export const createClientSchema = z
  .object({ ...clientFields, branchId: z.string().uuid().optional() })
  .strict()
  .refine(gstinMatchesPan, gstinPanMessage);

/** The client code, id, branch and status are not editable: unknown keys are rejected. */
export const updateClientSchema = z
  .object(clientFields)
  .strict()
  .refine(gstinMatchesPan, gstinPanMessage);

export const listClientsQuerySchema = z.object({
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

export const setActiveSchema = z.object({ active: z.boolean() }).strict();

export const setCredentialSchema = z
  .object({
    key: z.enum(CREDENTIAL_FIELDS),
    /** Write-only. An empty string clears the stored value. */
    value: z.string().max(CREDENTIAL_VALUE_MAX_LENGTH),
  })
  .strict();

export const revealCredentialSchema = z
  .object({
    key: z.enum(CREDENTIAL_FIELDS),
    /** The signed-in user's CURRENT password (re-authentication). */
    password: z.string().min(1).max(128),
    worksheetId: z.string().max(64).nullable().optional(),
  })
  .strict();

export type CreateClientDto = z.infer<typeof createClientSchema>;
export type UpdateClientDto = z.infer<typeof updateClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
export type SetActiveDto = z.infer<typeof setActiveSchema>;
export type SetCredentialDto = z.infer<typeof setCredentialSchema>;
export type RevealCredentialDto = z.infer<typeof revealCredentialSchema>;
