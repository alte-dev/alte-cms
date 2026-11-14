import nodemailer, { type Transporter } from "nodemailer";
import { decryptSetting, encryptSetting, maskSecret, parseEncryptionKey } from "../utils/crypto";
import { escapeHtml, isValidEmail, maskEmail, sanitizeHeader } from "../utils/email-sanitizer";

export const SINGLETON_EMAIL_SETTING_ID = "es_default";

export interface EmailSettingRow {
  id: string;
  enabled: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  username: string | null;
  password: string | null; // AES-256-GCM encrypted
  from_name: string;
  from_email: string;
  reply_to: string | null;
  admin_notify_email: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface MaskedEmailSettingsResponse {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  has_password: boolean;
  password_masked: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  admin_notify_email: string;
}

export interface EmailLogRow {
  id: string;
  order_id: string;
  template: string;
  idempotency_key: string;
  recipient_masked: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  error_code: string | null;
  attempts: number;
  payload_json?: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * In-memory settings registry to avoid repeated DB calls and decrypt cycles.
 */
class EmailSettingsRegistry {
  private static cachedSettings: EmailSettingRow | null = null;
  private static cacheExpiresAt: number = 0;
  private static readonly TTL_MS = 600000; // 10 minutes cache

  public static get(): EmailSettingRow | null {
    if (this.cachedSettings && Date.now() < this.cacheExpiresAt) {
      return this.cachedSettings;
    }
    return null;
  }

  public static set(settings: EmailSettingRow): void {
    this.cachedSettings = settings;
    this.cacheExpiresAt = Date.now() + this.TTL_MS;
  }

  public static invalidate(): void {
    this.cachedSettings = null;
    this.cacheExpiresAt = 0;
  }
}

/**
 * Retrieves the raw DB record or creates default row.
 */
export async function getOrCreateEmailSettings(pgConnection: any): Promise<EmailSettingRow> {
  const cached = EmailSettingsRegistry.get();
  if (cached) return cached;

  const existing = await pgConnection("email_setting")
    .where({ id: SINGLETON_EMAIL_SETTING_ID })
    .first();

  if (existing) {
    EmailSettingsRegistry.set(existing);
    return existing;
  }

  const defaultRow: EmailSettingRow = {
    id: SINGLETON_EMAIL_SETTING_ID,
    enabled: false,
    host: "127.0.0.1",
    port: 587,
    secure: false,
    username: "",
    password: null,
    from_name: "Mağaza",
    from_email: "siparis@example.test",
    reply_to: null,
    admin_notify_email: null,
  };

  try {
    await pgConnection("email_setting").insert(defaultRow);
  } catch {
    // Concurrent insert fallback
  }

  const finalRow =
    (await pgConnection("email_setting").where({ id: SINGLETON_EMAIL_SETTING_ID }).first()) ||
    defaultRow;

  EmailSettingsRegistry.set(finalRow);
  return finalRow;
}

/**
 * Returns masked settings for admin panel display.
 */
export async function getMaskedEmailSettings(
  pgConnection: any,
): Promise<MaskedEmailSettingsResponse> {
  const row = await getOrCreateEmailSettings(pgConnection);

  return {
    enabled: Boolean(row.enabled),
    host: row.host || "",
    port: Number(row.port) || 587,
    secure: Boolean(row.secure),
    username: row.username || "",
    has_password: Boolean(row.password),
    password_masked: row.password ? maskSecret(row.password) : "",
    from_name: row.from_name || "Mağaza",
    from_email: row.from_email || "siparis@example.test",
    reply_to: row.reply_to || "",
    admin_notify_email: row.admin_notify_email || "",
  };
}

/**
 * Updates settings safely. Encrypts password with AES-256-GCM.
 */
export async function updateEmailSettings(
  pgConnection: any,
  data: Partial<{
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password?: string;
    from_name: string;
    from_email: string;
    reply_to?: string;
    admin_notify_email?: string;
  }>,
  adminUser: string,
): Promise<MaskedEmailSettingsResponse> {
  const current = await getOrCreateEmailSettings(pgConnection);
  const keyBuf = parseEncryptionKey(process.env.SETTINGS_ENCRYPTION_KEY);

  const updates: Partial<EmailSettingRow> = {
    updated_at: new Date(),
  };

  if (data.enabled !== undefined) updates.enabled = Boolean(data.enabled);
  if (data.host !== undefined) updates.host = data.host.trim();
  if (data.port !== undefined) updates.port = Number(data.port);
  if (data.secure !== undefined) updates.secure = Boolean(data.secure);
  if (data.username !== undefined) updates.username = data.username.trim();
  if (data.from_name !== undefined) updates.from_name = sanitizeHeader(data.from_name);
  if (data.from_email !== undefined) updates.from_email = sanitizeHeader(data.from_email);
  if (data.reply_to !== undefined) updates.reply_to = sanitizeHeader(data.reply_to) || null;
  if (data.admin_notify_email !== undefined) {
    updates.admin_notify_email = sanitizeHeader(data.admin_notify_email) || null;
  }

  // Handle write-only password update
  if (data.password && typeof data.password === "string" && data.password.trim() !== "") {
    updates.password = encryptSetting(data.password.trim(), keyBuf);
  }

  await pgConnection("email_setting").where({ id: SINGLETON_EMAIL_SETTING_ID }).update(updates);

  EmailSettingsRegistry.invalidate();
  console.log(
    `[Email Settings] Güncellendi (admin: ${adminUser}, enabled: ${updates.enabled ?? current.enabled})`,
  );

  return getMaskedEmailSettings(pgConnection);
}

/**
 * Creates Nodemailer transporter from decrypted settings.
 */
export async function createTransporter(pgConnection: any): Promise<{
  transporter: Transporter | null;
  settings: EmailSettingRow | null;
}> {
  const settings = await getOrCreateEmailSettings(pgConnection);

  if (!settings.enabled || !settings.host) {
    return { transporter: null, settings };
  }

  let decryptedPassword = "";
  if (settings.password) {
    try {
      const keyBuf = parseEncryptionKey(process.env.SETTINGS_ENCRYPTION_KEY);
      decryptedPassword = decryptSetting(settings.password, keyBuf);
    } catch (err: any) {
      console.error("[Email Service] SMTP parolası çözülemedi:", err.message);
    }
  }

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.username
      ? {
          user: settings.username,
          pass: decryptedPassword,
        }
      : undefined,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });

  return { transporter, settings };
}

const inMemoryOrderPayloads = new Map<string, OrderEmailPayload>();

export function cacheOrderPayloadForRetry(orderId: string, payload: OrderEmailPayload) {
  inMemoryOrderPayloads.set(orderId, payload);
}

export async function getOrderPayloadById(
  pgConnection: any,
  orderId: string,
): Promise<OrderEmailPayload | null> {
  if (inMemoryOrderPayloads.has(orderId)) {
    return inMemoryOrderPayloads.get(orderId)!;
  }

  if (!pgConnection) return null;

  try {
    const order = await pgConnection("order").where({ id: orderId }).first();
    if (!order) return null;

    const items = await pgConnection("order_item")
      .where({ order_id: orderId })
      .orWhere({ order_id: order.id });

    const meta =
      typeof order.metadata === "string" ? JSON.parse(order.metadata) : order.metadata || {};

    const address = order.shipping_address || {};

    return {
      orderId: order.id,
      displayId: order.display_id || order.id.slice(-6),
      customerEmail: order.email,
      customerName:
        [address.first_name, address.last_name].filter(Boolean).join(" ") || "Değerli Müşterimiz",
      items: (items || []).map((it: any) => ({
        title: it.title || "Ürün",
        quantity: Number(it.quantity || 1),
        unitPriceTRY: Number(it.unit_price || 0),
        totalPriceTRY: Number(it.unit_price || 0) * Number(it.quantity || 1),
      })),
      subtotalTRY: Number(order.subtotal || 0),
      shippingTRY: Number(order.shipping_total || 0),
      codFeeTRY: meta.cod_fee ? Number(meta.cod_fee) : undefined,
      totalTRY: Number(order.total || 0),
      paymentMethod: meta.payment_provider === "cod" ? "Kapıda Ödeme" : "Kredi Kartı (PayTR)",
      shippingAddress: {
        address1: address.address_1 || "",
        city: address.city || "",
        province: address.province || "",
      },
      trackingCode: meta.tracking_code,
      trackingUrl: meta.tracking_url,
      carrierName: meta.carrier_name,
    };
  } catch {
    return null;
  }
}

export interface OrderEmailPayload {
  orderId: string;
  displayId: string | number;
  customerEmail: string;
  customerName: string;
  items: Array<{
    title: string;
    variantTitle?: string;
    sku?: string;
    quantity: number;
    unitPriceTRY: number;
    totalPriceTRY: number;
  }>;
  subtotalTRY: number;
  shippingTRY: number;
  codFeeTRY?: number;
  totalTRY: number;
  paymentMethod: string;
  shippingAddress: {
    address1: string;
    city: string;
    postalCode?: string;
    province?: string;
  };
  trackingCode?: string;
  trackingUrl?: string;
  carrierName?: string;
  cancelReason?: string;
  paymentFailReason?: string;
}

/**
 * Builds HTML and Text templates with strict HTML escaping and KVKK compliance.
 */
export function buildEmailTemplate(
  template:
    | "order.placed_customer"
    | "order.placed_admin"
    | "shipment.created"
    | "order.canceled"
    | "payment.failed_admin",
  payload: OrderEmailPayload,
  storeName: string = process.env.STORE_NAME || "Mağaza",
  storeUrl: string = process.env.WEB_PUBLIC_URL || "https://example.test",
): { subject: string; html: string; text: string } {
  const safeStoreName = escapeHtml(storeName);
  const displayId = escapeHtml(payload.displayId);
  const safeName = escapeHtml(payload.customerName || "Değerli Müşterimiz");

  const footerHtml = `
    <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0;" />
    <p style="font-size:12px;color:#78716c;line-height:1.5;">
      Bu e-posta sipariş bilgilendirmesi amacıyla otomatik olarak oluşturulmuştur.<br />
      <a href="${escapeHtml(storeUrl)}/sayfa/mesafeli-satis-sozlesmesi" style="color:#1c1917;text-decoration:underline;">Mesafeli Satış Sözleşmesi</a> &bull; 
      <a href="${escapeHtml(storeUrl)}/sayfa/kvkk" style="color:#1c1917;text-decoration:underline;">KVKK Aydınlatma Metni</a><br />
      &copy; ${new Date().getFullYear()} ${safeStoreName}. Tüm hakları saklıdır.
    </p>
  `;

  const footerText = `\n---\nBu e-posta sipariş bilgilendirmesi amacıyla otomatik olarak gönderilmiştir.\nMesafeli Satış Sözleşmesi: ${storeUrl}/sayfa/mesafeli-satis-sozlesmesi\nKVKK: ${storeUrl}/sayfa/kvkk\n© ${new Date().getFullYear()} ${storeName}.`;

  if (template === "order.placed_customer") {
    const subject = sanitizeHeader(`Siparişiniz Alındı — #${payload.displayId} | ${storeName}`);

    const itemRowsHtml = payload.items
      .map(
        (it) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #f5f5f4;">
            <strong>${escapeHtml(it.title)}</strong>
            ${it.variantTitle ? `<br/><small style="color:#78716c;">${escapeHtml(it.variantTitle)}</small>` : ""}
            ${it.sku ? `<br/><small style="color:#a8a29e;">SKU: ${escapeHtml(it.sku)}</small>` : ""}
          </td>
          <td style="padding:8px;text-align:center;border-bottom:1px solid #f5f5f4;">${it.quantity}</td>
          <td style="padding:8px;text-align:right;border-bottom:1px solid #f5f5f4;">${it.totalPriceTRY.toFixed(2)} TL</td>
        </tr>`,
      )
      .join("");

    const codLineHtml =
      payload.codFeeTRY && payload.codFeeTRY > 0
        ? `<tr>
            <td colspan="2" style="padding:6px 8px;text-align:right;color:#78716c;">Kapıda Ödeme Hizmet Bedeli:</td>
            <td style="padding:6px 8px;text-align:right;font-weight:500;">${payload.codFeeTRY.toFixed(2)} TL</td>
          </tr>`
        : "";

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1c1917;background-color:#ffffff;border:1px solid #e7e5e4;border-radius:12px;">
        <h2 style="margin-top:0;color:#1c1917;">Siparişiniz Alındı!</h2>
        <p>Merhaba <strong>${safeName}</strong>,</p>
        <p>Siparişiniz başarıyla alındı ve hazırlanma sürecine girdi. Sipariş detaylarınız aşağıdadır:</p>
        
        <div style="background-color:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px;"><strong>Sipariş No:</strong> #${displayId}</p>
          <p style="margin:0 0 8px;"><strong>Ödeme Yöntemi:</strong> ${escapeHtml(payload.paymentMethod)}</p>
          <p style="margin:0;"><strong>Teslimat Adresi:</strong> ${escapeHtml(payload.shippingAddress.address1)}, ${escapeHtml(payload.shippingAddress.city)}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <thead>
            <tr style="background-color:#f5f5f4;text-align:left;">
              <th style="padding:8px;">Ürün</th>
              <th style="padding:8px;text-align:center;">Adet</th>
              <th style="padding:8px;text-align:right;">Tutar (KDV Dahil)</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:6px 8px;text-align:right;color:#78716c;">Ara Toplam:</td>
              <td style="padding:6px 8px;text-align:right;font-weight:500;">${payload.subtotalTRY.toFixed(2)} TL</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:6px 8px;text-align:right;color:#78716c;">Kargo Ücreti:</td>
              <td style="padding:6px 8px;text-align:right;font-weight:500;">${payload.shippingTRY.toFixed(2)} TL</td>
            </tr>
            ${codLineHtml}
            <tr style="font-size:16px;">
              <td colspan="2" style="padding:10px 8px;text-align:right;font-weight:bold;border-top:2px solid #1c1917;">Genel Toplam (KDV Dahil):</td>
              <td style="padding:10px 8px;text-align:right;font-weight:bold;border-top:2px solid #1c1917;">${payload.totalTRY.toFixed(2)} TL</td>
            </tr>
          </tfoot>
        </table>
        ${footerHtml}
      </div>
    `;

    const text = `Merhaba ${payload.customerName},\n\nSiparişiniz alındı (#${payload.displayId}).\nÖdeme Yöntemi: ${payload.paymentMethod}\nToplam Tutar: ${payload.totalTRY.toFixed(2)} TL (KDV Dahil)\n${payload.codFeeTRY ? `Kapıda Ödeme Bedeli: ${payload.codFeeTRY.toFixed(2)} TL\n` : ""}Teslimat: ${payload.shippingAddress.address1}, ${payload.shippingAddress.city}\n${footerText}`;

    return { subject, html, text };
  }

  if (template === "order.placed_admin") {
    const subject = sanitizeHeader(
      `[YENİ SİPARİŞ] #${payload.displayId} — ${payload.totalTRY.toFixed(2)} TL`,
    );

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1c1917;background-color:#ffffff;border:1px solid #e7e5e4;border-radius:12px;">
        <h2 style="margin-top:0;color:#1c1917;">Yeni Sipariş Bildirimi</h2>
        <p>Mağazanızdan yeni bir sipariş verildi. Güvenlik ve KVKK gereği müşteri kişisel bilgileri bu e-postada maskelenmiştir.</p>
        <div style="background-color:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px;"><strong>Sipariş No:</strong> #${displayId}</p>
          <p style="margin:0 0 8px;"><strong>Toplam Tutar:</strong> ${payload.totalTRY.toFixed(2)} TL</p>
          <p style="margin:0 0 8px;"><strong>Ödeme Yöntemi:</strong> ${escapeHtml(payload.paymentMethod)}</p>
          <p style="margin:0;"><strong>Ürün Kalem Sayısı:</strong> ${payload.items.length} adet</p>
        </div>
        <p>
          <a href="${escapeHtml(storeUrl)}/admin/orders/${escapeHtml(payload.orderId)}" style="display:inline-block;background-color:#1c1917;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:500;">
            Siparişi Admin Panelinde Görüntüle &rarr;
          </a>
        </p>
        ${footerHtml}
      </div>
    `;

    const text = `Yeni sipariş (#${payload.displayId}) alındı.\nTutar: ${payload.totalTRY.toFixed(2)} TL\nÖdeme Yöntemi: ${payload.paymentMethod}\nDetaylar: ${storeUrl}/admin/orders/${payload.orderId}\n${footerText}`;

    return { subject, html, text };
  }

  if (template === "shipment.created") {
    const subject = sanitizeHeader(
      `Siparişiniz Kargoya Verildi — #${payload.displayId} | ${storeName}`,
    );

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1c1917;background-color:#ffffff;border:1px solid #e7e5e4;border-radius:12px;">
        <h2 style="margin-top:0;color:#1c1917;">Siparişiniz Yola Çıktı!</h2>
        <p>Merhaba <strong>${safeName}</strong>,</p>
        <p>#${displayId} numaralı siparişiniz kargoya teslim edilmiştir.</p>
        <div style="background-color:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px;"><strong>Kargo Firması:</strong> ${escapeHtml(payload.carrierName || "Kargo")}</p>
          <p style="margin:0 0 8px;"><strong>Takip Kodu:</strong> ${escapeHtml(payload.trackingCode || "Henüz atanmadı")}</p>
          ${
            payload.trackingUrl
              ? `<p style="margin:0;"><a href="${escapeHtml(payload.trackingUrl)}" style="color:#1c1917;text-decoration:underline;font-weight:500;">Kargo Takip Bağlantısına Git &rarr;</a></p>`
              : ""
          }
        </div>
        ${footerHtml}
      </div>
    `;

    const text = `Merhaba ${payload.customerName},\n\n#${payload.displayId} numaralı siparişiniz kargoya teslim edildi.\nKargo Firması: ${payload.carrierName}\nTakip Kodu: ${payload.trackingCode}\n${payload.trackingUrl ? `Takip: ${payload.trackingUrl}\n` : ""}${footerText}`;

    return { subject, html, text };
  }

  if (template === "order.canceled") {
    const subject = sanitizeHeader(
      `Siparişiniz İptal Edildi — #${payload.displayId} | ${storeName}`,
    );

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1c1917;background-color:#ffffff;border:1px solid #e7e5e4;border-radius:12px;">
        <h2 style="margin-top:0;color:#dc2626;">Sipariş İptal Edildi</h2>
        <p>Merhaba <strong>${safeName}</strong>,</p>
        <p>#${displayId} numaralı siparişiniz talebiniz veya stok durumu doğrultusunda iptal edilmiştir.</p>
        ${
          payload.cancelReason
            ? `<p><strong>İptal Nedeni:</strong> ${escapeHtml(payload.cancelReason)}</p>`
            : ""
        }
        <p>Kart ile yapılan ödemelerde iade işlemleri bankanızın süreçlerine bağlı olarak hesabınıza yansıyacaktır.</p>
        ${footerHtml}
      </div>
    `;

    const text = `Merhaba ${payload.customerName},\n\n#${payload.displayId} numaralı siparişiniz iptal edilmiştir.\n${payload.cancelReason ? `Neden: ${payload.cancelReason}\n` : ""}${footerText}`;

    return { subject, html, text };
  }

  // payment.failed_admin
  const subject = sanitizeHeader(`[DİKKAT] Ödeme Hatası / İade İhtiyacı — #${payload.displayId}`);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1c1917;background-color:#ffffff;border:1px solid #e7e5e4;border-radius:12px;">
      <h2 style="margin-top:0;color:#dc2626;">Ödeme / İade Uyarısı</h2>
      <p>#${displayId} numaralı siparişte ödeme hatası veya elle iade gerektiren bir durum oluştu.</p>
      <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;"><strong>Sipariş No:</strong> #${displayId}</p>
        <p style="margin:0 0 8px;"><strong>Tutar:</strong> ${payload.totalTRY.toFixed(2)} TL</p>
        <p style="margin:0;"><strong>Hata / Durum Kodu:</strong> ${escapeHtml(payload.paymentFailReason || "needs_manual_refund")}</p>
      </div>
      <p>PayTR paneli ve Medusa Admin "Elle İade Bekleyenler" listesinden işlemi kontrol edebilirsiniz.</p>
      ${footerHtml}
    </div>
  `;

  const text = `[UYARI] #${payload.displayId} numaralı siparişte ödeme hatası/iade ihtiyacı oluştu.\nTutar: ${payload.totalTRY.toFixed(2)} TL\nDurum: ${payload.paymentFailReason || "needs_manual_refund"}\n${footerText}`;

  return { subject, html, text };
}

/**
 * Dispatches an email notification idempotently with retry and logging.
 * Non-blocking: failures are logged, never thrown to break order flow.
 */
export async function sendEmailNotification(
  pgConnection: any,
  template:
    | "order.placed_customer"
    | "order.placed_admin"
    | "shipment.created"
    | "order.canceled"
    | "payment.failed_admin",
  recipientEmail: string,
  payload: OrderEmailPayload,
): Promise<{ success: boolean; logId?: string; status: string }> {
  const idempotencyKey = `${payload.orderId}:${template}`;
  const maskedRecipient = maskEmail(recipientEmail);

  // 1. Idempotency Check: if already sent, return existing
  const existingLog = await pgConnection("email_log")
    .where({ idempotency_key: idempotencyKey })
    .first();

  if (existingLog && existingLog.status === "sent") {
    console.log(`[Email Service] İdempotent: ${idempotencyKey} zaten gönderildi, atlanıyor.`);
    return { success: true, logId: existingLog.id, status: "sent" };
  }

  const { subject, html, text } = buildEmailTemplate(template, payload);
  const { transporter, settings } = await createTransporter(pgConnection);

  if (!transporter || !settings?.enabled) {
    console.log(
      `[Email Service] E-posta bildirimleri kapalı veya yapılandırılmamış (${template}).`,
    );
    const logId = `elog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await pgConnection("email_log")
        .insert({
          id: logId,
          order_id: payload.orderId,
          template,
          idempotency_key: idempotencyKey,
          recipient_masked: maskedRecipient,
          subject,
          status: "skipped",
          error_code: "SMTP_DISABLED",
          attempts: 0,
          payload_json: JSON.stringify(payload),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict("idempotency_key")
        .merge();
    } catch {
      // ignore log error
    }
    return { success: false, logId, status: "skipped" };
  }

  // 2. Retry Loop: 3 attempts with exponential backoff
  let lastError: any = null;
  let attempts = 0;
  const maxAttempts = 3;

  for (let i = 1; i <= maxAttempts; i++) {
    attempts = i;
    try {
      await transporter.sendMail({
        from: `"${sanitizeHeader(settings.from_name)}" <${sanitizeHeader(settings.from_email)}>`,
        to: sanitizeHeader(recipientEmail),
        replyTo: settings.reply_to ? sanitizeHeader(settings.reply_to) : undefined,
        subject,
        html,
        text,
      });

      lastError = null;
      break; // Success
    } catch (err: any) {
      lastError = err;
      if (i < maxAttempts) {
        const backoffMs = Math.min(200 * Math.pow(2, i), 1000);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  cacheOrderPayloadForRetry(payload.orderId, payload);

  const logId =
    existingLog?.id || `elog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const status = lastError ? "failed" : "sent";
  const errorCode = lastError ? lastError.code || "SEND_FAILED" : null;

  try {
    await pgConnection("email_log")
      .insert({
        id: logId,
        order_id: payload.orderId,
        template,
        idempotency_key: idempotencyKey,
        recipient_masked: maskedRecipient,
        subject,
        status,
        error_code: errorCode,
        attempts,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict("idempotency_key")
      .merge({
        status,
        error_code: errorCode,
        attempts: pgConnection.raw("email_log.attempts + ?", [attempts]),
        updated_at: new Date(),
      });
  } catch (err: any) {
    console.error("[Email Service] Log kaydedilemedi:", err.message);
  }

  if (lastError) {
    console.warn(
      `[Email Service] E-posta gönderimi başarısız (${template}, alıcı: ${maskedRecipient}):`,
      errorCode,
    );
    return { success: false, logId, status: "failed" };
  }

  console.log(
    `[Email Service] E-posta başarıyla gönderildi (${template}, alıcı: ${maskedRecipient}).`,
  );
  return { success: true, logId, status: "sent" };
}

/**
 * Dispatches a transactional customer-account email (verification, password reset,
 * or duplicate-registration notice) without storing PII or tokens in email_log.
 */
export async function sendAccountEmail(
  pgConnection: any,
  input: {
    template: "account.verify_email" | "account.password_reset" | "account.duplicate_register";
    recipientEmail: string;
    referenceId: string;
    actionUrl?: string;
    storeName?: string;
  },
): Promise<{ success: boolean; status: string }> {
  if (!isValidEmail(input.recipientEmail)) {
    return { success: false, status: "invalid_email" };
  }

  const maskedRecipient = maskEmail(input.recipientEmail);
  const storeName = escapeHtml(input.storeName || process.env.STORE_NAME || "Mağaza");
  const safeUrl = input.actionUrl ? escapeHtml(input.actionUrl) : "";

  let subject = "";
  let html = "";
  let text = "";

  if (input.template === "account.verify_email") {
    subject = `${storeName} — E-posta Adresinizi Doğrulayın`;
    html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
        <h2 style="margin-top:0;">E-posta Doğrulama</h2>
        <p>${storeName} hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayınız (bağlantı 24 saat geçerlidir):</p>
        <p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;">E-postamı Doğrula</a></p>
        <p style="font-size:12px;color:#6b7280;">Bu talebi siz oluşturmadıysanız bu e-postayı dikkate almayınız.</p>
      </div>
    `;
    text = `E-posta adresinizi doğrulamak için bağlantıyı açınız (24 saat geçerlidir): ${input.actionUrl || ""}`;
  } else if (input.template === "account.password_reset") {
    subject = `${storeName} — Şifre Sıfırlama Talebi`;
    html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
        <h2 style="margin-top:0;">Şifre Sıfırlama</h2>
        <p>Şifrenizi sıfırlamak için aşağıdaki tek kullanımlık bağlantıya tıklayınız (15 dakika geçerlidir):</p>
        <p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;">Şifremi Sıfırla</a></p>
        <p style="font-size:12px;color:#6b7280;">Bu talebi siz oluşturmadıysanız şifreniz değişmeyecektir.</p>
      </div>
    `;
    text = `Şifrenizi sıfırlamak için bağlantıyı açınız (15 dakika geçerlidir): ${input.actionUrl || ""}`;
  } else {
    subject = `${storeName} — Hesabınız Zaten Kayıtlı`;
    html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
        <h2 style="margin-top:0;">Kayıt Denemesi Bilgilendirmesi</h2>
        <p>E-posta adresinizle yeni bir kayıt denemesi yapıldı. Zaten bir hesabınız bulunmaktadır.</p>
        <p>Şifrenizi unuttuysanız şifre sıfırlama sayfasından yeni şifre oluşturabilirsiniz.</p>
      </div>
    `;
    text = "E-posta adresinizle yeni bir kayıt denemesi yapıldı. Zaten bir hesabınız bulunmaktadır; şifrenizi unuttuysanız şifre sıfırlama sayfasını kullanabilirsiniz.";
  }

  const { transporter, settings } = await createTransporter(pgConnection);
  const logId = `elog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const idempotencyKey = `${input.referenceId}:${input.template}:${Date.now()}:${Math.random().toString(36).substring(2, 6)}`;

  if (!transporter || !settings?.enabled) {
    try {
      await pgConnection("email_log").insert({
        id: logId,
        order_id: input.referenceId,
        template: input.template,
        idempotency_key: idempotencyKey,
        recipient_masked: maskedRecipient,
        subject,
        status: "skipped",
        error_code: "SMTP_DISABLED",
        attempts: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch {
      // ignore log error
    }
    return { success: false, status: "skipped" };
  }

  let status: "sent" | "failed" = "sent";
  let errorCode: string | null = null;
  try {
    await transporter.sendMail({
      from: `"${sanitizeHeader(settings.from_name)}" <${sanitizeHeader(settings.from_email)}>`,
      to: sanitizeHeader(input.recipientEmail),
      replyTo: settings.reply_to ? sanitizeHeader(settings.reply_to) : undefined,
      subject,
      html,
      text,
    });
  } catch (err: any) {
    status = "failed";
    errorCode = (err?.code || err?.message || "SMTP_ERROR").slice(0, 60);
  }

  try {
    await pgConnection("email_log").insert({
      id: logId,
      order_id: input.referenceId,
      template: input.template,
      idempotency_key: idempotencyKey,
      recipient_masked: maskedRecipient,
      subject,
      status,
      error_code: errorCode,
      attempts: 1,
      created_at: new Date(),
      updated_at: new Date(),
    });
  } catch {
    // ignore log error
  }

  return { success: status === "sent", status };
}

/**
 * Retries a failed email log entry.
 */
export async function retryEmailLog(
  pgConnection: any,
  logId: string,
): Promise<{ success: boolean; error?: string }> {
  const log = await pgConnection("email_log").where({ id: logId }).first();
  if (!log) {
    return { success: false, error: "E-posta kaydı bulunamadı." };
  }

  // Load payload authoritatively from order data (Zero PII stored in email_log)
  const payload = await getOrderPayloadById(pgConnection, log.order_id);
  if (!payload) {
    return { success: false, error: "Sipariş verisi bulunamadı." };
  }

  const settings = await getOrCreateEmailSettings(pgConnection);
  let recipient = payload.customerEmail;
  if (log.template === "order.placed_admin" || log.template === "payment.failed_admin") {
    recipient = settings.admin_notify_email || settings.from_email;
  }

  if (!recipient || !isValidEmail(recipient)) {
    return { success: false, error: "Geçerli alıcı adresi bulunamadı." };
  }

  // Force reset status before retry
  await pgConnection("email_log").where({ id: logId }).update({
    status: "retrying",
    updated_at: new Date(),
  });

  const res = await sendEmailNotification(pgConnection, log.template as any, recipient, payload);

  return { success: res.success };
}

/**
 * Returns latest 100 email logs for admin panel.
 */
export async function getEmailLogs(pgConnection: any, limit: number = 100): Promise<EmailLogRow[]> {
  return await pgConnection("email_log")
    .select(
      "id",
      "order_id",
      "template",
      "idempotency_key",
      "recipient_masked",
      "subject",
      "status",
      "error_code",
      "attempts",
      "created_at",
      "updated_at",
    )
    .orderBy("created_at", "desc")
    .limit(limit);
}
