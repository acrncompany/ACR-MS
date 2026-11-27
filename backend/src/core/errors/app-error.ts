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

/** 400: well-formed but not acceptable (business validation, as opposed to schema errors). */
export class ValidationError extends AppError {
  constructor(message: string, code = 'VALIDATION_FAILED') {
    super(code, message, 400);
  }
}

/** 409: the request conflicts with the current state (e.g. deleting a user who has history). */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(code, message, 409);
  }
}

/** 429: too many attempts; try again later. */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests. Try again later.') {
    super('TOO_MANY_REQUESTS', message, 429);
  }
}

/** 403: authenticated (or at least well-formed) but not allowed, e.g. a missing CSRF header. */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}
