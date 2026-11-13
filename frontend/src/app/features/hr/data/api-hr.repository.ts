import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import { AttendanceRecord, Employee, LeaveRequest } from '../domain/hr.models';
import { HrRepository } from '../domain/hr.repository';

/** Real implementation. Endpoints are placeholders until the backend module exists. */
@Injectable()
export class ApiHrRepository extends HrRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private url(path: string): string {
    return `${this.config.config.api.baseUrl}/hr${path}`;
  }

  employees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(this.url('/employees'));
  }

  attendance(): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(this.url('/attendance'));
  }

  leaveRequests(): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(this.url('/leave-requests'));
  }

  decideLeave(id: string, decision: 'Approved' | 'Rejected'): Observable<void> {
    return this.http.post<void>(this.url(`/leave-requests/${id}/decision`), { decision });
  }
}
