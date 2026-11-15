"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { safeHref } from "../lib/safe-href";
import type { MenuItem } from "./mobile-menu";

export function DesktopNavLinks({ items }: { items: MenuItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Ana Menü"
      className="flex items-center justify-center gap-6 lg:gap-8 text-xs font-semibold tracking-wider uppercase text-stone-600"
    >
      {items.map((item, idx) => {
        const href = safeHref(item.href);
        const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href);

        return (
          <div key={idx} className="relative group">
            <Link
              href={href}
              target={item.openInNewTab ? "_blank" : undefined}
              rel={item.openInNewTab ? "noopener noreferrer" : undefined}
              className={`inline-flex items-center gap-1 py-2.5 border-b-2 transition-colors ${
                isActive
                  ? "border-stone-900 text-stone-900"
                  : "border-transparent hover:text-stone-900 hover:border-stone-300"
              }`}
            >
              <span>{item.label}</span>
              {item.children && item.children.length > 0 && (
                <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:rotate-180 transition-transform" />
              )}
            </Link>

            {item.children && item.children.length > 0 && (
              <div className="absolute left-0 top-full hidden group-hover:flex flex-col bg-white border border-stone-200 rounded-lg shadow-lg py-2 min-w-[190px] z-50 normal-case tracking-normal font-medium">
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
        );
      })}
    </nav>
  );
}
