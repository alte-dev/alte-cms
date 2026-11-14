"use client";

import React, { useState } from "react";

interface ContactFormClientProps {
  subjectOptions: string[];
  enabled: boolean;
}

export function ContactFormClient({ subjectOptions, enabled }: ContactFormClientProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState(subjectOptions[0] || "");
  const [message, setMessage] = useState("");
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!enabled) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
        İletişim formu şu anda geçici olarak kapalıdır. Lütfen yukarıdaki iletişim kanallarından
        bize ulaşın.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          subject,
          message,
          kvkkAccepted,
          website,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "Mesajınız gönderilemedi. Lütfen bilgileri kontrol edin.");
        return;
      }

      setSuccessMsg(
        data.message || "Mesajınız başarıyla iletildi. En kısa sürede size dönüş yapacağız.",
      );
      setName("");
      setEmail("");
      setPhone("");
      setSubject(subjectOptions[0] || "");
      setMessage("");
      setKvkkAccepted(false);
    } catch {
      setErrorMsg("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Honeypot field - hidden from real users */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-website">Web Sitesi</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-slate-800">
            Ad Soyad <span className="text-red-600">*</span>
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            placeholder="Adınız ve soyadınız"
          />
        </div>

        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-slate-800">
            E-posta <span className="text-red-600">*</span>
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={180}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            placeholder="ornek@eposta.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-phone" className="block text-sm font-medium text-slate-800">
            Telefon (İsteğe bağlı)
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            maxLength={30}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            placeholder="05XX XXX XX XX"
          />
        </div>

        <div>
          <label htmlFor="contact-subject" className="block text-sm font-medium text-slate-800">
            Konu <span className="text-red-600">*</span>
          </label>
          {subjectOptions.length > 0 ? (
            <select
              id="contact-subject"
              name="subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              {subjectOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="contact-subject"
              name="subject"
              type="text"
              required
              minLength={2}
              maxLength={150}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              placeholder="Mesajınızın konusu"
            />
          )}
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-slate-800">
          Mesajınız <span className="text-red-600">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          minLength={10}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          placeholder="Talebinizi veya sorunuzu detaylı olarak yazın..."
        />
      </div>

      <div className="flex items-start gap-2.5">
        <input
          id="contact-kvkk"
          name="kvkkAccepted"
          type="checkbox"
          required
          checked={kvkkAccepted}
          onChange={(e) => setKvkkAccepted(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
        <label htmlFor="contact-kvkk" className="text-sm text-slate-700">
          Kişisel verilerimin iletişim talebimin yanıtlanması amacıyla işlenmesini kabul ediyorum.
        </label>
      </div>

      <div aria-live="polite">
        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {successMsg}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Gönderiliyor..." : "Mesajı Gönder"}
      </button>
    </form>
  );
}
