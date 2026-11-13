export interface Kpi {
  id: string;
  label: string;
  /** Rupees for `money`, a plain number for `count`, 0-100 for `percent`. */
  value: number;
  kind: 'money' | 'count' | 'percent';
  hint: string;
  icon: string;
  tone: 'green' | 'blue' | 'amber' | 'red' | 'violet';
  trend: number[];
}

export interface DepartmentRow {
  department: string;
  head: string;
  headcount: number;
}

export interface Overview {
  kpis: Kpi[];
  departments: DepartmentRow[];
}
