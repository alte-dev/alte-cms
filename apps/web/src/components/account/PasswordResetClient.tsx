"use client";

import React, { useState } from "react";
import Link from "next/link";

export function PasswordResetClient({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "İstek gönderilemedi.");
        return;
      }
      setSuccessMsg(data.message);
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Şifre sıfırlanamadı.");
        return;
      }
      setSuccessMsg(data.message);
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  if (token) {
    return (
      <form onSubmit={handleConfirm} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        {successMsg && (
          <div
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            {successMsg}{" "}
            <Link href="/hesap/giris" className="underline font-medium">
              Giriş Yap
            </Link>
          </div>
        )}

        <div>
          <label
            htmlFor="reset-new-password"
            className="block text-sm font-medium text-stone-700 mb-1"
          >
            Yeni Parola (En az 10 karakter)
          </label>
          <input
            id="reset-new-password"
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-50"
        >
          {submitting ? "Güncelleniyor..." : "Yeni Parolayı Kaydet"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequest} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {successMsg && (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {successMsg}
        </div>
      )}

      <div>
        <label htmlFor="reset-email" className="block text-sm font-medium text-stone-700 mb-1">
          E-posta Adresi
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-50"
      >
        {submitting ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
      </button>

      <div className="text-center text-sm">
        <Link href="/hesap/giris" className="text-stone-700 underline hover:text-stone-900">
          Giriş Sayfasına Dön
        </Link>
      </div>
    </form>
  );
}
