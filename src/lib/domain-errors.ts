export const domainErrorCodes = [
  "AUTHENTICATION_REQUIRED",
  "PERMISSION_DENIED",
  "RESOURCE_NOT_FOUND",
  "REVISION_CONFLICT",
  "QUOTA_EXCEEDED",
  "RATE_LIMITED",
  "VALIDATION_ERROR",
  "STORAGE_TRANSACTION_ERROR",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "LEASE_LOST",
  "INTERNAL_ERROR",
] as const;

export type DomainErrorCode = (typeof domainErrorCodes)[number];

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(
    code: DomainErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.code = code;
    this.name = new.target.name;
  }
}

export class AuthenticationRequiredError extends DomainError {
  constructor(message = "認証が必要です。") {
    super("AUTHENTICATION_REQUIRED", message);
  }
}

export class PermissionDeniedError extends DomainError {
  constructor(message = "この操作を実行する権限がありません。") {
    super("PERMISSION_DENIED", message);
  }
}

export class ResourceNotFoundError extends DomainError {
  constructor(message = "対象が見つかりません。") {
    super("RESOURCE_NOT_FOUND", message);
  }
}

export class RevisionConflictError extends DomainError {
  constructor(message = "別の編集と競合しました。最新状態を再読込してください。") {
    super("REVISION_CONFLICT", message);
  }
}

export class ValidationError extends DomainError {
  constructor(message = "入力内容が不正です。") {
    super("VALIDATION_ERROR", message);
  }
}

export class QuotaExceededError extends DomainError {
  constructor(message = "利用上限に達しました。") {
    super("QUOTA_EXCEEDED", message);
  }
}

export class RateLimitedError extends DomainError {
  constructor(message = "リクエストが集中しています。後でもう一度お試しください。") {
    super("RATE_LIMITED", message);
  }
}

export class StorageTransactionError extends DomainError {
  constructor(message = "Storage処理を完了できませんでした。") {
    super("STORAGE_TRANSACTION_ERROR", message);
  }
}

export class ProviderUnavailableError extends DomainError {
  constructor(message = "AI Providerを利用できません。") {
    super("PROVIDER_UNAVAILABLE", message);
  }
}

export class ProviderTimeoutError extends DomainError {
  constructor(message = "AI Providerがタイムアウトしました。") {
    super("PROVIDER_TIMEOUT", message);
  }
}

export class LeaseLostError extends DomainError {
  constructor(message = "処理の実行権限を失いました。") {
    super("LEASE_LOST", message);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
