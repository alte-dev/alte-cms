import { MedusaService } from "@medusajs/framework/utils";
import { PaymentSetting } from "./models/payment-setting";
import { decryptSetting, encryptSetting, maskSecret, parseEncryptionKey } from "../../utils/crypto";

export const SINGLETON_PAYMENT_SETTING_ID = "ps_default";

export interface DecryptedPaymentSettings {
  id: string;
  paytr_enabled: boolean;
  paytr_mode: "sandbox" | "live";
  paytr_merchant_id: string;
  paytr_merchant_key: string; // Decrypted in-memory only
  paytr_merchant_salt: string; // Decrypted in-memory only
  paytr_display_mode: "iframe" | "redirect";
  paytr_no_installment: boolean;
  paytr_max_installment: number;
  paytr_timeout_limit: number;
  paytr_lang: "tr" | "en";
  cod_enabled: boolean;
  cod_fee: number;
  cod_fee_label: string;
  cod_max_order_amount: number | null;
}

export interface MaskedPaymentSettingsResponse {
  paytr_enabled: boolean;
  paytr_mode: "sandbox" | "live";
  paytr_merchant_id: string;
  has_merchant_key: boolean;
  merchant_key_masked: string;
  has_merchant_salt: boolean;
  merchant_salt_masked: string;
  paytr_display_mode: "iframe" | "redirect";
  paytr_no_installment: boolean;
  paytr_max_installment: number;
  paytr_timeout_limit: number;
  paytr_lang: "tr" | "en";
  cod_enabled: boolean;
  cod_fee: number;
  cod_fee_label: string;
  cod_max_order_amount: number | null;
  callback_url: string;
  success_url: string;
  fail_url: string;
}

/**
 * In-process thread-safe cache to allow payment providers to read updated settings
 * without restarting the server or suffering DI scope isolation.
 */
class PaymentSettingsRegistry {
  private static cachedSettings: DecryptedPaymentSettings | null = null;
  private static cacheExpiresAt: number = 0;
  private static readonly TTL_MS = 600000; // 10 minutes cache (invalidated on every PUT update)

  public static get(): DecryptedPaymentSettings | null {
    if (this.cachedSettings && Date.now() < this.cacheExpiresAt) {
      return this.cachedSettings;
    }
    return null;
  }

  public static set(settings: DecryptedPaymentSettings): void {
    this.cachedSettings = settings;
    this.cacheExpiresAt = Date.now() + this.TTL_MS;
  }

  public static invalidate(): void {
    this.cachedSettings = null;
    this.cacheExpiresAt = 0;
  }
}

export { PaymentSettingsRegistry };

export class PaymentSettingsService extends MedusaService({
  PaymentSetting,
}) {
  private getEncryptionKey(): Buffer {
    return parseEncryptionKey(process.env.SETTINGS_ENCRYPTION_KEY);
  }

  /**
   * Retrieves or creates the singleton payment setting record.
   */
  public async getOrCreateSingleton(): Promise<any> {
    try {
      const existing = await this.retrievePaymentSetting(SINGLETON_PAYMENT_SETTING_ID);
      if (existing) return existing;
    } catch {
      // not found, proceed to create
    }

    try {
      return await this.createPaymentSettings({
        id: SINGLETON_PAYMENT_SETTING_ID,
        paytr_enabled: false,
        paytr_mode: "sandbox",
        paytr_display_mode: "iframe",
        paytr_no_installment: false,
        paytr_max_installment: 0,
        paytr_timeout_limit: 30,
        paytr_lang: "tr",
        cod_enabled: false,
        cod_fee: 100,
        cod_fee_label: "Kapıda Ödeme Hizmet Bedeli",
        cod_max_order_amount: null,
      });
    } catch {
      // If concurrent creation occurred, retrieve it
      return await this.retrievePaymentSetting(SINGLETON_PAYMENT_SETTING_ID);
    }
  }

  /**
   * Returns fully decrypted settings for payment processing.
   * Never leaks secrets to logs or network responses.
   */
  public async getDecryptedSettings(): Promise<DecryptedPaymentSettings> {
    const cached = PaymentSettingsRegistry.get();
    if (cached) return cached;

    const row = await this.getOrCreateSingleton();
    const keyBuf = this.getEncryptionKey();

    let decryptedKey = "";
    let decryptedSalt = "";

    if (row.paytr_merchant_key) {
      try {
        decryptedKey = decryptSetting(row.paytr_merchant_key, keyBuf);
      } catch (err: any) {
        console.error("[Payment Settings] Merchant key şifresi çözülemedi:", err.message);
      }
    }

    if (row.paytr_merchant_salt) {
      try {
        decryptedSalt = decryptSetting(row.paytr_merchant_salt, keyBuf);
      } catch (err: any) {
        console.error("[Payment Settings] Merchant salt şifresi çözülemedi:", err.message);
      }
    }

    const settings: DecryptedPaymentSettings = {
      id: row.id,
      paytr_enabled: Boolean(row.paytr_enabled),
      paytr_mode: row.paytr_mode === "live" ? "live" : "sandbox",
      paytr_merchant_id: row.paytr_merchant_id || "",
      paytr_merchant_key: decryptedKey,
      paytr_merchant_salt: decryptedSalt,
      paytr_display_mode: row.paytr_display_mode === "redirect" ? "redirect" : "iframe",
      paytr_no_installment: Boolean(row.paytr_no_installment),
      paytr_max_installment: Number(row.paytr_max_installment || 0),
      paytr_timeout_limit: Number(row.paytr_timeout_limit || 30),
      paytr_lang: row.paytr_lang === "en" ? "en" : "tr",
      cod_enabled: Boolean(row.cod_enabled),
      cod_fee: Number(row.cod_fee ?? 100),
      cod_fee_label: row.cod_fee_label || "Kapıda Ödeme Hizmet Bedeli",
      cod_max_order_amount:
        row.cod_max_order_amount !== null && row.cod_max_order_amount !== undefined
          ? Number(row.cod_max_order_amount)
          : null,
    };

    PaymentSettingsRegistry.set(settings);
    return settings;
  }

  /**
   * Returns safe masked settings for Admin UI and Admin API.
   * Never returns raw or decrypted secret keys.
   */
  public async getMaskedSettings(): Promise<MaskedPaymentSettingsResponse> {
    const decrypted = await this.getDecryptedSettings();

    const apiPublicUrl =
      process.env.API_PUBLIC_URL ||
      process.env.MEDUSA_ADMIN_BACKEND_URL ||
      "http://api.localhost:9000";
    const webPublicUrl = process.env.WEB_PUBLIC_URL || "http://localhost:3100";

    return {
      paytr_enabled: decrypted.paytr_enabled,
      paytr_mode: decrypted.paytr_mode,
      paytr_merchant_id: decrypted.paytr_merchant_id,
      has_merchant_key: Boolean(decrypted.paytr_merchant_key),
      merchant_key_masked: maskSecret(decrypted.paytr_merchant_key),
      has_merchant_salt: Boolean(decrypted.paytr_merchant_salt),
      merchant_salt_masked: maskSecret(decrypted.paytr_merchant_salt),
      paytr_display_mode: decrypted.paytr_display_mode,
      paytr_no_installment: decrypted.paytr_no_installment,
      paytr_max_installment: decrypted.paytr_max_installment,
      paytr_timeout_limit: decrypted.paytr_timeout_limit,
      paytr_lang: decrypted.paytr_lang,
      cod_enabled: decrypted.cod_enabled,
      cod_fee: decrypted.cod_fee,
      cod_fee_label: decrypted.cod_fee_label,
      cod_max_order_amount: decrypted.cod_max_order_amount,
      callback_url: `${apiPublicUrl.replace(/\/+$/, "")}/hooks/payment/pp_paytr_paytr`,
      success_url: `${webPublicUrl.replace(/\/+$/, "")}/odeme/sonuc?durum=ok`,
      fail_url: `${webPublicUrl.replace(/\/+$/, "")}/odeme/sonuc?durum=hata`,
    };
  }

  /**
   * Updates settings with write-only secret management and CANLI live switch validation.
   */
  public async updateSafeSettings(
    input: Partial<{
      paytr_enabled: boolean;
      paytr_mode: "sandbox" | "live";
      paytr_merchant_id: string;
      paytr_merchant_key?: string;
      paytr_merchant_salt?: string;
      paytr_display_mode: "iframe" | "redirect";
      paytr_no_installment: boolean;
      paytr_max_installment: number;
      paytr_timeout_limit: number;
      paytr_lang: "tr" | "en";
      cod_enabled: boolean;
      cod_fee: number;
      cod_fee_label: string;
      cod_max_order_amount: number | null;
      confirm_live?: string;
    }>,
    adminActor: string = "admin",
  ): Promise<MaskedPaymentSettingsResponse> {
    const existingRow = await this.getOrCreateSingleton();
    const keyBuf = this.getEncryptionKey();

    const updateData: Record<string, any> = {};
    const changedFields: string[] = [];

    // 1. PayTR Mode & Live Guard
    if (input.paytr_mode !== undefined) {
      if (input.paytr_mode === "live") {
        // Must confirm by typing CANLI
        if (input.confirm_live !== "CANLI") {
          throw new Error(
            "PayTR CANLI moda geçiş için 'confirm_live' alanına 'CANLI' yazarak onaylamalısınız.",
          );
        }

        const merchantId = input.paytr_merchant_id ?? existingRow.paytr_merchant_id;
        const hasKey = Boolean(input.paytr_merchant_key || existingRow.paytr_merchant_key);
        const hasSalt = Boolean(input.paytr_merchant_salt || existingRow.paytr_merchant_salt);

        if (!merchantId || !hasKey || !hasSalt) {
          throw new Error(
            "CANLI moda geçmeden önce Mağaza No (Merchant ID), Anahtar (Key) ve Salt bilgileri eksiksiz tanımlanmalıdır.",
          );
        }
      }
      updateData.paytr_mode = input.paytr_mode;
      changedFields.push("paytr_mode");
    }

    if (input.paytr_enabled !== undefined) {
      updateData.paytr_enabled = input.paytr_enabled;
      changedFields.push("paytr_enabled");
    }

    if (input.paytr_merchant_id !== undefined) {
      updateData.paytr_merchant_id = input.paytr_merchant_id.trim();
      changedFields.push("paytr_merchant_id");
    }

    // Write-only secret handling: only update if non-empty string provided
    if (input.paytr_merchant_key && input.paytr_merchant_key.trim()) {
      updateData.paytr_merchant_key = encryptSetting(input.paytr_merchant_key.trim(), keyBuf);
      changedFields.push("paytr_merchant_key (şifrelendi)");
    }

    if (input.paytr_merchant_salt && input.paytr_merchant_salt.trim()) {
      updateData.paytr_merchant_salt = encryptSetting(input.paytr_merchant_salt.trim(), keyBuf);
      changedFields.push("paytr_merchant_salt (şifrelendi)");
    }

    if (input.paytr_display_mode !== undefined) {
      updateData.paytr_display_mode = input.paytr_display_mode;
      changedFields.push("paytr_display_mode");
    }

    if (input.paytr_no_installment !== undefined) {
      updateData.paytr_no_installment = input.paytr_no_installment;
      changedFields.push("paytr_no_installment");
    }

    if (input.paytr_max_installment !== undefined) {
      updateData.paytr_max_installment = input.paytr_max_installment;
      changedFields.push("paytr_max_installment");
    }

    if (input.paytr_timeout_limit !== undefined) {
      updateData.paytr_timeout_limit = input.paytr_timeout_limit;
      changedFields.push("paytr_timeout_limit");
    }

    if (input.paytr_lang !== undefined) {
      updateData.paytr_lang = input.paytr_lang;
      changedFields.push("paytr_lang");
    }

    // COD fields
    if (input.cod_enabled !== undefined) {
      updateData.cod_enabled = input.cod_enabled;
      changedFields.push("cod_enabled");
    }

    if (input.cod_fee !== undefined) {
      if (input.cod_fee < 0) {
        throw new Error("Kapıda ödeme bedeli 0 veya pozitif bir değer olmalıdır.");
      }
      updateData.cod_fee = input.cod_fee;
      changedFields.push("cod_fee");
    }

    if (input.cod_fee_label !== undefined) {
      updateData.cod_fee_label = input.cod_fee_label.trim() || "Kapıda Ödeme Hizmet Bedeli";
      changedFields.push("cod_fee_label");
    }

    if (input.cod_max_order_amount !== undefined) {
      updateData.cod_max_order_amount = input.cod_max_order_amount;
      changedFields.push("cod_max_order_amount");
    }

    if (changedFields.length > 0) {
      await this.updatePaymentSettings({
        id: SINGLETON_PAYMENT_SETTING_ID,
        ...updateData,
      });

      // Invalidate in-process cache immediately so payment providers see updates without restart
      PaymentSettingsRegistry.invalidate();

      // Audit log: NO secrets printed
      console.log(
        `[AUDIT LOG] Ödeme ayarları güncellendi. Kullanıcı: ${adminActor}, Tarih: ${new Date().toISOString()}, Değişen alanlar: [${changedFields.join(", ")}]`,
      );
    }

    return await this.getMaskedSettings();
  }
}

export default PaymentSettingsService;
