import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatTRY } from "@/lib/medusa/format";

export const metadata: Metadata = {
  title: "Sipariş Takibi",
  description: "Siparişinizin durumunu ve kargo takip bilgilerini kolayca sorgulayın.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

interface SiparisTakipPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SiparisTakipPage({ searchParams }: SiparisTakipPageProps) {
  const params = await searchParams;
  const orderNumber = typeof params.no === "string" ? params.no.trim() : "";
  const email = typeof params.email === "string" ? params.email.trim() : "";

  let orderData: any = null;
  let errorMessage: string | null = null;

  if (orderNumber && email) {
    const medusaUrl =
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_URL ||
      "http://127.0.0.1:9000";

    try {
      const res = await fetch(`${medusaUrl}/store/order-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id_or_number: orderNumber,
          email,
        }),
        cache: "no-store",
      });

      const data = await res.json();
      if (!res.ok) {
        errorMessage = data.error || "Sipariş bulunamadı veya e-posta adresi eşleşmiyor.";
      } else {
        orderData = data.order;
      }
    } catch {
      errorMessage = "Sipariş sorgulanırken bir bağlantı hatası oluştu. Lütfen tekrar deneyiniz.";
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="bg-green-100 text-green-800 px-2.5 py-1 rounded-full text-xs font-semibold">
            Tamamlandı
          </span>
        );
      case "canceled":
        return (
          <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-full text-xs font-semibold">
            İptal Edildi
          </span>
        );
      case "pending":
      default:
        return (
          <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-semibold">
            Hazırlanıyor
          </span>
        );
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6">
      {/* Page Heading */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
          Sipariş Takibi
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Sipariş numaranız ve siparişte kullandığınız e-posta adresiyle güncel kargo durumunuzu
          sorgulayabilirsiniz.
        </p>
      </div>

      {/* Query Form */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm mb-8">
        <form method="GET" action="/siparis-takip" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="no"
                className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1"
              >
                Sipariş Numarası
              </label>
              <input
                id="no"
                name="no"
                type="text"
                required
                defaultValue={orderNumber}
                placeholder="Örn: 1001 veya #1001"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 placeholder-stone-400"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1"
              >
                E-posta Adresi
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={email}
                placeholder="siparis@ornek.com"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 placeholder-stone-400"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm rounded-xl transition duration-150"
            >
              Sorgula
            </button>
          </div>
        </form>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-8 text-center">
          {errorMessage}
        </div>
      )}

      {/* Order Results */}
      {orderData && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-stone-500 font-medium">Sipariş No</span>
              <h2 className="text-lg font-bold text-stone-900">#{orderData.display_id}</h2>
              <span className="text-xs text-stone-500">
                {new Date(orderData.created_at).toLocaleDateString("tr-TR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>

            <div className="flex items-center gap-3">{getStatusBadge(orderData.status)}</div>
          </div>

          {/* Shipment & Tracking Details */}
          <div className="p-6 border-b border-stone-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Kargo & Takip Durumu
            </h3>

            {orderData.tracking_code ? (
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-stone-500">Kargo Firması</p>
                  <p className="text-sm font-semibold text-stone-900">
                    {orderData.carrier_name || "Kargo"}
                  </p>
                  <p className="text-xs text-stone-500 mt-1 font-mono">
                    Takip Kodu: {orderData.tracking_code}
                  </p>
                </div>

                {orderData.tracking_url && (
                  <a
                    href={orderData.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition"
                  >
                    Kargo Takip Sayfasına Git &rarr;
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-stone-600 bg-stone-50 border border-stone-200 rounded-xl p-4">
                Siparişiniz hazırlanma aşamasındadır. Kargo takip kodunuz kargo firmasına teslim
                edildiğinde e-posta ile iletilecektir.
              </p>
            )}
          </div>

          {/* Items Summary */}
          <div className="p-6 border-b border-stone-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Sipariş Kalemleri
            </h3>
            <ul className="divide-y divide-stone-100">
              {orderData.items?.map((item: any, idx: number) => (
                <li key={idx} className="py-2.5 flex justify-between items-center text-sm">
                  <span className="text-stone-800 font-medium">{item.title}</span>
                  <span className="text-stone-500 text-xs font-semibold">{item.quantity} Adet</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Financial Totals */}
          <div className="p-6 bg-stone-50 text-sm space-y-1.5">
            <div className="flex justify-between text-stone-600">
              <span>Ara Toplam</span>
              <span>{formatTRY(orderData.subtotal)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Kargo Ücreti</span>
              <span>{formatTRY(orderData.shipping_total)}</span>
            </div>
            {orderData.cod_fee && (
              <div className="flex justify-between text-stone-600">
                <span>Kapıda Ödeme Bedeli</span>
                <span>{formatTRY(orderData.cod_fee)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-stone-900 pt-2 border-t border-stone-200">
              <span>Genel Toplam (KDV Dahil)</span>
              <span>{formatTRY(orderData.total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Helpful links */}
      <div className="mt-8 text-center text-xs text-stone-500 space-x-4">
        <Link href="/" className="hover:underline">
          Ana Sayfa
        </Link>
        <span>&bull;</span>
        <Link href="/urunler" className="hover:underline">
          Tüm Ürünler
        </Link>
        <span>&bull;</span>
        <Link href="/sayfa/iletisim" className="hover:underline">
          Müşteri Destek
        </Link>
      </div>
    </div>
  );
}
