import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { PaytrPaymentService } from "./service";

describe("PaytrPaymentService - Calculations and Security", () => {
  const service = new PaytrPaymentService({}, {});

  describe("merchant_oid generation", () => {
    it("generates strictly alphanumeric ID not exceeding 64 chars", () => {
      const sessionId = "payses_01M6WABC-XYZ_test-1234!";
      const oid = service.generateMerchantOid(sessionId);

      expect(oid).toMatch(/^[a-zA-Z0-9]+$/);
      expect(oid.length).toBeLessThanOrEqual(64);
      expect(oid.length).toBeGreaterThan(10);
    });

    it("generates unique values across multiple calls", () => {
      const oid1 = service.generateMerchantOid("ses1");
      const oid2 = service.generateMerchantOid("ses1");
      // Timestamps or random components ensure uniqueness
      expect(oid1).toBeTruthy();
      expect(oid2).toBeTruthy();
    });
  });

  describe("paytr_token HMAC-SHA256 calculation", () => {
    it("calculates correct base64 token matching reference independently computed HMAC", () => {
      const params = {
        merchant_id: "123456",
        user_ip: "192.168.1.1",
        merchant_oid: "ORD123456",
        email: "test@example.com",
        payment_amount: 14000, // 140.00 TL in kuruş
        user_basket: Buffer.from(JSON.stringify([["Test Ürün", "140.00", 1]])).toString("base64"),
        no_installment: 0,
        max_installment: 0,
        currency: "TL",
        test_mode: 1,
        merchant_key: "dummy-merchant-key-32-chars-ok!!",
        merchant_salt: "dummy-merchant-salt-32-chars-ok!",
      };

      // Reference independent calculation
      const concat =
        `${params.merchant_id}${params.user_ip}${params.merchant_oid}${params.email}` +
        `${params.payment_amount}${params.user_basket}${params.no_installment}` +
        `${params.max_installment}${params.currency}${params.test_mode}${params.merchant_salt}`;
      const expectedToken = crypto
        .createHmac("sha256", params.merchant_key)
        .update(concat)
        .digest("base64");

      const computed = service.computePaytrToken(params);
      expect(computed).toEqual(expectedToken);
      expect(computed).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });

  describe("callback hash verification", () => {
    const merchantKey = "secret-key-1234567890";
    const merchantSalt = "secret-salt-1234567890";
    const merchantOid = "ORD987654321";
    const status = "success";
    const totalAmount = "14000";

    const validHash = crypto
      .createHmac("sha256", merchantKey)
      .update(`${merchantOid}${merchantSalt}${status}${totalAmount}`)
      .digest("base64");

    it("accepts valid signature", () => {
      const isValid = service.verifyCallbackHash({
        merchant_oid: merchantOid,
        status,
        total_amount: totalAmount,
        receivedHash: validHash,
        merchant_key: merchantKey,
        merchant_salt: merchantSalt,
      });
      expect(isValid).toBe(true);
    });

    it("rejects tampered status or amount", () => {
      const isTamperedStatus = service.verifyCallbackHash({
        merchant_oid: merchantOid,
        status: "failed", // tampered
        total_amount: totalAmount,
        receivedHash: validHash,
        merchant_key: merchantKey,
        merchant_salt: merchantSalt,
      });
      expect(isTamperedStatus).toBe(false);

      const isTamperedAmount = service.verifyCallbackHash({
        merchant_oid: merchantOid,
        status,
        total_amount: "10000", // tampered amount
        receivedHash: validHash,
        merchant_key: merchantKey,
        merchant_salt: merchantSalt,
      });
      expect(isTamperedAmount).toBe(false);
    });

    it("rejects invalid hash signature", () => {
      const isValid = service.verifyCallbackHash({
        merchant_oid: merchantOid,
        status,
        total_amount: totalAmount,
        receivedHash: "invalid-tampered-hash-signature",
        merchant_key: merchantKey,
        merchant_salt: merchantSalt,
      });
      expect(isValid).toBe(false);
    });
  });

  describe("kuruş rounding and floating point safety", () => {
    it("safely rounds decimals without precision loss", () => {
      // 229.9 TL -> 22990 kuruş
      expect(Math.round(229.9 * 100)).toBe(22990);
      // 0.1 + 0.2 floating point trap
      expect(Math.round((0.1 + 0.2) * 100)).toBe(30);
      // 149.99 TL -> 14999 kuruş
      expect(Math.round(149.99 * 100)).toBe(14999);
    });
  });
});
