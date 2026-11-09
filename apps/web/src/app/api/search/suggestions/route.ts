import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/medusa/products";
import { formatTRY } from "@/lib/medusa/format";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const res = await searchProducts({ q, limit: 6 });
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
