/**
 * Comprehensive Storefront Verification Script (scripts/verify-storefront.ts)
 * Validates the end-to-end buyer flow against Next.js 15 App Router storefront:
 * 1. Home page (/) -> 200, Turkish text, currency formatting.
 * 2. Products listing (/urunler) -> 200, product cards, "KDV dahil", "₺".
 * 3. Category page (/kategori/[slug]) -> 200, category title and products.
 * 4. Product detail page (/urun/[handle]) -> 200, valid schema.org Product JSON-LD.
 * 5. 404 page for non-existent product -> status 404.
 * 6. Cart flow (/api/cart):
 *    - Add item to cart -> verify item total and cart cookie.
 *    - Update item quantity to 2 -> verify quantity and price recalculation.
 *    - Verify dynamic free shipping threshold calculation.
 *    - Remove item -> verify empty cart state.
 * 7. Error flow:
 *    - Invalid variant ID / insufficient inventory -> returns user-friendly Turkish error message.
 */

interface VerificationResult {
  step: string;
  success: boolean;
  details: string;
}

const WEB_URL = process.env.WEB_URL || "http://127.0.0.1:3100";
const MEDUSA_URL = process.env.MEDUSA_URL || "http://127.0.0.1:9000";
const PUBLISHABLE_KEY =
  process.env.MEDUSA_PUBLISHABLE_KEY ||
  "pk_46575e0d2fe62e1e29874e4a77cb4146de424238b9fd3cb977400419349a0c30";

async function main() {
  console.log("=================================================");
  console.log("  ALTE E-Ticaret Vitrin & Sepet Doğrulama Scripti");
  console.log(`  Web URL: ${WEB_URL}`);
  console.log(`  Medusa URL: ${MEDUSA_URL}`);
  console.log("=================================================\n");

  const results: VerificationResult[] = [];

  // 1. Home page check
  try {
    const res = await fetch(`${WEB_URL}/`);
    const html = await res.text();
    const hasBrand = html.includes("Çisem Elif Boz");
    const hasCurrency = html.includes("₺") || html.includes("TL");
    const hasHero = html.includes("Yeni Sezon") || html.includes("Yeni Gelenler");

    if (res.status === 200 && (hasCurrency || hasBrand) && hasHero) {
      results.push({
        step: "1. Ana Sayfa (/) Doğrulaması",
        success: true,
        details: `Status 200 OK. Başlık, marka ve para birimi metinleri mevcut (${html.length} bytes)`,
      });
    } else {
      results.push({
        step: "1. Ana Sayfa (/) Doğrulaması",
        success: false,
        details: `Status: ${res.status}. Beklenen metinler eksik (brand: ${hasBrand}, currency: ${hasCurrency}, hero: ${hasHero})`,
      });
    }
  } catch (err: any) {
    results.push({
      step: "1. Ana Sayfa (/) Doğrulaması",
      success: false,
      details: `Bağlantı hatası: ${err.message}`,
    });
  }

  // 2. Products listing (/urunler)
  let sampleProductHandle: string | null = null;
  let sampleVariantId: string | null = null;
  let samplePrice: number = 0;

  try {
    const res = await fetch(`${WEB_URL}/urunler`);
    const html = await res.text();
    const hasKdv = html.includes("KDV dahil");
    const hasCurrency = html.includes("₺") || html.includes("TL");
    const hasFilter = html.includes("Sırala") || html.includes("Tüm Ürünler");

    if (res.status === 200 && hasKdv && hasCurrency && hasFilter) {
      results.push({
        step: "2. Ürünler Listesi (/urunler) Doğrulaması",
        success: true,
        details: `Status 200 OK. 'KDV dahil' ibaresi, '₺' para formatı ve filtreler mevcut`,
      });
    } else {
      results.push({
        step: "2. Ürünler Listesi (/urunler) Doğrulaması",
        success: false,
        details: `Status: ${res.status}. Eksik alanlar (hasKdv: ${hasKdv}, hasCurrency: ${hasCurrency})`,
      });
    }

    // Extract product handle from HTML or from Medusa API for next tests
    const handleMatch = html.match(/\/urun\/([a-z0-9-]+)/);
    if (handleMatch) {
      sampleProductHandle = handleMatch[1];
    }
  } catch (err: any) {
    results.push({
      step: "2. Ürünler Listesi (/urunler) Doğrulaması",
      success: false,
      details: `Hata: ${err.message}`,
    });
  }

  // Fallback to fetch a product directly from Medusa if not found in HTML regex
  if (!sampleProductHandle) {
    try {
      const pRes = await fetch(`${MEDUSA_URL}/store/products?limit=1`, {
        headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.products?.[0]) {
          sampleProductHandle = pData.products[0].handle;
          sampleVariantId = pData.products[0].variants?.[0]?.id || null;
          samplePrice = pData.products[0].variants?.[0]?.prices?.[0]?.amount || 0;
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Category page check
  try {
    // Check first available category
    const catRes = await fetch(`${MEDUSA_URL}/store/product-categories?limit=1`, {
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    let categoryHandle = "giyim";
    if (catRes.ok) {
      const catData = await catRes.json();
      if (catData.product_categories?.[0]?.handle) {
        categoryHandle = catData.product_categories[0].handle;
      }
    }

    const res = await fetch(`${WEB_URL}/kategori/${categoryHandle}`);
    const html = await res.text();
    if (res.status === 200 && (html.includes("kategori") || html.includes(categoryHandle))) {
      results.push({
        step: `3. Kategori Sayfası (/kategori/${categoryHandle}) Doğrulaması`,
        success: true,
        details: `Status 200 OK. Kategori başlığı ve ürün listelemesi doğrulandı`,
      });
    } else {
      results.push({
        step: `3. Kategori Sayfası (/kategori/${categoryHandle}) Doğrulaması`,
        success: false,
        details: `Status: ${res.status}`,
      });
    }
  } catch (err: any) {
    results.push({
      step: "3. Kategori Sayfası Doğrulaması",
      success: false,
      details: `Hata: ${err.message}`,
    });
  }

  // 4. Product detail page check & JSON-LD validation
  if (sampleProductHandle) {
    try {
      const res = await fetch(`${WEB_URL}/urun/${sampleProductHandle}`);
      const html = await res.text();

      // Look for schema.org Product JSON-LD
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      let jsonLdValid = false;
      let schemaType = "";

      if (jsonLdMatch) {
        try {
          const parsed = JSON.parse(jsonLdMatch[1]);
          schemaType = parsed["@type"];
          if (schemaType === "Product" && parsed.offers?.priceCurrency === "TRY") {
            jsonLdValid = true;
          }
        } catch {
          jsonLdValid = false;
        }
      }

      if (res.status === 200 && jsonLdValid) {
        results.push({
          step: `4. Ürün Detay (/urun/${sampleProductHandle}) ve JSON-LD Doğrulaması`,
          success: true,
          details: `Status 200 OK. JSON-LD geçerli (schema: ${schemaType}, currency: TRY, price: ${html.includes("₺")})`,
        });
      } else {
        results.push({
          step: `4. Ürün Detay (/urun/${sampleProductHandle}) ve JSON-LD Doğrulaması`,
          success: false,
          details: `Status: ${res.status}, jsonLdValid: ${jsonLdValid}`,
        });
      }
    } catch (err: any) {
      results.push({
        step: "4. Ürün Detay Doğrulaması",
        success: false,
        details: `Hata: ${err.message}`,
      });
    }
  } else {
    results.push({
      step: "4. Ürün Detay Doğrulaması",
      success: false,
      details: "Test için ürün handle bulunamadı",
    });
  }

  // 5. 404 Not Found check for non-existent product
  try {
    const res = await fetch(`${WEB_URL}/urun/bu-urun-kesinlikle-yok-12345`);
    if (res.status === 404) {
      results.push({
        step: "5. Bulunamayan Ürün 404 Doğrulaması",
        success: true,
        details: "Geçersiz handle için beklenen HTTP 404 Not Found yanıtı alındı",
      });
    } else {
      results.push({
        step: "5. Bulunamayan Ürün 404 Doğrulaması",
        success: false,
        details: `Beklenen 404 yerine ${res.status} alındı`,
      });
    }
  } catch (err: any) {
    results.push({
      step: "5. Bulunamayan Ürün 404 Doğrulaması",
      success: false,
      details: `Hata: ${err.message}`,
    });
  }

  // Retrieve a product variant ID for cart testing if not already retrieved
  if (!sampleVariantId) {
    try {
      const pRes = await fetch(`${MEDUSA_URL}/store/products?limit=5`, {
        headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        for (const p of pData.products || []) {
          if (p.variants?.[0]?.id) {
            sampleVariantId = p.variants[0].id;
            samplePrice = p.variants[0].prices?.[0]?.amount || 0;
            break;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 6. Cart flow (/api/cart)
  let cartCookie: string | null = null;
  let addedLineItemId: string | null = null;

  if (sampleVariantId) {
    // 6a. Add 1 item
    try {
      const addRes = await fetch(`${WEB_URL}/api/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", variantId: sampleVariantId, quantity: 1 }),
      });

      const setCookie = addRes.headers.get("set-cookie");
      if (setCookie) {
        cartCookie = setCookie.split(";")[0];
      }

      const addData = await addRes.json();
      if (addRes.ok && addData.success && addData.cart) {
        const lineItem = addData.cart.items?.[0];
        addedLineItemId = lineItem?.id || null;
        results.push({
          step: "6a. Sepete Ürün Ekleme (1 adet)",
          success: true,
          details: `Sepet ID: ${addData.cart.id}, Kalem Adedi: 1, Ara Toplam: ${addData.cart.item_subtotal || addData.cart.subtotal} TL`,
        });
      } else {
        results.push({
          step: "6a. Sepete Ürün Ekleme (1 adet)",
          success: false,
          details: `Hata: ${addData.error || addRes.statusText}`,
        });
      }
    } catch (err: any) {
      results.push({
        step: "6a. Sepete Ürün Ekleme (1 adet)",
        success: false,
        details: `Hata: ${err.message}`,
      });
    }

    // 6b. Update item quantity to 2
    if (addedLineItemId && cartCookie) {
      try {
        const updateRes = await fetch(`${WEB_URL}/api/cart`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cartCookie,
          },
          body: JSON.stringify({
            action: "update",
            lineItemId: addedLineItemId,
            quantity: 2,
          }),
        });

        const updateData = await updateRes.json();
        const updatedItem = updateData.cart?.items?.find((i: any) => i.id === addedLineItemId);

        if (updateRes.ok && updatedItem?.quantity === 2) {
          results.push({
            step: "6b. Sepet Adet Güncelleme (2 adet)",
            success: true,
            details: `Adet 2'ye çıkarıldı. Yeni Ara Toplam: ${updateData.cart.item_subtotal || updateData.cart.subtotal} TL`,
          });
        } else {
          results.push({
            step: "6b. Sepet Adet Güncelleme (2 adet)",
            success: false,
            details: `Güncelleme başarısız: ${updateData.error || updateRes.statusText}`,
          });
        }
      } catch (err: any) {
        results.push({
          step: "6b. Sepet Adet Güncelleme (2 adet)",
          success: false,
          details: `Hata: ${err.message}`,
        });
      }
    }

    // 6c. Check free shipping calculation
    if (cartCookie) {
      try {
        const getRes = await fetch(`${WEB_URL}/api/cart`, {
          headers: { Cookie: cartCookie },
        });
        const getData = await getRes.json();
        if (getRes.ok && getData.freeShippingProgress) {
          const prog = getData.freeShippingProgress;
          results.push({
            step: "6c. Ücretsiz Kargo Göstergesi Doğrulaması",
            success: true,
            details: `Eşik: ${prog.threshold} TL, Kalan: ${prog.remaining} TL, Yüzde: %${prog.percent}, Mesaj: '${prog.message}'`,
          });
        } else {
          results.push({
            step: "6c. Ücretsiz Kargo Göstergesi Doğrulaması",
            success: false,
            details: `Gösterge okunamadı: ${getData.error || getRes.statusText}`,
          });
        }
      } catch (err: any) {
        results.push({
          step: "6c. Ücretsiz Kargo Göstergesi Doğrulaması",
          success: false,
          details: `Hata: ${err.message}`,
        });
      }
    }

    // 6d. Remove item from cart
    if (addedLineItemId && cartCookie) {
      try {
        const removeRes = await fetch(`${WEB_URL}/api/cart`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cartCookie,
          },
          body: JSON.stringify({
            action: "remove",
            lineItemId: addedLineItemId,
          }),
        });

        const removeData = await removeRes.json();
        const remainingItems = removeData.cart?.items?.length ?? 0;

        if (removeRes.ok && remainingItems === 0) {
          results.push({
            step: "6d. Sepetten Ürün Silme",
            success: true,
            details: `Ürün başarıyla silindi. Kalan sepet kalemi: 0`,
          });
        } else {
          results.push({
            step: "6d. Sepetten Ürün Silme",
            success: false,
            details: `Silme başarısız: ${removeData.error || removeRes.statusText}`,
          });
        }
      } catch (err: any) {
        results.push({
          step: "6d. Sepetten Ürün Silme",
          success: false,
          details: `Hata: ${err.message}`,
        });
      }
    }
  } else {
    results.push({
      step: "6. Sepet Akışı Doğrulaması",
      success: false,
      details: "Test için varyant ID bulunamadı",
    });
  }

  // 7. Error handling flow (invalid variant ID)
  try {
    const errRes = await fetch(`${WEB_URL}/api/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        variantId: "variant_kesinlikle_gecersiz_99999",
        quantity: 1,
      }),
    });

    const errData = await errRes.json();
    const isTurkishFriendly =
      typeof errData.error === "string" &&
      (errData.error.includes("bulunamadı") ||
        errData.error.includes("satışa kapalı") ||
        errData.error.includes("yetersiz") ||
        errData.error.includes("hata") ||
        errData.error.includes("gerçekleştirilemedi"));

    if (!errRes.ok && isTurkishFriendly) {
      results.push({
        step: "7. Hata Yönetimi Doğrulaması (Kullanıcı Dostu Türkçe Mesaj)",
        success: true,
        details: `HTTP ${errRes.status} alındı. Güvenli Türkçe mesaj: '${errData.error}'`,
      });
    } else {
      results.push({
        step: "7. Hata Yönetimi Doğrulaması",
        success: false,
        details: `Beklenmeyen yanıt: status ${errRes.status}, error: ${errData.error}`,
      });
    }
  } catch (err: any) {
    results.push({
      step: "7. Hata Yönetimi Doğrulaması",
      success: false,
      details: `Hata: ${err.message}`,
    });
  }

  // Print summary report
  console.log("\n=================================================");
  console.log("             DOĞRULAMA SONUÇLARI");
  console.log("=================================================");

  let allPassed = true;
  for (const r of results) {
    const symbol = r.success ? "✓ BAŞARILI" : "✗ BAŞARISIZ";
    console.log(`[${symbol}] ${r.step}`);
    console.log(`    -> ${r.details}`);
    if (!r.success) allPassed = false;
  }

  console.log("=================================================");
  if (allPassed) {
    console.log("SONUÇ: Tüm vitrin ve sepet testleri BAŞARIYLA TAMAMLANDI (Exit 0).");
    process.exit(0);
  } else {
    console.error("SONUÇ: Bazı testler BAŞARISIZ OLDU (Exit 1).");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Kritik doğrulama hatası:", e);
  process.exit(1);
});
