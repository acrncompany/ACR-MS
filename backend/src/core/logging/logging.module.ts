import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from '../config/app-config.js';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Optional destination for the request log (a writable stream). Production and development leave
 * it unset (stdout, pretty in development); tests replace it to inspect exactly what is logged.
 */
export const LOG_STREAM = Symbol('LOG_STREAM');

@Module({
  imports: [
    LoggerModule.forRootAsync({
      providers: [{ provide: LOG_STREAM, useValue: null }],
      inject: [AppConfig, LOG_STREAM],
      useFactory: (config: AppConfig, stream: NodeJS.WritableStream | null) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          // Reuse an upstream request id when present, and always echo it back.
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
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
              '*.currentPassword',
              '*.newPassword',
              '*.temporaryPassword',
              '*.credentials',
              '*.value',
            ],
            censor: '[REDACTED]',
          },
          ...(stream
            ? { stream }
            : {
                transport: config.isProduction
                  ? undefined
                  : { target: 'pino-pretty', options: { singleLine: true } },
              }),
        },
      }),
    }),
  ],
})
export class LoggingModule {}
