/**
 * File storage port. Only the storage KEY is ever kept in the database (never a URL); a key looks
 * like "<tenantId>/<area>/<random>.<ext>" and is always made by the server. The local-disk
 * implementation can later be replaced by object storage (S3 or similar) without touching callers.
 */
export abstract class FileStorage {
  /** Stores the bytes under `key` (overwrites nothing: keys are unique). */
  abstract put(key: string, data: Buffer): Promise<void>;
  /** The bytes stored under `key`; null when there is no such file. */
  abstract get(key: string): Promise<Buffer | null>;
  /** Removes the file. Missing files are ignored. */
  abstract remove(key: string): Promise<void>;
}
