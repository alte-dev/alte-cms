import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  isBlockedSmtpMetadataHost,
  isValidEmail,
  isValidHostname,
  isValidSmtpPort,
  maskEmail,
  sanitizeHeader,
} from "./email-sanitizer";

describe("email-sanitizer utilities", () => {
  describe("escapeHtml", () => {
    it("escapes script tags and attributes", () => {
      expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
        "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
      );
      expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
      expect(escapeHtml("John's Book")).toBe("John&#039;s Book");
    });

    it("handles null and undefined gracefully", () => {
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
      expect(escapeHtml(123)).toBe("123");
    });
  });

  describe("sanitizeHeader", () => {
    it("strips CRLF injection characters", () => {
      const malicious = "Subject Line\r\nBcc: hacker@example.com\r\nContent-Type: text/html";
      expect(sanitizeHeader(malicious)).toBe(
        "Subject Line Bcc: hacker@example.com Content-Type: text/html",
      );
    });

    it("strips single CR or LF", () => {
      expect(sanitizeHeader("Header\nInjection")).toBe("Header Injection");
      expect(sanitizeHeader("Header\rInjection")).toBe("Header Injection");
    });
  });

  describe("maskEmail", () => {
    it("masks email username while preserving domain", () => {
      expect(maskEmail("customer@example.test")).toBe("c***@example.test");
      expect(maskEmail("ahmet.yilmaz@company.com.tr")).toBe("a***@company.com.tr");
    });

    it("handles single-character usernames safely", () => {
      expect(maskEmail("u@example.com")).toBe("*@example.com");
    });

    it("handles invalid or empty emails", () => {
      expect(maskEmail("")).toBe("***");
      expect(maskEmail("notanemail")).toBe("***");
    });
  });

  describe("isValidEmail", () => {
    it("accepts valid email addresses", () => {
      expect(isValidEmail("siparis@example.test")).toBe(true);
      expect(isValidEmail("admin.user+test@example.test")).toBe(true);
    });

    it("rejects invalid emails", () => {
      expect(isValidEmail("plainaddress")).toBe(false);
      expect(isValidEmail("@missingusername.com")).toBe(false);
      expect(isValidEmail("user@.com")).toBe(false);
      expect(isValidEmail("user@example")).toBe(false);
    });
  });

  describe("isValidSmtpPort", () => {
    it("validates ports", () => {
      expect(isValidSmtpPort(587)).toBe(true);
      expect(isValidSmtpPort(465)).toBe(true);
      expect(isValidSmtpPort(25)).toBe(true);
      expect(isValidSmtpPort(0)).toBe(false);
      expect(isValidSmtpPort(65536)).toBe(false);
      expect(isValidSmtpPort(587.5)).toBe(false);
    });
  });

  describe("isValidHostname", () => {
    it("validates hostnames and IP addresses", () => {
      expect(isValidHostname("smtp.gmail.com")).toBe(true);
      expect(isValidHostname("mail.example.test")).toBe(true);
      expect(isValidHostname("localhost")).toBe(true);
      expect(isValidHostname("127.0.0.1")).toBe(true);
      expect(isValidHostname("192.168.1.10")).toBe(true);
      expect(isValidHostname("10.0.0.5")).toBe(true);
      expect(isValidHostname("invalid_host!name")).toBe(false);
    });
  });

  describe("isBlockedSmtpMetadataHost", () => {
    it("blocks link-local and cloud metadata ranges (169.254.0.0/16, fe80::/10, 100.64.0.0/10)", () => {
      expect(isBlockedSmtpMetadataHost("169.254.169.254")).toBe(true);
      expect(isBlockedSmtpMetadataHost("169.254.0.1")).toBe(true);
      expect(isBlockedSmtpMetadataHost("fe80::1")).toBe(true);
      expect(isBlockedSmtpMetadataHost("[fe80::1]")).toBe(true);
      expect(isBlockedSmtpMetadataHost("100.64.0.1")).toBe(true);
      expect(isBlockedSmtpMetadataHost("100.127.255.254")).toBe(true);
    });

    it("allows localhost, 127.0.0.1, RFC1918 private IPs, and normal SMTP domains", () => {
      expect(isBlockedSmtpMetadataHost("smtp.example.test")).toBe(false);
      expect(isBlockedSmtpMetadataHost("127.0.0.1")).toBe(false);
      expect(isBlockedSmtpMetadataHost("localhost")).toBe(false);
      expect(isBlockedSmtpMetadataHost("192.168.1.10")).toBe(false);
      expect(isBlockedSmtpMetadataHost("10.0.0.5")).toBe(false);
      expect(isBlockedSmtpMetadataHost("172.16.0.5")).toBe(false);
    });
  });
});
