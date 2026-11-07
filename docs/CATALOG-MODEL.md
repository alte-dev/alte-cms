# WooCommerce - Medusa v2 Katalog Modeli ve Kavram Eşlemesi

Bu doküman, WooCommerce mimarisinden Medusa v2 e-ticaret motoruna geçişte katalog, ürün tipleri, taksonomi ve envanter kavramlarının teknik eşlemesini belgeler.

---

## 1. Kavram Karşılaştırma Matrisi

| WooCommerce Kavramı                    | Medusa v2 Karşılığı                                    | Açıklama & Mimari Fark                                                                                                                                                                                                                                                   |
| :------------------------------------- | :----------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Simple Product** (Basit Ürün)        | `Product` + 1 `ProductVariant`                         | Medusa v2'de her ürünün en az bir varyantı bulunur. Basit ürünlerde "Varsayılan" / "Standart" tek bir varyant kullanılır.                                                                                                                                                |
| **Variable Product** (Varyantlı Ürün)  | `Product` + `ProductOption` + N `ProductVariant`       | Beden, Renk gibi ürün seçenekleri (`ProductOption`) tanımlanır ve varyantlar bu seçeneklerin kombinasyonları (`ProductOptionValue`) ile oluşturulur.                                                                                                                     |
| **Product Category** (Ürün Kategorisi) | `ProductCategory` (Hiyerarşik)                         | Ağaç yapısında (`parent_category_id`) organize edilir. URL slug'ları Türkçe karakterlerden arındırılmış temiz ASCII biçimindedir (örn. `ust-giyim`).                                                                                                                     |
| **Product Tag** (Ürün Etiketi)         | `ProductTag`                                           | Düz, hiyerarşisiz etiketleme sistemi (örn. `organik`, `yeni-sezon`).                                                                                                                                                                                                     |
| **Product Collection** (Koleksiyon)    | `ProductCollection`                                    | Pazarlama ve vitrin odaklı ürün gruplamaları (örn. `Yeni Gelenler`, `İndirimdekiler`).                                                                                                                                                                                   |
| **Product Attributes** (Öznitelikler)  | `ProductOption` & `metadata`                           | Varyant oluşturan öznitelikler `ProductOption` olarak; teknik/filtreleme özellikleri ise `metadata` key-value olarak saklanır.                                                                                                                                           |
| **Sale Price** (İndirimli Fiyat)       | `PriceList` (Tip: `sale`)                              | WooCommerce'te ürün satırında `regular_price` ve `sale_price` varken; Medusa v2'de fiyatlar `Pricing Module` ve bağımsız `PriceList` motoruyla yönetilir. Ürünün orijinal fiyatı bozulmaz, indirim fiyat listesi eşleştiğinde `calculated_price < original_price` döner. |
| **Stock Management** (Stok Yönetimi)   | `Inventory Module` (`InventoryItem` + `LocationLevel`) | Çok depolu bağımsız envanter mimarisi. Stoklar doğrudan ürün tablosunda değil; "Ana Depo" stok konumuna bağlı `InventoryItem` kayıtlarında `stocked_quantity` olarak tutulur.                                                                                            |
| **Sales Channel** (Satış Kanalı)       | `SalesChannel`                                         | Tek mağaza mimarisinde "Web Mağaza" ana satış kanalı olarak atanır. Ürünler ve API anahtarları bu kanala bağlanır.                                                                                                                                                       |

---

## 2. Ürün ve Varyant Yapısı

### 2.1 Basit Ürün (Simple Product)

Medusa v2'de bağımsız varyantsız ürün modeli bulunmaz. Tekil ürünler şu şekilde modellenir:

```json
{
  "title": "Ketene Gömlek",
  "handle": "keten-gomlek",
  "status": "published",
  "options": [{ "title": "Varsayılan", "values": ["Standart"] }],
  "variants": [
    {
      "title": "Standart",
      "sku": "KTN-GMLK-STD",
      "manage_inventory": true,
      "allow_backorder": false,
      "options": { "Varsayılan": "Standart" },
      "prices": [{ "currency_code": "try", "amount": 450 }]
    }
  ]
}
```

### 2.2 Varyantlı Ürün (Variable Product)

Birden fazla varyant (ör. Renk x Beden matrisi):

```json
{
  "title": "Oversize T-Shirt",
  "handle": "oversize-t-shirt",
  "options": [
    { "title": "Renk", "values": ["Siyah", "Beyaz"] },
    { "title": "Beden", "values": ["S", "M", "L"] }
  ],
  "variants": [
    {
      "title": "Siyah / S",
      "sku": "OVR-TSH-SI-S",
      "manage_inventory": true,
      "options": { "Renk": "Siyah", "Beden": "S" },
      "prices": [{ "currency_code": "try", "amount": 250 }]
    }
  ]
}
```

---

## 3. Taksonomi ve Kategori Ağacı

Kategoriler hiyerarşik yapıda kurulur:

- **Giyim** (`/kategori/giyim`)
  - **Üst Giyim** (`/kategori/ust-giyim`) - `parent_category_id: giyim.id`
  - **Alt Giyim** (`/kategori/alt-giyim`) - `parent_category_id: giyim.id`
- **Aksesuar** (`/kategori/aksesuar`)
- **Ev & Yaşam** (`/kategori/ev-yasam`)

### Türkçe Slug Normalizasyonu

Tüm URL slug'ları `normalizeTurkishSlug()` yardımcı fonksiyonu ile dönüştürülür:
`ç->c`, `ğ->g`, `ı->i`, `ö->o`, `ş->s`, `ü->u`, büyük harfler küçültülür, özel karakterler tire (`-`) yapılır.

---

## 4. Stok ve Depo Yönetimi

1. **Ana Depo Konumu:** `sloc_...` (İstanbul, Türkiye adresi ile tanımlanır).
2. **Envanter Öğeleri (`InventoryItem`):** Her varyant için otomatik oluşturulur veya bağlanır.
3. **Stok Seviyesi (`LocationLevel`):** `Ana Depo` üzerinde `stocked_quantity` (örn. 50 adet) tanımlanır.
4. **Stoksuz Ürün Güvenliği:** `allow_backorder: false` ve `manage_inventory: true` olduğu sürece, stokta olmayan (0 adet) veya yetersiz miktardaki sepete ekleme istekleri Medusa v2 tarafından `HTTP 400 (insufficient_inventory)` hatasıyla kesin olarak reddedilir (Fail-Closed).

---

## 5. İndirimli Fiyat Motoru (Sale Price Lists)

WooCommerce'deki tekil indirim alanı yerine Medusa v2'nin `PriceList` yeteneği kullanılır:

- **Tür:** `type: "sale"`
- **Durum:** `status: "active"`
- **Fiyatlar:** Varyant bazında TRY para birimiyle tanımlanır.
- **İstemci Çıktısı:** Storefront API'de `calculated_price` (indirimli fiyat) ve `original_price` (orijinal fiyat) ayrı ayrı sunulur:
  ```json
  {
    "calculated_amount": 200,
    "original_amount": 250,
    "is_calculated_price_price_list": true
  }
  ```
