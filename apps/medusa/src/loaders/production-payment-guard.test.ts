import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  assertProductionPaymentSecurity,
  assertUndefinedInProduction,
  executePaymentSecurityCheck,
} from "./production-payment-guard";

describe("productionPaymentGuard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PAYTR_API_BASE;
    delete process.env.DEV_PAYTR_USER_IP;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("assertUndefinedInProduction", () => {
    it("allows dev env vars in development", () => {
      process.env.PAYTR_API_BASE = "https://mock.test";
      process.env.DEV_PAYTR_USER_IP = "1.2.3.4";
      expect(() => assertUndefinedInProduction("development")).not.toThrow();
    });

    it("throws if PAYTR_API_BASE is set in production", () => {
      process.env.PAYTR_API_BASE = "https://mock.test";
      expect(() => assertUndefinedInProduction("production")).toThrow(
        /PAYTR_API_BASE environment variable is strictly prohibited/,
      );
    });

    it("throws if DEV_PAYTR_USER_IP is set in production", () => {
      process.env.DEV_PAYTR_USER_IP = "1.2.3.4";
      expect(() => assertUndefinedInProduction("production")).toThrow(
        /DEV_PAYTR_USER_IP environment variable is strictly prohibited/,
      );
    });
  });

  describe("assertProductionPaymentSecurity", () => {
    it("allows dummy provider linked in development environment", () => {
      expect(() => {
        assertProductionPaymentSecurity(
          [{ regionId: "reg_123", providerId: "pp_system_default" }],
          "development",
        );
      }).not.toThrow();
    });

    it("allows certified payment providers in production", () => {
      expect(() => {
        assertProductionPaymentSecurity(
          [
            { regionId: "reg_123", providerId: "pp_paytr_paytr" },
            { regionId: "reg_123", providerId: "pp_cod_cod" },
          ],
          "production",
        );
      }).not.toThrow();
    });

    it("throws FAIL-CLOSED error if region_payment_provider is empty in production", () => {
      expect(() => {
        assertProductionPaymentSecurity([], "production");
      }).toThrow(/FAIL-CLOSED: No payment providers are linked to any region in production/);
    });

    it("Rule (a): throws FAIL-CLOSED error if any region is linked to pp_system_default in production", () => {
      expect(() => {
        assertProductionPaymentSecurity(
          [
            { regionId: "reg_123", providerId: "pp_paytr_paytr" },
            { regionId: "reg_123", providerId: "pp_system_default" },
          ],
          "production",
        );
      }).toThrow(
        /Region 'reg_123' is linked to forbidden dummy payment provider 'pp_system_default'/,
      );
    });

    it("Rule (b): throws FAIL-CLOSED error if no certified real provider is linked in production", () => {
      expect(() => {
        assertProductionPaymentSecurity(
          [{ regionId: "reg_123", providerId: "pp_some_unsupported" }],
          "production",
        );
      }).toThrow(
        /No certified real payment provider \('pp_paytr_paytr' or 'pp_cod_cod'\) is linked/,
      );
    });
  });

  describe("executePaymentSecurityCheck execution", () => {
    it("logs warning in development when pp_system_default is linked to a region", async () => {
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      };

      const mockKnex = vi.fn(() => ({
        select: vi.fn(() => ({
          whereNull: vi
            .fn()
            .mockResolvedValue([
              { region_id: "reg_dev", payment_provider_id: "pp_system_default" },
            ]),
        })),
      }));

      const mockContainer = {
        hasRegistration: vi.fn((key: string) => key === "__pg_connection__"),
        resolve: vi.fn((key: string) => (key === "__pg_connection__" ? mockKnex : null)),
      };

      await executePaymentSecurityCheck(mockContainer, mockLogger, "development");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Medusa is operating with dummy 'pp_system_default'"),
      );
    });

    it("fails closed (exit 1) in production when region is linked to dummy provider", async () => {
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      };

      const mockKnex = vi.fn(() => ({
        select: vi.fn(() => ({
          whereNull: vi.fn().mockResolvedValue([
            { region_id: "reg_prod", payment_provider_id: "pp_paytr_paytr" },
            { region_id: "reg_prod", payment_provider_id: "pp_system_default" },
          ]),
        })),
      }));

      const mockContainer = {
        hasRegistration: vi.fn((key: string) => key === "__pg_connection__"),
        resolve: vi.fn((key: string) => (key === "__pg_connection__" ? mockKnex : null)),
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

    it("fails closed in production when region_payment_provider cannot be read", async () => {
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
            "Fail-closed: Exiting process due to failure reading region_payment_provider",
          ),
        );
        expect(exitMock).toHaveBeenCalledWith(1);
      } finally {
        process.exit = originalExit;
      }
    });

    it("passes cleanly in production when region is linked to PayTR and COD", async () => {
      const mockLogger = {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      };

      const mockKnex = vi.fn(() => ({
        select: vi.fn(() => ({
          whereNull: vi.fn().mockResolvedValue([
            { region_id: "reg_prod", payment_provider_id: "pp_paytr_paytr" },
            { region_id: "reg_prod", payment_provider_id: "pp_cod_cod" },
          ]),
        })),
      }));

      const mockContainer = {
        hasRegistration: vi.fn((key: string) => key === "__pg_connection__"),
        resolve: vi.fn((key: string) => (key === "__pg_connection__" ? mockKnex : null)),
      };

      const originalExit = process.exit;
      const exitMock = vi.fn() as any;
      process.exit = exitMock;

      try {
        await executePaymentSecurityCheck(mockContainer, mockLogger, "production");
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("guard PASSED"));
        expect(exitMock).not.toHaveBeenCalled();
      } finally {
        process.exit = originalExit;
      }
    });
  });
});
