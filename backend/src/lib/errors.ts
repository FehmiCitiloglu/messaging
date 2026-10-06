export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  // Extra code for unforeseen server faults (contract codes above are unchanged).
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeName = (typeof ErrorCode)[keyof typeof ErrorCode];

export class ApiError extends Error {
  readonly code: ErrorCodeName;
  readonly status: number;

  constructor(code: ErrorCodeName, status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }

  toJSON(): { error: { code: ErrorCodeName; message: string } } {
    return { error: { code: this.code, message: this.message } };
  }
}

export const errors = {
  validation: (message = "Invalid request") =>
    new ApiError(ErrorCode.VALIDATION_ERROR, 400, message),
  unauthorized: (message = "Authentication required") =>
    new ApiError(ErrorCode.UNAUTHORIZED, 401, message),
  invalidCredentials: (message = "Invalid username or password") =>
    new ApiError(ErrorCode.INVALID_CREDENTIALS, 401, message),
  tokenExpired: (message = "Access token expired") =>
    new ApiError(ErrorCode.TOKEN_EXPIRED, 401, message),
  forbidden: (message = "You do not have access to this resource") =>
    new ApiError(ErrorCode.FORBIDDEN, 403, message),
  notFound: (message = "Resource not found") =>
    new ApiError(ErrorCode.NOT_FOUND, 404, message),
  conflict: (message = "Resource already exists") =>
    new ApiError(ErrorCode.CONFLICT, 409, message),
  rateLimited: (message = "Too many requests, please slow down") =>
    new ApiError(ErrorCode.RATE_LIMITED, 429, message),
  internal: (message = "Internal server error") =>
    new ApiError(ErrorCode.INTERNAL_ERROR, 500, message),
} as const;