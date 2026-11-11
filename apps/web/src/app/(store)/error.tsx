"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log non-sensitive error to console
    console.error("Storefront runtime error:", error.message);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
      <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
        <AlertCircle className="w-6 h-6" />
      </div>
      <span className="inline-block text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200">
        500 — Beklenmeyen Hata
      </span>
      <h1 className="text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
        Bir şeyler ters gitti
      </h1>
      <p className="text-sm text-stone-600 max-w-md mx-auto">
        İşleminiz gerçekleştirilirken beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin veya ana
        sayfaya dönün.
      </p>

      <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-900 text-white font-medium text-sm rounded-lg hover:bg-stone-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          <RefreshCw className="w-4 h-4" />
          Yeniden Dene
        </button>
        <Link
          href="/"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-stone-300 text-stone-800 font-medium text-sm rounded-lg hover:bg-stone-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Anasayfaya Dön
        </Link>
      </div>
    </div>
  );
}
