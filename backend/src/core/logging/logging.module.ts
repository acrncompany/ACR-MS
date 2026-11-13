import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from '../config/app-config.js';

const REQUEST_ID_HEADER = 'x-request-id';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          // Reuse an upstream request id when present, and always echo it back.
          genReqId: (req, res) => {
            const incoming = req.headers[REQUEST_ID_HEADER];
            const id = typeof incoming === 'string' && incoming ? incoming : randomUUID();
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          // Credentials and tokens must never reach the logs. Request bodies are not logged at all;
          // these paths are a second line of defence for headers and any logged objects.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["proxy-authorization"]',
              'req.headers["x-api-key"]',
              'res.headers["set-cookie"]',
              '*.password',
              '*.passwordHash',
              '*.token',
              '*.accessToken',
              '*.secret',
            ],
            censor: '[REDACTED]',
          },
          transport: config.isProduction
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
