import { ConflictError, ValidationError } from '../errors/app-error.js';

/** The Prisma error code of a thrown value, if it is a Prisma known-request error. */
function prismaCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Turns the database's integrity errors into readable domain errors: a unique violation (P2002)
 * becomes a 409 and a foreign-key violation (P2003) a 400. Anything else is rethrown unchanged.
 */
export function mapIntegrityError(
  error: unknown,
  what: { unique: string; reference: string },
): never {
  const code = prismaCode(error);
  if (code === 'P2002') throw new ConflictError(what.unique, 'ALREADY_EXISTS');
  if (code === 'P2003') throw new ValidationError(what.reference, 'UNKNOWN_REFERENCE');
  throw error;
}
