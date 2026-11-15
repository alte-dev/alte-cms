export interface StaffLikeUser {
  role?: unknown;
  email?: unknown;
  name?: unknown;
}

const ALLOWED_MEDUSA_SWITCH_ROLES = new Set(["super-admin", "admin"]);

/**
 * Fail-closed check: only super-admin and admin staff may switch into Medusa /app.
 */
export function canSwitchToMedusa(user: StaffLikeUser | null | undefined): boolean {
  if (!user || typeof user !== "object") return false;
  if (typeof user.role !== "string") return false;
  return ALLOWED_MEDUSA_SWITCH_ROLES.has(user.role);
}

export function getMedusaBackendBaseUrl(): string {
  return (process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000").replace(/\/+$/, "");
}

/**
 * Exchanges a verified Payload admin user's email for a Medusa admin session cookie(s)
 * via the internal-secret-protected Medusa SSO endpoint.
 */
export async function requestMedusaAdminSsoCookies(input: {
  email: string;
  name?: string;
}): Promise<{ ok: true; setCookies: string[] } | { ok: false; status: number; error: string }> {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!internalSecret || internalSecret.length < 32) {
    return { ok: false, status: 500, error: "INTERNAL_API_SECRET yapılandırılmamış." };
  }

  const baseUrl = getMedusaBackendBaseUrl();

  const ssoRes = await fetch(`${baseUrl}/internal/admin-sso`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-alte-internal": internalSecret,
    },
    body: JSON.stringify({
      email: input.email,
      name: input.name,
    }),
    cache: "no-store",
  });

  if (!ssoRes.ok) {
    return {
      ok: false,
      status: ssoRes.status,
      error: "Medusa SSO oturumu oluşturulamadı.",
    };
  }

  const ssoData = (await ssoRes.json()) as { token?: string };
  if (!ssoData?.token) {
    return { ok: false, status: 502, error: "Medusa SSO yanıtında token bulunamadı." };
  }

  // Exchange Medusa JWT for a standard Medusa HTTP-only session cookie (connect.sid)
  const sessionRes = await fetch(`${baseUrl}/auth/session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ssoData.token}`,
    },
    cache: "no-store",
  });

  if (!sessionRes.ok) {
    return {
      ok: false,
      status: sessionRes.status,
      error: "Medusa session cookie başlatılamadı.",
    };
  }

  const setCookies =
    typeof sessionRes.headers.getSetCookie === "function" ? sessionRes.headers.getSetCookie() : [];

  return { ok: true, setCookies };
}

/**
 * Verifies an active Medusa Admin session using incoming browser cookies.
 */
export async function verifyMedusaAdminFromCookieHeader(
  cookieHeader: string | null,
): Promise<{ valid: true; email: string } | { valid: false }> {
  if (!cookieHeader) {
    return { valid: false };
  }

  const baseUrl = getMedusaBackendBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/admin/users/me`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return { valid: false };
    }

    const data = (await res.json()) as { user?: { email?: string } };
    const email = data?.user?.email;
    if (!email || typeof email !== "string") {
      return { valid: false };
    }

    return { valid: true, email };
  } catch {
    return { valid: false };
  }
}
