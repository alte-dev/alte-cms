import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Package, ArrowRight, MapPin, Receipt, Mail } from "lucide-react";
import { getOrder } from "@/lib/medusa/cart";
import { getOrderConfirmation } from "@/lib/medusa/cookies";
import { formatTRY } from "@/lib/medusa/format";
export const metadata: Metadata = {
  title: "Siparişiniz Alındı | Mağaza",
  description: "Sipariş onay ve detay sayfası",
};

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage() {
  const orderId = await getOrderConfirmation();
  if (!orderId) {
    redirect("/");
  }

  const order = await getOrder(orderId);
  if (!order) {
    redirect("/");
  }

  const subtotal = order.item_subtotal ?? order.subtotal ?? 0;
  const taxTotal = order.tax_total ?? 0;
  const shippingTotal = order.shipping_total ?? 0;
  const discountTotal = order.discount_total ?? 0;
  const total = order.total ?? subtotal;

  const invoiceType = order.metadata?.invoice_type || "individual";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Success Banner */}
      <div className="text-center pb-8 border-b border-stone-200">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">
          Siparişiniz Başarıyla Alındı!
        </h1>
        <p className="text-sm text-stone-600 mt-2">
          Teşekkür ederiz. Sipariş özetiniz aşağıda yer almaktadır. Sipariş detayları{" "}
          <strong className="text-stone-900">{order.email}</strong> adresine gönderilmiştir.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 bg-stone-100 rounded-full text-xs font-mono font-bold text-stone-800">
          <span>Sipariş No:</span>
          <span>#{order.display_id || order.id.slice(0, 8)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-b border-stone-200">
        {/* Delivery Address */}
        <div className="bg-stone-50 p-5 rounded-lg border border-stone-200 space-y-2">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
            <MapPin className="w-4 h-4 text-stone-700" />
            <h3>Teslimat Adresi</h3>
          </div>
          {order.shipping_address ? (
            <div className="text-xs text-stone-600 space-y-1">
              <p className="font-semibold text-stone-900">
                {order.shipping_address.first_name} {order.shipping_address.last_name}
              </p>
              <p>{order.shipping_address.address_1}</p>
              {order.shipping_address.address_2 && <p>{order.shipping_address.address_2}</p>}
              <p>
                {order.shipping_address.province} / {order.shipping_address.city}
              </p>
              {order.shipping_address.phone && <p>Tel: {order.shipping_address.phone}</p>}
            </div>
          ) : (
            <p className="text-xs text-stone-500">Adres bilgisi bulunamadı.</p>
          )}
        </div>

        {/* Invoice Info */}
        <div className="bg-stone-50 p-5 rounded-lg border border-stone-200 space-y-2">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
            <Receipt className="w-4 h-4 text-stone-700" />
            <h3>Fatura Bilgileri</h3>
          </div>
          <div className="text-xs text-stone-600 space-y-1">
            <p className="font-semibold text-stone-900">
              {invoiceType === "corporate" ? "Kurumsal Fatura" : "Bireysel Fatura"}
            </p>
            {invoiceType === "corporate" && (
              <>
                <p>Şirket: {order.metadata?.company_name || "-"}</p>
                <p>Vergi Dairesi: {order.metadata?.tax_office || "-"}</p>
                <p>Vergi No: {order.metadata?.tax_number || "-"}</p>
              </>
            )}
            {order.billing_address && (
              <p className="text-stone-500 pt-1">
                Adres: {order.billing_address.address_1}, {order.billing_address.city}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Items Breakdown */}
      <div className="py-8 space-y-4">
        <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
          <Package className="w-5 h-5 text-stone-700" />
          <span>Sipariş Kalemleri</span>
        </h2>

        <div className="border border-stone-200 rounded-lg divide-y divide-stone-100 overflow-hidden bg-white">
          {order.items.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between text-sm">
              <div className="min-w-0 pr-4">
                <p className="font-semibold text-stone-900 truncate">{item.title}</p>
                {item.variant_title && item.variant_title !== "Default Variant" && (
                  <p className="text-xs text-stone-500">Seçenek: {item.variant_title}</p>
                )}
                <p className="text-xs text-stone-500 mt-0.5">Adet: {item.quantity}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-stone-900">
                  {formatTRY(
                    (item.unit_price ? item.unit_price * item.quantity : 0) ||
                      item.total ||
                      item.subtotal,
                  )}
                </p>
                <p className="text-[11px] text-stone-500">Birim: {formatTRY(item.unit_price)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals Summary */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-6 space-y-3">
        <div className="flex justify-between text-sm text-stone-600">
          <span>Ara Toplam (KDV Hariç)</span>
          <span className="font-medium text-stone-900">{formatTRY(subtotal)}</span>
        </div>

        <div className="flex justify-between text-sm text-stone-600">
          <span>KDV (%20 Dahil)</span>
          <span className="font-medium text-stone-900">{formatTRY(taxTotal)}</span>
        </div>

        {discountTotal > 0 && (
          <div className="flex justify-between text-sm text-emerald-700 font-medium">
            <span>İndirim Tutarı</span>
            <span>-{formatTRY(discountTotal)}</span>
          </div>
        )}

        {Boolean(order.metadata?.cod_fee) && (
          <div className="flex justify-between text-sm text-stone-600">
            <span>{String(order.metadata?.cod_fee_label || "Kapıda Ödeme Hizmet Bedeli")}</span>
            <span className="font-medium text-stone-900">
              +{formatTRY(Number(order.metadata?.cod_fee) / 100)}
            </span>
          </div>
        )}

        <div className="flex justify-between text-sm text-stone-600">
          <span>Kargo Tutarı</span>
          <span className="font-medium text-stone-900">
            {shippingTotal === 0 ? "Ücretsiz" : formatTRY(shippingTotal)}
          </span>
        </div>

        <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline">
          <span className="text-base font-bold text-stone-900">Toplam Ödenen</span>
          <span className="text-2xl font-extrabold text-stone-900">{formatTRY(total)}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-8 text-center">
        <Link
          href="/urunler"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-stone-900 text-white font-semibold rounded-md hover:bg-stone-800 transition"
        >
          <span>Alışverişe Devam Et</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
