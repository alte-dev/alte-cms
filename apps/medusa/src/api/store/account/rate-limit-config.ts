export const RATE_LIMIT_OVERRIDE_ENV_VARS = [
  "REGISTER_IP_LIMIT_MAX",
  "REGISTER_EMAIL_LIMIT_MAX",
  "LOGIN_IP_LIMIT_MAX",
  "LOGIN_IP_EMAIL_MAX_FAILURES",
  "LOGIN_EMAIL_MAX_FAILURES",
  "RESET_IP_LIMIT_MAX",
  "RESET_EMAIL_LIMIT_MAX",
  "TOKEN_CONFIRM_IP_LIMIT_MAX",
  "RESEND_VERIFICATION_LIMIT_MAX",
  "CHECKOUT_IP_LIMIT_MAX",
  "IYZICO_CALLBACK_LIMIT_MAX",
] as const;

export interface AccountRateLimitConfig {
  registerIpLimitMax: number;
  registerEmailLimitMax: number;
  loginIpLimitMax: number;
  loginIpEmailMaxFailures: number;
  loginEmailMaxFailures: number;
  resetIpLimitMax: number;
  resetEmailLimitMax: number;
  tokenConfirmIpLimitMax: number;
  resendVerificationLimitMax: number;
}

function readPositiveIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return defaultValue;
  }
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`FAIL-CLOSED: ${name} must be a positive integer, received "${raw}".`);
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`FAIL-CLOSED: ${name} must be >= 1, received "${raw}".`);
  }
  return parsed;
}

export function getAccountRateLimitConfig(): AccountRateLimitConfig {
  return {
    registerIpLimitMax: readPositiveIntEnv("REGISTER_IP_LIMIT_MAX", 5),
    registerEmailLimitMax: readPositiveIntEnv("REGISTER_EMAIL_LIMIT_MAX", 5),
    loginIpLimitMax: readPositiveIntEnv("LOGIN_IP_LIMIT_MAX", 30),
    loginIpEmailMaxFailures: readPositiveIntEnv("LOGIN_IP_EMAIL_MAX_FAILURES", 5),
    loginEmailMaxFailures: readPositiveIntEnv("LOGIN_EMAIL_MAX_FAILURES", 20),
    resetIpLimitMax: readPositiveIntEnv("RESET_IP_LIMIT_MAX", 10),
    resetEmailLimitMax: readPositiveIntEnv("RESET_EMAIL_LIMIT_MAX", 3),
    tokenConfirmIpLimitMax: readPositiveIntEnv("TOKEN_CONFIRM_IP_LIMIT_MAX", 10),
    resendVerificationLimitMax: readPositiveIntEnv("RESEND_VERIFICATION_LIMIT_MAX", 3),
  };
}

/**
 * Startup guard: prohibits any rate-limit override environment variable in production.
 */
export function assertNoRateLimitOverridesInProduction(
  nodeEnv: string = process.env.NODE_ENV || "development",
): void {
  if (nodeEnv !== "production") {
    return;
  }

  for (const envVar of RATE_LIMIT_OVERRIDE_ENV_VARS) {
    const val = process.env[envVar];
    if (val !== undefined && val.trim() !== "") {
      throw new Error(
        `FAIL-CLOSED: ${envVar} environment variable is strictly prohibited in production.`,
      );
    }
  }
}
