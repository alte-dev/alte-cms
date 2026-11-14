"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerAddress } from "../../lib/medusa/account";

const EMPTY_FORM = {
  addressName: "",
  firstName: "",
  lastName: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  province: "",
  postalCode: "",
  isDefaultShipping: false,
};

export function AddressesManager({ initialAddresses }: { initialAddresses: CustomerAddress[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<CustomerAddress[]>(initialAddresses);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refreshList() {
    const res = await fetch("/api/account/addresses");
    if (res.ok) {
      const data = await res.json();
      setAddresses(data.addresses || []);
    }
    router.refresh();
  }

  function startEdit(addr: CustomerAddress) {
    setEditingId(addr.id);
    setForm({
      addressName: addr.address_name || "",
      firstName: addr.first_name || "",
      lastName: addr.last_name || "",
      phone: addr.phone || "",
      address1: addr.address_1 || "",
      address2: addr.address_2 || "",
      city: addr.city || "",
      province: addr.province || "",
      postalCode: addr.postal_code || "",
      isDefaultShipping: Boolean(addr.is_default_shipping),
    });
    setError(null);
    setStatusMsg(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatusMsg(null);
    setSaving(true);
    try {
      const url = editingId ? `/api/account/addresses/${editingId}` : "/api/account/addresses";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Adres kaydedilemedi.");
        return;
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setStatusMsg(editingId ? "Adres güncellendi." : "Yeni adres eklendi.");
      await refreshList();
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    setStatusMsg(null);
    const res = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Adres silinemedi.");
      return;
    }
    setStatusMsg("Adres silindi.");
    await refreshList();
  }

  async function handleSetDefault(id: string) {
    setError(null);
    setStatusMsg(null);
    const res = await fetch(`/api/account/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefaultShipping: true }),
    });
    if (!res.ok) {
      setError("Varsayılan adres güncellenemedi.");
      return;
    }
    setStatusMsg("Varsayılan teslimat adresi güncellendi.");
    await refreshList();
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {statusMsg && (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {statusMsg}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">Kayıtlı Adreslerim</h2>
        {addresses.length === 0 ? (
          <p className="text-sm text-stone-600">Henüz kayıtlı adresiniz yok.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="rounded-lg border border-stone-200 bg-white p-4 text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-stone-900">
                    {addr.address_name || "Adres"}
                  </span>
                  {addr.is_default_shipping && (
                    <span className="text-xs px-2 py-0.5 rounded bg-stone-900 text-white">
                      Varsayılan
                    </span>
                  )}
                </div>
                <p className="text-stone-800">
                  {addr.first_name} {addr.last_name}
                </p>
                <p className="text-stone-600 mt-1">{addr.address_1}</p>
                {addr.address_2 && <p className="text-stone-600">{addr.address_2}</p>}
                <p className="text-stone-600">
                  {addr.province ? `${addr.province} / ` : ""}
                  {addr.city} {addr.postal_code || ""}
                </p>
                {addr.phone && <p className="text-stone-600 mt-1">{addr.phone}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(addr)}
                    className="text-xs font-medium text-stone-800 underline"
                  >
                    Düzenle
                  </button>
                  {!addr.is_default_shipping && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-xs font-medium text-stone-800 underline"
                    >
                      Varsayılan Yap
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(addr.id)}
                    className="text-xs font-medium text-red-700 underline"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-stone-200 bg-white p-6 space-y-4"
        noValidate
      >
        <h3 className="text-base font-semibold text-stone-900">
          {editingId ? "Adresi Düzenle" : "Yeni Adres Ekle"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="addr-name" className="block text-sm font-medium text-stone-700 mb-1">
              Adres Başlığı
            </label>
            <input
              id="addr-name"
              type="text"
              required
              value={form.addressName}
              onChange={(e) => setForm({ ...form, addressName: e.target.value })}
              placeholder="Ev, İş..."
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div>
            <label htmlFor="addr-phone" className="block text-sm font-medium text-stone-700 mb-1">
              Telefon
            </label>
            <input
              id="addr-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="addr-first" className="block text-sm font-medium text-stone-700 mb-1">
              Ad
            </label>
            <input
              id="addr-first"
              type="text"
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div>
            <label htmlFor="addr-last" className="block text-sm font-medium text-stone-700 mb-1">
              Soyad
            </label>
            <input
              id="addr-last"
              type="text"
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
        </div>

        <div>
          <label htmlFor="addr-line1" className="block text-sm font-medium text-stone-700 mb-1">
            Adres
          </label>
          <input
            id="addr-line1"
            type="text"
            required
            value={form.address1}
            onChange={(e) => setForm({ ...form, address1: e.target.value })}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="addr-city" className="block text-sm font-medium text-stone-700 mb-1">
              İl
            </label>
            <input
              id="addr-city"
              type="text"
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div>
            <label
              htmlFor="addr-province"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              İlçe
            </label>
            <input
              id="addr-province"
              type="text"
              required
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
          <div>
            <label htmlFor="addr-postal" className="block text-sm font-medium text-stone-700 mb-1">
              Posta Kodu
            </label>
            <input
              id="addr-postal"
              type="text"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="addr-default"
            type="checkbox"
            checked={form.isDefaultShipping}
            onChange={(e) => setForm({ ...form, isDefaultShipping: e.target.checked })}
            className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
          />
          <label htmlFor="addr-default" className="text-sm text-stone-700">
            Varsayılan teslimat adresi olarak ayarla
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-stone-900 px-5 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : editingId ? "Güncelle" : "Adres Ekle"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              İptal
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
