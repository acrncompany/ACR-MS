import { HttpErrorResponse } from '@angular/common/http';

/** The error body the backend sends for every failure. */
interface ApiErrorBody {
  statusCode?: number;
  code?: string;
  message?: string;
  details?: { path: string; message: string }[];
}

export interface ApiError {
  status: number;
  /** Machine-readable code, e.g. HAS_HISTORY, WEAK_PASSWORD, INVALID_PASSWORD. */
  code: string | null;
  /** A readable message safe to show to the user. */
  message: string;
  /** Per-field problems of a 400 VALIDATION_FAILED, keyed by field path (e.g. "directors.0.din"). */
  fields: Record<string, string>;
}

/** Turns anything thrown by an HTTP call into a readable error. Never exposes internals. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    const body = (typeof error.error === 'object' ? error.error : null) as ApiErrorBody | null;
    if (error.status === 0) {
      return {
        status: 0,
        code: null,
        message: 'Cannot reach the server. Check your connection and try again.',
        fields: {},
      };
    }
    const fields = Object.fromEntries((body?.details ?? []).map((d) => [d.path, d.message]));
    return {
      status: error.status,
      code: body?.code ?? null,
      message: messageFor(error.status, body, fields),
      fields,
    };
  }
  if (error instanceof Error) return { status: -1, code: null, message: error.message, fields: {} };
  return { status: -1, code: null, message: 'Something went wrong. Try again.', fields: {} };
}

export function apiErrorMessage(error: unknown): string {
  return toApiError(error).message;
}

function messageFor(
  status: number,
  body: ApiErrorBody | null,
  fields: Record<string, string>,
): string {
  const first = Object.entries(fields)[0];
  if (status === 400 && first) return `${first[0]}: ${first[1]}`;
  if (body?.message && status < 500) return body.message;
  switch (status) {
    case 401:
      return 'Your session has ended. Sign in again.';
    case 403:
      return 'You do not have permission to do this.';
    case 404:
      return 'This record no longer exists.';
    case 409:
      return 'This conflicts with existing data.';
    case 429:
      return 'Too many attempts. Wait a moment and try again.';
    default:
      return status >= 500 ? 'The server had a problem. Try again later.' : 'The request failed.';
  }
}
