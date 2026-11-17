import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "../../../components/account/AccountShell";
import {
  getServerCustomer,
  getServerCustomerAddresses,
  getServerCustomerOrders,
} from "../../../lib/medusa/account";

export const dynamic = "force-dynamic";

export default async function AccountDashboardPage() {
  const customer = await getServerCustomer();
  if (!customer) {
    redirect("/hesap/giris");
  }

  const [orders, addresses] = await Promise.all([
    getServerCustomerOrders(),
    getServerCustomerAddresses(),
  ]);

  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Müşteri";

  return (
    <AccountShell customerName={fullName} emailVerified={customer.email_verified}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-medium text-stone-500">Toplam Sipariş</h2>
          <p className="text-2xl font-bold text-stone-900 mt-1">{orders.length}</p>
          <Link
            href="/hesap/siparisler"
            className="inline-block mt-3 text-sm font-medium text-stone-900 underline"
          >
            Siparişlerimi Görüntüle
          </Link>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-medium text-stone-500">Kayıtlı Adres</h2>
          <p className="text-2xl font-bold text-stone-900 mt-1">{addresses.length}</p>
          <Link
            href="/hesap/adresler"
            className="inline-block mt-3 text-sm font-medium text-stone-900 underline"
          >
            Adreslerimi Yönet
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-base font-semibold text-stone-900 mb-3">Hesap Bilgileri</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-stone-500">Ad Soyad</dt>
            <dd className="font-medium text-stone-900">{fullName}</dd>
          </div>
          <div>
            <dt className="text-stone-500">E-posta</dt>
            <dd className="font-medium text-stone-900">{customer.email}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Telefon</dt>
            <dd className="font-medium text-stone-900">{customer.phone || "Belirtilmedi"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">E-posta Durumu</dt>
            <dd className="font-medium text-stone-900">
              {customer.email_verified ? "Doğrulandı" : "Doğrulanmadı"}
            </dd>
          </div>
        </dl>
      </div>
    </AccountShell>
  );
}
