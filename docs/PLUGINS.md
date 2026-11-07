# Eklenti ve Sağlayıcı Mimarisi (PLUGINS.md)

Bu doküman; PayTR, Kapıda Ödeme ve Kargo sağlayıcılarının Medusa v2 mimarisine nasıl entegre edileceğini, TypeScript arayüz taslaklarını, yaşam döngüsünü ve ayar saklama kurallarını tanımlar.

---

## 1. Ödeme Sağlayıcıları (Payment Providers)

Medusa v2 mimarisinde tüm ödeme yöntemleri bağımsız modül sağlayıcıları (`AbstractPaymentProvider`) olarak geliştirilir.

### 1.1 Desteklenecek Ödeme Yöntemleri

1. **PayTR (Kredi / Banka Kartı - 3D Secure / iFrame):**
   - Kimlik doğrulama, token üretimi ve sunucu tarafı callback (webhook) doğrulamasını yönetir.
2. **Kapıda Ödeme (Cash on Delivery - COD):**
   - Ek hizmet bedeli (surcharge) desteği, sipariş anında otomatik `authorized` statüsü ve teslimatta tahsilat onayını yönetir.

### 1.2 TypeScript Arayüz Taslağı (Medusa v2 Uyumlu)

```typescript
export interface PayTRProviderOptions {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  isTestMode: boolean;
  debugOn: boolean;
  maxInstallments?: number;
}

export interface PaymentProviderSessionResponse {
  data: Record<string, unknown>;
  status?: "authorized" | "pending" | "requires_more" | "error" | "canceled";
}

export interface WebhookActionResult {
  action: "authorized" | "captured" | "failed" | "not_supported";
  data?: {
    session_id: string;
    amount: number;
    resource_id?: string;
  };
}

/**
 * Medusa v2 Abstract Payment Provider Interface
 */
export interface IPaymentProvider {
  /**
   * Sepet için ödeme oturumunu başlatır (PayTR iframe token'ı alır veya COD kaydı açar)
   */
  initiatePayment(context: {
    amount: number;
    currency_code: string;
    resource_id: string;
    customer?: { email: string; phone?: string; first_name?: string; last_name?: string };
    context?: Record<string, unknown>;
  }): Promise<PaymentProviderSessionResponse>;

  /**
   * Ödeme yetkilendirmesi (Authorization)
   */
  authorizePayment(
    paymentSessionData: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<PaymentProviderSessionResponse>;

  /**
   * Tahsilat işlemi (Capture)
   */
  capturePayment(paymentData: Record<string, unknown>): Promise<Record<string, unknown>>;

  /**
   * İade işlemi (Refund)
   */
  refundPayment(
    paymentData: Record<string, unknown>,
    refundAmount: number,
  ): Promise<Record<string, unknown>>;

  /**
   * İptal işlemi (Cancel)
   */
  cancelPayment(paymentData: Record<string, unknown>): Promise<Record<string, unknown>>;

  /**
   * PayTR Sunucu Bildirimi (Webhook) Ayrıştırma ve Doğrulama
   */
  getWebhookActionAndData(payload: {
    data: Record<string, unknown>;
    rawData: string | Buffer;
    headers: Record<string, string>;
  }): Promise<WebhookActionResult>;
}
```

---

## 2. Kargo Sağlayıcıları (Fulfillment Providers)

Kargo yöntemleri (Yurtiçi Kargo, Aras, MNG veya Sabit Ücretli Kargo) Medusa `AbstractFulfillmentProvider` arayüzünü uygular.

### 2.1 TypeScript Arayüz Taslağı

```typescript
export interface IFulfillmentProvider {
  /**
   * Geçerli teslimat seçeneklerini listeler (Standart Kargo, Hızlı Teslimat vb.)
   */
  getFulfillmentOptions(): Promise<Array<{ id: string; name: string }>>;

  /**
   * Adres ve sepet verilerine göre kargo ücretini hesaplar
   */
  calculatePrice(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    cart: Record<string, unknown>,
  ): Promise<number>;

  /**
   * Sipariş tamamlandığında kargo gönderisi (Fulfillment) oluşturur ve takip numarası üretir
   */
  createFulfillment(
    data: Record<string, unknown>,
    items: Array<Record<string, unknown>>,
    order: Record<string, unknown>,
    fulfillment: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;

  /**
   * Gönderi iptali
   */
  cancelFulfillment(fulfillment: Record<string, unknown>): Promise<Record<string, unknown>>;
}
```

---

## 3. Yaşam Döngüsü ve Ayar Saklama Kuralları

1. **Gizli Anahtarların Saklanması:**
   - PayTR `merchant_key` ve `merchant_salt` gibi hassas anahtarlar kesinlikle veritabanında düz metin olarak veya frontend'e açık şekilde saklanmaz.
   - Bu değerler sunucu ortam değişkenlerinden (`PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`) okunur.
2. **Yönetici Ayarları:**
   - Test modu, taksit sınırlandırmaları, ücretsiz kargo eşik tutarı (örn. 500 TL üzeri kargo bedava) ve kapıda ödeme hizmet bedeli Medusa `Store` veya `PluginOptions` modelinde saklanır ve Medusa Admin paneli üzerinden yönetilir.
