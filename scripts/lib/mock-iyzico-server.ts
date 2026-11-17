import crypto from "crypto";
import http from "http";

export type MockIyzicoBehavior =
  | "success"
  | "failed"
  | "tampered_signature"
  | "amount_mismatch"
  | "wrong_session";

interface StoredTokenSession {
  token: string;
  conversationId: string;
  basketId: string;
  price: string;
  paidPrice: string;
  currency: string;
  callbackUrl: string;
  paymentId: string;
  paymentTransactionId: string;
}

function stripTrailingZeros(value: string | number): string {
  const str = String(value).trim();
  if (!str.includes(".")) return str;
  return str.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function calcSig(params: Array<string | number>, secretKey: string): string {
  return crypto.createHmac("sha256", secretKey).update(params.map(String).join(":")).digest("hex");
}

export function startMockIyzicoServer(opts: { port: number; apiKey: string; secretKey: string }) {
  const sessions = new Map<string, StoredTokenSession>();
  const behaviors = new Map<string, MockIyzicoBehavior>();
  let defaultBehavior: MockIyzicoBehavior = "success";

  const server = http.createServer(async (req, res) => {
    const urlPath = (req.url || "").split("?")[0];

    if (req.method === "GET" && urlPath.startsWith("/checkout/")) {
      const token = urlPath.slice("/checkout/".length);
      const sess = sessions.get(token);
      if (!sess) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Token not found");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><title>Mock iyzico Checkout</title></head>
<body>
  <h1>Mock iyzico Ödeme Sayfası</h1>
  <form id="mock-iyzico-form" method="POST" action="${sess.callbackUrl}">
    <input type="hidden" name="token" value="${sess.token}" />
    <button id="mock-pay-submit" type="submit">Ödemeyi Tamamla</button>
  </form>
</body>
</html>`);
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const chunks: Buffer[] = [];
    for await (const c of req) {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");
    let body: any = {};
    try {
      body = JSON.parse(rawBody || "{}");
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "failure", errorMessage: "Invalid JSON" }));
      return;
    }

    // Verify IYZWSv2 header
    const authHeader = String(req.headers["authorization"] || "");
    const randomKey = String(req.headers["x-iyzi-rnd"] || "");
    if (!authHeader.startsWith("IYZWSv2 ")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "failure", errorMessage: "Missing IYZWSv2 header" }));
      return;
    }

    const decoded = Buffer.from(authHeader.slice("IYZWSv2 ".length), "base64").toString("utf8");
    const expectedSig = crypto
      .createHmac("sha256", opts.secretKey)
      .update(randomKey + urlPath + rawBody)
      .digest("hex");
    const expectedAuth = `apiKey:${opts.apiKey}&randomKey:${randomKey}&signature:${expectedSig}`;
    if (decoded !== expectedAuth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ status: "failure", errorCode: "1000", errorMessage: "Invalid signature" }),
      );
      return;
    }

    if (urlPath === "/payment/bin/check") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "success", binNumber: body.binNumber || "535805" }));
      return;
    }

    if (urlPath === "/payment/iyzipos/checkoutform/initialize/auth/ecom") {
      const token = `iyzmock_${crypto.randomBytes(8).toString("hex")}`;
      const conversationId = String(body.conversationId || "");
      const sess: StoredTokenSession = {
        token,
        conversationId,
        basketId: String(body.basketId || ""),
        price: String(body.price || "0.00"),
        paidPrice: String(body.paidPrice || "0.00"),
        currency: String(body.currency || "TRY"),
        callbackUrl: String(
          body.callbackUrl || "http://localhost:3100/api/payment/iyzico/callback",
        ),
        paymentId: `iyzpay_${Date.now()}`,
        paymentTransactionId: `iyzptx_${Date.now()}`,
      };
      sessions.set(token, sess);
      const signature = calcSig([conversationId, token], opts.secretKey);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "success",
          conversationId,
          token,
          paymentPageUrl: `https://sandbox-cpp.iyzipay.com/checkout/${token}`,
          checkoutFormContent: `<div id="iyzipay-checkout-form">mock-${token}</div>`,
          signature,
        }),
      );
      return;
    }

    if (urlPath === "/payment/iyzipos/checkoutform/auth/ecom/detail") {
      const token = String(body.token || "");
      const sess = sessions.get(token);
      if (!sess) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ status: "failure", errorCode: "5001", errorMessage: "Token not found" }),
        );
        return;
      }

      const mode = behaviors.get(token) || defaultBehavior;
      if (mode === "failed") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "success",
            paymentStatus: "FAILURE",
            token,
            conversationId: sess.conversationId,
            errorCode: "10051",
            errorMessage: "Yetersiz bakiye",
          }),
        );
        return;
      }

      const paidPrice = mode === "amount_mismatch" ? "1.00" : sess.paidPrice;
      const basketId = mode === "wrong_session" ? "wrong_basket_id" : sess.basketId;
      const signature =
        mode === "tampered_signature"
          ? "deadbeef0000"
          : calcSig(
              [
                "SUCCESS",
                sess.paymentId,
                sess.currency,
                basketId,
                sess.conversationId,
                stripTrailingZeros(paidPrice),
                stripTrailingZeros(sess.price),
                token,
              ],
              opts.secretKey,
            );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "success",
          paymentStatus: "SUCCESS",
          paymentId: sess.paymentId,
          currency: sess.currency,
          basketId,
          conversationId: sess.conversationId,
          price: sess.price,
          paidPrice,
          token,
          signature,
          itemTransactions: [
            {
              itemId: "item_1",
              paymentTransactionId: sess.paymentTransactionId,
              price: sess.price,
              paidPrice,
            },
          ],
        }),
      );
      return;
    }

    if (urlPath === "/payment/cancel") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "success", paymentId: body.paymentId }));
      return;
    }

    if (urlPath === "/payment/refund") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "success",
          paymentTransactionId: body.paymentTransactionId,
          price: body.price,
        }),
      );
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  return {
    server,
    listen: () =>
      new Promise<void>((resolve) => {
        server.listen(opts.port, "127.0.0.1", () => resolve());
      }),
    close: () => server.close(),
    setBehaviorForToken: (token: string, b: MockIyzicoBehavior) => behaviors.set(token, b),
    setDefaultBehavior: (b: MockIyzicoBehavior) => {
      defaultBehavior = b;
    },
    getSession: (token: string) => sessions.get(token),
  };
}
