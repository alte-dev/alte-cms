import type { Access, FieldAccess, Where } from "payload";
import type { UserRole } from "@alte/shared";

export function isStaffRole(role?: string): boolean {
  if (!role) return false;
  return ["super-admin", "admin", "shop-manager", "editor"].includes(role);
}

export function isAdminRole(role?: string): boolean {
  if (!role) return false;
  return ["super-admin", "admin"].includes(role);
}

/**
 * Access Control for Published-Only Content (Pages, Posts):
 * - Authenticated staff (super-admin, admin, shop-manager, editor) can read drafts and published.
 * - Anonymous / visitor can ONLY read documents where _status === 'published'.
 * Zero draft leakage.
 */
export const canReadPublishedOnlyOrStaff: Access = ({ req: { user } }) => {
  if (user && isStaffRole(user.role as string)) {
    return true;
  }

  // Anonymous visitor: strictly restrict to published status
  const publishedOnly: Where = {
    _status: {
      equals: "published",
    },
  };
  return publishedOnly;
};

/**
 * Create access for Pages, Posts, PostCategories:
 * Super-Admin, Admin, Shop-Manager, Editor can create.
 * Anonymous strictly blocked.
 */
export const canCreateContent: Access = ({ req: { user } }) => {
  if (!user) return false;
  return isStaffRole(user.role as string);
};

/**
 * Update access for Pages, Posts, PostCategories:
 * Super-Admin, Admin, Shop-Manager, Editor can update.
 * Anonymous strictly blocked.
 */
export const canUpdateContent: Access = ({ req: { user } }) => {
  if (!user) return false;
  return isStaffRole(user.role as string);
};

/**
 * Delete access for Pages, Posts, PostCategories, Media:
 * ONLY Super-Admin and Admin can delete.
 * Editor CANNOT delete.
 * Anonymous strictly blocked.
 */
export const canDeleteContent: Access = ({ req: { user } }) => {
  if (!user) return false;
  return isAdminRole(user.role as string);
};

/**
 * Manage Globals (SiteSettings, Navigation):
 * ONLY Super-Admin and Admin can update globals.
 * Editor CANNOT update globals.
 * Anonymous strictly blocked.
 */
export const canManageGlobals: Access = ({ req: { user } }) => {
  if (!user) return false;
  return isAdminRole(user.role as string);
};

/**
 * Field-level access for author email:
 * Only logged-in staff can see user email.
 * Anonymous visitors querying posts/authors receive undefined / null.
 */
export const canReadUserEmail: FieldAccess = ({ req: { user } }) => {
  return Boolean(user && isStaffRole(user.role as string));
};
