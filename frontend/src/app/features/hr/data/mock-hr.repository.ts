import { Injectable, inject } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { AttendanceRecord, Employee, LeaveRequest } from '../domain/hr.models';
import { HrRepository } from '../domain/hr.repository';
import { HrStore } from './hr.store';

/** HR records are firm-wide: access is decided by the `hr` module permission, not the hierarchy. */
@Injectable()
export class MockHrRepository extends HrRepository {
  private readonly store = inject(HrStore);

  employees(): Observable<Employee[]> {
    return of(this.store.employees()).pipe(delay(150));
  }

  attendance(): Observable<AttendanceRecord[]> {
    return of(this.store.attendance()).pipe(delay(150));
  }

  leaveRequests(): Observable<LeaveRequest[]> {
    return of(this.store.leaveRequests()).pipe(delay(150));
  }

  decideLeave(id: string, decision: 'Approved' | 'Rejected'): Observable<void> {
    this.store.decideLeave(id, decision);
    return of(undefined);
  }
}
