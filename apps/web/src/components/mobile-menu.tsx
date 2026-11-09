"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { safeHref } from "@/lib/safe-href";

export interface MenuItem {
  label: string;
  href: string;
  openInNewTab?: boolean;
  children?: Array<{
    label: string;
    href: string;
    openInNewTab?: boolean;
  }>;
}

interface MobileMenuProps {
  items: MenuItem[];
}

export function MobileMenu({ items }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-drawer"
        aria-label={isOpen ? "Menüyü Kapat" : "Menüyü Aç"}
        className="p-2 text-stone-700 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Drawer & Backdrop */}
      {isOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobil Gezinme Menüsü"
          className="fixed inset-0 z-50 flex"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-4/5 max-w-sm bg-white h-full shadow-2xl p-6 flex flex-col z-10 overflow-y-auto">
            <div className="flex items-center justify-between pb-6 border-b border-stone-200">
              <span className="font-bold text-lg text-stone-900 tracking-tight">Menü</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Kapat"
                className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-4 py-6">
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <Link
                    href={safeHref(item.href)}
                    target={item.openInNewTab ? "_blank" : undefined}
                    rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                    onClick={() => setIsOpen(false)}
                    className="text-base font-semibold text-stone-900 hover:text-blue-600 transition-colors py-1"
                  >
                    {item.label}
                  </Link>

                  {item.children && item.children.length > 0 && (
                    <div className="pl-4 flex flex-col gap-2 border-l-2 border-stone-100">
                      {item.children.map((child, cIdx) => (
                        <Link
                          key={cIdx}
                          href={safeHref(child.href)}
                          target={child.openInNewTab ? "_blank" : undefined}
                          rel={child.openInNewTab ? "noopener noreferrer" : undefined}
                          onClick={() => setIsOpen(false)}
                          className="text-sm text-stone-600 hover:text-stone-900 transition-colors py-1"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-stone-200 text-xs text-stone-500">
              <p>Mağaza • Resmi Satış</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
