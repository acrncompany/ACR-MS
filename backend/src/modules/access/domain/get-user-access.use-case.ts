import { Injectable } from '@nestjs/common';
import { AccessRepository, UserAccess } from './access.repository.js';

/** The roles a user holds and the union of their permissions. */
@Injectable()
export class GetUserAccessUseCase {
  constructor(private readonly access: AccessRepository) {}

  execute(userId: string): Promise<UserAccess> {
    return this.access.findUserAccess(userId);
  }
}
