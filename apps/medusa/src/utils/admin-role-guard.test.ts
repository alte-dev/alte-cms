import { describe, expect, it, vi } from "vitest";
import {
  checkAdminOrShopManagerRole,
  checkAdminSettingsRole,
  ensureExistingAdminRoles,
} from "./admin-role-guard";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function createReqWithRole(role?: string) {
  return {
    auth_context: { actor_id: "usr_1" },
    scope: {
      resolve: () => ({
        retrieveUser: vi.fn().mockResolvedValue({
          id: "usr_1",
          metadata: role ? { role } : {},
        }),
      }),
    },
  };
}

describe("admin-role-guard (fail-closed)", () => {
  it("returns 403 when user has no role (fail-closed, never defaults to admin)", async () => {
    const res1 = createMockRes();
    const ok1 = await checkAdminSettingsRole(createReqWithRole(undefined) as any, res1);
    expect(ok1).toBe(false);
    expect(res1.statusCode).toBe(403);

    const res2 = createMockRes();
    const ok2 = await checkAdminOrShopManagerRole(createReqWithRole(undefined) as any, res2);
    expect(ok2).toBe(false);
    expect(res2.statusCode).toBe(403);
  });

  it("returns 403 for unknown role", async () => {
    const res = createMockRes();
    const ok = await checkAdminOrShopManagerRole(createReqWithRole("mystery-role") as any, res);
    expect(ok).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("blocks editor on both order operations and settings", async () => {
    const res1 = createMockRes();
    expect(await checkAdminOrShopManagerRole(createReqWithRole("editor") as any, res1)).toBe(false);
    expect(res1.statusCode).toBe(403);

    const res2 = createMockRes();
    expect(await checkAdminSettingsRole(createReqWithRole("editor") as any, res2)).toBe(false);
    expect(res2.statusCode).toBe(403);
  });

  it("allows shop-manager on order operations but blocks on settings", async () => {
    const res1 = createMockRes();
    expect(await checkAdminOrShopManagerRole(createReqWithRole("shop-manager") as any, res1)).toBe(
      true,
    );

    const res2 = createMockRes();
    expect(await checkAdminSettingsRole(createReqWithRole("shop-manager") as any, res2)).toBe(
      false,
    );
    expect(res2.statusCode).toBe(403);
  });

  it("allows admin and super-admin on both", async () => {
    for (const role of ["admin", "super-admin"]) {
      const res1 = createMockRes();
      expect(await checkAdminOrShopManagerRole(createReqWithRole(role) as any, res1)).toBe(true);
      const res2 = createMockRes();
      expect(await checkAdminSettingsRole(createReqWithRole(role) as any, res2)).toBe(true);
    }
  });

  it("ensureExistingAdminRoles runs only once using persistent store.metadata.role_backfill_done", async () => {
    const storeRows: Array<{ id: string; metadata: Record<string, unknown> | null }> = [
      { id: "store_1", metadata: {} },
    ];
    const userRows: Array<{ id: string; metadata: Record<string, unknown> | null }> = [
      { id: "u1", metadata: null },
      { id: "u2", metadata: { role: "shop-manager" } },
    ];

    const mockPg = (table: string) => {
      if (table === "store") {
        return {
          whereNull: () => ({
            first: async () => storeRows[0] || null,
          }),
          where: ({ id }: { id: string }) => ({
            update: async ({ metadata }: { metadata: Record<string, unknown> }) => {
              const target = storeRows.find((s) => s.id === id);
              if (target) target.metadata = metadata;
            },
          }),
        };
      }
      return {
        whereNull: () => ({
          whereRaw: () => ({
            select: async () => userRows.filter((r) => !r.metadata?.role),
          }),
        }),
        where: ({ id }: { id: string }) => ({
          update: async ({ metadata }: { metadata: Record<string, unknown> }) => {
            const target = userRows.find((r) => r.id === id);
            if (target) target.metadata = metadata;
          },
        }),
      };
    };

    // First run: backfills u1 and marks role_backfill_done = true
    const first = await ensureExistingAdminRoles(mockPg);
    expect(first).toBe(1);
    expect(userRows[0].metadata?.role).toBe("super-admin");
    expect(userRows[1].metadata?.role).toBe("shop-manager");
    expect(storeRows[0].metadata?.role_backfill_done).toBe(true);

    // Add a new role-less user AFTER initial setup
    userRows.push({ id: "u3", metadata: null });

    // Second run: marker is set, so u3 MUST remain role-less!
    const second = await ensureExistingAdminRoles(mockPg);
    expect(second).toBe(0);
    expect(userRows[2].metadata?.role).toBeUndefined();
  });
});
