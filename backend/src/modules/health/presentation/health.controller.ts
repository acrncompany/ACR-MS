import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/presentation/auth-http.js';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
