import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import crypto from "crypto";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const headerSecret = req.headers.get("x-revalidate-secret") || bearerSecret;

    const expectedSecret = process.env.REVALIDATE_SECRET || process.env.PAYLOAD_SECRET;

    if (!headerSecret || !expectedSecret || !safeCompare(headerSecret, expectedSecret)) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const tag = body?.tag;

    if (!tag || typeof tag !== "string") {
      return NextResponse.json({ error: "Geçersiz veya eksik etiket (tag)" }, { status: 400 });
    }

    revalidateTag(tag);

    return NextResponse.json({ revalidated: true, tag, timestamp: Date.now() }, { status: 200 });
  } catch (error) {
    console.error("[Revalidate API] Hata:", (error as Error).name);
    return NextResponse.json({ error: "Etiket yenileme başarısız oldu" }, { status: 500 });
  }
}
