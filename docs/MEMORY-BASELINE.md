# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ✅ **GERÇEK ÖLÇÜM TAMAMLANDI**  
> **Tarih:** 2026-11-07T14:28:29.025Z  
> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Tepe RAM Tüketimi:** **646 MB** (Bütçe dahilinde: +454 MB rezerv)  
> **Ölçüm Yöntemi:** Process Tree Working Set (Windows 11) / RSS (Linux) + Docker Stats API. Her senaryoda 2 saniyelik periyotlarla ham örnekleme.

---

## 1. Özet Bellek Tüketim Tablosu

| Senaryo                      | Medusa v2 (Ort / Tepe) | Next.js + Payload (Ort / Tepe) | PostgreSQL (Ort / Tepe) | Redis (Ort / Tepe) | Toplam RAM (Ortalama) | Toplam RAM (Tepe) | Bütçe Durumu (~1.1 GB) |
| :--------------------------- | :--------------------: | :----------------------------: | :---------------------: | :----------------: | :-------------------: | :---------------: | :--------------------: |
| **Boşta (Idle 60s)**         |      222 / 223 MB      |          140 / 140 MB          |       43 / 44 MB        |      4 / 4 MB      |      **409 MB**       |    **411 MB**     |        ✅ UYGUN        |
| **20 Sayfa Gezme**           |      222 / 223 MB      |          142 / 144 MB          |       44 / 44 MB        |      4 / 4 MB      |      **412 MB**       |    **413 MB**     |        ✅ UYGUN        |
| **Hafif Yük (10 Eşzamanlı)** |      222 / 223 MB      |          179 / 203 MB          |       44 / 44 MB        |      4 / 4 MB      |      **449 MB**       |    **474 MB**     |        ✅ UYGUN        |
| **Seed 100 Ürün**            |      392 / 392 MB      |          203 / 203 MB          |       47 / 47 MB        |      4 / 4 MB      |      **646 MB**       |    **646 MB**     |        ✅ UYGUN        |
| **Seed 1000 Ürün**           |      403 / 403 MB      |          141 / 142 MB          |       70 / 73 MB        |      4 / 4 MB      |      **618 MB**       |    **621 MB**     |        ✅ UYGUN        |

---

## 2. Ham Ölçüm Dosyası

Detaylı saniye bazlı örnekler: `memory-baseline-1794061709025.csv`
