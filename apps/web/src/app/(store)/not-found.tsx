import React from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, BookOpen } from "lucide-react";

export default function StoreNotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 sm:py-28 text-center space-y-6">
      <span className="inline-block text-xs font-bold uppercase tracking-wider text-stone-500 bg-stone-200/60 px-3 py-1 rounded-full">
        404 — Sayfa Bulunamadı
      </span>
      <h1 className="text-3xl sm:text-5xl font-extrabold text-stone-900 tracking-tight">
        Aradığınız sayfayı bulamadık
      </h1>
      <p className="text-base text-stone-600 max-w-md mx-auto">
        Ulaşmaya çalıştığınız sayfa kaldırılmış, adı değiştirilmiş veya geçici olarak erişilemiyor
        olabilir.
      </p>

      <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-stone-900 text-white font-medium text-sm rounded-lg hover:bg-stone-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Anasayfaya Dön
        </Link>
        <Link
          href="/urunler"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-stone-300 text-stone-800 font-medium text-sm rounded-lg hover:bg-stone-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          <ShoppingBag className="w-4 h-4 text-stone-600" />
          Tüm Ürünler
        </Link>
        <Link
          href="/blog"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-stone-300 text-stone-800 font-medium text-sm rounded-lg hover:bg-stone-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
        >
          <BookOpen className="w-4 h-4 text-stone-600" />
          Blog
        </Link>
      </div>
    </div>
  );
}
