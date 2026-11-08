"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // PayTR can pass cart_id via query param, or we can read it from param or searchParams
  const cartId = searchParams.get("cart_id");
  const initialStatus = searchParams.get("durum"); // 'ok' or 'hata'

  const [status, setStatus] = useState<"polling" | "success" | "failed">(
    initialStatus === "hata" ? "failed" : "polling",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialStatus === "hata"
      ? "Ödeme işlemi bankanız veya ödeme kuruluşu tarafından onaylanmadı."
      : null,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!cartId && initialStatus !== "hata") {
      setStatus("failed");
      setErrorMessage("Ödeme oturumu bilgisi (cart_id) bulunamadı.");
      return;
    }

    if (initialStatus === "hata") {
      return;
    }

    let isMounted = true;
    const startTime = Date.now();
    const MAX_POLL_MS = 90000; // 90 seconds timeout

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/checkout/status?cart_id=${encodeURIComponent(cartId!)}`);
        const data = await res.json();

        if (!isMounted) return;

        if (data.status === "completed" && data.order_id) {
          setStatus("success");
          clearInterval(pollInterval);
          // Small delay for user feedback then redirect to order confirmation
          setTimeout(() => {
            router.push("/siparis-onay");
          }, 1500);
          return;
        }

        if (data.status === "failed") {
          setStatus("failed");
          setErrorMessage(data.error || "Ödeme işlemi onaylanmadı.");
          clearInterval(pollInterval);
          return;
        }

        const elapsed = Date.now() - startTime;
        setElapsedSeconds(Math.floor(elapsed / 1000));

        if (elapsed > MAX_POLL_MS) {
          setStatus("failed");
          setErrorMessage(
            "Ödeme onayı zaman aşımına uğradı. Siparişiniz oluşturulduysa e-posta ile bilgilendirileceksiniz.",
          );
          clearInterval(pollInterval);
        }
      } catch {
        // network retry on next tick
      }
    };

    // Start polling and immediate check
    const pollInterval: NodeJS.Timeout = setInterval(checkStatus, 2000);
    checkStatus();

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [cartId, initialStatus, router]);

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      {status === "polling" && (
        <div className="bg-white border border-stone-200 rounded-xl p-8 shadow-sm space-y-6">
          <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-stone-100 text-stone-900">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Ödemeniz Doğrulanıyor</h1>
            <p className="text-sm text-stone-500 mt-2">
              PayTR güvenli ödeme onayınız alınıyor. Lütfen bu sayfayı kapatmayınız...
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Geçen süre: {elapsedSeconds} sn / maks 90 sn
            </p>
          </div>
          <div className="pt-2">
            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-stone-900 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, (elapsedSeconds / 90) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="bg-white border border-emerald-200 rounded-xl p-8 shadow-sm space-y-6">
          <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Ödeme Başarılı!</h1>
            <p className="text-sm text-stone-600 mt-2">
              Ödemeniz başarıyla alındı. Sipariş onay sayfasına yönlendiriliyorsunuz...
            </p>
          </div>
          <Link
            href="/siparis-onay"
            className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white text-sm font-semibold rounded-md hover:bg-stone-800 transition"
          >
            <span>Sipariş Detayına Git</span>
          </Link>
        </div>
      )}

      {status === "failed" && (
        <div className="bg-white border border-red-200 rounded-xl p-8 shadow-sm space-y-6">
          <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Ödeme Tamamlanamadı</h1>
            <p className="text-sm text-red-700 mt-2">
              {errorMessage || "Ödeme işlemi gerçekleştirilemedi veya banka tarafından reddedildi."}
            </p>
            <p className="text-xs text-stone-500 mt-2">
              Kartınızdan herhangi bir çekim yapılmamış olabilir. Lütfen kart limitinizi ve 3D
              Secure onayınızı kontrol ediniz.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/odeme"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-stone-900 text-white text-sm font-semibold rounded-md hover:bg-stone-800 transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tekrar Dene</span>
            </Link>
            <Link
              href="/sepet"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-stone-300 text-stone-700 text-sm font-semibold rounded-md hover:bg-stone-50 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Sepete Dön</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-600">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <h1 className="text-xl font-bold text-stone-900">Ödeme Durumu Yükleniyor...</h1>
          <p className="text-sm text-stone-500">Lütfen bekleyiniz...</p>
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}
