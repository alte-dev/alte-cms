# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ✅ **GERÇEK ÖLÇÜM TAMAMLANDI (Production Modu)**  
> **Tarih:** 2026-11-08T01:20:15.791Z  
> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Tepe RAM Tüketimi:** **812 MB** (Bütçe dahilinde: +288 MB rezerv)  
> **Ölçüm Yöntemi:** Process Tree Working Set (Windows 11) / RSS (Linux) + Docker Stats API. Her senaryoda başlangıç tabanı, işlem sırası ve tohumlama sonrası en az 15 örnek ile 2 saniyelik periyotlarla ham örnekleme.

---

## 1. Özet Bellek Tüketim Tablosu (Production Modu)

| Senaryo                      | Medusa v2 (Ort / Tepe) | Next.js + Payload (Ort / Tepe) | PostgreSQL (Ort / Tepe) | Redis (Ort / Tepe) | Toplam RAM (Ortalama) | Toplam RAM (Tepe) | Başarısız POST | Bütçe Durumu (~1.1 GB) |
| :--------------------------- | :--------------------: | :----------------------------: | :---------------------: | :----------------: | :-------------------: | :---------------: | :------------: | :--------------------: |
| **Boşta (Idle 60s)**         |      286 / 319 MB      |          153 / 153 MB          |       72 / 82 MB        |      4 / 5 MB      |      **515 MB**       |    **558 MB**     |     **0**      |        ✅ UYGUN        |
| **20 Sayfa Gezme**           |      269 / 274 MB      |          161 / 164 MB          |       74 / 79 MB        |      4 / 5 MB      |      **507 MB**       |    **514 MB**     |     **0**      |        ✅ UYGUN        |
| **Hafif Yük (10 Eşzamanlı)** |      379 / 406 MB      |          253 / 306 MB          |       96 / 97 MB        |      4 / 5 MB      |      **732 MB**       |    **812 MB**     |     **0**      |        ✅ UYGUN        |
| **Seed 100 Ürün**            |      405 / 405 MB      |          257 / 302 MB          |       80 / 101 MB       |      4 / 4 MB      |      **746 MB**       |    **811 MB**     |     **0**      |        ✅ UYGUN        |
| **Seed 1000 Ürün**           |      409 / 411 MB      |          155 / 157 MB          |       82 / 91 MB        |      4 / 5 MB      |      **650 MB**       |    **660 MB**     |     **0**      |        ✅ UYGUN        |

---

## 2. Ham Ölçüm Dosyası

Detaylı saniye bazlı örnekler: `memory-baseline-1794100815790.csv`
