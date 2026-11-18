"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Minus, Plus, ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { removeCartItemAction, updateCartItemAction } from "../app/(store)/actions";
import { calculateCheckoutTotals } from "../lib/medusa/checkout-pricing";
import { formatTRY, type FreeShippingProgress } from "../lib/medusa/format";
import type { StoreCart } from "../lib/medusa/types";
import {
  resolveCartItemThumbnail,
  resolveCartItemVariantLabel,
} from "./checkout-order-summary-item";
import { PlaceholderImage } from "./placeholder-image";

interface CartDrawerContextValue {
  isOpen: boolean;
  itemCount: number | null;
  openDrawer: () => void;
  openWithCart: (nextCart: StoreCart) => void;
  closeDrawer: () => void;
}

const CartDrawerContext = createContext<CartDrawerContextValue | null>(null);

export function useCartDrawer(): CartDrawerContextValue {
  const ctx = useContext(CartDrawerContext);
  if (!ctx) {
    throw new Error("useCartDrawer must be used within CartDrawerProvider");
  }
  return ctx;
}

export function useOptionalCartDrawer(): CartDrawerContextValue | null {
  return useContext(CartDrawerContext);
}

/**
 * Returns false on /sepet routes so the slide-over drawer does not open on top of the cart page.
 */
export function shouldOpenCartDrawerForPath(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  return pathname !== "/sepet" && !pathname.startsWith("/sepet/");
}

function isServiceFeeItem(item: StoreCart["items"][number]): boolean {
  return Boolean(item.metadata?.is_cod_fee) || item.variant?.sku === "SERVICE-COD-FEE";
}

function countProductItems(cart: StoreCart | null): number {
  if (!cart?.items) return 0;
  return cart.items
    .filter((item) => !isServiceFeeItem(item))
    .reduce((acc, item) => acc + (item.quantity || 0), 0);
}

export interface CartDrawerAvailabilityIssue {
  lineItemId: string;
  reason: "deleted" | "unpublished" | "insufficient_stock";
  requestedQuantity: number;
  availableQuantity: number;
}

function getDrawerAvailabilityIssueText(issue: CartDrawerAvailabilityIssue): string {
  if (issue.reason === "deleted") {
    return "Bu ürün satıştan kaldırıldı.";
  }
  if (issue.reason === "unpublished") {
    return "Bu ürün şu anda yayında değil.";
  }
  if (issue.availableQuantity <= 0) {
    return "Bu ürünün stoğu tükendi.";
  }
  return `Stokta yalnızca ${issue.availableQuantity} adet kaldı.`;
}

interface CartDrawerPanelProps {
  isOpen: boolean;
  cart: StoreCart | null;
  freeShippingProgress: FreeShippingProgress | null;
  availabilityIssues?: CartDrawerAvailabilityIssue[];
  isPending: boolean;
  isLoading?: boolean;
  errorMsg: string | null;
  onClose: () => void;
  onUpdateQuantity: (lineItemId: string, newQty: number) => void;
  onRemoveItem: (lineItemId: string) => void;
}

export function CartDrawerPanel({
  isOpen,
  cart,
  freeShippingProgress,
  availabilityIssues = [],
  isPending,
  isLoading = false,
  errorMsg,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
}: CartDrawerPanelProps) {
  if (!isOpen) return null;

  const items = (cart?.items || []).filter((item) => !isServiceFeeItem(item));
  const totals = cart ? calculateCheckoutTotals(cart, null, 0, "card") : null;
  const productsGross = items.reduce(
    (sum, item) =>
      sum +
      ((item.unit_price ? item.unit_price * item.quantity : 0) || item.total || item.subtotal || 0),
    0,
  );
  const subtotalAmount = Math.max(0, productsGross - (totals?.discountTotal ?? 0));
  const issueByLineItemId = new Map(availabilityIssues.map((issue) => [issue.lineItemId, issue]));
  const hasAvailabilityIssues = availabilityIssues.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Sepet"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="relative z-10 w-full max-w-[440px] bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900">Sepet</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sepeti kapat"
            className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {hasAvailabilityIssues && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>
                Sepetinizde güncellenmesi gereken ürünler var. Devam etmek için sorunlu ürünleri
                çıkarın veya adedini azaltın.
              </span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800"
            >
              {errorMsg}
            </div>
          )}

          {isLoading && !cart ? (
            <div className="py-12 text-center text-sm text-stone-500">Sepet yükleniyor...</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-stone-100 text-stone-400">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-stone-900">Sepetiniz Boş</p>
                <p className="text-xs text-stone-500">
                  Alışverişe başlamak için ürünlerimize göz atabilirsiniz.
                </p>
              </div>
              <Link
                href="/urunler"
                onClick={onClose}
                className="inline-flex items-center justify-center px-5 py-2.5 theme-btn-primary text-sm"
              >
                Alışverişe Başla
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {items.map((item) => {
                const thumbnail = resolveCartItemThumbnail(item);
                const variantLabel = resolveCartItemVariantLabel(item);
                const lineTotal =
                  (item.unit_price ? item.unit_price * item.quantity : 0) ||
                  item.total ||
                  item.subtotal;

                return (
                  <div key={item.id} className="py-4 first:pt-0 flex gap-4">
                    <div className="w-20 h-20 rounded-lg border border-stone-200 bg-stone-50 overflow-hidden flex-shrink-0">
                      {thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbnail}
                          alt={item.product_title || item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <PlaceholderImage
                          title={item.product_title || item.title}
                          className="w-full h-full text-[9px]"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-900 leading-snug line-clamp-2">
                            {item.product_title || item.title}
                          </p>
                          {variantLabel && (
                            <p className="text-xs text-stone-500 mt-0.5 truncate">{variantLabel}</p>
                          )}
                          {issueByLineItemId.get(item.id) && (
                            <p className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 mt-1 inline-block">
                              {getDrawerAvailabilityIssueText(issueByLineItemId.get(item.id)!)}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          disabled={isPending}
                          aria-label="Ürünü sepetten çıkar"
                          className="p-1 text-stone-400 hover:text-red-600 transition disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-3">
                        <div className="inline-flex items-center rounded-full border border-stone-300 bg-stone-50/70 h-8 px-1">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={isPending}
                            aria-label="Miktarı azalt"
                            className="w-6 h-6 flex items-center justify-center rounded-full text-stone-700 hover:bg-stone-200/70 transition disabled:opacity-50"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="min-w-[24px] text-center text-xs font-semibold text-stone-900 tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={isPending || item.quantity >= 99}
                            aria-label="Miktarı artır"
                            className="w-6 h-6 flex items-center justify-center rounded-full text-stone-700 hover:bg-stone-200/70 transition disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-sm font-semibold text-stone-900 tabular-nums">
                          {formatTRY(lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-stone-200 bg-white px-6 py-4 space-y-3.5">
            {freeShippingProgress?.hasThreshold && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-900">
                  <Truck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  <span>{freeShippingProgress.message}</span>
                </div>
                <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${freeShippingProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-900">Ara Toplam</p>
                <p className="text-[11px] text-stone-500">
                  Vergi dahil, kargo ücreti ödeme sırasında hesaplanır
                </p>
              </div>
              <span className="text-base font-bold text-stone-900 tabular-nums">
                {formatTRY(subtotalAmount)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/sepet"
                onClick={onClose}
                className="w-full py-2.5 px-4 text-center text-sm font-medium rounded-md border border-stone-300 text-stone-800 hover:bg-stone-50 transition"
              >
                Sepete Git
              </Link>
              {hasAvailabilityIssues ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 px-4 text-center text-sm font-medium rounded-md bg-stone-300 text-stone-600 cursor-not-allowed"
                >
                  Ödemeye Geç
                </button>
              ) : (
                <Link
                  href="/odeme"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 text-center text-sm theme-btn-primary"
                >
                  Ödemeye Geç
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CartDrawerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const drawerAllowed = shouldOpenCartDrawerForPath(pathname);
  const [isOpen, setIsOpen] = useState(false);
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [freeShippingProgress, setFreeShippingProgress] = useState<FreeShippingProgress | null>(
    null,
  );
  const [availabilityIssues, setAvailabilityIssues] = useState<CartDrawerAvailabilityIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fetchSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCartState = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++fetchSeqRef.current;

    setIsLoading(true);
    try {
      const res = await fetch("/api/cart", { cache: "no-store", signal: controller.signal });
      if (!res.ok || seq !== fetchSeqRef.current) return;
      const data = await res.json();
      if (seq !== fetchSeqRef.current) return;
      setCart(data.cart ?? null);
      setFreeShippingProgress(data.freeShippingProgress ?? null);
      setAvailabilityIssues(Array.isArray(data.availabilityIssues) ? data.availabilityIssues : []);
    } catch {
      // ignore aborted or transient network errors on drawer open
    } finally {
      if (seq === fetchSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const openDrawer = useCallback(() => {
    if (!drawerAllowed) return;
    setErrorMsg(null);
    setIsOpen(true);
    void fetchCartState();
  }, [drawerAllowed, fetchCartState]);

  const openWithCart = useCallback(
    (nextCart: StoreCart) => {
      setErrorMsg(null);
      setCart(nextCart);
      if (!drawerAllowed) return;
      setIsOpen(true);
      void fetchCartState();
    },
    [drawerAllowed, fetchCartState],
  );

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!drawerAllowed && isOpen) {
      setIsOpen(false);
    }
  }, [drawerAllowed, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const handleUpdateQuantity = useCallback(
    (lineItemId: string, newQty: number) => {
      setErrorMsg(null);
      startTransition(async () => {
        const result =
          newQty <= 0
            ? await removeCartItemAction(lineItemId)
            : await updateCartItemAction({ lineItemId, quantity: newQty });

        if (result.success && result.data) {
          setCart(result.data);
          void fetchCartState();
        } else if (result.error) {
          setErrorMsg(result.error);
        }
      });
    },
    [fetchCartState],
  );

  const handleRemoveItem = useCallback(
    (lineItemId: string) => {
      setErrorMsg(null);
      startTransition(async () => {
        const result = await removeCartItemAction(lineItemId);
        if (result.success && result.data) {
          setCart(result.data);
          void fetchCartState();
        } else if (result.error) {
          setErrorMsg(result.error);
        }
      });
    },
    [fetchCartState],
  );

  const itemCount = cart ? countProductItems(cart) : null;

  return (
    <CartDrawerContext.Provider
      value={{ isOpen, itemCount, openDrawer, openWithCart, closeDrawer }}
    >
      {children}
      <CartDrawerPanel
        isOpen={isOpen}
        cart={cart}
        freeShippingProgress={freeShippingProgress}
        availabilityIssues={availabilityIssues}
        isPending={isPending}
        isLoading={isLoading}
        errorMsg={errorMsg}
        onClose={closeDrawer}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
      />
    </CartDrawerContext.Provider>
  );
}
