import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Mağaza",
    default: "Mağaza | Modern Giyim ve Yaşam",
  },
  description: "Özenle tasarlanmış giyim ve yaşam koleksiyonu. Fiyatlarımıza KDV dahildir.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3100",
  ),
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body
        className={`${inter.className} min-h-screen flex flex-col bg-stone-50 text-stone-900 antialiased selection:bg-stone-200`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-stone-900 focus:text-stone-50 focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-stone-500 font-medium text-sm"
        >
          İçeriğe geç
        </a>
        <Navbar />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
