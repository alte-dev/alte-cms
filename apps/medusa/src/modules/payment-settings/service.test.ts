import { describe, expect, it, vi, beforeEach } from "vitest";
import PaymentSettingsService, { PaymentSettingsRegistry } from "./service";

function createTestService(initialRow?: Record<string, any>) {
  const row: Record<string, any> = {
    id: "ps_default",
    paytr_enabled: false,
    paytr_mode: "sandbox",
    paytr_merchant_id: null,
    paytr_merchant_key: null,
    paytr_merchant_salt: null,
    paytr_display_mode: "iframe",
    paytr_no_installment: false,
    paytr_max_installment: 0,
    paytr_timeout_limit: 30,
    paytr_lang: "tr",
    iyzico_enabled: false,
    iyzico_mode: "sandbox",
    iyzico_api_key: null,
    iyzico_secret_key: null,
    iyzico_display_mode: "redirect",
    iyzico_max_installment: 1,
    iyzico_lang: "tr",
    default_payment_method: null,
    cod_enabled: false,
    cod_fee: 100,
    cod_fee_label: "Kapıda Ödeme Hizmet Bedeli",
    cod_max_order_amount: null,
    ...initialRow,
  };

  const service = new PaymentSettingsService({} as any);
  vi.spyOn(service, "getOrCreateSingleton").mockImplementation(async () => ({ ...row }));
  vi.spyOn(service, "updatePaymentSettings").mockImplementation(async (data: any) => {
    Object.assign(row, data);
    return { ...row } as any;
  });

  return { service, row };
}

describe("PaymentSettingsService (iyzico & default_payment_method)", () => {
  beforeEach(() => {
    process.env.SETTINGS_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    PaymentSettingsRegistry.invalidate();
  });

  it("defaults iyzico_display_mode to redirect and masks iyzico secrets", async () => {
    const { service } = createTestService({ iyzico_display_mode: "invalid_mode" });
    const decrypted = await service.getDecryptedSettings();
    expect(decrypted.iyzico_display_mode).toBe("redirect");

    const masked = await service.getMaskedSettings();
    expect(masked.iyzico_display_mode).toBe("redirect");
    expect(masked.has_iyzico_api_key).toBe(false);
    expect(masked.has_iyzico_secret_key).toBe(false);
    expect((masked as any).iyzico_api_key).toBeUndefined();
    expect((masked as any).iyzico_secret_key).toBeUndefined();
  });

  it("rejects enabling iyzico when api_key or secret_key is missing", async () => {
    const { service } = createTestService();
    await expect(
      service.updateSafeSettings({ iyzico_enabled: true }, "admin@example.test"),
    ).rejects.toThrow(/anahtar/i);
  });

  it("encrypts iyzico keys with AES-256-GCM, never exposes plaintext in masked response, and requires CANLI for live mode", async () => {
    const { service, row } = createTestService();

    await expect(
      service.updateSafeSettings(
        {
          iyzico_mode: "live",
          iyzico_api_key: "live-key-abc12345",
          iyzico_secret_key: "live-secret-xyz98765",
        },
        "admin@example.test",
      ),
    ).rejects.toThrow(/CANLI/);

    const masked = await service.updateSafeSettings(
      {
        iyzico_enabled: true,
        iyzico_mode: "sandbox",
        iyzico_api_key: "sandbox-key-abc12345",
        iyzico_secret_key: "sandbox-secret-xyz98765",
        iyzico_display_mode: "redirect",
        iyzico_max_installment: 6,
        iyzico_lang: "tr",
        default_payment_method: "iyzico",
      },
      "admin@example.test",
    );

    expect(row.iyzico_api_key).not.toContain("sandbox-key-abc12345");
    expect(row.iyzico_secret_key).not.toContain("sandbox-secret-xyz98765");
    expect(row.iyzico_api_key.split(":")).toHaveLength(3);

    expect(masked.iyzico_enabled).toBe(true);
    expect(masked.has_iyzico_api_key).toBe(true);
    expect(masked.has_iyzico_secret_key).toBe(true);
    expect(masked.iyzico_api_key_masked).not.toContain("sandbox-key");
    expect(masked.iyzico_secret_key_masked).not.toContain("sandbox-secret");
    expect(masked.default_payment_method).toBe("iyzico");

    PaymentSettingsRegistry.invalidate();
    const decrypted = await service.getDecryptedSettings();
    expect(decrypted.iyzico_api_key).toBe("sandbox-key-abc12345");
    expect(decrypted.iyzico_secret_key).toBe("sandbox-secret-xyz98765");
  });

  it("rejects out-of-range iyzico_max_installment", async () => {
    const { service } = createTestService();
    await expect(
      service.updateSafeSettings({ iyzico_max_installment: 13 }, "admin@example.test"),
    ).rejects.toThrow(/taksit/i);
  });
});
