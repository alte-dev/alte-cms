import crypto from "crypto";

/**
 * Validates the encryption key from environment variable.
 * Must be strictly 32 bytes (256 bits).
 * Supports 64-char Hex string, 44-char Base64 string, or 32-char raw buffer.
 * Throws an explicit error (fail-closed) if key is missing, weak, or invalid.
 */
export function parseEncryptionKey(rawKey: string | undefined): Buffer {
  if (!rawKey || typeof rawKey !== "string") {
    throw new Error(
      "[Security] SETTINGS_ENCRYPTION_KEY ortam değişkeni tanımlanmamış. Güvenlik nedeniyle başlatma durduruldu (fail-closed).",
    );
  }

  const trimmed = rawKey.trim();

  // Weak/default key blacklist
  const forbiddenKeys = [
    "0000000000000000000000000000000000000000000000000000000000000000",
    "12345678901234567890123456789012",
    "default-encryption-key-must-change",
    "secret-encryption-key-32-chars!",
  ];

  if (forbiddenKeys.includes(trimmed.toLowerCase())) {
    throw new Error(
      "[Security] SETTINGS_ENCRYPTION_KEY zayıf/varsayılan bir değer içeriyor. Lütfen güvenli ve rastgele 32 baytlık bir anahtar oluşturun.",
    );
  }

  // 1. Try 64-character Hex string (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  // 2. Try Base64 string that decodes to 32 bytes
  try {
    const b64Buf = Buffer.from(trimmed, "base64");
    if (b64Buf.length === 32) {
      return b64Buf;
    }
  } catch {
    // continue
  }

  // 3. Try UTF-8 string that is exactly 32 bytes
  const utf8Buf = Buffer.from(trimmed, "utf8");
  if (utf8Buf.length === 32) {
    return utf8Buf;
  }

  throw new Error(
    `[Security] SETTINGS_ENCRYPTION_KEY geçersiz. Anahtar tam olarak 32 bayt (64 hex karakteri veya 32 karakter ASCII/Base64) olmalıdır. Mevcut uzunluk: ${utf8Buf.length} bayt.`,
  );
}

/**
 * Encrypts sensitive plain text using AES-256-GCM.
 * Output format: <iv_hex>:<auth_tag_hex>:<cipher_text_hex>
 */
export function encryptSetting(plainText: string, keyBuffer: Buffer): string {
  if (!plainText) return "";

  const iv = crypto.randomBytes(12); // 96-bit IV standard for AES-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts encrypted text using AES-256-GCM.
 * Fails closed and throws an error if ciphertext is tampered, corrupted, or key is wrong.
 */
export function decryptSetting(encryptedText: string, keyBuffer: Buffer): string {
  if (!encryptedText) return "";

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "[Security] Şifreli ayar metni bozuk veya geçersiz biçimde (beklenen format: iv:tag:ciphertext).",
    );
  }

  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error("[Security] Şifreli ayar IV veya AuthTag boyutu geçersiz.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(dataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err: any) {
    throw new Error(
      `[Security] Şifre çözme doğrulaması başarısız oldu (kurcalanmış veri veya yanlış anahtar): ${err.message}`,
    );
  }
}

/**
 * Masks a secret string showing only the last 4 characters.
 * Example: "my-secret-key-1234" -> "••••••••••••1234"
 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return "";
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return "••••";
  const maskedPrefix = "•".repeat(Math.min(trimmed.length - 4, 16));
  return `${maskedPrefix}${trimmed.slice(-4)}`;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
