# Runbook: Ödeme Yönetimi ve Canlıya Geçiş (Operations Guide)

Bu doküman, operasyon ekibi ve mağaza yöneticileri için PayTR ve Kapıda Ödeme sistemlerinin yapılandırılması, canlıya alınması, hata ayıklama, elle iade yönetimi ve acil durum prosedürlerini içerir.

---

## 1. Canlıya Geçiş Kontrol Listesi (Production Go-Live Checklist)

Mağaza canlı ortama alınmadan önce aşağıdaki adımlar sırasıyla tamamlanmalıdır:

- [ ] **1. Şifreleme Anahtarının Ayarlanması:**
      Sunucu ortam değişkenlerinde `SETTINGS_ENCRYPTION_KEY` değişkeninin 64 karakter hex veya 44 karakter base64 formatında benzersiz bir değerle tanımlandığından emin olun.
      _(Not: Bu anahtar kaybolursa veritabanındaki kayıtlı PayTR anahtarları çözülemez; güvenli bir şifre kasasında yedeklenmelidir)._
- [ ] **2. Geliştirici Ortam Değişkenlerinin Temizliği:**
      Üretim ortamında `PAYTR_API_BASE` ve `DEV_PAYTR_USER_IP` değişkenlerinin KESİNLİKLE tanımlanmamış (undefined) olduğundan emin olun. Bu değişkenler tanımlıysa Medusa açılış koruması (Startup Guard) fail-closed kuralıyla sunucuyu kapatır.
- [ ] **3. Bölge - Ödeme Sağlayıcı Bağlantısı:**
      Üretimde mağaza kurulum scripti (`pnpm setup:store`) çalıştırıldığında Türkiye bölgesine yalnızca gerçek sağlayıcılar (`pp_paytr_paytr` ve `pp_cod_cod`) bağlanır; `pp_system_default` sahte sağlayıcısı bağlanmaz.
- [ ] **4. Medusa Admin'e Giriş:**
      Medusa Admin paneline süper yönetici hesabı ile giriş yapın (`/app/payment-settings`).
- [ ] **5. Canlı PayTR Bilgilerini Girin:**
  - **Mağaza No (Merchant ID):** PayTR mağaza panelinizdeki ID.
  - **Mağaza Parolası (Merchant Key):** Gizli anahtar.
  - **Mağaza Gizli Anahtarı (Merchant Salt):** Gizli tuz değeri.
- [ ] **6. Test Modunu Kapatın:**
  - `Test Modu (Sandbox)` kutucuğunun işaretini kaldırın.
  - `PayTR ile Ödeme Aktif` kutucuğunu işaretleyin.
- [ ] **7. Bağlantıyı Test Edin:**
  - `Bağlantıyı Test Et` butonuna tıklayın.
  - Sistem arka planda PayTR API'sine 1 TL'lik geçici token isteği göndererek anahtarların doğruluğunu teyit eder.
  - Yeşil onay mesajını (`Bağlantı testi başarılı`) görmeden ayarları kaydetmeyin.
- [ ] **8. Değişiklikleri Kaydedin:**
  - `Ayarları Kaydet` butonuna basın. Başarı bildirimi görüntülenecektir.
- [ ] **9. PayTR Mağaza Panelinde Bildirim URL'sini Tanımlayın:**
      PayTR Mağaza Paneli -> Bilgi -> Bildirim URL (Callback URL) alanına:
      `https://<siteniz-veya-api-domaininiz>/hooks/payment/pp_paytr_paytr`
      adresini kaydedin.

---

## 2. Kapıda Ödeme (COD) Yönetimi

- **Aktif / Pasif:** İstenildiğinde Admin paneli üzerinden anında açılıp kapatılabilir.
- **Hizmet Bedeli:** Kargo şirketinizin tahsilatlı gönderi için talep ettiği komisyon tutarını KDV dahil TL cinsinden (örn. 50 veya 100 TL) girin. Bu bedel sepete `SERVICE-COD-FEE` SKU'lu kalıcı hizmet kalemi olarak yansır.
- **Maksimum Tutar:** Kötü niyetli sipariş riskini önlemek için Kapıda Ödeme seçeneğinin geçerli olacağı üst limiti belirleyin (örn. 5.000 TL). Bu tutar yalnızca sepetteki ürünler toplamı üzerinden değerlendirilir.

---

## 3. Elle İade Bekleyenler Yönetimi (Manual Refunds Operation)

Eğer müşteri kartından PayTR tarafından tahsilat yapılmış ancak Medusa tarafında sepet siparişe dönüştürülürken stok tükenmesi gibi kurtarılamaz bir iş kuralı hatası oluşmuşsa:

1. Sistem Medusa loglarında derhal `[CRITICAL ALERT]` üretir.
2. İlgili ödeme oturumu `needs_manual_refund: true` olarak işaretlenir.
3. Medusa Admin panelinde (`/app/payment-settings`) kırmızı renkte **"Elle İade Bekleyenler"** uyarı kutusu belirir.
4. **Operatör Prosedürü:**
   - Listede yer alan `cart_id`, tutar ve hata nedenini not edin.
   - PayTR Mağaza Paneline giriş yaparak ilgili tutarı müşterinin kredi kartına manuel iade edin.
   - Müşteriye bilgi vererek stok tükenmesi nedeniyle siparişin iptal edildiğini bildirin.

---

## 4. Webhook ve Bildirim Hata Ayıklama (Troubleshooting)

### 4.1 Production Startup Guard Çökmesi (`exit 1`)

Eğer sunucu `NODE_ENV=production` modunda ayağa kalkmıyor ve loglarda `FAIL-CLOSED` mesajı varsa:

- **Sebep 1:** `PAYTR_API_BASE` veya `DEV_PAYTR_USER_IP` env değişkeni tanımlıdır -> Bu değişkenleri `.env` veya sunucu ayarlarından kaldırın.
- **Sebep 2:** Bölgeye `pp_system_default` bağlıdır -> `pnpm --filter @alte/medusa setup:store` komutunu çalıştırarak sahte sağlayıcıyı kaldırıp gerçek sağlayıcıları bağlayın.
- **Sebep 3:** Bölgeye hiçbir sağlayıcı bağlı değildir -> Mağaza kurulumunu (`pnpm setup:store`) tamamlayın.

### 4.2 PayTR Callback Bildirimi Hataları

PayTR bildirim gönderdiğinde sunucu loglarında şu etiketleri arayın:

- `[PayTR Callback] Eksik parametreler`: PayTR'den gelen POST gövdesinde beklenen alanlar eksiktir.
- `[PayTR Callback] Geçersiz HMAC hash`: Veritabanındaki Merchant Key/Salt ile PayTR panelindeki eşleşmiyor olabilir.
- `[PayTR Callback] Tutar yetersiz`: Gönderilen tutar sepet tutarının altındadır.
- `[PayTR Callback] merchant_oid ile eşleşen ödeme oturumu bulunamadı`: Oturum veritabanında bulunamamıştır.

---

## 5. Acil Durum / Ödeme Yöntemini Anında Devre Dışı Bırakma

PayTR tarafında genel bir kesinti veya acil bir güvenlik durumu meydana gelirse:

1. Medusa Admin -> `Ödeme Ayarları` sayfasına gidin.
2. `PayTR ile Ödeme Aktif` anahtarını kapatın.
3. `Ayarları Kaydet` butonuna basın.
4. Vitrin, sunucuyu yeniden başlatmaya gerek kalmadan 1 saniye içinde PayTR seçeneğini gizleyecek ve yeni ödeme alımını durduracaktır.

---

## 5. İptal Edilen Siparişlerde PayTR İadesi (FAZ 6C)

Yönetici tarafından kargolanmamış bir sipariş iptal edildiğinde:

1. Kart ile ödenmiş siparişlerde sistem **otomatik olarak bankaya/PayTR'a geri ödeme talimatı göndermez**. Bu güvenlik kuralı, mükerrer iadeleri ve yetkisiz para çıkışlarını önlemek amacıyla katıdır.
2. Sipariş veritabanında `status = 'canceled'` ve `needs_manual_refund = true` olarak işaretlenir.
3. Yönetici aşağıdaki adımları izlemelidir:
   - Medusa Admin -> Ödeme Ayarları -> "Elle İade Bekleyenler" listesini veya Sipariş Detayını açın.
   - İptal edilen siparişin tutarını ve PayTR İşlem Referansını not edin.
   - PayTR Mağaza Paneli (`https://www.paytr.com/magaza/islemler`) üzerinden ilgili işlemi bulun ve **"İptal / İade Et"** butonuna basarak iadeyi başlatın.
   - İade tamamlandıktan sonra Medusa Admin üzerindeki ilgili kaydı "İade Edildi" olarak işaretleyin.
