# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ✅ **GERÇEK ÖLÇÜM TAMAMLANDI**  
> **Tarih:** 2026-11-07T16:08:12.913Z  
> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Tepe RAM Tüketimi:** **684 MB** (Bütçe dahilinde: +416 MB rezerv)  
> **Ölçüm Yöntemi:** Process Tree Working Set (Windows 11) / RSS (Linux) + Docker Stats API. Her senaryoda başlangıç tabanı, işlem sırası ve tohumlama sonrası en az 15 örnek ile 2 saniyelik periyotlarla ham örnekleme.

---

## 1. Özet Bellek Tüketim Tablosu

| Senaryo                      | Medusa v2 (Ort / Tepe) | Next.js + Payload (Ort / Tepe) | PostgreSQL (Ort / Tepe) | Redis (Ort / Tepe) | Toplam RAM (Ortalama) | Toplam RAM (Tepe) | Başarısız POST | Bütçe Durumu (~1.1 GB) |
| :--------------------------- | :--------------------: | :----------------------------: | :---------------------: | :----------------: | :-------------------: | :---------------: | :------------: | :--------------------: |
| **Boşta (Idle 60s)**         |      243 / 249 MB      |          140 / 145 MB          |       63 / 63 MB        |      5 / 5 MB      |      **451 MB**       |    **462 MB**     |     **0**      |        ✅ UYGUN        |
| **20 Sayfa Gezme**           |      250 / 250 MB      |          149 / 151 MB          |       63 / 63 MB        |      5 / 5 MB      |      **467 MB**       |    **469 MB**     |     **0**      |        ✅ UYGUN        |
| **Hafif Yük (10 Eşzamanlı)** |      251 / 251 MB      |          194 / 246 MB          |       63 / 63 MB        |      5 / 5 MB      |      **513 MB**       |    **565 MB**     |     **0**      |        ✅ UYGUN        |
| **Seed 100 Ürün**            |      343 / 354 MB      |          209 / 246 MB          |       69 / 83 MB        |      5 / 5 MB      |      **625 MB**       |    **684 MB**     |     **0**      |        ✅ UYGUN        |
| **Seed 1000 Ürün**           |      375 / 381 MB      |          150 / 153 MB          |       75 / 83 MB        |      5 / 5 MB      |      **605 MB**       |    **615 MB**     |     **0**      |        ✅ UYGUN        |

---

## 2. Ham Ölçüm Dosyası

Detaylı saniye bazlı örnekler: `memory-baseline-1794067692912.csv`
