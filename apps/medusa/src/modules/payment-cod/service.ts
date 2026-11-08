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

export interface CodSessionData {
  status: "authorized" | "captured" | "canceled";
  fee: number;
  fee_label: string;
  authorized_at: string;
  captured_at?: string;
  captured_by?: string;
}

export class CodPaymentService extends AbstractPaymentProvider {
  static identifier = "cod";
  private appContainer: any;

  constructor(container: Record<string, unknown>, config?: Record<string, unknown>) {
    super(container, config);
    this.appContainer = container;
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
        console.error("[COD] Failed to resolve settings from service:", err?.message);
      }
    }
    return settings;
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const settings = await this.getSettings();

    if (settings && !settings.cod_enabled) {
      throw new Error("Kapıda ödeme yöntemi şu anda aktif değildir.");
    }

    const { amount } = input;
    const numAmount = Number(amount || 0);

    if (
      settings &&
      settings.cod_max_order_amount !== null &&
      settings.cod_max_order_amount > 0 &&
      numAmount > settings.cod_max_order_amount
    ) {
      throw new Error(
        `Kapıda ödeme yöntemi en fazla ${settings.cod_max_order_amount} TL tutarındaki siparişler için geçerlidir. Mevcut sepet tutarınız: ${numAmount} TL.`,
      );
    }

    const fee = settings ? settings.cod_fee : 100;
    const feeLabel = settings ? settings.cod_fee_label : "Kapıda Ödeme Hizmet Bedeli";

    const sessionData: CodSessionData = {
      status: "authorized",
      fee,
      fee_label: feeLabel,
      authorized_at: new Date().toISOString(),
    };

    const codId = `cod_${Date.now()}`;
    return {
      id: codId,
      data: sessionData as any,
    };
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = (input.data || {}) as unknown as CodSessionData;
    return {
      status: "authorized",
      data: {
        ...data,
        status: "authorized",
        authorized_at: data.authorized_at || new Date().toISOString(),
      } as any,
    };
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = (input.data || {}) as unknown as CodSessionData;
    return {
      data: {
        ...data,
        status: "captured",
        captured_at: new Date().toISOString(),
      } as any,
    };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const data = (input.data || {}) as unknown as CodSessionData;
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
    const data = input.data as unknown as CodSessionData;
    if (data?.status === "captured") return { status: "captured" };
    if (data?.status === "authorized") return { status: "authorized" };
    if (data?.status === "canceled") return { status: "canceled" };
    return { status: "authorized" };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    return {
      data: input.data,
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
    _payload: ProviderWebhookPayload["payload"],
  ): Promise<WebhookActionResult> {
    return {
      action: "not_supported",
      data: { session_id: "", amount: new BigNumber(0) },
    };
  }
}

export default CodPaymentService;
