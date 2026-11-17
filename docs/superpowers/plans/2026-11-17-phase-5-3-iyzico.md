# Faz 5.3 — iyzico Ödeme Sağlayıcısı Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PayTR ve Kapıda Ödeme yanına iyzico Checkout Form (`pp_iyzico_iyzico`) ödeme sağlayıcısını eklemek; üç yöntemin admin panelinden bağımsız açılıp kapatılabilmesini, varsayılan yöntem seçimini ve PayTR ile aynı güvenlik/eşzamanlılık/kurtarma garantilerini sağlamak.

**Architecture:** `iyzipay` paketi (`postman-request` bağımlılığı nedeniyle) yerine sıfır bağımlılıklı `fetch` + `node:crypto` (`IYZWSv2`) istemcisi yazılır. Medusa v2 tarafında `payment-iyzico` modülü, `payment_setting` şema/migration güncellemesi, `payment-guard` üretim koruması ve yalnızca iç gizli anahtarla erişilen `/internal/payment/iyzico/callback` doğrulama ucu eklenir. Vitrin tarafında `/api/payment/iyzico/callback` form-urlencoded `token` alıp sunucudan sunucuya Medusa'ya doğrulatır ve `303` ile `/odeme/sonuc` sayfasına yönlendirir.

**Tech Stack:** TypeScript, Node.js 22 (`node:crypto`, `fetch`, `AbortSignal.timeout`), Medusa v2, MikroORM Migrations, Next.js 15, Zod, Vitest / Node test runner.

## Global Constraints

- Repo public: gerçek anahtar, parola, e-posta, alan adı, token hiçbir yere yazılmaz (`example.test` ve sahte değerler).
- `iyzico_display_mode` varsayılanı `redirect`; `embedded` modunda `dangerouslySetInnerHTML` kullanılmaz.
- TCKN (`identityNumber`) müşteriden toplanmaz/saklanmaz; yer tutucu `"11111111111"` kullanılır ve canlı kabulü insan kararı olarak raporlanır.
- `IYZICO_API_BASE` ve hız sınırı override env'leri üretimde (`NODE_ENV === "production"`) fail-closed yasaktır.
- `executeWithLock` bellek içi yedek kilidi tek süreçlidir; çoklu süreç sınırı PayTR ile aynıdır ve `SECURITY-DESIGN.md`'ye açıkça yazılır.
- Her madde için önce başarısız test yazılır, başarısızlığı görülür, sonra minimum kod yazılır.

---

### Task 1: iyzico `fetch` + `IYZWSv2` HMAC İstemcisi ve İmza Doğrulayıcı

- Create: `apps/medusa/src/modules/payment-iyzico/client.ts`
- Test: `apps/medusa/src/modules/payment-iyzico/client.test.ts`

### Task 2: `payment-iyzico` Medusa Sağlayıcısı, Kayıt ve Üretim Koruması

- Create: `apps/medusa/src/modules/payment-iyzico/service.ts`, `apps/medusa/src/modules/payment-iyzico/index.ts`
- Modify: `apps/medusa/medusa-config.ts`, `apps/medusa/src/scripts/setup-store.ts`, `apps/medusa/src/modules/payment-guard/service.ts`
- Test: `apps/medusa/src/modules/payment-iyzico/service.test.ts`, `scripts/verify-production-guard.ts`

### Task 3: `payment_setting` Modeli, Migration, Şifreleme ve Admin/Store API'leri

- Modify: `apps/medusa/src/modules/payment-settings/models/payment-setting.ts`, `apps/medusa/src/modules/payment-settings/service.ts`, `apps/medusa/src/api/admin/payment-settings/route.ts`, `apps/medusa/src/api/admin/payment-settings/test-connection/route.ts`, `apps/medusa/src/api/store/payment-options/route.ts`
- Create: `apps/medusa/src/modules/payment-settings/migrations/Migration20261117000000.ts`
- Test: `apps/medusa/src/modules/payment-settings/service.test.ts`

### Task 4: Sunucudan Sunucuya iyzico Callback Doğrulaması, İptal/CSV ve Bildirimler

- Create: `apps/medusa/src/api/internal/payment/iyzico/callback/route.ts`
- Modify: `apps/medusa/src/api/admin/order-operations/[id]/cancel/route.ts`, `apps/medusa/src/api/admin/order-operations/export-csv/route.ts`
- Test: `apps/medusa/src/api/internal/payment/iyzico/callback/route.test.ts`

### Task 5: Medusa Admin Ödeme Ayarları Arayüzü

- Modify: `apps/medusa/src/admin/routes/payment-settings/page.tsx`

### Task 6: Vitrin Checkout, Web Callback Rotası, CSP ve Sonuç Sayfası

- Create: `apps/web/src/app/api/payment/iyzico/callback/route.ts`
- Modify: `apps/web/src/lib/medusa/validation.ts`, `apps/web/src/lib/medusa/cart.ts`, `apps/web/src/app/api/checkout/route.ts`, `apps/web/src/components/checkout-form.tsx`, `apps/web/src/app/(store)/odeme/sonuc/page.tsx`, `apps/web/src/lib/security/headers.ts`, `apps/web/src/tests/security-headers.test.ts`
- Test: `apps/web/src/tests/iyzico-callback.test.ts`, `apps/web/src/tests/checkout.test.ts`

### Task 7: Kalıcı Doğrulama Betikleri (`verify-*`) ve Dokümantasyon

- Create: `scripts/lib/mock-iyzico-server.ts` (veya `scripts/verify-payments.ts` içinde)
- Modify: `scripts/verify-payments.ts`, `scripts/verify-order-ops.ts`, `scripts/verify-notifications.ts`, `scripts/verify-security.ts`, `docs/PAYMENTS.md`, `docs/RUNBOOK-PAYMENTS.md`, `docs/SECURITY-DESIGN.md`, `docs/PHASES.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`
