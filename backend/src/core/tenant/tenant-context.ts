import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { TenantContextMissingError } from '../errors/app-error.js';

interface TenantStore {
  tenantId: string;
}

/**
 * Request-scoped tenant, carried by AsyncLocalStorage. The tenantId is resolved by the server
 * (subdomain, then the verified token) and is never read from a request body or params.
 */
@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  /** Runs `fn` with the given tenant; the context ends when `fn` finishes. */
  run<T>(tenantId: string, fn: () => T): T {
    return this.storage.run({ tenantId }, fn);
  }

  getTenantId(): string {
    const store = this.storage.getStore();
    if (!store) throw new TenantContextMissingError();
    return store.tenantId;
  }

  hasTenant(): boolean {
    return this.storage.getStore() !== undefined;
  }
}
