import { NextResponse } from "next/server";

export function getAllowedServerOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3100";
  try {
    const url = new URL(raw);
    return [url.origin];
  } catch {
    return ["http://localhost:3100"];
  }
}

export function verifyAccountOrigin(req: Request): { allowed: boolean; reason?: string } {
  const allowedOrigins = getAllowedServerOrigins();
  const origin = req.headers.get("origin");
  if (!origin) {
    return { allowed: false, reason: "Origin başlığı eksik." };
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return { allowed: false, reason: "Geçersiz Origin başlığı." };
  }

  if (!allowedOrigins.includes(parsedOrigin.origin)) {
    return { allowed: false, reason: "İzin verilmeyen köken (Origin)." };
  }

  const host = req.headers.get("host");
  if (host) {
    const allowedHosts = allowedOrigins.map((o) => new URL(o).host);
    if (!allowedHosts.includes(host)) {
      return { allowed: false, reason: "İzin verilmeyen Host başlığı." };
    }
  }

  return { allowed: true };
}

export function requireAccountOrigin(req: Request): NextResponse | null {
  const check = verifyAccountOrigin(req);
  if (!check.allowed) {
    return NextResponse.json(
      { error: "Güvenlik doğrulaması başarısız (geçersiz köken)." },
      { status: 403 },
    );
  }
  return null;
}

export function extractClientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";
  if (trustProxy) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
