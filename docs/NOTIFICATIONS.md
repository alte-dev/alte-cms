# E-posta Bildirim Modülü ve Mimari Kararlar (NOTIFICATIONS.md)

Bu doküman, e-posta bildirim sisteminin tasarım kararlarını, güvenlik standartlarını, Medusa modül mimarisini ve sıfır kişisel veri (Zero PII) ilkelerini açıklar.

---

## 1. Mimari Karar: Neden Özel Medusa Modülü ve Servisi?

Medusa v2 çekirdeğinde `@medusajs/medusa/notification` modülü mevcuttur. Ancak bu çekirdek modül:

1. **Statik Yapılandırma:** Notification sağlayıcıları derleme veya başlangıç anında ortam değişkenleriyle (statik API anahtarı veya SMTP bilgisi) yapılandırılır.
2. **Dinamik Yönetim Yoksunluğu:** Mağaza yöneticisinin Medusa Admin UI üzerinden SMTP sunucusunu değiştirmesine, port/güvenlik protokolünü güncellemesine veya sunucuyu yeniden başlatmadan (`zero server restart`) yeni parola girmesine olanak tanımaz.
3. **Şifreleme Katmanı:** Veritabanında saklanan hassas SMTP parolalarını AES-256-GCM ile şifreleyen yerleşik bir anahtar yönetim mekanizmasına sahip değildir.
4. **Yerelleştirilmiş Şablonlar ve Kapıda Ödeme Desteği:** Türk e-ticaret mevzuatına uygun (KDV dahil tutarlar, kapıda ödeme hizmet bedeli dökümü, KVKK ve Mesafeli Satış Sözleşmesi bağlantıları) dinamik şablonları çekirdeğinde barındırmaz.

Bu gereksinimler doğrultusunda, **`apps/medusa/src/modules/email-settings`** altında MikroORM modelleri (`EmailSetting`, `EmailLog`), resmi veritabanı migration'ı (`Migration20261109000000.ts`) ve `EmailSettingsService` içeren tam uyumlu bir Medusa v2 modülü geliştirilmiş ve `medusa-config.ts` içinde tescil edilmiştir.

---

## 2. Sıfır Kişisel Veri (Zero PII) Günlükleme Politikası

KVKK ve GDPR uyumluluğu gereğince, `email_log` tablosunda ve sistem günlüklerinde hiçbir müşteri kişisel verisi (ad, soyad, açık e-posta, telefon, teslimat adresi) **asla saklanmaz**.

- **Alıcı Maskeleme:** Log tablosundaki `recipient_masked` alanı alıcı e-postasını tek yönlü maskeler (ör. `m***@example.test`).
- **Yük Verisi (`payload_json`) Yasağı:** `email_log` tablosunda ham e-posta gövdesi veya JSON yükü saklanmaz. Eski şemada kalmış olabilecek `payload_json` sütunu `Migration20261109000000.ts` ile `NULL` yapılarak veritabanından tamamen silinmiştir (`ALTER TABLE email_log DROP COLUMN payload_json`).
- **Yeniden Gönderim (Retry) Mekanizması:** Başarısız olan bir e-posta bildiriminin yeniden tetiklenmesi durumunda (`POST /admin/email-settings/logs/:id/retry`), sipariş verileri yetkili veritabanından `order_id` kullanılarak o an canlı olarak tekrar okunur, şablon yeniden oluşturulur ve gönderilir.

---

## 3. Güvenlik ve Dayanıklılık Standartları

1. **AES-256-GCM Şifreleme:** SMTP parolası veritabanına kaydedilmeden önce `SETTINGS_ENCRYPTION_KEY` ile şifrelenir. Admin API uç noktalarında asla açık parola dönülmez, maskeli (`••••••••••••••••a6ed`) olarak gösterilir.
2. **CRLF Header Injection Koruması:** E-posta konu başlıkları ve alıcı adreslerindeki `\r` ve `\n` satır sonlandırma karakterleri `sanitizeHeader()` ile temizlenerek e-posta başlığı enjeksiyonu (`Bcc:`, `Content-Type:`) engellenir.
3. **HTML / XSS Kaçırma:** Şablonlara yerleştirilen tüm kullanıcı ve sipariş verileri (ürün adı, müşteri adı, sipariş numarası vb.) `escapeHtml()` fonksiyonundan geçirilir.
4. **İdempotent Gönderim:** Her bildirim olayı için `(order_id, event_name)` çiftinden türetilen benzersiz bir `idempotency_key` oluşturulur. Paralel veya mükerrer webhook/event çağrılarında müşteriye veya yöneticiye asla mükerrer e-posta iletilmez.
5. **Kesintisiz İş Akışı (Non-Blocking):** SMTP sunucusunun kapalı veya erişilemez olması durumunda sipariş tamamlama veya kargo güncelleme işlemi asla iptal edilmez (hata fırlatılmaz). Durum `failed` olarak kaydedilir ve yönetici panelinden tek tıkla yeniden denenebilir.

---

## 4. Hukuk Bağlantıları ve Mağaza Sabitleri

- E-posta altbilgisinde yer alan yasal metinler, Payload CMS seed'indeki gerçek slug'lara yönlendirilir:
  - **Mesafeli Satış Sözleşmesi:** `${WEB_PUBLIC_URL}/sayfa/mesafeli-satis-sozlesmesi`
  - **KVKK Aydınlatma Metni:** `${WEB_PUBLIC_URL}/sayfa/kvkk`
- Mağaza adı ve etki alanı kodda sabit (hardcoded) olarak barındırılmaz. `process.env.STORE_NAME`, `process.env.WEB_PUBLIC_URL` ve veritabanındaki `from_name` dinamik ayarlarından beslenir.
