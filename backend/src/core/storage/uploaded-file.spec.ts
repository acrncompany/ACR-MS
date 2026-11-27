import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, sniffMime, validateUpload } from './uploaded-file.js';

const pdf = Buffer.from('%PDF-1.7 body');
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(4),
]);

describe('uploaded files', () => {
  it('detects the type from the first bytes, not the name', () => {
    expect(sniffMime(pdf)).toBe('application/pdf');
    expect(sniffMime(png)).toBe('image/png');
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffMime(Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });

  it('accepts an allowed type up to 2 MB', () => {
    expect(validateUpload(pdf, ['application/pdf'])).toBe('application/pdf');
  });

  it('rejects empty, oversized, non-binary and disallowed files', () => {
    expect(() => validateUpload(Buffer.alloc(0), ['application/pdf'])).toThrow();
    expect(() => validateUpload({}, ['application/pdf'])).toThrow();
    expect(() =>
      validateUpload(Buffer.concat([pdf, Buffer.alloc(MAX_UPLOAD_BYTES)]), ['application/pdf']),
    ).toThrow(/2 MB/);
    expect(() => validateUpload(png, ['application/pdf'])).toThrow(/not allowed/);
  });
});
