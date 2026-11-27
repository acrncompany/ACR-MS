import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config.js';

export interface EncryptedValue {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  /** Which derived key encrypted this value; stored with the row to allow key rotation. */
  keyId: string;
}

/** Identifies the stored value an encryption belongs to (bound as AAD, so rows cannot be swapped). */
export interface CredentialBinding {
  tenantId: string;
  clientId: string;
  field: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * Field-level encryption for client portal credentials: AES-256-GCM with a per-tenant key
 * derived (HKDF-SHA256, salt = tenantId, info = key id) from CREDENTIAL_MASTER_KEY. Only the
 * ciphertext, a fresh random 96-bit iv, the auth tag and the key id are stored. The tenant, client
 * and field are authenticated as additional data, so a ciphertext copied to another row fails.
 * Plaintext never leaves this class except through `decrypt`, and is never logged.
 */
@Injectable()
export class CredentialCipher {
  private readonly master: Buffer;
  private readonly currentKeyId: string;

  constructor(config: AppConfig) {
    this.master = Buffer.from(config.get('CREDENTIAL_MASTER_KEY'), 'base64');
    this.currentKeyId = config.get('CREDENTIAL_KEY_ID');
  }

  encrypt(binding: CredentialBinding, plaintext: string): EncryptedValue {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(
      ALGORITHM,
      this.deriveKey(binding.tenantId, this.currentKeyId),
      iv,
    );
    cipher.setAAD(aad(binding));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return { ciphertext, iv, authTag: cipher.getAuthTag(), keyId: this.currentKeyId };
  }

  decrypt(binding: CredentialBinding, value: EncryptedValue): string {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.deriveKey(binding.tenantId, value.keyId),
      value.iv,
    );
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(value.authTag);
    return Buffer.concat([decipher.update(value.ciphertext), decipher.final()]).toString('utf8');
  }

  private deriveKey(tenantId: string, keyId: string): Buffer {
    // Key rotation later: map old key ids to their master keys here. Today only one master exists.
    return Buffer.from(
      hkdfSync('sha256', this.master, Buffer.from(tenantId), `acrms-credentials:${keyId}`, 32),
    );
  }
}

function aad(binding: CredentialBinding): Buffer {
  return Buffer.from(`${binding.tenantId}|${binding.clientId}|${binding.field}`, 'utf8');
}
