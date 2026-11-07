import React from "react";
import Link from "next/link";
import { ShoppingBag, ChevronDown } from "lucide-react";
import { getCategories } from "../lib/medusa/products";
import { getCart } from "../lib/medusa/cart";
import { getCartId } from "../lib/medusa/cookies";

export async function Navbar() {
  const categories = await getCategories();
  const cartId = await getCartId();
  const cart = cartId ? await getCart(cartId) : null;
  const itemCount = cart?.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) || 0;

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
          {/* Logo / Brand */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight text-stone-900 hover:text-stone-700 transition"
            >
              Çisem Elif Boz
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
              <Link href="/" className="hover:text-stone-900 transition">
                Anasayfa
              </Link>
              <Link href="/urunler" className="hover:text-stone-900 transition">
                Tüm Ürünler
              </Link>

              {/* Categories Links */}
              {categories.slice(0, 4).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/kategori/${cat.handle}`}
                  className="hover:text-stone-900 transition"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          </div>

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
