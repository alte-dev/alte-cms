import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const weakSecretPatterns = [
  "secret",
  "changeme",
  "123456",
  "password",
  "default",
  "admin",
  "payload",
];

const secretValidator = z
  .string()
  .min(32, { message: "PAYLOAD_SECRET must be at least 32 characters long" })
  .refine(
    (val) => {
      const lower = val.toLowerCase();
      return !weakSecretPatterns.some(
        (pattern) => lower.startsWith(pattern) || lower === `${pattern}123`,
      );
    },
    { message: "PAYLOAD_SECRET appears to be a trivial or weak default value" },
  );

export const webEnvSchema = z.object({
  NEXT_PUBLIC_SERVER_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_SERVER_URL is required")
    .url("NEXT_PUBLIC_SERVER_URL must be a valid URL"),
  DATABASE_URI: z
    .string()
    .min(1, "DATABASE_URI is required")
    .url("DATABASE_URI must be a valid PostgreSQL connection URL"),
  PAYLOAD_SECRET: secretValidator,
  NEXT_PUBLIC_MEDUSA_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_MEDUSA_URL is required")
    .url("NEXT_PUBLIC_MEDUSA_URL must be a valid URL"),
  MEDUSA_BACKEND_URL: z
    .string()
    .min(1, "MEDUSA_BACKEND_URL is required")
    .url("MEDUSA_BACKEND_URL must be a valid URL"),
  MEDUSA_PUBLISHABLE_KEY: z.string().optional().default(""),
  INTERNAL_API_SECRET: secretValidator,
  PAYLOAD_MEDIA_DIR: z.string().optional().default("media/uploads"),
  TRUST_PROXY: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .default("false")
    .transform((val) => val === "true" || val === "1"),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(10).optional().default(1),
  NEXT_OUTPUT_STANDALONE: z.enum(["true", "false", "1", "0"]).optional().default("false"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function validateWebEnv(): WebEnv {
  const result = webEnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error("❌ FATAL: Web/Payload environment validation failed (Fail-Closed):");
    console.error(JSON.stringify(formatted, null, 2));
    throw new Error(
      `Invalid Web/Payload environment variables. Please check your .env configuration against .env.example.`,
    );
  }
  return result.data;
}
