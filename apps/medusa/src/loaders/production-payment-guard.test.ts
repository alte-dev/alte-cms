import { describe, it, expect, vi } from "vitest";
import {
  assertProductionPaymentSecurity,
  executePaymentSecurityCheck,
} from "./production-payment-guard";

describe("productionPaymentGuard", () => {
  describe("assertProductionPaymentSecurity", () => {
    it("allows dummy provider in development environment", () => {
      expect(() => {
        assertProductionPaymentSecurity(
          ["pp_system_default"],
          [{ regionId: "reg_123", providerId: "pp_system_default" }],
          "development",
        );
      }).not.toThrow();
    });

    it("allows certified payment provider in production", () => {
      expect(() => {
        assertProductionPaymentSecurity(
          ["pp_paytr", "pp_cod"],
          [{ regionId: "reg_123", providerId: "pp_paytr" }],
          "production",
        );
      }).not.toThrow();
    });

    it("throws FAIL-CLOSED error if pp_system_default is configured in production", () => {
      expect(() => {
        assertProductionPaymentSecurity(["pp_system_default"], [], "production");
      }).toThrow(/FAIL-CLOSED: 'pp_system_default' dummy payment provider is strictly prohibited/);
    });

    it("throws FAIL-CLOSED error if no payment providers are configured in production", () => {
      expect(() => {
        assertProductionPaymentSecurity([], [], "production");
      }).toThrow(/FAIL-CLOSED: No payment providers configured/);
    });

    it("throws FAIL-CLOSED error if a region is linked to pp_system_default in production", () => {
      expect(() => {
        assertProductionPaymentSecurity(
          ["pp_paytr"],
          [{ regionId: "reg_turkey", providerId: "pp_system_default" }],
          "production",
        );
      }).toThrow(/linked to forbidden dummy payment provider 'pp_system_default'/);
    });
  });

  describe("executePaymentSecurityCheck execution", () => {
    it("logs discovered payment providers and warning in development when pp_system_default is detected", async () => {
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      };

      const mockContainer = {
        hasRegistration: vi.fn((key: string) => key === "payment"),
        resolve: vi.fn((key: string) => {
          if (key === "payment") {
            return {
              listPaymentProviders: vi.fn().mockResolvedValue([{ id: "pp_system_default" }]),
            };
          }
          return null;
        }),
      };

      await executePaymentSecurityCheck(mockContainer, mockLogger, "development");

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          '[Payment Guard] Bulunan ödeme sağlayıcıları: ["pp_system_default"]',
        ),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Medusa is operating with dummy 'pp_system_default'"),
      );
    });

    it("fails closed in production when container has dummy provider", async () => {
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      };

      const mockContainer = {
        hasRegistration: vi.fn((key: string) => key === "payment"),
        resolve: vi.fn((key: string) => {
          if (key === "payment") {
            return {
              listPaymentProviders: vi.fn().mockResolvedValue([{ id: "pp_system_default" }]),
            };
          }
          return null;
        }),
      };

      const originalExit = process.exit;
      const exitMock = vi.fn() as any;
      process.exit = exitMock;

      try {
        await executePaymentSecurityCheck(mockContainer, mockLogger, "production");
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("Production Payment Guard violation"),
        );
        expect(exitMock).toHaveBeenCalledWith(1);
      } finally {
        process.exit = originalExit;
      }
    });

    it("fails closed in production when payment providers cannot be queried", async () => {
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      };

      const mockContainer = {
        hasRegistration: vi.fn(() => false),
        resolve: vi.fn(),
      };

      const originalExit = process.exit;
      const exitMock = vi.fn() as any;
      process.exit = exitMock;

      try {
        await executePaymentSecurityCheck(mockContainer, mockLogger, "production");
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            "Fail-closed: Exiting process due to payment provider query error",
          ),
        );
        expect(exitMock).toHaveBeenCalledWith(1);
      } finally {
        process.exit = originalExit;
      }
    });
  });
});
