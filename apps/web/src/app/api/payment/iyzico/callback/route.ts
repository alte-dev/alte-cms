import { NextResponse } from "next/server";
import { z } from "zod";
import { setOrderConfirmation } from "../../../../../lib/medusa/cookies";
import { extractClientIp } from "../../../../../lib/security/origin-guard";
import { FixedWindowRateLimiter } from "../../../../../lib/security/rate-limiter";

const callbackTokenSchema = z.object({
  token: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-zA-Z0-9._-]+$/),
});

function getCallbackLimitMax(): number {
  const raw = process.env.IYZICO_CALLBACK_LIMIT_MAX;
  if (raw && /^\d+$/.test(raw.trim())) {
    return Math.max(1, Number.parseInt(raw.trim(), 10));
  }
  return 30;
}

const iyzicoCallbackLimiter = new FixedWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: getCallbackLimitMax(),
});

function getWebBaseUrl(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_SERVER_URL;
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/+$/, "");
  }
  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3100";
  }
}

export async function POST(req: Request): Promise<Response> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
    return NextResponse.json({ error: "Desteklenmeyen içerik türü." }, { status: 415 });
  }

  const clientIp = extractClientIp(req);
  const rl = iyzicoCallbackLimiter.consume(`iyz_cb:${clientIp}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek. Lütfen biraz bekleyin." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const rawBody = await req.text();
  if (rawBody.length > 4096) {
    return NextResponse.json({ error: "İstek boyutu sınırı aşıldı." }, { status: 400 });
  }

  const params = new URLSearchParams(rawBody);
  const token = (params.get("token") || "").trim();
  const parsed = callbackTokenSchema.safeParse({ token });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz veya eksik ödeme token bilgisi." },
      { status: 400 },
    );
  }

  const medusaUrl = (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://127.0.0.1:9000"
  ).replace(/\/+$/, "");
  const internalSecret = process.env.MEDUSA_INTERNAL_SECRET || "";
  const webBaseUrl = getWebBaseUrl(req);

  try {
    const verifyRes = await fetch(`${medusaUrl}/internal/payment/iyzico/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(internalSecret ? { "x-alte-internal": internalSecret } : {}),
      },
      body: JSON.stringify({ token: parsed.data.token }),
      signal: AbortSignal.timeout(20_000),
    });

    const data = (await verifyRes.json().catch(() => ({}))) as {
      status?: string;
      cart_id?: string;
      order_id?: string;
    };

    if (data.status === "completed" && data.order_id) {
      await setOrderConfirmation(data.order_id);
    }

    if (data.cart_id) {
      const suffix = data.status === "failed" ? "&durum=hata" : "";
      return NextResponse.redirect(
        `${webBaseUrl}/odeme/sonuc?cart_id=${encodeURIComponent(data.cart_id)}${suffix}`,
        303,
      );
    }

    return NextResponse.redirect(`${webBaseUrl}/odeme/sonuc?durum=hata`, 303);
  } catch {
    return NextResponse.redirect(`${webBaseUrl}/odeme/sonuc?durum=hata`, 303);
  }
}
