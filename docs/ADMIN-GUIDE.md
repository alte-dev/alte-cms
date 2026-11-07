# Medusa v2 Yönetici Kılavuzu (ADMIN-GUIDE.md)

Bu kılavuz, **Medusa v2 Admin Paneli** (`http://127.0.0.1:9000/app` veya `http://api.localhost:9000/app`) üzerinden e-ticaret mağazasının temel operasyonlarını kod yazmadan nasıl yöneteceğinizi adım adım açıklar.

---

## 1. Kargo Ücreti ve Ücretsiz Kargo Eşiği Yönetimi

### 1.1 Kargo Seçeneklerini Görüntüleme

1. Sol menüden en alttaki **Settings (Ayarlar)** dişli simgesine tıklayın.
2. **Locations & Shipping (Konumlar ve Kargo)** sekmesini seçin.
3. Listeden mağazanın aktif lokasyonuna (**"Ana Depo"**) tıklayın.
4. **Fulfillment Sets / Service Zones** alanında **"Türkiye Teslimat"** bölgesini açın.
5. Tanımlı 3 kargo seçeneğini göreceksiniz:
   - **Standart Kargo** (89.90 TL sabit ücret)
   - **Mağazadan Teslim** (0.00 TL)
   - **Ücretsiz Kargo** (1500 TL ve üzeri sepetler için 0.00 TL)

### 1.2 Kargo Ücretini Değiştirme

1. Değiştirmek istediğiniz kargonun yanındaki üç nokta (**`...`**) menüsüne tıklayın ve **"Edit" (Düzenle)** seçeneğini seçin.
2. Açılan çekmecede (Drawer) **Price** alanındaki tutarı güncelleyin.
3. **"Save" (Kaydet)** butonuna tıklayın.

### 1.3 Ücretsiz Kargo Eşiğini Değiştirme (1500 TL Kuralı)

- **Admin Panel Analizi:** Medusa v2 Admin panelinde kargo seçenekleri için _"Conditional Prices / Cart item total"_ kural motoru mevcuttur. Ancak doğrudan kargo kuralının (shipping option rule) eşik değerini değiştirmek için:
  - Panelde: Kargo seçeneğinin yanındaki **`...`** menüsünden **"Edit Rules" (Kuralları Düzenle)** veya **"Conditional Prices"** ekranını açın; `Cart item total` (`item_total`) `>=` değerini güncelleyin.
  - Kod / Konfigürasyon Yoluyla: Sabit varsayılan eşik `apps/medusa/src/config/store-defaults.ts` içerisinde `min_subtotal: 1500` olarak yer alır. `setup:store` çalıştırıldığında bu kural Medusa veritabanına otomatik işlenir.
  - Vitrin Dinamizmi: Vitrin ve sepet bu eşiği **asla sabit kodlamaz**; Medusa'dan dönen `item_total >= X` kuralını dinamik okuyarak _"Ücretsiz kargo için X TL daha ekleyin"_ göstergesini hesaplar.

---

## 2. KDV Oranları ve Vergi Ayarları

### 2.1 Mevcut KDV Oranları

Türkiye mevzuatına uygun olarak 3 KDV oranı tanımlıdır:

- **Standart KDV (%20):** Varsayılan oran (`KDV20`).
- **Gıda / Tekstil KDV (%10):** İndirimli oran (`KDV10`).
- **Temel Gıda / Kitap KDV (%1):** Özel indirimli oran (`KDV1`).

### 2.2 Vergi Oranlarını Görüntüleme ve Güncelleme

1. **Settings → Tax Regions (Vergi Bölgeleri)** bölümüne gidin.
2. **"Türkiye"** bölgesini seçin.
3. `Tax Rates` listesinde %20, %10 ve %1 oranlarını göreceksiniz.
4. Yeni bir vergi oranı eklemek için **"Create Tax Rate"** butonuna tıklayın; oran yüzdesini ve vergi kodunu girin.
5. Fiyatların KDV dahil olup olmadığı ayarı **Price Preferences** üzerinden `is_tax_inclusive = true` olarak yönetilmektedir.

---

## 3. Ürüne KDV Sınıfı (Product Type) Atama

Medusa v2'de farklı KDV oranları vergi kuralları (Tax Rate Rules) ile **Product Type**'lara bağlanmıştır:

- `food` tipi ürünler: otomatik **%10 KDV** alır.
- `basic-food` / `book` tipi ürünler: otomatik **%1 KDV** alır.
- Tipi atanmamış veya diğer tipler: varsayılan **%20 KDV** alır.

### 3.1 Ürünün KDV Tipini Belirleme

1. Sol menüden **Products (Ürünler)** sayfasına gidin.
2. Düzenlemek istediğiniz ürünü seçin.
3. Sağ üstteki **"Edit" (Düzenle)** veya Genel Bilgiler kartındaki **"Organize" (Düzenle)** butonuna tıklayın _(ekran adı sürüme göre farklılık gösterebilir - doğrulanmadı)_.
4. **Type (Tip)** alanında:
   - Gıda / Tekstil ürünü ise `food`,
   - Temel gıda veya kitap ise `basic-food`,
   - Normal ürün ise boş bırakın veya `standard` seçin.
5. Değişiklikleri kaydedin.

---

## 4. Depo Adresi ve Stok Yönetimi

### 4.1 Depo Adresini Güncelleme

1. **Settings → Locations & Shipping → "Ana Depo"** kartına tıklayın.
2. Adres kartında **"Edit Address"** butonuna tıklayın.
3. Adres, şehir (İstanbul), posta kodu ve ülke (`TR`) bilgilerini güncelleyin.

### 4.2 Ürün Stoklarını Güncelleme

1. **Inventory (Envanter)** veya doğrudan **Products → [Ürün Seçimi]** sayfasına gidin.
2. Varyantlar listesinde ilgili varyantın (ör. _Beden M / Siyah_) üzerine tıklayın.
3. **Inventory / Stock Locations** bölümünde **"Ana Depo"** altındaki `In Stock` (Mevcut Stok) miktarını düzenleyin.
4. Bir varyantın stoğu **0** olduğunda ve `allow_backorder: false` seçildiğinde vitrin otomatik olarak _"Tükendi"_ uyarısı verir ve sepete eklemeyi engeller (HTTP 400 `insufficient_inventory`).

---

## 5. İndirimli Fiyat (Sale Price List) Yönetimi

Medusa v2'de WooCommerce'teki "İndirimli Satış Fiyatı" mekanizması **Price List** modülüyle yönetilir.

### 5.1 Yeni Bir İndirim Kampanyası Başlatma

1. Sol menüden **Pricing (Fiyatlandırma)** sekmesine gidin.
2. **"Create Price List" (Fiyat Listesi Oluştur)** butonuna tıklayın.
3. Bilgileri girin:
   - **Title (Başlık):** Örn. _"Yaz İndirimi"_,
   - **Description (Açıklama):** Kampanya detayları,
   - **Type (Tür):** `Sale` (İndirim),
   - **Status (Durum):** `Active` (Etkin).
4. İndirime dahil edilecek ürünleri ve indirimli TRY fiyatlarını belirleyin.
5. Kampanya başlangıç/bitiş tarihlerini opsiyonel olarak ayarlayın ve kaydedin.
6. Vitrin, `calculated_price` motoru sayesinde eski fiyatı üstü çizili, yeni indirimli fiyatı ise vurgulu olarak otomatik gösterecektir.

---

## 6. Kategori ve Koleksiyon Yönetimi

### 6.1 Kategoriler (Hiyerarşik Ağaç)

1. **Products → Categories (Kategoriler)** sayfasına gidin.
2. Hiyerarşik ağaç yapısını göreceksiniz:
   - **Giyim**
     - Üst Giyim
     - Alt Giyim
   - **Aksesuar**
   - **Ev & Yaşam**
3. Yeni bir alt kategori eklemek için üst kategorinin yanındaki **"+"** butonuna basın.
4. Kategori adı ve slug bilgisini girin (Türkçe karakterler sistem tarafından URL dostu ASCII slug'a normalize edilir).

### 6.2 Koleksiyonlar (Kampanya / Dönem Gruplamaları)

1. **Products → Collections (Koleksiyonlar)** sayfasına gidin.
2. Tanımlı koleksiyonlar:
   - **Yeni Gelenler** (Anasayfa vitrininde listelenir)
   - **İndirimdekiler**
3. Yeni bir koleksiyon oluşturmak için **"Create Collection"** butonuna tıklayın ve ürünleri koleksiyona atayın.

---

## 7. Promosyonlar ve Kupon Kodları Yönetimi (Promotions)

Medusa v2 Admin panelinde promosyonlar **Promotions** sekmesinden yönetilir.

### 7.1 Kupon Kodu Oluşturma

1. Sol menüden **Promotions (Promosyonlar)** sayfasına gidin.
2. **"Create Promotion"** butonuna tıklayın.
3. Promosyon tipini seçin:
   - **Standard Promotion:** Kupon kodu girilerek uygulanan promosyon.
   - **Automatic Promotion:** Koşullar sağlandığında sepete otomatik uygulanan promosyon.
4. **Promotion Code:** Müşterinin sepet/ödeme adımında gireceği kodu belirleyin (Örn: `TEST10`, `BAHAR2026`).
5. **Application Method:**
   - **Percentage:** Yüzdelik indirim (örn: %10).
   - **Fixed:** Sabit tutar indirimi (örn: 50 TL - `currency_code: try`).
6. **Allocation:** İndirimin tüm sepete mi (`across_items`) yoksa her bir kaleme mi (`each_item`) uygulanacağını belirleyin.

### 7.2 CLI ile Kupon Tohumlama (Geliştirme / Test)

Test ortamında idempotent kupon oluşturmak için monorepo komutu:

```bash
pnpm seed:promotions
```

Bu komut `TEST10` (%10) ve `TEST50TL` (50 TL) kuponlarını otomatik oluşturur veya varsa atlar.

---

## 8. Siparişler ve Ödeme Güvenlik Denetimi (Orders)

### 8.1 Gelen Siparişleri İnceleme

1. Sol menüden **Orders (Siparişler)** sayfasına gidin.
2. Sipariş numarası (`display_id`, örn: `#1`), sipariş tarihi, müşteri e-postası ve toplam tutar listelenir.
3. Sipariş detayında:
   - **Items:** Sipariş edilen ürün ve varyantlar,
   - **Shipping Address:** Teslimat adresi (İlçe / İl / Türkiye),
   - **Billing Address & Metadata:** Fatura türü (Bireysel / Kurumsal), kurumsal faturalarda şirket unvanı, vergi dairesi ve 10 haneli vergi numarası yer alır.

### 8.2 Ödeme Güvenlik Kapısı

- **Geliştirme:** Yalnızca `NODE_ENV !== "production"` ve `ALLOW_DEV_PAYMENT="true"` olduğunda sahte sistem ödemesi (`pp_system_default`) ile sipariş tamamlanabilir.
- **Üretim:** Medusa Payment Guard modülü açılışta ve Next.js vitrin checkout API'si istek anında fail-closed prensibiyle sahte ödemeyi engeller; gerçek bir ödeme sağlayıcısı (örn. PayTR) olmadan sipariş alınamaz.
- **Uçtan Uca Doğrulama:**
  ```bash
  pnpm verify:checkout
  ```
