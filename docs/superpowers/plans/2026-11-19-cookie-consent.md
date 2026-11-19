# Çerez Onay Altyapısı Uygulama Planı

## Adım 1: Çekirdek çerez rıza mantığı (TDD)

- **Dosyalar:** `apps/web/src/lib/cookie-consent.test.ts`, `apps/web/src/lib/cookie-consent.ts`, `apps/web/src/lib/cookie-consent-server.ts`
- **Doğrulama:** `pnpm --filter @alte/web test`

## Adım 2: Payload `SiteSettings` alanları + Migration + Seed

- **Dosyalar:** `apps/web/src/globals/SiteSettings.ts`, yeni migration dosyası (`pnpm --filter @alte/web migrate:create add_cookie_consent_settings`), `apps/web/src/scripts/seed-content.ts`
- **Doğrulama:** `pnpm --filter @alte/web migrate` ve `pnpm --filter @alte/web typecheck`

## Adım 3: İstemci bileşenleri ve layout/footer/iletişim entegrasyonu

- **Dosyalar:**
  - `apps/web/src/components/cookie-consent/CookieConsentProvider.tsx`
  - `apps/web/src/components/cookie-consent/CookieConsentBanner.tsx`
  - `apps/web/src/components/cookie-consent/CookiePreferencesModal.tsx`
  - `apps/web/src/components/cookie-consent/CookiePreferencesTrigger.tsx`
  - `apps/web/src/components/cookie-consent/ConsentGate.tsx`
  - `apps/web/src/components/cookie-consent/GoogleMapConsentFrame.tsx`
  - `apps/web/src/app/(store)/layout.tsx`
  - `apps/web/src/app/(checkout)/layout.tsx`
  - `apps/web/src/components/footer.tsx`
  - `apps/web/src/app/(store)/iletisim/page.tsx`
- **Doğrulama:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`

## Adım 4: Canlı doğrulama betiği ve regresyon güncellemesi

- **Dosyalar:** `scripts/verify-cookie-consent.ts`, `scripts/verify-contact.ts`, `scripts/verify-all.ts`, `package.json`
- **Doğrulama:** `pnpm check:verify-scripts`, `pnpm verify:cookie-consent`, `pnpm verify:contact`, `pnpm verify:quality`

## Adım 5: Tam kalite kapısı, PR ve CI doğrulaması

- **Komutlar:** `pnpm format:check`, `pnpm lint`, `pnpm check:baseline`, `pnpm check:verify-scripts`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit --prod --audit-level=high`, canlı doğrulama, PR açma ve GitHub Actions `security-and-quality` + `live-verify` yeşil kontrolü.
