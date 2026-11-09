import React from "react";
import Link from "next/link";
import { ShoppingBag, ChevronDown } from "lucide-react";
import { getCategories } from "../lib/medusa/products";
import { getCart } from "../lib/medusa/cart";
import { getCartId } from "../lib/medusa/cookies";
import { getNavigation, getSiteSettings } from "../lib/payload/content";
import { safeHref } from "../lib/safe-href";
import { MobileMenu, type MenuItem } from "./mobile-menu";

export async function Navbar() {
  const [categories, cartId, navigationGlobal, settingsGlobal] = await Promise.all([
    getCategories().catch(() => []),
    getCartId().catch(() => null),
    getNavigation().catch(() => null),
    getSiteSettings().catch(() => null),
  ]);

  const cart = cartId ? await getCart(cartId).catch(() => null) : null;
  const itemCount = cart?.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;

  const storeName = settingsGlobal?.storeName || "Mağaza";

  // Build nav items: Prefer Payload navigation global, fallback to default
  let navItems: MenuItem[] = [];
  if (
    navigationGlobal?.headerMenu &&
    Array.isArray(navigationGlobal.headerMenu) &&
    navigationGlobal.headerMenu.length > 0
  ) {
    navItems = navigationGlobal.headerMenu.map((item: any) => ({
      label: item.label,
      href: item.href,
      openInNewTab: Boolean(item.openInNewTab),
      children: Array.isArray(item.children)
        ? item.children.map((c: any) => ({
            label: c.label,
            href: c.href,
            openInNewTab: Boolean(c.openInNewTab),
          }))
        : undefined,
    }));
  } else {
    // Fallback menu
    navItems = [
      { label: "Anasayfa", href: "/" },
      { label: "Tüm Ürünler", href: "/urunler" },
      ...categories.slice(0, 4).map((cat) => ({
        label: cat.name,
        href: `/kategori/${cat.handle}`,
      })),
      { label: "Blog", href: "/blog" },
    ];
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200">
      {/* Top Banner */}
      <div className="bg-stone-900 text-stone-100 text-xs py-2 px-4 text-center font-medium">
        <span>
          Türkiye İçi Ücretsiz Kargo Fırsatı • Fiyatlarımıza KDV Dahildir • Güvenli Alışveriş
        </span>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Mobile Menu Button + Brand */}
          <div className="flex items-center gap-4">
            <MobileMenu items={navItems} />

            <Link
              href="/"
              className="text-xl font-bold tracking-tight text-stone-900 hover:text-stone-700 transition"
            >
              {storeName}
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            {navItems.map((item, idx) => (
              <div key={idx} className="relative group">
                <Link
                  href={safeHref(item.href)}
                  target={item.openInNewTab ? "_blank" : undefined}
                  rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                  className="hover:text-stone-900 transition flex items-center gap-1 py-2"
                >
                  <span>{item.label}</span>
                  {item.children && item.children.length > 0 && (
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:rotate-180 transition-transform" />
                  )}
                </Link>

                {item.children && item.children.length > 0 && (
                  <div className="absolute left-0 top-full hidden group-hover:flex flex-col bg-white border border-stone-200 rounded-lg shadow-lg py-2 min-w-[180px] z-50">
                    {item.children.map((child, cIdx) => (
                      <Link
                        key={cIdx}
                        href={safeHref(child.href)}
                        target={child.openInNewTab ? "_blank" : undefined}
                        rel={child.openInNewTab ? "noopener noreferrer" : undefined}
                        className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-stone-900 transition"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Cart Icon & Actions */}
          <div className="flex items-center gap-4">
            <Link
              href="/sepet"
              className="relative inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-700 hover:text-stone-900 rounded-md hover:bg-stone-100 transition"
              aria-label={`Sepet (${itemCount} ürün)`}
            >
              <ShoppingBag className="w-5 h-5 text-stone-700" />
              <span className="hidden sm:inline">Sepet</span>
              {itemCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-stone-900 rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
