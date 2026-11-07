# Roller ve İzin Matrisi (PERMISSIONS.md)

Bu doküman, platformun personel rolleri ile yönetim modülleri arasındaki yetki matrisini ve bu matrisin Payload CMS 3 ile Medusa v2 üzerinde nasıl karşılandığını detaylandırır.

> **Önemli Tasarım İlkesi (Personel vs Müşteri Ayrımı):**  
> Payload CMS 3 `Users` koleksiyonu **yalnızca personel ve yönetim kadrosu içindir** (5 rol: `super-admin`, `admin`, `shop-manager`, `editor`, `author`).  
> Müşteri hesapları, oturumları, sepet ve sipariş geçmişi **Medusa v2** altyapısında tutulur. `customer` rolü Payload'dan ve `@alte/shared` rol sabitlerinden tamamen kaldırılmıştır.

---

## 1. Rol x Modül İzin Matrisi

İşaret Açıklamaları:

- **Tam (CRUD):** Oluşturma, Okuma, Güncelleme, Silme ve Yayınlama yetkisi.
- **Yönet (RW):** Okuma ve Güncelleme yetkisi.
- **Gör (R):** Yalnızca Okuma (Görüntüleme) yetkisi.
- **Kendi (Own):** Yalnızca kendi oluşturduğu içeriği düzenleme yetkisi.
- **Yok (-):** Erişim tamamen kapalı.

| Modül                           | super-admin |    admin     | shop-manager |   editor   |       author       | Müşteri (Medusa Storefront) |
| :------------------------------ | :---------: | :----------: | :----------: | :--------: | :----------------: | :-------------------------: |
| **1. Ürünler (Katalog)**        |     Tam     |     Tam      |     Tam      |  Gör (R)   |         -          |      Gör (Storefront)       |
| **2. Siparişler**               |     Tam     |     Tam      |     Tam      |  Gör (R)   |         -          |       Kendi (Medusa)        |
| **3. Müşteriler**               |     Tam     |     Tam      |  Yönet (RW)  |     -      |         -          |       Kendi (Medusa)        |
| **4. Ödemeler & Finans**        |     Tam     |     Tam      |  Yönet (RW)  |     -      |         -          |              -              |
| **5. Mağaza Ayarları**          |     Tam     |     Tam      |   Gör (R)    |     -      |         -          |              -              |
| **6. Sayfa Oluşturucu (Puck)**  |     Tam     |     Tam      |      -       |    Tam     | Kendi (Own Taslak) |              -              |
| **7. Tema & Menü Ayarları**     |     Tam     |     Tam      |      -       | Yönet (RW) |         -          |              -              |
| **8. Analitik & Raporlar**      |     Tam     |     Tam      |     Tam      |     -      |         -          |              -              |
| **9. Eklentiler & Entegrasyon** |     Tam     |  Yönet (RW)  |      -       |     -      |         -          |              -              |
| **10. Personel & Roller**       |     Tam     | Yönet (RW)\* |      -       |     -      |         -          |              -              |

_\* Not: `admin` rolü yeni personel kullanıcısı açabilir ve rolleri düzenleyebilir, ancak başka bir kullanıcıyı `super-admin` yapamaz. Anonim kullanıcı oluşturma kapalıdır._

---

## 2. Payload CMS 3 Tarafında Uygulama (Yalnızca Personel)

Payload CMS'te yetkiler her koleksiyonun `access` nesnesi ve alan seviyesindeki `access` fonksiyonları ile denetlenir:

1. **Users Koleksiyonu (Yalnızca Personel):**
   - `create`: Anonim kayıt kapalıdır. Yalnızca `admin` ve `super-admin` yeni personel kullanıcısı oluşturabilir (`admin` kullanıcıları `super-admin` oluşturamaz). İlk süper admin kurulumu için CLI bootstrap scripti (`pnpm create-admin`) kullanılır. Üretimde önce `pnpm create-admin` çalıştırılmadan /admin dışarı açılmaz.
   - `read`: Anonim engelli. Personel kullanıcılar kendi profilini veya admin/super-admin tüm personeli görebilir.
   - `update`: Personel kendi ad/soyad ve şifresini günceller. `role` alanı alan-seviyesi `canAssignRole` kontrolüyle denetlenir: yalnızca `super-admin` rolü `super-admin` atayabilir; `admin` rolü `super-admin` kullanıcıları düzenleyemez ve kendi rolünü yükseltemez.
   - `delete`: Yalnızca `super-admin` tüm personeli silebilir. `admin` kullanıcıları `super-admin` hesaplarını silemez.
   - `admin`: Panel erişimi (`access.admin`) Users koleksiyonundaki tüm geçerli personel rollerine (`super-admin`, `admin`, `shop-manager`, `editor`, `author`) açıktır.
2. **Media Koleksiyonu:**
   - `read`: Genel (Storefront görselleri için `true`).
   - `create` / `update`: `editor`, `shop-manager`, `admin`, `super-admin`. Dosya boyutu sınırı: 5 MB (SVG engelli, yalnızca raster görseller).
   - `delete`: Yalnızca `shop-manager`, `admin`, `super-admin`.
3. **Pages & Blog Koleksiyonları (Faz 2-3):**
   - `author`: Yalnızca `author === user.id` olan dokümanları güncelleyebilir ve yayınlayamaz (yalnızca `draft` durumunda kaydeder).
   - `editor`: Tüm taslakları onaylayıp `published` durumuna geçirebilir.

---

## 3. Medusa v2 Admin Tarafında Uygulama

Medusa v2 mimarisinde mağaza operasyonları için yönetim yetkileri:

1. **Medusa Admin Kullanıcıları (`/app`):**
   - `super-admin` ve `admin` tam mağaza erişimine sahiptir.
   - `shop-manager` kullanıcıları katalog, envanter, sipariş karşılama ve kargo etiketlerini yönetir.
2. **Publishable API Keys:**
   - Storefront, Medusa API isteklerinde yalnızca okuma yetkili publishable anahtarını kullanır.
   - Müşteri oturumu (Bearer token) yalnızca müşterinin kendi sepeti (`cart_id`) ve siparişleri ile ilişkilendirilir; başka bir müşterinin verisi okunamaz.
