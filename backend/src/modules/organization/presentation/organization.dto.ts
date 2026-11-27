import { z } from 'zod';

/** Capital letters in groups joined by "_" or "-" (OPS, FIN_OFFICER, FIN-TL). No digits or levels. */
const code = z
  .string()
  .trim()
  .max(32)
  .regex(
    /^[A-Z]+([_-][A-Z]+)*$/,
    'Use capital letters, with "_" or "-" between words. No numbers.',
  );

/** The CEO's short label (TM, TL, TD, AD, GM, P1). Display only. */
const designationCode = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9]{0,3}$/)
  .nullable()
  .default(null);

const name = z.string().trim().min(1).max(120);
const uuid = z.string().uuid();

export const createDepartmentSchema = z
  .object({ code, name, parentId: uuid.nullable().default(null) })
  .strict();
export const updateDepartmentSchema = z
  .object({ name, parentId: uuid.nullable().default(null) })
  .strict();

export const createPositionSchema = z
  .object({
    code,
    name,
    designationCode,
    departmentId: uuid,
    parentId: uuid.nullable().default(null),
    roleId: uuid,
  })
  .strict();
export const updatePositionSchema = z
  .object({
    name,
    designationCode,
    departmentId: uuid,
    parentId: uuid.nullable().default(null),
    roleId: uuid,
  })
  .strict();

export const idParamSchema = uuid;

export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentSchema>;
export type CreatePositionDto = z.infer<typeof createPositionSchema>;
export type UpdatePositionDto = z.infer<typeof updatePositionSchema>;
