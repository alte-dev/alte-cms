import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { signMedusaAdminJwt } from "./route";

describe("signMedusaAdminJwt", () => {
  it("produces a valid HS256 JWT with actor_type user and actor_id", () => {
    const secret = "test-jwt-secret-with-at-least-32-characters-1234";
    const token = signMedusaAdminJwt("usr_123", secret, 300);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);

    const [headerB64, payloadB64, sigB64] = parts;
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");
    expect(sigB64).toBe(expectedSig);

    const claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    expect(claims.actor_id).toBe("usr_123");
    expect(claims.actor_type).toBe("user");
    expect(claims.app_metadata).toEqual({ user_id: "usr_123" });
    expect(claims.exp - claims.iat).toBe(300);
  });
});
