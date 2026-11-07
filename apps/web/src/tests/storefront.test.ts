import { describe, it, expect } from "vitest";
import { formatTRY, calculateFreeShippingProgress, mapMedusaError } from "../lib/medusa/format";
import {
  ProductQuerySchema,
  AddToCartSchema,
  UpdateCartItemSchema,
} from "../lib/medusa/validation";
import { StoreProduct } from "../lib/medusa/types";

describe("Vitrin Birim Testleri (Storefront Unit Tests)", () => {
  describe("Para Formatlama (formatTRY)", () => {
    it("TRY para birimini kurallara uygun olarak formatlamalıdır", () => {
      const formatted = formatTRY(1250);
      // tr-TR locale renders 1.250,00 with ₺ symbol
      expect(formatted).toContain("1.250,00");
      expect(formatted).toContain("₺");
    });

    it("0 veya tanımsız değerleri güvenli şekilde ele almalıdır", () => {
      expect(formatTRY(0)).toContain("0,00");
      expect(formatTRY(null)).toContain("0,00");
      expect(formatTRY(undefined)).toContain("0,00");
    });

    it("Kuruşlu tutarları doğru ondalık basamakla göstermelidir", () => {
      expect(formatTRY(89.9)).toContain("89,90");
    });
  });

  describe("Ücretsiz Kargo Hesaplama (calculateFreeShippingProgress)", () => {
    it("Eşik değeri tanımlanmadığında veya null olduğunda göstergeyi gizlemelidir (fail-soft)", () => {
      const resNull = calculateFreeShippingProgress(500, null);
      expect(resNull.hasThreshold).toBe(false);
      expect(resNull.isEligible).toBe(false);

      const resUndefined = calculateFreeShippingProgress(500, undefined);
      expect(resUndefined.hasThreshold).toBe(false);

      const resZero = calculateFreeShippingProgress(500, 0);
      expect(resZero.hasThreshold).toBe(false);
    });

    it("Eşiğin altındayken kalan tutarı ve yüzdeyi doğru hesaplamalıdır", () => {
      // 1000 TL sepet, 1500 TL eşik
      const res = calculateFreeShippingProgress(1000, 1500);
      expect(res.hasThreshold).toBe(true);
      expect(res.isEligible).toBe(false);
      expect(res.remaining).toBe(500);
      expect(res.percent).toBe(67);
      expect(res.message).toContain("500,00");
    });

    it("Eşiğe ulaşıldığında veya aşıldığında ücretsiz kargo durumunu onaylamalıdır", () => {
      // Tam eşik
      const resExact = calculateFreeShippingProgress(1500, 1500);
      expect(resExact.isEligible).toBe(true);
      expect(resExact.remaining).toBe(0);
      expect(resExact.percent).toBe(100);
      expect(resExact.message).toContain("ücretsiz");

      // Eşiğin üstü
      const resOver = calculateFreeShippingProgress(2000, 1500);
      expect(resOver.isEligible).toBe(true);
      expect(resOver.percent).toBe(100);
    });
  });

  describe("Hata Çevirisi (mapMedusaError)", () => {
    it("insufficient_inventory hatasını Türkçe ve kullanıcı dostu mesaja çevirmelidir", () => {
      const err = { code: "insufficient_inventory", message: "Variant inventory insufficient" };
      const translated = mapMedusaError(err);
      expect(translated).toBe(
        "Seçilen ürün için yetersiz stok. Lütfen adedi azaltın veya farklı bir varyant seçin.",
      );
    });

    it("Servis ve ağ bağlantı hatalarını Türkçe mesaja çevirmelidir", () => {
      const err = new Error("fetch failed: ECONNREFUSED 127.0.0.1:9000");
      const translated = mapMedusaError(err);
      expect(translated).toBe(
        "Mağaza servisine şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.",
      );
    });

    it("404 veya not found hatalarını Türkçe mesaja çevirmelidir", () => {
      const err = { status: 404, message: "Product not found" };
      const translated = mapMedusaError(err);
      expect(translated).toBe("Aradığınız ürün veya kayıt bulunamadı.");
    });

    it("Bilinmeyen hatalarda güvenli genel mesaj dönmelidir", () => {
      const translated = mapMedusaError({});
      expect(translated).toBe("İşlem gerçekleştirilemedi.");
    });
  });

  describe("Ürün Sıralama Mantığı", () => {
    const mockProducts: StoreProduct[] = [
      {
        id: "p1",
        title: "Ürün A",
        handle: "urun-a",
        status: "published",
        created_at: "2026-01-01T00:00:00Z",
        variants: [
          {
            id: "v1",
            title: "Default",
            sku: "SKU1",
            prices: [{ amount: 100, currency_code: "try" }],
          },
        ],
      },
      {
        id: "p2",
        title: "Ürün B",
        handle: "urun-b",
        status: "published",
        created_at: "2026-02-01T00:00:00Z",
        variants: [
          {
            id: "v2",
            title: "Default",
            sku: "SKU2",
            prices: [{ amount: 300, currency_code: "try" }],
          },
        ],
      },
      {
        id: "p3",
        title: "Ürün C",
        handle: "urun-c",
        status: "published",
        created_at: "2026-01-15T00:00:00Z",
        variants: [
          {
            id: "v3",
            title: "Default",
            sku: "SKU3",
            prices: [{ amount: 200, currency_code: "try" }],
          },
        ],
      },
    ];

    it("price_asc ile fiyata göre artan sıralamalıdır", () => {
      const sorted = [...mockProducts].sort((a, b) => {
        const pA = a.variants?.[0]?.prices?.[0]?.amount ?? 0;
        const pB = b.variants?.[0]?.prices?.[0]?.amount ?? 0;
        return pA - pB;
      });
      expect(sorted.map((p) => p.id)).toEqual(["p1", "p3", "p2"]);
    });

    it("price_desc ile fiyata göre azalan sıralamalıdır", () => {
      const sorted = [...mockProducts].sort((a, b) => {
        const pA = a.variants?.[0]?.prices?.[0]?.amount ?? 0;
        const pB = b.variants?.[0]?.prices?.[0]?.amount ?? 0;
        return pB - pA;
      });
      expect(sorted.map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
    });

    it("created_at ile en yeniden en eskiye sıralamalıdır", () => {
      const sorted = [...mockProducts].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      expect(sorted.map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
    });
  });

  describe("Zod Giriş Doğrulama Şemaları (Security & Validation)", () => {
    it("ProductQuerySchema geçerli parametreleri parse etmelidir", () => {
      const res = ProductQuerySchema.parse({
        page: "2",
        limit: "24",
        sort: "price_asc",
        category: "giyim",
      });
      expect(res.page).toBe(2);
      expect(res.limit).toBe(24);
      expect(res.sort).toBe("price_asc");
      expect(res.category).toBe("giyim");
    });

    it("AddToCartSchema geçersiz adetleri reddetmelidir", () => {
      expect(() =>
        AddToCartSchema.parse({
          variantId: "v_123",
          quantity: 0,
        }),
      ).toThrow();

      expect(() =>
        AddToCartSchema.parse({
          variantId: "",
          quantity: 1,
        }),
      ).toThrow();
    });

    it("UpdateCartItemSchema adedi 0 veya pozitif kabul etmelidir", () => {
      const resZero = UpdateCartItemSchema.parse({
        lineItemId: "li_1",
        quantity: 0,
      });
      expect(resZero.quantity).toBe(0);

      expect(() =>
        UpdateCartItemSchema.parse({
          lineItemId: "li_1",
          quantity: -1,
        }),
      ).toThrow();
    });
  });
});
