import { describe, it, expect } from "vitest";
import { canSwitchToMedusa } from "../lib/auth/admin-sso";

describe("Admin SSO Role Guard (Payload -> Medusa)", () => {
  it("allows super-admin and admin roles to switch to Medusa /app", () => {
    expect(canSwitchToMedusa({ role: "super-admin" })).toBe(true);
    expect(canSwitchToMedusa({ role: "admin" })).toBe(true);
  });

  it("denies editor, author, shop-manager, and unknown roles (fail-closed)", () => {
    expect(canSwitchToMedusa({ role: "editor" })).toBe(false);
    expect(canSwitchToMedusa({ role: "author" })).toBe(false);
    expect(canSwitchToMedusa({ role: "shop-manager" })).toBe(false);
    expect(canSwitchToMedusa({ role: "customer" })).toBe(false);
    expect(canSwitchToMedusa({})).toBe(false);
    expect(canSwitchToMedusa(null)).toBe(false);
    expect(canSwitchToMedusa(undefined)).toBe(false);
  });
});
