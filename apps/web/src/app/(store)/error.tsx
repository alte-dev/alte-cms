"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors securely without leaking PII
    console.error("Storefront runtime error:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-2xl bg-red-100 text-red-600">
        <AlertCircle className="w-8 h-8" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-stone-900 mb-2">Bir Hata Oluştu</h1>

      <p className="text-sm text-stone-600 mb-8 max-w-md mx-auto">
        İşleminiz gerçekleştirilirken beklenmedik bir durum meydana geldi. Lütfen tekrar deneyin
        veya ana sayfaya dönün.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Yeniden Dene
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-100 text-stone-800 rounded-lg text-xs font-semibold hover:bg-stone-200 transition"
        >
          Ana Sayfa
        </Link>
      </div>
    </div>
  );
}
