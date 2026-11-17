"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Ensures every client-side route transition resets body scroll-lock (e.g. from MobileMenu)
 * and scrolls the viewport to the top.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = "";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
