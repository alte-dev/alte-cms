# Yönetici Kılavuzu (Admin Guide)

Bu kılavuz, Alte CMS & Payload CMS yönetim panelini kullanan mağaza yöneticileri ve içerik editörleri için hazırlanmıştır.

---

## 1. Yönetim Paneline Giriş

- **Giriş Adresi**: `http://localhost:3100/admin`
- Mağaza yetkilisi e-posta ve şifrenizle giriş yapınız.
- Brute force saldırılarına karşı 5 hatalı denemede hesap 10 dakika süreyle kilitlenir.

---

## 2. Görsel Sayfa Oluşturucu (Puck) ile Sayfa Tasarımı

1. Sol menüden **Sayfalar (Pages)** bölümüne girin.
2. Sağ üstteki **Yeni Oluştur (Create New)** butonuna tıklayın.
3. **Sayfa Başlığı** girin (Örn: `Hakkımızda`). URL yolu (slug) otomatik oluşturulacaktır.
4. Sayfayı ilk kez kaydedin (**Save**).
5. Sağ taraftaki işlem menüsünde beliren mavi renkli **🎨 Görsel Düzenleyiciyle Aç (Puck)** butonuna tıklayın.
6. Açılan görsel düzenleme tuvalinde sol panelden dilediğiniz bileşenleri sürükleyip sayfaya bırakın:
   - **Hero**: Büyük başlık, arka plan görseli ve butonlar.
   - **Columns**: 2, 3 veya 4 sütunlu kutular.
   - **Accordion**: Sıkça Sorulan Sorular.
   - **ContactInfo**: İletişim kartı ve çalışma saatleri.
7. Sayfayı hazırladıktan sonra:
   - **Taslak Kaydet**: Sayfayı taslak olarak saklar (ziyaretçiler göremez).
   - **Önizle ↗**: Gizli önizleme modunda sayfayı canlı görünümde test etmenizi sağlar (`/onizleme/[id]`).
   - **Yayına Al (Publish)**: Sayfayı vitrinde ziyaretçilere açar.

---

## 3. Ana Sayfa (Home Page) Belirleme

- Mağazanın ana sayfasını (`/`) Puck ile özel tasarlamak için:
  1. İlgili sayfanın ayarlarında sağ sütunda bulunan **"Ana Sayfa Olarak Kullan" (isHome)** kutucuğunu işaretleyin.
  2. Sayfayı kaydedip yayınlayın.
  3. Sistem otomatik olarak diğer tüm sayfalardaki ana sayfa bayrağını kaldıracak ve bu sayfayı ana sayfanız yapacaktır.

---

## 4. Blog Yazısı Oluşturma

1. Sol menüden **Blog Yazıları (Posts)** bölümüne girin.
2. **Yazı Başlığı** ve **Kısa Özet (Excerpt)** girin.
3. Sağ sütundan **Kategoriler** ve **Kapak Görseli** seçin.
4. Zengin metin editöründe yazı içeriğinizi biçimlendirin (başlıklar, listeler, alıntılar).
5. Sistem, içeriğin uzunluğuna göre **Tahmini Okuma Süresini** otomatik hesaplayacaktır.
6. Vitrinde yazar olarak adınız (`name`) görüntülenecek; e-posta adresiniz hiçbir şekilde dışarıya sızmayacaktır.

---

## 5. Menü ve Navigasyon Yönetimi

_(Yalnızca `admin` ve `super-admin` yetkisine açıktır)_

1. Sol menüden **Globaller -> Menü ve Navigasyon (Navigation)** seçeneğine girin.
2. **Üst Menü (Header)**:
   - Menü öğesi ekleyin (`label`, `href`).
   - Alt menü oluşturmak için ilgili öğenin içine `children` ekleyin.
3. **Alt Menü (Footer)**:
   - Kolon başlığı belirleyin (Örn: _Kurumsal_).
   - Kolon altına ilgili bağlantıları ekleyin.
4. **Bağlantı Güvenliği**: Tüm bağlantılar site içi (`/sayfa/...`) veya güvenli `https://...` adresi olmalıdır.

---

## 6. Görsel Yükleme Kuralları

- **İzin Verilen Formatlar**: JPEG, PNG, WebP, AVIF.
- **Yasak Formatlar**: SVG ve dosya uzantıları güvenlik (XSS) nedeniyle kesinlikle yüklenemez.
- **Boyut Sınırı**: Maksimum **5 MB**.
- **Alternatif Metin (alt)**: SEO ve görme engelli erişilebilirliği için zorunludur, boş bırakılamaz.
- Yüklenen görseller sistem tarafından otomatik olarak 400px, 800px ve 1600px responsive boyutlarda optimize edilir.
