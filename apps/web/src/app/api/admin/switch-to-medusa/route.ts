import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { canSwitchToMedusa, requestMedusaAdminSsoCookies } from "@/lib/auth/admin-sso";

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config: configPromise });
  const { user } = await payload.auth({ headers: req.headers });

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  if (!canSwitchToMedusa(user)) {
    return NextResponse.json(
      { error: "Bu işlem için yönetici (admin) yetkisi gereklidir." },
      { status: 403 },
    );
  }

  const email = typeof user.email === "string" ? user.email : "";
  if (!email) {
    return NextResponse.json({ error: "Kullanıcı e-postası bulunamadı." }, { status: 400 });
  }

  const sso = await requestMedusaAdminSsoCookies({
    email,
    name:
      typeof (user as { name?: unknown }).name === "string"
        ? (user as { name: string }).name
        : undefined,
  });

  if (!sso.ok) {
    return NextResponse.json(
      { error: sso.error },
      { status: sso.status >= 500 ? 502 : sso.status },
    );
  }

  const response = NextResponse.redirect(new URL("/app", req.url));
  for (const cookieStr of sso.setCookies) {
    response.headers.append("Set-Cookie", cookieStr);
  }
  return response;
}
