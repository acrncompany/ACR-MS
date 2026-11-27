import { Provider } from '@angular/core';
import { provideRepository } from '../../core/config/repository-provider';
import { ApiDashboardRepository } from './data/api-dashboard.repository';
import { MockDashboardRepository } from './data/mock-dashboard.repository';
import { DashboardRepository } from './domain/dashboard.repository';
import { worksheetsProviders } from '../worksheets/worksheets.providers';

export const dashboardProviders: Provider[] = [
  // The work sheet widgets read the work sheet repository.
  ...worksheetsProviders,
  provideRepository(
    DashboardRepository,
    'dashboard',
    MockDashboardRepository,
    ApiDashboardRepository,
  ),
];
