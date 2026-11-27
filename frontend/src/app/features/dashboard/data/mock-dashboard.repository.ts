import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { Kpi, Overview } from '../domain/dashboard.models';
import { DashboardRepository } from '../domain/dashboard.repository';

/**
 * Still sample data (the dashboard has no backend yet). Clients and staff now live in the real
 * backend and are not mirrored here, so these figures are empty placeholders, not real counts.
 */
@Injectable()
export class MockDashboardRepository extends DashboardRepository {
  overview(): Observable<Overview> {
    const kpis: Kpi[] = [
      {
        id: 'clients',
        label: 'Active clients',
        value: 0,
        kind: 'count',
        hint: 'Sample dashboard: not connected yet',
        icon: 'apartment',
        tone: 'violet',
        trend: [],
      },
      {
        id: 'staff',
        label: 'Staff',
        value: 0,
        kind: 'count',
        hint: 'Sample dashboard: not connected yet',
        icon: 'groups',
        tone: 'blue',
        trend: [],
      },
    ];
    return of<Overview>({ kpis, departments: [] }).pipe(delay(200));
  }
}
