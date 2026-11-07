# Risk Yönetimi ve Açık Sorular (RISKS.md)

Bu doküman, projenin mimari, altyapı, operasyonel ve güvenlik risklerini; bu riskleri azaltma (mitigation) stratejilerini ve doğrulanması gereken açık soruları içerir.

---

## 1. Temel Riskler ve Azaltma Stratejileri

### 1.1 Paylaşımlı Sunucu ve 4 GB Toplam RAM Kısıtı

- **Risk:** Sunucuda başka canlı siteler, MariaDB, OpenLiteSpeed ve mail servisleri halihazırda çalışmaktadır. Boşta kalan RAM miktarı sınırlıdır. Yeni e-ticaret platformunun sunucu belleğini tüketip mevcut siteleri yavaşlatması veya OOM killer tetiklemesi riski bulunur.
- **Azaltma Stratejisi:**
  - Maksimum yeni yük bütçesi **~1.1 GB RAM** olarak katı bir şekilde sınırlandırılmıştır.
  - Node.js süreçlerine sert heap sınırları verilmiştir: Medusa 512 MB (`--max-old-space-size=512`), Web 384 MB (`--max-old-space-size=384`).
  - PostgreSQL `shared_buffers = 64MB`, Redis `maxmemory = 64mb` ile sınırlandırılmıştır.
  - Docker üretimde kullanılmayacak, doğrudan hafif Linux servisleri çalıştırılacaktır.

### 1.2 Canlı Siteye (`cisemelifboz.com`) ve Posta Servislerine Etki Riski

- **Risk:** Mevcut canlı WooCommerce mağazasının DNS, e-posta (MX/SPF/DKIM) veya sunucu yapılandırmasına yapılacak hatalı bir müdahale ticari kayba ve iletişim kesintisine yol açabilir.
- **Azaltma Stratejisi:**
  - Faz 0'dan Faz 9'a kadar canlı siteye ve sunucuya **asla dokunulmaz**.
  - Tüm geliştirme yerel makinede tamamlanır.
  - Alan adı geçişi (Faz 9) öncesinde TTL süreleri düşürülür ve acil geri dönüş (rollback) planı hazır tutulur.

### 1.3 Public Depo Güvenliği ve Secret Sızıntısı Riski

- **Risk:** GitHub deposu herkese açık (public) olduğu için yapılandırma hataları veya dikkatsiz bir commit sonucunda API anahtarları, şifreler veya müşteri verileri sızabilir.
- **Azaltma Stratejisi:**
  - Kod tabanında sıfır fallback secret politikası uygulanmıştır (Fail-Closed).
  - Pre-commit hook ve GitHub Actions CI'da Gitleaks zorunlu kılınmıştır.
  - `.gitignore` kuralları `.env*`, döküm, sertifika ve yedek dosyalarını eksiksiz olarak bloke eder.

### 1.4 Tek Hata Noktası (Single Point of Failure - SPOF)

- **Risk:** Monolitik paylaşımlı sunucu mimarisinde sunucunun donanımsal arızası veya PostgreSQL servisinin durması tüm sistemi durdurabilir.
- **Azaltma Stratejisi:**
  - Systemd `Restart=always` ve `RestartSec=5` ile çöken servisler saniyeler içinde otomatik olarak yeniden başlatılır.
  - Günlük otomatik PostgreSQL ve medya yedekleri sunucu dışı bir hedefe (off-site backup) senkronize edilir.

---

## 2. Açık Sorular ve "Doğrulanması Gereken" Maddeler

1. **[Doğrulanması gereken] OpenLiteSpeed Context / Websocket Desteği:**
   CyberPanel / OpenLiteSpeed ters vekili arkasında Next.js Server-Sent Events (SSE) ve Medusa Admin gerçek zamanlı bildirimlerinin vhost context kuralları.
2. **[Doğrulanması gereken] PayTR Bildirim IP Blokları:**
   PayTR sunucularının webhook gönderdiği resmi IP bloklarının güncel listesi alınmalı ve sunucu güvenlik duvarında (UFW / CSF) beyaz listeye eklenmelidir.
3. **[Doğrulanması gereken] WordPress phpass Parola Aktarımı:**
   WooCommerce'teki mevcut müşteri parolalarının Medusa v2'ye taşınması teknik olarak mümkün olmayabileceği için tek tıkla parola sıfırlama stratejisinin kesinleştirilmesi.
