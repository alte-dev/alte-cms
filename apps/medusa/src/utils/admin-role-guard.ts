import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

const ALLOWED_SETTINGS_ROLES = new Set(["admin", "super-admin"]);

/**
 * Ensures only admin or super-admin users can access or modify system settings
 * (email-settings, payment-settings). Blocks shop-manager, editor, and author roles.
 */
export async function checkAdminSettingsRole(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<boolean> {
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
      // Fail closed if actor lookup errors when auth_context exists
      res.status(403).json({
        error: "Yetkisiz erişim: Ayarlara erişim yetkisi doğrulanamadı.",
      });
      return false;
    }
  }

  // Default Medusa admin user without custom metadata.role is treated as admin
  const effectiveRole = role || "admin";

  if (!ALLOWED_SETTINGS_ROLES.has(effectiveRole)) {
    res.status(403).json({
      error: "Yetkisiz erişim: Ayarları yalnızca admin veya super-admin yönetebilir.",
    });
    return false;
  }

  return true;
}
