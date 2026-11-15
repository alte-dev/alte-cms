import { describe, it, expect, vi } from "vitest";
import { checkAdminSettingsRole, checkAdminOrShopManagerRole } from "./admin-role-guard";

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

describe("checkAdminSettingsRole (Medusa settings access guard)", () => {
  it("allows admin and super-admin roles", async () => {
    const res1 = createMockRes();
    const ok1 = await checkAdminSettingsRole({ user: { role: "admin" } } as any, res1);
    expect(ok1).toBe(true);

    const res2 = createMockRes();
    const ok2 = await checkAdminSettingsRole({ user: { role: "super-admin" } } as any, res2);
    expect(ok2).toBe(true);
  });

  it("blocks shop-manager and editor roles with 403", async () => {
    const res1 = createMockRes();
    const ok1 = await checkAdminSettingsRole(
      { user: { metadata: { role: "shop-manager" } } } as any,
      res1,
    );
    expect(ok1).toBe(false);
    expect(res1.statusCode).toBe(403);

    const res2 = createMockRes();
    const ok2 = await checkAdminSettingsRole({ user: { role: "editor" } } as any, res2);
    expect(ok2).toBe(false);
    expect(res2.statusCode).toBe(403);
  });

  it("resolves user metadata role via auth_context.actor_id when req.user is absent", async () => {
    const retrieveUser = vi.fn().mockResolvedValue({
      id: "user_123",
      metadata: { role: "shop-manager" },
    });
    const req = {
      auth_context: { actor_id: "user_123" },
      scope: {
        resolve: () => ({ retrieveUser }),
      },
    } as any;
    const res = createMockRes();

    const ok = await checkAdminSettingsRole(req, res);
    expect(ok).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(retrieveUser).toHaveBeenCalledWith("user_123");
  });

  it("allows default Medusa admin user with no role metadata", async () => {
    const retrieveUser = vi.fn().mockResolvedValue({
      id: "user_admin",
      metadata: {},
    });
    const req = {
      auth_context: { actor_id: "user_admin" },
      scope: {
        resolve: () => ({ retrieveUser }),
      },
    } as any;
    const res = createMockRes();

    const ok = await checkAdminSettingsRole(req, res);
    expect(ok).toBe(true);
  });
});

describe("checkAdminOrShopManagerRole (Medusa contact/order ops guard)", () => {
  it("allows admin, super-admin, and shop-manager, blocks editor", async () => {
    for (const role of ["admin", "super-admin", "shop-manager"]) {
      const res = createMockRes();
      const ok = await checkAdminOrShopManagerRole({ user: { role } } as any, res);
      expect(ok).toBe(true);
    }

    const resEditor = createMockRes();
    const okEditor = await checkAdminOrShopManagerRole(
      { user: { role: "editor" } } as any,
      resEditor,
    );
    expect(okEditor).toBe(false);
    expect(resEditor.statusCode).toBe(403);
  });
});
