"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";

export function OtpVerificationCard({
  initialEmail = "",
  initialMessage,
}: {
  initialEmail?: string;
  initialMessage?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>(initialMessage || "");
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join("");
  const lockEmail = Boolean(initialEmail);

  function handleDigitChange(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    if (clean.length > 1) {
      const next = [...digits];
      for (let i = 0; i < 6 && index + i < 6; i++) {
        next[index + i] = clean[i] || "";
      }
      setDigits(next);
      const focusIdx = Math.min(5, index + clean.length);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = clean[0];
    setDigits(next);
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    inputRefs.current[Math.min(5, pasted.length - 1)]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || code.length !== 6) {
      setStatus("error");
      setMessage("Lütfen e-posta adresinizi ve 6 haneli doğrulama kodunu eksiksiz giriniz.");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/account/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Doğrulama kodu geçersiz veya süresi dolmuş.");
        return;
      }
      setStatus("success");
      setMessage(data.message || "E-posta adresiniz başarıyla doğrulandı.");
    } catch {
      setStatus("error");
      setMessage("Doğrulama sırasında bir bağlantı hatası oluştu.");
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      setStatus("error");
      setMessage("Kodu tekrar göndermek için e-posta adresinizi giriniz.");
      return;
    }
    setResending(true);
    setMessage("");
    try {
      const res = await fetch("/api/account/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      setStatus(res.ok ? "idle" : "error");
      setMessage(
        data.message || data.error || "Yeni 6 haneli doğrulama kodu e-posta adresinize gönderildi.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-bold text-stone-900">E-posta Adresinizi Doğrulayın</h2>
        <p className="text-sm text-stone-600">
          {lockEmail ? (
            <>
              <span className="font-medium text-stone-900">{email}</span> adresine gönderdiğimiz 6
              haneli doğrulama kodunu giriniz.
            </>
          ) : (
            "E-posta adresinize gönderilen 6 haneli doğrulama kodunu giriniz."
          )}
        </p>
      </div>

      {status === "error" && message && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {message}
        </div>
      )}

      {status === "success" && message && (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {message}
        </div>
      )}

      {status === "idle" && message && (
        <div
          role="status"
          className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700"
        >
          {message}
        </div>
      )}

      {status !== "success" ? (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {!lockEmail && (
            <div>
              <label htmlFor="otp-email" className="block text-sm font-medium text-stone-700 mb-1">
                E-posta Adresi
              </label>
              <input
                id="otp-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
          )}

          <div className="flex items-center justify-center gap-2 sm:gap-2.5">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={idx === 0 ? "one-time-code" : "off"}
                maxLength={1}
                aria-label={`Doğrulama kodu ${idx + 1}. hane`}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                className="w-11 h-12 sm:w-12 sm:h-13 rounded-lg border border-stone-300 bg-stone-50 text-center text-lg font-semibold text-stone-900 focus:bg-white focus:border-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 transition"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={status === "loading" || code.length !== 6}
            className="w-full rounded-md bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2 disabled:opacity-50 transition"
          >
            {status === "loading" ? "Doğrulanıyor..." : "Doğrula"}
          </button>

          <p className="text-center text-xs text-stone-600">
            Kod ulaşmadı mı?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-semibold text-stone-900 underline hover:text-stone-700 disabled:opacity-50"
            >
              {resending ? "Gönderiliyor..." : "Kodu Tekrar Gönder"}
            </button>
          </p>
        </form>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/hesap/giris"
            className="flex-1 text-center rounded-md bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 transition"
          >
            Giriş Yap
          </Link>
          <Link
            href="/hesap"
            className="flex-1 text-center rounded-md border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 transition"
          >
            Hesabıma Git
          </Link>
        </div>
      )}
    </div>
  );
}
