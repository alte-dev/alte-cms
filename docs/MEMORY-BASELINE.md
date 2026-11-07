# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ⚠️ **ÖLÇÜLMEDİ**  
> **Tarih:** 2026-11-07T13:50:56.162Z  
> **Neden:** Yerel geliştirme servisleri veya Docker arka plan süreçleri kapalı:

- Medusa v2 (Port 9000): Port 9000 bellek ölçümü başarısız: Port 9000 üzerinde dinleyen aktif süreç bulunamadı.
- Web Storefront / Payload (Port 3100): Port 3100 bellek ölçümü başarısız: Port 3100 üzerinde dinleyen aktif süreç bulunamadı.
- PostgreSQL Docker (alte_postgres_dev): Docker konteynerine (alte_postgres_dev) erişilemedi: Command failed: docker stats --no-stream --format "{{.MemUsage}}" alte_postgres_dev
  failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.

- Redis Docker (alte_redis_dev): Docker konteynerine (alte_redis_dev) erişilemedi: Command failed: docker stats --no-stream --format "{{.MemUsage}}" alte_redis_dev
  failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.

> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Kural:** Sentetik, simüle edilmiş veya sabit fallback değerler kabul edilmez. Gerçek ortam servisleri başlatıldığında ölçüm komutu (`pnpm measure:memory`) çalıştırılarak bu dosya güncellenecektir.

---

## Servis Gereksinimleri

Ölçümün gerçekleştirilebilmesi için aşağıdaki bileşenlerin yerel makinede çalışır durumda olması zorunludur:

1. **Docker Desktop & Konteynerler:**
   - PostgreSQL: `alte_postgres_dev` (Port 5432)
   - Redis: `alte_redis_dev` (Port 6379)
2. **Medusa v2 API:**
   - Adres: `http://127.0.0.1:9000`
   - Heap Sınırı: `NODE_OPTIONS=--max-old-space-size=512`
3. **Storefront & Payload CMS:**
   - Adres: `http://localhost:3100`
   - Heap Sınırı: `NODE_OPTIONS=--max-old-space-size=384`

Servisler ayağa kaldırıldıktan sonra `pnpm measure:memory` çalıştırıldığında gerçek RSS ve Docker bellek değerleri 2 saniyelik periyotlarla örneklenip bu tabloya yazılacaktır.
