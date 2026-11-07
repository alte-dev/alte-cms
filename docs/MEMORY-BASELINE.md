# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ✅ **GERÇEK ÖLÇÜM TAMAMLANDI**  
> **Tarih:** 2026-11-07T19:48:39.261Z  
> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Tepe RAM Tüketimi:** **857 MB** (Bütçe dahilinde: +243 MB rezerv)  
> **Ölçüm Yöntemi:** Process Tree Working Set (Windows 11) / RSS (Linux) + Docker Stats API. Her senaryoda başlangıç tabanı, işlem sırası ve tohumlama sonrası en az 15 örnek ile 2 saniyelik periyotlarla ham örnekleme.

---

## 1. Özet Bellek Tüketim Tablosu

| Senaryo                      | Medusa v2 (Ort / Tepe) | Next.js + Payload (Ort / Tepe) | PostgreSQL (Ort / Tepe) | Redis (Ort / Tepe) | Toplam RAM (Ortalama) | Toplam RAM (Tepe) | Başarısız POST | Bütçe Durumu (~1.1 GB) |
| :--------------------------- | :--------------------: | :----------------------------: | :---------------------: | :----------------: | :-------------------: | :---------------: | :------------: | :--------------------: |
| **Boşta (Idle 60s)**         |      307 / 353 MB      |          153 / 154 MB          |       67 / 72 MB        |      4 / 5 MB      |      **532 MB**       |    **583 MB**     |     **0**      |        ✅ UYGUN        |
| **20 Sayfa Gezme**           |      276 / 325 MB      |          162 / 167 MB          |       68 / 74 MB        |      4 / 5 MB      |      **510 MB**       |    **566 MB**     |     **0**      |        ✅ UYGUN        |
| **Hafif Yük (10 Eşzamanlı)** |      419 / 440 MB      |          262 / 320 MB          |       92 / 94 MB        |      4 / 4 MB      |      **777 MB**       |    **857 MB**     |     **0**      |        ✅ UYGUN        |
| **Seed 100 Ürün**            |      436 / 440 MB      |          264 / 320 MB          |       76 / 97 MB        |      4 / 5 MB      |      **780 MB**       |    **856 MB**     |     **0**      |        ✅ UYGUN        |
| **Seed 1000 Ürün**           |      403 / 419 MB      |          160 / 160 MB          |       78 / 87 MB        |      4 / 5 MB      |      **644 MB**       |    **665 MB**     |     **0**      |        ✅ UYGUN        |

---

## 2. Fazlar Arası Karşılaştırmalı Bellek Tüketimi (Faz 0 vs Faz 1 vs Faz 2)

| Senaryo                      | Faz 0 (Temel İskelet) | Faz 1 (TR Yapılandırma) |  Faz 2 (Vitrin & Sepet)  | Değişim / Analiz                                                                     |
| :--------------------------- | :-------------------: | :---------------------: | :----------------------: | :----------------------------------------------------------------------------------- |
| **Boşta (Idle 60s)**         |        ~451 MB        |         ~480 MB         | **532 MB (Tepe 583 MB)** | Vitrin route grupları ve Medusa kargo kuralları modülü sonrası stabil +80 MB taban.  |
| **20 Sayfa Gezme**           |        ~467 MB        |         ~495 MB         | **510 MB (Tepe 566 MB)** | Next.js 15 SSR sayfa rendering ve görsel placeholder yükü altında stabil.            |
| **Hafif Yük (10 Eşzamanlı)** |        ~513 MB        |         ~560 MB         | **777 MB (Tepe 857 MB)** | SSR vitrin dinamik sepet sorguları ve Medusa hesaplama çağrıları eşzamanlı tüketimi. |
| **Seed 100 Ürün**            |        ~625 MB        |         ~650 MB         | **780 MB (Tepe 856 MB)** | 100 ürün tohumlama, varyant ve indirim fiyat listesi ilişkilendirmesi.               |
| **Seed 1000 Ürün**           |        ~605 MB        |         ~630 MB         | **644 MB (Tepe 665 MB)** | Batch aktarımı ve çöp toplama (GC) sonrası stabil bellek tahliyesi.                  |

> **Bütçe Değerlendirmesi:**  
> Medusa tepe bellek: **440 MB** (Sınır: 512 MB, bütçe altında ✅)  
> Web Storefront tepe bellek: **320 MB** (Sınır: 384 MB, bütçe altında ✅)  
> Toplam sistem tepe tüketimi: **857 MB** (Sınır: 1.100 MB, +243 MB güvenli rezerv ✅)

---

## 3. Ham Ölçüm Dosyası

Detaylı saniye bazlı örnekler: `memory-baseline-1794080919260.csv`
