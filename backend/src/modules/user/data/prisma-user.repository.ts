import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service.js';
import { UserEntity } from '../domain/user.entity.js';
import { UserRepository } from '../domain/user.repository.js';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // tenantId is added automatically by the tenant-scope extension.
  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.prisma.client.user.findFirst({
      where: { email, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        passwordHash: true,
        status: true,
      },
    });
  }
}
