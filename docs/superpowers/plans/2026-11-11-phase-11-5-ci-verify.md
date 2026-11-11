# Faz 11.5 — CI'da Canlı Doğrulama Planı

Dal: `phase-11-5-ci-verify` (main @ dd62287, PR #21 merge sonrası). Worktree: `../CMS-worktrees/phase-11-5-ci-verify`.

## Kararlar (brainstorming)

- Sunucu modu: Medusa `medusa start` + `NODE_ENV=development` (sahte PayTR ve dev ödeme açık). Web: `next start` (WEB_PORT, varsayılan 3100) + yalnızca `verify:checkout` için `next dev` (WEB_DEV_PORT, varsayılan 3101). Güvenlik kapıları değişmez.
- `verify:all` sunucular çalışmıyorsa kendisi başlatır (aynı env ile), çalışıyorsa kullanır. `next dev` her zaman `verify:all` tarafından açılıp kapatılır.
- Publishable key `setup:store` çıktısından okunur, CI'da `$GITHUB_ENV`'e yazılır (web yalnızca çalışma anında `MEDUSA_PUBLISHABLE_KEY` okur, build'e gerek yok).

## Adımlar

### 0. PR #21 artıkları

1. `apps/web/src/tests/helpers/live.ts`: `LIVE_WEB_URL`, `LIVE_MEDUSA_URL`, `probeLiveServers()` (hata nedenini döner, yutmaz), `skipOrFail(ctx, reason)` (`REQUIRE_LIVE_SERVER=true` iken fırlatır), `launchChromium()` (`CHROME_PATH` ya da Playwright kurulu Chromium). Doğrulama: `pnpm --filter @alte/web test`.
2. a11y-axe, keyboard-nav, responsive-pagination, shipping-selection ve `scripts/verify-quality.ts`, `scripts/measure-quality.ts` bu yardımcıyı kullanır.
3. shipping-selection canlı testi: eşik `/store/shipping-rules`'tan okunur, stoklu ürünlerden adet hesaplanarak eşik aşılır, çerez adı gerçek `cart_id`. `catch { serverOnline=false }` kaldırılır.
4. `apps/web/src/lib/checkout/cart-checkout-guard.ts`: TTL (1 saat) + üst sınır (5000) olan tamamlanmış sipariş kaydı ve in-flight kilit. Birim test önce (TTL, üst sınır, finally temizliği route seviyesinde). `docs/RUNBOOK.md`: kilit süreç içidir.

### 1. `pnpm verify:all` (`scripts/verify-all.ts`)

5. Betik listesi, `verify-logs/<ad>.log`, `verify-logs/SUMMARY.md`, hepsi çalışır, biri bile düşerse çıkış ≠ 0. `.gitignore`'a `verify-logs/`.
6. Sunucu yönetimi (Medusa, next start, next dev) + sağlık bekleme (zaman aşımlı).
7. `measure:quality` (Lighthouse) en sona; ardından baseline'da `ölçülmedi` kontrolü.

### 2. CI `live-verify` işi

8. `ci.yml` içine ayrı iş: Postgres 16 / Redis 7 servisleri, sahte env, install → playwright → build → migrate (medusa + payload) → admin kullanıcı → `setup:store` (key export) → `seed:promotions` → `seed:fake` → `seed:content` → sunucuları başlat + sağlık → `pnpm verify:all` → artifact (her durumda).
9. `actions/upload-artifact` SHA'sı `git ls-remote` ile doğrulanır.

### 3. Koruma kuralları

10. ESLint `no-restricted-syntax`: `page.setContent(` yasak (`apps/web/src/tests/**`, `scripts/**`). Kök `lint:guards`. Test: `scripts/guards/eslint-guard.selftest.ts` ihlalli metni lint'leyip hata bekler.
11. `scripts/guards/check-quality-baseline.ts`: `ölçülmedi` varsa çıkış 1.
12. `scripts/guards/check-verify-scripts.ts`: `readFileSync` ile kaynak okuyup `.includes(` ile PASS üreten kalıp; izin listesi `scripts/verify-lint-allow.json`.
13. Negatif kontrol: `scripts/guards/verify-all-selftest.ts` → `verify-all` sahte başarısız betikle çalıştırılır, çıkış ≠ 0 ve SUMMARY'de FAIL beklenir.
14. `scripts/lib/verify-step.ts`: ortak `createVerifier()` → `recordStep` (PASS iken "Beklenen X, gelen Y" uyuşmazlığı varsa adım FAIL'e çevrilir) + `expectEqual` + `finish()`. Betikler buna taşınır, çıktı/akış korunur (fail-fast olanlar fail-fast kalır).

### 4. Şablon ve dokümanlar

15. `.github/pull_request_template.md`, `AGENTS.md` §4 (< 12.000 karakter), `docs/PHASES.md` §C, `docs/RUNBOOK.md`.

### 5. Dürüst doğrulama

16. Yerelde boş DB'de `verify:all`. Push → CI yeşil. Geçici bozma commit'i → `live-verify` kırmızı (link) → revert → yeşil (link).
