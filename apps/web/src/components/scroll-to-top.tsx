"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function createPopStateTracker() {
  let isPopState = false;
  return {
    markPopState: () => {
      isPopState = true;
    },
    consumeShouldScrollToTop: () => {
      if (isPopState) {
        isPopState = false;
        return false;
      }
      return true;
    },
  };
}

/**
 * Ensures forward client-side route transitions reset body scroll-lock (e.g. from MobileMenu)
 * and scroll the viewport to the top, while preserving browser scroll restoration on popstate (back/forward).
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const trackerRef = useRef(createPopStateTracker());

  useEffect(() => {
    const onPopState = () => {
      trackerRef.current.markPopState();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "";
    if (trackerRef.current.consumeShouldScrollToTop()) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname]);

  return null;
}
