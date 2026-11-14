"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerProfile } from "../../lib/medusa/account";

export function ProfileForm({ initialCustomer }: { initialCustomer: CustomerProfile }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initialCustomer.first_name);
  const [lastName, setLastName] = useState(initialCustomer.last_name);
  const [phone, setPhone] = useState(initialCustomer.phone);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Profil güncellenemedi.");
        return;
      }
      setSavedMsg("Profil bilgileriniz güncellendi.");
      router.refresh();
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6" noValidate>
      <h2 className="text-lg font-semibold text-stone-900">Profil Bilgileri</h2>

      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {savedMsg && (
        <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {savedMsg}
        </div>
      )}

      <div>
        <label htmlFor="prof-email" className="block text-sm font-medium text-stone-700 mb-1">
          E-posta Adresi
        </label>
        <input
          id="prof-email"
          type="email"
          value={initialCustomer.email}
          disabled
          className="w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="prof-first-name" className="block text-sm font-medium text-stone-700 mb-1">
            Ad
          </label>
          <input
            id="prof-first-name"
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
          <label htmlFor="prof-last-name" className="block text-sm font-medium text-stone-700 mb-1">
            Soyad
          </label>
          <input
            id="prof-last-name"
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
        <label htmlFor="prof-phone" className="block text-sm font-medium text-stone-700 mb-1">
          Telefon
        </label>
        <input
          id="prof-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-stone-900 px-5 py-2 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-50"
      >
        {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
      </button>
    </form>
  );
}
