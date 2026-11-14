"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_LINKS = [
  { href: "/hesap", label: "Hesap Özeti" },
  { href: "/hesap/siparisler", label: "Siparişlerim" },
  { href: "/hesap/adresler", label: "Adres Defteri" },
  { href: "/hesap/profil", label: "Profil Bilgileri" },
  { href: "/hesap/sifre", label: "Şifre Değiştir" },
  { href: "/hesap/sil", label: "Hesabı Sil" },
];

export function AccountShell({
  customerName,
  emailVerified,
  children,
}: {
  customerName: string;
  emailVerified: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/account/logout", { method: "POST" });
      router.push("/hesap/giris");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleResendVerification() {
    setResendMsg(null);
    const res = await fetch("/api/account/verify-email/resend", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setResendMsg(data.message || data.error || "İstek işlendi.");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Hesabım</h1>
          <p className="text-sm text-stone-600 mt-1">Hoş geldiniz, {customerName}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="self-start sm:self-auto px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition disabled:opacity-50"
        >
          {loggingOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}
        </button>
      </div>

      {!emailVerified && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <span>
            E-posta adresiniz henüz doğrulanmadı. Eski misafir siparişlerinizin hesabınıza
            bağlanması için e-postanızı doğrulayın.
          </span>
          <button
            type="button"
            onClick={handleResendVerification}
            className="shrink-0 px-3 py-1.5 rounded bg-amber-900 text-white text-xs font-medium hover:bg-amber-800"
          >
            Doğrulama Bağlantısı Gönder
          </button>
        </div>
      )}

      {resendMsg && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-800"
        >
          {resendMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <nav aria-label="Hesap menüsü" className="md:col-span-1 space-y-1">
          {NAV_LINKS.map((item) => {
            const active =
              item.href === "/hesap"
                ? pathname === "/hesap"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition ${
                  active
                    ? "bg-stone-900 text-white"
                    : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="md:col-span-3">{children}</div>
      </div>
    </div>
  );
}
