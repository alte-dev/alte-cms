"use client";

import React, { useCallback, useEffect, useState } from "react";

interface CacheWarmSummary {
  status: "idle" | "running" | "completed" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  totalUrls: number;
  scanned: number;
  succeeded: number;
  failed: number;
  skipped: number;
  error?: string;
}

const STATUS_LABELS: Record<CacheWarmSummary["status"], string> = {
  idle: "Henüz çalıştırılmadı",
  running: "Çalışıyor...",
  completed: "Tamamlandı",
  failed: "Hata",
};

export function CacheControlPanel() {
  const [allowed, setAllowed] = useState(false);
  const [summary, setSummary] = useState<CacheWarmSummary | null>(null);
  const [busyAction, setBusyAction] = useState<"purge" | "warm" | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cache", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { summary?: CacheWarmSummary };
      if (data?.summary) {
        setSummary(data.summary);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/users/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: { role?: string } } | null) => {
        if (!active) return;
        const role = data?.user?.role;
        if (role === "super-admin" || role === "admin") {
          setAllowed(true);
          void loadSummary();
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [loadSummary]);

  async function handleAction(action: "purge" | "warm") {
    setBusyAction(action);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/cache", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        tags?: string[];
        summary?: CacheWarmSummary;
      };
      if (data.summary) {
        setSummary(data.summary);
      }
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "İşlem başarısız oldu.",
        });
        return;
      }
      if (action === "purge") {
        setFeedback({
          type: "success",
          text: `Vitrin önbelleği temizlendi (${data.tags?.length ?? 0} etiket yenilendi).`,
        });
      } else {
        const s = data.summary;
        setFeedback({
          type: "success",
          text: s
            ? `Site ısıtma tamamlandı: ${s.succeeded}/${s.scanned} sayfa başarılı (${s.durationMs ?? 0} ms).`
            : "Site ısıtma tamamlandı.",
        });
      }
    } catch {
      setFeedback({ type: "error", text: "Sunucuya bağlanılamadı." });
    } finally {
      setBusyAction(null);
    }
  }

  if (!allowed) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: "24px",
        padding: "16px 20px",
        borderRadius: "8px",
        border: "1px solid var(--theme-elevation-150)",
        backgroundColor: "var(--theme-elevation-50)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Vitrin Önbellek Yönetimi</h3>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--theme-elevation-650)" }}>
            Sepet, ödeme, hesap, admin ve API rotaları hiçbir zaman önbelleğe alınmaz.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void handleAction("purge")}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid var(--theme-elevation-250)",
              backgroundColor: "var(--theme-elevation-100)",
              color: "var(--theme-text)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: busyAction ? "not-allowed" : "pointer",
              opacity: busyAction ? 0.6 : 1,
            }}
          >
            {busyAction === "purge" ? "Temizleniyor..." : "Önbelleği Temizle"}
          </button>

          <button
            type="button"
            disabled={busyAction !== null || summary?.status === "running"}
            onClick={() => void handleAction("warm")}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "var(--theme-text)",
              color: "var(--theme-bg)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: busyAction ? "not-allowed" : "pointer",
              opacity: busyAction ? 0.6 : 1,
            }}
          >
            {busyAction === "warm" ? "Isıtılıyor..." : "Siteyi Isıt (Sitemap)"}
          </button>
        </div>
      </div>

      {feedback && (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: "13px",
            fontWeight: 500,
            color:
              feedback.type === "error" ? "var(--theme-error-500)" : "var(--theme-success-500)",
          }}
        >
          {feedback.text}
        </p>
      )}

      {summary && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid var(--theme-elevation-150)",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            fontSize: "12px",
            color: "var(--theme-elevation-700)",
          }}
        >
          <span>
            <strong>Durum:</strong> {STATUS_LABELS[summary.status]}
          </span>
          <span>
            <strong>Taranan:</strong> {summary.scanned}/{summary.totalUrls}
          </span>
          <span>
            <strong>Başarılı:</strong> {summary.succeeded}
          </span>
          <span>
            <strong>Hatalı:</strong> {summary.failed}
          </span>
          <span>
            <strong>Atlanan (Dinamik/Özel):</strong> {summary.skipped}
          </span>
          {summary.durationMs !== null && (
            <span>
              <strong>Süre:</strong> {summary.durationMs} ms
            </span>
          )}
          {summary.finishedAt && (
            <span>
              <strong>Son Çalışma:</strong> {new Date(summary.finishedAt).toLocaleString("tr-TR")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default CacheControlPanel;
