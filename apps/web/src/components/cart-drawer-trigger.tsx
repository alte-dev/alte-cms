"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { shouldOpenCartDrawerForPath, useOptionalCartDrawer } from "./cart-drawer-provider";

interface CartDrawerTriggerProps {
  initialCount: number;
  variant?: "desktop" | "mobile";
}

export function CartDrawerTrigger({ initialCount, variant = "desktop" }: CartDrawerTriggerProps) {
  const pathname = usePathname();
  const drawer = useOptionalCartDrawer();
  const count = drawer?.itemCount ?? initialCount;
  const isCartPage = !shouldOpenCartDrawerForPath(pathname);

  const handleClick = () => {
    if (isCartPage) return;
    drawer?.openDrawer();
  };

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-current={isCartPage ? "page" : undefined}
        className="relative p-2 text-stone-700 hover:text-stone-900 rounded-md hover:bg-stone-100 transition"
        aria-label={`Sepet (${count} ürün)`}
      >
        <ShoppingBag className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-bold leading-none text-[var(--theme-primary-text,#FFFFFF)] bg-[var(--theme-primary,#3A4A5B)] rounded-full">
            {count}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={isCartPage ? "page" : undefined}
      className="relative inline-flex h-9 items-center gap-2.5 px-3 text-sm font-medium text-stone-700 hover:text-stone-900 rounded-md hover:bg-stone-100 transition"
      aria-label={`Sepet (${count} ürün)`}
    >
      <span className="relative inline-flex items-center">
        <ShoppingBag className="w-4 h-4 text-stone-700" />
        {count > 0 && (
          <span className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 text-[10px] font-bold leading-none text-[var(--theme-primary-text,#FFFFFF)] bg-[var(--theme-primary,#3A4A5B)] rounded-full">
            {count}
          </span>
        )}
      </span>
      <span>Sepet</span>
    </button>
  );
}
