# Misafir Checkout, Promosyon ve Sipariş Onay Akışı (CHECKOUT_FLOW.md)

Bu doküman, Alte platformunda kullanıcının sepet oluşturmasından başlayıp misafir checkout (`/odeme`), kupon uygulama, yasal onaylar, geliştirme ortamı ödeme güvenlik kapısı ve sipariş onayı (`/siparis-onay`) adımlarına kadar uçtan uca mimarisini açıklar.

---

## 1. Uçtan Uca Mermaid Sıra Diyagramı (Faz 3 & Faz 4 Entegre)

```mermaid
sequenceDiagram
    autonumber
    actor M as Müşteri (Misafir)
    participant W as Next.js Vitrin (/odeme)
    participant API as Web API (/api/checkout)
    participant S as Medusa v2 Commerce Engine
    participant DB as PostgreSQL
    participant P as PayTR (Faz 4)

    Note over M,W: 1. Misafir Formu ve Kupon Girişi
    M->>W: İletişim, Teslimat (81 İl), Fatura (Bireysel/Kurumsal) ve Yasal Onayları Gir
    opt Kupon Kodu Uygulama
        M->>W: Kupon Kodunu Gir ("TEST10")
        W->>S: POST /store/carts/:id/promotions
        S-->>W: 200 OK (Kupon İndirimi Hesaplandı)
    end

    Note over M,API: 2. Checkout Gönderimi ve Doğrulama
    M->>API: POST /api/checkout (Payload)
    API->>API: Zod CheckoutFormSchema Doğrulaması (Telefon +905, 10 Haneli VN, Onaylar)
    API->>S: POST /store/carts/:id (E-posta, Adresler, Metadata)
    API->>S: POST /store/carts/:id/shipping-methods (Kargo Seçimi)

    Note over API,S: 3. Ödeme Güvenlik Kapısı (Fail-Closed)
    API->>API: isDevPaymentAllowed() Kontrolü
    alt Üretim Ortamı (NODE_ENV=production) VEYA ALLOW_DEV_PAYMENT !== 'true'
        API-->>M: HTTP 400 "Ödeme yöntemi henüz yapılandırılmadı."
    else Geliştirme Ortamı (dev + ALLOW_DEV_PAYMENT=true)
        API->>S: POST /store/payment-collections (cart_id)
        API->>S: POST /store/payment-collections/:id/payment-sessions (pp_system_default)
        API->>S: POST /store/carts/:id/complete
        S->>DB: Siparişi Oluştur ve Kaydet
        S-->>API: 200 OK (Order Nesnesi)
        API->>API: _order_confirmation Cookie'si Yaz (maxAge: 3600), cart_id Temizle
        API-->>M: HTTP 200 { success: true, redirectUrl: "/siparis-onay" }
        M->>W: GET /siparis-onay
        W->>S: GET /store/orders/:id
        W-->>M: "Siparişiniz Başarıyla Alındı" Ekranı
    end
```

---

## 2. Form Mimarisi ve Türkiye Mevzuatı Kuralları

1. **İletişim & Telefon Normalizasyonu (`normalizeTurkishPhone`):**

   - Türkiye mobil cep numaraları E.164 standardına (`+905XXXXXXXXX`) dönüştürülür.
   - 05XX, 5XX, +905XX, 00905XX formatları kabul edilir; sabit hatlar (0212, 0312 vb.) ve yabancı formatlar reddedilir.

2. **81 İl Seçim Listesi (`TURKISH_CITIES`):**

   - Türkiye Cumhuriyeti'nin resmi 81 ili alfabetik sıralı ve benzersiz olarak sunulur. Serbest metin il girişine izin verilmez.

3. **Fatura Türü ve Bilgileri (Bireysel / Kurumsal):**

   - **Bireysel Fatura:** Teslimat adresiyle aynı seçeneği (varsayılan) veya ayrı fatura adresi.
   - **Kurumsal Fatura:** Şirket Resmi Unvanı, Vergi Dairesi ve tam 10 haneli Vergi Numarası (`CorporateTaxNumberSchema`) zorunludur.
   - **ÖNEMLİ (KVKK / Veri Minimizasyonu):** Bireysel ve kurumsal hiçbir faturada **TC Kimlik Numarası toplanmaz ve talep edilmez.**

4. **Yasal Onaylar ve Audit Zaman Damgaları:**

   - Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu (`/sayfa/mesafeli-satis-sozlesmesi` linkli).
   - KVKK Aydınlatma Metni (`/sayfa/kvkk` linkli).
   - Sipariş onayında her iki onay zorunludur ve Medusa cart metadata alanında ISO-8601 zaman damgasıyla saklanır:
     `distance_sales_contract_consent_at`, `kvkk_consent_at`.

5. **Çift Gönderim Koruması (Double-Submit Protection):**
   - Form gönderimi sırasında buton devre dışı kalır (`disabled`), spinner animasyonu gösterilir ve mükerrer istek gönderilmesi engellenir.

---

## 3. Promosyon ve Kupon Sistemi (Medusa v2)

- **Endpoint:** `POST /store/carts/:id/promotions` ve `DELETE /store/carts/:id/promotions`
- **Kupon Kodları (Idempotent Seed):**
  - `TEST10`: Yüzde 10 indirim
  - `TEST50TL`: 50 TL sabit tutar indirimi
- **Hata Yönetimi:** Geçersiz veya süresi dolmuş kuponlarda kullanıcıya dostça Türkçe mesaj döndürülür: `"Geçersiz veya süresi dolmuş kupon kodu."`

---

## 4. Ödeme Güvenlik Kapısı (Production Payment Guard)

- `isDevPaymentAllowed()`:
  - `process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_PAYMENT === "true"`
- **Fail-Closed:** Üretimde sahte ödeme (`pp_system_default`) ile sipariş oluşturulması hem Medusa uygulama seviyesinde (Payment Guard loader) hem de Next.js vitrin checkout API'sinde engellenmiştir.

---

## 5. Sipariş Tamamlama ve Çerez Yaşam Döngüsü

1. Sipariş başarıyla oluşturulduğunda:
   - `cart_id` çerezi silinir.
   - `_order_confirmation` adında 1 saatlik (maxAge 3600) güvenli `httpOnly`, `sameSite: "lax"` çerez yazılır.
2. `/siparis-onay` sayfası:
   - `_order_confirmation` çerezini okur; çerez yoksa veya sipariş bulunamazsa doğrudan `/` ana sayfaya yönlendirir.
   - Sipariş detaylarını Medusa'dan çeker; Sipariş No (`display_id`), kalemler, birim fiyatlar, KDV (%20), kargo, indirim ve genel toplamı TL cinsinden görüntüler.
