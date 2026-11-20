import { describe, it, expect, vi, beforeEach } from "vitest";

const { listHookSpy, listWithPricingHookSpy } = vi.hoisted(() => ({
  listHookSpy: vi.fn(),
  listWithPricingHookSpy: vi.fn(),
}));

vi.mock("@medusajs/core-flows", () => ({
  listShippingOptionsForCartWorkflow: {
    hooks: {
      setShippingOptionsContext: listHookSpy,
    },
  },
  listShippingOptionsForCartWithPricingWorkflow: {
    hooks: {
      setShippingOptionsContext: listWithPricingHookSpy,
    },
  },
}));

describe("shipping-options-context hook", () => {
  beforeEach(() => {
    vi.resetModules();
    listHookSpy.mockClear();
    listWithPricingHookSpy.mockClear();
  });

  it("registers setShippingOptionsContext on BOTH listShippingOptionsForCartWorkflow and listShippingOptionsForCartWithPricingWorkflow", async () => {
    await import("./shipping-options-context");

    expect(listHookSpy).toHaveBeenCalledTimes(1);
    expect(listWithPricingHookSpy).toHaveBeenCalledTimes(1);
  });

  it("returns consistent item_total and subtotal while excluding COD service fee items", async () => {
    const { buildShippingOptionsContext } = await import("./shipping-options-context");

    expect(buildShippingOptionsContext({ item_total: 2922, subtotal: 2435 })).toEqual({
      item_total: "2922",
      subtotal: "2435",
    });

    // Cart with 1450 TL product + 100 TL COD fee -> item_total for shipping threshold must exclude COD fee (1450, not 1550)
    expect(
      buildShippingOptionsContext({
        item_total: 1550,
        subtotal: 1291.67,
        items: [
          { total: 1450, unit_price: 1450, quantity: 1, metadata: {} },
          { total: 100, unit_price: 100, quantity: 1, metadata: { is_cod_fee: true } },
        ],
      }),
    ).toEqual({
      item_total: "1450",
      subtotal: "1291.67",
    });
  });
});
