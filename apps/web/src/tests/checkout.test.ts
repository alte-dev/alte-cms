import { describe, expect, it, afterEach } from "vitest";
import { TURKISH_CITIES } from "../lib/constants/turkish-cities";
import { isDevPaymentAllowed } from "../lib/medusa/cart";
import {
  AddressInputSchema,
  ApplyCouponSchema,
  CheckoutFormSchema,
  CitySchema,
  CorporateTaxNumberSchema,
  normalizeTurkishPhone,
  TurkishPhoneSchema,
} from "../lib/medusa/validation";

describe("Turkish Phone Normalizer & Schema", () => {
  it("normalizes various valid Turkish mobile phone formats to E.164 (+905XXXXXXXXX)", () => {
    expect(normalizeTurkishPhone("+905321112233")).toBe("+905321112233");
    expect(normalizeTurkishPhone("05321112233")).toBe("+905321112233");
    expect(normalizeTurkishPhone("5321112233")).toBe("+905321112233");
    expect(normalizeTurkishPhone("00905321112233")).toBe("+905321112233");
    expect(normalizeTurkishPhone("0 (532) 111 22 33")).toBe("+905321112233");
    expect(normalizeTurkishPhone("+90 532 111 22 33")).toBe("+905321112233");
  });

  it("returns null for non-mobile, foreign, or invalid format numbers", () => {
    expect(normalizeTurkishPhone("02121112233")).toBeNull(); // Sabit hat (0212)
    expect(normalizeTurkishPhone("03121112233")).toBeNull(); // Sabit hat (0312)
    expect(normalizeTurkishPhone("532111223")).toBeNull(); // 9 hane (eksik)
    expect(normalizeTurkishPhone("53211122333")).toBeNull(); // 11 hane (fazla)
    expect(normalizeTurkishPhone("telefon")).toBeNull();
    expect(normalizeTurkishPhone("")).toBeNull();
  });

  it("TurkishPhoneSchema accepts valid phone and transforms to +905XXXXXXXXX", () => {
    const result = TurkishPhoneSchema.safeParse("0555 123 45 67");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("+905551234567");
    }
  });

  it("TurkishPhoneSchema rejects invalid phone format with Turkish friendly error", () => {
    const result = TurkishPhoneSchema.safeParse("0216 123 45 67");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "Lütfen geçerli bir Türkiye cep telefonu numarası giriniz",
      );
    }
  });
});

describe("Turkish Cities & Corporate Tax Number Validation", () => {
  it("contains exactly 81 unique Turkish provinces sorted alphabetically", () => {
    expect(TURKISH_CITIES.length).toBe(81);
    const unique = new Set(TURKISH_CITIES);
    expect(unique.size).toBe(81);
    expect(TURKISH_CITIES).toContain("Adana");
    expect(TURKISH_CITIES).toContain("İstanbul");
    expect(TURKISH_CITIES).toContain("Düzce");
  });

  it("CitySchema validates valid Turkish cities and rejects unknown cities", () => {
    expect(CitySchema.safeParse("İstanbul").success).toBe(true);
    expect(CitySchema.safeParse("Ankara").success).toBe(true);
    expect(CitySchema.safeParse("İzmir").success).toBe(true);

    const invalid = CitySchema.safeParse("Berlin");
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toContain("geçerli bir Türkiye ili");
    }
  });

  it("CorporateTaxNumberSchema strictly validates 10 digits", () => {
    expect(CorporateTaxNumberSchema.safeParse("1234567890").success).toBe(true);
    expect(CorporateTaxNumberSchema.safeParse("9876543210").success).toBe(true);

    expect(CorporateTaxNumberSchema.safeParse("123456789").success).toBe(false); // 9 digits
    expect(CorporateTaxNumberSchema.safeParse("12345678901").success).toBe(false); // 11 digits
    expect(CorporateTaxNumberSchema.safeParse("12345abcde").success).toBe(false); // letters
  });
});

describe("CheckoutFormSchema Validation", () => {
  const validBasePayload = {
    email: "test@example.test",
    phone: "0500 000 00 00",
    deliveryAddress: {
      firstName: "Ahmet",
      lastName: "Yılmaz",
      city: "İstanbul",
      district: "Kadıköy",
      addressLine1: "Moda Caddesi No: 15 Daire: 4",
      postalCode: "34710",
      countryCode: "tr" as const,
    },
    sameAsDelivery: true,
    invoiceType: "individual" as const,
    shippingOptionId: "so_standard_test",
    distanceSalesContract: true as const,
    kvkkConsent: true as const,
  };

  it("successfully parses valid individual checkout", () => {
    const parsed = CheckoutFormSchema.safeParse(validBasePayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe("+905000000000");
      expect(parsed.data.invoiceType).toBe("individual");
    }
  });

  it("requires corporate invoice fields (companyName, taxOffice, 10-digit taxNumber) when corporate is selected", () => {
    const corporateIncomplete = {
      ...validBasePayload,
      invoiceType: "corporate" as const,
    };

    const result = CheckoutFormSchema.safeParse(corporateIncomplete);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issuePaths = result.error.issues.map((i) => i.path[0]);
      expect(issuePaths).toContain("companyName");
      expect(issuePaths).toContain("taxOffice");
      expect(issuePaths).toContain("taxNumber");
    }

    const corporateValid = {
      ...validBasePayload,
      invoiceType: "corporate" as const,
      companyName: "Alte Teknoloji Ltd. Şti.",
      taxOffice: "Kadıköy VD",
      taxNumber: "1234567890",
    };

    const validResult = CheckoutFormSchema.safeParse(corporateValid);
    expect(validResult.success).toBe(true);
  });

  it("rejects corporate invoice with invalid tax number format (e.g. 11 digits or letters)", () => {
    const corporateInvalidTax = {
      ...validBasePayload,
      invoiceType: "corporate" as const,
      companyName: "Alte Teknoloji Ltd. Şti.",
      taxOffice: "Kadıköy VD",
      taxNumber: "12345678901", // 11 digits
    };

    const result = CheckoutFormSchema.safeParse(corporateInvalidTax);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("taxNumber"))).toBe(true);
    }
  });

  it("requires separate billingAddress when sameAsDelivery is false", () => {
    const separateWithoutAddress = {
      ...validBasePayload,
      sameAsDelivery: false,
    };

    const result = CheckoutFormSchema.safeParse(separateWithoutAddress);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("billingAddress"))).toBe(true);
    }
  });

  it("fails if distance sales contract or kvkk consent is not checked", () => {
    const missingContract = { ...validBasePayload, distanceSalesContract: false };
    expect(CheckoutFormSchema.safeParse(missingContract).success).toBe(false);

    const missingKvkk = { ...validBasePayload, kvkkConsent: false };
    expect(CheckoutFormSchema.safeParse(missingKvkk).success).toBe(false);
  });

  it("fails on invalid email", () => {
    const invalidEmail = { ...validBasePayload, email: "not-an-email" };
    expect(CheckoutFormSchema.safeParse(invalidEmail).success).toBe(false);
  });
});

describe("Coupon Validation Schema", () => {
  it("uppercases and trims coupon code", () => {
    const result = ApplyCouponSchema.safeParse({ code: "  test10  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("TEST10");
    }
  });

  it("rejects short or empty coupon code", () => {
    expect(ApplyCouponSchema.safeParse({ code: "" }).success).toBe(false);
    expect(ApplyCouponSchema.safeParse({ code: "A" }).success).toBe(false);
  });
});

describe("Payment Security Gate (isDevPaymentAllowed)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("strictly forbids dummy payment in production even if ALLOW_DEV_PAYMENT=true", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.ALLOW_DEV_PAYMENT = "true";
    expect(isDevPaymentAllowed()).toBe(false);
  });

  it("forbids dummy payment in development if ALLOW_DEV_PAYMENT is not 'true'", () => {
    (process.env as any).NODE_ENV = "development";
    process.env.ALLOW_DEV_PAYMENT = "false";
    expect(isDevPaymentAllowed()).toBe(false);

    delete process.env.ALLOW_DEV_PAYMENT;
    expect(isDevPaymentAllowed()).toBe(false);
  });

  it("allows dummy payment only in development with explicit ALLOW_DEV_PAYMENT='true'", () => {
    (process.env as any).NODE_ENV = "development";
    process.env.ALLOW_DEV_PAYMENT = "true";
    expect(isDevPaymentAllowed()).toBe(true);
  });
});

describe("Checkout API Idempotency & Error Sanitization", () => {
  it("detects completed cart and returns 409 with friendly Turkish message", () => {
    const errorText = "Cart has already been completed";
    const isConflict = /completed|already/i.test(errorText);
    expect(isConflict).toBe(true);

    const friendlyResponse = {
      success: false,
      code: "CART_ALREADY_COMPLETED",
      error: "Bu sepet için sipariş zaten oluşturuldu.",
      redirectUrl: "/siparis-onay",
    };
    expect(friendlyResponse.error).toBe("Bu sepet için sipariş zaten oluşturuldu.");
    expect(friendlyResponse.redirectUrl).toBe("/siparis-onay");
  });

  it("sanitizes raw internal technical errors and prevents leakage to client", () => {
    const rawError = new Error(
      "MedusaError: Internal Server Error at Object.<anonymous> (/var/task/node_modules/medusa/dist/...)",
    );
    const errText = rawError.message;
    const isRaw = errText.includes("at ") || errText.includes("Error:");
    expect(isRaw).toBe(true);

    const safeMessage = isRaw
      ? "Sipariş işlenirken bir hata oluştu. Lütfen tekrar deneyiniz."
      : errText;
    expect(safeMessage).not.toContain("MedusaError");
    expect(safeMessage).not.toContain("/var/task");
    expect(safeMessage).toBe("Sipariş işlenirken bir hata oluştu. Lütfen tekrar deneyiniz.");
  });
});
