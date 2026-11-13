import { Injectable } from '@nestjs/common';
import 'dotenv/config';
import { Env, durationToSeconds, parseEnv } from './env.schema.js';

/**
 * Typed, validated environment. Construction throws when a variable is missing or invalid,
 * so the application cannot start with a bad configuration.
 */
@Injectable()
export class AppConfig {
  private readonly env: Env = parseEnv(process.env);

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }

  get jwtExpiresInSeconds(): number {
    return durationToSeconds(this.env.JWT_EXPIRES_IN);
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
}
