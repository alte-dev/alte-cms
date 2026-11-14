"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccountForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Hesap silinemedi.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-red-200 bg-white p-6"
      noValidate
    >
      <h2 className="text-lg font-semibold text-red-900">Hesabı Sil (KVKK Anonimleştirme)</h2>
      <p className="text-sm text-stone-700">
        Bu işlem geri alınamaz. Ad, soyad, e-posta, telefon ve adres bilgileriniz kalıcı olarak
        anonimleştirilir. Yasal saklama yükümlülüğü kapsamındaki geçmiş sipariş kayıtları korunur.
      </p>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="del-password" className="block text-sm font-medium text-stone-700 mb-1">
          Mevcut Parolanız
        </label>
        <input
          id="del-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
        />
      </div>

      <div>
        <label htmlFor="del-confirm" className="block text-sm font-medium text-stone-700 mb-1">
          Onaylamak için büyük harflerle &quot;SİL&quot; yazınız
        </label>
        <input
          id="del-confirm"
          name="confirmation"
          type="text"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
      >
        {submitting ? "İşleniyor..." : "Hesabımı Kalıcı Olarak Sil"}
      </button>
    </form>
  );
}
