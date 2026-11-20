import React from "react";
import type { Metadata } from "next";
import { OrderTrackingClient } from "@/components/order-tracking-client";

export const metadata: Metadata = {
  title: "Sipariş Takibi",
  description: "Siparişinizin durumunu ve kargo takip bilgilerini kolayca sorgulayın.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default function SiparisTakipPage() {
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

      <OrderTrackingClient />
    </div>
  );
}
