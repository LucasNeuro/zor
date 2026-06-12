import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function encryptionKey(): Buffer | null {
  const raw = process.env.HUB_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const buf = Buffer.from(raw, "base64");
  if (buf.length === KEY_BYTES) return buf;

  return null;
}

export function credentialsEncryptionConfigured(): boolean {
  return encryptionKey() != null;
}

/** Encripta texto sensível (tokens OAuth). Formato: v1:iv:tag:ciphertext (base64url). */
export function encryptCredentialPlaintext(plaintext: string): string {
  const key = encryptionKey();
  if (!key) {
    throw new Error("HUB_CREDENTIALS_ENCRYPTION_KEY inválida ou ausente (32 bytes hex ou base64).");
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(
    ":"
  );
}

export function decryptCredentialCiphertext(payload: string): string {
  const key = encryptionKey();
  if (!key) {
    throw new Error("HUB_CREDENTIALS_ENCRYPTION_KEY inválida ou ausente (32 bytes hex ou base64).");
  }

  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Formato de credencial encriptada inválido.");
  }

  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Assina state OAuth (HMAC-SHA256). */
export function signOAuthState(payloadB64: string): string {
  const key = encryptionKey();
  if (!key) {
    throw new Error("HUB_CREDENTIALS_ENCRYPTION_KEY inválida ou ausente (32 bytes hex ou base64).");
  }
  return createHmac("sha256", key).update(payloadB64).digest("base64url");
}

export function verifyOAuthState(payloadB64: string, signature: string): boolean {
  const expected = signOAuthState(payloadB64);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
