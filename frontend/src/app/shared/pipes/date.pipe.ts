import { Pipe, PipeTransform, inject } from '@angular/core';
import { AppConfigService } from '../../core/config/app-config.service';
import { formatDate } from '../utils/date';

/** Formats an ISO date using the locale from runtime config (dd/MM/yyyy for en-IN). */
@Pipe({ name: 'appDate' })
export class AppDatePipe implements PipeTransform {
  private readonly locale = inject(AppConfigService).config.locale.locale;

  transform(value: string | null | undefined): string {
    return formatDate(value, this.locale);
  }
}
