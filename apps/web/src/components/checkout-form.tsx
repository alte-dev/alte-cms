"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { TURKISH_CITIES } from "../lib/constants/turkish-cities";
import { formatTRY } from "../lib/medusa/format";
import { StoreCart, StoreShippingOption } from "../lib/medusa/types";
import { PaymentOptionsResult } from "../lib/medusa/cart";
import {
  getDefaultShippingOptionId,
  sortShippingOptions,
  calculateCheckoutTotals,
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
} from "lucide-react";
import { applyCouponAction, removeCouponAction } from "../app/(store)/actions";

interface CheckoutFormProps {
  initialCart: StoreCart;
  shippingOptions: StoreShippingOption[];
  paymentOptions?: PaymentOptionsResult;
}

export function CheckoutForm({ initialCart, shippingOptions, paymentOptions }: CheckoutFormProps) {
  const [cart, setCart] = useState<StoreCart>(initialCart);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Payment Method Selection
  const initialPaymentMethod = paymentOptions?.paytr?.enabled
    ? "paytr"
    : paymentOptions?.cod?.enabled
      ? "cod"
      : paymentOptions?.dev?.enabled
        ? "dev"
        : "paytr";

  const [paymentMethod, setPaymentMethod] = useState<"paytr" | "cod" | "dev">(initialPaymentMethod);
  const [paytrIframeUrl, setPaytrIframeUrl] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState(cart.email || "");
  const [phone, setPhone] = useState(cart.shipping_address?.phone || "");

  // Delivery Address
  const [firstName, setFirstName] = useState(cart.shipping_address?.first_name || "");
  const [lastName, setLastName] = useState(cart.shipping_address?.last_name || "");
  const [city, setCity] = useState(cart.shipping_address?.city || TURKISH_CITIES[0]);
  const [district, setDistrict] = useState(cart.shipping_address?.province || "");
  const [addressLine1, setAddressLine1] = useState(cart.shipping_address?.address_1 || "");
  const [addressLine2, setAddressLine2] = useState(cart.shipping_address?.address_2 || "");
  const [postalCode, setPostalCode] = useState(cart.shipping_address?.postal_code || "");

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

    // Basic client checks before submitting
    if (!distanceSalesContract) {
      setErrorMsg("Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formunu onaylamalısınız.");
      return;
    }
    if (!kvkkConsent) {
      setErrorMsg("KVKK Aydınlatma Metnini onaylamalısınız.");
      return;
    }
    if (!selectedShippingOptionId) {
      setErrorMsg("Lütfen geçerli bir kargo seçeneği belirleyiniz.");
      return;
    }

    setIsSubmitting(true);

    try {
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
          countryCode: "tr",
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
                countryCode: "tr",
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
        distanceSalesContract: true,
        kvkkConsent: true,
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409 && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Sipariş işlenirken bir hata oluştu.");
        setIsSubmitting(false);
        return;
      }

      if (data.paymentMethod === "paytr" && data.iframeUrl) {
        if (data.displayMode === "redirect") {
          window.location.href = data.iframeUrl;
          return;
        }

        // iFrame mode
        setPaytrIframeUrl(data.iframeUrl);
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

      // Success: redirect to confirmation page
      window.location.href = data.redirectUrl || "/siparis-onay";
    } catch {
      setErrorMsg("Bağlantı hatası oluştu. Lütfen tekrar deneyiniz.");
      setIsSubmitting(false);
    }
  };

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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Checkout Form (Col 8) */}
      <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-8">
        {/* Global Error Notice */}
        {errorMsg && (
          <div
            role="alert"
            aria-live="polite"
            className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm text-red-800"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Lütfen formu kontrol ediniz:</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Step 1: Contact Information */}
        <section className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center font-bold">
              1
            </span>
            <h2 className="text-base font-bold text-stone-900">İletişim Bilgileri</h2>
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@alanadi.com"
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Kargo teslimat bildirimleri için gereklidir.
              </p>
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
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-xs font-semibold text-stone-700 mb-1">
                Soyad <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-xs font-semibold text-stone-700 mb-1">
                İl (Şehir) <span className="text-red-500">*</span>
              </label>
              <select
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
              >
                {TURKISH_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="district" className="block text-xs font-semibold text-stone-700 mb-1">
                İlçe <span className="text-red-500">*</span>
              </label>
              <input
                id="district"
                type="text"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Örn: Kadıköy"
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
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
                rows={2}
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Mahalle, Cadde, Sokak, Bina No, Daire No"
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
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
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="34710"
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
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
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Örn: Alte Teknoloji A.Ş."
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
                  />
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
                    value={taxOffice}
                    onChange={(e) => setTaxOffice(e.target.value)}
                    placeholder="Kadıköy VD"
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
                  />
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
                    maxLength={10}
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="1234567890"
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
                  />
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
        <section className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
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
            {/* PayTR Option */}
            <label
              className={`flex items-start justify-between p-4 border rounded-lg cursor-pointer transition ${
                paymentMethod === "paytr"
                  ? "border-stone-900 bg-stone-50"
                  : "border-stone-200 hover:border-stone-300 bg-white"
              } ${!paymentOptions?.paytr?.enabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="paytr"
                  disabled={!paymentOptions?.paytr?.enabled}
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
                    {!paymentOptions?.paytr?.enabled && (
                      <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded">
                        Şu anda kullanılamıyor
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Tüm kredi ve banka kartları ile tek çekim veya taksitli 3D Secure güvenli ödeme.
                  </p>
                </div>
              </div>
            </label>

            {/* COD Option */}
            <label
              className={`flex items-start justify-between p-4 border rounded-lg cursor-pointer transition ${
                paymentMethod === "cod"
                  ? "border-stone-900 bg-stone-50"
                  : "border-stone-200 hover:border-stone-300 bg-white"
              } ${!paymentOptions?.cod?.enabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  disabled={!paymentOptions?.cod?.enabled}
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
                    {!paymentOptions?.cod?.enabled && (
                      <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded">
                        Şu anda kullanılamıyor
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Siparişinizi teslim alırken kargo görevlisine nakit veya kartla ödeyebilirsiniz.
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1 rounded">
                +{formatTRY(configuredCodFee)} Hizmet Bedeli
              </span>
            </label>

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
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-stone-700 leading-relaxed">
              <input
                type="checkbox"
                required
                checked={distanceSalesContract}
                onChange={(e) => setDistanceSalesContract(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-900 flex-shrink-0"
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

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-stone-700 leading-relaxed">
              <input
                type="checkbox"
                required
                checked={kvkkConsent}
                onChange={(e) => setKvkkConsent(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-900 flex-shrink-0"
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
          </div>
        </section>

        {/* Submit Button on Mobile */}
        <div className="block lg:hidden">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-stone-900 text-white font-semibold rounded-md hover:bg-stone-800 disabled:opacity-50 transition"
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
                  {paymentMethod === "paytr"
                    ? "PayTR Güvenli Ödemeye Geç"
                    : "Siparişi Onayla ve Tamamla"}{" "}
                  ({formatTRY(total)})
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Order Summary & Coupon Sidebar (Col 4) */}
      <aside className="lg:col-span-4 bg-white border border-stone-200 rounded-lg p-6 space-y-5 sticky top-24">
        <h3 className="text-base font-bold text-stone-900 pb-3 border-b border-stone-100">
          Sipariş Özeti ({cart.items.length} Ürün)
        </h3>

        {/* Mini Item List */}
        <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto pr-1">
          {cart.items.map((item) => (
            <div key={item.id} className="py-2.5 flex justify-between items-center text-xs">
              <div className="pr-2 truncate">
                <span className="font-semibold text-stone-900">{item.title}</span>
                <span className="text-stone-500 ml-1.5">x {item.quantity}</span>
              </div>
              <span className="font-bold text-stone-900 flex-shrink-0">
                {formatTRY(
                  (item.unit_price ? item.unit_price * item.quantity : 0) ||
                    item.total ||
                    item.subtotal,
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Coupon Form */}
        <div className="pt-2 border-t border-stone-100 space-y-2">
          <form onSubmit={handleApplyCoupon} className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="İndirim Kodu"
              disabled={isCouponPending}
              className="w-full px-3 py-1.5 text-xs uppercase font-mono tracking-wider border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
            <button
              type="submit"
              disabled={isCouponPending || !couponCode.trim()}
              className="px-3 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-md hover:bg-stone-800 disabled:opacity-50 transition flex items-center gap-1"
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
        <div className="space-y-2 text-xs pt-3 border-t border-stone-100">
          <div className="flex justify-between text-stone-600">
            <span>Ara Toplam (KDV Hariç)</span>
            <span className="font-medium text-stone-900">{formatTRY(subtotalNet)}</span>
          </div>

          <div className="flex justify-between text-stone-600">
            <span>Hesaplanan KDV (%20 Dahil)</span>
            <span className="font-medium text-stone-900">{formatTRY(taxTotal)}</span>
          </div>

          {discountTotal > 0 && (
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>İndirim Tutarı</span>
              <span>-{formatTRY(discountTotal)}</span>
            </div>
          )}

          <div className="flex justify-between text-stone-600">
            <span>Kargo Tutarı</span>
            <span className="font-medium text-stone-900">
              {shippingCost === 0 ? "Ücretsiz" : formatTRY(shippingCost)}
            </span>
          </div>

          {paymentMethod === "cod" && (
            <div className="flex justify-between text-stone-600">
              <span>{paymentOptions?.cod?.fee_label || "Kapıda Ödeme Hizmet Bedeli"}</span>
              <span className="font-medium text-stone-900">+{formatTRY(codFee)}</span>
            </div>
          )}

          <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline">
            <span className="text-sm font-bold text-stone-900">Ödenecek Tutar</span>
            <span className="text-lg font-extrabold text-stone-900">{formatTRY(total)}</span>
          </div>
        </div>

        {/* Desktop Submit Button with Double-Click Protection */}
        <div className="hidden lg:block pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-stone-900 text-white text-sm font-semibold rounded-md hover:bg-stone-800 disabled:opacity-50 transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Siparişiniz Tamamlanıyor...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  {paymentMethod === "paytr"
                    ? "PayTR Güvenli Ödemeye Geç"
                    : "Siparişi Onayla ve Tamamla"}
                </span>
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-stone-400 text-center flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-stone-500" />
          <span>256-Bit SSL ile güvenli sipariş</span>
        </p>
      </aside>
    </div>
  );
}
