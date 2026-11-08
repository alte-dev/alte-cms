import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import PaymentSettingsService from "../../../../modules/payment-settings/service";
import PaytrPaymentService from "../../../../modules/payment-paytr/service";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const service = req.scope.resolve<PaymentSettingsService>("paymentSettingsModuleService");
    const settings = await service.getDecryptedSettings();

    if (!settings.paytr_merchant_id) {
      return res.status(400).json({
        success: false,
        error: "Test için PayTR Mağaza No (merchant_id) tanımlı olmalıdır.",
      });
    }
    if (!settings.paytr_merchant_key) {
      return res.status(400).json({
        success: false,
        error: "Test için PayTR Mağaza Parolası (merchant_key) tanımlı olmalıdır.",
      });
    }
    if (!settings.paytr_merchant_salt) {
      return res.status(400).json({
        success: false,
        error: "Test için PayTR Gizli Anahtar (merchant_salt) tanımlı olmalıdır.",
      });
    }

    const paytrService = new PaytrPaymentService({}, {});
    const testOid = `TEST${Date.now()}`;
    const testAmountKurus = 100; // 1.00 TL test tutarı
    const testBasket = Buffer.from(JSON.stringify([["Bağlantı Testi", "1.00", 1]])).toString(
      "base64",
    );
    const testIp =
      (process.env.NODE_ENV !== "production" ? process.env.DEV_PAYTR_USER_IP : undefined) ||
      "127.0.0.1";

    const token = paytrService.computePaytrToken({
      merchant_id: settings.paytr_merchant_id,
      user_ip: testIp,
      merchant_oid: testOid,
      email: "test@example.com",
      payment_amount: testAmountKurus,
      user_basket: testBasket,
      no_installment: 1,
      max_installment: 0,
      currency: "TL",
      test_mode: 1, // Her zaman test_mode=1 ile çağrılır
      merchant_key: settings.paytr_merchant_key,
      merchant_salt: settings.paytr_merchant_salt,
    });

    const apiBase =
      (process.env.NODE_ENV !== "production" ? process.env.PAYTR_API_BASE : undefined) ||
      "https://www.paytr.com";

    const formBody = new URLSearchParams({
      merchant_id: settings.paytr_merchant_id,
      user_ip: testIp,
      merchant_oid: testOid,
      email: "test@example.com",
      payment_amount: String(testAmountKurus),
      paytr_token: token,
      user_basket: testBasket,
      debug_on: "1",
      no_installment: "1",
      max_installment: "0",
      user_name: "Test Bağlantı",
      user_address: "Test Adres",
      user_phone: "05000000000",
      merchant_ok_url: "http://localhost:3100/odeme/sonuc?durum=ok",
      merchant_fail_url: "http://localhost:3100/odeme/sonuc?durum=hata",
      timeout_limit: "30",
      currency: "TL",
      test_mode: "1",
      lang: "tr",
    });

    const paytrRes = await fetch(`${apiBase}/odeme/api/get-token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });

    const resData = (await paytrRes.json()) as any;

    if (resData.status === "success" && resData.token) {
      return res.status(200).json({
        success: true,
        message: "PayTR API bağlantısı başarılı! Test token üretildi.",
      });
    }

    return res.status(400).json({
      success: false,
      error: `PayTR API Yanıtı: ${resData.reason || "Bilinmeyen bir hata oluştu"}`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `PayTR bağlantı testi yürütülemedi: ${err.message}`,
    });
  }
};
