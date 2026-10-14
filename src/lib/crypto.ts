import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * 敏感欄位（例如附件下載密碼）加密：AES-256-GCM。
 * DATA_ENCRYPTION_KEY 為 base64 編碼之 32 bytes 金鑰（`openssl rand -base64 32`）。
 */
function getKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error("DATA_ENCRYPTION_KEY 未設定");
  const buf = Buffer.from(raw, "base64");
  if (buf.length === 32) return buf;
  // 非標準長度時，以 SHA-256 衍生 32 bytes 金鑰
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [ver, ivB64, tagB64, dataB64] = payload.split(":");
  if (ver !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("加密資料格式錯誤");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
