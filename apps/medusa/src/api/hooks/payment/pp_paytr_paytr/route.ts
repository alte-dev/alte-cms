import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { completeCartWorkflow } from "@medusajs/core-flows";
import PaymentSettingsService, {
  PaymentSettingsRegistry,
} from "../../../../modules/payment-settings/service";
import PaytrPaymentService from "../../../../modules/payment-paytr/service";

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

  // 5. Query matching Payment Collection & Session via Medusa Payment Module
  const paymentService = req.scope.resolve(Modules.PAYMENT);
  const cartService = req.scope.resolve(Modules.CART);

  try {
    // Search payment sessions by merchant_oid stored in data
    const paymentCollections = await paymentService.listPaymentCollections(
      {},
      { relations: ["payment_sessions"] },
    );

    let matchedSession: any = null;
    let matchedCollection: any = null;

    for (const col of paymentCollections) {
      for (const ses of (col as any).payment_sessions || []) {
        if (ses.data?.merchant_oid === merchantOid) {
          matchedSession = ses;
          matchedCollection = col;
          break;
        }
      }
      if (matchedSession) break;
    }

    if (!matchedSession || !matchedCollection) {
      console.warn(
        `[PayTR Callback] merchant_oid (${merchantOid}) ile eşleşen ödeme oturumu bulunamadı. Bildirim döngüsünü durdurmak için OK dönülüyor.`,
      );
      // Return OK to prevent infinite retry from PayTR if session was removed or completed earlier
      return res.status(200).send("OK");
    }

    // 6. Find Cart ID
    let cartId = (matchedSession.data as any)?.cart_id || (matchedCollection as any).cart_id;
    if (!cartId) {
      try {
        const linkService = req.scope.resolve(Modules.LINK) as any;
        const links = await linkService.list({
          [Modules.PAYMENT]: { payment_collection_id: matchedCollection.id },
        });
        if (links?.[0]?.cart_id) {
          cartId = links[0].cart_id;
        }
      } catch {
        // continue
      }
    }

    let cart: any = null;
    if (cartId) {
      try {
        cart = await cartService.retrieveCart(cartId);
      } catch {
        // continue
      }
    }

    // 7. Idempotency Check: if Cart is already completed, return OK immediately
    if (cart && cart.completed_at) {
      return res.status(200).send("OK");
    }

    // 8. Handle Failed Payment
    if (status !== "success") {
      console.warn(`[PayTR Callback] Ödeme başarısız bildirildi (oid=${merchantOid}):`, {
        code: failedReasonCode,
        msg: failedReasonMsg,
      });

      // Update session data with failure info
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

    // 9. Handle Success: Validate Total Amount >= Expected Amount
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

    // 10. Authorize and Complete Cart to Create Order
    await paymentService.updatePaymentSession({
      id: matchedSession.id,
      amount: matchedSession.amount,
      currency_code: matchedSession.currency_code,
      data: {
        ...matchedSession.data,
        status: "success",
        total_amount_received_kurus: receivedKurus,
        authorized_at: new Date().toISOString(),
      },
    });

    await paymentService.authorizePaymentSession(matchedSession.id, {});

    if (cartId) {
      try {
        const { result: order } = await completeCartWorkflow(req.scope).run({
          input: { id: cartId },
        });

        if (order?.id) {
          try {
            await cartService.updateCarts(cartId, {
              metadata: {
                ...cart?.metadata,
                order_id: order.id,
              },
            });
          } catch {
            // continue
          }
        }

        console.log(
          `[PayTR Callback] Sipariş başarıyla oluşturuldu! Sipariş ID: ${order?.id}, Sepet ID: ${cartId}, OID: ${merchantOid}`,
        );
      } catch (err: any) {
        // Critical edge case: Payment captured at PayTR, but cart completion failed (e.g. stock exhausted during checkout)
        console.error(
          `[CRITICAL ALERT] Ödeme PayTR tarafından tahsil edildi fakat Medusa siparişi oluşturulamadı! (needs_manual_refund) Sepet ID: ${cartId}, OID: ${merchantOid}, Hata: ${err.message}`,
        );

        await paymentService.updatePaymentSession({
          id: matchedSession.id,
          amount: matchedSession.amount,
          currency_code: matchedSession.currency_code,
          data: {
            ...matchedSession.data,
            needs_manual_refund: true,
            manual_refund_reason: err.message,
            captured_at: new Date().toISOString(),
          },
        });
      }
    }

    // Strictly return plain text "OK" without any HTML or whitespace
    return res.status(200).send("OK");
  } catch (err: any) {
    console.error(`[PayTR Callback] İşleme hatası: ${err.message}`);
    return res.status(500).send("PAYTR_INTERNAL_ERROR");
  }
};
