# Katkı ve Süreç Rehberi (CONTRIBUTING.md)

Bu doküman, projede yürütülen tüm geliştirme, test ve sürümleme süreçlerinde uyulması zorunlu kuralları tanımlar.

---

## 1. Dal (Branch) ve PR Süreç Kuralları

1. **`main` Dalına Doğrudan Push YASAKTIR:**

   - `main` dalına doğrudan commit pushlanamaz.
   - Tüm geliştirme ve düzeltmeler görev bazlı dallar üzerinden yürütülür (`phase-X-...`, `feat/...`, `fix/...`).

2. **Conventional Commits:**

   - Değişiklikler küçük, mantıksal ve atomik parçalara bölünerek conventional commit standardına uygun mesajlarla kaydedilir (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).

3. **Pull Request (PR) ve CI Zorunluluğu:**
   - Geliştirme dalı GitHub'a pushlandıktan sonra bir PR açılır.
   - GitHub Actions CI iş akışı (`Security Scan, Quality & Build`) tamamen yeşil (başarılı) olmadan hiçbir PR merge edilemez.
   - Merge işlemi yalnızca repo sahibi / kullanıcı tarafından gerçekleştirilir; botlar veya agentlar kendi kendine merge yapamaz.

---

## 2. Güvenlik ve Kimlik Bilgileri Kuralı

> [!IMPORTANT] > **Yerel admin parolaları sadece geliştirme içindir; staging/production'da güçlü, benzersiz parola kullanılır.**

- `.env` dosyaları asla git deposuna eklenemez (`.gitignore` ile korunur).
- Yerel Docker ve tohumlama script'lerindeki parolalar açıkça sahte `dev-only-*` etiketli olup yalnızca izole geliştirme ortamında çalışır.
- Üretim ortamında `pnpm create-admin` veya güvenli ortam değişkenleri haricinde hiçbir varsayılan kimlik bilgisi kullanılamaz.

---

## 3. Mühendislik ve Ölçüm İlkeleri

- **Fail-Closed Yaklaşımı:** Bir servis, port veya bağımlılık çalışmıyorsa hata verip durulur (`exit 1`).
- **Sıfır Simülasyon Kuralı:** Ölçüm, test, build, audit veya tarama sonuçlarında sentetik, simüle edilmiş veya sabit fallback değerler üretilmez.
- **Temiz Ortam Doğrulaması:** Her faz teslimatında temiz bir klon (`git clone /tmp/...`) üzerinde lockfile bütünlüğü ve test paketleri doğrulanır.
