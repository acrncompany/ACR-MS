import { ValidationError } from '../errors/app-error.js';

/** Largest accepted upload. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export type UploadMime =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const EXTENSIONS: Record<UploadMime, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

/** The type of a file from its first bytes (the client's name or Content-Type is never trusted). */
export function sniffMime(data: Buffer): UploadMime | null {
  const starts = (...bytes: number[]) => bytes.every((b, i) => data[i] === b);
  if (starts(0x25, 0x50, 0x44, 0x46)) return 'application/pdf'; // %PDF
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (starts(0xd0, 0xcf, 0x11, 0xe0)) return 'application/msword';
  if (starts(0x50, 0x4b, 0x03, 0x04))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return null;
}

export function extensionOf(mime: UploadMime): string {
  return EXTENSIONS[mime];
}

/** Checks size and real type of an upload; returns its type. */
export function validateUpload(data: unknown, allowed: readonly UploadMime[]): UploadMime {
  if (!Buffer.isBuffer(data) || data.length === 0) {
    throw new ValidationError('Choose a file to upload', 'FILE_REQUIRED');
  }
  if (data.length > MAX_UPLOAD_BYTES) {
    throw new ValidationError('The file is larger than 2 MB', 'FILE_TOO_LARGE');
  }
  const mime = sniffMime(data);
  if (!mime || !allowed.includes(mime)) {
    throw new ValidationError('This file type is not allowed', 'FILE_TYPE_NOT_ALLOWED');
  }
  return mime;
}
