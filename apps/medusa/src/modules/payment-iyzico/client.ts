import crypto from "crypto";
import { constantTimeCompare } from "../../utils/crypto";

export type IyzicoMode = "sandbox" | "live";

const SANDBOX_API_BASE = "https://sandbox-api.iyzipay.com";
const LIVE_API_BASE = "https://api.iyzipay.com";

const ALLOWED_PAYMENT_HOSTS: Record<IyzicoMode, readonly string[]> = {
  sandbox: ["sandbox-cpp.iyzipay.com", "sandbox-api.iyzipay.com"],
  live: ["cpp.iyzipay.com", "api.iyzipay.com"],
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024; // 1 MB

export function buildIyziAuthHeaderV2(params: {
  apiKey: string;
  secretKey: string;
  uriPath: string;
  requestBody: string;
  randomKey: string;
}): string {
  const signature = crypto
    .createHmac("sha256", params.secretKey)
    .update(params.randomKey + params.uriPath + params.requestBody)
    .digest("hex");

  const authString = `apiKey:${params.apiKey}&randomKey:${params.randomKey}&signature:${signature}`;
  const encoded = Buffer.from(authString, "utf8").toString("base64");
  return `IYZWSv2 ${encoded}`;
}

export function stripTrailingZeros(value: string | number): string {
  const str = String(value).trim();
  if (!str.includes(".")) return str;
  const stripped = str.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  return stripped;
}

export function calculateIyzicoHmacSha256(
  params: Array<string | number | undefined | null>,
  secretKey: string,
): string {
  const payload = params.map((p) => (p === undefined || p === null ? "" : String(p))).join(":");
  return crypto.createHmac("sha256", secretKey).update(payload, "utf8").digest("hex");
}

export function verifyIyzicoInitSignature(params: {
  conversationId: string;
  token: string;
  signature: string;
  secretKey: string;
}): boolean {
  if (!params.signature || !params.secretKey) return false;
  const expected = calculateIyzicoHmacSha256(
    [params.conversationId, params.token],
    params.secretKey,
  );
  return constantTimeCompare(params.signature, expected);
}

export function verifyIyzicoRetrieveSignature(params: {
  paymentStatus: string;
  paymentId: string;
  currency: string;
  basketId: string;
  conversationId: string;
  paidPrice: string | number;
  price: string | number;
  token: string;
  signature: string;
  secretKey: string;
}): boolean {
  if (!params.signature || !params.secretKey) return false;
  const expected = calculateIyzicoHmacSha256(
    [
      params.paymentStatus,
      params.paymentId,
      params.currency,
      params.basketId,
      params.conversationId,
      stripTrailingZeros(params.paidPrice),
      stripTrailingZeros(params.price),
      params.token,
    ],
    params.secretKey,
  );
  return constantTimeCompare(params.signature, expected);
}

export function resolveIyzicoBaseUrl(
  mode: IyzicoMode,
  opts?: { nodeEnv?: string; apiBaseOverride?: string },
): string {
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const override = opts?.apiBaseOverride ?? process.env.IYZICO_API_BASE;

  if (nodeEnv === "production") {
    if (override && override.trim() !== "") {
      throw new Error("FAIL-CLOSED: IYZICO_API_BASE is strictly prohibited in production.");
    }
    return mode === "live" ? LIVE_API_BASE : SANDBOX_API_BASE;
  }

  if (override && override.trim() !== "") {
    return override.trim().replace(/\/+$/, "");
  }

  return mode === "live" ? LIVE_API_BASE : SANDBOX_API_BASE;
}

export function validateIyzicoPaymentPageUrl(
  rawUrl: string,
  opts: { mode: IyzicoMode; nodeEnv?: string; apiBaseOverride?: string },
): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  const nodeEnv = opts.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const override = opts.apiBaseOverride ?? process.env.IYZICO_API_BASE;

  if (nodeEnv !== "production" && override && override.trim() !== "") {
    try {
      const allowedOverride = new URL(override.trim());
      if (parsed.origin === allowedOverride.origin) {
        return true;
      }
    } catch {
      // ignore invalid override
    }
  }

  if (parsed.protocol !== "https:") return false;
  return ALLOWED_PAYMENT_HOSTS[opts.mode].includes(parsed.hostname);
}

export interface IyzicoBasketItem {
  id: string;
  name: string;
  category1: string;
  category2?: string;
  itemType: "PHYSICAL" | "VIRTUAL";
  price: string;
}

export interface IyzicoAddress {
  contactName: string;
  city: string;
  country: string;
  address: string;
  zipCode?: string;
}

export interface IyzicoBuyer {
  id: string;
  name: string;
  surname: string;
  gsmNumber?: string;
  email: string;
  identityNumber: string;
  registrationAddress: string;
  ip: string;
  city: string;
  country: string;
  zipCode?: string;
}

export interface IyzicoCheckoutFormInitRequest {
  locale: "tr" | "en";
  conversationId: string;
  price: string;
  paidPrice: string;
  currency: "TRY";
  basketId: string;
  paymentGroup?: "PRODUCT" | "LISTING" | "SUBSCRIPTION";
  callbackUrl: string;
  enabledInstallments: number[];
  buyer: IyzicoBuyer;
  shippingAddress: IyzicoAddress;
  billingAddress: IyzicoAddress;
  basketItems: IyzicoBasketItem[];
}

export interface IyzicoCheckoutFormInitResponse {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  locale?: string;
  systemTime?: number;
  conversationId?: string;
  token?: string;
  checkoutFormContent?: string;
  tokenExpireTime?: number;
  paymentPageUrl?: string;
  signature?: string;
}

export interface IyzicoCheckoutFormRetrieveResponse {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  locale?: string;
  systemTime?: number;
  conversationId?: string;
  price?: number | string;
  paidPrice?: number | string;
  currency?: string;
  basketId?: string;
  paymentId?: string;
  paymentStatus?: string;
  token?: string;
  signature?: string;
  itemTransactions?: Array<{
    itemId?: string;
    paymentTransactionId?: string;
    price?: number | string;
    paidPrice?: number | string;
  }>;
}

export interface IyzicoClientOptions {
  apiKey: string;
  secretKey: string;
  mode: IyzicoMode;
  baseUrl?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
}

class NonRetryableIyzicoError extends Error {}

export class IyzicoClient {
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: IyzicoClientOptions) {
    this.apiKey = options.apiKey;
    this.secretKey = options.secretKey;
    this.baseUrl = (options.baseUrl || resolveIyzicoBaseUrl(options.mode)).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.fetchImpl = options.fetchImpl ?? fetch;

    if (process.env.NODE_ENV === "production" && !this.baseUrl.startsWith("https://")) {
      throw new Error("FAIL-CLOSED: iyzico baseUrl must use HTTPS in production.");
    }
  }

  private async readBoundedText(response: Response): Promise<string> {
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > this.maxResponseBytes) {
      throw new NonRetryableIyzicoError("iyzico yanıtı izin verilen maksimum boyut sınırını aşıyor.");
    }

    const buf = await response.arrayBuffer();
    if (buf.byteLength > this.maxResponseBytes) {
      throw new NonRetryableIyzicoError("iyzico yanıtı izin verilen maksimum boyut sınırını aşıyor.");
    }

    return new TextDecoder("utf-8").decode(buf);
  }

  private async post<T>(uriPath: string, payload: unknown, allowRetry: boolean): Promise<T> {
    const requestBody = JSON.stringify(payload);
    const maxAttempts = allowRetry ? 2 : 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const randomKey = `${Date.now()}${crypto.randomBytes(8).toString("hex")}`;
      const authHeader = buildIyziAuthHeaderV2({
        apiKey: this.apiKey,
        secretKey: this.secretKey,
        uriPath,
        requestBody,
        randomKey,
      });

      try {
        const res = await this.fetchImpl(`${this.baseUrl}${uriPath}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: authHeader,
            "x-iyzi-rnd": randomKey,
          },
          body: requestBody,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        const text = await this.readBoundedText(res);

        if (res.status >= 500) {
          lastError = new Error(`iyzico sunucu hatası (HTTP ${res.status}).`);
          if (attempt < maxAttempts) continue;
          throw lastError;
        }

        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          throw new NonRetryableIyzicoError(
            `iyzico geçersiz JSON yanıtı döndü (HTTP ${res.status}).`,
          );
        }

        if (!res.ok) {
          const code = json?.errorCode ? ` [${json.errorCode}]` : "";
          throw new NonRetryableIyzicoError(
            `iyzico API isteği başarısız (HTTP ${res.status}${code}).`,
          );
        }

        return json as T;
      } catch (err: any) {
        if (err instanceof NonRetryableIyzicoError) {
          throw err;
        }
        if (err?.name === "TimeoutError" || err?.name === "AbortError") {
          lastError = new Error("iyzico API zaman aşımına uğradı.");
        } else if (err instanceof Error) {
          lastError = err;
        } else {
          lastError = new Error("iyzico API iletişim hatası.");
        }

        if (attempt < maxAttempts) continue;
        throw lastError;
      }
    }

    throw lastError || new Error("iyzico API iletişim hatası.");
  }

  public initializeCheckoutForm(
    request: IyzicoCheckoutFormInitRequest,
  ): Promise<IyzicoCheckoutFormInitResponse> {
    return this.post<IyzicoCheckoutFormInitResponse>(
      "/payment/iyzipos/checkoutform/initialize/auth/ecom",
      request,
      false, // Never retry payment initialization
    );
  }

  public retrieveCheckoutForm(request: {
    locale: "tr" | "en";
    conversationId: string;
    token: string;
  }): Promise<IyzicoCheckoutFormRetrieveResponse> {
    return this.post<IyzicoCheckoutFormRetrieveResponse>(
      "/payment/iyzipos/checkoutform/auth/ecom/detail",
      request,
      true, // Read-only retrieve is safe to retry once
    );
  }

  public cancelPayment(request: {
    locale: "tr" | "en";
    conversationId: string;
    paymentId: string;
    ip: string;
  }): Promise<{ status: string; errorCode?: string; errorMessage?: string; paymentId?: string }> {
    return this.post(
      "/payment/cancel",
      request,
      false, // Never retry state-mutating cancel
    );
  }

  public refundPayment(request: {
    locale: "tr" | "en";
    conversationId: string;
    paymentTransactionId: string;
    price: string;
    currency: "TRY";
    ip: string;
  }): Promise<{
    status: string;
    errorCode?: string;
    errorMessage?: string;
    paymentId?: string;
    paymentTransactionId?: string;
    price?: number | string;
  }> {
    return this.post(
      "/payment/refund",
      request,
      false, // Never retry state-mutating refund
    );
  }

  public binCheck(request: {
    locale: "tr" | "en";
    binNumber: string;
    conversationId: string;
  }): Promise<{ status: string; errorCode?: string; errorMessage?: string }> {
    return this.post("/payment/bin/check", request, true);
  }
}
