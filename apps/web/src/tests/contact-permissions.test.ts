import { describe, it, expect } from "vitest";
import { isShopManagerOrAdmin } from "../access/content";
import {
  canReadContactMessages,
  canCreateContactMessages,
  canUpdateContactMessages,
  canDeleteContactMessages,
  canAccessContactAdmin,
} from "../collections/ContactMessages";
import { SiteSettings } from "../globals/SiteSettings";

describe("ContactMessages & Role Permissions (shop-manager vs admin vs editor vs anon)", () => {
  const superAdminReq = { req: { user: { id: "u-1", role: "super-admin" } } } as any;
  const adminReq = { req: { user: { id: "u-2", role: "admin" } } } as any;
  const shopManagerReq = { req: { user: { id: "u-3", role: "shop-manager" } } } as any;
  const editorReq = { req: { user: { id: "u-4", role: "editor" } } } as any;
  const anonReq = { req: { user: null } } as any;

  it("isShopManagerOrAdmin allows super-admin, admin, shop-manager only", () => {
    expect(isShopManagerOrAdmin("super-admin")).toBe(true);
    expect(isShopManagerOrAdmin("admin")).toBe(true);
    expect(isShopManagerOrAdmin("shop-manager")).toBe(true);
    expect(isShopManagerOrAdmin("editor")).toBe(false);
    expect(isShopManagerOrAdmin("author")).toBe(false);
    expect(isShopManagerOrAdmin(undefined)).toBe(false);
  });

  it("allows super-admin, admin, shop-manager to read and update contact messages, blocks editor and anon", () => {
    expect(canReadContactMessages(superAdminReq)).toBe(true);
    expect(canReadContactMessages(adminReq)).toBe(true);
    expect(canReadContactMessages(shopManagerReq)).toBe(true);
    expect(canReadContactMessages(editorReq)).toBe(false);
    expect(canReadContactMessages(anonReq)).toBe(false);

    expect(canUpdateContactMessages(superAdminReq)).toBe(true);
    expect(canUpdateContactMessages(adminReq)).toBe(true);
    expect(canUpdateContactMessages(shopManagerReq)).toBe(true);
    expect(canUpdateContactMessages(editorReq)).toBe(false);
    expect(canUpdateContactMessages(anonReq)).toBe(false);

    expect(canAccessContactAdmin(shopManagerReq)).toBe(true);
    expect(canAccessContactAdmin(editorReq)).toBe(false);
    expect(canAccessContactAdmin(anonReq)).toBe(false);
  });

  it("blocks direct REST create for anon, editor, and shop-manager (only admin/super-admin or server override)", () => {
    expect(canCreateContactMessages(superAdminReq)).toBe(true);
    expect(canCreateContactMessages(adminReq)).toBe(true);
    expect(canCreateContactMessages(shopManagerReq)).toBe(false);
    expect(canCreateContactMessages(editorReq)).toBe(false);
    expect(canCreateContactMessages(anonReq)).toBe(false);
  });

  it("allows only super-admin and admin to delete contact messages (shop-manager cannot delete)", () => {
    expect(canDeleteContactMessages(superAdminReq)).toBe(true);
    expect(canDeleteContactMessages(adminReq)).toBe(true);
    expect(canDeleteContactMessages(shopManagerReq)).toBe(false);
    expect(canDeleteContactMessages(editorReq)).toBe(false);
    expect(canDeleteContactMessages(anonReq)).toBe(false);
  });

  it("hides SiteSettings in Payload admin sidebar for shop-manager and editor, shows for admin/super-admin", () => {
    const hiddenFn = SiteSettings.admin?.hidden;
    expect(typeof hiddenFn).toBe("function");
    if (typeof hiddenFn === "function") {
      expect(hiddenFn({ user: { role: "super-admin" } as any })).toBe(false);
      expect(hiddenFn({ user: { role: "admin" } as any })).toBe(false);
      expect(hiddenFn({ user: { role: "shop-manager" } as any })).toBe(true);
      expect(hiddenFn({ user: { role: "editor" } as any })).toBe(true);
      expect(hiddenFn({ user: null })).toBe(true);
    }
  });
});
