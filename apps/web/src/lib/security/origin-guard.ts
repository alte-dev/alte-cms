import { isIP } from "node:net";
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

function parseTrustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) {
    return 1;
  }
  return parsed;
}

export function extractClientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";
  if (!trustProxy) {
    return "unknown";
  }

  const xff = req.headers.get("x-forwarded-for");
  if (!xff) {
    return "unknown";
  }

  const parts = xff
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const hops = parseTrustedProxyHops();
  if (parts.length < hops) {
    return "unknown";
  }

  const candidate = parts[parts.length - hops];
  if (!candidate || isIP(candidate) === 0) {
    return "unknown";
  }
  return candidate;
}
