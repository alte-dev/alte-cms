import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const weakSecretPatterns = ["secret", "changeme", "123456", "password", "default", "admin"];

const secretValidator = z
  .string()
  .min(32, { message: "Secret must be at least 32 characters long" })
  .refine(
    (val) => {
      const lower = val.toLowerCase();
      return !weakSecretPatterns.some(
        (pattern) => lower.startsWith(pattern) || lower === `${pattern}123`,
      );
    },
    { message: "Secret appears to be a trivial or weak default value" },
  );

export const medusaEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .url("DATABASE_URL must be a valid connection URL"),
  REDIS_URL: z
    .string()
    .min(1, "REDIS_URL is required")
    .url("REDIS_URL must be a valid connection URL"),
  JWT_SECRET: secretValidator,
  COOKIE_SECRET: secretValidator,
  STORE_CORS: z.string().min(1, "STORE_CORS is required"),
  ADMIN_CORS: z.string().min(1, "ADMIN_CORS is required"),
  AUTH_CORS: z.string().min(1, "AUTH_CORS is required"),
  MEDUSA_ADMIN_BACKEND_URL: z
    .string()
    .url("MEDUSA_ADMIN_BACKEND_URL must be a valid URL")
    .optional(),
  PORT: z.string().optional().default("9000"),
  HOST: z.string().optional().default("127.0.0.1"),
  MEDUSA_WORKER_MODE: z.enum(["shared", "server", "worker"]).optional().default("shared"),

  // Payment settings & Encryption (Faz 4)
  SETTINGS_ENCRYPTION_KEY: z
    .string()
    .min(32, "SETTINGS_ENCRYPTION_KEY en az 32 bayt (64 hex veya 32 karakter) olmalıdır."),
  API_PUBLIC_URL: z.string().url().optional(),
  WEB_PUBLIC_URL: z.string().url().optional(),

  // Dev-only overrides (Production'da reddedilir)
  DEV_PAYTR_USER_IP: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  PAYTR_API_BASE: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url().optional(),
  ),
});

export type MedusaEnv = z.infer<typeof medusaEnvSchema>;

/**
 * Resolves `cookieOptions.secure`:
 * - In `production`, always defaults to `true` (`COOKIE_SECURE=false` is forbidden in production).
 * - Outside `production`, defaults to `false` unless `COOKIE_SECURE === "true"` or `API_PUBLIC_URL` starts with `https://` (and not explicitly `COOKIE_SECURE === "false"`).
 */
export function resolveCookieSecure(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === "production") {
    return true;
  }
  if (env.COOKIE_SECURE === "false") {
    return false;
  }
  return env.COOKIE_SECURE === "true" || (env.API_PUBLIC_URL?.startsWith("https://") ?? false);
}

export function validateMedusaEnv(): MedusaEnv {
  // Production guard for dev-only overrides
  if (process.env.NODE_ENV === "production") {
    if (process.env.COOKIE_SECURE === "false") {
      throw new Error(
        "[Security] COOKIE_SECURE=false yalnızca geliştirme ortamında kullanılabilir. Production modunda çerez güvenliği kapatılamaz.",
      );
    }
    if (process.env.PAYTR_API_BASE) {
      throw new Error(
        "[Security] PAYTR_API_BASE yalnızca geliştirme ortamında kullanılabilir. Production modunda tanımlanamaz.",
      );
    }
    if (process.env.DEV_PAYTR_USER_IP) {
      throw new Error(
        "[Security] DEV_PAYTR_USER_IP yalnızca geliştirme ortamında kullanılabilir. Production modunda tanımlanamaz.",
      );
    }
  }

  const result = medusaEnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error("❌ FATAL: Medusa environment validation failed (Fail-Closed):");
    console.error(JSON.stringify(formatted, null, 2));
    throw new Error(
      `Invalid Medusa environment variables. Please check your .env configuration against .env.example.`,
    );
  }
  return result.data;
}
