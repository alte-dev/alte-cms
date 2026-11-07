import React from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Çisem Elif Boz",
    default: "Çisem Elif Boz | Modern Giyim ve Yaşam",
  },
  description: "Özenle tasarlanmış giyim ve yaşam koleksiyonu. Fiyatlarımıza KDV dahildir.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen flex flex-col bg-stone-50 text-stone-900 antialiased selection:bg-stone-200">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
