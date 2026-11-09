import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { isStaffRole } from "@/access/content";
import { validatePuckData } from "@/lib/puck/schema";

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });
    const { user } = await payload.auth({ headers: req.headers });

    if (!user || !isStaffRole(user.role as string)) {
      return NextResponse.json(
        { error: "Bu işlem için yetkiniz bulunmamaktadır." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { id, puckData, publish } = body;

    if (!id) {
      return NextResponse.json({ error: "Sayfa kimliği (id) zorunludur." }, { status: 400 });
    }

    const validation = validatePuckData(puckData);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Puck veri doğrulama hatası: ${validation.error}` },
        { status: 400 },
      );
    }

    const updated = await payload.update({
      collection: "pages",
      id,
      data: {
        puckData,
        ...(publish ? { _status: "published" } : {}),
      },
      user,
    });

    return NextResponse.json({
      success: true,
      id: updated.id,
      slug: updated.slug,
      status: (updated as any)._status,
    });
  } catch (error: any) {
    const isValidation =
      error?.name === "ValidationError" ||
      error?.status === 400 ||
      (typeof error?.message === "string" && error.message.includes("Puck"));
    return NextResponse.json(
      { error: error?.message || "Sayfa kaydedilirken hata oluştu." },
      { status: isValidation ? 400 : 500 },
    );
  }
}
