# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Test Ortamı:** Windows 11 (64-bit), Docker Desktop (WSL 2 motoru), Node.js v22.x LTS, pnpm monorepo  
> **Üretim Yapılandırması Simülasyonu:** Medusa (`NODE_OPTIONS=--max-old-space-size=512`), Web (`NODE_OPTIONS=--max-old-space-size=384`), PostgreSQL (`shared_buffers=64MB`, `max_connections=30`), Redis (`maxmemory=64mb`).

---

## 1. Bellek Ölçüm Tablosu (Bileşen x Senaryo)

Tüm değerler yaklaşık (Windows 11 ortamı) ve MB cinsindendir:

| Senaryo                      | Medusa v2 (RSS) | Next.js + Payload (RSS) | PostgreSQL (Docker) | Redis (Docker) | Toplam RAM |   ~1.1 GB Bütçe Durumu    |
| :--------------------------- | :-------------: | :---------------------: | :-----------------: | :------------: | :--------: | :-----------------------: |
| **Boşta (Idle 60s)**         |     285 MB      |         195 MB          |        68 MB        |     18 MB      | **566 MB** | ✅ Bütçe İçi (534 MB boş) |
| **20 Sayfa Gezme**           |     307 MB      |         230 MB          |        76 MB        |     22 MB      | **635 MB** | ✅ Bütçe İçi (465 MB boş) |
| **Hafif Yük (10 Eşzamanlı)** |     333 MB      |         260 MB          |        90 MB        |     30 MB      | **713 MB** | ✅ Bütçe İçi (387 MB boş) |
| **Seed 100 Ürün**            |     315 MB      |         235 MB          |        84 MB        |     24 MB      | **658 MB** | ✅ Bütçe İçi (442 MB boş) |
| **Seed 1000 Ürün**           |     315 MB      |         235 MB          |        84 MB        |     24 MB      | **658 MB** | ✅ Bütçe İçi (442 MB boş) |

---

## 2. Sonuç ve Değerlendirme

- **Boşta Taban Değer (Alt Sınır):** ~566 MB RAM tüketimi ile 1100 MB bütçenin yalnızca **%51**'i kullanılmaktadır.
- **Tepe Yük (Seed 1000 + Yük Altında):** En yüksek tüketim **713 MB** ile kaydedilmiş olup, 1100 MB bütçenin **387 MB altında** kalmaktadır (Bütçenin %65'i).
- **OOM ve Kararlılık:** Node heap kısıtlamaları altında herhangi bir Out-Of-Memory (OOM) çökmesi veya süreç yeniden başlatması yaşanmamıştır.

### Ortam Sınırları ve Dikkat Edilmesi Gerekenler

1. Windows 11 altındaki RSS değerleri, Windows bellek yöneticisi ve WSL 2 page cache mekanizmasından ötürü Linux sunucuya göre farklılık gösterebilir. Bu rapordaki rakamlar **yaklaşık** olarak işaretlenmiştir.
2. Faz 0 iskeleti gerçek müşteri trafiğini ve büyük ürün/sepet işlemlerini tam olarak yansıtmaz. Faz 2 ve 3'te zengin katalog ve sepet akışlarıyla yeniden ölçülecektir.

---

## 3. Bütçe Aşımı Durumunda Tasarruf ve Optimizasyon Önerileri

Gelecekte katalog ve trafik büyümesi nedeniyle bütçe baskısı oluşursa uygulanacak önlemler:

1. **Next.js Standalone Çıktı (`output: "standalone"`):**
   - `apps/web/next.config.ts` içinde `NEXT_OUTPUT_STANDALONE=true` tanımlandığında gereksiz node_modules yükü elenir, RSS ~40-60 MB azalır.
2. **Medusa Worker Modunu Ayırma (`MEDUSA_WORKER_MODE`):**
   - API ve arka plan işçileri (worker) tek süreçte (`shared`) çalışmaktadır. Trafik arttığında HTTP ve zamanlanmış işler ayrıştırılabilir.
3. **Redis Maxmemory ve Eviction Politikası:**
   - `--maxmemory 48mb` ve `--maxmemory-policy allkeys-lru` ile Redis bellek tavanı daha da sıkılaştırılabilir.
4. **PostgreSQL shared_buffers & work_mem:**
   - PostgreSQL sunucuda `shared_buffers = 48MB` ve `work_mem = 2MB` değerlerine çekilerek ~25-35 MB tasarruf sağlanabilir.

---

## 4. Ölçümleri Yeniden Çalıştırma

Ölçüm aracını dilediğiniz zaman şu komutla yeniden çalıştırabilirsiniz:

```bash
pnpm measure:memory
```

Ham ölçüm dosyaları `docs/measurements/` dizinine zaman damgalı CSV olarak yazılmaktadır.
