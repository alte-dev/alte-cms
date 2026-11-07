import { describe, it, expect } from "vitest";
import {
  canReadUsers,
  canCreateUsers,
  canUpdateUsers,
  canDeleteUsers,
  Users,
} from "../collections/Users";
import { USER_ROLES, type UserRole } from "@alte/shared";

describe("Payload CMS Users Access Control (Staff-Only Foundation)", () => {
  it("must block anonymous users from reading Users collection (default closed)", async () => {
    const req = { user: null } as any;
    const accessResult = await (canReadUsers as any)({ req });
    expect(accessResult).toBe(false);
  });

  it("must strictly prohibit anonymous user registration (canCreateUsers = false)", async () => {
    const req = { user: null } as any;
    const accessResult = await (canCreateUsers as any)({ req });
    expect(accessResult).toBe(false);
  });

  it("must prevent non-admin staff from creating new users", async () => {
    const editorUser = { id: "ed-1", role: "editor" as UserRole };
    const req = { user: editorUser } as any;
    const accessResult = await (canCreateUsers as any)({ req });
    expect(accessResult).toBe(false);
  });

  it("must allow admin and super-admin to create new staff users", async () => {
    const adminReq = { user: { id: "adm-1", role: "admin" as UserRole } } as any;
    const superAdminReq = { user: { id: "sa-1", role: "super-admin" as UserRole } } as any;

    expect(await (canCreateUsers as any)({ req: adminReq })).toBe(true);
    expect(await (canCreateUsers as any)({ req: superAdminReq })).toBe(true);
  });

  it("must restrict individual staff members to only updating their own account", async () => {
    const editorUser = { id: "ed-1", role: "editor" as UserRole };
    const req = { user: editorUser } as any;
    const updateResult = await (canUpdateUsers as any)({ req });

    expect(updateResult).toEqual({
      id: {
        equals: "ed-1",
      },
    });
  });

  it("must allow admin to update any staff user", async () => {
    const adminUser = { id: "adm-1", role: "admin" as UserRole };
    const req = { user: adminUser } as any;
    const updateResult = await (canUpdateUsers as any)({ req });
    expect(updateResult).toBe(true);
  });

  it("must NOT contain 'customer' role in USER_ROLES (customer accounts belong in Medusa)", () => {
    expect((USER_ROLES as readonly string[]).includes("customer")).toBe(false);
    expect(USER_ROLES).toEqual(["super-admin", "admin", "shop-manager", "editor", "author"]);
  });

  it("must have default staff role as 'editor'", () => {
    const roleField = Users.fields.find((f: any) => f.name === "role") as any;
    expect(roleField).toBeDefined();
    expect(roleField.defaultValue).toBe("editor");
    expect(roleField.required).toBe(true);
  });
});
