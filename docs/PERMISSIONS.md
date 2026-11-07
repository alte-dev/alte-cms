# Roller ve İzin Matrisi (PERMISSIONS.md)

Bu doküman, platformun 6 rolü ile yönetim modülleri arasındaki yetki matrisini ve bu matrisin Payload CMS 3 ile Medusa v2 üzerinde nasıl karşılandığını detaylandırır.

---

## 1. Rol x Modül İzin Matrisi

İşaret Açıklamaları:

- **Tam (CRUD):** Oluşturma, Okuma, Güncelleme, Silme ve Yayınlama yetkisi.
- **Yönet (RW):** Okuma ve Güncelleme yetkisi.
- **Gör (R):** Yalnızca Okuma (Görüntüleme) yetkisi.
- **Kendi (Own):** Yalnızca kendi oluşturduğu içeriği düzenleme veya kendi profilini görme yetkisi.
- **Yok (-):** Erişim tamamen kapalı.

| Modül                           | super-admin |    admin     | shop-manager |   editor   |       author       |     customer     |
| :------------------------------ | :---------: | :----------: | :----------: | :--------: | :----------------: | :--------------: |
| **1. Ürünler (Katalog)**        |     Tam     |     Tam      |     Tam      |  Gör (R)   |         -          | Gör (Storefront) |
| **2. Siparişler**               |     Tam     |     Tam      |     Tam      |  Gör (R)   |         -          |   Kendi (Own)    |
| **3. Müşteriler**               |     Tam     |     Tam      |  Yönet (RW)  |     -      |         -          |   Kendi (Own)    |
| **4. Ödemeler & Finans**        |     Tam     |     Tam      |  Yönet (RW)  |     -      |         -          |        -         |
| **5. Mağaza Ayarları**          |     Tam     |     Tam      |   Gör (R)    |     -      |         -          |        -         |
| **6. Sayfa Oluşturucu (Puck)**  |     Tam     |     Tam      |      -       |    Tam     | Kendi (Own Taslak) |        -         |
| **7. Tema & Menü Ayarları**     |     Tam     |     Tam      |      -       | Yönet (RW) |         -          |        -         |
| **8. Analitik & Raporlar**      |     Tam     |     Tam      |     Tam      |     -      |         -          |        -         |
| **9. Eklentiler & Entegrasyon** |     Tam     |  Yönet (RW)  |      -       |     -      |         -          |        -         |
| **10. Kullanıcılar & Roller**   |     Tam     | Yönet (RW)\* |      -       |     -      |         -          |  Kendi (Profil)  |

_\* Not: `admin` rolü yeni kullanıcı açabilir ve müşteri rollerini düzenleyebilir, ancak başka bir kullanıcıyı `super-admin` yapamaz._

---

## 2. Payload CMS 3 Tarafında Uygulama

Payload CMS'te yetkiler her koleksiyonun `access` nesnesi ve alan seviyesindeki `access` fonksiyonları ile denetlenir:

1. **Users Koleksiyonu:**
   - `read`: Anonim engelli. Müşteri yalnızca kendi ID'sine ait kaydı görebilir (`{ id: { equals: user.id } }`). Admin/Super-admin tümünü görür.
   - `update`: Müşteri yalnızca ad/soyad ve şifresini günceller. `role` alanı alan-seviyesi `canChangeRole` kontrolüyle yalnızca `admin` ve `super-admin`'e açılmıştır.
   - `admin`: Panel erişimi (`access.admin`) yalnızca `super-admin`, `admin`, `shop-manager`, `editor` ve `author` rollerine açıktır (`customer` panele giriş yapamaz).
2. **Media Koleksiyonu:**
   - `read`: Genel (Storefront görselleri için `true`).
   - `create` / `update`: `editor`, `shop-manager`, `admin`, `super-admin`.
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
