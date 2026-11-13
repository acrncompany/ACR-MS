import { Observable } from 'rxjs';
import { AttendanceRecord, Employee, LeaveRequest } from './hr.models';

export abstract class HrRepository {
  abstract employees(): Observable<Employee[]>;
  abstract attendance(): Observable<AttendanceRecord[]>;
  abstract leaveRequests(): Observable<LeaveRequest[]>;
  abstract decideLeave(id: string, decision: 'Approved' | 'Rejected'): Observable<void>;
}
