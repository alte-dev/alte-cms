import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "../../../../lib/medusa/products";
import { formatTRY } from "../../../../lib/medusa/format";
import { extractClientIp } from "../../../../lib/security/origin-guard";
import { FixedWindowRateLimiter } from "../../../../lib/security/rate-limiter";

export const dynamic = "force-dynamic";

const suggestionsIpLimiter = new FixedWindowRateLimiter({
  maxRequests: 60,
  windowMs: 60_000,
});

export async function GET(req: NextRequest) {
  const clientIp = extractClientIp(req);
  const decision = suggestionsIpLimiter.consume(clientIp);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "Çok fazla arama isteği gönderildi. Lütfen bir dakika sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const res = await searchProducts({ q, limit: 6, clientIp });
    const suggestions = (res.products || []).map((p) => {
      const variant = p.variants?.[0];
      const rawPrice =
        variant?.calculated_price?.calculated_amount ?? (variant as any)?.prices?.[0]?.amount ?? 0;

      return {
        id: p.id,
        title: p.title,
        handle: p.handle,
        thumbnail: p.thumbnail,
        formattedPrice: formatTRY(rawPrice),
      };
    });

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
