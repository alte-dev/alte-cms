import { MedusaApiError, medusaFetch } from "./client";
import { deleteCustomerSessionToken, getCustomerSessionToken } from "./cookies";

export interface CustomerProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  email_verified: boolean;
  email_verified_at: string | null;
}

export interface CustomerAddress {
  id: string;
  address_name?: string | null;
  first_name: string;
  last_name: string;
  phone?: string | null;
  address_1: string;
  address_2?: string | null;
  city: string;
  province?: string | null;
  postal_code?: string | null;
  country_code: string;
  is_default_shipping?: boolean;
  is_default_billing?: boolean;
}

export interface AccountOrderSummary {
  id: string;
  display_id?: number;
  status: string;
  fulfillment_status?: string;
  payment_status?: string;
  total: number;
  subtotal: number;
  shipping_total: number;
  currency_code: string;
  created_at: string;
  metadata?: Record<string, unknown>;
  items?: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    total?: number;
    thumbnail?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  shipping_address?: Partial<CustomerAddress> | null;
}

function internalHeaders(clientIp?: string, token?: string): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET || "";
  return {
    ...(secret ? { "x-alte-internal": secret } : {}),
    ...(clientIp ? { "x-alte-client-ip": clientIp } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function medusaAccountFetch<T>(
  endpoint: string,
  options: RequestInit & { clientIp?: string; customerToken?: string } = {},
): Promise<T> {
  const { clientIp, customerToken, headers, ...rest } = options;
  try {
    return await medusaFetch<T>(endpoint, {
      ...rest,
      cache: "no-store",
      headers: {
        ...internalHeaders(clientIp, customerToken),
        ...(headers as Record<string, string>),
      },
    });
  } catch (err) {
    if (err instanceof MedusaApiError && err.status === 401 && customerToken) {
      await deleteCustomerSessionToken().catch(() => null);
    }
    throw err;
  }
}

export async function getServerCustomer(): Promise<CustomerProfile | null> {
  const token = await getCustomerSessionToken();
  if (!token) return null;
  try {
    const data = await medusaFetch<{ customer: CustomerProfile }>("/store/account/me", {
      cache: "no-store",
      headers: internalHeaders(undefined, token),
    });
    return data.customer || null;
  } catch {
    return null;
  }
}

export async function getServerCustomerAddresses(): Promise<CustomerAddress[]> {
  const token = await getCustomerSessionToken();
  if (!token) return [];
  try {
    const data = await medusaFetch<{ addresses: CustomerAddress[] }>(
      "/store/customers/me/addresses",
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return data.addresses || [];
  } catch {
    return [];
  }
}

export async function getServerCustomerOrders(): Promise<AccountOrderSummary[]> {
  const token = await getCustomerSessionToken();
  if (!token) return [];
  try {
    const fields =
      "id,display_id,status,fulfillment_status,payment_status,total,subtotal,shipping_total,currency_code,created_at,metadata,*items";
    const data = await medusaFetch<{ orders: AccountOrderSummary[] }>(
      `/store/orders?fields=${encodeURIComponent(fields)}&order=-created_at`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return data.orders || [];
  } catch {
    return [];
  }
}

export async function getServerCustomerOrderById(
  orderId: string,
): Promise<AccountOrderSummary | null> {
  const token = await getCustomerSessionToken();
  if (!token || !orderId) return null;
  try {
    const fields =
      "id,display_id,status,fulfillment_status,payment_status,total,subtotal,shipping_total,currency_code,created_at,metadata,*items,*shipping_address";
    const data = await medusaFetch<{ order: AccountOrderSummary }>(
      `/store/orders/${encodeURIComponent(orderId)}?fields=${encodeURIComponent(fields)}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return data.order || null;
  } catch {
    return null;
  }
}
