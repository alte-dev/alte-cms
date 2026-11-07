# WooCommerce Geçiş ve Veri Aktarım Planı (MIGRATION-WOOCOMMERCE.md)

Bu doküman, Faz 9'da hayata geçirilecek olan canlı WooCommerce mağazasından yeni platforma geçiş stratejisini, veri eşleme modelini, 301 yönlendirme haritasını, geçiş/geri dönüş (rollback) adımlarını ve canlı siteyi koruma ilkelerini tanımlar.

> ⚠️ **UYARI:** Bu doküman ileriye dönük bir tasarım taslağıdır. Faz 0'da **kesinlikle kodlama yapılmaz** ve canlı siteye (`cisemelifboz.com`) hiçbir şekilde dokunulmaz.

---

## 1. Canlı Siteyi Koruma İlkeleri

1. **Sıfır Doğrudan Bağlantı:** Canlı WooCommerce veritabanına doğrudan yazma veya riskli sorgular yapılmaz.
2. **Korumalı DNS ve Posta Kayıtları:** Geçiş esnasında alan adına ait MX, TXT, SPF ve DKIM kayıtları kesinlikle bozulmayacak, e-posta trafiği kesintiye uğramayacaktır.
3. **Önceden Düşürülmüş TTL:** Geçişten 48 saat önce DNS TTL (Time-to-Live) süresi 300 saniyeye (5 dakika) indirilecek, geçiş sonrası olası bir sorunda anında eski IP'ye geri dönüş (rollback) garanti edilecektir.

---

## 2. Veri Eşleme Modeli (Data Mapping)

| WooCommerce Kaynağı              | Hedef Platform             | Eşleme Yöntemi ve Kurallar                                                                             |
| :------------------------------- | :------------------------- | :----------------------------------------------------------------------------------------------------- |
| **Ürünler (Simple & Variable)**  | Medusa v2 Products         | Başlık, slug/handle, açıklama, stok miktarı ve KDV dahil satış fiyatı aktarılır.                       |
| **Varyantlar (Beden, Renk vb.)** | Medusa Product Variants    | SKU, barkod, fiyat ve envanter seviyesi varyant olarak eşlenir.                                        |
| **Kategoriler & Etiketler**      | Medusa Product Categories  | Hiyerarşik kategori ağacı korunur.                                                                     |
| **Müşteri Hesapları**            | Medusa Customers           | Ad, soyad, e-posta ve kayıtlı teslimat/fatura adresleri aktarılır.                                     |
| **Sipariş Geçmişi**              | Medusa Orders (Historical) | Geçmiş siparişler "arşiv" durumunda, eski sipariş numarası meta veriye eklenerek aktarılır.            |
| **Statik Sayfalar & Blog**       | Payload CMS 3              | Hakkımızda, Gizlilik, İletişim sayfaları ve blog yazıları Payload Pages/Posts koleksiyonuna aktarılır. |

---

## 3. SEO Koruma ve 301 Yönlendirme Haritası

Mevcut sitenin Google ve diğer arama motorlarındaki sıralamalarını kaybetmemek için tüm eski URL yapıları Next.js `next.config.ts` veya Payload yönlendirme tablosu ile kalıcı (301) olarak yönlendirilir:

```typescript
// Gelecekteki 301 Haritası Taslağı
const redirects = [
  // Ürün URL'leri
  { source: "/urun/:slug", destination: "/urun/:slug", permanent: true },
  { source: "/product/:slug", destination: "/urun/:slug", permanent: true },

  // Kategori URL'leri
  { source: "/urun-kategorisi/:slug", destination: "/kategori/:slug", permanent: true },
  { source: "/kategori/:slug", destination: "/kategori/:slug", permanent: true },

  // Kurumsal Sayfalar
  { source: "/hakkimizda", destination: "/hakkimizda", permanent: true },
  { source: "/iletisim", destination: "/iletisim", permanent: true },
  {
    source: "/mesafeli-satis-sozlesmesi",
    destination: "/sayfalar/mesafeli-satis-sozlesmesi",
    permanent: true,
  },

  // Sepet & Hesap
  { source: "/sepet", destination: "/sepet", permanent: true },
  { source: "/odeme", destination: "/odeme", permanent: true },
  { source: "/hesabim/:path*", destination: "/hesabim/:path*", permanent: true },
];
```

---

## 4. Geçiş ve Geri Dönüş (Rollback) Adımları

```
+---------------------------------------------------------------------------------+
|                                 GEÇİŞ ADIMLARI                                  |
+---------------------------------------------------------------------------------+
  1. DNS TTL Süresini 300 saniyeye düşür (Geçişten 48 saat önce)
  2. WooCommerce Mağazasını "Bakım Modu"na al (Sipariş alımını dondur)
  3. WooCommerce REST API üzerinden son delta ürün/müşteri/sipariş dökümünü al
  4. Aktarım script'ini Staging ortamında çalıştır ve veri bütünlüğünü doğrula
  5. DNS A kaydını yeni sunucu IP'sine yönlendir
  6. Canlıda PayTR 1 TL test işlemi ile ödeme ve callback akışını doğrula
  7. Bakım modunu kaldır ve yeni platformu yayına al

+---------------------------------------------------------------------------------+
|                          GERİ DÖNÜŞ (ROLLBACK) PLANI                            |
+---------------------------------------------------------------------------------+
  * Beklenmeyen kritik bir hata durumunda:
    1. DNS A kaydını derhal eski WooCommerce sunucu IP'sine geri çevir (TTL: 5 dk).
    2. WooCommerce üzerindeki bakım modunu kaldır.
    3. Geçiş süresince yeni sistemde açılmış olası siparişleri manuel olarak eski sisteme işle.
```

---

## 5. Açık Sorular ve Doğrulanması Gerekenler

- [ ] **Müşteri Parola Hash Uyumluluğu (Doğrulanması gereken):** WordPress `phpass` (MD5/Blowfish türevi) parola hash mekanizmasını kullanırken, Medusa v2 modern `scrypt` veya `bcrypt` kullanır. Parolaların taşınması teknik olarak mümkün olmayabilir.
  - _Önerilen Çözüm:_ Müşterilere geçiş anında "Güvenlik altyapımız yenilendi, lütfen yeni şifrenizi belirleyin" başlıklı tek tıkla şifre belirleme bağlantısı gönderilmesi.
- [ ] **Eski Görsel URL'leri:** WooCommerce üzerindeki `/wp-content/uploads/` görsellerinin yeni medya kütüphanesine aktarılması ve kırık görsel kalmaması için görsel eşleme script'inin doğrulanması.
