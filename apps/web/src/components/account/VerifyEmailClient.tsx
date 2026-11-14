"use client";

import React, { useState } from "react";
import Link from "next/link";

export function VerifyEmailClient({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function handleConfirm() {
    if (!token) {
      setStatus("error");
      setMessage("Doğrulama bağlantısı eksik.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/account/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Bağlantı geçersiz veya süresi dolmuş.");
        return;
      }
      setStatus("success");
      setMessage(data.message || "E-posta adresiniz başarıyla doğrulandı.");
    } catch {
      setStatus("error");
      setMessage("Doğrulama sırasında bir bağlantı hatası oluştu.");
    }
  }

  return (
    <div className="space-y-4">
      {status === "error" && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {message}
        </div>
      )}
      {status === "success" && (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {message}
        </div>
      )}

      {status !== "success" && (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={status === "loading" || !token}
          className="w-full rounded-md bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-50"
        >
          {status === "loading" ? "Doğrulanıyor..." : "E-posta Adresimi Doğrula"}
        </button>
      )}

      <div className="text-center text-sm">
        <Link href="/hesap" className="text-stone-700 underline hover:text-stone-900">
          Hesabıma Git
        </Link>
      </div>
    </div>
  );
}
