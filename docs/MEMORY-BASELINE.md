# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ✅ **GERÇEK ÖLÇÜM TAMAMLANDI (Production Modu)**  
> **Tarih:** 2026-11-08T08:02:48.727Z  
> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Tepe RAM Tüketimi:** **801 MB** (Bütçe dahilinde: +299 MB rezerv)  
> **Ölçüm Yöntemi:** Process Tree Working Set (Windows 11) / RSS (Linux) + Docker Stats API. Her senaryoda başlangıç tabanı, işlem sırası ve tohumlama sonrası en az 15 örnek ile 2 saniyelik periyotlarla ham örnekleme.

---

## 1. Özet Bellek Tüketim Tablosu (Production Modu)

| Senaryo                      | Medusa v2 (Ort / Tepe) | Next.js + Payload (Ort / Tepe) | PostgreSQL (Ort / Tepe) | Redis (Ort / Tepe) | Toplam RAM (Ortalama) | Toplam RAM (Tepe) | Başarısız POST | Bütçe Durumu (~1.1 GB) |
| :--------------------------- | :--------------------: | :----------------------------: | :---------------------: | :----------------: | :-------------------: | :---------------: | :------------: | :--------------------: |
| **Boşta (Idle 60s)**         |      322 / 322 MB      |          146 / 147 MB          |       63 / 64 MB        |      4 / 4 MB      |      **535 MB**       |    **536 MB**     |     **0**      |        ✅ UYGUN        |
| **20 Sayfa Gezme**           |      324 / 324 MB      |          162 / 167 MB          |       64 / 69 MB        |      4 / 4 MB      |      **553 MB**       |    **559 MB**     |     **0**      |        ✅ UYGUN        |
| **Hafif Yük (10 Eşzamanlı)** |      378 / 410 MB      |          248 / 297 MB          |       85 / 87 MB        |      4 / 4 MB      |      **715 MB**       |    **795 MB**     |     **0**      |        ✅ UYGUN        |
| **Seed 100 Ürün**            |      411 / 411 MB      |          250 / 297 MB          |       68 / 90 MB        |      4 / 4 MB      |      **733 MB**       |    **801 MB**     |     **0**      |        ✅ UYGUN        |
| **Seed 1000 Ürün**           |      400 / 411 MB      |          163 / 163 MB          |       73 / 80 MB        |      4 / 5 MB      |      **641 MB**       |    **654 MB**     |     **0**      |        ✅ UYGUN        |

---

## 2. Faz 6 & Faz 6.1 Bellek ve Kaynak Analizi

1. **Harici Arama Motoru İzolasyonu:** Meilisearch, Elasticsearch veya Typesense gibi harici arama servisleri (JVM/Go tabanlı ek 300–600 MB RAM tüketen) kesinlikle projeye dahil edilmemiştir. Arama dizini ve sıralama işlemleri PostgreSQL üzerindeki `unaccent` ve `pg_trgm` GIN indeksleri ile doğrudan mevcut veritabanı içinde çözülmüştür.
2. **E-posta ve Kargo Bildirimleri:** `nodemailer` ve dahili olay yöneticisi (event subscribers) Node.js heap belleğine yalnızca ~4 MB ek yük getirmektedir.
3. **Vitrin Sipariş Takip Rotası (`/siparis-takip`):** Yalnızca **178 B** First Load JS ayak izi ile istemci ve sunucu RAM kullanımına etkisi ihmal edilebilir düzeydedir (< 1 MB).
4. **Sonuç:** Tepe bellek kullanımı **801 MB** seviyesinde kalmakta olup, **1100 MB** üst sınır bütçesinin yaklaşık **%73'ünü** kullanmaktadır (+299 MB emniyet payı).

---

## 3. Ham Ölçüm Dosyası

Detaylı saniye bazlı örnekler: `memory-baseline-1794124968726.csv`
