# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ✅ **GERÇEK ÖLÇÜM TAMAMLANDI**  
> **Tarih:** 2026-11-07T21:40:03.244Z  
> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Tepe RAM Tüketimi:** **2440 MB** (Bütçe aşıldı: -1340 MB)  
> **Ölçüm Yöntemi:** Process Tree Working Set (Windows 11) / RSS (Linux) + Docker Stats API. Her senaryoda başlangıç tabanı, işlem sırası ve tohumlama sonrası en az 15 örnek ile 2 saniyelik periyotlarla ham örnekleme.

---

## 1. Özet Bellek Tüketim Tablosu

| Senaryo                      | Medusa v2 (Ort / Tepe) | Next.js + Payload (Ort / Tepe) | PostgreSQL (Ort / Tepe) | Redis (Ort / Tepe) | Toplam RAM (Ortalama) | Toplam RAM (Tepe) | Başarısız POST | Bütçe Durumu (~1.1 GB) |
| :--------------------------- | :--------------------: | :----------------------------: | :---------------------: | :----------------: | :-------------------: | :---------------: | :------------: | :--------------------: |
| **Boşta (Idle 60s)**         |      345 / 468 MB      |         1266 / 1266 MB         |      107 / 128 MB       |      4 / 4 MB      |      **1721 MB**      |    **1866 MB**    |     **0**      |       ❌ AŞILDI        |
| **20 Sayfa Gezme**           |      261 / 298 MB      |         1321 / 1375 MB         |      106 / 110 MB       |      4 / 4 MB      |      **1692 MB**      |    **1781 MB**    |     **0**      |       ❌ AŞILDI        |
| **Hafif Yük (10 Eşzamanlı)** |      412 / 424 MB      |         1669 / 1883 MB         |      128 / 130 MB       |      4 / 4 MB      |      **2213 MB**      |    **2440 MB**    |     **0**      |       ❌ AŞILDI        |
| **Seed 100 Ürün**            |      417 / 424 MB      |         1675 / 1675 MB         |      111 / 132 MB       |      4 / 4 MB      |      **2207 MB**      |    **2232 MB**    |     **0**      |       ❌ AŞILDI        |
| **Seed 1000 Ürün**           |      379 / 391 MB      |         1675 / 1675 MB         |      104 / 122 MB       |      4 / 5 MB      |      **2162 MB**      |    **2174 MB**    |     **0**      |       ❌ AŞILDI        |

---

## 2. Ham Ölçüm Dosyası

Detaylı saniye bazlı örnekler: `memory-baseline-1794087603243.csv`
