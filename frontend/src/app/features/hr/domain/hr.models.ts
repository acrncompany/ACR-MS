export interface Employee {
  id: string;
  code: string;
  name: string;
  designation: string;
  department: string;
  location: string;
  joinDate: string;
  email: string;
  status: 'Active' | 'On leave' | 'Inactive';
}

export interface AttendanceRecord {
  id: string;
  date: string;
  employee: string;
  status: 'Present' | 'Absent' | 'On leave' | 'Half day';
  checkIn: string;
  checkOut: string;
  hours: number;
}

export interface LeaveRequest {
  id: string;
  employee: string;
  type: 'Casual' | 'Sick' | 'Earned' | 'Compensatory off';
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}
