# Ürün Arama Mimarisi ve Tasarım Kararları (SEARCH.md)

Bu doküman, e-ticaret platformunda ürün arama ve filtreleme altyapısının teknik kararlarını, mimari gerekçelerini ve Türkçe dil desteği stratejisini açıklar.

---

## 1. Mimari Karar: Neden Harici Arama Motoru Yok?

Modern e-ticaret projelerinde Meilisearch, Elasticsearch veya Typesense gibi harici arama servisleri sıkça tercih edilir. Ancak bu projede **harici bir arama motoru kullanılmaması ve doğrudan PostgreSQL'in yerleşik arama yeteneklerinden (`unaccent` + `pg_trgm` + `to_tsvector`) yararlanılması** bilinçli bir mimari tercihtir.

### Temel Gerekçeler:

1. **Katı Bellek (RAM) Bütçesi (~1100 MB Toplam Sınır)**:

   - Projenin toplam bellek bütçesi: Medusa backend için **512 MB**, Next.js vitrin için **384 MB**, veritabanı ve Redis ile birlikte toplam **~1100 MB**'dir.
   - Elasticsearch en az 1-2 GB RAM gerektirir; Typesense veya Meilisearch ise ek 256–512 MB taban bellek tüketir.
   - Harici bir servis eklemek bellek bütçesini anında aşar ve sunucu maliyetini katlar.

2. **Sıfır Senkronizasyon Gecikmesi & ACID Tutarlılığı**:

   - Harici motorlarda ürün eklendiğinde, fiyat veya stok değiştiğinde indeks senkronizasyonu (webhook, CDC veya kuyruk ile) gerekir. Senkronizasyon kesintiye uğradığında müşteriler stokta olmayan veya fiyatı değişmiş ürünleri görür.
   - PostgreSQL üzerinde arama yapıldığında arama indeksi ve ürün tablosu aynı işlemsel (transactional) sınır içindedir. Ürün güncellendiği veya gizlendiği (`metadata.hidden = true`, `SERVICE-COD-FEE`) anda arama sonuçları anında ve gecikmesiz olarak tutarlıdır.

3. **Operasyonel Sadelik ve Güvenilirlik**:
   - Ayrı bir arama sunucusu çalıştırmak; yedekleme, izleme, sürüm yükseltmeleri, ağ bağlantı kesintileri ve potansiyel tek arıza noktası (SPOF) demektir.
   - Tek bir PostgreSQL veritabanı ile tüm arama ve sorgulama ihtiyaçları karşılanır.

---

## 2. PostgreSQL Arama Motoru Mimarisi

Arama sistemi üç ana bileşenden oluşur:

```
                            [ Müşteri Araması (Vitrin /ara veya Autocomplete) ]
                                                   │
                                                   ▼
                                       [ Rate Limiter (60 req/min) ]
                                                   │
                                                   ▼
                                    [ Input Sanitization & Validation ]
                                 (Length 2-100, Wildcard Escape %, _)
                                                   │
                                                   ▼
                                  [ Medusa v2: GET /store/search ]
                                                   │
                                                   ▼
            ┌──────────────────────────────────────┴──────────────────────────────────────┐
            ▼                                                                             ▼
   [ Trigram Benzerlik (pg_trgm) ]                                              [ Tam Metin Arama (tsvector) ]
  - Yazım hatalarını tolere eder (Fuzzy)                                        - Alaka düzeyi puanlaması (ts_rank)
  - `similarity()` veya `%` operatörü                                           - Başlık > SKU > Açıklama ağırlıkları
  - GIN / GiST indeksi ile O(log N)                                            - `unaccent` ile aksan ve harf normalizasyonu
            └──────────────────────────────────────┬──────────────────────────────────────┘
                                                   │
                                                   ▼
                                 [ Filtreler & Güvenlik Kalkanı ]
                            - Yalnızca `status = 'published'`
                            - `metadata.hidden` ve `SERVICE-COD-FEE` HARİÇ
                            - Kategori, Fiyat Aralığı ve Stok Filtresi
                                                   │
                                                   ▼
                                  [ Fiyat & Bölge Hesaplanmış Yanıt ]
```

### Kullanılan PostgreSQL Eklentileri:

- **`unaccent`**: Aksanları, şapkaları ve aksanlı harfleri normalize eder (ör. `ö` -> `o`, `ç` -> `c`).
- **`pg_trgm`**: Trigram benzerlik araması ve GIN indeksi sağlar. Hem kelime içi aramalarda (`LIKE '%term%'`) hem de yazım hatalarında (ör. "elbse" -> "elbise") milisaniye altı hız sunar.
- **Yetkisiz (Non-Superuser) DB Kullanıcısı Davranışı**: `search-indexes` modül migrasyonu (`apps/medusa/src/modules/search-indexes/migrations/Migration20261110120000.ts`) ve `apps/medusa/src/loaders/search-indexes.ts`, `CREATE EXTENSION` yetkisi olmayan bir DB kullanıcısıyla çalıştırıldığında `insufficient_privilege` durumunu yakalayarak açık bir Runbook logu yazar. Kısıtlı yetkili üretim veritabanlarında `pg_trgm` ve `unaccent` eklentileri migrasyon öncesinde DBA (`postgres` superuser) tarafından `CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS unaccent;` komutlarıyla etkinleştirilmelidir (bkz. `docs/RUNBOOK.md`).

---

## 3. Türkçe Karakter ve Harf Eşleştirme Stratejisi

Türkçe dilinin en bilinen arama ve sıralama tuzağı **I/ı** ve **İ/i** harfleridir:

- Küçük `ı` harfinin büyüğü `I`'dır (İngilizce `I` ile çakışır).
- Küçük `i` harfinin büyüğü `İ`'dir.
- Standart PostgreSQL `lower()` veya `ILIKE` sorguları Türkçe yerel ayar (tr_TR) olmadan çalıştırıldığında `IŞIK` araması `ışık` kelimesini eşleştiremeyebilir veya `isik` yazıldığında bulunamaz.

### Çözümümüz:

1. **İki Aşamalı Normalizasyon**:
   - Arama sorgusu ve indekslenen metinler önce Türkçe harf duyarlı normalizasyondan geçirilir:
     - `İ` -> `i`, `I` -> `ı`, `ı` -> `i` (fonetik tolerans)
     - `ç` -> `c`, `ğ` -> `g`, `ö` -> `o`, `ş` -> `s`, `ü` -> `u`
   - Bu sayede kullanıcı `Işık`, `ışık` veya `isik` yazdığında aynı ürün kesin olarak bulunur; `İpek` veya `ipek` aramaları tam eşleşir.
2. **Kombine GIN Trigram İndeksleri**:
   - `product` tablosundaki `title`, `subtitle`, `description`, `handle` alanları ile `product_variant` tablosundaki `sku` alanı üzerinde `gin_trgm_ops` indeksleri tanımlanır.

---

## 4. API Tasarımı (`GET /store/search`)

### Uç Nokta Parametreleri:

| Parametre   | Tip     | Zorunlu? | Sınır / Varsayılan | Açıklama                                         |
| ----------- | ------- | -------- | ------------------ | ------------------------------------------------ |
| `q`         | string  | Evet     | 2 - 100 karakter   | Arama terimi (HTML ve SQL injection temizlenmiş) |
| `category`  | string  | Hayır    | -                  | Kategori handle veya ID filtresi                 |
| `min_price` | number  | Hayır    | >= 0               | Minimum TL fiyat                                 |
| `max_price` | number  | Hayır    | >= 0               | Maksimum TL fiyat                                |
| `in_stock`  | boolean | Hayır    | false              | Yalnızca stoğu olan ürünleri filtreler           |
| `sort`      | string  | Hayır    | `relevance`        | `relevance`, `price_asc`, `price_desc`, `newest` |
| `limit`     | number  | Hayır    | 12 (Maks 48)       | Sayfa başına sonuç sayısı                        |
| `offset`    | number  | Hayır    | 0                  | Sayfalama ötelemesi                              |

### Güvenlik Kuralları:

1. **Gizli Ürün İzolasyonu**: `sku = 'SERVICE-COD-FEE'`, `metadata->>'is_cod_fee' = 'true'` veya `metadata->>'hidden' = 'true'` olan kayıtlar hiçbir koşulda arama sonuçlarına dahil edilmez.
2. **SQL Injection Koruması**: Tüm sorgular Knex / PostgreSQL parametreli bağlayıcıları (`$1, $2` veya `:param`) ile çalıştırılır; string birleştirme (`+`) kesinlikle kullanılmaz. LIKE sorgularında `%` ve `_` karakterleri escape edilir.
3. **Hız Sınırı (Rate Limiting)**: IP başına dakikada maksimum **60 istek**. Sınır aşıldığında HTTP 429 Too Many Requests döndürülür.

---

## 5. Vitrin Entegrasyonu

1. **Header Arama Çubuğu**:
   - `role="search"` ile erişilebilir, klavye kısayolları (`Enter` ile git, `Escape` ile temizle/kapat).
2. **Anlık Öneri (Autocomplete)**:
   - 250 ms debounce ile gereksiz ağ trafiğini önler.
   - En fazla 6 ürün önerir. İstemciye harici ağır kütüphane yüklemez, saf React ve Next.js kullanır.
3. **Arama Sonuçları Sayfası (`/ara`)**:
   - Server-Side Rendered (SSR) çalışır.
   - `robots: { index: false, follow: false }` (`noindex`) tanımlıdır.
   - `sitemap.ts` arama sayfalarını hariç tutar, `robots.ts` içinde `Disallow: /ara` kuralı yer alır.
   - XSS sanitizasyonu: Arama terimi HTML'e basılırken JSX kaçırma mekanizması ile tamamen güvenli hale getirilir.
