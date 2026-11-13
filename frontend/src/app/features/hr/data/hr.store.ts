import { Injectable, inject, signal } from '@angular/core';
import { DirectoryStore } from '../../../core/mock/directory.store';
import { addDays, todayIso } from '../../../shared/utils/date';
import { AttendanceRecord, Employee, LeaveRequest } from '../domain/hr.models';

/** Staff who are not system users (articled assistants, interns, office support). */
const EXTRA_STAFF: { name: string; designation: string; department: string; location: string }[] = [];

interface LeaveSeed {
  employee: string;
  type: LeaveRequest['type'];
  from: number;
  days: number;
  reason: string;
  status: LeaveRequest['status'];
}

const LEAVE_SEEDS: LeaveSeed[] = [];

/** Mock HR state shared across the HR pages; leave decisions persist until reload. */
@Injectable({ providedIn: 'root' })
export class HrStore {
  private readonly directory = inject(DirectoryStore);
  private readonly today = todayIso();
  private readonly leave = signal<LeaveRequest[]>(
    LEAVE_SEEDS.map((l, i) => ({
      id: `lv-${i + 1}`,
      employee: l.employee,
      type: l.type,
      fromDate: addDays(this.today, l.from),
      toDate: addDays(this.today, l.from + l.days - 1),
      days: l.days,
      reason: l.reason,
      status: l.status,
    })),
  );

  leaveRequests(): LeaveRequest[] {
    return this.leave();
  }

  decideLeave(id: string, decision: 'Approved' | 'Rejected'): void {
    this.leave.update((list) => list.map((l) => (l.id === id ? { ...l, status: decision } : l)));
  }

  employees(): Employee[] {
    const onLeaveToday = new Set(
      this.leave()
        .filter(
          (l) => l.status === 'Approved' && l.fromDate <= this.today && l.toDate >= this.today,
        )
        .map((l) => l.employee),
    );
    const fromUsers = this.directory.users().map((u, i) => {
      const position = this.directory.position(u.positionId);
      return {
        name: u.name,
        designation: position?.title ?? '',
        department: this.directory.department(position?.departmentId ?? '')?.name ?? '',
        location: 'Chennai',
        email: u.email,
        active: u.active,
        index: i,
      };
    });
    const extras = EXTRA_STAFF.map((s, i) => ({
      ...s,
      email: `${s.name.split(' ')[0].toLowerCase()}@acr.demo`,
      active: true,
      index: fromUsers.length + i,
    }));
    return [...fromUsers, ...extras].map<Employee>((s) => ({
      id: `emp-${s.index + 1}`,
      code: `ACR-E${String(s.index + 1).padStart(3, '0')}`,
      name: s.name,
      designation: s.designation,
      department: s.department,
      location: s.location,
      joinDate: addDays(this.today, -(180 + s.index * 97)),
      email: s.email,
      status: !s.active ? 'Inactive' : onLeaveToday.has(s.name) ? 'On leave' : 'Active',
    }));
  }

  attendance(): AttendanceRecord[] {
    return [];
  }
}
