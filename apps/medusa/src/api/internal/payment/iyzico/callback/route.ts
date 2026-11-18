import crypto from "crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { capturePaymentWorkflow, completeCartWorkflow } from "@medusajs/core-flows";
import { z } from "zod";
import PaymentSettingsService, {
  PaymentSettingsRegistry,
} from "../../../../../modules/payment-settings/service";
import {
  IyzicoClient,
  verifyIyzicoRetrieveSignature,
} from "../../../../../modules/payment-iyzico/client";
import { executeWithLock } from "../../../../hooks/payment/pp_paytr_paytr/route";
import { isUnrecoverableCartCompletionError } from "../../../../../utils/cart-availability";

const callbackInputSchema = z.object({
  token: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[a-zA-Z0-9._-]+$/),
});

export interface IyzicoCallbackDeps {
  scope?: any;
  paymentService: any;
  cartService: any;
  pgConnection: any;
  completeOrder: (cartId: string) => Promise<any>;
  capturePayment: (paymentId: string) => Promise<void>;
  fetchImpl?: typeof fetch;
}

export interface IyzicoCallbackResult {
  httpStatus: number;
  status: "completed" | "failed";
  cart_id?: string;
  order_id?: string;
  error?: string;
}

export async function processIyzicoCallback(
  rawInput: { token: string },
  deps: IyzicoCallbackDeps,
): Promise<IyzicoCallbackResult> {
  const parsed = callbackInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { httpStatus: 400, status: "failed", error: "Geçersiz ödeme token formatı." };
  }

  const token = parsed.data.token;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);

  let settings = PaymentSettingsRegistry.get();
  if (!settings || !settings.iyzico_api_key || !settings.iyzico_secret_key) {
    try {
      const settingsService = deps.scope?.resolve?.(
        "paymentSettingsModuleService",
      ) as PaymentSettingsService;
      if (settingsService) {
        settings = await settingsService.getDecryptedSettings();
      }
    } catch (err: any) {
      console.error("[iyzico Callback] Ayarlar çözülemedi:", err?.message);
      return { httpStatus: 500, status: "failed", error: "Ödeme ayarları yüklenemedi." };
    }
  }

  if (!settings?.iyzico_api_key || !settings?.iyzico_secret_key) {
    return { httpStatus: 500, status: "failed", error: "iyzico kimlik bilgileri eksik." };
  }

  return await executeWithLock(deps.scope, `iyzico_cb_${tokenHash}`, async () => {
    let matchedSession: any = null;

    try {
      if (deps.pgConnection) {
        const rows = await deps
          .pgConnection("payment_session")
          .whereRaw("data->>'token' = ?", [token])
          .whereNull("deleted_at")
          .select("*");
        if (rows && rows.length > 0) {
          matchedSession = rows[0];
        }
      }
    } catch (err: any) {
      console.debug("[iyzico Callback] Index lookup notice:", err?.message);
    }

    if (!matchedSession) {
      try {
        const collections = await deps.paymentService.listPaymentCollections(
          {},
          { relations: ["payment_sessions"] },
        );
        for (const col of collections) {
          for (const ses of (col as any).payment_sessions || []) {
            if (ses.data?.token === token) {
              matchedSession = ses;
              break;
            }
          }
          if (matchedSession) break;
        }
      } catch (err: any) {
        console.error("[iyzico Callback] Fallback session lookup error:", err?.message);
      }
    }

    if (!matchedSession) {
      // Check for soft-deleted session (e.g. cart was mutated after session initiation)
      let deletedSession: any = null;
      try {
        if (deps.pgConnection) {
          const delRows = await deps
            .pgConnection("payment_session")
            .whereRaw("data->>'token' = ?", [token])
            .orderBy("created_at", "desc")
            .limit(1);
          if (delRows && delRows.length > 0) {
            deletedSession = delRows[0];
          }
        }
      } catch (err: any) {
        console.debug("[iyzico Callback] Deleted session lookup notice:", err?.message);
      }

      const client = new IyzicoClient({
        apiKey: settings!.iyzico_api_key,
        secretKey: settings!.iyzico_secret_key,
        mode: settings!.iyzico_mode,
        fetchImpl: deps.fetchImpl,
      });

      try {
        const orphanRetrieve = await client.retrieveCheckoutForm({
          locale: settings!.iyzico_lang || "tr",
          conversationId: String(deletedSession?.data?.conversation_id || ""),
          token,
        });

        const orphanSigValid =
          Boolean(orphanRetrieve.signature) &&
          verifyIyzicoRetrieveSignature({
            paymentStatus: String(orphanRetrieve.paymentStatus || ""),
            paymentId: String(orphanRetrieve.paymentId || ""),
            currency: String(orphanRetrieve.currency || ""),
            basketId: String(orphanRetrieve.basketId || ""),
            conversationId: String(orphanRetrieve.conversationId || ""),
            paidPrice: orphanRetrieve.paidPrice ?? "",
            price: orphanRetrieve.price ?? "",
            token: String(orphanRetrieve.token || token),
            signature: String(orphanRetrieve.signature || ""),
            secretKey: settings!.iyzico_secret_key,
          });

        if (
          orphanRetrieve.status === "success" &&
          orphanRetrieve.paymentStatus === "SUCCESS" &&
          orphanSigValid
        ) {
          const paidAmount = Number(orphanRetrieve.paidPrice || 0);
          const paymentIdStr = orphanRetrieve.paymentId ? String(orphanRetrieve.paymentId) : null;
          const orphanCartId = deletedSession?.data?.cart_id || orphanRetrieve.basketId || null;

          console.error(
            `[CRITICAL ALERT] Ödeme iyzico tarafından tahsil edildi fakat aktif ödeme oturumu bulunamadı (sepet değiştirilmiş olabilir)! (orphan_payment, ref=${tokenHash}, payment_id=${paymentIdStr || "yok"}, amount=${paidAmount})`,
          );

          if (deps.pgConnection) {
            await deps
              .pgConnection("orphan_payment")
              .insert({
                id: `orp_${tokenHash}`,
                token_hash: tokenHash,
                provider: "iyzico",
                iyzico_payment_id: paymentIdStr,
                cart_id: orphanCartId ? String(orphanCartId) : null,
                amount: Number.isFinite(paidAmount) ? paidAmount : 0,
                currency: String(orphanRetrieve.currency || "TRY"),
                status: "needs_manual_refund",
                reason: deletedSession
                  ? "ORPHAN_PAYMENT_SESSION_DELETED"
                  : "ORPHAN_PAYMENT_SESSION_NOT_FOUND",
                created_at: new Date(),
                updated_at: new Date(),
              })
              .onConflict("token_hash")
              .ignore();
          }

          return {
            httpStatus: 200,
            status: "failed",
            error:
              "Ödeme oturumu zaman aşımına uğradı veya sepetiniz güncellendi. Tahsilat yapıldıysa iade ekibimiz en kısa sürede sizinle ilgilenecektir.",
          };
        }
      } catch (err: any) {
        console.debug("[iyzico Callback] Orphan retrieve notice:", err?.message);
      }

      return { httpStatus: 404, status: "failed", error: "Ödeme oturumu bulunamadı." };
    }

    const sessionData = (matchedSession.data || {}) as Record<string, any>;
    const cartId: string | undefined = sessionData.cart_id || matchedSession.cart_id;

    // Idempotency: token already consumed or session already captured
    if (
      sessionData.consumed_at ||
      matchedSession.status === "captured" ||
      sessionData.status === "captured"
    ) {
      let existingOrderId = sessionData.order_id as string | undefined;
      if (!existingOrderId && cartId && deps.pgConnection) {
        try {
          const orderCartRows = await deps
            .pgConnection("order_cart")
            .where({ cart_id: cartId })
            .select("order_id");
          existingOrderId = orderCartRows?.[0]?.order_id;
        } catch {
          // ignore
        }
      }
      return {
        httpStatus: 200,
        status: "completed",
        cart_id: cartId,
        order_id: existingOrderId,
      };
    }

    if (cartId) {
      try {
        const cart = await deps.cartService.retrieveCart(cartId);
        if (cart && cart.completed_at) {
          return {
            httpStatus: 200,
            status: "completed",
            cart_id: cartId,
            order_id: sessionData.order_id,
          };
        }
      } catch {
        // continue
      }
    }

    // Server-to-server retrieve from iyzico (never trust callback body)
    const client = new IyzicoClient({
      apiKey: settings!.iyzico_api_key,
      secretKey: settings!.iyzico_secret_key,
      mode: settings!.iyzico_mode,
      fetchImpl: deps.fetchImpl,
    });

    let retrieveRes: any;
    try {
      retrieveRes = await client.retrieveCheckoutForm({
        locale: settings!.iyzico_lang || "tr",
        conversationId: String(sessionData.conversation_id || ""),
        token,
      });
    } catch (err: any) {
      console.error(`[iyzico Callback] Retrieve iletişim hatası (ref=${tokenHash}):`, err?.message);
      return {
        httpStatus: 502,
        status: "failed",
        cart_id: cartId,
        error: "Ödeme doğrulama servisine ulaşılamadı.",
      };
    }

    const markFailed = async (
      reasonMsg: string,
      reasonCode = "VERIFICATION_FAILED",
      opts?: { needsManualRefund?: boolean; iyzicoPaymentId?: string },
    ) => {
      if (opts?.needsManualRefund) {
        console.error(
          `[CRITICAL ALERT] iyzico ödeme durumu SUCCESS ancak doğrulama başarısız oldu! (needs_manual_refund, ref=${tokenHash}, code=${reasonCode}, payment_id=${opts.iyzicoPaymentId || "yok"})`,
        );
      }
      await deps.paymentService.updatePaymentSession({
        id: matchedSession.id,
        amount: matchedSession.amount,
        currency_code: matchedSession.currency_code,
        data: {
          ...sessionData,
          status: "failed",
          failed_reason_code: reasonCode,
          failed_reason_msg: reasonMsg,
          failed_at: new Date().toISOString(),
          ...(opts?.needsManualRefund
            ? {
                needs_manual_refund: true,
                manual_refund_reason: reasonCode,
                ...(opts.iyzicoPaymentId ? { iyzico_payment_id: opts.iyzicoPaymentId } : {}),
              }
            : {}),
        },
      });
      return {
        httpStatus: 200,
        status: "failed" as const,
        cart_id: cartId,
        error: reasonMsg,
      };
    };

    // 1. Payment status check
    if (retrieveRes.status !== "success" || retrieveRes.paymentStatus !== "SUCCESS") {
      return await markFailed(
        retrieveRes.errorMessage || "Ödeme işlemi onaylanmadı.",
        retrieveRes.errorCode || "PAYMENT_FAILED",
      );
    }

    const verifiedPaymentId = retrieveRes.paymentId ? String(retrieveRes.paymentId) : undefined;

    // 2. Signature verification (mandatory when signature is present, or if missing on success)
    const sigValid =
      Boolean(retrieveRes.signature) &&
      verifyIyzicoRetrieveSignature({
        paymentStatus: String(retrieveRes.paymentStatus || ""),
        paymentId: String(retrieveRes.paymentId || ""),
        currency: String(retrieveRes.currency || ""),
        basketId: String(retrieveRes.basketId || ""),
        conversationId: String(retrieveRes.conversationId || ""),
        paidPrice: retrieveRes.paidPrice ?? "",
        price: retrieveRes.price ?? "",
        token: String(retrieveRes.token || token),
        signature: String(retrieveRes.signature || ""),
        secretKey: settings!.iyzico_secret_key,
      });

    if (!sigValid) {
      console.error(`[iyzico Callback] Geçersiz yanıt imzası reddedildi (ref=${tokenHash}).`);
      return await markFailed("Ödeme yanıt imzası doğrulanamadı.", "INVALID_SIGNATURE", {
        needsManualRefund: true,
        iyzicoPaymentId: verifiedPaymentId,
      });
    }

    // 3. conversationId & basketId match
    if (
      String(retrieveRes.conversationId || "") !== String(sessionData.conversation_id || "") ||
      String(retrieveRes.basketId || "") !== String(sessionData.basket_id || "")
    ) {
      console.error(`[iyzico Callback] Oturum kimliği uyuşmazlığı (ref=${tokenHash}).`);
      return await markFailed("Ödeme oturum kimliği uyuşmuyor.", "SESSION_MISMATCH", {
        needsManualRefund: true,
        iyzicoPaymentId: verifiedPaymentId,
      });
    }

    // 4. Currency & exact kuruş amount match
    const expectedKurus = Number(sessionData.expected_amount_kurus || 0);
    const paidKurus = Math.round(Number(retrieveRes.paidPrice) * 100);
    if (
      retrieveRes.currency !== "TRY" ||
      !Number.isFinite(expectedKurus) ||
      expectedKurus <= 0 ||
      paidKurus < expectedKurus
    ) {
      console.error(
        `[iyzico Callback] Tutar/para birimi uyuşmazlığı (ref=${tokenHash}, expected=${expectedKurus}, paid=${paidKurus}).`,
      );
      return await markFailed("Ödeme tutarı sepet tutarı ile uyuşmuyor.", "AMOUNT_MISMATCH", {
        needsManualRefund: true,
        iyzicoPaymentId: verifiedPaymentId,
      });
    }

    const txIds = Array.isArray(retrieveRes.itemTransactions)
      ? retrieveRes.itemTransactions
          .map((t: any) => t?.paymentTransactionId)
          .filter((v: any): v is string => typeof v === "string" && v.length > 0)
      : [];

    // Authorize session
    try {
      await deps.paymentService.updatePaymentSession({
        id: matchedSession.id,
        amount: matchedSession.amount,
        currency_code: matchedSession.currency_code,
        data: {
          ...sessionData,
          status: "authorized",
          iyzico_payment_id: String(retrieveRes.paymentId || ""),
          iyzico_payment_transaction_ids: txIds,
          authorized_at: new Date().toISOString(),
        },
      });
      await deps.paymentService.authorizePaymentSession(matchedSession.id, {});
    } catch {
      // already authorized is acceptable
    }

    if (!cartId) {
      return { httpStatus: 400, status: "failed", error: "Sepet kimliği bulunamadı." };
    }

    try {
      const freshCart = await deps.cartService.retrieveCart(cartId);
      if (freshCart && freshCart.completed_at) {
        return {
          httpStatus: 200,
          status: "completed",
          cart_id: cartId,
          order_id: sessionData.order_id,
        };
      }

      const order = await deps.completeOrder(cartId);

      const payments = await deps.paymentService.listPayments({
        payment_session_id: matchedSession.id,
      });
      for (const payment of payments) {
        if (!payment.captured_at) {
          try {
            await deps.capturePayment(payment.id);
          } catch (capErr: any) {
            console.error(`[iyzico Callback] capturePayment hatası: ${capErr?.message}`);
          }
        }
      }

      if (order?.id && deps.pgConnection) {
        try {
          const orderRows = await deps
            .pgConnection("order")
            .where({ id: order.id })
            .select("metadata");
          const currentMeta = orderRows?.[0]?.metadata || {};
          await deps
            .pgConnection("order")
            .where({ id: order.id })
            .update({
              metadata: JSON.stringify({
                ...currentMeta,
                payment_provider: "iyzico",
              }),
            });
        } catch (metaErr: any) {
          console.debug("[iyzico Callback] order metadata update notice:", metaErr?.message);
        }
      }

      await deps.paymentService.updatePaymentSession({
        id: matchedSession.id,
        amount: matchedSession.amount,
        currency_code: matchedSession.currency_code,
        data: {
          ...sessionData,
          status: "captured",
          consumed_at: new Date().toISOString(),
          needs_manual_refund: false,
          manual_refund_reason: null,
          order_id: order?.id,
          iyzico_payment_id: String(retrieveRes.paymentId || ""),
          iyzico_payment_transaction_ids: txIds,
          captured_at: new Date().toISOString(),
        },
      });

      return {
        httpStatus: 200,
        status: "completed",
        cart_id: cartId,
        order_id: order?.id,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (/completed|already/i.test(errMsg)) {
        return {
          httpStatus: 200,
          status: "completed",
          cart_id: cartId,
          order_id: sessionData.order_id,
        };
      }

      const isUnrecoverable = isUnrecoverableCartCompletionError(errMsg);
      if (isUnrecoverable) {
        console.error(
          `[CRITICAL ALERT] Ödeme iyzico tarafından tahsil edildi fakat Medusa siparişi kurtarılamaz bir nedenle oluşturulamadı! (needs_manual_refund) Sepet ID: ${cartId}, ref=${tokenHash}, Hata: ${errMsg}`,
        );
        await deps.paymentService.updatePaymentSession({
          id: matchedSession.id,
          amount: matchedSession.amount,
          currency_code: matchedSession.currency_code,
          data: {
            ...sessionData,
            consumed_at: new Date().toISOString(),
            iyzico_payment_id: String(retrieveRes.paymentId || ""),
            iyzico_payment_transaction_ids: txIds,
            needs_manual_refund: true,
            manual_refund_reason: errMsg,
            captured_at: new Date().toISOString(),
          },
        });
        return {
          httpStatus: 200,
          status: "failed",
          cart_id: cartId,
          error: "Sipariş oluşturulamadı, tutar iade sürecine alındı.",
        };
      }

      console.error(
        `[iyzico Callback] Geçici hata (Sepet: ${cartId}, ref=${tokenHash}): ${errMsg}`,
      );
      return {
        httpStatus: 500,
        status: "failed",
        cart_id: cartId,
        error: "Geçici bir sistem hatası oluştu.",
      };
    }
  });
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body || {}) as Record<string, any>;
  const token = typeof body.token === "string" ? body.token.trim() : "";

  const paymentService = req.scope.resolve(Modules.PAYMENT);
  const cartService = req.scope.resolve(Modules.CART);
  const pgConnection =
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
    req.scope.resolve("__pg_connection__");

  const result = await processIyzicoCallback(
    { token },
    {
      scope: req.scope,
      paymentService,
      cartService,
      pgConnection,
      completeOrder: async (cartId: string) => {
        const { result: order } = await completeCartWorkflow(req.scope).run({
          input: { id: cartId },
        });
        return order;
      },
      capturePayment: async (paymentId: string) => {
        await capturePaymentWorkflow(req.scope).run({
          input: { payment_id: paymentId },
        });
      },
    },
  );

  return res.status(result.httpStatus).json({
    status: result.status,
    cart_id: result.cart_id,
    order_id: result.order_id,
    error: result.error,
  });
};
