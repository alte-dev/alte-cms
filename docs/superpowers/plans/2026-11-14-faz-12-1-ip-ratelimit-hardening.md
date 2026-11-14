# Faz 12.1 — PR #24 IP & Rate Limit Güvenlik Düzeltmesi

**Hedef:** Sahte `X-Real-IP` / `X-Forwarded-For` başlıklarıyla giriş, kayıt, şifre sıfırlama ve doğrulama hız sınırlarının atlatılmasını engellemek; IP'den bağımsız e-posta başı kaba kuvvet koruması eklemek; bellek içi hız sınırlayıcılarda gerçek `maxEntries` FIFO taşma koruması sağlamak.

**Kapsam:** Yalnızca `phase-12-customer-accounts` dalında (PR #24). Yeni PR açılmaz, mevcut PR güncellenir.

## Adımlar

1. **`extractClientIp` sertleştirme (`apps/web/src/lib/security/origin-guard.ts`, `apps/web/src/env.ts`, `apps/web/.env.example`)**

   - `TRUST_PROXY` açık (`"true"` / `"1"`) değilken hiçbir istemci başlığına (`x-real-ip`, `x-forwarded-for`, `forwarded`) güvenme; sabit `"unknown"` döndür (fail-closed).
   - `TRUST_PROXY` açıkken yalnızca `x-forwarded-for` başlığını kullan ve `TRUSTED_PROXY_HOPS` (varsayılan `1`, aralık `1..10`) kadar **sondan** geriye giderek istemci IP'sini al.
   - Alınan değeri `node:net` `isIP()` ile doğrula (IPv4/IPv6); geçersizse `"unknown"` döndür.
   - Birim testleri: `apps/web/src/tests/origin-guard.test.ts` (kapalıyken sahte başlıkları yoksayma, açıkken sondan `HOPS` alma, baştaki sahte IP'yi yoksayma, geçersiz IP'de `"unknown"`).

2. **Bellek içi sınırlayıcılarda gerçek `maxEntries` sınırı (`apps/medusa/src/utils/rate-limiter.ts`)**

   - `FixedWindowRateLimiter` ve `BruteForceGuard`: süresi dolmuş kayıtlar temizlendikten sonra yeni anahtar eklenirken `entries.size >= maxEntries` ise en eski kayıtları (FIFO) silerek harita boyutunu `<= maxEntries` tut.
   - `size` getter'ı ekle ve `apps/medusa/src/utils/rate-limiter.test.ts` içinde `maxEntries + N` anahtar ile boyut sınırını doğrula.

3. **Medusa IP-bağımsız e-posta kaba kuvvet koruması (`apps/medusa/src/api/store/account/_shared.ts`, `login/route.ts`)**

   - `loginEmailGuard = new BruteForceGuard({ maxFailures: 20, blockDurationMs: 15 * 60_000 })` ekle.
   - `login/route.ts` içinde hem `loginIpEmailGuard` (`IP:email`, 5 deneme / 15 dk) hem `loginEmailGuard` (`email`, 20 deneme / 15 dk) kontrol et.
   - Başarılı girişte yalnızca `loginIpEmailGuard.clear(rateKey)` çağır; `loginEmailGuard` sıfırlanmasın.
   - `getTrustedClientIp` ve `requireInternalSecret` için birim testi ekle.

4. **Canlı HTTP doğrulama (`scripts/verify-accounts.ts`)**

   - `TRUST_PROXY` kapalıyken her istekte farklı `X-Real-IP` ve `X-Forwarded-For` ile aynı e-postaya hatalı giriş denemelerinde `429` döndüğünü doğrula.
   - E-posta başına limitin farklı bir e-postayı etkilemediğini ve limit dolmadan geçerli kullanıcının giriş yapabildiğini doğrula.

5. **Dokümantasyon (`docs/SECURITY-DESIGN.md`, `docs/RUNBOOK.md`)**

   - `TRUST_PROXY`, `TRUSTED_PROXY_HOPS`, OpenLiteSpeed/CyberPanel başlık üzerine yazma uyarısı ve e-posta başı eşik değerlerini belgele.

6. **Doğrulama**
   - `pnpm format:check`, `pnpm lint`, `pnpm check:baseline`, `pnpm check:verify-scripts`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit --prod --audit-level=high`, `gitleaks`.
   - `phase-12-customer-accounts` dalına push edip GitHub Actions `security-and-quality` ve `live-verify` işlerini doğrula.
