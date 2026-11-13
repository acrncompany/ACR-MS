import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../core/config/app-config.js';
import { UserModule } from '../user/user.module.js';
import { JwtTokenIssuer } from './data/jwt-token-issuer.js';
import { ScryptPasswordHasher } from './data/scrypt-password-hasher.js';
import { LoginUseCase } from './domain/login.use-case.js';
import { PasswordHasher } from './domain/password-hasher.js';
import { TokenIssuer } from './domain/token-issuer.js';
import { AuthController } from './presentation/auth.controller.js';

@Module({
  imports: [
    UserModule,
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.jwtExpiresInSeconds },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    { provide: PasswordHasher, useClass: ScryptPasswordHasher },
    { provide: TokenIssuer, useClass: JwtTokenIssuer },
  ],
})
export class AuthModule {}
