import React from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { getCategories } from "../lib/medusa/products";
import { getCart } from "../lib/medusa/cart";
import { getServerCustomer } from "../lib/medusa/account";
import { getCartId } from "../lib/medusa/cookies";
import { getNavigation, getSiteSettings } from "../lib/payload/content";
import { safeHref } from "../lib/safe-href";
import { AccountMenuButton } from "./account/AccountMenuButton";
import { CartDrawerTrigger } from "./cart-drawer-trigger";
import { MobileMenu, type MenuItem } from "./mobile-menu";
import { DesktopNavLinks } from "./desktop-nav-links";
import { SearchBar } from "./search/search-bar";

export async function Navbar() {
  const [categories, cartId, navigationGlobal, settingsGlobal, customer] = await Promise.all([
    getCategories().catch(() => []),
    getCartId().catch(() => null),
    getNavigation().catch(() => null),
    getSiteSettings().catch(() => null),
    getServerCustomer().catch(() => null),
  ]);

  const customerName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email
    : null;

  const cart = cartId ? await getCart(cartId).catch(() => null) : null;
  const itemCount = cart?.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;

  const storeName = settingsGlobal?.storeName || "Mağaza";
  const logoObj = settingsGlobal?.logo as { url?: string; alt?: string } | null | undefined;
  const logoUrl = logoObj?.url ? safeHref(logoObj.url, "") : "";
  const instagramRaw = (settingsGlobal?.socialMedia as { instagram?: string } | undefined)
    ?.instagram;
  const instagramUrl = instagramRaw ? safeHref(instagramRaw, "") : "";

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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-stone-200">
      {/* Top Banner */}
      <div className="bg-stone-900 text-stone-100 text-xs py-2 px-4 text-center font-medium">
        <span>
          Türkiye İçi Ücretsiz Kargo Fırsatı • Fiyatlarımıza KDV Dahildir • Güvenli Alışveriş
        </span>
      </div>

      {/* Desktop 2-Row Boutique Header */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: Social Left | Centered Logo | Account & Cart Right */}
        <div className="grid grid-cols-3 items-center py-3 gap-4">
          <div className="justify-self-start">
            {instagramUrl ? (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs sm:text-sm text-stone-700 hover:text-stone-900 transition"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
                <span>{storeName}</span>
              </a>
            ) : (
              <span className="text-xs text-stone-500 font-medium tracking-wide">{storeName}</span>
            )}
          </div>

          <div className="justify-self-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center hover:opacity-85 transition"
              aria-label={`${storeName} Anasayfa`}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={logoObj?.alt || storeName}
                  className="h-14 w-auto max-w-[220px] object-contain"
                />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-stone-900">
                  {storeName}
                </span>
              )}
            </Link>
          </div>

          <div className="justify-self-end flex items-center gap-2">
            <AccountMenuButton customerName={customerName} />

            <CartDrawerTrigger initialCount={itemCount} variant="desktop" />
          </div>
        </div>

        {/* Row 2: Centered Navigation + Underline Search */}
        <div className="flex items-center justify-center gap-8 pb-2.5 pt-0.5">
          <DesktopNavLinks items={navItems} />
          <SearchBar variant="underline" inputId="store-search-input" className="w-56 lg:w-64" />
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 gap-2">
          <MobileMenu items={navItems} />

          <Link
            href="/"
            className="inline-flex items-center justify-center truncate"
            aria-label={`${storeName} Anasayfa`}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={logoObj?.alt || storeName}
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <span className="text-lg font-bold tracking-tight text-stone-900 truncate">
                {storeName}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href={customer ? "/hesap" : "/hesap/giris"}
              className="p-2 text-stone-700 hover:text-stone-900 rounded-md hover:bg-stone-100 transition"
              aria-label={customer ? "Hesabım" : "Giriş Yap"}
            >
              <User className="w-5 h-5" />
            </Link>

            <CartDrawerTrigger initialCount={itemCount} variant="mobile" />
          </div>
        </div>

        <div className="pb-2.5">
          <SearchBar variant="underline" inputId="store-search-input-mobile" />
        </div>
      </div>
    </header>
  );
}
