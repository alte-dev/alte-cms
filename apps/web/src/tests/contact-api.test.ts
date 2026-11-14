import { describe, it, expect, beforeEach } from "vitest";
import {
  contactSubmissionSchema,
  checkContactRateLimit,
  resetContactRateLimitForTest,
} from "../lib/contact/contact-service";

describe("Contact Form Validation & Rate Limiting", () => {
  beforeEach(() => {
    resetContactRateLimitForTest();
  });

  it("accepts a valid Turkish contact submission", () => {
    const res = contactSubmissionSchema.safeParse({
      name: "Ayşe Yılmaz",
      email: "ayse@example.test",
      phone: "0555 000 00 00",
      subject: "Sipariş Durumu",
      message: "Merhaba, siparişim hakkında bilgi almak istiyorum.",
      kvkkAccepted: true,
      website: "",
    });
    expect(res.success).toBe(true);
  });

  it("rejects missing KVKK acceptance, short message, or invalid email", () => {
    const noKvkk = contactSubmissionSchema.safeParse({
      name: "Ayşe Yılmaz",
      email: "ayse@example.test",
      subject: "Konu",
      message: "Merhaba, bu geçerli uzunlukta bir mesajdır.",
      kvkkAccepted: false,
    });
    expect(noKvkk.success).toBe(false);

    const badEmail = contactSubmissionSchema.safeParse({
      name: "Ayşe Yılmaz",
      email: "not-an-email",
      subject: "Konu",
      message: "Merhaba, bu geçerli uzunlukta bir mesajdır.",
      kvkkAccepted: true,
    });
    expect(badEmail.success).toBe(false);

    const shortMessage = contactSubmissionSchema.safeParse({
      name: "Ayşe Yılmaz",
      email: "ayse@example.test",
      subject: "Konu",
      message: "Kısa",
      kvkkAccepted: true,
    });
    expect(shortMessage.success).toBe(false);
  });

  it("enforces IP rate limit (5 requests per 15 min window)", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 5; i++) {
      expect(checkContactRateLimit("ip:192.0.2.10", now).allowed).toBe(true);
    }
    const blocked = checkContactRateLimit("ip:192.0.2.10", now + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);

    // Separate IP is unaffected
    expect(checkContactRateLimit("ip:192.0.2.11", now + 1000).allowed).toBe(true);

    // Resets after window
    expect(checkContactRateLimit("ip:192.0.2.10", now + 15 * 60 * 1000 + 1).allowed).toBe(true);
  });
});
