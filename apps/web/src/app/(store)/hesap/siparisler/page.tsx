import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "../../../../components/account/AccountShell";
import { getServerCustomer, getServerCustomerOrders } from "../../../../lib/medusa/account";
import { formatTRY } from "../../../../lib/medusa/format";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const customer = await getServerCustomer();
  if (!customer) {
    redirect("/hesap/giris");
  }

  const orders = await getServerCustomerOrders();
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Müşteri";

  return (
    <AccountShell customerName={fullName} emailVerified={customer.email_verified}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900">Sipariş Geçmişim</h2>
        {orders.length === 0 ? (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-600">
            Henüz siparişiniz bulunmuyor.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-stone-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="text-sm">
                  <p className="font-semibold text-stone-900">
                    Sipariş #{order.display_id || order.id.slice(-6)}
                  </p>
                  <p className="text-stone-500 mt-0.5">
                    {new Date(order.created_at).toLocaleDateString("tr-TR")} • Durum: {order.status}
                  </p>
                  {typeof order.metadata?.tracking_code === "string" &&
                    order.metadata.tracking_code && (
                      <p className="text-stone-700 mt-1">
                        Kargo Takip:{" "}
                        <span className="font-mono">{order.metadata.tracking_code}</span>
                      </p>
                    )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-stone-900">{formatTRY(order.total)}</span>
                  <Link
                    href={`/hesap/siparisler/${order.id}`}
                    className="px-3 py-1.5 rounded-md border border-stone-300 text-xs font-medium text-stone-800 hover:bg-stone-50"
                  >
                    Detay
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AccountShell>
  );
}
