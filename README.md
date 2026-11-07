# alte-cms

Modüler, genişletilebilir, modern e-ticaret ve içerik yönetim platformu (Medusa v2 + Next.js 15 + Payload CMS 3 + Puck).

> **Lisans:** belirlenmedi (Tüm hakları saklıdır. LICENSE dosyası henüz belirlenmemiştir.)

---

## 1. Mimariye Genel Bakış

Bu platform, tek mağazalı e-ticaret siteleri için yüksek performanslı ve modüler bir yapı sunar:

- **Ticaret Motoru (`apps/medusa`):** Medusa v2 tabanlı. Ürünler, stok, sepet, sipariş, kupon, müşteri ve ödeme/kargo akışlarının tek doğru kaynağıdır. Ayrı PostgreSQL veritabanı ve Redis kullanır.
- **Storefront & CMS (`apps/web`):** Next.js 15 (App Router) tabanlı. Kullanıcı arayüzünü (storefront) ve Payload CMS 3 yönetim panelini (`/admin` rotası altında) tek çatı altında sunar. İçerik ve sayfalar için ayrı PostgreSQL veritabanı kullanır.
- **Görsel Sayfa Düzenleyici:** Puck (React). Payload içerisinde JSON tabanlı sayfa blokları olarak yönetilir.

---

## 2. Sistem Gereksinimleri ve Ön Koşullar

1. **İşletim Sistemi:** Windows 11 (veya Linux / macOS)
2. **Node.js:** v22.x LTS (Detaylar için `.nvmrc` dosyasına bakınız)
3. **Paket Yöneticisi:** `pnpm` (v10+ önerilir)
4. **Veritabanı & Önbellek (Yerel Geliştirme):** Docker Desktop (PostgreSQL 16 ve Redis 7)
   > **Önemli Not:** Docker **yalnızca yerel geliştirme ve test ortamında** kullanılır. Üretim ortamında Docker **kullanılmayacaktır**.

---

## 3. Adım Adım Yerel Kurulum (Windows 11)

### Adım 1: Araçların Kurulumu

1. **Node.js LTS:** [nodejs.org](https://nodejs.org/) adresinden LTS sürümünü kurun veya `fnm` / `nvm` kullanın:
   ```bash
   nvm install 22
   nvm use 22
   ```
2. **pnpm Kurulumu:**
   ```bash
   corepack enable
   corepack prepare pnpm@latest --activate
   ```
3. **Docker Desktop:** [docker.com](https://www.docker.com/products/docker-desktop/) adresinden kurun ve WSL 2 tabanlı motorun çalıştığından emin olun.
4. **Gitleaks (Güvenlik Tarayıcısı):**
   ```powershell
   winget install Gitleaks.Gitleaks
   ```

### Adım 2: Bağımlılıkların Yüklenmesi

```bash
pnpm install
```

### Adım 3: Yerel Servisleri Başlatma (Docker Compose)

Yerel geliştirme veritabanlarını ve Redis'i başlatın:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Bu komut, sunucu koşullarını taklit eden düşük bellek ayarlarıyla (Postgres shared_buffers 64MB, Redis maxmemory 64MB) iki ayrı PostgreSQL veritabanı (`medusa_db` ve `payload_db`) ve Redis örneğini ayağa kaldırır.

### Adım 4: Ortam Değişkenlerini Tanımlama

Her iki uygulama için örnek `.env.example` dosyalarından `.env` oluşturun:

```bash
cp apps/medusa/.env.example apps/medusa/.env
cp apps/web/.env.example apps/web/.env
```

> Zorunlu ortam değişkenleri eksik olduğunda uygulamalar güvenlik sebebiyle başlamayacaktır (Fail-closed mimarisi).

### Adım 5: Geliştirme Modunda Çalıştırma

Tüm servisleri tek komutla başlatın:

```bash
pnpm dev
```

---

## 4. Yerel Adresler ve Ağ Yapılandırması

Yerel geliştirme ortamında servisler aşağıdaki port ve adreslerde çalışır:

| Servis                 | URL                           | Açıklama                                 |
| :--------------------- | :---------------------------- | :--------------------------------------- |
| **Web Storefront**     | `http://localhost:3100`       | Mağaza vitrini (Next.js)                 |
| **Payload CMS Admin**  | `http://localhost:3100/admin` | İçerik ve sayfa yönetim paneli           |
| **Medusa Admin & API** | `http://api.localhost:9000`   | Medusa v2 API ve yönetim paneli (`/app`) |
| **PostgreSQL (Local)** | `127.0.0.1:5432`              | Medusa ve Payload ayrı veritabanları     |
| **Redis (Local)**      | `127.0.0.1:6379`              | Medusa etkinlik ve önbellek kuyruğu      |

### Windows 11'de `*.localhost` Sorun Giderme

Modern tarayıcılar (Chrome, Edge, Firefox), RFC 6761 gereğince `*.localhost` alt alan adlarını (örn. `http://api.localhost:9000`) otomatik olarak loopback adresi olan `127.0.0.1`'e çözer.

Ancak Windows ortamında Node.js'in iç DNS çözümleyicisi (`c-ares`) ve bazı `curl` sürümleri `api.localhost` adresini her zaman çözemeyebilir. Bu nedenle uygulamada iki ayrı adres değişkeni kullanılır:

1. **İstemci (Tarayıcı) Tarafı:** `NEXT_PUBLIC_MEDUSA_URL=http://api.localhost:9000` (CORS ve çerezlerin çalışması için)
2. **Sunucu Tarafı (SSR, API Route, Hook):** `MEDUSA_BACKEND_URL=http://127.0.0.1:9000` (Doğrudan IP loopback erişimi)

#### Alternatif: Windows Hosts Dosyası Tanımı

Eğer tarayıcınız veya yerel araçlar `api.localhost` adresine erişemiyorsa:

1. Yönetici olarak Notepad veya favori editörünüzü açın.
2. `C:\Windows\System32\drivers\etc\hosts` dosyasını düzenleyin.
3. Şu satırı ekleyin:
   ```text
   127.0.0.1 api.localhost
   ```
4. Dosyayı kaydedin ve PowerShell'de DNS önbelleğini temizleyin:
   ```powershell
   ipconfig /flushdns
   ```

---

## 5. Test ve Doğrulama Komutları

- **Duman Testi (Smoke Test):**
  ```bash
  pnpm test:smoke
  ```
  Web uygulamasının Medusa API'ye hem sunucudan (`127.0.0.1:9000`) hem tarayıcı simülasyonundan (`api.localhost:9000`) erişebildiğini ve CORS ön kontrolünün (OPTIONS) çalıştığını doğrular.
- **Tip Kontrolü & Lint:**
  ```bash
  pnpm typecheck
  pnpm lint
  ```
- **Birim & Entegrasyon Testleri:**
  ```bash
  pnpm test
  ```
- **Secret Tarama (Gitleaks):**
  ```bash
  gitleaks detect --verbose
  ```
- **Bellek Ölçümü (Production Mod):**
  ```bash
  pnpm measure:memory
  ```

---

## 6. Public Depo ve Güvenlik Kuralları

Bu depo açık kaynaklıdır (Public). Bu nedenle:

- Hiçbir şifre, gizli anahtar (secret), token, sertifika veya `.env` dosyası commit edilemez.
- Canlı sunucu IP'leri, iç ağ yapılandırmaları ve gerçek müşteri/sipariş bilgileri depoda yer alamaz.
- Tüm commit'ler Git pre-commit hook'ları ve GitHub Actions CI üzerinden **Gitleaks** denetiminden geçer.
- Her faz `phase-N-kisa-ad` dalında geliştirilerek ana dala PR ile aktarılır.
