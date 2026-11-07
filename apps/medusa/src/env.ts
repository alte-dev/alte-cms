import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables from .env if present
dotenv.config();

const weakSecretPatterns = ["secret", "changeme", "123456", "password", "default", "admin"];

const secretValidator = z
  .string({ required_error: "Secret is required" })
  .min(32, { message: "Secret must be at least 32 characters long" })
  .refine(
    (val) => {
      const lower = val.toLowerCase();
      // Block common weak patterns if secret starts with or contains trivial keywords
      return !weakSecretPatterns.some(
        (pattern) => lower.startsWith(pattern) || lower === `${pattern}123`,
      );
    },
    { message: "Secret appears to be a trivial or weak default value" },
  );

export const medusaEnvSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .url("DATABASE_URL must be a valid connection URL"),
  REDIS_URL: z
    .string({ required_error: "REDIS_URL is required" })
    .url("REDIS_URL must be a valid connection URL"),
  JWT_SECRET: secretValidator,
  COOKIE_SECRET: secretValidator,
  STORE_CORS: z.string({ required_error: "STORE_CORS is required" }).min(1),
  ADMIN_CORS: z.string({ required_error: "ADMIN_CORS is required" }).min(1),
  AUTH_CORS: z.string({ required_error: "AUTH_CORS is required" }).min(1),
  PORT: z.string().optional().default("9000"),
  HOST: z.string().optional().default("127.0.0.1"),
  MEDUSA_WORKER_MODE: z.enum(["shared", "server", "worker"]).optional().default("shared"),
});

export type MedusaEnv = z.infer<typeof medusaEnvSchema>;

export function validateMedusaEnv(): MedusaEnv {
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
