import { describe, expect, it, vi } from "vitest";
import { resolveAdminActorId, updateOrderAtomically } from "./order-metadata-tx";

describe("SEC-003 & SEC-007: Atomic Order Metadata Transaction & Admin Actor Resolution", () => {
  it("locks order row with FOR UPDATE and merges metadata atomically via jsonb ||", async () => {
    const rawQueries: Array<{ sql: string; bindings: unknown[] }> = [];
    const fakeTrx = {
      raw: vi.fn(async (sql: string, bindings: unknown[]) => {
        rawQueries.push({ sql, bindings });
        if (sql.includes("FOR UPDATE")) {
          return {
            rows: [
              {
                id: "order_123",
                status: "pending",
                metadata: { existing_key: "preserved" },
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };
    const fakePg = {
      transaction: vi.fn(async (fn: (trx: typeof fakeTrx) => Promise<unknown>) => fn(fakeTrx)),
    };

    const res = await updateOrderAtomically(fakePg, "order_123", (row) => {
      expect(row.metadata?.existing_key).toBe("preserved");
      return {
        status: "canceled",
        metadataPatch: { needs_manual_refund: true },
        result: { canceled: true },
      };
    });

    expect(res).toEqual({ ok: true, result: { canceled: true } });
    expect(rawQueries).toHaveLength(2);
    expect(rawQueries[0].sql).toContain("FOR UPDATE");
    expect(rawQueries[1].sql).toContain("COALESCE(metadata, '{}'::jsonb) || CAST(? AS jsonb)");
    expect(rawQueries[1].bindings).toEqual([
      "canceled",
      JSON.stringify({ needs_manual_refund: true }),
      "order_123",
    ]);
  });

  it("aborts without executing UPDATE when guard rejects inside locked transaction", async () => {
    const rawSpy = vi.fn(async () => ({
      rows: [{ id: "order_123", status: "pending", metadata: { fulfillment_status: "shipped" } }],
    }));
    const fakePg = {
      transaction: vi.fn(async (fn: (trx: { raw: typeof rawSpy }) => Promise<unknown>) =>
        fn({ raw: rawSpy }),
      ),
    };

    const res = await updateOrderAtomically(fakePg, "order_123", (row) => {
      if (row.metadata?.fulfillment_status === "shipped") {
        return { abort: { statusCode: 400, body: { error: "Already shipped" } } };
      }
      return { metadataPatch: {}, result: null };
    });

    expect(res).toEqual({ ok: false, statusCode: 400, body: { error: "Already shipped" } });
    expect(rawSpy).toHaveBeenCalledTimes(1);
  });

  it("resolveAdminActorId reads Medusa v2 req.auth_context.actor_id before falling back", () => {
    expect(resolveAdminActorId({ auth_context: { actor_id: "user_01ADMIN" } })).toBe(
      "user_01ADMIN",
    );
    expect(resolveAdminActorId({})).toBe("admin");
  });
});
