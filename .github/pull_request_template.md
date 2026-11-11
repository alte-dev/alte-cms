## Kontrol Listesi (Zorunlu)

- [ ] `security-and-quality` CI işi yeşil (`gitleaks`, `format:check`, `lint`, `check:baseline`, `check:verify-scripts`, `typecheck`, `test`, `build`, `audit`)
- [ ] `live-verify` CI işi yeşil (`pnpm verify:all` tüm adımlar PASS, canlı tarayıcı testleri `REQUIRE_LIVE_SERVER=true` ile çalıştı ve 0 skipped, `verify-logs/` artifact yüklendi)
- [ ] Yeni özellik varsa kendi `verify-*` betiği veya adımı eklendi ve `verify:all`'a bağlandı
- [ ] Önce başarısız olan test/doğrulama yazıldı, sonra düzeltildi (TDD kanıtı)
- [ ] `docs/QUALITY-BASELINE.md` güncellendiyse içinde `"ölçülmedi"` yok, ölçüm `next start` / `medusa start` üzerinde alındı
- [ ] Gerçek sır, parola, IP, alan adı, müşteri verisi yok
- [ ] Yeni bağımlılık eklendiyse tam sürüm pinli ve >= 2 haftalık

## Doğrulama Özeti (`verify-logs/SUMMARY.md`)

<!-- verify-logs/SUMMARY.md tablosunu veya ilgili CI çalışma bağlantılarını buraya ekleyin -->

## Yapılamayanlar / Bilinen Kısıtlar

<!-- Yapılamayan her maddeyi açıkça listeleyin -->
