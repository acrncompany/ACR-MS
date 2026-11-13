export interface UserEntity {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  passwordHash: string;
  status: 'ACTIVE' | 'DISABLED';
}
