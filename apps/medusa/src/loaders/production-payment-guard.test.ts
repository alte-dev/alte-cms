import { describe, it, expect, vi } from "vitest";
import {
  assertProductionPaymentSecurity,
  productionPaymentGuardLoader,
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
          ["pp_paytr", "pp_iyzico"],
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

  describe("productionPaymentGuardLoader execution", () => {
    it("logs warning in development when pp_system_default is detected", async () => {
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
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

      await productionPaymentGuardLoader(mockContainer, mockLogger, "development");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Medusa is operating with dummy 'pp_system_default'"),
      );
    });

    it("fails closed and throws in production when container has pp_system_default", async () => {
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
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

      await expect(
        productionPaymentGuardLoader(mockContainer, mockLogger, "production"),
      ).rejects.toThrow(/FAIL-CLOSED/);
    });
  });
});
