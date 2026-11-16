import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

const ALLOWED_SETTINGS_ROLES = new Set(["admin", "super-admin"]);
const ALLOWED_SHOP_OPS_ROLES = new Set(["admin", "super-admin", "shop-manager"]);

async function resolveAdminRole(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<{ ok: true; role: string } | { ok: false }> {
  const anyReq = req as any;
  let role: string | undefined =
    anyReq.user?.role ||
    anyReq.user?.metadata?.role ||
    anyReq.auth_context?.app_metadata?.role ||
    anyReq.auth_context?.user_metadata?.role;

  if (!role && anyReq.auth_context?.actor_id && anyReq.scope?.resolve) {
    try {
      const userModule = anyReq.scope.resolve(Modules.USER);
      if (userModule?.retrieveUser) {
        const userRecord = await userModule.retrieveUser(anyReq.auth_context.actor_id);
        role = userRecord?.metadata?.role || userRecord?.role;
      }
    } catch {
      res.status(403).json({
        error: "Yetkisiz erişim: Kullanıcı rolü doğrulanamadı.",
      });
      return { ok: false };
    }
  }

  if (!role || typeof role !== "string") {
    res.status(403).json({
      error: "Yetkisiz erişim: Kullanıcı rolü tanımlı değil.",
    });
    return { ok: false };
  }

  return { ok: true, role };
}

/**
 * One-time backfill: assigns `super-admin` to existing Medusa admin users created
 * before role enforcement (e.g. via `medusa user`) when `store.metadata.role_backfill_done`
 * is not yet set. Subsequent runs of `setup:store` do nothing so newly created role-less
 * users remain fail-closed until explicitly assigned a role via `pnpm admin:set-role`.
 */
export async function ensureExistingAdminRoles(pgConnection: any): Promise<number> {
  if (!pgConnection) return 0;

  const storeRow = await pgConnection("store").whereNull("deleted_at").first();
  if (!storeRow) return 0;

  if (storeRow.metadata?.role_backfill_done === true) {
    return 0;
  }

  const usersWithoutRole = await pgConnection("user")
    .whereNull("deleted_at")
    .whereRaw("(metadata IS NULL OR metadata->>'role' IS NULL OR metadata->>'role' = '')")
    .select("id", "metadata");

  let updated = 0;
  for (const row of usersWithoutRole) {
    const nextMeta = { ...(row.metadata || {}), role: "super-admin" };
    await pgConnection("user").where({ id: row.id }).update({ metadata: nextMeta });
    updated += 1;
  }

  await pgConnection("store")
    .where({ id: storeRow.id })
    .update({
      metadata: { ...(storeRow.metadata || {}), role_backfill_done: true },
    });

  return updated;
}

/**
 * Ensures only admin or super-admin users can access or modify system settings
 * (email-settings, payment-settings) or delete contact messages.
 */
export async function checkAdminSettingsRole(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<boolean> {
  const resolved = await resolveAdminRole(req, res);
  if (!resolved.ok) return false;

  if (!ALLOWED_SETTINGS_ROLES.has(resolved.role)) {
    res.status(403).json({
      error: "Yetkisiz erişim: Ayarları yalnızca admin veya super-admin yönetebilir.",
    });
    return false;
  }

  return true;
}

/**
 * Ensures admin, super-admin, or shop-manager can access operational views
 * (contact messages, order operations). Blocks editor/author roles.
 */
export async function checkAdminOrShopManagerRole(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<boolean> {
  const resolved = await resolveAdminRole(req, res);
  if (!resolved.ok) return false;

  if (!ALLOWED_SHOP_OPS_ROLES.has(resolved.role)) {
    res.status(403).json({
      error: "Yetkisiz erişim: Bu işlem için mağaza yöneticisi veya admin yetkisi gereklidir.",
    });
    return false;
  }

  return true;
}
