import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { ShoppingBag } from "lucide-react";
import { getSiteSettings, getThemeSettings } from "@/lib/payload/content";
import { safeHref } from "@/lib/safe-href";
import { buildThemeCssVariables, resolveThemeSettings } from "@/lib/theme/css-vars";
import "../(store)/globals.css";

const inter = localFont({
  src: [
    {
      path: "../../fonts/inter-latin.woff2",
      style: "normal",
    },
    {
      path: "../../fonts/inter-latin-ext.woff2",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Mağaza",
    default: "Ödeme | Mağaza",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3100",
  ),
};

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const [settingsGlobal, themeRaw] = await Promise.all([
    getSiteSettings().catch(() => null),
    getThemeSettings().catch(() => null),
  ]);
  const themeVars = buildThemeCssVariables(resolveThemeSettings(themeRaw)) as React.CSSProperties;
  const storeName = settingsGlobal?.storeName || "Mağaza";
  const logoObj = settingsGlobal?.logo as { url?: string; alt?: string } | null | undefined;
  const logoUrl = logoObj?.url ? safeHref(logoObj.url, "") : "";

  return (
    <html lang="tr" suppressHydrationWarning className={inter.variable} style={themeVars}>
      <body
        className={`${inter.className} min-h-screen flex flex-col bg-[var(--theme-checkout-left-bg,#FFFFFF)] text-[var(--theme-text,#1C1917)] antialiased selection:bg-stone-200 overflow-x-clip max-w-full w-full`}
      >
        <header className="w-full bg-white border-b border-[#DEDEDE]">
          <div className="max-w-[1060px] mx-auto px-4 sm:px-6 h-[72px] grid grid-cols-3 items-center">
            <div className="justify-self-start">
              <Link
                href="/sepet"
                className="text-xs font-medium text-[#666666] hover:text-stone-900 transition"
              >
                ← Sepete Dön
              </Link>
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
                    className="h-10 w-auto max-w-[180px] object-contain"
                  />
                ) : (
                  <span className="text-xl font-bold tracking-tight text-stone-900">
                    {storeName}
                  </span>
                )}
              </Link>
            </div>

            <div className="justify-self-end">
              <Link
                href="/sepet"
                className="p-2 text-[#3A4A5B] hover:text-stone-900 rounded-md hover:bg-stone-100 transition inline-flex items-center"
                aria-label="Sepet"
              >
                <ShoppingBag className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
