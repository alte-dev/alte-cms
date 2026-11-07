export interface MedusaProduct {
  id: string;
  title: string;
  handle: string;
  description?: string;
  thumbnail?: string;
  variants?: Array<{
    id: string;
    title: string;
    prices?: Array<{
      amount: number;
      currency_code: string;
    }>;
  }>;
}

export interface MedusaProductsResponse {
  products: MedusaProduct[];
  count: number;
  offset: number;
  limit: number;
}

/**
 * Resolve Medusa Base URL:
 * - On server (SSR, Route Handlers): MEDUSA_BACKEND_URL (http://127.0.0.1:9000)
 * - On browser client: NEXT_PUBLIC_MEDUSA_URL (http://api.localhost:9000)
 */
export function getMedusaUrl(): string {
  if (typeof window === "undefined") {
    return process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";
  }
  return process.env.NEXT_PUBLIC_MEDUSA_URL || "http://api.localhost:9000";
}

/**
 * Fetch products from Medusa Store API with error tolerance
 */
export async function getMedusaProducts(): Promise<{
  products: MedusaProduct[];
  connected: boolean;
  error?: string;
}> {
  const baseUrl = getMedusaUrl();
  try {
    const res = await fetch(`${baseUrl}/store/products`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 30 }, // ISR 30 seconds
    });

    if (!res.ok) {
      return {
        products: [],
        connected: false,
        error: `Medusa API returned HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = (await res.json()) as MedusaProductsResponse;
    return {
      products: data.products || [],
      connected: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      products: [],
      connected: false,
      error: `Bağlantı hatası: ${message}`,
    };
  }
}
