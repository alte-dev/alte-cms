export class MedusaApiError extends Error {
  status: number;
  code?: string;
  type?: string;

  constructor(message: string, status: number, code?: string, type?: string) {
    super(message);
    this.name = "MedusaApiError";
    this.status = status;
    this.code = code;
    this.type = type;
  }
}

const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";

export async function medusaFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const publishableKey = process.env.MEDUSA_PUBLISHABLE_KEY || "";
  const url = `${MEDUSA_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(publishableKey ? { "x-publishable-api-key": publishableKey } : {}),
    ...(options.headers as Record<string, string>),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorBody: any = null;
      try {
        errorBody = await res.json();
      } catch {
        // Not JSON
      }

      const message =
        errorBody?.message ||
        errorBody?.error ||
        `Medusa API returned HTTP ${res.status}: ${res.statusText}`;
      const code = errorBody?.code;
      const type = errorBody?.type;

      throw new MedusaApiError(message, res.status, code, type);
    }

    // 204 No Content
    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof MedusaApiError) {
      throw err;
    }
    // Network / unreachable error
    throw new MedusaApiError(
      `Medusa servisine bağlanılamadı (${err.message || String(err)})`,
      503,
      "SERVICE_UNAVAILABLE",
    );
  }
}
