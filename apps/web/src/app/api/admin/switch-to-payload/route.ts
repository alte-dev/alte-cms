import { NextRequest, NextResponse } from "next/server";
import { getPayload, jwtSign, generatePayloadCookie } from "payload";
import configPromise from "@payload-config";
import { canSwitchToMedusa, verifyMedusaAdminFromCookieHeader } from "@/lib/auth/admin-sso";

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config: configPromise });

  // If Payload session is already active, go straight to /admin
  const existingAuth = await payload.auth({ headers: req.headers });
  if (existingAuth.user) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Otherwise verify active Medusa Admin session from browser cookies
  const medusaAuth = await verifyMedusaAdminFromCookieHeader(req.headers.get("cookie"));
  if (!medusaAuth.valid) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const found = await payload.find({
    collection: "users",
    where: {
      email: { equals: medusaAuth.email.toLowerCase() },
    },
    limit: 1,
    overrideAccess: true,
  });

  const staffUser = found.docs[0];
  if (!staffUser || !canSwitchToMedusa(staffUser)) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const collectionConfig = payload.collections["users"]?.config;
  if (!collectionConfig) {
    return NextResponse.json({ error: "Users koleksiyonu yapılandırılmamış." }, { status: 500 });
  }

  const { token } = await jwtSign({
    fieldsToSign: {
      id: staffUser.id,
      email: staffUser.email,
      collection: "users",
    },
    secret: payload.secret,
    tokenExpiration:
      typeof collectionConfig.auth === "object" && collectionConfig.auth.tokenExpiration
        ? collectionConfig.auth.tokenExpiration
        : 7200,
  });

  const cookieHeader = generatePayloadCookie({
    collectionAuthConfig: collectionConfig.auth,
    cookiePrefix: payload.config.cookiePrefix,
    token,
  });

  const response = NextResponse.redirect(new URL("/admin", req.url));
  response.headers.append("Set-Cookie", cookieHeader);
  return response;
}
