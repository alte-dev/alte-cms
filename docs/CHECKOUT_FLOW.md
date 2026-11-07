# Ödeme ve Sipariş Akışı (CHECKOUT_FLOW.md)

Bu doküman, müşterinin sepet oluşturmasından başlayıp PayTR üzerinden 3D Secure doğrulaması ve sunucu callback'i ile siparişin tamamlanmasına kadar geçen tüm yaşam döngüsünü açıklar.

---

## 1. Uçtan Uca Mermaid Sıra Diyagramı

```mermaid
sequenceDiagram
    autonumber
    actor M as Müşteri (Tarayıcı)
    participant W as Next.js Storefront
    participant S as Medusa v2 API
    participant DB as PostgreSQL
    participant P as PayTR Sunucuları

    Note over M,W: 1. Sepet ve Teslimat Bilgileri
    M->>W: Teslimat ve Fatura Adresini Gir
    W->>S: POST /store/carts/{id} (Adres Ekle)
    S->>DB: Sepet Adresini Kaydet
    S-->>W: 200 OK (Kargo Seçenekleri)

    M->>W: Kargo Yöntemini Seç
    W->>S: POST /store/carts/{id}/shipping-methods
    S->>DB: Kargo Bedelini Sepete Ekle
    S-->>W: 200 OK (Güncellenmiş Tutar)

    Note over M,P: 2. Ödeme Oturumu ve PayTR Token
    M->>W: "Ödemeye Geç" Butonuna Tıkla (PayTR)
    W->>S: POST /store/carts/{id}/payment-sessions (provider_id: paytr)
    S->>S: Sunucuda Sepet Tutarını Kuruşa Çevir (100 ile çarp)
    S->>P: POST https://www.paytr.com/odeme/api/get-token (HMAC İmzalı İstek)
    P-->>S: 200 OK (iframe_token)
    S-->>W: 200 OK (iframe_token)
    W-->>M: PayTR iFrame'ini Güvenli Olarak Yükle

    Note over M,P: 3. 3D Secure Doğrulaması
    M->>P: Kart Bilgilerini ve SMS Kodunu Gir (3D Secure)
    P->>P: Banka Onayı Alındı

    Note over P,S: 4. Sunucu Tarafı Callback ve Doğrulama
    P->>S: POST /api/payment/paytr/callback (merchant_oid, status, total_amount, hash)
    activate S
    S->>S: 1. HMAC-SHA256 İmzası Hesapla
    S->>S: 2. crypto.timingSafeEqual ile İmzayı Doğrula

    alt İmza Geçersiz
        S-->>P: HTTP 400 Bad Request
    else İmza Geçerli
        S->>DB: Sipariş / Sepet Durumunu Sorgula
        alt Idempotency: Sipariş Zaten Ödendi mi?
            S-->>P: "OK" (Mükerrer işlem engellendi)
        else İlk Kez İşleniyor
            S->>S: 3. Tutar Doğrulama (total_amount == cart.total)
            alt Tutar Eşleşmedi
                S->>DB: Güvenlik İhlali / Sahtekarlık Uyarısı Kaydet
                S-->>P: HTTP 400 Bad Request
            else Tutar Eşleşti
                S->>DB: Siparişi Oluştur ve "completed" Olarak İşaretle
                S->>DB: Stokları Düş ve Müşteri E-Postası Gönder
                S-->>P: "OK" (Yalın metin)
            end
        end
    end
    deactivate S

    Note over M,W: 5. Kullanıcı Yönlendirme
    P-->>M: Başarılı Yönlendirme URL'ine Gönder
    M->>W: GET /siparis-onay/{id}
    W->>S: GET /store/orders/{id}
    S-->>W: 200 OK (Sipariş Detayı)
    W-->>M: "Siparişiniz Başarıyla Alındı" Ekranı
```

---

## 2. Kritik Güvenlik ve Bütünlük Kontrolleri

1. **HMAC-SHA256 Bütünlük Doğrulaması:**
   Callback isteğindeki `hash`, sunucu tarafındaki gizli anahtarlar ile doğrulanmadan hiçbir sipariş durumu değiştirilemez.
2. **Sabit Zamanlı Karşılaştırma (`timingSafeEqual`):**
   Karakter bazlı erken sonlanan dizi karşılaştırmaları, saldırganın milisaniyelik gecikmeleri ölçerek geçerli imzayı tahmin etmesine (timing attack) olanak tanır. Bu nedenle Node.js `crypto.timingSafeEqual()` fonksiyonu kullanılır.
3. **Kuruş Seviyesinde Tutar Karşılaştırması:**
   PayTR'nin ilettiği `total_amount` (örn: `15990` = 159.90 TL), Medusa veritabanında saklanan sepet tutarı ile kuruşu kuruşuna eşit olmak zorundadır.
4. **Idempotency (Tekrarlayan İstek Yönetimi):**
   Ağ kesintilerinde PayTR bildirimleri yeniden gönderilebilir. Callback işleyicisi `merchant_oid` ile eşleşen siparişin daha önce onaylanıp onaylanmadığını kontrol eder; zaten onaylanmışsa stokları tekrar düşmez, yalnızca `"OK"` cevabı verir.
5. **Kesin `"OK"` Yanıtı:**
   PayTR protokolüne göre sunucudan dönen metin tam olarak `"OK"` olmalıdır. HTML etiketleri veya JSON dönülürse PayTR ödemeyi başarısız sayarak saatlerce webhook göndermeye devam eder.
