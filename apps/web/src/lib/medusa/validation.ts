import { z } from "zod";
import { TURKISH_CITIES } from "../constants/turkish-cities";

export const ProductSortSchema = z
  .enum(["created_at", "price_asc", "price_desc"])
  .optional()
  .default("created_at");

export type ProductSortOption = z.infer<typeof ProductSortSchema>;

export const ProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(12),
  sort: ProductSortSchema,
  category: z.string().trim().max(100).optional(),
  collection: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
});

export type ProductQueryInput = z.infer<typeof ProductQuerySchema>;

export const HandleParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .regex(/^[a-z0-9-]+$/, "Geçersiz handle formatı");

export const AddToCartSchema = z.object({
  variantId: z.string({ message: "Varyant seçimi zorunludur" }).min(1, "Varyant seçimi zorunludur"),
  quantity: z.coerce
    .number({ message: "Geçerli bir adet giriniz" })
    .int("Adet tam sayı olmalıdır")
    .min(1, "Adet 1 ile 99 arasında olmalıdır")
    .max(99, "Adet 1 ile 99 arasında olmalıdır"),
});

export const UpdateCartItemSchema = z.object({
  lineItemId: z
    .string({ message: "Sepet kalemi ID zorunludur" })
    .min(1, "Sepet kalemi ID zorunludur"),
  quantity: z.coerce
    .number({ message: "Geçerli bir adet giriniz" })
    .int("Adet tam sayı olmalıdır")
    .min(0, "Adet 0 veya daha fazla olmalıdır")
    .max(99, "Adet 99'dan fazla olamaz"),
});

/**
 * Normalizes Turkish mobile phone number to E.164 standard (+905XXXXXXXXX).
 * Returns null if format does not represent a valid Turkish mobile number.
 */
export function normalizeTurkishPhone(input: string): string | null {
  if (!input || typeof input !== "string") return null;

  // Strip all non-digit and non-plus characters
  const clean = input.replace(/[^\d+]/g, "");

  // Match variants:
  // 1) +905XXXXXXXXX (13 chars)
  // 2) 00905XXXXXXXXX (14 chars)
  // 3) 905XXXXXXXXX (12 chars)
  // 4) 05XXXXXXXXX (11 chars)
  // 5) 5XXXXXXXXX (10 chars)

  let digits = clean.startsWith("+") ? clean.slice(1) : clean;
  if (digits.startsWith("0090")) digits = digits.slice(4);
  else if (digits.startsWith("90")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (/^5\d{9}$/.test(digits)) {
    return `+90${digits}`;
  }

  return null;
}

export const TurkishPhoneSchema = z
  .string({ message: "Telefon numarası zorunludur." })
  .trim()
  .min(10, "Lütfen geçerli bir Türkiye cep telefonu numarası giriniz (örn: 05XX XXX XX XX).")
  .refine((val) => normalizeTurkishPhone(val) !== null, {
    message: "Lütfen geçerli bir Türkiye cep telefonu numarası giriniz (örn: 05XX XXX XX XX).",
  })
  .transform((val) => normalizeTurkishPhone(val)!);

export const CorporateTaxNumberSchema = z
  .string({ message: "Vergi numarası zorunludur." })
  .trim()
  .regex(/^\d{10}$/, "Vergi numarası tam 10 haneli rakamlardan oluşmalıdır.");

export const PostalCodeSchema = z
  .string()
  .trim()
  .optional()
  .refine((val) => !val || /^\d{5}$/.test(val), {
    message: "Posta kodu 5 haneli rakamlardan oluşmalıdır.",
  });

export const CitySchema = z
  .string({ message: "Şehir seçimi zorunludur." })
  .refine((val) => (TURKISH_CITIES as readonly string[]).includes(val), {
    message: "Lütfen listeden geçerli bir Türkiye ili seçiniz.",
  });

export const AddressInputSchema = z.object({
  firstName: z
    .string({ message: "Ad alanı zorunludur." })
    .trim()
    .min(2, "Ad en az 2 karakter olmalıdır.")
    .max(50, "Ad en fazla 50 karakter olabilir."),
  lastName: z
    .string({ message: "Soyad alanı zorunludur." })
    .trim()
    .min(2, "Soyad en az 2 karakter olmalıdır.")
    .max(50, "Soyad en fazla 50 karakter olabilir."),
  city: CitySchema,
  district: z
    .string({ message: "İlçe alanı zorunludur." })
    .trim()
    .min(2, "İlçe en az 2 karakter olmalıdır.")
    .max(60, "İlçe en fazla 60 karakter olabilir."),
  addressLine1: z
    .string({ message: "Adres alanı zorunludur." })
    .trim()
    .min(5, "Açık adres en az 5 karakter olmalıdır.")
    .max(255, "Açık adres en fazla 255 karakter olabilir."),
  addressLine2: z.string().trim().max(100).optional().default(""),
  postalCode: PostalCodeSchema,
  countryCode: z.literal("tr").default("tr"),
});

export const CheckoutFormSchema = z
  .object({
    email: z
      .string({ message: "E-posta adresi zorunludur." })
      .trim()
      .email("Lütfen geçerli bir e-posta adresi giriniz.")
      .max(100, "E-posta en fazla 100 karakter olabilir."),
    phone: TurkishPhoneSchema,
    deliveryAddress: AddressInputSchema,
    sameAsDelivery: z.boolean().default(true),
    billingAddress: AddressInputSchema.optional(),
    invoiceType: z.enum(["individual", "corporate"]).default("individual"),
    companyName: z.string().trim().max(150).optional(),
    taxOffice: z.string().trim().max(100).optional(),
    taxNumber: z.string().trim().optional(),
    shippingOptionId: z
      .string({ message: "Lütfen bir kargo seçeneği belirleyiniz." })
      .min(1, "Lütfen bir kargo seçeneği belirleyiniz."),
    paymentMethod: z.enum(["paytr", "cod", "dev"]).optional(),
    distanceSalesContract: z.literal(true, {
      message: "Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formunu onaylamalısınız.",
    }),
    kvkkConsent: z.literal(true, {
      message: "KVKK Aydınlatma Metnini onaylamalısınız.",
    }),
  })
  .superRefine((data, ctx) => {
    // If corporate invoice, companyName, taxOffice, and taxNumber (10 digits) are strictly required
    if (data.invoiceType === "corporate") {
      if (!data.companyName || data.companyName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companyName"],
          message: "Kurumsal fatura için şirket unvanı zorunludur.",
        });
      }
      if (!data.taxOffice || data.taxOffice.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["taxOffice"],
          message: "Kurumsal fatura için vergi dairesi zorunludur.",
        });
      }
      if (!data.taxNumber || !/^\d{10}$/.test(data.taxNumber.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["taxNumber"],
          message: "Kurumsal fatura için 10 haneli vergi numarası zorunludur.",
        });
      }
    }

    // If billing address is not same as delivery, validate billing address
    if (!data.sameAsDelivery) {
      if (!data.billingAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["billingAddress"],
          message:
            "Farklı fatura adresi seçildiğinde fatura adresi bilgileri eksiksiz girilmelidir.",
        });
      }
    }
  });

export type CheckoutFormInput = z.infer<typeof CheckoutFormSchema>;

export const ApplyCouponSchema = z.object({
  code: z
    .string({ message: "Kupon kodu giriniz." })
    .trim()
    .min(2, "Kupon kodu en az 2 karakter olmalıdır.")
    .max(50, "Kupon kodu en fazla 50 karakter olabilir.")
    .transform((v) => v.toUpperCase()),
});

export type ApplyCouponInput = z.infer<typeof ApplyCouponSchema>;
