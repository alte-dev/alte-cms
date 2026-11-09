import React, { useState, useEffect } from "react";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Envelope, CheckCircleSolid, ExclamationCircleSolid, ArrowPath } from "@medusajs/icons";
import { Button, Container, Heading, Input, Label, Switch, Text, Badge, Alert } from "@medusajs/ui";

export const config = defineRouteConfig({
  label: "E-posta Ayarları",
  icon: Envelope,
});

export default function EmailSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Form State
  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [fromName, setFromName] = useState("Alte Butik");
  const [fromEmail, setFromEmail] = useState("siparis@example.test");
  const [replyTo, setReplyTo] = useState("");
  const [adminNotifyEmail, setAdminNotifyEmail] = useState("");

  // Logs State
  const [logs, setLogs] = useState<any[]>([]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/admin/email-settings");
      if (!res.ok) throw new Error("E-posta ayarları yüklenemedi.");
      const data = await res.json();
      const s = data.settings || {};

      setEnabled(Boolean(s.enabled));
      setHost(s.host || "");
      setPort(Number(s.port) || 587);
      setSecure(Boolean(s.secure));
      setUsername(s.username || "");
      setHasPassword(Boolean(s.has_password));
      setPassword(""); // never show raw password
      setFromName(s.from_name || "Alte Butik");
      setFromEmail(s.from_email || "siparis@example.test");
      setReplyTo(s.reply_to || "");
      setAdminNotifyEmail(s.admin_notify_email || "");
    } catch (err: any) {
      setSaveStatus({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/admin/email-settings/logs?limit=50");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);

    const payload: any = {
      enabled,
      host: host.trim(),
      port: Number(port),
      secure,
      username: username.trim(),
      from_name: fromName.trim(),
      from_email: fromEmail.trim(),
      reply_to: replyTo.trim() || undefined,
      admin_notify_email: adminNotifyEmail.trim() || undefined,
    };

    if (password.trim() !== "") {
      payload.password = password.trim();
    }

    try {
      const res = await fetch("/admin/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ayarlar kaydedilemedi.");
      }

      setSaveStatus({
        success: true,
        message: "E-posta ayarları başarıyla kaydedildi.",
      });
      setHasPassword(Boolean(data.settings?.has_password));
      setPassword("");
    } catch (err: any) {
      setSaveStatus({ success: false, message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/admin/email-settings/test", {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Test e-postası gönderilemedi.");
      }

      setTestResult({
        success: true,
        message: data.message || "Test e-postası başarıyla gönderildi.",
      });
      fetchLogs();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleRetryLog = async (logId: string) => {
    setRetryingId(logId);
    try {
      const res = await fetch(`/admin/email-settings/logs/${logId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Yeniden gönderim başarısız.");
      } else {
        alert("E-posta başarıyla yeniden gönderildi.");
        fetchLogs();
      }
    } catch (err: any) {
      alert(`Hata: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return (
      <Container className="p-8">
        <Text>E-posta ayarları yükleniyor...</Text>
      </Container>
    );
  }

  return (
    <div className="flex flex-col gap-y-6 max-w-5xl mx-auto p-4 sm:p-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <Heading level="h1" className="text-2xl font-bold flex items-center gap-2">
            <Envelope className="w-6 h-6 text-stone-700" />
            E-posta Bildirim Ayarları
          </Heading>
          <Text className="text-stone-500 text-sm mt-1">
            Sipariş onayları, kargo bildirimleri ve yönetici uyarıları için SMTP yapılandırması.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={handleTestEmail}
            disabled={testing || !enabled}
          >
            {testing ? "Gönderiliyor..." : "Test E-postası Gönder"}
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {saveStatus && (
        <Alert variant={saveStatus.success ? "info" : "error"}>{saveStatus.message}</Alert>
      )}

      {testResult && (
        <Alert variant={testResult.success ? "info" : "error"}>{testResult.message}</Alert>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <Container className="p-6">
          <div className="flex items-center justify-between pb-4 border-b mb-6">
            <div>
              <Heading level="h2" className="text-base font-semibold">
                E-posta Bildirimlerini Etkinleştir
              </Heading>
              <Text className="text-xs text-stone-500">
                Açıldığında sipariş durum değişikliklerinde otomatik e-postalar gönderilir.
              </Text>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">SMTP Sunucu Adresi (Host)</Label>
              <Input
                placeholder="smtp.example.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="mt-1"
                required={enabled}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-medium">Port</Label>
                <Input
                  type="number"
                  placeholder="587"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="mt-1"
                  required={enabled}
                />
              </div>
              <div className="flex flex-col justify-end">
                <Label className="text-xs font-medium mb-2">SSL / TLS</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={secure} onCheckedChange={setSecure} />
                  <span className="text-xs text-stone-600">
                    {secure ? "Açık (465)" : "STARTTLS"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Kullanıcı Adı (Username)</Label>
              <Input
                placeholder="kullanici@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">
                Parola (Password)
                {hasPassword && (
                  <span className="ml-2 text-xs text-green-600 font-normal">
                    (Kayıtlı ve AES-256 ile şifreli)
                  </span>
                )}
              </Label>
              <Input
                type="password"
                placeholder={
                  hasPassword ? "•••••••• (Değiştirmek için yeni değer girin)" : "SMTP Parolası"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Gönderen Adı (From Name)</Label>
              <Input
                placeholder="Alte Butik"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="mt-1"
                required={enabled}
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Gönderen E-posta (From Email)</Label>
              <Input
                type="email"
                placeholder="siparis@altebutik.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="mt-1"
                required={enabled}
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Yanıt Adresi (Reply-To / İsteğe Bağlı)</Label>
              <Input
                type="email"
                placeholder="destek@altebutik.com"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">
                Yönetici Bildirim E-postası (Admin Notify)
              </Label>
              <Input
                type="email"
                placeholder="admin@altebutik.com"
                value={adminNotifyEmail}
                onChange={(e) => setAdminNotifyEmail(e.target.value)}
                className="mt-1"
              />
              <Text className="text-xs text-stone-400 mt-1">
                Yeni sipariş özeti ve iade uyarıları bu adrese iletilir.
              </Text>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </Button>
          </div>
        </Container>
      </form>

      {/* Email Logs Table */}
      <Container className="p-6">
        <div className="flex items-center justify-between pb-4 border-b mb-4">
          <div>
            <Heading level="h2" className="text-base font-semibold">
              Son E-posta Bildirim Günlüğü
            </Heading>
            <Text className="text-xs text-stone-500">
              Sistem tarafından tetiklenen son 50 e-posta işlemi (KVKK gereği alıcılar
              maskelenmiştir).
            </Text>
          </div>
          <Button variant="secondary" size="small" onClick={fetchLogs}>
            <ArrowPath className="w-4 h-4 mr-1" /> Yenile
          </Button>
        </div>

        {logs.length === 0 ? (
          <Text className="text-xs text-stone-400 py-4 text-center">
            Henüz kaydedilmiş e-posta bildirimi bulunmuyor.
          </Text>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b bg-stone-50 text-stone-600">
                  <th className="p-2">Tarih</th>
                  <th className="p-2">Şablon</th>
                  <th className="p-2">Sipariş</th>
                  <th className="p-2">Alıcı</th>
                  <th className="p-2">Durum</th>
                  <th className="p-2">Hata / Deneme</th>
                  <th className="p-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-stone-50">
                    <td className="p-2 whitespace-nowrap text-stone-500">
                      {new Date(log.created_at).toLocaleString("tr-TR")}
                    </td>
                    <td className="p-2 font-medium">{log.template}</td>
                    <td className="p-2 font-mono text-stone-700">{log.order_id}</td>
                    <td className="p-2 font-mono text-stone-500">{log.recipient_masked}</td>
                    <td className="p-2">
                      {log.status === "sent" && <Badge color="green">Gönderildi</Badge>}
                      {log.status === "failed" && <Badge color="red">Başarısız</Badge>}
                      {log.status === "skipped" && <Badge color="grey">Atlandı</Badge>}
                      {log.status === "retrying" && <Badge color="blue">Deneniyor</Badge>}
                    </td>
                    <td className="p-2 text-stone-500">
                      {log.error_code ? (
                        <span className="text-red-600 font-mono">{log.error_code}</span>
                      ) : (
                        `✓ (${log.attempts || 1} deneme)`
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {log.status === "failed" && (
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={retryingId === log.id}
                          onClick={() => handleRetryLog(log.id)}
                        >
                          {retryingId === log.id ? "Deneniyor..." : "Yeniden Dene"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>
    </div>
  );
}
