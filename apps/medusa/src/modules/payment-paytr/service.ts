import crypto from "crypto";
import { AbstractPaymentProvider } from "@medusajs/framework/utils";
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/types";
import { BigNumber } from "@medusajs/framework/utils";
import { PaymentSettingsRegistry } from "../payment-settings/service";
import { constantTimeCompare } from "../../utils/crypto";

export interface PaytrSessionData {
  token: string;
  iframe_url: string;
  display_mode: "iframe" | "redirect";
  merchant_oid: string;
  cart_id?: string;
  expected_amount_kurus: number;
  test_mode: number;
  status: string;
  captured_at?: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
  needs_manual_refund?: boolean;
}

export class PaytrPaymentService extends AbstractPaymentProvider {
  static identifier = "paytr";
  private appContainer: any;

  constructor(container: Record<string, unknown>, config?: Record<string, unknown>) {
    super(container, config);
    this.appContainer = container;
  }

  /**
   * Helper to resolve current active settings from in-memory registry or fallback.
   */
  private async getSettings() {
    let settings = PaymentSettingsRegistry.get();
    if (!settings) {
      try {
        const service =
          this.appContainer?.resolve?.("paymentSettingsModuleService") ||
          this.appContainer?.paymentSettingsModuleService;
        if (service) {
          settings = await service.getDecryptedSettings();
          if (settings) {
            PaymentSettingsRegistry.set(settings);
          }
        }
      } catch (err: any) {
        console.error("[PayTR] Failed to resolve settings from service:", err?.message);
      }
    }

    if (!settings) {
      throw new Error(
        "[PayTR] Ödeme ayarları yüklenemedi. Lütfen admin panelinden ödeme ayarlarını kaydedin.",
      );
    }
    return settings;
  }

  /**
   * Generates a strictly alphanumeric merchant_oid (max 64 chars) from payment session ID.
   */
  public generateMerchantOid(sessionId: string): string {
    const cleanId = sessionId.replace(/[^a-zA-Z0-9]/g, "");
    const timestamp = Date.now().toString(36);
    const combined = `ORD${timestamp}${cleanId}`.substring(0, 64);
    return combined;
  }

  /**
   * Computes the HMAC-SHA256 PayTR token (Base64) for Step 1 get-token API.
   */
  public computePaytrToken(params: {
    merchant_id: string;
    user_ip: string;
    merchant_oid: string;
    email: string;
    payment_amount: number;
    user_basket: string;
    no_installment: number;
    max_installment: number;
    currency: string;
    test_mode: number;
    merchant_key: string;
    merchant_salt: string;
  }): string {
    const dataString =
      `${params.merchant_id}${params.user_ip}${params.merchant_oid}${params.email}` +
      `${params.payment_amount}${params.user_basket}${params.no_installment}` +
      `${params.max_installment}${params.currency}${params.test_mode}${params.merchant_salt}`;

    return crypto.createHmac("sha256", params.merchant_key).update(dataString).digest("base64");
  }

  /**
   * Verifies the HMAC-SHA256 signature in Step 2 Callback notification.
   */
  public verifyCallbackHash(params: {
    merchant_oid: string;
    status: string;
    total_amount: string | number;
    receivedHash: string;
    merchant_key: string;
    merchant_salt: string;
  }): boolean {
    const dataString = `${params.merchant_oid}${params.merchant_salt}${params.status}${params.total_amount}`;
    const calculatedHash = crypto
      .createHmac("sha256", params.merchant_key)
      .update(dataString)
      .digest("base64");

    return constantTimeCompare(params.receivedHash, calculatedHash);
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const settings = await this.getSettings();

    if (!settings.paytr_enabled) {
      throw new Error("PayTR ile ödeme yöntemi şu anda aktif değildir.");
    }

    if (
      !settings.paytr_merchant_id ||
      !settings.paytr_merchant_key ||
      !settings.paytr_merchant_salt
    ) {
      throw new Error(
        "PayTR mağaza kimlik bilgileri (Mağaza No, Anahtar veya Salt) eksik. Lütfen admin panelinden ayarları kontrol edin.",
      );
    }

    const { amount, currency_code, context } = input;
    const customer = (context as any)?.customer || {};
    const billingAddress = (context as any)?.billing_address || {};

    const rawEmail = (context as any)?.email || customer.email || "musteri@example.com";
    // PayTR strictly disallows Turkish/non-ASCII characters in email
    const email = rawEmail.replace(/[^a-zA-Z0-9@._+-]/g, "");

    const expectedKurus = Math.round(Number(amount) * 100);
    if (expectedKurus <= 0) {
      throw new Error("Ödeme tutarı sıfırdan büyük olmalıdır.");
    }

    // Determine customer IP safely
    let userIp =
      (context as any)?.ip ||
      (context as any)?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
      "127.0.0.1";

    if (process.env.NODE_ENV !== "production" && process.env.DEV_PAYTR_USER_IP) {
      userIp = process.env.DEV_PAYTR_USER_IP;
    }

    const merchantOid = this.generateMerchantOid(
      (context as any)?.session_id || (context as any)?.cart_id || Date.now().toString(),
    );

    // Prepare User Basket: JSON array of [name, price_str, qty], then Base64
    const items = (context as any)?.items || [];
    let basketArray: Array<[string, string, number]> = [];

    if (items.length > 0) {
      basketArray = items.map((item: any) => [
        item.title || "Ürün",
        Number(item.unit_price || 0).toFixed(2),
        Number(item.quantity || 1),
      ]);
    } else {
      basketArray = [["Sipariş Tutarı", Number(amount).toFixed(2), 1]];
    }

    const userBasketBase64 = Buffer.from(JSON.stringify(basketArray), "utf8").toString("base64");
    const testMode = settings.paytr_mode === "sandbox" ? 1 : 0;

    const token = this.computePaytrToken({
      merchant_id: settings.paytr_merchant_id,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: expectedKurus,
      user_basket: userBasketBase64,
      no_installment: settings.paytr_no_installment ? 1 : 0,
      max_installment: settings.paytr_max_installment || 0,
      currency: "TL",
      test_mode: testMode,
      merchant_key: settings.paytr_merchant_key,
      merchant_salt: settings.paytr_merchant_salt,
    });

    const apiBase =
      (process.env.NODE_ENV !== "production" ? process.env.PAYTR_API_BASE : undefined) ||
      "https://www.paytr.com";

    // Call PayTR get-token API
    let paytrIframeToken = "";
    try {
      const formBody = new URLSearchParams({
        merchant_id: settings.paytr_merchant_id,
        user_ip: userIp,
        merchant_oid: merchantOid,
        email,
        payment_amount: String(expectedKurus),
        paytr_token: token,
        user_basket: userBasketBase64,
        debug_on: process.env.NODE_ENV !== "production" ? "1" : "0",
        no_installment: settings.paytr_no_installment ? "1" : "0",
        max_installment: String(settings.paytr_max_installment || 0),
        user_name:
          `${billingAddress.first_name || "Müşteri"} ${billingAddress.last_name || ""}`.trim(),
        user_address: billingAddress.address_1 || "Türkiye",
        user_phone: billingAddress.phone || "05000000000",
        merchant_ok_url: `${(process.env.WEB_PUBLIC_URL || "http://localhost:3100").replace(/\/+$/, "")}/odeme/sonuc?durum=ok`,
        merchant_fail_url: `${(process.env.WEB_PUBLIC_URL || "http://localhost:3100").replace(/\/+$/, "")}/odeme/sonuc?durum=hata`,
        timeout_limit: String(settings.paytr_timeout_limit || 30),
        currency: "TL",
        test_mode: String(testMode),
        lang: settings.paytr_lang || "tr",
      });

      const response = await fetch(`${apiBase}/odeme/api/get-token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody.toString(),
      });

      const resData = (await response.json()) as any;
      if (resData.status !== "success" || !resData.token) {
        throw new Error(resData.reason || "PayTR token üretilemedi.");
      }
      paytrIframeToken = resData.token;
    } catch (err: any) {
      throw new Error(`PayTR oturum başlatma hatası: ${err.message}`);
    }

    const detectedCartId =
      (context as any)?.cart_id ||
      (context as any)?.cartId ||
      (context as any)?.resource_id ||
      ((input as any)?.data as any)?.cart_id;

    const sessionData: PaytrSessionData = {
      token: paytrIframeToken,
      iframe_url: `https://www.paytr.com/odeme/guvenli/${paytrIframeToken}`,
      display_mode: settings.paytr_display_mode,
      merchant_oid: merchantOid,
      cart_id: detectedCartId,
      expected_amount_kurus: expectedKurus,
      test_mode: testMode,
      status: "pending",
    };

    return {
      id: merchantOid,
      data: sessionData as any,
    };
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = input.data as unknown as PaytrSessionData;
    const isSuccess = data?.status === "success" || data?.status === "captured";

    return {
      status: isSuccess ? "authorized" : "pending",
      data: data as any,
    };
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = (input.data || {}) as unknown as PaytrSessionData;
    return {
      data: {
        ...data,
        status: "captured",
        captured_at: new Date().toISOString(),
      } as any,
    };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data || {}) as unknown as PaytrSessionData;
    return {
      data: {
        ...data,
        status: "canceled",
      } as any,
    };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return {};
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const data = input.data as unknown as PaytrSessionData;
    if (data?.status === "captured") return { status: "captured" };
    if (data?.status === "authorized" || data?.status === "success")
      return { status: "authorized" };
    if (data?.status === "canceled") return { status: "canceled" };
    if (data?.status === "failed") return { status: "error" };
    return { status: "pending" };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    // PayTR refund is currently manual from merchant panel as per scope specification
    const data = (input.data || {}) as unknown as PaytrSessionData;
    return {
      data: {
        ...data,
        refund_note: "PayTR iadesi mağaza yönetim panelinden manuel yapılmalıdır.",
      } as any,
    };
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return {
      data: input.data,
    };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return {
      data: input.data,
    };
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"],
  ): Promise<WebhookActionResult> {
    const { data } = payload;
    const settings = await this.getSettings();

    const merchantOid = data?.merchant_oid as string;
    const status = data?.status as string;
    const totalAmount = data?.total_amount as string;
    const receivedHash = data?.hash as string;

    if (!merchantOid || !status || !receivedHash) {
      return {
        action: "failed",
        data: { session_id: merchantOid || "", amount: new BigNumber(0) },
      };
    }

    const isValid = this.verifyCallbackHash({
      merchant_oid: merchantOid,
      status,
      total_amount: totalAmount,
      receivedHash,
      merchant_key: settings.paytr_merchant_key,
      merchant_salt: settings.paytr_merchant_salt,
    });

    if (!isValid) {
      console.error(`[PayTR Webhook] Geçersiz HMAC hash imzası: oid=${merchantOid}`);
      return {
        action: "failed",
        data: { session_id: merchantOid, amount: new BigNumber(0) },
      };
    }

    if (status === "success") {
      const kurus = parseInt(String(totalAmount), 10);
      const tlAmount = kurus / 100;

      return {
        action: "captured",
        data: {
          session_id: merchantOid,
          amount: new BigNumber(tlAmount),
        },
      };
    }

    return {
      action: "failed",
      data: {
        session_id: merchantOid,
        amount: new BigNumber(0),
      },
    };
  }
}

export default PaytrPaymentService;
