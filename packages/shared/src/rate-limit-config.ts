import { createRequire } from "module";

const require = createRequire(import.meta.url);
const envVars = require("./rate-limit-override-env-vars.json") as string[];

export const RATE_LIMIT_OVERRIDE_ENV_VARS = envVars as readonly string[];

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
