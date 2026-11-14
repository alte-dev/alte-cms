"use client";

import React, { useState } from "react";
import Link from "next/link";

const MARKETING_TEXT =
  "Kampanya, indirim ve yeni ürün duyurularını e-posta ile almak istiyorum (isteğe bağlı).";

export function RegisterForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [kvkkNotice, setKvkkNotice] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!kvkkNotice) {
      setError("KVKK Aydınlatma Metnini onaylamanız zorunludur.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          password,
          kvkkNotice: true,
          marketingConsent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kayıt işlemi sırasında bir hata oluştu.");
        return;
      }
      setSuccessMsg(
        data.message ||
          "Kaydınız alındı. Devam etmek için e-posta adresinize gönderilen bağlantıyı kullanın.",
      );
    } catch {
      setError("Kayıt sırasında bir bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="reg-first-name" className="block text-sm font-medium text-stone-700 mb-1">
            Ad
          </label>
          <input
            id="reg-first-name"
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>
        <div>
          <label htmlFor="reg-last-name" className="block text-sm font-medium text-stone-700 mb-1">
            Soyad
          </label>
          <input
            id="reg-last-name"
            name="lastName"
            type="text"
            required
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>
      </div>

      <div>
        <label htmlFor="reg-email" className="block text-sm font-medium text-stone-700 mb-1">
          E-posta Adresi
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
        />
      </div>

      <div>
        <label htmlFor="reg-phone" className="block text-sm font-medium text-stone-700 mb-1">
          Telefon (İsteğe Bağlı)
        </label>
        <input
          id="reg-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
        />
      </div>

      <div>
        <label htmlFor="reg-password" className="block text-sm font-medium text-stone-700 mb-1">
          Parola (En az 10 karakter)
        </label>
        <input
          id="reg-password"
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

      <div className="space-y-3 pt-2">
        <div className="flex items-start gap-2.5">
          <input
            id="reg-kvkk"
            name="kvkkNotice"
            type="checkbox"
            required
            checked={kvkkNotice}
            onChange={(e) => setKvkkNotice(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
          />
          <label htmlFor="reg-kvkk" className="text-xs text-stone-700 leading-relaxed">
            <Link href="/sayfa/kvkk" className="underline font-medium text-stone-900">
              KVKK Aydınlatma Metnini
            </Link>{" "}
            okudum ve kişisel verilerimin işlenmesini onaylıyorum. (Zorunlu)
          </label>
        </div>

        <div className="flex items-start gap-2.5">
          <input
            id="reg-marketing"
            name="marketingConsent"
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
          />
          <label htmlFor="reg-marketing" className="text-xs text-stone-700 leading-relaxed">
            {MARKETING_TEXT}
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-50"
      >
        {submitting ? "Hesap oluşturuluyor..." : "Kayıt Ol"}
      </button>

      <p className="text-center text-sm text-stone-600">
        Zaten hesabınız var mı?{" "}
        <Link href="/hesap/giris" className="font-medium text-stone-900 underline">
          Giriş Yapın
        </Link>
      </p>
    </form>
  );
}
