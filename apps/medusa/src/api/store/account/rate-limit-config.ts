import {
  RATE_LIMIT_OVERRIDE_ENV_VARS,
  assertNoRateLimitOverridesInProduction,
} from "../../../../../../packages/shared/src/rate-limit-config";

export { RATE_LIMIT_OVERRIDE_ENV_VARS, assertNoRateLimitOverridesInProduction };

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
