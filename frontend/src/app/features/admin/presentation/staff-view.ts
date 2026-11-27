import { formatDate } from '../../../shared/utils/date';
import { StaffMember } from '../domain/admin.models';

/** One staff member prepared for the profile dialog and the printed summary. */
export interface StaffView {
  id: string;
  employeeCode: string;
  name: string;
  designationCode: string;
  position: string;
  department: string;
  role: string;
  manager: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  dateOfJoining: string;
  status: 'Active' | 'Inactive';
}

/** The server already joined position, department, role and manager names into the record. */
export function buildStaffView(user: StaffMember, locale: string): StaffView {
  return {
    id: user.id,
    employeeCode: user.employeeCode,
    name: user.name,
    designationCode: user.designationCode ?? '',
    position: user.positionName ?? '—',
    department: user.departmentName ?? '—',
    role: user.roleName ?? '—',
    manager: user.managerName ? `${user.managerName} (${user.managerCode})` : '—',
    email: user.email,
    phone: user.phone ?? '',
    address: user.address ?? '',
    dateOfBirth: formatDate(user.dateOfBirth, locale),
    dateOfJoining: formatDate(user.dateOfJoining, locale),
    status: user.active ? 'Active' : 'Inactive',
  };
}
