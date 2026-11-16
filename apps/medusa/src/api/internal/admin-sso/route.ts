import crypto from "crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { z } from "zod";

const adminSsoSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(120).optional(),
  role: z.enum(["super-admin", "admin"]).default("admin"),
});

export function signMedusaAdminJwt(userId: string, jwtSecret: string, ttlSeconds = 300): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      actor_id: userId,
      actor_type: "user",
      auth_identity_id: "",
      app_metadata: { user_id: userId },
      iat: now,
      exp: now + ttlSeconds,
    }),
  ).toString("base64url");

  const sig = crypto
    .createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${sig}`;
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = adminSsoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Geçersiz SSO isteği." });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    return res.status(500).json({ error: "JWT_SECRET yapılandırılmamış." });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ssoRole = parsed.data.role;
  const userModule = req.scope.resolve(Modules.USER) as {
    listUsers: (filters: {
      email: string;
    }) => Promise<Array<{ id: string; email: string; metadata?: Record<string, unknown> | null }>>;
    createUsers: (data: {
      email: string;
      first_name?: string;
      metadata?: Record<string, unknown>;
    }) => Promise<{ id: string; email: string; metadata?: Record<string, unknown> | null }>;
    updateUsers: (data: {
      id: string;
      metadata?: Record<string, unknown>;
    }) => Promise<{ id: string; email: string }>;
  };

  const existing = await userModule.listUsers({ email });
  let user = existing?.[0];

  if (!user) {
    user = await userModule.createUsers({
      email,
      first_name: parsed.data.name || email.split("@")[0],
      metadata: { role: ssoRole },
    });
  } else if (user.metadata?.role !== ssoRole && typeof userModule.updateUsers === "function") {
    await userModule.updateUsers({
      id: user.id,
      metadata: { ...(user.metadata || {}), role: ssoRole },
    });
  }

  const token = signMedusaAdminJwt(user.id, jwtSecret, 300);

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
    },
  });
}
