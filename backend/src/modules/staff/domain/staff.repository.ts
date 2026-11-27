import {
  NewStaff,
  StaffAuditSpec,
  StaffChanges,
  StaffPage,
  StaffQuery,
  StaffRecord,
} from './staff.records.js';

export abstract class StaffRepository {
  abstract list(query: StaffQuery): Promise<StaffPage>;
  /** Preview of the employee code the next create will get (reserves nothing). */
  abstract peekNextCode(): Promise<string>;
  abstract findById(id: string): Promise<StaffRecord | null>;
  /** The user and everyone who reports to them, directly or indirectly. */
  abstract subtreeIds(userId: string): Promise<string[]>;
  abstract countReports(userId: string): Promise<number>;
  /** Issues the employee code and inserts user, role and branch access with the audit row. */
  abstract create(input: NewStaff, audit: StaffAuditSpec): Promise<StaffRecord>;
  abstract update(id: string, changes: StaffChanges, audit: StaffAuditSpec): Promise<StaffRecord>;
  abstract setStatus(
    id: string,
    status: 'ACTIVE' | 'DISABLED',
    audit: StaffAuditSpec,
  ): Promise<void>;
  /** Soft delete: the row stays (code and audit references stay valid), the email is released. */
  abstract softDelete(id: string, audit: StaffAuditSpec): Promise<void>;
}
