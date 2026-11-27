import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RefreshTokens } from '../domain/refresh-tokens.js';

/**
 * 384 random bits, so a fast SHA-256 is enough: unlike passwords, there is nothing to brute
 * force. The raw token only ever exists in the cookie.
 */
@Injectable()
export class CryptoRefreshTokens extends RefreshTokens {
  generate(): { token: string; hash: string } {
    const token = randomBytes(48).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
