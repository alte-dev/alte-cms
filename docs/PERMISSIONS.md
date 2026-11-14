# Rol ve Yetki Matrisi (Permissions Matrix)

Alte CMS monoreposunda Payload CMS 3 tarafında uygulanan rol bazlı yetkilendirme modeli aşağıda özetlenmiştir.

> [!IMPORTANT]
> Tüm izin kuralları `apps/web/src/tests/content-permissions.test.ts` ve `apps/web/src/tests/users-access.test.ts` altında **vitest unit testleri ile kanıtlanmıştır**.

---

## 1. Yetki Matrisi Tablosu

| İşlem / Kaynak                                 |   `super-admin`    |      `admin`       |             `editor`              |     `anonymous` (Ziyaretçi)      |
| ---------------------------------------------- | :----------------: | :----------------: | :-------------------------------: | :------------------------------: |
| **Sayfalar & Blog: Okuma (Published)**         |     ✅ İzinli      |     ✅ İzinli      |             ✅ İzinli             |            ✅ İzinli             |
| **Sayfalar & Blog: Okuma (Drafts)**            |     ✅ İzinli      |     ✅ İzinli      |             ✅ İzinli             | ❌ **ENGEL** (Zero Leakage, 404) |
| **Sayfalar & Blog: Oluşturma & Düzenleme**     |     ✅ İzinli      |     ✅ İzinli      |             ✅ İzinli             |             ❌ ENGEL             |
| **Sayfalar & Blog: Silme**                     |     ✅ İzinli      |     ✅ İzinli      |    ❌ **ENGEL** (Silme yasak)     |             ❌ ENGEL             |
| **Görsel Düzenleyici (Puck /admin/puck/[id])** |     ✅ İzinli      |     ✅ İzinli      |             ✅ İzinli             |      ❌ **ENGEL** (401/403)      |
| **Medya Yükleme (JPEG, PNG, WebP, AVIF)**      |     ✅ İzinli      |     ✅ İzinli      |             ✅ İzinli             |             ❌ ENGEL             |
| **Medya Silme**                                |     ✅ İzinli      |     ✅ İzinli      |    ❌ **ENGEL** (Silme yasak)     |             ❌ ENGEL             |
| **SVG Medya Yükleme**                          | ❌ **YASAK** (XSS) | ❌ **YASAK** (XSS) |        ❌ **YASAK** (XSS)         |             ❌ YASAK             |
| **Site Ayarları & Menü Düzenleme (Globals)**   |     ✅ İzinli      |     ✅ İzinli      |    ❌ **ENGEL** (Değiştiremez)    |             ❌ ENGEL             |
| **Yönlendirme Ekleme & Düzenleme (Redirects)** |     ✅ İzinli      |     ✅ İzinli      |           ❌ **ENGEL**            |             ❌ ENGEL             |
| **Kullanıcı Yönetimi (Staff Accounts)**        |     ✅ İzinli      |    ✅ İzinli\*     | ❌ ENGEL (Yalnızca kendi profili) |             ❌ ENGEL             |
| **Yazar E-postası Görüntüleme**                |     ✅ İzinli      |     ✅ İzinli      |             ✅ İzinli             |   ❌ **ENGEL** (Sıfır sızıntı)   |

_\* `admin` rolü `super-admin` kullanıcı oluşturamaz, güncelleyemez veya silemez._

---

## 2. Özel Güvenlik Korumaları

1. **Taslak Koruması (`canReadPublishedOnlyOrStaff`)**:
   Ziyaretçi veya arama motoru isteğinde Payload `_status: { equals: "published" }` filtre sorgusunu zorunlu kılar. REST ve vitrin üzerinden taslaklara erişim imkansızdır.
2. **Yazar E-posta Gizliliği (`canReadUserEmail`)**:
   `Users` koleksiyonunun `email` alanında field-level read access tanımlıdır. Ziyaretçi bir blog yazısını okurken veya API'den çekerken `author.name` döner; `author.email` ise `undefined` olarak filtrelenir.
3. **SVG Engellemesi (`ALLOWED_MIME_TYPES`)**:
   SVG formatı içerebileceği zararlı JavaScript ve XML entity saldırıları (XXE/XSS) nedeniyle dosya uzantısı ve MIME tipi bazında tamamen yasaklanmıştır.

## Müşteri Hesapları ve İzolasyon (Faz 12)

- **Müşteri (`customer`):** Yalnızca kendi `customer_account_state`, `customer_session`, `customer_consent`, adres defteri ve sipariş kayıtlarına erişebilir. Başka müşterinin siparişine veya adresine erişim fail-closed olarak HTTP 403/404 ile reddedilir (`orderOwnershipGuard`, `/api/account/orders/[id]` üzerinde `x-alte-internal` başlığı bilerek gönderilmez).
- **Misafir (Anonim):** `/hesap/*` sayfaları anonim kullanıcıyı `/hesap/giris`'e yönlendirir. Misafir checkout çalışmaya devam eder; `/store/account/*` iç uç noktaları ve `/auth/customer/emailpass/*` doğrudan Medusa çağrıları `internalRouteGuard` / `authRouteGuard` tarafından HTTP 404 ile kapatılır.
- **Yönetici / Editör:** Payload CMS rolleri (`admin`, `editor`) Medusa müşteri parolalarına veya `customer_legacy_credential` şifreli tablosuna erişemez.
- **Rezerve Sluglar:** `hesap` slug'ı Payload `Pages` koleksiyonunda rezerve edilmiştir; CMS sayfası olarak oluşturulamaz.
