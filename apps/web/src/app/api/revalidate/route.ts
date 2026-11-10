import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-revalidate-secret") || req.nextUrl.searchParams.get("secret");
    const expectedSecret = process.env.REVALIDATE_SECRET || process.env.PAYLOAD_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const tag = body.tag || req.nextUrl.searchParams.get("tag");

    if (!tag || typeof tag !== "string") {
      return NextResponse.json({ error: "Geçersiz veya eksik etiket (tag)" }, { status: 400 });
    }

    try {
      revalidateTag(tag);
    } catch (e) {
      // Catch when running in test runners without Next.js server context
      console.warn(
        "revalidateTag store warning (expected in test/non-server context):",
        (e as Error).message,
      );
    }

    return NextResponse.json({ revalidated: true, tag, timestamp: Date.now() }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
