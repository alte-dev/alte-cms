import { describe, it, expect } from "vitest";
import {
  canReadPublishedOnlyOrStaff,
  canCreateContent,
  canUpdateContent,
  canDeleteContent,
  canManageGlobals,
  canReadUserEmail,
} from "../access/content";

describe("Content & Role Permissions Matrix", () => {
  const superAdminReq = { req: { user: { id: "u-1", role: "super-admin" } } } as any;
  const adminReq = { req: { user: { id: "u-2", role: "admin" } } } as any;
  const editorReq = { req: { user: { id: "u-3", role: "editor" } } } as any;
  const anonReq = { req: { user: null } } as any;

  describe("canReadPublishedOnlyOrStaff", () => {
    it("allows super-admin to read all (including drafts)", () => {
      expect(canReadPublishedOnlyOrStaff(superAdminReq)).toBe(true);
    });

    it("allows admin to read all (including drafts)", () => {
      expect(canReadPublishedOnlyOrStaff(adminReq)).toBe(true);
    });

    it("allows editor to read all (including drafts)", () => {
      expect(canReadPublishedOnlyOrStaff(editorReq)).toBe(true);
    });

    it("restricts anonymous to published status only (zero draft leakage)", () => {
      const result = canReadPublishedOnlyOrStaff(anonReq);
      expect(result).toEqual({
        _status: {
          equals: "published",
        },
      });
    });
  });

  describe("canCreateContent", () => {
    it("allows super-admin to create content", () => {
      expect(canCreateContent(superAdminReq)).toBe(true);
    });

    it("allows admin to create content", () => {
      expect(canCreateContent(adminReq)).toBe(true);
    });

    it("allows editor to create content", () => {
      expect(canCreateContent(editorReq)).toBe(true);
    });

    it("blocks anonymous from creating content", () => {
      expect(canCreateContent(anonReq)).toBe(false);
    });
  });

  describe("canUpdateContent", () => {
    it("allows super-admin to update content", () => {
      expect(canUpdateContent(superAdminReq)).toBe(true);
    });

    it("allows admin to update content", () => {
      expect(canUpdateContent(adminReq)).toBe(true);
    });

    it("allows editor to update content", () => {
      expect(canUpdateContent(editorReq)).toBe(true);
    });

    it("blocks anonymous from updating content", () => {
      expect(canUpdateContent(anonReq)).toBe(false);
    });
  });

  describe("canDeleteContent (Editor deletion protection)", () => {
    it("allows super-admin to delete content", () => {
      expect(canDeleteContent(superAdminReq)).toBe(true);
    });

    it("allows admin to delete content", () => {
      expect(canDeleteContent(adminReq)).toBe(true);
    });

    it("STRICTLY BLOCKS editor from deleting content or media", () => {
      expect(canDeleteContent(editorReq)).toBe(false);
    });

    it("blocks anonymous from deleting content", () => {
      expect(canDeleteContent(anonReq)).toBe(false);
    });
  });

  describe("canManageGlobals (SiteSettings and Navigation)", () => {
    it("allows super-admin to manage globals", () => {
      expect(canManageGlobals(superAdminReq)).toBe(true);
    });

    it("allows admin to manage globals", () => {
      expect(canManageGlobals(adminReq)).toBe(true);
    });

    it("STRICTLY BLOCKS editor from modifying site settings and navigation", () => {
      expect(canManageGlobals(editorReq)).toBe(false);
    });

    it("blocks anonymous from managing globals", () => {
      expect(canManageGlobals(anonReq)).toBe(false);
    });
  });

  describe("canReadUserEmail (Author email protection on storefront)", () => {
    it("allows staff to see user email in admin", () => {
      expect(canReadUserEmail(superAdminReq)).toBe(true);
      expect(canReadUserEmail(adminReq)).toBe(true);
      expect(canReadUserEmail(editorReq)).toBe(true);
    });

    it("STRICTLY BLOCKS anonymous visitors from seeing author email (zero email leak)", () => {
      expect(canReadUserEmail(anonReq)).toBe(false);
    });
  });
});
