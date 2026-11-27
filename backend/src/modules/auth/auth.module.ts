import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import { AppConfig } from '../../core/config/app-config.js';
import { AccessModule } from '../access/access.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { PermissionsGuard } from '../access/presentation/permissions.guard.js';
import { OrganizationModule } from '../organization/organization.module.js';
import { TenantModule } from '../tenant/tenant.module.js';
import { UserModule } from '../user/user.module.js';
import { CryptoRefreshTokens } from './data/crypto-refresh-tokens.js';
import { JwtTokenIssuer } from './data/jwt-token-issuer.js';
import { PrismaSessionRepository } from './data/prisma-session.repository.js';
import { ScryptPasswordHasher } from './data/scrypt-password-hasher.js';
import {
  ChangePasswordUseCase,
  PrepareNewPasswordUseCase,
  RevokeUserSessionsUseCase,
  VerifyUserPasswordUseCase,
} from './domain/password-use-cases.js';
import { AuthenticateRequestUseCase } from './domain/authenticate-request.use-case.js';
import { LoginUseCase } from './domain/login.use-case.js';
import { LogoutAllUseCase, LogoutUseCase } from './domain/logout.use-cases.js';
import { MeUseCase } from './domain/me.use-case.js';
import { PasswordHasher } from './domain/password-hasher.js';
import { RefreshTokens } from './domain/refresh-tokens.js';
import { RefreshUseCase } from './domain/refresh.use-case.js';
import { SessionRepository } from './domain/session.repository.js';
import { TokenIssuer } from './domain/token-issuer.js';
import { THROTTLE_KIND_KEY } from './presentation/auth-http.js';
import { AuthController } from './presentation/auth.controller.js';
import {
  AppThrottlerGuard,
  CsrfGuard,
  JwtAuthGuard,
  PasswordChangeGuard,
} from './presentation/guards.js';

const reflector = new Reflector();
const kindOf = (context: ExecutionContext): string | undefined =>
  reflector.get<string | undefined>(THROTTLE_KIND_KEY, context.getHandler());

@Module({
  imports: [
    UserModule,
    TenantModule,
    AuditModule,
    AccessModule,
    OrganizationModule,
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.jwtExpiresInSeconds, algorithm: 'HS256' },
      }),
    }),
    // Login and refresh/logout have their own (tighter) limits; everything else the default.
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const ttl = config.get('THROTTLE_TTL_SECONDS') * 1000;
        return {
          throttlers: [
            {
              name: 'default',
              ttl,
              limit: config.get('THROTTLE_DEFAULT_LIMIT'),
              skipIf: (context: ExecutionContext) => kindOf(context) !== undefined,
            },
            {
              name: 'login',
              ttl,
              limit: config.get('THROTTLE_LOGIN_LIMIT'),
              skipIf: (context: ExecutionContext) => kindOf(context) !== 'login',
            },
            {
              name: 'refresh',
              ttl,
              limit: config.get('THROTTLE_REFRESH_LIMIT'),
              skipIf: (context: ExecutionContext) => kindOf(context) !== 'refresh',
            },
          ],
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    MeUseCase,
    ChangePasswordUseCase,
    PrepareNewPasswordUseCase,
    RevokeUserSessionsUseCase,
    VerifyUserPasswordUseCase,
    AuthenticateRequestUseCase,
    CsrfGuard,
    { provide: PasswordHasher, useClass: ScryptPasswordHasher },
    { provide: TokenIssuer, useClass: JwtTokenIssuer },
    { provide: RefreshTokens, useClass: CryptoRefreshTokens },
    { provide: SessionRepository, useClass: PrismaSessionRepository },
    // Global guards run in this order: rate limit first, then authentication.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    // Then permissions: needs the authenticated identity and the must-change-password gate first.
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [PrepareNewPasswordUseCase, RevokeUserSessionsUseCase, VerifyUserPasswordUseCase],
})
export class AuthModule {}
