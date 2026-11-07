# Sistem Mimarisi (ARCHITECTURE.md)

Bu doküman, tek mağazalı e-ticaret platformunun sistem bileşenlerini, veri sınırlarını, iletişim modellerini ve ortam mimarisini tanımlar.

---

## 1. Temel Sorumluluklar ve Bileşen Ayrımı

Platform iki ana uygulama ve ortak bir kütüphane paketinden (`pnpm monorepo`) oluşur:

```
                      +---------------------------------------+
                      |               İstemci                 |
                      |        (Tarayıcı / Mobil Web)         |
                      +-------------------+-------------------+
                                          |
                        HTTP / JSON       |     HTTP / JSON
                     (Storefront & SSR)   |   (CORS / Cookies)
                                          v
+------------------------------------+         +-------------------------------------+
|              apps/web              |         |             apps/medusa             |
|                                    |         |                                     |
|  - Next.js 15 App Router           |         |  - Medusa v2 Ticaret Motoru         |
|  - Storefront Vitrini              |  HTTP   |  - Tek Doğru Kaynak (Single Source) |
|  - Payload CMS 3 (/admin)          +-------->+  - Ürün, Varyant, Stok, Fiyat       |
|  - Görsel Sayfa Düzenleyici (Puck) | (Loop-  |  - Sepet, Kupon, Vergi, Sipariş     |
|  - Blog, Tema, Sayfa Yönetimi      |  back)  |  - PayTR & Kapıda Ödeme Sağlayıcı   |
|                                    |         |  - Medusa Admin UI (/app)           |
+-----------------+------------------+         +------------------+------------------+
                  |                                               |
                  v                                               v
     +-------------------------+                     +-------------------------+
     |       PostgreSQL        |                     |       PostgreSQL        |
     |   (payload_db, Port 5432)                     |   (medusa_db, Port 5432)|
     +-------------------------+                     +------------+------------+
                                                                  |
                                                                  v
                                                     +-------------------------+
                                                     |      Redis (Port 6379)  |
                                                     | (Kuyruk & Event Bus)    |
                                                     +-------------------------+
```

### 1.1 Medusa v2 (apps/medusa)

- **Tek Doğru Kaynak (Single Source of Truth):** Ürün kataloğu, varyantlar, stok envanteri, sepet mantığı, indirim kuponları, vergi kuralları, kargo ve ödeme akışları yalnızca Medusa üzerinde saklanır ve işlenir.
- **Eklenti Altyapısı:** Ödeme ve kargo entegrasyonları Medusa sağlayıcı arayüzleri (`PaymentProcessor`, `FulfillmentProvider`) üzerinden modüler olarak genişletilir.
- **Veritabanı:** Kendine ait PostgreSQL veritabanı (`medusa_db`).
- **Önbellek & Olay Kuyruğu:** Redis (`redis://127.0.0.1:6379`).

### 1.2 Web & Payload CMS 3 (apps/web)

- **Bilinçli Birleştirme Kararı:** Sunucu RAM bütçesi (~1.1 GB) kısıtlı olduğu için iki ayrı Node.js süreci (biri Next.js, biri Payload) çalıştırmak yerine Payload CMS 3, Next.js uygulamasının `/admin` rotası altında tek bir Node.js sürecinde birleştirilmiştir.
- **Payload CMS 3 Sorumlulukları:**
  - Sabit sayfalar (Hakkımızda, İletişim, KVKK, Mesafeli Satış Sözleşmesi vb.)
  - Görsel sayfa oluşturucu (Puck blokları JSON formatında Payload'da saklanır)
  - Blog, makaleler, duyurular
  - Medya kütüphanesi (Görseller, banner'lar)
  - Header, footer ve navigasyon menüleri
  - SEO meta etiketleri ve şablonları
- **Storefront Sorumlulukları:**
  - SSR (Server-Side Rendering) ile hızlı ilk sayfa yükleme ve SEO
  - Medusa API'si üzerinden ürün listeleme ve sepet arayüzü
  - Türkçe (tr-TR) yerelleştirme, Türk Lirası (₺) ve KDV dahil fiyat gösterimi
- **Kullanıcı & Oturum Ayrımı (Personel vs Müşteri):**
  - **Personel:** Payload CMS `Users` koleksiyonu yalnızca personel içindir (`super-admin`, `admin`, `shop-manager`, `editor`, `author`). Müşteri rolü barındırmaz.
  - **Müşteriler:** Müşteri hesapları, sepet oturumları ve sipariş geçmişi doğrudan Medusa v2 Storefront API üzerinden yönetilir.

---

## 2. Medusa - Payload Veri Sınırı ve Eşleme Modeli

Veri bütünlüğünü korumak için iki sistem arasında veri duplikasyonu **kesinlikle yapılmaz**:

1. **Payload'da Ürün Kopyası Tutulmaz:** Fiyat, stok ve sepet mantığı hiçbir zaman Payload veritabanına kopyalanmaz.
2. **`medusaProductId` Referans Eşlemesi:**
   - Eğer bir ürün için zengin içerikli özel bir iniş sayfası (landing page) veya Puck ile hazırlanmış özel bloklar gerekiyorsa, Payload üzerinde `ProductPages` koleksiyonu açılır.
   - Bu koleksiyonun birincil anahtarı `medusaProductId: string` alanıdır.
   - Storefront, `/urun/[handle]` rotasına gelen istekte önce Medusa'dan ürünün temel verisini (fiyat, stok, varyant) çeker; ardından `medusaProductId` ile Payload'dan ek görsel ve Puck içeriklerini zenginleştirir.

---

## 3. İletişim Yöntemi ve Ağ Haritası

### 3.1 İki Ayrı URL Mimarisi (Windows 11 & Production Uyumlu)

Tarayıcılar ile Node.js sunucusunun loopback çözümleme farklılıklarından ötürü iki ayrı adres yapılandırması kullanılır:

- **İstemci (Tarayıcı) Tarafı:**
  `NEXT_PUBLIC_MEDUSA_URL = http://api.localhost:9000`
  Tarayıcıdan gelen AJAX/Fetch istekleri ve çerezler için CORS başlıkları bu kökene göre düzenlenir.
- **Sunucu Tarafı (SSR, API Handler, Hook'lar):**
  `MEDUSA_BACKEND_URL = http://127.0.0.1:9000`
  Next.js sunucu bileşenleri Medusa'ya doğrudan yerel IP üzerinden erişir; böylece gereksiz DNS sorguları ve olası Windows DNS çözümleme gecikmeleri engellenir.

### 3.2 Yerel Port Haritası

| Port     | Protokol | Servis                                                         | Bağlanılan Adres                        |
| :------- | :------- | :------------------------------------------------------------- | :-------------------------------------- |
| **3100** | HTTP     | `apps/web` (Next.js Storefront & Payload `/admin`)             | `127.0.0.1:3100` / `localhost:3100`     |
| **9000** | HTTP     | `apps/medusa` (Medusa API & `/app` Admin)                      | `127.0.0.1:9000` / `api.localhost:9000` |
| **5432** | TCP      | PostgreSQL 16 (İki ayrı veritabanı: `medusa_db`, `payload_db`) | `127.0.0.1:5432`                        |
| **6379** | TCP      | Redis 7 (Medusa önbellek ve olay kuyruğu)                      | `127.0.0.1:6379`                        |

---

## 4. Ortam Haritası

| Ortam             | Durum                    | Storefront / CMS URL            | Medusa API URL                      | Veritabanı Modeli                   |
| :---------------- | :----------------------- | :------------------------------ | :---------------------------------- | :---------------------------------- |
| **Yerel (Local)** | **AKTİF**                | `http://localhost:3100`         | `http://api.localhost:9000`         | Docker Desktop (Postgres + Redis)   |
| **Staging**       | _Gelecek Planı (Faz 0B)_ | `https://yeni.cisemelifboz.com` | `https://yeni-api.cisemelifboz.com` | Doğrudan Linux Servisleri (systemd) |
| **Production**    | _Gelecek Planı (Faz 0B)_ | `https://www.cisemelifboz.com`  | `https://api.cisemelifboz.com`      | Doğrudan Linux Servisleri (systemd) |

> **Önemli:** Canlı site (`cisemelifboz.com`), DNS kayıtları ve mevcut sunucu ortamına Faz 0'da hiçbir şekilde müdahale edilmez. Tüm alan adı değerleri ortam değişkenleri üzerinden yönetilir; kod içinde sabit alan adı bulunmaz.
