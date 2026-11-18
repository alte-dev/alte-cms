"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Determines whether clicking an anchor element should trigger the top navigation progress bar.
 */
export function shouldStartNavigationProgress(
  anchor: HTMLAnchorElement,
  event: Pick<
    MouseEvent,
    "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "button" | "defaultPrevented"
  >,
  currentHref: string,
  currentOrigin: string,
): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  if (anchor.hasAttribute("download")) return false;

  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return false;

  const rawHref = anchor.getAttribute("href");
  if (!rawHref || rawHref.startsWith("#")) return false;

  try {
    const nextUrl = new URL(anchor.href, currentOrigin);
    if (nextUrl.origin !== currentOrigin) return false;
    const currentUrl = new URL(currentHref, currentOrigin);
    if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const activeRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    if (trickleTimerRef.current) clearInterval(trickleTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    safetyTimerRef.current = null;
    trickleTimerRef.current = null;
    hideTimerRef.current = null;
  };

  // Complete progress bar when route changes
  useEffect(() => {
    clearTimers();
    if (!activeRef.current) return;

    activeRef.current = false;
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
  }, [pathname, searchParams]);

  // Listen for internal link clicks
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      if (
        !shouldStartNavigationProgress(anchor, event, window.location.href, window.location.origin)
      ) {
        return;
      }

      clearTimers();
      activeRef.current = true;
      setVisible(true);
      setProgress(25);

      trickleTimerRef.current = setInterval(() => {
        setProgress((prev) => (prev < 85 ? Math.min(prev + 10, 85) : prev));
      }, 200);

      // Safety timeout in case navigation is aborted
      safetyTimerRef.current = setTimeout(() => {
        clearTimers();
        activeRef.current = false;
        setVisible(false);
        setProgress(0);
      }, 8000);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      clearTimers();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[200] h-0.5 bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-stone-900 transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
