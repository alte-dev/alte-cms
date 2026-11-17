import React, { useEffect, useState } from "react";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { adminApiUrl } from "../../lib/api-url";
import { ChatBubbleLeftRight } from "@medusajs/icons";
import { Alert, Badge, Button, Container, Heading, Select, Text, Textarea } from "@medusajs/ui";

export const config = defineRouteConfig({
  label: "İletişim Mesajları",
  icon: ChatBubbleLeftRight,
});

interface ContactMessageItem {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "replied" | "archived";
  reply_message?: string | null;
  replied_at?: string | null;
  replied_by?: string | null;
  internal_note?: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<
  string,
  { label: string; color: "green" | "orange" | "blue" | "grey" }
> = {
  new: { label: "Yeni", color: "blue" },
  in_progress: { label: "İnceleniyor", color: "orange" },
  replied: { label: "Yanıtlandı", color: "green" },
  archived: { label: "Arşivlendi", color: "grey" },
};

export default function ContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ContactMessageItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [nextStatus, setNextStatus] = useState<string>("new");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const loadMessages = async (filter: string) => {
    try {
      setLoading(true);
      const query = filter !== "all" ? `?status=${encodeURIComponent(filter)}` : "";
      const res = await fetch(adminApiUrl(`/admin/contact-messages${query}`));
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Mesajlar yüklenemedi.");
      }
      setMessages(data.messages || []);
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages(statusFilter);
  }, [statusFilter]);

  const selectMessage = (msg: ContactMessageItem) => {
    setSelected(msg);
    setReplyText(msg.reply_message || "");
    setInternalNote(msg.internal_note || "");
    setNextStatus(msg.status || "new");
    setFeedback(null);
  };

  const handleSave = async (sendReply: boolean) => {
    if (!selected) return;
    setSaving(true);
    setFeedback(null);

    try {
      const payload: Record<string, string> = {
        status: nextStatus,
        internal_note: internalNote,
      };
      if (sendReply) {
        if (!replyText.trim()) {
          throw new Error("Yanıt göndermek için yanıt metni yazmalısınız.");
        }
        payload.reply_message = replyText.trim();
      }

      const res = await fetch(adminApiUrl(`/admin/contact-messages/${selected.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Güncelleme başarısız.");
      }

      const updated = data.message as ContactMessageItem;
      setSelected(updated);
      setNextStatus(updated.status);
      setFeedback({
        ok: true,
        text: sendReply
          ? "Yanıt e-postası gönderildi ve mesaj 'Yanıtlandı' olarak güncellendi."
          : "Mesaj durumu ve notu kaydedildi.",
      });
      await loadMessages(statusFilter);
    } catch (err: any) {
      setFeedback({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Heading level="h1">İletişim Mesajları</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Vitrin iletişim formundan gelen müşteri mesajlarını görüntüleyin ve yanıtlayın.
          </Text>
        </div>

        <div className="w-52">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <Select.Trigger>
              <Select.Value placeholder="Durum Filtrele" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">Tüm Durumlar</Select.Item>
              <Select.Item value="new">Yeni</Select.Item>
              <Select.Item value="in_progress">İnceleniyor</Select.Item>
              <Select.Item value="replied">Yanıtlandı</Select.Item>
              <Select.Item value="archived">Arşivlendi</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>

      {feedback && <Alert variant={feedback.ok ? "success" : "error"}>{feedback.text}</Alert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          {loading ? (
            <Text size="small" className="text-ui-fg-subtle">
              Mesajlar yükleniyor...
            </Text>
          ) : messages.length === 0 ? (
            <div className="rounded-lg border border-ui-border-base p-4 text-sm text-ui-fg-subtle">
              Bu filtrede iletişim mesajı bulunamadı.
            </div>
          ) : (
            messages.map((msg) => {
              const badge = STATUS_LABELS[msg.status] || STATUS_LABELS.new;
              const isSelected = selected?.id === msg.id;
              return (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => selectMessage(msg)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    isSelected
                      ? "border-ui-border-interactive bg-ui-bg-subtle"
                      : "border-ui-border-base bg-ui-bg-base hover:bg-ui-bg-subtle-hover"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ui-fg-base truncate">{msg.subject}</span>
                    <Badge color={badge.color}>{badge.label}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-ui-fg-subtle">
                    {msg.name} · {msg.email}
                  </div>
                  <div className="mt-1 text-xs text-ui-fg-muted">
                    {new Date(msg.created_at).toLocaleString("tr-TR")}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-3">
          {!selected ? (
            <div className="rounded-lg border border-ui-border-base p-6 text-sm text-ui-fg-subtle">
              Detayları görüntülemek ve yanıtlamak için soldan bir mesaj seçin.
            </div>
          ) : (
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ui-border-base pb-4">
                <div>
                  <Heading level="h2">{selected.subject}</Heading>
                  <Text size="small" className="text-ui-fg-subtle mt-1">
                    {selected.name} ({selected.email}){selected.phone ? ` · ${selected.phone}` : ""}
                  </Text>
                </div>
                <Badge color={(STATUS_LABELS[selected.status] || STATUS_LABELS.new).color}>
                  {(STATUS_LABELS[selected.status] || STATUS_LABELS.new).label}
                </Badge>
              </div>

              <div>
                <Text size="small" weight="plus" className="mb-1.5">
                  Müşteri Mesajı
                </Text>
                <div className="rounded-md border border-ui-border-base bg-ui-bg-subtle p-4 text-sm whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Text size="small" weight="plus" className="mb-1.5">
                    Durum
                  </Text>
                  <Select value={nextStatus} onValueChange={setNextStatus}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="new">Yeni</Select.Item>
                      <Select.Item value="in_progress">İnceleniyor</Select.Item>
                      <Select.Item value="replied">Yanıtlandı</Select.Item>
                      <Select.Item value="archived">Arşivlendi</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                {selected.replied_at ? (
                  <div className="text-xs text-ui-fg-subtle self-end pb-2">
                    Son yanıt: {new Date(selected.replied_at).toLocaleString("tr-TR")} (
                    {selected.replied_by || "Yönetici"})
                  </div>
                ) : null}
              </div>

              <div>
                <Text size="small" weight="plus" className="mb-1.5">
                  Yönetici İç Notu (Müşteriye Gitmez)
                </Text>
                <Textarea
                  rows={2}
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Ekip içi not ekleyin..."
                />
              </div>

              <div>
                <Text size="small" weight="plus" className="mb-1.5">
                  Müşteriye Yanıt E-postası
                </Text>
                <Textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Müşteriye gönderilecek yanıtı yazın..."
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" disabled={saving} onClick={() => handleSave(false)}>
                  Durumu / Notu Kaydet
                </Button>
                <Button disabled={saving} onClick={() => handleSave(true)}>
                  Yanıt E-postası Gönder
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
