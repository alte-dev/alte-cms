"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error.message);
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-900 p-4">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-xl p-8 text-center space-y-6 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Sistem Hatası</h1>
          <p className="text-sm text-stone-600">
            Kritik bir hata meydana geldi. Ekibimiz bilgilendirildi.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 text-white font-medium text-sm rounded-lg hover:bg-stone-800 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Sayfayı Yenile
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-stone-100 text-stone-800 font-medium text-sm rounded-lg hover:bg-stone-200 transition"
            >
              Anasayfaya Git
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
