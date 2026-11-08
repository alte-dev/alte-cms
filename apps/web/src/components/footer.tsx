import React from "react";
import Link from "next/link";
import { getNavigation, getSiteSettings } from "../lib/payload/content";
import { safeHref } from "../lib/safe-href";

export async function Footer() {
  const [navigationGlobal, settingsGlobal] = await Promise.all([
    getNavigation().catch(() => null),
    getSiteSettings().catch(() => null),
  ]);

  const storeName = settingsGlobal?.storeName || "Çisem Elif Boz";
  const storeDescription =
    settingsGlobal?.storeDescription ||
    "Özenle tasarlanmış giyim, aksesuar ve yaşam ürünleri. Türkiye geneli hızlı teslimat ve güvenli ödeme.";

  const footerMenu = navigationGlobal?.footerMenu;
  const hasDynamicFooter = Array.isArray(footerMenu) && footerMenu.length > 0;

  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-white tracking-tight">{storeName}</h3>
            <p className="text-sm text-stone-400 max-w-sm">{storeDescription}</p>
            {settingsGlobal?.address && (
              <p className="text-xs text-stone-400 whitespace-pre-line">{settingsGlobal.address}</p>
            )}
            {settingsGlobal?.contactEmail && (
              <p className="text-xs text-stone-400">
                E-posta:{" "}
                <a
                  href={`mailto:${settingsGlobal.contactEmail}`}
                  className="hover:text-white transition"
                >
                  {settingsGlobal.contactEmail}
                </a>
              </p>
            )}
            <p className="text-xs text-stone-500">
              Mağazamızdaki tüm ürün fiyatlarına yasal KDV oranları (%20 standart, %10 ve %1
              indirimli) dahildir.
            </p>
          </div>

          {/* Dynamic Footer Columns OR Fallback */}
          {hasDynamicFooter ? (
            footerMenu.map((col: any, idx: number) => (
              <div key={idx}>
                <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                  {col.title}
                </h4>
                <ul className="space-y-2 text-sm text-stone-400">
                  {Array.isArray(col.items) &&
                    col.items.map((item: any, iIdx: number) => (
                      <li key={iIdx}>
                        <Link
                          href={safeHref(item.href)}
                          target={item.openInNewTab ? "_blank" : undefined}
                          rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                          className="hover:text-white transition"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          ) : (
            <>
              {/* Fallback Categories */}
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

              {/* Fallback Customer Service */}
              <div>
                <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                  Kurumsal
                </h4>
                <ul className="space-y-2 text-sm text-stone-400">
                  <li>
                    <Link
                      href="/sayfa/mesafeli-satis-sozlesmesi"
                      className="hover:text-white transition"
                    >
                      Mesafeli Satış Sözleşmesi
                    </Link>
                  </li>
                  <li>
                    <Link href="/sayfa/kvkk" className="hover:text-white transition">
                      KVKK Aydınlatma Metni
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog" className="hover:text-white transition">
                      Blog
                    </Link>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <p>
            © {new Date().getFullYear()} {storeName}. Tüm hakları saklıdır.
          </p>
          <p>Alte CMS & Medusa v2 E-Ticaret Altyapısı</p>
        </div>
      </div>
    </footer>
  );
}
