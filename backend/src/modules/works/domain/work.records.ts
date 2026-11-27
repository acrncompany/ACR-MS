export interface WorkRecord {
  id: string;
  /** WRK-0001... Permanent, issued once, never reused. */
  code: string;
  /** The name users see. */
  name: string;
}

export interface WorkQuery {
  q: string | null;
  page: number;
  pageSize: number;
}

export interface WorkPage {
  items: WorkRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkAuditSpec {
  action: string;
  userId: string;
  changes: Record<string, unknown>;
}
