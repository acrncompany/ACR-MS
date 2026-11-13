import { Injectable, inject } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { DirectoryStore } from '../../../core/mock/directory.store';
import { CLIENT_SEEDS } from '../../clients/data/client.seed';
import { HrStore } from '../../hr/data/hr.store';
import { DepartmentRow, Kpi, Overview } from '../domain/dashboard.models';
import { DashboardRepository } from '../domain/dashboard.repository';

/** Firm-wide figures are computed from the other features' sample data so the numbers agree. */
@Injectable()
export class MockDashboardRepository extends DashboardRepository {
  private readonly directory = inject(DirectoryStore);
  private readonly hr = inject(HrStore);

  overview(): Observable<Overview> {
    const kpis: Kpi[] = [
      {
        id: 'clients',
        label: 'Active clients',
        value: CLIENT_SEEDS.length,
        kind: 'count',
        hint: 'On the client master',
        icon: 'apartment',
        tone: 'violet',
        trend: [],
      },
      {
        id: 'staff',
        label: 'Staff',
        value: this.hr.employees().filter((e) => e.status !== 'Inactive').length,
        kind: 'count',
        hint: 'Active employees',
        icon: 'groups',
        tone: 'blue',
        trend: [],
      },
    ];

    return of<Overview>({ kpis, departments: this.departments() }).pipe(delay(200));
  }

  private departments(): DepartmentRow[] {
    const users = this.directory.users().filter((u) => u.active);
    return this.directory
      .departments()
      .map((department) => {
        const members = users.filter(
          (u) => this.directory.position(u.positionId)?.departmentId === department.id,
        );
        return {
          department: department.name,
          head: members[0]?.name ?? '—',
          headcount: members.length,
        };
      })
      .filter((row) => row.headcount > 0);
  }
}
