# Sipariş Yönetimi ve Kargo Operasyonları Rehberi (ORDER-OPERATIONS.md)

Bu doküman, sipariş kargo takibi, kapıda ödeme tahsilatı, sipariş iptali, muhasebe CSV dışa aktarımı ve vitrin sorgulama mekanizmalarını açıklar.

---

## 1. Kargo Firmaları ve Takip Bağlantıları

Sistem Türkiye'de yaygın olarak kullanılan başlıca kargo sağlayıcılarını destekler ve güvenli URL şablonlarıyla takip bağlantısı üretir:

| Firma Kodu | Firma Adı     | Takip Bağlantı Şablonu                                                         | İzin Verilen Alan Adı      |
| ---------- | ------------- | ------------------------------------------------------------------------------ | -------------------------- |
| `yurtici`  | Yurtiçi Kargo | `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={code}` | `yurticikargo.com`         |
| `aras`     | Aras Kargo    | `https://www.araskargo.com.tr/kargo-takip?code={code}`                         | `araskargo.com.tr`         |
| `mng`      | MNG Kargo     | `https://kargotakip.mngkargo.com.tr/?code={code}`                              | `mngkargo.com.tr`          |
| `ptt`      | PTT Kargo     | `https://gonderitakip.ptt.gov.tr/Track/Verify?q={code}`                        | `ptt.gov.tr`               |
| `surat`    | Sürat Kargo   | `https://suratkargo.com.tr/KargoTakip/?kargotakipno={code}`                    | `suratkargo.com.tr`        |
| `hepsijet` | HepsiJet      | `https://www.hepsijet.com/gonderi-takibi/{code}`                               | `hepsijet.com`             |
| `diger`    | Diğer (Özel)  | Yönetici tarafından sağlanan özel HTTPS bağlantısı                             | Yalnızca `https://` şeması |

### Güvenlik ve Doğrulama Kuralları:

- **Biçim:** Takip kodu yalnızca harf, rakam ve tire (`-`) karakterleri içerebilir; maksimum uzunluk 40 karakterdir (`^[A-Za-z0-9\-]{1,40}$`). Boşluk ve kontrol karakterleri reddedilir.
- **HTTPS Zorunluluğu:** Bağlantılar istisnasız `https://` protokolüyle başlamalıdır. `http://`, `javascript:`, `data:` veya `//` kalıpları derhal engellenir (XSS ve açık yönlendirme koruması).
- **Alan Adı Beyaz Listesi:** Tanımlı firmaların takip linkleri ilgili kargo firmasının doğrulanmış etki alanıyla bitmek zorundadır.

---

## 2. Kapıda Ödeme (COD) Tahsilat Döngüsü

1. Kapıda ödeme ile verilen siparişler başlangıçta `payment_status = "awaiting"` olarak kaydedilir.
2. Sipariş teslim edilip kurye tarafından tahsilat yapıldığında, Medusa Admin üzerinden **"Kapıda Ödeme Tahsil Edildi"** butonu tetiklenir (`POST /admin/order-operations/:id/cod-captured`).
3. **İdempotent Güvence:** Sipariş daha önce tahsil edildi olarak işaretlenmişse mükerrer işlem yapılmaz, mevcut durum korunur.

---

## 3. Sipariş İptal Akışı (Güvenli & Otomatik İade Yok)

- **Kargo Koruması:** Kargoya verilmiş (`metadata.tracking_code` veya `fulfillment_status = 'shipped'`) siparişlerin iptali sistem tarafından kesin olarak reddedilir (HTTP 400). Müşterinin cayma hakkı için yasal iade süreci işletilmelidir.
- **PayTR Kredi Kartı İptalleri:**
  - Kredi kartıyla ödenmiş bir sipariş iptal edildiğinde **asla otomatik PayTR geri ödeme API çağrısı yapılmaz**.
  - Sipariş `needs_manual_refund = true` olarak işaretlenir ve `apps/medusa` içindeki "Elle İade Bekleyenler" listesine eklenir.
  - İade işlemi yetkili mağaza yöneticisi tarafından doğrudan PayTR Mağaza Paneli üzerinden gerçekleştirilmelidir (ayrıntılar için bkz. [`docs/RUNBOOK-PAYMENTS.md`](file:///c:/Projeler/CMS/docs/RUNBOOK-PAYMENTS.md)).
- **Müşteri Bildirimi:** İptal edilen sipariş için müşteriye anında `order.canceled` e-posta bildirimi iletilir (FAZ 6B).

---

## 4. Muhasebe CSV Dışa Aktarımı ve Hücre Enjeksiyonu Koruması

Yöneticiler `GET /admin/order-operations/export-csv?from=&to=` uç noktasıyla seçilen tarih aralığındaki siparişlerin muhasebe özetini indirebilir.

### Güvenlik Önlemleri:

1. **Sıfır Kişisel Veri (Zero PII):** Müşteri adı, soyadı, telefon numarası, teslimat adresi veya e-posta adresi CSV dosyasına kesinlikle dahil edilmez. Yalnızca sipariş no, tarih, durum, ödeme yöntemi, vergi/kargo dökümü ve takip kodu yer alır.
2. **Formül Enjeksiyonu Koruması (CSV Injection):** Excel veya LibreOffice üzerinde komut çalıştırma zafiyetini (`DDE`, `=CMD()`) önlemek amacıyla; `=`, `+`, `-`, `@`, `\t`, `\r` karakterleriyle başlayan hücrelerin başına otomatik olarak tek tırnak (`'`) eklenir ve çift tırnakla kaçırılır.
3. **Yetki Kontrolü:** Yalnızca `admin`, `super-admin` veya `shop-manager` rollerine izin verilir (Yetkisiz istekler 401/403).

---

## 5. Vitrin Sipariş Sorgulama (`/siparis-takip`)

Müşteriler üye girişi yapmadan sipariş numarası ve siparişte belirttikleri e-posta adresi ile siparişlerinin güncel durumunu takip edebilir.

### Güvenlik & Gizlilik:

- **Zamanlama Saldırısı Koruması (Timing-Safe):** E-posta karşılaştırması `crypto.timingSafeEqual` ve Türkçe harf duyarlı normalizasyon ile sabit zamanlı yürütülür.
- **Numara Tarama Kalkanı (Anti-Enumeration):** Sipariş bulunamadığında veya e-posta eşleşmediğinde tek ve jenerik bir hata mesajı döndürülür: _"Sipariş bulunamadı veya e-posta adresi eşleşmiyor."_
- **Sert Hız Sınırı (Rate Limiting):**
  - IP başına dakikada maksimum **10 istek**.
  - Aynı IP ve sipariş numarası için **5 başarısız denemeden sonra 15 dakika engelleme**.
- **Arama Motoru İzolasyonu:** Sayfa `robots: { index: false, follow: false }` (`noindex`) içerir ve `robots.txt` ile taranması engellenmiştir.

### 5.1. POST /store/order-tracking İstek ve Yanıt Sözleşmesi

- **Metot:** `POST`
- **Uç Nokta:** `/store/order-tracking`
- **İstek Başlığı:** `Content-Type: application/json`

#### İstek Gövdesi Biçimi:

```json
{
  "order_id_or_number": "#1001",
  "email": "musteri@example.test"
}
```

#### Başarılı Yanıt (HTTP 200 OK) — Sıfır Kişisel Veri (Zero PII):

Müşteri adı, soyadı, açık teslimat adresi veya telefon numarası **asla döndürülmez**:

```json
{
  "order": {
    "display_id": 1001,
    "status": "completed",
    "created_at": "2026-11-09T12:00:00.000Z",
    "items": [
      {
        "title": "Keten Gömlek",
        "quantity": 1
      }
    ],
    "subtotal": 1250.0,
    "shipping_total": 0.0,
    "total": 1250.0,
    "carrier_name": "Yurtiçi Kargo",
    "tracking_code": "YK-12345678",
    "tracking_url": "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=YK-12345678",
    "shipped_at": "2026-11-09T13:00:00.000Z"
  }
}
```

#### Eşleşmeyen / Yanlış Bilgilerde Tek Tip Yanıt (HTTP 404 Not Found):

Saldırganların geçerli sipariş numaralarını veya e-posta adreslerini ayırt edememesi için gerek yanlış numara, gerek yanlış e-posta gerekse geçersiz giriş formatlarında **birebir aynı gövde ve HTTP 404 durum kodu** döndürülür:

```json
{
  "error": "Sipariş bulunamadı veya e-posta adresi eşleşmiyor."
}
```

#### Hız Sınırı Aşıldığında (HTTP 429 Too Many Requests):

- Dakikada 10 istek aşıldığında:
  `{ "error": "Hız sınırı aşıldı. Lütfen dakikada en fazla 10 sorgulama yapınız." }`
- 5 başarısız denemeden sonra 15 dakikalık geçici engel tetiklendiğinde (doğru bilgiler girilse dahi):
  `{ "error": "Çok fazla hatalı deneme yapıldı. Güvenlik nedeniyle 15 dakika sonra tekrar deneyiniz." }`
