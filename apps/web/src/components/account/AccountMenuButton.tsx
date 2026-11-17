"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, User } from "lucide-react";

const LOGGED_IN_ITEMS = [
  { href: "/hesap", label: "Hesap Özeti" },
  { href: "/hesap/siparisler", label: "Siparişlerim" },
  { href: "/hesap/adresler", label: "Adres Defteri" },
  { href: "/hesap/profil", label: "Profil Bilgileri" },
  { href: "/hesap/sifre", label: "Şifre Değiştir" },
];

export function AccountMenuButton({ customerName }: { customerName: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLoggedIn = Boolean(customerName);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/account/logout", { method: "POST" });
      setOpen(false);
      router.push("/hesap/giris");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 items-center gap-1.5 px-3 rounded-md text-sm font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-100 transition focus:outline-none focus:ring-2 focus:ring-stone-900"
      >
        <User className="w-4 h-4 text-stone-700 shrink-0" />
        <span className="max-w-[120px] truncate">{isLoggedIn ? "Hesabım" : "Giriş Yap"}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={isLoggedIn ? "Hesap menüsü" : "Giriş ve kayıt menüsü"}
          className="absolute right-0 mt-2 w-52 rounded-lg border border-stone-200 bg-white py-1.5 shadow-lg z-50"
        >
          {!isLoggedIn ? (
            <>
              <Link
                href="/hesap/giris"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm font-medium text-stone-900 hover:bg-stone-100 transition"
              >
                Giriş Yap
              </Link>
              <Link
                href="/hesap/kayit"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 transition"
              >
                Üye Ol
              </Link>
            </>
          ) : (
            <>
              {LOGGED_IN_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition"
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-1 border-t border-stone-200" />
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full text-left px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition disabled:opacity-50"
              >
                {loggingOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
