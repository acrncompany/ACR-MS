import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../domain/password-hasher.js';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;
const KEY_LENGTH = 64;

/** Stores hashes as `<salt hex>:<key hex>`. */
@Injectable()
export class ScryptPasswordHasher extends PasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scryptAsync(plain, salt, KEY_LENGTH);
    return `${salt.toString('hex')}:${key.toString('hex')}`;
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    const [saltHex, keyHex] = hash.split(':');
    if (!saltHex || !keyHex) return false;
    const expected = Buffer.from(keyHex, 'hex');
    const actual = await scryptAsync(plain, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
