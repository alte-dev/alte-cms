import React from "react";
import Link from "next/link";
import { PackageX, ArrowRight, Home } from "lucide-react";

export default function StoreNotFound() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
        <PackageX className="w-10 h-10" />
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 mb-3">
        Sayfa veya Ürün Bulunamadı
      </h1>

      <p className="text-base text-stone-600 mb-8 max-w-md mx-auto">
        Aradığınız ürün yayından kaldırılmış, bağlantı değişmiş veya hatalı yazılmış olabilir.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-lg text-sm font-semibold hover:bg-stone-800 transition"
        >
          <Home className="w-4 h-4" />
          Ana Sayfaya Dön
        </Link>
        <Link
          href="/urunler"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-stone-300 text-stone-800 rounded-lg text-sm font-semibold hover:bg-stone-50 transition"
        >
          Tüm Ürünleri İncele
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Suggested Categories */}
      <div className="pt-8 border-t border-stone-200">
        <p className="text-xs uppercase tracking-wider font-semibold text-stone-400 mb-4">
          Popüler Kategoriler
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/kategori/giyim"
            className="px-4 py-2 rounded-lg bg-stone-100 text-xs font-semibold text-stone-700 hover:bg-stone-200"
          >
            Giyim
          </Link>
          <Link
            href="/kategori/ust-giyim"
            className="px-4 py-2 rounded-lg bg-stone-100 text-xs font-semibold text-stone-700 hover:bg-stone-200"
          >
            Üst Giyim
          </Link>
          <Link
            href="/kategori/alt-giyim"
            className="px-4 py-2 rounded-lg bg-stone-100 text-xs font-semibold text-stone-700 hover:bg-stone-200"
          >
            Alt Giyim
          </Link>
          <Link
            href="/kategori/aksesuar"
            className="px-4 py-2 rounded-lg bg-stone-100 text-xs font-semibold text-stone-700 hover:bg-stone-200"
          >
            Aksesuar
          </Link>
        </div>
      </div>
    </div>
  );
}
