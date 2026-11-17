import React, { useEffect, useState } from "react";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { TruckFast } from "@medusajs/icons";
import { Alert, Badge, Button, Container, Heading, Label, Switch, Text } from "@medusajs/ui";
import { adminApiUrl } from "../../lib/api-url";

export const config = defineRouteConfig({
  label: "Kargo Profilleri",
  icon: TruckFast,
});

interface ShippingProfileItem {
  id: string;
  name: string;
  type: string;
  apply_to_all_products: boolean;
}

export default function ShippingProfilesPolicyPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<ShippingProfileItem[]>([]);
  const [missingCount, setMissingCount] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [applyToAll, setApplyToAll] = useState(true);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(adminApiUrl("/admin/shipping-profiles/default-policy"));
      if (!res.ok) throw new Error("Kargo profilleri yüklenemedi.");
      const data = await res.json();
      const list: ShippingProfileItem[] = data.profiles || [];
      setProfiles(list);
      setMissingCount(Number(data.products_without_profile_count || 0));
      const current = list.find((p) => p.apply_to_all_products) || list[0];
      if (current) {
        setSelectedId(current.id);
        setApplyToAll(current.apply_to_all_products);
      }
    } catch (err: any) {
      setStatus({ success: false, message: err?.message || "Bağlantı hatası" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(adminApiUrl("/admin/shipping-profiles/default-policy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping_profile_id: selectedId,
          apply_to_all_products: applyToAll,
          apply_to_existing: applyToExisting,
          overwrite_existing: overwriteExisting,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız.");
      setStatus({
        success: true,
        message: `Kaydedildi. ${data.updated_products_count || 0} ürün bu kargo profiline bağlandı.`,
      });
      await loadData();
    } catch (err: any) {
      setStatus({ success: false, message: err?.message || "Kaydetme hatası" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container className="p-6 max-w-3xl">
      <Heading level="h1" className="mb-2">
        Mağaza Geneli Kargo Profili Ayarı
      </Heading>
      <Text className="text-ui-fg-subtle mb-6">
        Buradan seçtiğiniz kargo profilini mağaza genelinde tüm yeni eklenen ürünler için varsayılan
        yapabilir ve mevcut ürünlere tek tıkla uygulayabilirsiniz.
      </Text>

      {status && (
        <Alert variant={status.success ? "success" : "error"} className="mb-4">
          {status.message}
        </Alert>
      )}

      {missingCount > 0 && (
        <Alert variant="warning" className="mb-4">
          Kargo profili atanmamış <strong>{missingCount}</strong> ürün bulunuyor. Kaydederken mevcut
          ürünlere uygula seçeneğini işaretleyebilirsiniz.
        </Alert>
      )}

      {loading ? (
        <Text>Yükleniyor...</Text>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-3">
            <Label>Varsayılan Kargo Profili</Label>
            {profiles.map((p) => (
              <label
                key={p.id}
                className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-ui-bg-subtle"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shipping_profile"
                    value={p.id}
                    checked={selectedId === p.id}
                    onChange={() => setSelectedId(p.id)}
                  />
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-ui-fg-subtle">
                      {p.id} ({p.type})
                    </div>
                  </div>
                </div>
                {p.apply_to_all_products && <Badge color="green">Mağaza Geneli Aktif</Badge>}
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label htmlFor="apply-all-switch">
                Yeni eklenen tüm ürünlerde otomatik geçerli olsun
              </Label>
              <Text className="text-xs text-ui-fg-subtle">
                Ürün eklerken kargo profili seçilmese bile bu profil otomatik atanır.
              </Text>
            </div>
            <Switch
              id="apply-all-switch"
              checked={applyToAll}
              onCheckedChange={(v) => setApplyToAll(Boolean(v))}
            />
          </div>

          <div className="space-y-3 p-4 border rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyToExisting}
                onChange={(e) => setApplyToExisting(e.target.checked)}
              />
              <span>Mevcut kargo profili olmayan ürünlere de uygula</span>
            </label>
            {applyToExisting && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ui-fg-subtle pl-6">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                />
                <span>
                  Zaten farklı profili olanlar dahil mağazadaki TÜM ürünlerin profilini bu profile
                  çevir
                </span>
              </label>
            )}
          </div>

          <Button type="submit" isLoading={saving}>
            Ayarları Kaydet ve Uygula
          </Button>
        </form>
      )}
    </Container>
  );
}
