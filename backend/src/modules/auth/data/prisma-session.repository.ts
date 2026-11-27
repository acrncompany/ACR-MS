import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { NewSession, SessionEntity, SessionRepository } from '../domain/session.repository.js';

const SESSION_SELECT = {
  id: true,
  tenantId: true,
  userId: true,
  expiresAt: true,
  absoluteExpiresAt: true,
  lastUsedAt: true,
  revokedAt: true,
  revokedReason: true,
  replacedById: true,
} as const;

type SessionCreateData = Parameters<PrismaService['client']['session']['create']>[0]['data'];

/** Thrown inside the rotation transaction to roll it back when another refresh won the race. */
class RotationLost extends Error {}

/** The `tenantId` is added by the tenant-scope extension, so it is absent from the input. */
function createData(session: NewSession): SessionCreateData {
  return { ...session } as unknown as SessionCreateData;
}

@Injectable()
export class PrismaSessionRepository extends SessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  create(session: NewSession): Promise<SessionEntity> {
    return this.prisma.client.session.create({
      data: createData(session),
      select: SESSION_SELECT,
    });
  }

  findByTokenHash(hash: string): Promise<SessionEntity | null> {
    return this.prisma.client.session.findFirst({
      where: { refreshTokenHash: hash },
      select: SESSION_SELECT,
    });
  }

  async findUsable(
    sessionId: string,
    userId: string,
    now: Date,
  ): Promise<{ mustChangePassword: boolean } | null> {
    // Reads the user and tenant status through the session's relations: auth-owned, read-only,
    // and it keeps the per-request check to a single query.
    const row = await this.prisma.client.session.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
        user: { status: 'ACTIVE', deletedAt: null },
        tenant: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true, user: { select: { mustChangePassword: true } } },
    });
    return row ? { mustChangePassword: row.user.mustChangePassword } : null;
  }

  async rotate(previousId: string, next: NewSession, now: Date): Promise<SessionEntity | null> {
    try {
      return await this.prisma.tx(async (tx) => {
        const created = await tx.session.create({ data: createData(next), select: SESSION_SELECT });
        const updated = await tx.session.updateMany({
          where: { id: previousId, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'rotated', replacedById: created.id },
        });
        if (updated.count !== 1) throw new RotationLost();
        return created;
      });
    } catch (error) {
      if (error instanceof RotationLost) return null;
      throw error;
    }
  }

  async revoke(sessionId: string, reason: string, now: Date): Promise<void> {
    await this.prisma.client.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });
  }

  revokeChain(sessionId: string, reason: string, now: Date): Promise<number> {
    return this.prisma.tx(async (tx) => {
      let revoked = 0;
      let currentId: string | null = sessionId;
      // Follows replacedById forward to the newest session; bounded in case of corrupt data.
      for (let hops = 0; currentId && hops < 1000; hops++) {
        const session: { revokedAt: Date | null; replacedById: string | null } | null =
          await tx.session.findFirst({
            where: { id: currentId },
            select: { revokedAt: true, replacedById: true },
          });
        if (!session) break;
        if (!session.revokedAt) {
          const result = await tx.session.updateMany({
            where: { id: currentId, revokedAt: null },
            data: { revokedAt: now, revokedReason: reason },
          });
          revoked += result.count;
        }
        currentId = session.replacedById;
      }
      return revoked;
    });
  }

  async revokeOthers(
    userId: string,
    keepSessionId: string,
    reason: string,
    now: Date,
  ): Promise<number> {
    const result = await this.prisma.client.session.updateMany({
      where: { userId, revokedAt: null, id: { not: keepSessionId } },
      data: { revokedAt: now, revokedReason: reason },
    });
    return result.count;
  }

  async revokeAllForUser(userId: string, reason: string, now: Date): Promise<number> {
    const result = await this.prisma.client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });
    return result.count;
  }
}
