import { AbstractPaymentProvider } from "@medusajs/framework/utils";
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
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
import { PaymentSettingsRegistry } from "../payment-settings/service";
import {
  IyzicoBasketItem,
  IyzicoClient,
  validateIyzicoPaymentPageUrl,
  verifyIyzicoInitSignature,
} from "./client";

export interface IyzicoSessionData {
  token: string;
  payment_page_url: string;
  checkout_form_content?: string;
  display_mode: "redirect" | "embedded";
  conversation_id: string;
  basket_id: string;
  cart_id?: string;
  expected_amount_kurus: number;
  mode: "sandbox" | "live";
  status: string;
  captured_at?: string;
  consumed_at?: string;
  iyzico_payment_id?: string;
  iyzico_payment_transaction_ids?: string[];
  failed_reason_code?: string;
  failed_reason_msg?: string;
  needs_manual_refund?: boolean;
  last_refund_amount?: number;
}

function buildIyzicoBasketItems(items: any[], expectedKurus: number): IyzicoBasketItem[] {
  const result: IyzicoBasketItem[] = [];
  let runningKurus = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const qty = Math.max(1, Number(item.quantity || 1));
    const unitKurus = Math.round(Number(item.unit_price || 0) * 100);
    const lineKurus = unitKurus * qty;
    if (lineKurus <= 0) continue;

    // Cap to remaining expectedKurus in case of discounts
    const clampedKurus = Math.min(lineKurus, Math.max(0, expectedKurus - runningKurus));
    if (clampedKurus <= 0) continue;

    runningKurus += clampedKurus;
    result.push({
      id: String(item.id || `item_${i + 1}`).slice(0, 64),
      name: String(item.title || "Ürün").slice(0, 128),
      category1: "Genel",
      itemType: "PHYSICAL",
      price: (clampedKurus / 100).toFixed(2),
    });
  }

  const diffKurus = expectedKurus - runningKurus;
  if (diffKurus > 0) {
    result.push({
      id: result.length === 0 ? "ORDER_TOTAL" : "SHIPPING_OR_FEE",
      name: result.length === 0 ? "Sipariş Tutarı" : "Kargo ve Hizmet Bedeli",
      category1: "Genel",
      itemType: "PHYSICAL",
      price: (diffKurus / 100).toFixed(2),
    });
  }

  return result;
}

export class IyzicoPaymentService extends AbstractPaymentProvider {
  static identifier = "iyzico";
  private readonly appContainer: any;
  private readonly fetchImpl?: typeof fetch;

  constructor(container: Record<string, unknown>, config?: Record<string, unknown>) {
    super(container, config);
    this.appContainer = container;
    this.fetchImpl = config?.fetchImpl as typeof fetch | undefined;
  }

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
        console.error("[iyzico] Ayarlar yüklenemedi:", err?.message);
      }
    }

    if (!settings) {
      throw new Error(
        "[iyzico] Ödeme ayarları yüklenemedi. Lütfen admin panelinden ödeme ayarlarını kaydedin.",
      );
    }
    return settings;
  }

  private createClient(settings: {
    iyzico_api_key: string;
    iyzico_secret_key: string;
    iyzico_mode: "sandbox" | "live";
  }) {
    return new IyzicoClient({
      apiKey: settings.iyzico_api_key,
      secretKey: settings.iyzico_secret_key,
      mode: settings.iyzico_mode,
      fetchImpl: this.fetchImpl,
    });
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const settings = await this.getSettings();

    if (!settings.iyzico_enabled) {
      throw new Error("iyzico ile ödeme yöntemi şu anda aktif değildir.");
    }

    if (!settings.iyzico_api_key || !settings.iyzico_secret_key) {
      throw new Error(
        "iyzico API kimlik bilgileri eksik. Lütfen admin panelinden ayarları kontrol edin.",
      );
    }

    const { amount, context } = input;
    const expectedKurus = Math.round(Number(amount) * 100);
    if (expectedKurus <= 0) {
      throw new Error("Ödeme tutarı sıfırdan büyük olmalıdır.");
    }

    const customer = (context as any)?.customer || {};
    const billingAddress = (context as any)?.billing_address || {};
    const shippingAddress = (context as any)?.shipping_address || billingAddress;

    const rawEmail = (context as any)?.email || customer.email || "musteri@example.test";
    const email = String(rawEmail).trim() || "musteri@example.test";

    const userIp =
      (context as any)?.ip ||
      (context as any)?.headers?.["x-alte-client-ip"] ||
      "127.0.0.1";

    const detectedCartId =
      (context as any)?.cart_id ||
      (context as any)?.cartId ||
      (context as any)?.resource_id ||
      ((input as any)?.data as any)?.cart_id ||
      "";

    const conversationId = `IYZ${Date.now().toString(36)}${String(
      (context as any)?.session_id || detectedCartId || "0",
    )
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-16)}`.slice(0, 64);
    const basketId = String(detectedCartId || conversationId).slice(0, 64);

    const priceStr = (expectedKurus / 100).toFixed(2);
    const basketItems = buildIyzicoBasketItems((context as any)?.items || [], expectedKurus);

    const webPublicUrl = (process.env.WEB_PUBLIC_URL || "http://localhost:3100").replace(
      /\/+$/,
      "",
    );
    const callbackUrl = `${webPublicUrl}/api/payment/iyzico/callback`;

    const maxInst = Math.min(12, Math.max(1, settings.iyzico_max_installment || 1));
    const enabledInstallments = Array.from({ length: maxInst }, (_, i) => i + 1);

    const firstName = String(billingAddress.first_name || customer.first_name || "Müşteri").trim();
    const lastName = String(billingAddress.last_name || customer.last_name || "Alıcı").trim();
    const fullName = `${firstName} ${lastName}`.trim() || "Müşteri";

    const client = this.createClient(settings);
    const initRes = await client.initializeCheckoutForm({
      locale: settings.iyzico_lang || "tr",
      conversationId,
      price: priceStr,
      paidPrice: priceStr,
      currency: "TRY",
      basketId,
      paymentGroup: "PRODUCT",
      callbackUrl,
      enabledInstallments,
      buyer: {
        id: String(customer.id || basketId).slice(0, 64),
        name: firstName || "Müşteri",
        surname: lastName || "Alıcı",
        gsmNumber: billingAddress.phone ? String(billingAddress.phone) : undefined,
        email,
        // KVKK rule: never collect or store customer TCKN; use iyzico docs placeholder
        identityNumber: "11111111111",
        registrationAddress: String(billingAddress.address_1 || "Türkiye").slice(0, 250),
        ip: String(userIp),
        city: String(billingAddress.city || "Istanbul").slice(0, 64),
        country: "Turkey",
        zipCode: billingAddress.postal_code ? String(billingAddress.postal_code) : undefined,
      },
      shippingAddress: {
        contactName:
          `${shippingAddress.first_name || firstName} ${shippingAddress.last_name || lastName}`.trim() ||
          fullName,
        city: String(shippingAddress.city || billingAddress.city || "Istanbul").slice(0, 64),
        country: "Turkey",
        address: String(shippingAddress.address_1 || billingAddress.address_1 || "Türkiye").slice(
          0,
          250,
        ),
        zipCode: shippingAddress.postal_code
          ? String(shippingAddress.postal_code)
          : undefined,
      },
      billingAddress: {
        contactName: fullName,
        city: String(billingAddress.city || "Istanbul").slice(0, 64),
        country: "Turkey",
        address: String(billingAddress.address_1 || "Türkiye").slice(0, 250),
        zipCode: billingAddress.postal_code ? String(billingAddress.postal_code) : undefined,
      },
      basketItems,
    });

    if (initRes.status !== "success" || !initRes.token) {
      throw new Error(
        `iyzico oturum başlatma hatası: ${initRes.errorMessage || initRes.errorCode || "Token alınamadı"}`,
      );
    }

    if (
      initRes.signature &&
      !verifyIyzicoInitSignature({
        conversationId: initRes.conversationId || conversationId,
        token: initRes.token,
        signature: initRes.signature,
        secretKey: settings.iyzico_secret_key,
      })
    ) {
      throw new Error("iyzico oturum başlatma imzası doğrulanamadı.");
    }

    const paymentPageUrl = initRes.paymentPageUrl || "";
    if (
      paymentPageUrl &&
      !validateIyzicoPaymentPageUrl(paymentPageUrl, { mode: settings.iyzico_mode })
    ) {
      throw new Error("iyzico yanıtındaki ödeme sayfası adresi güvenilir değil.");
    }

    const displayMode = settings.iyzico_display_mode === "embedded" ? "embedded" : "redirect";
    if (displayMode === "redirect" && !paymentPageUrl) {
      throw new Error("iyzico yönlendirme adresi (paymentPageUrl) alınamadı.");
    }

    const sessionData: IyzicoSessionData = {
      token: initRes.token,
      payment_page_url: paymentPageUrl,
      checkout_form_content:
        displayMode === "embedded" ? initRes.checkoutFormContent : undefined,
      display_mode: displayMode,
      conversation_id: conversationId,
      basket_id: basketId,
      cart_id: detectedCartId || undefined,
      expected_amount_kurus: expectedKurus,
      mode: settings.iyzico_mode,
      status: "pending",
    };

    return {
      id: conversationId,
      data: sessionData as any,
    };
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = input.data as unknown as IyzicoSessionData;
    const isSuccess =
      data?.status === "authorized" || data?.status === "success" || data?.status === "captured";
    return {
      status: isSuccess ? "authorized" : "pending",
      data: data as any,
    };
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = (input.data || {}) as unknown as IyzicoSessionData;
    return {
      data: {
        ...data,
        status: "captured",
        captured_at: data.captured_at || new Date().toISOString(),
      } as any,
    };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data || {}) as unknown as IyzicoSessionData;
    if (!data.iyzico_payment_id) {
      return {
        data: { ...data, status: "canceled" } as any,
      };
    }

    const settings = await this.getSettings();
    const client = this.createClient(settings);
    const res = await client.cancelPayment({
      locale: settings.iyzico_lang || "tr",
      conversationId: data.conversation_id || `CANCEL_${Date.now()}`,
      paymentId: data.iyzico_payment_id,
      ip: "127.0.0.1",
    });

    if (res.status !== "success") {
      throw new Error(
        `iyzico iptal işlemi başarısız: ${res.errorMessage || res.errorCode || "Bilinmeyen hata"}`,
      );
    }

    return {
      data: {
        ...data,
        status: "canceled",
      } as any,
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = (input.data || {}) as unknown as IyzicoSessionData;
    const txIds = data.iyzico_payment_transaction_ids || [];
    if (txIds.length === 0) {
      throw new Error("iyzico iade için paymentTransactionId bulunamadı (elle iade gerekir).");
    }

    const refundAmount = Number(input.amount || 0);
    if (refundAmount <= 0) {
      throw new Error("İade tutarı sıfırdan büyük olmalıdır.");
    }

    const settings = await this.getSettings();
    const client = this.createClient(settings);

    const res = await client.refundPayment({
      locale: settings.iyzico_lang || "tr",
      conversationId: data.conversation_id || `REFUND_${Date.now()}`,
      paymentTransactionId: txIds[0],
      price: refundAmount.toFixed(2),
      currency: "TRY",
      ip: "127.0.0.1",
    });

    if (res.status !== "success") {
      throw new Error(
        `iyzico iade işlemi başarısız: ${res.errorMessage || res.errorCode || "Bilinmeyen hata"}`,
      );
    }

    return {
      data: {
        ...data,
        last_refund_amount: refundAmount,
      } as any,
    };
  }

  async deletePayment(_input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return {};
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const data = input.data as unknown as IyzicoSessionData;
    if (data?.status === "captured") return { status: "captured" };
    if (data?.status === "authorized" || data?.status === "success") {
      return { status: "authorized" };
    }
    if (data?.status === "canceled") return { status: "canceled" };
    if (data?.status === "failed") return { status: "error" };
    return { status: "pending" };
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data };
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"],
  ): Promise<WebhookActionResult> {
    return {
      action: "not_supported",
    };
  }
}

export default IyzicoPaymentService;
