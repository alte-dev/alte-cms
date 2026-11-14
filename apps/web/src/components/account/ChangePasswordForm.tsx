"use client";

import React, { useState } from "react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Parola değiştirilemedi.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setSuccessMsg(data.message || "Parolanız güncellendi.");
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-stone-200 bg-white p-6"
      noValidate
    >
      <h2 className="text-lg font-semibold text-stone-900">Şifre Değiştir</h2>

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
        <label htmlFor="pw-current" className="block text-sm font-medium text-stone-700 mb-1">
          Mevcut Parola
        </label>
        <input
          id="pw-current"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
        />
      </div>

      <div>
        <label htmlFor="pw-new" className="block text-sm font-medium text-stone-700 mb-1">
          Yeni Parola (En az 10 karakter)
        </label>
        <input
          id="pw-new"
          name="newPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-stone-900 px-5 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
      >
        {submitting ? "Güncelleniyor..." : "Parolayı Güncelle"}
      </button>
    </form>
  );
}
