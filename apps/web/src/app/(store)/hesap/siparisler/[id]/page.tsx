import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccountShell } from "../../../../../components/account/AccountShell";
import { getServerCustomer, getServerCustomerOrderById } from "../../../../../lib/medusa/account";
import { formatTRY } from "../../../../../lib/medusa/format";
import { safeHref } from "../../../../../lib/safe-href";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await getServerCustomer();
  if (!customer) {
    redirect("/hesap/giris");
  }

  const { id } = await params;
  const order = await getServerCustomerOrderById(id);
  if (!order) {
    notFound();
  }

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Müşteri";
  const meta = (order.metadata || {}) as Record<string, unknown>;
  const trackingCode = typeof meta.tracking_code === "string" ? meta.tracking_code : null;
  const trackingUrl = typeof meta.tracking_url === "string" ? safeHref(meta.tracking_url) : null;
  const carrierName = typeof meta.carrier_name === "string" ? meta.carrier_name : null;

  return (
    <AccountShell customerName={fullName} emailVerified={customer.email_verified}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">
            Sipariş #{order.display_id || order.id.slice(-6)}
          </h2>
          <Link href="/hesap/siparisler" className="text-sm text-stone-700 underline">
            Siparişlere Dön
          </Link>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5 text-sm space-y-2">
          <p>
            <span className="text-stone-500">Tarih:</span>{" "}
            {new Date(order.created_at).toLocaleString("tr-TR")}
          </p>
          <p>
            <span className="text-stone-500">Durum:</span> {order.status}
          </p>
          {trackingCode && (
            <p>
              <span className="text-stone-500">Kargo Takip ({carrierName || "Kargo"}):</span>{" "}
              <span className="font-mono font-medium">{trackingCode}</span>
              {trackingUrl && trackingUrl !== "/" && (
                <>
                  {" "}
                  —{" "}
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-stone-900"
                  >
                    Kargoyu Takip Et
                  </a>
                </>
              )}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <h3 className="text-base font-semibold text-stone-900 mb-3">Sipariş Kalemleri</h3>
          <ul className="divide-y divide-stone-100 text-sm">
            {(order.items || []).map((item) => (
              <li key={item.id} className="py-2.5 flex justify-between">
                <span>
                  {item.title} × {item.quantity}
                </span>
                <span className="font-medium">
                  {formatTRY((item.unit_price || 0) * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-stone-200 mt-3 pt-3 text-sm flex justify-between font-bold text-stone-900">
            <span>Toplam</span>
            <span>{formatTRY(order.total)}</span>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
