import { describe, expect, it } from "vitest";
import { validateCustomerPassword } from "@alte/shared";

describe("validateCustomerPassword", () => {
  it("rejects passwords shorter than 10 characters", () => {
    const res = validateCustomerPassword("Abc12345!");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("10");
  });

  it("rejects passwords longer than 128 characters", () => {
    const res = validateCustomerPassword("A".repeat(129));
    expect(res.valid).toBe(false);
    expect(res.error).toContain("128");
  });

  it("rejects common passwords (case-insensitive)", () => {
    for (const pw of ["password1234", "1234567890", "Qwerty12345", "iloveyou123"]) {
      const res = validateCustomerPassword(pw);
      expect(res.valid).toBe(false);
    }
  });

  it("rejects passwords containing the email local-part", () => {
    const res = validateCustomerPassword("Ali.Yilmaz2026!", "ali.yilmaz@example.test");
    expect(res.valid).toBe(false);
  });

  it("accepts strong passwords of 10+ characters", () => {
    const res = validateCustomerPassword("Guv3nli!Parola2026", "ali.yilmaz@example.test");
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });
});
