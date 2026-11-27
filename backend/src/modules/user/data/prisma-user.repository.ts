import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { ActiveUser, LoginFailureResult, UserEntity } from '../domain/user.entity.js';
import { UserRepository } from '../domain/user.repository.js';

const USER_SELECT = {
  id: true,
  tenantId: true,
  email: true,
  name: true,
  employeeCode: true,
  passwordHash: true,
  mustChangePassword: true,
  status: true,
  positionId: true,
  failedLoginCount: true,
  lockedUntil: true,
} as const;

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // tenantId is added automatically by the tenant-scope extension.
  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.prisma.client.user.findFirst({
      where: { email, deletedAt: null },
      select: USER_SELECT,
    });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.prisma.client.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
  }

  async setPassword(userId: string, passwordHash: string, mustChange: boolean): Promise<void> {
    await this.prisma.client.user.updateMany({
      where: { id: userId, deletedAt: null },
      data: {
        passwordHash,
        mustChangePassword: mustChange,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  }

  listActive(): Promise<ActiveUser[]> {
    return this.prisma.client.user.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, employeeCode: true, positionId: true },
      orderBy: { name: 'asc' },
    });
  }

  async findActiveIds(ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.client.user.findMany({
      where: { id: { in: ids }, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  recordLoginFailure(
    userId: string,
    now: Date,
    maxFailures: number,
    lockUntil: Date,
  ): Promise<LoginFailureResult> {
    return this.prisma.tx(async (tx) => {
      // Row lock so two parallel wrong passwords cannot both read the same counter.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findFirstOrThrow({
        where: { id: userId },
        select: { failedLoginCount: true, lockedUntil: true },
      });
      const lockExpired = user.lockedUntil !== null && user.lockedUntil <= now;
      const stillLocked = user.lockedUntil !== null && user.lockedUntil > now;
      const failedLoginCount = (lockExpired ? 0 : user.failedLoginCount) + 1;
      // An active lock is never extended by further attempts.
      const lockNow = !stillLocked && failedLoginCount >= maxFailures;
      const lockedUntil = lockNow ? lockUntil : stillLocked ? user.lockedUntil : null;
      await tx.user.updateMany({
        where: { id: userId },
        data: { failedLoginCount, lockedUntil },
      });
      return { failedLoginCount, lockedNow: lockNow, lockedUntil };
    });
  }

  async recordLoginSuccess(userId: string, now: Date): Promise<void> {
    await this.prisma.client.user.updateMany({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
    });
  }
}
