import { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Validates input against a Zod schema. A ZodError is mapped to a 400 by the global filter. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
