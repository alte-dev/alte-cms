import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { capturePaymentWorkflow, completeCartWorkflow } from "@medusajs/core-flows";
import PaymentSettingsService, {
  PaymentSettingsRegistry,
} from "../../../../modules/payment-settings/service";
import PaytrPaymentService from "../../../../modules/payment-paytr/service";

// In-process mutex queue fallback for callback serialization per merchant_oid
const inMemoryLocks = new Map<string, Promise<any>>();

export async function executeWithLock<T>(
  container: any,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  let lockingService: any = null;
  try {
    if (container?.hasRegistration?.(Modules.LOCKING)) {
      lockingService = container.resolve(Modules.LOCKING);
    }
  } catch {
    // resolution fallback
  }

  if (lockingService && typeof lockingService.execute === "function") {
    return await lockingService.execute(key, async () => {
      return await fn();
    });
  }

  // Fallback in-process sequential mutex
  while (inMemoryLocks.has(key)) {
    try {
      await inMemoryLocks.get(key);
    } catch {
      // ignore
    }
  }

  let unlock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  inMemoryLocks.set(key, lockPromise);

  try {
    return await fn();
  } finally {
    inMemoryLocks.delete(key);
    unlock!();
  }
}

/**
 * PayTR Callback (Bildirim URL) Endpoint
 * Route: POST /hooks/payment/pp_paytr_paytr
 * Form-urlencoded POST sent by PayTR servers on payment completion.
 * Responds strictly with plain-text "OK" on valid processing.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  // 1. Ensure body is parsed (Medusa handles urlencoded/json via body-parser)
  const body = (req.body || {}) as Record<string, any>;

  const merchantOid = String(body.merchant_oid || "");
  const status = String(body.status || "");
  const totalAmountStr = String(body.total_amount || "");
  const receivedHash = String(body.hash || "");
  const testModeStr = String(body.test_mode || "0");
  const failedReasonCode = body.failed_reason_code ? String(body.failed_reason_code) : undefined;
  const failedReasonMsg = body.failed_reason_msg ? String(body.failed_reason_msg) : undefined;

  if (!merchantOid || !status || !receivedHash) {
    console.error("[PayTR Callback] Eksik parametrelerle istek geldi:", {
      has_oid: Boolean(merchantOid),
      has_status: Boolean(status),
      has_hash: Boolean(receivedHash),
    });
    return res.status(400).send("PAYTR_CALLBACK_MISSING_FIELDS");
  }

  // 2. Resolve Payment Settings & Decrypted Keys
  let settings = PaymentSettingsRegistry.get();
  if (!settings || !settings.paytr_merchant_key || !settings.paytr_merchant_salt) {
    try {
      const settingsService = req.scope.resolve<PaymentSettingsService>(
        "paymentSettingsModuleService",
      );
      settings = await settingsService.getDecryptedSettings();
    } catch (err: any) {
      console.error("[PayTR Callback] Ayarlar çözülemedi:", err.message);
      return res.status(500).send("PAYTR_SETTINGS_UNAVAILABLE");
    }
  }

  // 3. Constant-time HMAC Hash Verification
  const paytrService = new PaytrPaymentService({}, {});
  const isHashValid = paytrService.verifyCallbackHash({
    merchant_oid: merchantOid,
    status,
    total_amount: totalAmountStr,
    receivedHash,
    merchant_key: settings.paytr_merchant_key,
    merchant_salt: settings.paytr_merchant_salt,
  });

  if (!isHashValid) {
    console.error(`[PayTR Callback] Geçersiz HMAC hash imzası reddedildi! (oid=${merchantOid})`);
    return res.status(400).send("PAYTR_INVALID_HASH");
  }

  // 4. Sandbox vs Live Mode Discrepancy Guard
  if (settings.paytr_mode === "live" && testModeStr === "1") {
    console.error(
      `[PayTR Callback] Güvenlik uyarısı: Mağaza CANLI moddayken test_mode=1 bildirimi geldi! (oid=${merchantOid})`,
    );
    return res.status(400).send("PAYTR_MODE_MISMATCH");
  }

  // 5. Serialize processing using Locking Module per merchant_oid
  return await executeWithLock(req.scope, `paytr_cb_${merchantOid}`, async () => {
    const paymentService = req.scope.resolve(Modules.PAYMENT);
    const cartService = req.scope.resolve(Modules.CART);

    // Direct indexed lookup on payment_session (data->>'merchant_oid')
    let matchedSession: any = null;
    try {
      const pg =
        req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
        req.scope.resolve("__pg_connection__");
      if (pg) {
        const rows = await pg("payment_session")
          .whereRaw("data->>'merchant_oid' = ?", [merchantOid])
          .whereNull("deleted_at")
          .select("*");
        if (rows && rows.length > 0) {
          matchedSession = rows[0];
        }
      }
    } catch (err: any) {
      console.debug("[PayTR Callback] Direct index lookup notice:", err.message);
    }

    // Fallback lookup if direct DB query was not available
    if (!matchedSession) {
      try {
        const paymentCollections = await paymentService.listPaymentCollections(
          {},
          { relations: ["payment_sessions"] },
        );
        for (const col of paymentCollections) {
          for (const ses of (col as any).payment_sessions || []) {
            if (ses.data?.merchant_oid === merchantOid) {
              matchedSession = ses;
              break;
            }
          }
          if (matchedSession) break;
        }
      } catch (err: any) {
        console.error("[PayTR Callback] Fallback list collections error:", err.message);
      }
    }

    if (!matchedSession) {
      console.warn(
        `[PayTR Callback] merchant_oid (${merchantOid}) ile eşleşen ödeme oturumu bulunamadı. OK dönülüyor.`,
      );
      return res.status(200).send("OK");
    }

    const cartId = (matchedSession.data as any)?.cart_id || matchedSession.cart_id;

    // Idempotency: check if session or cart is already completed
    if (matchedSession.status === "captured" || matchedSession.data?.status === "captured") {
      return res.status(200).send("OK");
    }

    let cart: any = null;
    if (cartId) {
      try {
        cart = await cartService.retrieveCart(cartId);
        if (cart && cart.completed_at) {
          return res.status(200).send("OK");
        }
      } catch {
        // continue
      }
    }

    // Handle Failed Payment
    if (status !== "success") {
      console.warn(`[PayTR Callback] Ödeme başarısız bildirildi (oid=${merchantOid}):`, {
        code: failedReasonCode,
        msg: failedReasonMsg,
      });

      await paymentService.updatePaymentSession({
        id: matchedSession.id,
        amount: matchedSession.amount,
        currency_code: matchedSession.currency_code,
        data: {
          ...matchedSession.data,
          status: "failed",
          failed_reason_code: failedReasonCode || "UNKNOWN",
          failed_reason_msg: failedReasonMsg || "Ödeme başarısız",
          failed_at: new Date().toISOString(),
        },
      });

      return res.status(200).send("OK");
    }

    // Handle Success: Validate Total Amount >= Expected Amount
    const receivedKurus = parseInt(totalAmountStr, 10);
    const expectedKurus = Number(matchedSession.data?.expected_amount_kurus || 0);

    if (expectedKurus > 0 && receivedKurus < expectedKurus) {
      console.error(
        `[PayTR Callback] Tutar yetersiz! Alınan: ${receivedKurus} kuruş, Beklenen: ${expectedKurus} kuruş (oid=${merchantOid})`,
      );

      await paymentService.updatePaymentSession({
        id: matchedSession.id,
        amount: matchedSession.amount,
        currency_code: matchedSession.currency_code,
        data: {
          ...matchedSession.data,
          status: "failed",
          failed_reason_msg: "Tahsil edilen tutar sepet tutarından az.",
        },
      });

      return res.status(200).send("OK");
    }

    // Authorize payment session if not yet authorized
    try {
      await paymentService.updatePaymentSession({
        id: matchedSession.id,
        amount: matchedSession.amount,
        currency_code: matchedSession.currency_code,
        data: {
          ...matchedSession.data,
          status: "authorized",
          total_amount_received_kurus: receivedKurus,
          authorized_at: new Date().toISOString(),
        },
      });
      await paymentService.authorizePaymentSession(matchedSession.id, {});
    } catch {
      // already authorized is acceptable
    }

    if (cartId) {
      try {
        // Re-check cart right before completion
        const freshCart = await cartService.retrieveCart(cartId);
        if (freshCart && freshCart.completed_at) {
          return res.status(200).send("OK");
        }

        const { result: order } = await completeCartWorkflow(req.scope).run({
          input: { id: cartId },
        });

        // CAPTURE PAYMENT IMMEDIATELY (Faz 4.1 Requirement 3)
        const payments = await paymentService.listPayments({
          payment_session_id: matchedSession.id,
        });

        for (const payment of payments) {
          if (!payment.captured_at) {
            try {
              await capturePaymentWorkflow(req.scope).run({
                input: { payment_id: payment.id },
              });
              console.log(
                `[PayTR Callback] Ödeme başarıyla CAPTURED edildi! (payment_id=${payment.id}, order_id=${order?.id})`,
              );
            } catch (capErr: any) {
              console.error(`[PayTR Callback] capturePaymentWorkflow hatası: ${capErr.message}`);
            }
          }
        }

        // Recovery: if previous attempt had marked needs_manual_refund, clear it now!
        await paymentService.updatePaymentSession({
          id: matchedSession.id,
          amount: matchedSession.amount,
          currency_code: matchedSession.currency_code,
          data: {
            ...matchedSession.data,
            status: "captured",
            needs_manual_refund: false,
            manual_refund_reason: null,
            order_id: order?.id,
            captured_at: new Date().toISOString(),
          },
        });

        console.log(
          `[PayTR Callback] Sipariş ve ödeme başarıyla tamamlandı! Sipariş ID: ${order?.id}, Sepet ID: ${cartId}, OID: ${merchantOid}`,
        );

        return res.status(200).send("OK");
      } catch (err: any) {
        const errMsg = err?.message || String(err);

        // Check if cart was already completed (concurrent winner / duplicate submit)
        if (/completed|already/i.test(errMsg)) {
          return res.status(200).send("OK");
        }

        // Check if error is an unrecoverable business failure (e.g. inventory exhausted)
        const isUnrecoverable = /inventory|stock|insufficient/i.test(errMsg);

        if (isUnrecoverable) {
          console.error(
            `[CRITICAL ALERT] Ödeme PayTR tarafından tahsil edildi fakat Medusa siparişi kurtarılamaz bir nedenle oluşturulamadı! (needs_manual_refund) Sepet ID: ${cartId}, OID: ${merchantOid}, Hata: ${errMsg}`,
          );

          await paymentService.updatePaymentSession({
            id: matchedSession.id,
            amount: matchedSession.amount,
            currency_code: matchedSession.currency_code,
            data: {
              ...matchedSession.data,
              needs_manual_refund: true,
              manual_refund_reason: errMsg,
              captured_at: new Date().toISOString(),
            },
          });

          // Return OK to PayTR so it does not retry an unrecoverable business error
          return res.status(200).send("OK");
        } else {
          // Transient error: do NOT mark needs_manual_refund; return 500 so PayTR retries!
          console.error(
            `[PayTR Callback] Geçici hata oluştu, PayTR tekrar deneyecek (Sepet: ${cartId}, OID: ${merchantOid}): ${errMsg}`,
          );
          return res.status(500).send("PAYTR_TRANSIENT_ERROR");
        }
      }
    }

    return res.status(200).send("OK");
  });
};
