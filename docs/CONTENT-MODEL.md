# İçerik Modeli ve Payload CMS Koleksiyonları (Content Model)

Bu doküman, Alte CMS monoreposunda Payload CMS 3 üzerinde kurgulanan içerik mimarisini, koleksiyonları, globalleri ve veri ilişkilerini açıklamaktadır.

---

## 1. Varlık İlişki Diyagramı (Entity-Relationship Diagram)

```mermaid
erDiagram
    USERS ||--o{ POSTS : "yazar (author)"
    MEDIA ||--o{ POSTS : "kapak görseli (coverImage)"
    POST_CATEGORIES ||--o{ POSTS : "kategoriler (categories)"
    MEDIA ||--o{ SITE_SETTINGS : "logo & favicon"
    PAGES ||--|| PAGES : "isHome (tekil ana sayfa)"

    USERS {
        string id PK
        string email "Staff email (gizli)"
        string name "Ad Soyad"
        string role "super-admin | admin | shop-manager | editor"
    }

    MEDIA {
        string id PK
        string filename "Benzersiz slugify dosya adı"
        string mimeType "jpeg, png, webp, avif (SVG yasak)"
        number filesize "Max 5 MB"
        string alt "Zorunlu SEO/Erişilebilirlik metni"
    }

    POST_CATEGORIES {
        string id PK
        string title "Kategori adı"
        string slug "Benzersiz URL yolu"
        string description "Açıklama"
    }

    POSTS {
        string id PK
        string title "Yazı başlığı"
        string slug "Benzersiz URL yolu"
        string excerpt "Özet metni"
        json content "Lexical RichText AST"
        number readingTime "Otomatik okuma süresi (dk)"
        string _status "draft | published"
    }

    PAGES {
        string id PK
        string title "Sayfa başlığı"
        string slug "Benzersiz URL yolu"
        boolean isHome "Tekil ana sayfa bayrağı"
        json puckData "Doğrulanmış Puck blok verisi"
        string _status "draft | published"
    }

    REDIRECTS {
        string id PK
        string from "Eski URL yolu (/...)"
        string to "Yeni hedef URL (/... veya https://...)"
        string type "301 (kalıcı) | 302 (geçici)"
    }
```

---

## 2. Koleksiyon Detayları

### 2.1. Pages (Sayfalar)

- **Taslak Yönetimi (Drafts)**: Etkin. Yayınlanmamış taslaklar arama motorlarına ve ziyaretçilere kesinlikle kapalıdır (404 döner).
- **isHome Kontrolü**: Bir sayfa `isHome: true` olarak işaretlendiğinde, veritabanındaki diğer tüm sayfaların `isHome` değeri `beforeChange` hook'u ile otomatik kaldırılır.
- **Puck Verisi**: `puckData` alanı Zod şeması ile sunucuda doğrulanır (max 512 KB, max 200 bileşen, max 6 derinlik).
- **SEO Grubu**: `metaTitle` (60 krk önerisi), `metaDescription` (160 krk önerisi), `ogImage`, `canonicalUrl` (safeHref kontrollü), `noIndex` bayrağı.

### 2.2. Posts (Blog Yazıları)

- **İçerik Editörü**: Lexical zengin metin düzenleyici (başlıklar, listeler, alıntılar, görsel ve güvenli linkler).
- **Okuma Süresi (readingTime)**: Kelime adedine göre (~200 kelime/dk, en az 1 dk) hook aracılığıyla otomatik hesaplanır.
- **Yazar İlişkisi (Author)**: `Users` koleksiyonuna bağlıdır. Field-level erişim kontrolü sayesinde ziyaretçilere yalnızca yazarın adı (`author.name`) döner; e-posta (`author.email`) vitrine veya açık REST uçlarına **asla sızmaz**.

### 2.3. PostCategories (Blog Kategorileri)

- Blog yazılarını tematik olarak gruplar (örn: _Stil Rehberi_, _Kumaş & Bakım_, _Koleksiyon Hikayeleri_).
- Otomatik slug üretimi (`beforeValidate`).

### 2.4. Redirects (Yönlendirmeler)

- `from`: Tek bir `'/'` ile başlamak zorundadır.
- `to`: İç bağlantı (`/...`) veya güvenli dış bağlantı (`https://...`).
- **Döngü Koruması**:
  - Kendine yönlendirme ($A \to A$) kesinlikle engellenir.
  - Çok adımlı döngüsel zincirler ($A \to B \to C \to A$) `isCircularRedirect` hook'u ile algılanır ve kaydetme reddedilir.

---

## 3. Globals Detayları

### 3.1. SiteSettings (Site Ayarları)

- `storeName`: Varsayılan: `"Çisem Elif Boz"`.
- `storeDescription`: Mağaza tanıtım sloganı.
- `contactEmail`, `contactPhone`, `address`.
- `logo`, `favicon`: Media koleksiyonuna bağlı raster görseller.
- `socialMedia`: Instagram, Facebook, X (Twitter), YouTube güvenli bağlantıları.
- **Erişim**: Yalnızca `admin` ve `super-admin` güncelleyebilir; `editor` güncelleyemez.

### 3.2. Navigation (Menü & Navigasyon)

- `headerMenu`: Üst gezinme bağlantıları ve opsiyonel 2. seviye alt menü öğeleri.
- `footerMenu`: Kolon başlıklı alt menü grupları (örn: Kurumsal, Kategoriler).
- **Bağlantı Doğrulaması**: Tüm bağlantılar `validateSafeHrefField` ile denetlenir.
- **Erişim**: Yalnızca `admin` ve `super-admin` güncelleyebilir; `editor` güncelleyemez.
