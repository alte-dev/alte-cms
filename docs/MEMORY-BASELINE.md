# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ✅ **GERÇEK ÖLÇÜM TAMAMLANDI (Production Modu)**  
> **Tarih:** 2026-11-08T06:39:27.616Z  
> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Tepe RAM Tüketimi:** **765 MB** (Bütçe dahilinde: +335 MB rezerv)  
> **Ölçüm Yöntemi:** Process Tree Working Set (Windows 11) / RSS (Linux) + Docker Stats API. Her senaryoda başlangıç tabanı, işlem sırası ve tohumlama sonrası en az 15 örnek ile 2 saniyelik periyotlarla ham örnekleme.

---

## 1. Özet Bellek Tüketim Tablosu (Production Modu)

| Senaryo | Medusa v2 (Ort / Tepe) | Next.js + Payload (Ort / Tepe) | PostgreSQL (Ort / Tepe) | Redis (Ort / Tepe) | Toplam RAM (Ortalama) | Toplam RAM (Tepe) | Başarısız POST | Bütçe Durumu (~1.1 GB) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Boşta (Idle 60s)** | 255 / 255 MB | 155 / 155 MB | 53 / 54 MB | 5 / 5 MB | **468 MB** | **469 MB** | **0** | ✅ UYGUN |
| **20 Sayfa Gezme** | 260 / 265 MB | 162 / 167 MB | 54 / 60 MB | 5 / 5 MB | **482 MB** | **488 MB** | **0** | ✅ UYGUN |
| **Hafif Yük (10 Eşzamanlı)** | 376 / 399 MB | 250 / 290 MB | 75 / 78 MB | 5 / 5 MB | **706 MB** | **765 MB** | **0** | ✅ UYGUN |
| **Seed 100 Ürün** | 401 / 402 MB | 234 / 281 MB | 57 / 77 MB | 4 / 4 MB | **696 MB** | **763 MB** | **0** | ✅ UYGUN |
| **Seed 1000 Ürün** | 401 / 410 MB | 159 / 160 MB | 59 / 67 MB | 4 / 5 MB | **624 MB** | **636 MB** | **0** | ✅ UYGUN |

---

## 2. Ham Ölçüm Dosyası
Detaylı saniye bazlı örnekler: `memory-baseline-1794119967615.csv`
