import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@payload-config";
import { z } from "zod";
import { canSwitchToMedusa } from "../../../../lib/auth/admin-sso";
import {
  getLastWarmSummary,
  isWarmRunning,
  purgeAllStorefrontCache,
  warmStorefrontCache,
} from "../../../../lib/cache-warmer";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
} as const;

const cacheActionSchema = z.object({
  action: z.enum(["purge", "warm"]),
});

async function authenticateAdmin(req: NextRequest) {
  const payload = await getPayload({ config: configPromise });
  const authHeaders = new Headers(req.headers);
  if (!authHeaders.get("authorization")) {
    const tokenCookie = req.cookies.get(`${payload.config.cookiePrefix || "payload"}-token`)?.value;
    if (tokenCookie) {
      authHeaders.set("authorization", `JWT ${tokenCookie}`);
    }
  }
  const { user } = await payload.auth({ headers: authHeaders });
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Oturum gerekli." },
        { status: 401, headers: NO_STORE_HEADERS },
      ),
    };
  }
  if (!canSwitchToMedusa(user)) {
    return {
      error: NextResponse.json(
        { error: "Bu işlem için yönetici (admin) yetkisi gereklidir." },
        { status: 403, headers: NO_STORE_HEADERS },
      ),
    };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const auth = await authenticateAdmin(req);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  return NextResponse.json(
    { summary: getLastWarmSummary() },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  const auth = await authenticateAdmin(req);
  if ("error" in auth && auth.error) {
    return auth.error;
  }

  const body = await req.json().catch(() => null);
  const parsed = cacheActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz işlem. 'purge' veya 'warm' bekleniyor." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (parsed.data.action === "purge") {
    const result = purgeAllStorefrontCache();
    return NextResponse.json(
      { ok: true, action: "purge", ...result, summary: getLastWarmSummary() },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  }

  if (isWarmRunning()) {
    return NextResponse.json(
      { error: "Önbellek ısıtma işlemi zaten çalışıyor.", summary: getLastWarmSummary() },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }

  const summary = await warmStorefrontCache();
  const status = summary.status === "failed" ? 500 : 200;
  return NextResponse.json(
    { ok: summary.status === "completed", action: "warm", summary },
    { status, headers: NO_STORE_HEADERS },
  );
}
