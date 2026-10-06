// Backend sözleşmesindeki hata kodları + okunabilir Türkçe karşılıkları.

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "TOKEN_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NETWORK"
  | "UNKNOWN";

const ERROR_TR: Record<ErrorCode, string> = {
  VALIDATION_ERROR:
    "Girdiğin bilgiler geçerli değil. Lütfen alanları kontrol edip tekrar dene.",
  UNAUTHORIZED: "Bu işlem için giriş yapman gerekiyor.",
  INVALID_CREDENTIALS: "Kullanıcı adı veya şifre hatalı.",
  TOKEN_EXPIRED: "Oturumunun süresi doldu. Lütfen yeniden giriş yap.",
  FORBIDDEN: "Bu işlemi gerçekleştirme yetkin yok.",
  NOT_FOUND: "Aradığın kayıt bulunamadı.",
  CONFLICT: "Bu kullanıcı adı zaten alınmış. Başka bir tane dene.",
  RATE_LIMITED: "Çok fazla istek yaptın. Lütfen biraz bekleyip tekrar dene.",
  NETWORK: "Sunucuya ulaşılamıyor. İnternet bağlantını kontrol et.",
  UNKNOWN: "Bir şeyler ters gitti. Lütfen birazdan tekrar dene.",
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_TR;
}

/** Hata kodunu okunabilir Türkçe mesaja çevirir. */
export function friendlyMessage(code: string | undefined): string {
  return isErrorCode(code) ? ERROR_TR[code] : ERROR_TR.UNKNOWN;
}

export class ApiError extends Error {
  code: ErrorCode;
  status: number;

  constructor(code: ErrorCode, message?: string, status = 0) {
    super(message ?? friendlyMessage(code));
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }

  /** Kullanıcının görmesi gereken Türkçe mesaj. */
  get friendly(): string {
    return friendlyMessage(this.code);
  }
}

/** HTTP durum kodundan sözleşme hata koduna savunmacı eşleme. */
export function codeFromStatus(status: number): ErrorCode {
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  return "UNKNOWN";
}

/**
 * REST hata gövdesinden kodu çıkarır. Backend `{ error: { code, message } }`,
 * düz `{ code, message }` veya metin gönderebilir; hepsini tolere ederiz.
 */
export function parseErrorBody(
  body: unknown,
  status: number,
): { code: ErrorCode; message?: string } {
  const b = body as
    | { error?: { code?: string; message?: string } | string; code?: string; message?: string }
    | undefined;
  const nested = b && typeof b.error === "object" ? b.error : undefined;
  const code =
    (nested && isErrorCode(nested.code) ? nested.code : undefined) ??
    (b && isErrorCode(b.code) ? b.code : undefined) ??
    (typeof b?.error === "string" && isErrorCode(b.error) ? b.error : undefined) ??
    codeFromStatus(status);
  const message = nested?.message ?? b?.message;
  return { code, message };
}