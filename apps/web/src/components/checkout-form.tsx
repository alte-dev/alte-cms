"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { TURKISH_CITIES } from "../lib/constants/turkish-cities";
import { formatTRY } from "../lib/medusa/format";
import { StoreCart, StoreProduct, StoreShippingOption } from "../lib/medusa/types";
import type { CartItemAvailabilityIssue, PaymentOptionsResult } from "../lib/medusa/cart";
import { CheckoutFormSchema } from "../lib/medusa/validation";
import { isVariantOutOfStock } from "../lib/medusa/variant-stock";
import { CheckoutOrderSummaryItem } from "./checkout-order-summary-item";
import { addRecommendedProductToCart } from "../lib/medusa/checkout-recommendations";
import type { CustomerAddress, CustomerProfile } from "../lib/medusa/account";
import {
  getDefaultShippingOptionId,
  sortShippingOptions,
  calculateCheckoutTotals,
  shouldShowCodFeeBadge,
  resolveCheckoutPaymentOutcome,
} from "../lib/medusa/checkout-pricing";
import {
  Tag,
  X,
  Check,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CreditCard,
  Banknote,
  ShieldAlert,
  Plus,
} from "lucide-react";
import { applyCouponAction, removeCouponAction } from "../app/(store)/actions";

const CHECKOUT_FIELD_ORDER = [
  "email",
  "phone",
  "firstName",
  "lastName",
  "city",
  "district",
  "addressLine1",
  "postalCode",
  "companyName",
  "taxOffice",
  "taxNumber",
  "billingFirstName",
  "billingLastName",
  "billingCity",
  "billingDistrict",
  "billingAddressLine1",
  "shippingOptionSection",
  "distanceSalesContract",
  "kvkkConsent",
] as const;

function mapZodPathToFieldId(path: ReadonlyArray<PropertyKey>): string | null {
  const joined = path.map(String).join(".");
  if (joined === "deliveryAddress.firstName") return "firstName";
  if (joined === "deliveryAddress.lastName") return "lastName";
  if (joined === "deliveryAddress.city") return "city";
  if (joined === "deliveryAddress.district") return "district";
  if (joined === "deliveryAddress.addressLine1") return "addressLine1";
  if (joined === "deliveryAddress.postalCode") return "postalCode";
  if (joined === "billingAddress.firstName") return "billingFirstName";
  if (joined === "billingAddress.lastName") return "billingLastName";
  if (joined === "billingAddress.city") return "billingCity";
  if (joined === "billingAddress.district") return "billingDistrict";
  if (joined === "billingAddress.addressLine1") return "billingAddressLine1";
  if (joined === "shippingOptionId") return "shippingOptionSection";
  if (
    joined === "email" ||
    joined === "phone" ||
    joined === "companyName" ||
    joined === "taxOffice" ||
    joined === "taxNumber" ||
    joined === "distanceSalesContract" ||
    joined === "kvkkConsent"
  ) {
    return joined;
  }
  return null;
}

export function validateCheckoutFormFields(payload: Record<string, unknown>):
  | { valid: true }
  | {
      valid: false;
      errors: Record<string, string>;
      firstErrorFieldId: string | null;
      firstErrorMessage: string;
    } {
  const parsed = CheckoutFormSchema.safeParse(payload);
  if (parsed.success) {
    return { valid: true };
  }

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const fieldId = mapZodPathToFieldId(issue.path);
    if (fieldId && !errors[fieldId]) {
      errors[fieldId] = issue.message;
    }
  }

  const firstErrorFieldId =
    CHECKOUT_FIELD_ORDER.find((id) => Boolean(errors[id])) ?? Object.keys(errors)[0] ?? null;
  const firstErrorMessage =
    (firstErrorFieldId ? errors[firstErrorFieldId] : undefined) ||
    parsed.error.issues[0]?.message ||
    "Lütfen formdaki eksik veya hatalı alanları kontrol ediniz.";

  return {
    valid: false,
    errors,
    firstErrorFieldId,
    firstErrorMessage,
  };
}

interface CheckoutFormProps {
  initialCart: StoreCart;
  shippingOptions: StoreShippingOption[];
  paymentOptions?: PaymentOptionsResult;
  initialCustomer?: CustomerProfile | null;
  savedAddresses?: CustomerAddress[];
  recommendedProducts?: StoreProduct[];
  recommendedTitle?: string;
  initialAvailabilityIssues?: CartItemAvailabilityIssue[];
}

export function CheckoutForm({
  initialCart,
  shippingOptions,
  paymentOptions,
  initialCustomer = null,
  savedAddresses = [],
  recommendedProducts = [],
  recommendedTitle = "Bunları da ekleyebilirsiniz",
  initialAvailabilityIssues = [],
}: CheckoutFormProps) {
  const defaultSavedAddress = useMemo(
    () => savedAddresses.find((a) => a.is_default_shipping) || savedAddresses[0] || null,
    [savedAddresses],
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string>(defaultSavedAddress?.id || "");
  const [cart, setCart] = useState<StoreCart>(initialCart);
  const [availabilityIssues, setAvailabilityIssues] =
    useState<CartItemAvailabilityIssue[]>(initialAvailabilityIssues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (fieldId: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const scrollToField = (fieldId: string | null) => {
    if (!fieldId || typeof document === "undefined") return;
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (typeof (el as HTMLElement).focus === "function") {
      window.setTimeout(() => {
        (el as HTMLElement).focus({ preventScroll: true });
      }, 220);
    }
  };

  const getInputBorderClass = (fieldId: string) =>
    fieldErrors[fieldId]
      ? "border-red-600 ring-1 ring-red-600/20 focus:border-red-600 focus:ring-red-600"
      : "border-stone-300 focus:ring-stone-900";

  // Payment Method Selection
  const resolveInitialMethod = (): "iyzico" | "paytr" | "cod" | "dev" => {
    const def = paymentOptions?.default_method;
    if (def === "iyzico" && paymentOptions?.iyzico?.enabled) return "iyzico";
    if (def === "paytr" && paymentOptions?.paytr?.enabled) return "paytr";
    if (def === "cod" && paymentOptions?.cod?.enabled) return "cod";
    if (paymentOptions?.iyzico?.enabled) return "iyzico";
    if (paymentOptions?.paytr?.enabled) return "paytr";
    if (paymentOptions?.cod?.enabled) return "cod";
    if (paymentOptions?.dev?.enabled) return "dev";
    return "iyzico";
  };

  const [paymentMethod, setPaymentMethod] = useState<"iyzico" | "paytr" | "cod" | "dev">(
    resolveInitialMethod,
  );
  const [paytrIframeUrl, setPaytrIframeUrl] = useState<string | null>(null);
  const [iyzicoIframeUrl, setIyzicoIframeUrl] = useState<string | null>(null);
  const hasAnyEnabledMethod = Boolean(
    paymentOptions?.iyzico?.enabled ||
      paymentOptions?.paytr?.enabled ||
      paymentOptions?.cod?.enabled ||
      paymentOptions?.dev?.enabled,
  );

  // Form Fields
  const [email, setEmail] = useState(initialCustomer?.email || cart.email || "");
  const [phone, setPhone] = useState(
    cart.shipping_address?.phone || defaultSavedAddress?.phone || initialCustomer?.phone || "",
  );

  // Delivery Address
  const [firstName, setFirstName] = useState(
    cart.shipping_address?.first_name ||
      defaultSavedAddress?.first_name ||
      initialCustomer?.first_name ||
      "",
  );
  const [lastName, setLastName] = useState(
    cart.shipping_address?.last_name ||
      defaultSavedAddress?.last_name ||
      initialCustomer?.last_name ||
      "",
  );
  const [city, setCity] = useState(
    cart.shipping_address?.city || defaultSavedAddress?.city || TURKISH_CITIES[0],
  );
  const [district, setDistrict] = useState(
    cart.shipping_address?.province || defaultSavedAddress?.province || "",
  );
  const [addressLine1, setAddressLine1] = useState(
    cart.shipping_address?.address_1 || defaultSavedAddress?.address_1 || "",
  );
  const [addressLine2, setAddressLine2] = useState(
    cart.shipping_address?.address_2 || defaultSavedAddress?.address_2 || "",
  );
  const [postalCode, setPostalCode] = useState(
    cart.shipping_address?.postal_code || defaultSavedAddress?.postal_code || "",
  );

  // Invoice & Billing
  const [invoiceType, setInvoiceType] = useState<"individual" | "corporate">(
    (cart.metadata?.invoice_type as "individual" | "corporate") || "individual",
  );
  const [companyName, setCompanyName] = useState((cart.metadata?.company_name as string) || "");
  const [taxOffice, setTaxOffice] = useState((cart.metadata?.tax_office as string) || "");
  const [taxNumber, setTaxNumber] = useState((cart.metadata?.tax_number as string) || "");
  const [sameAsDelivery, setSameAsDelivery] = useState(true);

  // Separate Billing Address Fields
  const [billingFirstName, setBillingFirstName] = useState("");
  const [billingLastName, setBillingLastName] = useState("");
  const [billingCity, setBillingCity] = useState(TURKISH_CITIES[0]);
  const [billingDistrict, setBillingDistrict] = useState("");
  const [billingAddressLine1, setBillingAddressLine1] = useState("");
  const [billingAddressLine2, setBillingAddressLine2] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");

  // Shipping Options: prioritize free shipping option at the top
  const sortedShippingOptions = useMemo(
    () => sortShippingOptions(shippingOptions),
    [shippingOptions],
  );

  // Shipping Option Selection: auto-select "Ücretsiz Kargo" when eligible instead of paid standard shipping
  const defaultOptionId = useMemo(
    () =>
      getDefaultShippingOptionId(
        sortedShippingOptions,
        cart.shipping_methods?.[0]?.shipping_option_id,
      ),
    [sortedShippingOptions, cart.shipping_methods],
  );
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState<string>(defaultOptionId);

  // Legal Consents
  const [distanceSalesContract, setDistanceSalesContract] = useState(false);
  const [kvkkConsent, setKvkkConsent] = useState(false);

  // Coupon State
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isCouponPending, setIsCouponPending] = useState(false);

  // Recommended Products State
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<Record<string, string>>(
    {},
  );
  const [upsellError, setUpsellError] = useState<string | null>(null);

  const visibleRecommendations = useMemo(() => {
    const cartProductIds = new Set(
      cart.items.map((item) => item.product_id).filter((id): id is string => Boolean(id)),
    );
    return recommendedProducts.filter((p) => !cartProductIds.has(p.id));
  }, [cart.items, recommendedProducts]);

  const handleAddRecommended = async (product: StoreProduct) => {
    setUpsellError(null);
    setAddingProductId(product.id);
    try {
      const result = await addRecommendedProductToCart(
        product,
        selectedVariantByProduct[product.id],
      );
      if (!result.ok || !result.cart) {
        setUpsellError(result.error || "Ürün sepete eklenemedi.");
        return;
      }
      setCart(result.cart);
    } finally {
      setAddingProductId(null);
    }
  };

  const selectedOption = sortedShippingOptions.find((o) => o.id === selectedShippingOptionId);
  const totals = calculateCheckoutTotals(
    cart,
    selectedOption,
    paymentOptions?.cod?.fee ?? 100,
    paymentMethod,
  );

  const { subtotalNet, taxTotal, discountTotal, shippingCost, configuredCodFee, codFee, total } =
    totals;
  const promotions = cart.promotions || [];

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponError(null);
    setIsCouponPending(true);
    try {
      const res = await applyCouponAction(couponCode.trim());
      if (res.success && res.data) {
        setCart(res.data);
        setCouponCode("");
      } else {
        setCouponError(res.error || "Geçersiz veya süresi dolmuş kupon kodu.");
      }
    } finally {
      setIsCouponPending(false);
    }
  };

  const handleRemoveCoupon = async (code: string) => {
    setCouponError(null);
    setIsCouponPending(true);
    try {
      const res = await removeCouponAction(code);
      if (res.success && res.data) {
        setCart(res.data);
      } else {
        setCouponError(res.error || "Kupon kaldırılamadı.");
      }
    } finally {
      setIsCouponPending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg(null);

    const payload = {
      email,
      phone,
      deliveryAddress: {
        firstName,
        lastName,
        city,
        district,
        addressLine1,
        addressLine2,
        postalCode: postalCode || undefined,
        countryCode: "tr" as const,
      },
      sameAsDelivery,
      ...(sameAsDelivery
        ? {}
        : {
            billingAddress: {
              firstName: billingFirstName || firstName,
              lastName: billingLastName || lastName,
              city: billingCity,
              district: billingDistrict,
              addressLine1: billingAddressLine1,
              addressLine2: billingAddressLine2,
              postalCode: billingPostalCode || undefined,
              countryCode: "tr" as const,
            },
          }),
      invoiceType,
      ...(invoiceType === "corporate"
        ? {
            companyName,
            taxOffice,
            taxNumber,
          }
        : {}),
      shippingOptionId: selectedShippingOptionId,
      paymentMethod,
      distanceSalesContract,
      kvkkConsent,
    };

    const validation = validateCheckoutFormFields(payload);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      scrollToField(validation.firstErrorFieldId);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409 && data.code === "CART_ITEM_UNAVAILABLE") {
        if (Array.isArray(data.issues)) {
          setAvailabilityIssues(data.issues);
        }
        setErrorMsg(
          data.error ||
            "Sepetinizde satıştan kaldırılmış veya stoğu yetersiz ürün bulunuyor. Lütfen sepetinizi güncelleyin.",
        );
        setIsSubmitting(false);
        return;
      }

      if (res.status === 409 && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Sipariş işlenirken bir hata oluştu.");
        setIsSubmitting(false);
        return;
      }

      const outcome = resolveCheckoutPaymentOutcome(data);
      if (outcome.kind === "iyzico_iframe") {
        setIyzicoIframeUrl(outcome.url);
        setIsSubmitting(false);
        return;
      }

      if (outcome.kind === "paytr_iframe") {
        setPaytrIframeUrl(outcome.url);
        setIsSubmitting(false);

        const existingScript = document.getElementById("paytr-resizer-script");
        if (!existingScript) {
          const script = document.createElement("script");
          script.id = "paytr-resizer-script";
          script.src = "https://www.paytr.com/js/iframeResizer.min.js";
          script.onload = () => {
            setTimeout(() => {
              (window as any).iFrameResize?.({}, "#paytriframe");
            }, 300);
          };
          document.body.appendChild(script);
        } else {
          setTimeout(() => {
            (window as any).iFrameResize?.({}, "#paytriframe");
          }, 300);
        }
        return;
      }

      // Redirect (iyzico redirect, PayTR redirect, or COD/dev confirmation)
      window.location.href = outcome.url;
    } catch {
      setErrorMsg("Bağlantı hatası oluştu. Lütfen tekrar deneyiniz.");
      setIsSubmitting(false);
    }
  };

  if (iyzicoIframeUrl) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg p-6 sm:p-8 space-y-6 max-w-4xl mx-auto shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-200 pb-4 gap-2">
          <div>
            <h2 className="text-xl font-bold text-stone-900">iyzico Güvenli Ödeme Ekranı</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Kart bilgilerinizi girip 3D Secure onayını tamamlayınız.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIyzicoIframeUrl(null)}
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 underline text-left sm:text-right"
          >
            ← Ödeme Yöntemini Değiştir
          </button>
        </div>

        <div className="w-full flex justify-center bg-stone-50 p-2 rounded border border-stone-100">
          <iframe
            src={iyzicoIframeUrl}
            title="iyzico Güvenli Ödeme Ekranı"
            id="iyzicoiframe"
            style={{ width: "100%", minHeight: "650px", border: "none" }}
          />
        </div>

        <div className="text-center text-xs text-stone-400 border-t border-stone-100 pt-3">
          Ödeme oturumunuz 256-Bit SSL şifreleme ve BDDK lisanslı iyzico altyapısı ile
          korunmaktadır.
        </div>
      </div>
    );
  }

  if (paytrIframeUrl) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg p-6 sm:p-8 space-y-6 max-w-4xl mx-auto shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-200 pb-4 gap-2">
          <div>
            <h2 className="text-xl font-bold text-stone-900">PayTR Güvenli Ödeme Ekranı</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Kart bilgilerinizi girip 3D Secure onayını tamamlayınız.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPaytrIframeUrl(null)}
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 underline text-left sm:text-right"
          >
            ← Ödeme Yöntemini Değiştir
          </button>
        </div>

        <div className="w-full flex justify-center bg-stone-50 p-2 rounded border border-stone-100">
          <iframe
            src={paytrIframeUrl}
            id="paytriframe"
            frameBorder="0"
            scrolling="no"
            style={{ width: "100%", minHeight: "650px", border: "none" }}
          />
        </div>

        <div className="text-center text-xs text-stone-400 border-t border-stone-100 pt-3">
          Ödeme oturumunuz 256-Bit SSL şifreleme ve BDDK lisanslı PayTR altyapısı ile korunmaktadır.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[580px_480px] items-start">
      {/* Checkout Form (Left Column) */}
      <form
        noValidate
        onSubmit={handleSubmit}
        className="bg-[var(--theme-checkout-left-bg,#FFFFFF)] px-4 sm:px-6 lg:px-0 lg:pr-11 py-8 space-y-6"
      >
        {/* Availability Issues Notice */}
        {availabilityIssues.length > 0 && (
          <div
            role="alert"
            className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-3 text-sm text-red-900"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Sepetinizdeki bazı ürünler artık satın alınamıyor</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Siparişi tamamlamadan önce sepetinize dönüp sorunlu ürünleri çıkarın veya adedini
                  güncelleyin.
                </p>
              </div>
            </div>
            <Link
              href="/sepet"
              className="px-3 py-1.5 bg-red-700 text-white text-xs font-semibold rounded-md hover:bg-red-800 whitespace-nowrap"
            >
              Sepete Dön
            </Link>
          </div>
        )}
        {/* Step 1: Contact Information */}
        <section className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center font-bold">
                1
              </span>
              <h2 className="text-base font-bold text-stone-900">İletişim Bilgileri</h2>
            </div>
            {initialCustomer ? (
              <span className="text-xs text-stone-500 truncate max-w-[220px]">
                Hesap: <strong className="text-stone-800">{initialCustomer.email}</strong>
              </span>
            ) : (
              <Link
                href="/hesap/giris?redirect=/odeme"
                className="text-xs font-semibold text-stone-900 underline underline-offset-2 hover:text-stone-700"
              >
                Giriş yap
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-stone-700 mb-1">
                E-posta Adresi <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                aria-invalid={Boolean(fieldErrors.email)}
                readOnly={Boolean(initialCustomer)}
                value={email}
                onChange={(e) => {
                  if (!initialCustomer) {
                    setEmail(e.target.value);
                    clearFieldError("email");
                  }
                }}
                placeholder="ornek@alanadi.com"
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors ${getInputBorderClass("email")} ${
                  initialCustomer ? "bg-stone-50 text-stone-600" : ""
                }`}
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {fieldErrors.email}
                </p>
              )}
              {savedAddresses.length > 0 && (
                <div className="mt-2">
                  <label
                    htmlFor="saved-address-select"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Kayıtlı Adres Seçin
                  </label>
                  <select
                    id="saved-address-select"
                    value={selectedAddressId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedAddressId(nextId);
                      const chosen = savedAddresses.find((a) => a.id === nextId);
                      if (chosen) {
                        setFirstName(chosen.first_name || "");
                        setLastName(chosen.last_name || "");
                        if (chosen.phone) setPhone(chosen.phone);
                        if (chosen.city) setCity(chosen.city);
                        setDistrict(chosen.province || "");
                        setAddressLine1(chosen.address_1 || "");
                        setAddressLine2(chosen.address_2 || "");
                        setPostalCode(chosen.postal_code || "");
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-white"
                  >
                    {savedAddresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.address_name || `${addr.first_name} ${addr.last_name}`} — {addr.city}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-[11px] text-stone-500 mt-1">
                Sipariş onayı bu adrese gönderilecektir.
              </p>
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-semibold text-stone-700 mb-1">
                Cep Telefonu <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                required
                aria-invalid={Boolean(fieldErrors.phone)}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearFieldError("phone");
                }}
                placeholder="05XX XXX XX XX"
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors ${getInputBorderClass("phone")}`}
              />
              {fieldErrors.phone ? (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {fieldErrors.phone}
                </p>
              ) : (
                <p className="text-[11px] text-stone-500 mt-1">
                  Kargo teslimat bildirimleri için gereklidir.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Step 2: Delivery Address */}
        <section className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center font-bold">
              2
            </span>
            <h2 className="text-base font-bold text-stone-900">Teslimat Adresi</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firstName"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Ad <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                required
                aria-invalid={Boolean(fieldErrors.firstName)}
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  clearFieldError("firstName");
                }}
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors ${getInputBorderClass("firstName")}`}
              />
              {fieldErrors.firstName && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {fieldErrors.firstName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="block text-xs font-semibold text-stone-700 mb-1">
                Soyad <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                required
                aria-invalid={Boolean(fieldErrors.lastName)}
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  clearFieldError("lastName");
                }}
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors ${getInputBorderClass("lastName")}`}
              />
              {fieldErrors.lastName && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {fieldErrors.lastName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="city" className="block text-xs font-semibold text-stone-700 mb-1">
                İl (Şehir) <span className="text-red-500">*</span>
              </label>
              <select
                id="city"
                aria-invalid={Boolean(fieldErrors.city)}
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  clearFieldError("city");
                }}
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors bg-white ${getInputBorderClass("city")}`}
              >
                {TURKISH_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {fieldErrors.city && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {fieldErrors.city}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="district" className="block text-xs font-semibold text-stone-700 mb-1">
                İlçe <span className="text-red-500">*</span>
              </label>
              <input
                id="district"
                type="text"
                required
                aria-invalid={Boolean(fieldErrors.district)}
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  clearFieldError("district");
                }}
                placeholder="Örn: Kadıköy"
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors ${getInputBorderClass("district")}`}
              />
              {fieldErrors.district && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {fieldErrors.district}
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="addressLine1"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Açık Adres <span className="text-red-500">*</span>
              </label>
              <textarea
                id="addressLine1"
                required
                aria-invalid={Boolean(fieldErrors.addressLine1)}
                rows={2}
                value={addressLine1}
                onChange={(e) => {
                  setAddressLine1(e.target.value);
                  clearFieldError("addressLine1");
                }}
                placeholder="Mahalle, Cadde, Sokak, Bina No, Daire No"
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors ${getInputBorderClass("addressLine1")}`}
              />
              {fieldErrors.addressLine1 && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {fieldErrors.addressLine1}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="addressLine2"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Adres Tarifi / Ek Bilgi (İsteğe bağlı)
              </label>
              <input
                id="addressLine2"
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Örn: Kat 3, Zili çalınız"
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <div>
              <label
                htmlFor="postalCode"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Posta Kodu (İsteğe bağlı)
              </label>
              <input
                id="postalCode"
                type="text"
                maxLength={5}
                aria-invalid={Boolean(fieldErrors.postalCode)}
                value={postalCode}
                onChange={(e) => {
                  setPostalCode(e.target.value);
                  clearFieldError("postalCode");
                }}
                placeholder="34710"
                className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors ${getInputBorderClass("postalCode")}`}
              />
              {fieldErrors.postalCode && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {fieldErrors.postalCode}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Step 3: Invoice Details (Bireysel / Kurumsal) */}
        <section className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center font-bold">
              3
            </span>
            <h2 className="text-base font-bold text-stone-900">Fatura Türü ve Bilgileri</h2>
          </div>

          {/* Toggle Bireysel / Kurumsal */}
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <button
              type="button"
              onClick={() => setInvoiceType("individual")}
              className={`py-2 px-4 text-xs font-semibold rounded-md border text-center transition ${
                invoiceType === "individual"
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50"
              }`}
            >
              Bireysel Fatura
            </button>
            <button
              type="button"
              onClick={() => setInvoiceType("corporate")}
              className={`py-2 px-4 text-xs font-semibold rounded-md border text-center transition ${
                invoiceType === "corporate"
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50"
              }`}
            >
              Kurumsal Fatura
            </button>
          </div>

          {/* Corporate Specific Fields */}
          {invoiceType === "corporate" && (
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-md space-y-3">
              <p className="text-xs text-stone-600 font-medium">
                Kurumsal faturalar için lütfen şirket bilgilerinizi giriniz. (TC Kimlik No
                istenmemektedir).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <label
                    htmlFor="companyName"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Şirket Resmi Unvanı <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    required
                    aria-invalid={Boolean(fieldErrors.companyName)}
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      clearFieldError("companyName");
                    }}
                    placeholder="Örn: Alte Teknoloji A.Ş."
                    className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors bg-white ${getInputBorderClass("companyName")}`}
                  />
                  {fieldErrors.companyName && (
                    <p className="text-xs text-red-600 mt-1" role="alert">
                      {fieldErrors.companyName}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="taxOffice"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Vergi Dairesi <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="taxOffice"
                    type="text"
                    required
                    aria-invalid={Boolean(fieldErrors.taxOffice)}
                    value={taxOffice}
                    onChange={(e) => {
                      setTaxOffice(e.target.value);
                      clearFieldError("taxOffice");
                    }}
                    placeholder="Kadıköy VD"
                    className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors bg-white ${getInputBorderClass("taxOffice")}`}
                  />
                  {fieldErrors.taxOffice && (
                    <p className="text-xs text-red-600 mt-1" role="alert">
                      {fieldErrors.taxOffice}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="taxNumber"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Vergi Numarası (10 Haneli) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="taxNumber"
                    type="text"
                    required
                    aria-invalid={Boolean(fieldErrors.taxNumber)}
                    maxLength={10}
                    value={taxNumber}
                    onChange={(e) => {
                      setTaxNumber(e.target.value);
                      clearFieldError("taxNumber");
                    }}
                    placeholder="1234567890"
                    className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 transition-colors bg-white ${getInputBorderClass("taxNumber")}`}
                  />
                  {fieldErrors.taxNumber && (
                    <p className="text-xs text-red-600 mt-1" role="alert">
                      {fieldErrors.taxNumber}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Same as Delivery Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-800">
              <input
                type="checkbox"
                checked={sameAsDelivery}
                onChange={(e) => setSameAsDelivery(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
              />
              <span>Fatura adresim teslimat adresim ile aynı</span>
            </label>
          </div>

          {/* Separate Billing Address Form if unchecked */}
          {!sameAsDelivery && (
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-md space-y-3 mt-3">
              <h4 className="text-xs font-bold text-stone-900">Ayrı Fatura Adresi</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="billingFirstName"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Ad
                  </label>
                  <input
                    id="billingFirstName"
                    type="text"
                    value={billingFirstName}
                    onChange={(e) => setBillingFirstName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="billingLastName"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Soyad
                  </label>
                  <input
                    id="billingLastName"
                    type="text"
                    value={billingLastName}
                    onChange={(e) => setBillingLastName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="billingCity"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    İl
                  </label>
                  <select
                    id="billingCity"
                    value={billingCity}
                    onChange={(e) => setBillingCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-white"
                  >
                    {TURKISH_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="billingDistrict"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    İlçe
                  </label>
                  <input
                    id="billingDistrict"
                    type="text"
                    value={billingDistrict}
                    onChange={(e) => setBillingDistrict(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="billingAddressLine1"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Açık Fatura Adresi
                  </label>
                  <textarea
                    id="billingAddressLine1"
                    rows={2}
                    value={billingAddressLine1}
                    onChange={(e) => setBillingAddressLine1(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md bg-white"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Step 4: Shipping Method Selection */}
        <section
          id="shippingOptionSection"
          tabIndex={-1}
          className={`bg-white border rounded-lg p-6 space-y-4 ${
            fieldErrors.shippingOptionSection
              ? "border-red-600 ring-1 ring-red-600/20"
              : "border-stone-200"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center font-bold">
              4
            </span>
            <h2 className="text-base font-bold text-stone-900">Kargo Seçeneği</h2>
          </div>

          <div className="space-y-2">
            {sortedShippingOptions.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-center justify-between p-3.5 border rounded-lg cursor-pointer transition ${
                  selectedShippingOptionId === opt.id
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shippingOption"
                    value={opt.id}
                    checked={selectedShippingOptionId === opt.id}
                    onChange={() => setSelectedShippingOptionId(opt.id)}
                    className="w-4 h-4 text-stone-900 border-stone-300 focus:ring-stone-900"
                  />
                  <div>
                    <span className="text-sm font-semibold text-stone-900">{opt.name}</span>
                    <p className="text-xs text-stone-500">
                      Anlaşmalı kargo ile 1-3 iş günü içinde teslimat
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-stone-900">
                  {opt.amount === 0 ? "Ücretsiz" : formatTRY(opt.amount)}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Step 5: Payment Method Selection */}
        <section className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center font-bold">
              5
            </span>
            <h2 className="text-base font-bold text-stone-900">Ödeme Yöntemi</h2>
          </div>

          <div className="space-y-3">
            {!hasAnyEnabledMethod && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
                Şu anda aktif bir ödeme yöntemi bulunmamaktadır. Lütfen daha sonra tekrar deneyiniz.
              </div>
            )}

            {/* iyzico Option */}
            {paymentOptions?.iyzico?.enabled && (
              <label
                className={`flex items-start justify-between p-4 border rounded-lg cursor-pointer transition ${
                  paymentMethod === "iyzico"
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="iyzico"
                    checked={paymentMethod === "iyzico"}
                    onChange={() => setPaymentMethod("iyzico")}
                    className="w-4 h-4 mt-0.5 text-stone-900 border-stone-300 focus:ring-stone-900"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-stone-700" />
                      <span className="text-sm font-semibold text-stone-900">
                        Kredi / Banka Kartı (iyzico)
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      iyzico güvencesiyle tek çekim veya taksitli 3D Secure kart ödemesi.
                    </p>
                  </div>
                </div>
              </label>
            )}

            {/* PayTR Option */}
            {paymentOptions?.paytr?.enabled && (
              <label
                className={`flex items-start justify-between p-4 border rounded-lg cursor-pointer transition ${
                  paymentMethod === "paytr"
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="paytr"
                    checked={paymentMethod === "paytr"}
                    onChange={() => setPaymentMethod("paytr")}
                    className="w-4 h-4 mt-0.5 text-stone-900 border-stone-300 focus:ring-stone-900"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-stone-700" />
                      <span className="text-sm font-semibold text-stone-900">
                        Kredi / Banka Kartı (PayTR)
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Tüm kredi ve banka kartları ile tek çekim veya taksitli 3D Secure güvenli
                      ödeme.
                    </p>
                  </div>
                </div>
              </label>
            )}

            {/* COD Option */}
            {paymentOptions?.cod?.enabled && (
              <label
                className={`flex items-start justify-between p-4 border rounded-lg cursor-pointer transition ${
                  paymentMethod === "cod"
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                    className="w-4 h-4 mt-0.5 text-stone-900 border-stone-300 focus:ring-stone-900"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-stone-700" />
                      <span className="text-sm font-semibold text-stone-900">
                        Kapıda Ödeme (Nakit veya Kart)
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Siparişinizi teslim alırken kargo görevlisine nakit veya kartla
                      ödeyebilirsiniz.
                    </p>
                  </div>
                </div>
                {shouldShowCodFeeBadge(paymentOptions?.cod?.enabled, configuredCodFee) && (
                  <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1 rounded">
                    +{formatTRY(configuredCodFee)} Hizmet Bedeli
                  </span>
                )}
              </label>
            )}

            {/* Dev Dummy Option */}
            {paymentOptions?.dev?.enabled && (
              <label
                className={`flex items-start justify-between p-4 border rounded-lg cursor-pointer transition ${
                  paymentMethod === "dev"
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="dev"
                    checked={paymentMethod === "dev"}
                    onChange={() => setPaymentMethod("dev")}
                    className="w-4 h-4 mt-0.5 text-stone-900 border-stone-300 focus:ring-stone-900"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-900">
                        Geliştirici Sahte Ödeme (Dev)
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      Yalnızca yerel test amaçlı sahte ödeme. Üretimde kesinlikle engellenir.
                    </p>
                  </div>
                </div>
              </label>
            )}
          </div>
        </section>

        {/* Step 6: Legal Consents */}
        <section className="bg-white border border-stone-200 rounded-lg p-6 space-y-3">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center font-bold">
              6
            </span>
            <h2 className="text-base font-bold text-stone-900">Sözleşme ve Yasal Onaylar</h2>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-stone-700 leading-relaxed">
                <input
                  id="distanceSalesContract"
                  type="checkbox"
                  required
                  aria-invalid={Boolean(fieldErrors.distanceSalesContract)}
                  checked={distanceSalesContract}
                  onChange={(e) => {
                    setDistanceSalesContract(e.target.checked);
                    clearFieldError("distanceSalesContract");
                  }}
                  className={`w-4 h-4 mt-0.5 rounded text-stone-900 focus:ring-stone-900 flex-shrink-0 ${
                    fieldErrors.distanceSalesContract
                      ? "border-red-600 ring-1 ring-red-600"
                      : "border-stone-300"
                  }`}
                />
                <span>
                  <Link
                    href="/sayfa/mesafeli-satis-sozlesmesi"
                    target="_blank"
                    className="font-semibold text-stone-900 underline hover:text-stone-700"
                  >
                    Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formunu
                  </Link>{" "}
                  okudum, içeriğini kabul ediyor ve onaylıyorum.{" "}
                  <span className="text-red-500">*</span>
                </span>
              </label>
              {fieldErrors.distanceSalesContract && (
                <p className="text-xs text-red-600 mt-1 ml-6" role="alert">
                  {fieldErrors.distanceSalesContract}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-stone-700 leading-relaxed">
                <input
                  id="kvkkConsent"
                  type="checkbox"
                  required
                  aria-invalid={Boolean(fieldErrors.kvkkConsent)}
                  checked={kvkkConsent}
                  onChange={(e) => {
                    setKvkkConsent(e.target.checked);
                    clearFieldError("kvkkConsent");
                  }}
                  className={`w-4 h-4 mt-0.5 rounded text-stone-900 focus:ring-stone-900 flex-shrink-0 ${
                    fieldErrors.kvkkConsent
                      ? "border-red-600 ring-1 ring-red-600"
                      : "border-stone-300"
                  }`}
                />
                <span>
                  Kişisel verilerimin işlenmesine ilişkin{" "}
                  <Link
                    href="/sayfa/kvkk"
                    target="_blank"
                    className="font-semibold text-stone-900 underline hover:text-stone-700"
                  >
                    KVKK Aydınlatma Metnini
                  </Link>{" "}
                  okudum ve anladım. <span className="text-red-500">*</span>
                </span>
              </label>
              {fieldErrors.kvkkConsent && (
                <p className="text-xs text-red-600 mt-1 ml-6" role="alert">
                  {fieldErrors.kvkkConsent}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Submit Button (Left Column Bottom) & Inline Server/Payment Error Notice */}
        <div className="space-y-3">
          {errorMsg && (
            <div
              role="alert"
              aria-live="polite"
              className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm text-red-800 animate-fade-in-up"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">İşlem tamamlanamadı:</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || availabilityIssues.length > 0}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 theme-btn-primary text-sm disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Siparişiniz Tamamlanıyor...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>
                  {paymentMethod === "iyzico"
                    ? "iyzico Güvenli Ödemeye Geç"
                    : paymentMethod === "paytr"
                      ? "PayTR Güvenli Ödemeye Geç"
                      : "Siparişi Onayla ve Tamamla"}{" "}
                  ({formatTRY(total)})
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Order Summary & Coupon Sidebar (Right Column - Normod/Shopify) */}
      <aside className="bg-[var(--theme-checkout-summary-bg,#F5F5F5)] px-4 sm:px-6 lg:pl-11 lg:pr-0 py-8 lg:border-l lg:border-[#DEDEDE] space-y-5 lg:sticky lg:top-0 lg:min-h-[calc(100vh-73px)]">
        <h3 className="text-base font-semibold text-stone-900 pb-3 border-b border-[#DEDEDE]">
          Sipariş Özeti (
          {
            cart.items.filter(
              (item) => !item.metadata?.is_cod_fee && item.variant?.sku !== "SERVICE-COD-FEE",
            ).length
          }{" "}
          Ürün)
        </h3>

        {/* Product List (Shopify/Normod 64x64 thumbnail + quantity badge) */}
        <div className="space-y-3 max-h-[340px] overflow-y-auto pt-2 pr-1">
          {cart.items
            .filter((item) => !item.metadata?.is_cod_fee && item.variant?.sku !== "SERVICE-COD-FEE")
            .map((item) => (
              <CheckoutOrderSummaryItem key={item.id} item={item} />
            ))}
        </div>

        {/* Coupon Form */}
        <div className="pt-3 border-t border-[#DEDEDE] space-y-2">
          <form onSubmit={handleApplyCoupon} className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="İndirim Kodu"
              disabled={isCouponPending}
              className="w-full px-3 py-2 text-xs uppercase font-mono tracking-wider bg-white border border-[#DEDEDE] rounded-md focus:outline-none focus:ring-1 focus:ring-[#3A4A5B]"
            />
            <button
              type="submit"
              disabled={isCouponPending || !couponCode.trim()}
              className="px-4 py-2 theme-btn-primary text-xs disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
            >
              {isCouponPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Tag className="w-3 h-3" />
              )}
              <span>Uygula</span>
            </button>
          </form>

          {couponError && <p className="text-[11px] text-red-600 mt-1">{couponError}</p>}

          {promotions.length > 0 && (
            <div className="pt-1 flex flex-wrap gap-1.5">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[11px] font-medium rounded-full border border-emerald-200"
                >
                  <Tag className="w-2.5 h-2.5" />
                  <span>{p.code}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCoupon(p.code)}
                    disabled={isCouponPending}
                    className="ml-1 text-emerald-600 hover:text-emerald-900"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Price Breakdown */}
        <div className="space-y-2 text-[13px] pt-3 border-t border-[#DEDEDE]">
          <div className="flex justify-between text-[#666666]">
            <span>Ara Toplam (KDV Hariç)</span>
            <span className="font-medium text-stone-900">{formatTRY(subtotalNet)}</span>
          </div>

          <div className="flex justify-between text-[#666666]">
            <span>Hesaplanan KDV (%20 Dahil)</span>
            <span className="font-medium text-stone-900">{formatTRY(taxTotal)}</span>
          </div>

          {discountTotal > 0 && (
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>İndirim Tutarı</span>
              <span>-{formatTRY(discountTotal)}</span>
            </div>
          )}

          <div className="flex justify-between text-[#666666]">
            <span>Kargo Tutarı</span>
            <span className="font-medium text-stone-900">
              {shippingCost === 0 ? "Ücretsiz" : formatTRY(shippingCost)}
            </span>
          </div>

          {paymentMethod === "cod" && (
            <div className="flex justify-between text-[#666666]">
              <span>{paymentOptions?.cod?.fee_label || "Kapıda Ödeme Hizmet Bedeli"}</span>
              <span className="font-medium text-stone-900">+{formatTRY(codFee)}</span>
            </div>
          )}

          <div className="pt-3 border-t border-[#DEDEDE] flex justify-between items-baseline">
            <span className="text-base font-semibold text-stone-900">Ödenecek Tutar</span>
            <span className="text-lg font-bold text-stone-900 tabular-nums">
              {formatTRY(total)}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-stone-400 text-center flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-stone-500" />
          <span>256-Bit SSL ile güvenli sipariş</span>
        </p>

        {/* Optional Recommended Products (configured in Payload SiteSettings) */}
        {visibleRecommendations.length > 0 && (
          <div className="pt-4 border-t border-stone-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              {recommendedTitle}
            </h4>
            {upsellError && (
              <p role="alert" className="text-[11px] text-red-600">
                {upsellError}
              </p>
            )}
            <div className="space-y-2.5">
              {visibleRecommendations.map((product) => {
                const availableVariants = (product.variants || []).filter(
                  (v) => !isVariantOutOfStock(v),
                );
                const selectedVarId =
                  selectedVariantByProduct[product.id] || availableVariants[0]?.id || "";
                const selectedVar =
                  availableVariants.find((v) => v.id === selectedVarId) || availableVariants[0];
                const price =
                  selectedVar?.calculated_price?.calculated_amount ??
                  selectedVar?.prices?.[0]?.amount ??
                  0;
                const isAdding = addingProductId === product.id;

                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-2.5 rounded-md border border-stone-200 bg-stone-50/50"
                  >
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt={product.title}
                        className="w-12 h-12 rounded object-cover border border-stone-200 flex-shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded border border-stone-200 bg-stone-100 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-semibold text-stone-900 truncate">
                        {product.title}
                      </p>
                      <p className="text-xs font-bold text-stone-700">{formatTRY(price)}</p>
                      {availableVariants.length > 1 && (
                        <select
                          aria-label={`${product.title} seçenek`}
                          value={selectedVarId}
                          onChange={(e) =>
                            setSelectedVariantByProduct((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                          className="w-full px-2 py-1 text-[11px] border border-stone-300 rounded bg-white text-stone-800"
                        >
                          {availableVariants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isAdding || !selectedVarId}
                      onClick={() => handleAddRecommended(product)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded border border-stone-300 bg-white text-stone-900 hover:bg-stone-100 disabled:opacity-50 flex-shrink-0 cursor-pointer"
                    >
                      {isAdding ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Ekle</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
