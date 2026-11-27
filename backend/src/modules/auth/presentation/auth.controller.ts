import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../core/config/app-config.js';
import { UnauthorizedError } from '../../../core/errors/app-error.js';
import { ZodValidationPipe } from '../../../core/validation/zod-validation.pipe.js';
import type { AuthIdentity } from '../domain/auth.types.js';
import { LoginUseCase } from '../domain/login.use-case.js';
import { LogoutAllUseCase, LogoutUseCase } from '../domain/logout.use-cases.js';
import { MeResult, MeUseCase } from '../domain/me.use-case.js';
import { ChangePasswordUseCase } from '../domain/password-use-cases.js';
import { RefreshUseCase } from '../domain/refresh.use-case.js';
import {
  AllowWhilePasswordChangeRequired,
  AuthThrottle,
  CurrentAuth,
  Public,
  RefreshCookie,
  clientContext,
} from './auth-http.js';
import { changePasswordSchema, type ChangePasswordDto } from './change-password.dto.js';
import { CsrfGuard } from './guards.js';
import { loginSchema, type LoginDto } from './login.dto.js';

interface AccessTokenBody {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

@Controller('auth')
export class AuthController {
  private readonly cookie: RefreshCookie;

  constructor(
    private readonly login: LoginUseCase,
    private readonly refresh: RefreshUseCase,
    private readonly logout: LogoutUseCase,
    private readonly logoutAll: LogoutAllUseCase,
    private readonly me: MeUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    config: AppConfig,
  ) {
    this.cookie = new RefreshCookie(config);
  }

  @Public()
  @AuthThrottle('login')
  @Post('login')
  @HttpCode(200)
  async signIn(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    AccessTokenBody & {
      user: { id: string; name: string; email: string; mustChangePassword: boolean };
    }
  > {
    const result = await this.login.execute({ ...body, client: clientContext(req) });
    this.cookie.set(res, result.refreshToken, result.refreshExpiresAt);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  @Public()
  @AuthThrottle('refresh')
  @UseGuards(CsrfGuard)
  @Post('refresh')
  @HttpCode(200)
  async refreshSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccessTokenBody> {
    try {
      const result = await this.refresh.execute(this.cookie.read(req), clientContext(req));
      this.cookie.set(res, result.refreshToken, result.refreshExpiresAt);
      return { accessToken: result.accessToken, expiresIn: result.expiresIn };
    } catch (error) {
      // A refresh token that failed is useless; do not keep sending it.
      if (error instanceof UnauthorizedError) this.cookie.clear(res);
      throw error;
    }
  }

  @Public()
  @AuthThrottle('refresh')
  @UseGuards(CsrfGuard)
  @Post('logout')
  @HttpCode(204)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.logout.execute(this.cookie.read(req), clientContext(req));
    this.cookie.clear(res);
  }

  @Public()
  @AuthThrottle('refresh')
  @UseGuards(CsrfGuard)
  @Post('logout-all')
  @HttpCode(204)
  async signOutEverywhere(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.logoutAll.execute(this.cookie.read(req), clientContext(req));
    this.cookie.clear(res);
  }

  @AllowWhilePasswordChangeRequired()
  @AuthThrottle('login')
  @Post('change-password')
  @HttpCode(204)
  async changeOwnPassword(
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordDto,
    @CurrentAuth() auth: AuthIdentity,
    @Req() req: Request,
  ): Promise<void> {
    await this.changePassword.execute(auth, body, clientContext(req));
  }

  @AllowWhilePasswordChangeRequired()
  @Get('me')
  profile(@CurrentAuth() auth: AuthIdentity): Promise<MeResult> {
    return this.me.execute(auth);
  }
}
