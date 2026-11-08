# Runbook: Ödeme Yönetimi ve Canlıya Geçiş (Operations Guide)

Bu doküman, operasyon ekibi ve mağaza yöneticileri için PayTR ve Kapıda Ödeme sistemlerinin yapılandırılması, canlıya alınması, hata ayıklama ve acil durum prosedürlerini içerir.

---

## 1. Canlıya Geçiş Kontrol Listesi (Production Go-Live Checklist)

Mağaza canlı ortama alınmadan önce aşağıdaki adımlar sırasıyla tamamlanmalıdır:

- [ ] **1. Şifreleme Anahtarının Ayarlanması:**
      Sunucu ortam değişkenlerinde `SETTINGS_ENCRYPTION_KEY` değişkeninin 64 karakter hex veya 44 karakter base64 formatında benzersiz bir değerle tanımlandığından emin olun.
      _(Not: Bu anahtar kaybolursa veritabanındaki kayıtlı PayTR anahtarları çözülemez; yedeklenmelidir)._
- [ ] **2. Medusa Admin'e Giriş:**
      Medusa Admin paneline süper yönetici hesabı ile giriş yapın (`/app/payment-settings`).
- [ ] **3. Canlı PayTR Bilgilerini Girin:**
  - **Mağaza No (Merchant ID):** PayTR mağaza panelinizdeki ID.
  - **Mağaza Parolası (Merchant Key):** Gizli anahtar.
  - **Mağaza Gizli Anahtarı (Merchant Salt):** Gizli tuz değeri.
- [ ] **4. Test Modunu Kapatın:**
  - `Test Modu (Sandbox)` kutucuğunun işaretini kaldırın.
  - `PayTR ile Ödeme Aktif` kutucuğunu işaretleyin.
- [ ] **5. Bağlantıyı Test Edin:**
  - `Bağlantıyı Test Et` butonuna tıklayın.
  - Sistem arka planda PayTR API'sine 1 TL'lik geçici token isteği göndererek anahtarların doğruluğunu teyit eder.
  - Yeşil onay mesajını (`Bağlantı testi başarılı`) görmeden ayarları kaydetmeyin.
- [ ] **6. Değişiklikleri Kaydedin:**
  - `Ayarları Kaydet` butonuna basın. Başarı bildirimi görüntülenecektir.
- [ ] **7. PayTR Mağaza Panelinde Bildirim URL'sini Tanımlayın:**
      PayTR Mağaza Paneli -> Bilgi -> Bildirim URL (Callback URL) alanına:
      `https://<siteniz-veya-api-domaininiz>/hooks/payment/pp_paytr_paytr`
      adresini kaydedin.

---

## 2. Kapıda Ödeme (COD) Yönetimi

- **Aktif / Pasif:** İstenildiğinde Admin paneli üzerinden anında açılıp kapatılabilir.
- **Hizmet Bedeli:** Kargo şirketinizin tahsilatlı gönderi için talep ettiği komisyon tutarını (örn. 50 TL, 100 TL) kuruş cinsinden girin.
- **Maksimum Tutar:** Kötü niyetli sipariş riskini önlemek için Kapıda Ödeme seçeneğinin geçerli olacağı üst limiti belirleyin (örn. 5.000 TL). Bu tutarın üzerindeki sepetlerde vitrinde Kapıda Ödeme seçeneği otomatik gizlenir.

---

## 3. Webhook ve Bildirim Hata Ayıklama (Troubleshooting)

### 3.1 PayTR Callback Bildirimi Başarısız Olursa

PayTR bildirim gönderdiğinde sunucu loglarında şu etiketleri arayın:

- `[PayTR Callback] Eksik parametreler`: PayTR'den gelen POST gövdesinde beklenen alanlar eksiktir.
- `[PayTR Callback] Geçersiz HMAC hash`: Veritabanındaki Merchant Key/Salt ile PayTR panelindeki eşleşmiyor olabilir.
- `[PayTR Callback] Tutar uyuşmazlığı`: Gönderilen tutar sepet tutarının altındadır (dolandırıcılık veya kuruş yuvarlama hatası).
- `[PayTR Callback] merchant_oid ile eşleşen ödeme oturumu bulunamadı`: Bildirim döngüsünü durdurmak için sistem OK döner, ancak sepet bulunamadığı için sipariş oluşmaz.

### 3.2 İstemci (Müşteri) Ekranında Zaman Aşımı

Müşteri `/odeme/sonuc` sayfasında 90 saniye boyunca "Ödeme Durumu Doğrulanıyor..." uyarısı görüyorsa:

1. PayTR panelinden işlemin durumunu (Başarılı / Başarısız) kontrol edin.
2. Bildirim URL'sinin sunucuya ulaşıp ulaşmadığını Nginx/Cloudflare loglarından inceleyin.
3. Callback ulaşmış ancak hata almışsa müşteriye destek verilerek sipariş manuel tamamlanabilir.

---

## 4. İade ve İptal Prosedürü (Refunds)

- PayTR iFrame üzerinden tahsil edilen ödemelerin iadesi PayTR Mağaza Paneli üzerinden gerçekleştirilir.
- İade yapıldıktan sonra Medusa Admin panelinde ilgili siparişin içine girilerek:
  1. İade tutarı ve PayTR referans no sipariş notlarına (Timeline) eklenir.
  2. Sipariş durumu "Canceled / Refunded" olarak güncellenir.
- Kapıda ödeme siparişlerinde henüz kargoya verilmemişse sipariş doğrudan iptal edilir; teslim edilmişse müşterinin banka IBAN bilgisi alınarak muhasebe üzerinden iade yapılır.

---

## 5. Acil Durum / Ödeme Yöntemini Anında Devre Dışı Bırakma

PayTR tarafında genel bir kesinti veya acil bir güvenlik durumu meydana gelirse:

1. Medusa Admin -> `Ödeme Ayarları` sayfasına gidin.
2. `PayTR ile Ödeme Aktif` anahtarını kapatın.
3. `Ayarları Kaydet` butonuna basın.
4. Vitrin, sunucuyu yeniden başlatmaya gerek kalmadan 1 saniye içinde PayTR seçeneğini gizleyecek ve yeni ödeme alımını durduracaktır.
