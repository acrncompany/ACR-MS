import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { clientsProviders } from '../clients/clients.providers';
import { ApiWorksheetRepository } from './data/api-worksheet.repository';
import { MockWorksheetRepository } from './data/mock-worksheet.repository';
import { WorksheetRepository } from './domain/worksheet.repository';
import { WorksheetContext } from './presentation/worksheet.context';

/** Work sheets read the client master, so the clients repository comes along. */
export const worksheetsProviders: Provider[] = [
  ...clientsProviders,
  provideRepository(
    WorksheetRepository,
    'worksheets',
    MockWorksheetRepository,
    ApiWorksheetRepository,
  ),
  WorksheetContext,
];
