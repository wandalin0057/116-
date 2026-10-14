export class AppError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "找不到資料") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "您沒有權限執行此操作") {
    super(message, 403, "FORBIDDEN");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "請先登入") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly fieldErrors?: Record<string, string[] | undefined>) {
    super(message, 422, "VALIDATION_ERROR");
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  return "系統發生錯誤，請稍後再試";
}
