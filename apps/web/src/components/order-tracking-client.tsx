"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatTRY } from "@/lib/medusa/format";
import { safeHref } from "@/lib/safe-href";

interface TrackedOrder {
  display_id: number | string;
  status: string;
  created_at: string;
  items?: Array<{ title: string; quantity: number }>;
  subtotal: number;
  shipping_total: number;
  total: number;
  carrier_name?: string | null;
  tracking_code?: string | null;
  tracking_url?: string | null;
}

export function OrderTrackingClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<TrackedOrder | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanNo = orderNumber.trim();
    const cleanEmail = email.trim();
    if (!cleanNo || !cleanEmail) return;

    setLoading(true);
    setErrorMessage(null);
    setOrderData(null);

    try {
      const res = await fetch("/api/order-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id_or_number: cleanNo,
          email: cleanEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.error || "Sipariş bulunamadı veya e-posta adresi eşleşmiyor.");
      } else {
        setOrderData(data.order || null);
      }
    } catch {
      setErrorMessage("Sipariş sorgulanırken bir bağlantı hatası oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setLoading(false);
    }
  };

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

  const safeTrackingUrl = orderData?.tracking_url ? safeHref(orderData.tracking_url, "") : "";

  return (
    <>
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm mb-8">
        <form onSubmit={handleSubmit} className="space-y-4">
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
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siparis@ornek.com"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 placeholder-stone-400"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-medium text-sm rounded-xl transition duration-150"
            >
              {loading ? "Sorgulanıyor..." : "Sorgula"}
            </button>
          </div>
        </form>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-8 text-center"
        >
          {errorMessage}
        </div>
      )}

      {orderData && (
        <div
          data-testid="order-tracking-result"
          className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden"
        >
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

          <div className="p-6 border-b border-stone-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Kargo &amp; Takip Durumu
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

                {safeTrackingUrl && (
                  <a
                    href={safeTrackingUrl}
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

          <div className="p-6 border-b border-stone-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Sipariş Kalemleri
            </h3>
            <ul className="divide-y divide-stone-100">
              {orderData.items?.map((item, idx) => (
                <li key={idx} className="py-2.5 flex justify-between items-center text-sm">
                  <span className="text-stone-800 font-medium">{item.title}</span>
                  <span className="text-stone-500 font-mono text-xs">x {item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 bg-stone-50 space-y-2 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Ara Toplam</span>
              <span>{formatTRY(orderData.subtotal)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>Kargo</span>
              <span>
                {Number(orderData.shipping_total) > 0
                  ? formatTRY(orderData.shipping_total)
                  : "Ücretsiz"}
              </span>
            </div>
            <div className="flex justify-between text-stone-900 font-bold text-base pt-2 border-t border-stone-200">
              <span>Genel Toplam</span>
              <span>{formatTRY(orderData.total)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-stone-600 hover:text-stone-900 underline">
          Alışverişe Devam Et
        </Link>
      </div>
    </>
  );
}
