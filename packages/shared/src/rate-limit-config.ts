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
