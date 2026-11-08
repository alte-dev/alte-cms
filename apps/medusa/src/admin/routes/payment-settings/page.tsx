import React, { useState, useEffect } from "react";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CreditCard, CheckCircleSolid, ExclamationCircleSolid } from "@medusajs/icons";
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Select,
  Text,
  Badge,
  Copy,
  Alert,
} from "@medusajs/ui";

export const config = defineRouteConfig({
  label: "Ödeme Ayarları",
  icon: CreditCard,
});

export default function PaymentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Form State
  const [paytrEnabled, setPaytrEnabled] = useState(false);
  const [paytrMode, setPaytrMode] = useState<"sandbox" | "live">("sandbox");
  const [paytrMerchantId, setPaytrMerchantId] = useState("");
  const [paytrMerchantKey, setPaytrMerchantKey] = useState("");
  const [paytrMerchantSalt, setPaytrMerchantSalt] = useState("");
  const [hasMerchantKey, setHasMerchantKey] = useState(false);
  const [hasMerchantSalt, setHasMerchantSalt] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [maskedSalt, setMaskedSalt] = useState("");
  const [paytrDisplayMode, setPaytrDisplayMode] = useState<"iframe" | "redirect">("iframe");
  const [paytrNoInstallment, setPaytrNoInstallment] = useState(false);
  const [paytrMaxInstallment, setPaytrMaxInstallment] = useState(0);
  const [paytrTimeoutLimit, setPaytrTimeoutLimit] = useState(30);
  const [paytrLang, setPaytrLang] = useState<"tr" | "en">("tr");
  const [confirmLive, setConfirmLive] = useState("");

  // COD State
  const [codEnabled, setCodEnabled] = useState(false);
  const [codFee, setCodFee] = useState(100);
  const [codFeeLabel, setCodFeeLabel] = useState("Kapıda Ödeme Hizmet Bedeli");
  const [codMaxOrderAmount, setCodMaxOrderAmount] = useState<string>("");

  // URLs
  const [callbackUrl, setCallbackUrl] = useState("");
  const [successUrl, setSuccessUrl] = useState("");
  const [failUrl, setFailUrl] = useState("");

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/admin/payment-settings");
      if (!res.ok) throw new Error("Ödeme ayarları yüklenemedi.");
      const data = await res.json();
      const s = data.settings || {};

      setPaytrEnabled(Boolean(s.paytr_enabled));
      setPaytrMode(s.paytr_mode || "sandbox");
      setPaytrMerchantId(s.paytr_merchant_id || "");
      setHasMerchantKey(Boolean(s.has_merchant_key));
      setHasMerchantSalt(Boolean(s.has_merchant_salt));
      setMaskedKey(s.merchant_key_masked || "");
      setMaskedSalt(s.merchant_salt_masked || "");
      setPaytrDisplayMode(s.paytr_display_mode || "iframe");
      setPaytrNoInstallment(Boolean(s.paytr_no_installment));
      setPaytrMaxInstallment(Number(s.paytr_max_installment || 0));
      setPaytrTimeoutLimit(Number(s.paytr_timeout_limit || 30));
      setPaytrLang(s.paytr_lang || "tr");

      setCodEnabled(Boolean(s.cod_enabled));
      setCodFee(Number(s.cod_fee ?? 100));
      setCodFeeLabel(s.cod_fee_label || "Kapıda Ödeme Hizmet Bedeli");
      setCodMaxOrderAmount(
        s.cod_max_order_amount !== null && s.cod_max_order_amount !== undefined
          ? String(s.cod_max_order_amount)
          : "",
      );

      setCallbackUrl(s.callback_url || "");
      setSuccessUrl(s.success_url || "");
      setFailUrl(s.fail_url || "");
    } catch (err: any) {
      setSaveStatus({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);

    try {
      const payload: Record<string, any> = {
        paytr_enabled: paytrEnabled,
        paytr_mode: paytrMode,
        paytr_merchant_id: paytrMerchantId,
        paytr_display_mode: paytrDisplayMode,
        paytr_no_installment: paytrNoInstallment,
        paytr_max_installment: Number(paytrMaxInstallment),
        paytr_timeout_limit: Number(paytrTimeoutLimit),
        paytr_lang: paytrLang,
        cod_enabled: codEnabled,
        cod_fee: Number(codFee),
        cod_fee_label: codFeeLabel,
        cod_max_order_amount: codMaxOrderAmount ? Number(codMaxOrderAmount) : null,
      };

      if (paytrMerchantKey.trim()) {
        payload.paytr_merchant_key = paytrMerchantKey.trim();
      }
      if (paytrMerchantSalt.trim()) {
        payload.paytr_merchant_salt = paytrMerchantSalt.trim();
      }
      if (paytrMode === "live") {
        payload.confirm_live = confirmLive;
      }

      const res = await fetch("/admin/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ayarlar kaydedilemedi.");
      }

      setSaveStatus({ success: true, message: "Ödeme ayarları başarıyla kaydedildi." });
      setPaytrMerchantKey("");
      setPaytrMerchantSalt("");
      setConfirmLive("");
      await fetchSettings();
    } catch (err: any) {
      setSaveStatus({ success: false, message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/admin/payment-settings/test-connection", {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || "PayTR API bağlantısı başarılı!",
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "PayTR API bağlantısı başarısız oldu.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Bağlantı hatası: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Container className="p-8">
        <Text>Ödeme ayarları yükleniyor...</Text>
      </Container>
    );
  }

  return (
    <Container className="p-8 max-w-4xl space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h1">Ödeme Ayarları</Heading>
            <Text className="text-ui-fg-subtle text-sm">
              PayTR (Sanal POS, iFrame / Yönlendirme) ve Kapıda Ödeme yapılandırması
            </Text>
          </div>
          <Badge color={paytrMode === "live" ? "red" : "blue"}>
            {paytrMode === "live" ? "CANLI MOD (LIVE)" : "TEST MODU (SANDBOX)"}
          </Badge>
        </div>
      </div>

      {paytrMode === "live" && (
        <Alert variant="error" className="bg-ui-tag-red-bg border-ui-border-danger">
          ⚠️ <strong>DİKKAT:</strong> Mağazanız şu anda <strong>CANLI (LIVE)</strong> ödeme
          modundadır. Gerçek kredi kartı çekimi ve banka provizyonu yapılacaktır.
        </Alert>
      )}

      {saveStatus && (
        <Alert variant={saveStatus.success ? "success" : "error"}>{saveStatus.message}</Alert>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* PAYTR SECTION */}
        <div className="border border-ui-border-base rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-ui-border-base pb-4">
            <div>
              <Heading level="h2">PayTR Sanal POS Yapılandırması</Heading>
              <Text className="text-ui-fg-subtle text-xs">
                Kredi Kartı ve Banka Kartı ile Güvenli Ödeme (iFrame & Yönlendirmeli)
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="paytr-enable">Aktif</Label>
              <Switch id="paytr-enable" checked={paytrEnabled} onCheckedChange={setPaytrEnabled} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Çalışma Modu</Label>
              <Select value={paytrMode} onValueChange={(val: any) => setPaytrMode(val)}>
                <Select.Trigger>
                  <Select.Value placeholder="Mod seçin" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="sandbox">Sandbox (Test / Geliştirme)</Select.Item>
                  <Select.Item value="live">Canlı (Production)</Select.Item>
                </Select.Content>
              </Select>
            </div>

            <div>
              <Label>Arayüz Gösterim Modu</Label>
              <Select
                value={paytrDisplayMode}
                onValueChange={(val: any) => setPaytrDisplayMode(val)}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Gösterim modu" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="iframe">iFrame (Ödeme sayfası içinde gömülü)</Select.Item>
                  <Select.Item value="redirect">
                    Yönlendirmeli (PayTR güvenli sayfasına git)
                  </Select.Item>
                </Select.Content>
              </Select>
            </div>
          </div>

          {paytrMode === "live" && (
            <div className="bg-ui-bg-subtle p-4 rounded-md border border-ui-border-danger space-y-2">
              <Label className="text-ui-fg-error font-semibold">
                CANLI Mod Onayı (Güvenlik Koruması)
              </Label>
              <Text className="text-xs text-ui-fg-subtle">
                Canlı moda geçişi onaylamak için kutuya büyük harflerle <strong>CANLI</strong>{" "}
                yazınız.
              </Text>
              <Input
                placeholder="CANLI yazarak onaylayın"
                value={confirmLive}
                onChange={(e) => setConfirmLive(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label>Mağaza No (Merchant ID)</Label>
              <Input
                placeholder="Örn: 123456"
                value={paytrMerchantId}
                onChange={(e) => setPaytrMerchantId(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  Mağaza Parolası (Merchant Key){" "}
                  {hasMerchantKey && (
                    <span className="text-xs text-ui-fg-interactive">(Mevcut: {maskedKey})</span>
                  )}
                </Label>
                <Input
                  type="password"
                  placeholder={
                    hasMerchantKey ? "Değiştirmek istemiyorsanız boş bırakın" : "Yeni anahtar"
                  }
                  value={paytrMerchantKey}
                  onChange={(e) => setPaytrMerchantKey(e.target.value)}
                />
              </div>

              <div>
                <Label>
                  Mağaza Gizli Anahtar (Merchant Salt){" "}
                  {hasMerchantSalt && (
                    <span className="text-xs text-ui-fg-interactive">(Mevcut: {maskedSalt})</span>
                  )}
                </Label>
                <Input
                  type="password"
                  placeholder={
                    hasMerchantSalt ? "Değiştirmek istemiyorsanız boş bırakın" : "Yeni salt"
                  }
                  value={paytrMerchantSalt}
                  onChange={(e) => setPaytrMerchantSalt(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-ui-border-base pt-4">
            <div>
              <Label>Taksit Ayarı</Label>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  id="paytr-no-inst"
                  checked={paytrNoInstallment}
                  onCheckedChange={setPaytrNoInstallment}
                />
                <Label htmlFor="paytr-no-inst" className="text-xs">
                  {paytrNoInstallment ? "Taksit Kapalı (Tek Çekim)" : "Taksit Açık"}
                </Label>
              </div>
            </div>

            <div>
              <Label>Maksimum Taksit (0 = Sınırsız)</Label>
              <Input
                type="number"
                min={0}
                max={12}
                value={paytrMaxInstallment}
                onChange={(e) => setPaytrMaxInstallment(parseInt(e.target.value, 10) || 0)}
              />
            </div>

            <div>
              <Label>Ödeme Zaman Aşımı (Dakika)</Label>
              <Input
                type="number"
                min={5}
                max={120}
                value={paytrTimeoutLimit}
                onChange={(e) => setPaytrTimeoutLimit(parseInt(e.target.value, 10) || 30)}
              />
            </div>
          </div>

          {/* Test Connection Button */}
          <div className="pt-2 flex items-center justify-between border-t border-ui-border-base">
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? "Test Ediliyor..." : "Bağlantıyı Test Et (1 TL Sandbox İsteği)"}
            </Button>
            {testResult && (
              <Text
                className={`text-xs ${testResult.success ? "text-ui-fg-interactive" : "text-ui-fg-error"}`}
              >
                {testResult.message}
              </Text>
            )}
          </div>
        </div>

        {/* PAYTR NOTIFICATION & REDIRECT URLS */}
        <div className="border border-ui-border-base rounded-lg p-6 space-y-4 bg-ui-bg-subtle">
          <Heading level="h2">PayTR Mağaza Paneline Girilecek Adresler (Salt-Okunur)</Heading>
          <Text className="text-ui-fg-subtle text-xs">
            Aşağıdaki adresleri PayTR Mağaza Paneli &gt; Bilgi sekmesindeki ilgili alanlara
            yapıştırınız.
          </Text>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Bildirim URL (Callback URL)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input readOnly value={callbackUrl} className="bg-ui-bg-base font-mono text-xs" />
                <Copy content={callbackUrl} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Başarılı Ödeme URL (Merchant OK URL)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input readOnly value={successUrl} className="bg-ui-bg-base font-mono text-xs" />
                  <Copy content={successUrl} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Başarısız Ödeme URL (Merchant Fail URL)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input readOnly value={failUrl} className="bg-ui-bg-base font-mono text-xs" />
                  <Copy content={failUrl} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CASH ON DELIVERY (COD) SECTION */}
        <div className="border border-ui-border-base rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-ui-border-base pb-4">
            <div>
              <Heading level="h2">Kapıda Ödeme (COD) Yapılandırması</Heading>
              <Text className="text-ui-fg-subtle text-xs">
                Teslimat anında nakit veya kart ile tahsilat yöntemi
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="cod-enable">Aktif</Label>
              <Switch id="cod-enable" checked={codEnabled} onCheckedChange={setCodEnabled} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Hizmet Bedeli (TL, KDV Dahil)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={codFee}
                onChange={(e) => setCodFee(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <Label>Bedel Etiketi</Label>
              <Input value={codFeeLabel} onChange={(e) => setCodFeeLabel(e.target.value)} />
            </div>

            <div>
              <Label>Maksimum Sipariş Tutarı (TL, Boş = Sınırsız)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Sınırsız"
                value={codMaxOrderAmount}
                onChange={(e) => setCodMaxOrderAmount(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </Button>
        </div>
      </form>
    </Container>
  );
}
