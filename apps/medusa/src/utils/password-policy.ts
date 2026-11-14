import { COMMON_PASSWORDS } from "./common-passwords";

export const CUSTOMER_PASSWORD_MIN_LENGTH = 10;
export const CUSTOMER_PASSWORD_MAX_LENGTH = 128;

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a customer password against minimum/maximum length,
 * common password blocklist, and email local-part inclusion.
 */
export function validateCustomerPassword(
  password: string,
  email?: string,
): PasswordValidationResult {
  if (typeof password !== "string" || password.length < CUSTOMER_PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Parola en az ${CUSTOMER_PASSWORD_MIN_LENGTH} karakter olmalıdır.`,
    };
  }

  if (password.length > CUSTOMER_PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      error: `Parola en fazla ${CUSTOMER_PASSWORD_MAX_LENGTH} karakter olabilir.`,
    };
  }

  const normalized = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      error: "Bu parola çok yaygın kullanılıyor. Lütfen daha güçlü bir parola seçiniz.",
    };
  }

  if (email && typeof email === "string") {
    const localPart = email.trim().toLowerCase().split("@")[0];
    if (localPart && localPart.length >= 3 && normalized.includes(localPart)) {
      return {
        valid: false,
        error: "Parola e-posta adresinizin kullanıcı adını içeremez.",
      };
    }
  }

  return { valid: true };
}
