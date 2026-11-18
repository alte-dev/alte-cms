import { describe, expect, it, vi } from "vitest";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { ensureEnabledProvidersLinkedToRegions } from "./route";

describe("ensureEnabledProvidersLinkedToRegions", () => {
  it("links enabled payment providers to all regions idempotently", async () => {
    const createMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("already linked"))
      .mockResolvedValueOnce(undefined);
    const listRegionsMock = vi.fn().mockResolvedValue([{ id: "reg_tr" }]);

    const scope = {
      resolve: vi.fn((key: string) => {
        if (key === Modules.REGION) return { listRegions: listRegionsMock };
        if (key === ContainerRegistrationKeys.REMOTE_LINK) return { create: createMock };
        return undefined;
      }),
    } as any;

    await ensureEnabledProvidersLinkedToRegions(scope, {
      iyzico_enabled: true,
      cod_enabled: true,
      paytr_enabled: false,
    });

    expect(listRegionsMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenNthCalledWith(1, [
      {
        [Modules.REGION]: { region_id: "reg_tr" },
        [Modules.PAYMENT]: { payment_provider_id: "pp_iyzico_iyzico" },
      },
    ]);
    expect(createMock).toHaveBeenNthCalledWith(2, [
      {
        [Modules.REGION]: { region_id: "reg_tr" },
        [Modules.PAYMENT]: { payment_provider_id: "pp_cod_cod" },
      },
    ]);
  });

  it("does nothing when no providers are enabled", async () => {
    const resolveMock = vi.fn();
    await ensureEnabledProvidersLinkedToRegions({ resolve: resolveMock } as any, {
      iyzico_enabled: false,
      paytr_enabled: false,
      cod_enabled: false,
    });
    expect(resolveMock).not.toHaveBeenCalled();
  });
});
