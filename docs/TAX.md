# Türkiye KDV Sistemi ve Medusa v2 Vergi Mimarisi

Bu doküman, Türkiye Cumhuriyeti Katma Değer Vergisi (KDV) mevzuatının Medusa v2 e-ticaret motorundaki teknik modellemesini, hesaplama kurallarını ve sepet entegrasyonunu belgeler.

---

## 1. KDV Oranları ve Yapılandırma

Türkiye vergi bölgesi (`country_code: "tr"`) altında 3 temel vergi oranı tanımlanmıştır:

| Oran Kodu | KDV Oranı | Adı                     | Varsayılan | Kapsam / Kural (Rule)                                                            |
| :-------- | :-------- | :---------------------- | :--------- | :------------------------------------------------------------------------------- |
| **KDV20** | **%20**   | Standart KDV (%20)      | `true`     | Genel kural dışı tüm ürünler, tekstil, aksesuar, hizmetler ve kargo ücretleri.   |
| **KDV10** | **%10**   | Gıda/Temel KDV (%10)    | `false`    | `product_type: "food"` kuralına bağlı temel gıda ve ihtiyaç maddeleri.           |
| **KDV1**  | **%1**    | Özel İndirimli KDV (%1) | `false`    | `product_type: "special"` kuralına bağlı tohum, un, gazete ve tarımsal girdiler. |

---

## 2. Fiyatlar KDV Dahil (Tax-Inclusive Pricing)

Türkiye perakende e-ticaret mevzuatı uyarınca B2C vitrinlerde gösterilen tüm fiyatlar **KDV DAHİL** olmalıdır (WooCommerce'teki _"Fiyatlara vergi dahildir"_ ayarı).

### Medusa v2 Price Preference Yapılandırması:

Tax Module ve Pricing Module üzerinde `PricePreference` tanımlanmıştır:

- **Para Birimi Kuralı:** `attribute: "currency_code"`, `value: "try"`, `is_tax_inclusive: true`
- **Bölge Kuralı:** `attribute: "region_id"`, `value: <turkey_region_id>`, `is_tax_inclusive: true`

Bu ayar sayesinde katalogda tanımlanan fiyatlar (örneğin 120 TL) doğrudan müşterinin ödeyeceği nihai tutardır. Sepet ve sipariş hesaplamalarında tutardan KDV ayrıştırılarak ayrı satır olarak gösterilir.

---

## 3. Matematiksel Hesaplama Formülü

KDV dahil fiyatlardan vergi ve matrah ayrıştırma formülü:

$$\text{Matrah (Ara Toplam)} = \frac{\text{KDV Dahil Toplam Tutar}}{1 + \frac{\text{KDV Oranı}}{100}}$$

$$\text{KDV Tutarı} = \text{KDV Dahil Toplam Tutar} - \text{Matrah}$$

### Örnek Hesaplama (%20 KDV):

Bir ürünün etiket fiyatı **120 TL** ise:

- $\text{Matrah} = \frac{120}{1 + 0.20} = \frac{120}{1.20} = 100.00\text{ TL}$
- $\text{KDV Tutarı (%20)} = 120.00 - 100.00 = 20.00\text{ TL}$
- $\text{Nihai Müşteri Tutarı} = 120.00\text{ TL}$

Medusa sepet çıktısı:

```json
{
  "total": 120.0,
  "subtotal": 100.0,
  "tax_total": 20.0,
  "items": [
    {
      "unit_price": 120.0,
      "tax_lines": [
        {
          "code": "KDV20",
          "rate": 20,
          "name": "Standart KDV (%20)"
        }
      ]
    }
  ]
}
```

---

## 4. Sistem Vergi Sağlayıcısı (`tp_system`)

Medusa v2'de vergi hesaplamaları vergi sağlayıcıları (`TaxProvider`) üzerinden yürütülür.
Türkiye bölgesi için yerel dahili `SystemTaxService` (`tp_system`) atanmıştır:

- Vergi hesaplaması için dış API'ye (ör. TaxJar, Avalara) bağımlılık yoktur.
- Sıfır ek ağ gecikmesi ile milisaniyeler içinde yerel veritabanı kuralları üzerinden hesaplama yapılır.
- Harici bir e-Fatura / e-Arşiv entegrasyonu gerektiğinde (İleri fazlar), Medusa'nın `TaxProvider` arayüzü genişletilebilir.
