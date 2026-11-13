import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../core/validation/zod-validation.pipe.js';
import { LoginResult, LoginUseCase } from '../domain/login.use-case.js';
import { loginSchema, type LoginDto } from './login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly login: LoginUseCase) {}

  @Post('login')
  @HttpCode(200)
  signIn(@Body(new ZodValidationPipe(loginSchema)) body: LoginDto): Promise<LoginResult> {
    return this.login.execute(body.email, body.password);
  }
}
