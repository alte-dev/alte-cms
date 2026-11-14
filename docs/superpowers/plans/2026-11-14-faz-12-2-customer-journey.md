# Faz 12.2 — Müşteri Yolculuğu Uçtan Uca Doğrulaması (`verify:journey`) Planı

**Hedef:** Yeni bir müşterinin kayıt, e-posta doğrulama, misafir sipariş birleştirme, giriş, adres ekleme, çıkış/çerez iptali, kapıda ödeme siparişi, idempotent e-posta, kargo takibi, COD tahsilatı, şifre sıfırlama ve hesap silme akışlarını gerçek yığın (Next.js + Medusa + PostgreSQL + Redis + Playwright Chromium + yerel `smtp-server`) üzerinde uçtan uca doğrulamak.

**Dal:** `phase-12-2-customer-journey` (yeni PR; merge insan tarafından yapılır).

## Adımlar

1. **Yerel SMTP Yakalayıcı ve Güvenlik Koruması (`scripts/verify-journey.ts`)**

   - `SMTP_HOST`, `EMAIL_HOST`, `MAIL_HOST` gibi ortam değişkenleri `127.0.0.1` / `localhost` dışında gerçek bir host içeriyorsa betiği fail-closed hata ile durdur.
   - `smtp-server` ile `127.0.0.1` üzerinde rastgele boş portta yerel SMTP alıcı başlat (`finally` bloğunda kapat).
   - Medusa Admin API (`PUT /admin/email-settings`) ile e-posta ayarlarını geçici olarak bu sahte sunucuya yönlendir (`admin_notify_email: ""`, sahte kullanıcı/parola, önceki ayarı `finally` içinde geri yükle).
   - Yakalanan her e-postada `to`, `subject`, `text`, `html`, `messageId` sakla.

2. **Uçtan Uca Yolculuk Senaryosu (Playwright + Gerçek HTTP)**

   - **Ön Adım (Misafir COD siparişi):** Aynı e-posta (`emailA`) ile kayıt öncesi misafir COD siparişi oluştur; 1 sipariş onay e-postası yakala.
   - **Adım 1-2 (Kayıt + XSS + Doğrulama E-postası):** `/hesap/kayit` formunu tarayıcıda `<script>alert(1)</script>` içeren ad ile doldur; tek tip başarı mesajı ve 1 doğrulama e-postası doğrula (alıcı, `WEB_URL` bağlantısı, parola yok, ad HTML'de kaçırılmış).
   - **Adım 3 (Doğrulamasız Giriş):** Doğrulamadan önce giriş yap; `/hesap/siparisler` içinde misafir siparişinin görünmediğini doğrula. Çıkış yap.
   - **Adım 4 (Doğrulama Linki + Tek Kullanımlık + Süresi Dolmuş Token):** Tarayıcıda e-postadaki doğrulama bağlantısına tıkla (`verified=true`), aynı bağlantının ikinci kez reddedildiğini (`400`) ve DB'den süresi geçmişe çekilen token'ın reddedildiğini (`400`) doğrula.
   - **Adım 5 (UI Giriş + Adres Defteri + Çıkış Çerez İptali):** `/hesap/giris` ile giriş yap, `/hesap/siparisler` içinde misafir siparişinin artık göründüğünü doğrula, `/hesap/adresler` üzerinden varsayılan teslimat adresi ekle. Eski çerezi sakla, "Çıkış Yap"a tıkla, eski çerezle `GET /api/account/me` -> `401` doğrula.
   - **Adım 6 (Girişli COD Siparişi + Idempotent E-posta):** Tekrar giriş yap, ürünü sepete ekle, `/odeme` sayfasının kayıtlı adresle dolu geldiğini doğrula, Kapıda Ödeme seçip siparişi tamamla. 1 sipariş onay e-postası (doğru toplam, COD kalemi, sipariş no) yakala. Aynı sepetle `POST /api/checkout` tekrar tetiklendiğinde `409` döndüğünü ve ikinci e-posta gitmediğini doğrula.
   - **Adım 7 (Sipariş Detayı + Çapraz Müşteri İzolasyonu):** Müşteri A `/hesap/siparisler` ve `/hesap/siparisler/[id]` görür; ikinci tarayıcı bağlamında Müşteri B aynı siparişi göremez (`404`).
   - **Adım 8 (Yönetici Kargo + `/siparis-takip` + COD Tahsil):** Admin API ile kargo takip kodu ekle -> `https://` takipli kargo e-postası yakala, tarayıcıda `/siparis-takip` sorgusunun çalıştığını doğrula; Admin API ile COD tahsilatı (`cod-captured`) yap.
   - **Adım 9 (Şifre Sıfırlama + Numaralandırma Koruması):** `/hesap/sifre-sifirla` üzerinden sıfırlama iste -> e-postadaki bağlantıyla yeni parola belirle -> eski oturum `401`, eski parola `401`, yeni parola `200`, aynı token tekrarı `400`, kayıtsız e-posta için tek tip yanıt ve `0` e-posta.
   - **Adım 10 (Hesap Silme):** `/hesap/sil` formundan parola + `"SİL"` onayıyla hesabı sil; kişisel verilerin anonimleştiğini, sipariş kaydının korunduğunu, girişin `401` verdiğini doğrula.

3. **E-posta Günlüğü, Log PII Taraması ve Tam E-posta Sayısı**

   - `email_log` tablosunda müşteri e-postası, ad, adres, telefon, parola veya token'ın düz yazı olarak bulunmadığını sorgula.
   - `verify-logs/*.log` dosyalarında parola ve ham token sızıntısı olmadığını doğrula.
   - Yakalanan toplam e-posta sayısının beklenen sayıya tam eşit olduğunu doğrula.

4. **Entegrasyon ve Dokümantasyon**
   - `package.json` (`verify:journey`) ve `scripts/verify-all.ts` içine bağla.
   - `docs/RUNBOOK.md` içine "Gerçek Posta Kutusuyla Elle Deneme" bölümünü ekle (`example.test`, gerçek sır/alan adı yok).
   - `pnpm verify:journey` iki kez art arda, ardından `pnpm verify:all` (12 betik) ve tüm CI kontrollerini çalıştır.
