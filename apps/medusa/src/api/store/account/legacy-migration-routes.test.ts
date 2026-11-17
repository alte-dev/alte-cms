import crypto from "crypto";
import { describe, expect, it, vi } from "vitest";
import {
  clearNeedsPasswordUpgradeMetadata,
  markNeedsPasswordUpgradeMetadata,
  signResetJwtForMigratedCustomer,
} from "./_shared";
import { verifyJwtHs256 } from "../../middleware-guards";

describe("legacy migration route helpers", () => {
  it("marks and clears needs_password_upgrade as a strict boolean without storing plaintext", () => {
    const updated = markNeedsPasswordUpgradeMetadata({ migrated_from: "woocommerce" });
    expect(updated).toEqual({
      migrated_from: "woocommerce",
      needs_password_upgrade: true,
    });
    expect(typeof updated.needs_password_upgrade).toBe("boolean");

    const cleared = clearNeedsPasswordUpgradeMetadata(updated);
    expect(cleared).toEqual({ migrated_from: "woocommerce" });
    expect("needs_password_upgrade" in cleared).toBe(false);
  });

  it("generates a valid reset JWT for migrated customers without an emailpass provider", () => {
    const secret = crypto.randomBytes(32).toString("hex");
    const token = signResetJwtForMigratedCustomer("legacy@example.test", secret);
    const claims = verifyJwtHs256(token, secret) as {
      entity_id?: string;
      actor_type?: string;
      purpose?: string;
    } | null;

    expect(claims).not.toBeNull();
    expect(claims?.entity_id).toBe("legacy@example.test");
    expect(claims?.actor_type).toBe("customer");
    expect(claims?.purpose).toBe("reset");
  });
});
