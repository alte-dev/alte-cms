# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ✅ **GERÇEK ÖLÇÜM TAMAMLANDI**  
> **Tarih:** 2026-11-07T14:59:33.321Z  
> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Tepe RAM Tüketimi:** **687 MB** (Bütçe dahilinde: +413 MB rezerv)  
> **Ölçüm Yöntemi:** Process Tree Working Set (Windows 11) / RSS (Linux) + Docker Stats API. Her senaryoda başlangıç tabanı, işlem sırası ve tohumlama sonrası en az 15 örnek ile 2 saniyelik periyotlarla ham örnekleme.

---

## 1. Özet Bellek Tüketim Tablosu

| Senaryo                      | Medusa v2 (Ort / Tepe) | Next.js + Payload (Ort / Tepe) | PostgreSQL (Ort / Tepe) | Redis (Ort / Tepe) | Toplam RAM (Ortalama) | Toplam RAM (Tepe) | Başarısız POST | Bütçe Durumu (~1.1 GB) |
| :--------------------------- | :--------------------: | :----------------------------: | :---------------------: | :----------------: | :-------------------: | :---------------: | :------------: | :--------------------: |
| **Boşta (Idle 60s)**         |      229 / 229 MB      |          144 / 144 MB          |       70 / 71 MB        |      4 / 4 MB      |      **447 MB**       |    **448 MB**     |     **0**      |        ✅ UYGUN        |
| **20 Sayfa Gezme**           |      230 / 230 MB      |          145 / 146 MB          |       70 / 71 MB        |      4 / 4 MB      |      **449 MB**       |    **450 MB**     |     **0**      |        ✅ UYGUN        |
| **Hafif Yük (10 Eşzamanlı)** |      231 / 231 MB      |          197 / 239 MB          |       70 / 71 MB        |      4 / 4 MB      |      **502 MB**       |    **544 MB**     |     **0**      |        ✅ UYGUN        |
| **Seed 100 Ürün**            |      357 / 370 MB      |          203 / 239 MB          |       73 / 74 MB        |      4 / 4 MB      |      **637 MB**       |    **687 MB**     |     **0**      |        ✅ UYGUN        |
| **Seed 1000 Ürün**           |      379 / 392 MB      |          120 / 144 MB          |       87 / 96 MB        |      4 / 4 MB      |      **590 MB**       |    **609 MB**     |     **0**      |        ✅ UYGUN        |

---

## 2. Ham Ölçüm Dosyası

Detaylı saniye bazlı örnekler: `memory-baseline-1794063573320.csv`
