import React from "react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-white tracking-tight">Çisem Elif Boz</h3>
            <p className="text-sm text-stone-400 max-w-sm">
              Özenle tasarlanmış giyim, aksesuar ve yaşam ürünleri. Türkiye geneli hızlı teslimat ve
              güvenli ödeme.
            </p>
            <p className="text-xs text-stone-500">
              Mağazamızdaki tüm ürün fiyatlarına yasal KDV oranları (%20 standart, %10 ve %1
              indirimli) dahildir.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Kategoriler
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/kategori/giyim" className="hover:text-white transition">
                  Giyim
                </Link>
              </li>
              <li>
                <Link href="/kategori/ust-giyim" className="hover:text-white transition">
                  Üst Giyim
                </Link>
              </li>
              <li>
                <Link href="/kategori/alt-giyim" className="hover:text-white transition">
                  Alt Giyim
                </Link>
              </li>
              <li>
                <Link href="/kategori/aksesuar" className="hover:text-white transition">
                  Aksesuar
                </Link>
              </li>
              <li>
                <Link href="/kategori/ev-yasam" className="hover:text-white transition">
                  Ev & Yaşam
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Kurumsal
            </h4>
            <ul className="space-y-2 text-sm text-stone-400">
              <li>Teslimat ve Kargo</li>
              <li>İade ve Değişim Şartları</li>
              <li>Gizlilik ve Güvenlik Politikası</li>
              <li>Mesafeli Satış Sözleşmesi</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <p>© {new Date().getFullYear()} Çisem Elif Boz. Tüm hakları saklıdır.</p>
          <p>Alte CMS & Medusa v2 E-Ticaret Altyapısı</p>
        </div>
      </div>
    </footer>
  );
}
