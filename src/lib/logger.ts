/**
 * 結構化日誌（JSON 輸出至 stdout，供 Render 等平台收集）。
 * 會自動遮蔽密碼、金鑰、下載密碼等敏感欄位。
 */
const SENSITIVE_KEY = /(password|passwd|secret|token|apikey|api_key|authorization|cookie|attachmentpassword|encryption)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[深度過深]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message), stack: value.stack?.split("\n").slice(0, 6).join("\n") };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[已遮蔽]" : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return redactString(value);
  return value;
}

function redactString(s: string) {
  // 遮蔽常見 API 金鑰樣式（例如 Resend re_xxx、Bearer token）
  return s.replace(/\bre_[A-Za-z0-9_]{8,}\b/g, "re_[已遮蔽]").replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [已遮蔽]");
}

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  const min = (process.env.LOG_LEVEL as Level) || "info";
  if (order[level] < (order[min] ?? 20)) return;
  if (process.env.NODE_ENV === "test" && level !== "error" && !process.env.LOG_IN_TESTS) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...(meta ? (redact(meta) as object) : {}) });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => emit("debug", m, meta),
  info: (m: string, meta?: Record<string, unknown>) => emit("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => emit("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => emit("error", m, meta),
};
