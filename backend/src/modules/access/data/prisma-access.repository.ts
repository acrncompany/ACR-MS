import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { AccessRepository, RoleWithPermissions, UserAccess } from '../domain/access.repository.js';

@Injectable()
export class PrismaAccessRepository extends AccessRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listRoles(): Promise<RoleWithPermissions[]> {
    const roles = await this.prisma.client.role.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      permissions: r.permissions.map((p) => p.permission.key).sort(),
    }));
  }

  async findUserAccess(userId: string): Promise<UserAccess> {
    const rows = await this.prisma.client.userRole.findMany({
      where: { userId, role: { deletedAt: null } },
      select: {
        role: {
          select: {
            id: true,
            key: true,
            name: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });
    const permissions = new Set<string>();
    for (const row of rows) {
      for (const p of row.role.permissions) permissions.add(p.permission.key);
    }
    return {
      roles: rows.map((r) => ({ id: r.role.id, key: r.role.key, name: r.role.name })),
      permissions: [...permissions].sort(),
    };
  }
}
