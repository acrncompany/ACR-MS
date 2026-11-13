/** Base class for expected, domain-level failures. Mapped to HTTP by the global filter. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Invalid credentials') {
    super('UNAUTHORIZED', message, 401);
  }
}

/** Thrown when tenant-scoped data is accessed outside a resolved tenant context. */
export class TenantContextMissingError extends AppError {
  constructor() {
    super('TENANT_CONTEXT_MISSING', 'Tenant could not be resolved for this request', 400);
  }
}
