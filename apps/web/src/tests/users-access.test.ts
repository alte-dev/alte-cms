import { describe, it, expect } from "vitest";
import { canReadUsers, Users } from "../collections/Users";
import type { UserRole } from "@alte/shared";

describe("Payload CMS Users Access Control (Security Foundation)", () => {
  it("must block anonymous users from reading Users collection (default closed)", async () => {
    // Simulated request from unauthenticated visitor
    const req = { user: null } as any;
    const accessResult = await (canReadUsers as any)({ req });

    expect(accessResult).toBe(false);
  });

  it("must restrict customer role to only reading their own profile", async () => {
    const customerUser = { id: "cust-999", role: "customer" as UserRole };
    const req = { user: customerUser } as any;
    const accessResult = await (canReadUsers as any)({ req });

    expect(accessResult).toEqual({
      id: {
        equals: "cust-999",
      },
    });
  });

  it("must allow admin and super-admin to read all users", async () => {
    const adminUser = { id: "adm-1", role: "admin" as UserRole };
    const req = { user: adminUser } as any;
    const accessResult = await (canReadUsers as any)({ req });

    expect(accessResult).toBe(true);
  });

  it("must have default role as 'customer'", () => {
    const roleField = Users.fields.find((f: any) => f.name === "role") as any;
    expect(roleField).toBeDefined();
    expect(roleField.defaultValue).toBe("customer");
    expect(roleField.required).toBe(true);
  });

  it("must enforce customer role on anonymous user creation hook", async () => {
    const roleField = Users.fields.find((f: any) => f.name === "role") as any;
    const beforeChangeHook = roleField.hooks?.beforeChange?.[0];
    expect(beforeChangeHook).toBeDefined();

    // Attacker tries to pass role: 'super-admin' without being logged in as admin
    const maliciousAttempt = await beforeChangeHook({
      req: { user: null },
      value: "super-admin",
      operation: "create",
    });

    expect(maliciousAttempt).toBe("customer");
  });
});
