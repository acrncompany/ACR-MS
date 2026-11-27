import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/app-config.js';
import { CredentialCipher } from './credential-cipher.js';

const config = (key = 7, keyId = 'v1'): AppConfig =>
  ({
    get: (name: string) =>
      name === 'CREDENTIAL_MASTER_KEY' ? Buffer.alloc(32, key).toString('base64') : keyId,
  }) as unknown as AppConfig;

const binding = { tenantId: 'tenant-a', clientId: 'client-1', field: 'mca.password' };

describe('CredentialCipher', () => {
  it('round-trips a value', () => {
    const cipher = new CredentialCipher(config());
    const encrypted = cipher.encrypt(binding, 'S3cret!pässword');
    expect(cipher.decrypt(binding, encrypted)).toBe('S3cret!pässword');
  });

  it('never stores the plaintext and uses a fresh iv every time', () => {
    const cipher = new CredentialCipher(config());
    const a = cipher.encrypt(binding, 'same-value');
    const b = cipher.encrypt(binding, 'same-value');
    expect(a.ciphertext.toString('utf8')).not.toContain('same-value');
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(a.keyId).toBe('v1');
  });

  it('fails when the ciphertext is tampered with', () => {
    const cipher = new CredentialCipher(config());
    const encrypted = cipher.encrypt(binding, 'value');
    encrypted.ciphertext[0] ^= 1;
    expect(() => cipher.decrypt(binding, encrypted)).toThrow();
  });

  it('fails when moved to another client, field or tenant', () => {
    const cipher = new CredentialCipher(config());
    const encrypted = cipher.encrypt(binding, 'value');
    expect(() => cipher.decrypt({ ...binding, clientId: 'client-2' }, encrypted)).toThrow();
    expect(() => cipher.decrypt({ ...binding, field: 'mca.id' }, encrypted)).toThrow();
    expect(() => cipher.decrypt({ ...binding, tenantId: 'tenant-b' }, encrypted)).toThrow();
  });

  it('fails with a different master key', () => {
    const encrypted = new CredentialCipher(config(7)).encrypt(binding, 'value');
    expect(() => new CredentialCipher(config(8)).decrypt(binding, encrypted)).toThrow();
  });

  it('records the key id so a later rotation can tell keys apart', () => {
    const encrypted = new CredentialCipher(config(7, 'v2')).encrypt(binding, 'value');
    expect(encrypted.keyId).toBe('v2');
    // Decrypting with another key id derives another key.
    expect(() =>
      new CredentialCipher(config(7, 'v1')).decrypt(binding, { ...encrypted, keyId: 'v1' }),
    ).toThrow();
  });
});
