import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ColDef } from 'ag-grid-community';
import { SessionService } from '../../../core/auth/session.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import {
  dateColumn,
  decisionColumn,
  numberColumn,
  statusColumn,
  textColumn,
} from '../../../shared/ag-grid';
import { DataPage, SummaryItem } from '../../../shared/components/data-page/data-page';
import { loaded } from '../../../shared/utils/loaded';
import { AttendanceRecord, LeaveRequest } from '../domain/hr.models';
import { HrRepository } from '../domain/hr.repository';

@Component({
  selector: 'app-attendance-page',
  imports: [DataPage],
  template: `
    <app-data-page title="Attendance" [summary]="summary()" [columns]="columns" [rows]="rows()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendancePage {
  private readonly locale = inject(AppConfigService).config.locale.locale;
  protected readonly rows = loaded(() => inject(HrRepository).attendance()).rows;

  protected readonly columns: ColDef<AttendanceRecord>[] = [
    dateColumn<AttendanceRecord>('date', 'Date', this.locale),
    { ...textColumn<AttendanceRecord>('employee', 'Employee', 2), minWidth: 160 },
    textColumn<AttendanceRecord>('checkIn', 'Check-in'),
    textColumn<AttendanceRecord>('checkOut', 'Check-out'),
    numberColumn<AttendanceRecord>('hours', 'Hours'),
    statusColumn<AttendanceRecord>('status'),
  ];

  protected readonly summary = computed<SummaryItem[]>(() => {
    const rows = this.rows();
    const latest = rows
      .map((r) => r.date)
      .sort()
      .at(-1);
    const today = rows.filter((r) => r.date === latest);
    const count = (status: AttendanceRecord['status']) =>
      today.filter((r) => r.status === status).length;
    return [
      {
        label: 'Present today',
        value: String(count('Present') + count('Half day')),
        icon: 'how_to_reg',
      },
      { label: 'Absent today', value: String(count('Absent')), icon: 'person_off', tone: 'red' },
      {
        label: 'On leave today',
        value: String(count('On leave')),
        icon: 'beach_access',
        tone: 'amber',
      },
    ];
  });
}

@Component({
  selector: 'app-leave-page',
  imports: [DataPage],
  template: `
    <app-data-page
      title="Leave requests"
      [summary]="summary()"
      [columns]="columns()"
      [rows]="rows()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeavePage {
  private readonly repo = inject(HrRepository);
  private readonly locale = inject(AppConfigService).config.locale.locale;
  private readonly session = inject(SessionService);
  private readonly list = loaded(() => this.repo.leaveRequests());
  protected readonly rows = this.list.rows;

  protected readonly columns = computed<ColDef<LeaveRequest>[]>(() => {
    const base: ColDef<LeaveRequest>[] = [
      { ...textColumn<LeaveRequest>('employee', 'Employee', 2), minWidth: 160 },
      textColumn<LeaveRequest>('type', 'Type'),
      dateColumn<LeaveRequest>('fromDate', 'From', this.locale),
      dateColumn<LeaveRequest>('toDate', 'To', this.locale),
      numberColumn<LeaveRequest>('days', 'Days'),
      { ...textColumn<LeaveRequest>('reason', 'Reason', 3), minWidth: 200 },
      statusColumn<LeaveRequest>('status'),
    ];
    if (this.session.can('hr.approve')) {
      base.push(
        decisionColumn<LeaveRequest>(
          (row) => row.status === 'Pending',
          (row, decision) =>
            this.repo.decideLeave(row.id, decision).subscribe(() => this.list.reload()),
        ),
      );
    }
    return base;
  });

  protected readonly summary = computed<SummaryItem[]>(() => {
    const rows = this.rows();
    const count = (status: LeaveRequest['status']) =>
      rows.filter((r) => r.status === status).length;
    return [
      { label: 'Pending', value: String(count('Pending')), icon: 'hourglass_top', tone: 'amber' },
      { label: 'Approved', value: String(count('Approved')), icon: 'check_circle' },
      { label: 'Rejected', value: String(count('Rejected')), icon: 'cancel', tone: 'red' },
    ];
  });
}
