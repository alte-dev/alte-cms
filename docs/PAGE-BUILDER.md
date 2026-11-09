# Görsel Sayfa Oluşturucu Mimarisi (Puck Visual Page Builder)

Bu doküman, Alte CMS monoreposunda Next.js 15 App Router ve Payload CMS 3 ile entegre edilen görsel sayfa oluşturucu (Puck) altyapısını, bileşen kütüphanesini ve güvenlik modelini açıklamaktadır.

---

## 1. Mimari ve Bundle İzolasyonu

Puck düzenleyicisi (`@puckeditor/core@0.23.0`), vitrin (storefront) performansını korumak ve bundle boyutunu minimumda tutmak için tamamen ayrıştırılmıştır:

- **Editör Rotası (`/admin/puck/[id]`)**: Yalnızca yetkili mağaza personeline açıktır (`super-admin`, `admin`, `editor`, `shop-manager`). Editör arayüzü ve sürükle-bırak motoru burada dinamik olarak yüklenir.
- **Vitrin Sunucu Tarafı Render (`RenderPuckContent`)**: Vitrin rotalarında (`/` ve `/sayfa/[slug]`) `@puckeditor/core` editör kütüphanesi **asla import edilmez**. Puck JSON ağacı doğrudan saf React sunucu bileşenleri (RSC) ile render edilir.
- **Bundle Audit Kanıtı**: Next.js derleme çıktısında vitrin sayfalarının JavaScript boyutu ~107-109 kB bandında kalırken, Puck editör kodu (177 kB) yalnızca `/admin/puck/[id]` rotasında izole edilmiştir. Vitrin koduna 0 bayt editör yükü sızmaktadır.

---

## 2. Bileşen Kütüphanesi (14 Temel Bileşen)

| Bileşen            | Kategori       | Açıklama                                              | Başlıca Özellikler (Props)                                                                                                                 |
| ------------------ | -------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Hero`             | Bölüm / Banner | Ana başlık, alt başlık ve 1-2 eylem butonu (CTA)      | `title`, `subtitle`, `bgImage`, `bgColor`, `align`, `primaryButtonText`, `primaryButtonHref`, `secondaryButtonText`, `secondaryButtonHref` |
| `RichText`         | İçerik         | Zengin metin bloğu ve paragraflar                     | `content`, `maxWidth` (`prose`, `prose-lg`, `full`)                                                                                        |
| `ImageBlock`       | Medya          | Tekil görsel, altyazı, hizalama ve opsiyonel bağlantı | `src`, `alt`, `caption`, `align`, `linkHref`                                                                                               |
| `Columns`          | Düzen          | 2, 3 veya 4 sütunlu esnek grid sistemi                | `columns` (2/3/4), her kolon için `title` ve `content`                                                                                     |
| `Spacer`           | Boşluk         | Dikey boşluk bırakıcı                                 | `height` (`small`: 32px, `medium`: 64px, `large`: 96px, `xlarge`: 144px)                                                                   |
| `Divider`          | Ayırıcı        | Yatay çizgi ayırıcı                                   | `style` (`solid`, `dashed`, `dotted`)                                                                                                      |
| `Accordion`        | Etkileşimli    | SSS ve açılır-kapanır paneller                        | `q1`, `a1`, `q2`, `a2`, `q3`, `a3` soru-cevap çiftleri                                                                                     |
| `Banner`           | Duyuru         | İndirim, kampanya veya bildirim bandı                 | `text`, `style` (`accent`, `success`, `info`, `warning`), `linkText`, `linkHref`                                                           |
| `ContactInfo`      | İletişim       | Müşteri hizmetleri ve mağaza iletişim kartı           | `title`, `email`, `phone`, `address`, `workingHours`                                                                                       |
| `ProductGrid`      | E-Ticaret      | Medusa ürünlerini listeleyen ızgara                   | `title`, `limit`                                                                                                                           |
| `FeaturedProducts` | E-Ticaret      | Öne çıkan koleksiyon parçaları                        | `title`, `subtitle`                                                                                                                        |
| `CategoryList`     | E-Ticaret      | Mağaza kategorilerine hızlı erişim kartları           | `title`                                                                                                                                    |
| `FreeShippingBar`  | E-Ticaret      | Kargo bedava limiti bilgilendirme çubuğu              | `threshold`, `message`                                                                                                                     |
| `LatestPosts`      | Blog           | Blogdan son yayınlanan yazıları çeken blok            | `title`, `limit`                                                                                                                           |

---

## 3. Güvenlik Kısıtları & Doğrulama (Zod & safeHref)

Puck'tan üretilen her veri yapısı sunucu tarafında (`validatePuckData` ve `PuckDataZodSchema`) sıkı kontrollere tabi tutulur:

1. **Yük Boyutu Sınırı**: JSON boyutu maksimum **512 KB** olabilir. Bu sınırı aşan yükler 400 Bad Request ile reddedilir.
2. **Bileşen Adedi Sınırı**: Bir sayfada en fazla **200 adet** bileşen yer alabilir (DoS koruması).
3. **İç İçe Geçme Derinliği Sınırı**: Maksimum derinlik **6 seviye** ile sınırlandırılmıştır (Call stack overflow önleme).
4. **Bileşen Whitelist Kontrolü**: Yalnızca `ALLOWED_PUCK_COMPONENTS` listesindeki 14 bileşen kabul edilir. İzin verilmeyen veya enjekte edilmiş bileşen tipleri derhal reddedilir.
5. **Bağlantı Güvenliği (`safeHref`)**: Tüm buton ve bağlantı alanlarında yalnızca `'/'` ile başlayan göreli iç yollar veya `'https://'` ile başlayan güvenli harici adresler kabul edilir. `javascript:`, `data:`, `vbscript:`, `//`, `\\` gibi XSS ve protokol hileleri kesinlikle engellenir.
6. **Sıfır `dangerouslySetInnerHTML`**: Hiçbir Puck bileşeni ham HTML basmaz; tüm içerikler React'ın dahili güvenli metin escaping mekanizmasıyla ekrana aktarılır.

---

## 4. Yeni Bileşen Ekleme Rehberi

Yeni bir bileşen eklemek için izlenecek 4 adım:

1. **Bileşeni Tanımlayın** (`apps/web/src/lib/puck/components.tsx`):
   ```tsx
   export interface CustomBlockProps {
     title?: string;
   }
   export function CustomBlockComponent({ title }: CustomBlockProps) {
     return <div className="p-4">{title}</div>;
   }
   ```
2. **Whitelist'e Ekleyin** (`apps/web/src/lib/puck/schema.ts`):
   `ALLOWED_PUCK_COMPONENTS` dizisine `"CustomBlock"` ekleyin.
3. **Storefront Haritasına Ekleyin** (`apps/web/src/lib/puck/render.tsx`):
   `COMPONENT_MAP` nesnesine `CustomBlock: CustomBlockComponent` bağlayın.
4. **Editör Konfigürasyonuna Ekleyin** (`apps/web/src/lib/puck/config.tsx`):
   `puckConfig.components` altına bileşenin etiketini, alanlarını (`fields`) ve render fonksiyonunu kaydedin.
