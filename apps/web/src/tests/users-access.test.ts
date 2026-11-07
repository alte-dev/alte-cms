import { describe, it, expect } from "vitest";
import {
  canReadUsers,
  canCreateUsers,
  canUpdateUsers,
  canDeleteUsers,
  canAssignRole,
  Users,
} from "../collections/Users";
import { USER_ROLES, type UserRole } from "@alte/shared";

describe("Payload CMS Users Access Control (Staff-Only & Role Hierarchy)", () => {
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

  it("must allow admin to create regular staff users, but reject creating super-admin", async () => {
    const adminReq = { user: { id: "adm-1", role: "admin" as UserRole } } as any;

    // Admin creating regular staff -> ALLOWED
    expect(await (canCreateUsers as any)({ req: adminReq, data: { role: "editor" } })).toBe(true);
    expect(await (canCreateUsers as any)({ req: adminReq, data: { role: "shop-manager" } })).toBe(
      true,
    );

    // Admin attempting to create super-admin -> REJECTED
    expect(await (canCreateUsers as any)({ req: adminReq, data: { role: "super-admin" } })).toBe(
      false,
    );
  });

  it("must allow super-admin to create any user including other super-admins", async () => {
    const superAdminReq = { user: { id: "sa-1", role: "super-admin" as UserRole } } as any;

    expect(await (canCreateUsers as any)({ req: superAdminReq, data: { role: "admin" } })).toBe(
      true,
    );
    expect(
      await (canCreateUsers as any)({ req: superAdminReq, data: { role: "super-admin" } }),
    ).toBe(true);
  });

  it("must prevent admin from updating super-admin users", async () => {
    const adminUser = { id: "adm-1", role: "admin" as UserRole };
    const req = { user: adminUser } as any;
    const updateResult = await (canUpdateUsers as any)({ req });

    // Must be scoped to exclude super-admin
    expect(updateResult).toEqual({
      role: {
        not_equals: "super-admin",
      },
    });
  });

  it("must allow super-admin to update any user", async () => {
    const superAdminUser = { id: "sa-1", role: "super-admin" as UserRole };
    const req = { user: superAdminUser } as any;
    const updateResult = await (canUpdateUsers as any)({ req });
    expect(updateResult).toBe(true);
  });

  it("must prevent admin from deleting super-admin users", async () => {
    const adminUser = { id: "adm-1", role: "admin" as UserRole };
    const req = { user: adminUser } as any;
    const deleteResult = await (canDeleteUsers as any)({ req });

    expect(deleteResult).toEqual({
      role: {
        not_equals: "super-admin",
      },
    });
  });

  it("must allow super-admin to delete users and block non-admin staff", async () => {
    const superAdminReq = { user: { id: "sa-1", role: "super-admin" as UserRole } } as any;
    const editorReq = { user: { id: "ed-1", role: "editor" as UserRole } } as any;

    expect(await (canDeleteUsers as any)({ req: superAdminReq })).toBe(true);
    expect(await (canDeleteUsers as any)({ req: editorReq })).toBe(false);
  });

  it("must restrict role field assignment: only super-admin can assign 'super-admin'", async () => {
    const adminReq = { user: { id: "adm-1", role: "admin" as UserRole } } as any;
    const superAdminReq = { user: { id: "sa-1", role: "super-admin" as UserRole } } as any;
    const editorReq = { user: { id: "ed-1", role: "editor" as UserRole } } as any;

    // Admin assigning editor -> ALLOWED
    expect(await (canAssignRole as any)({ req: adminReq, data: { role: "editor" } })).toBe(true);

    // Admin assigning super-admin (or self-elevating) -> REJECTED
    expect(await (canAssignRole as any)({ req: adminReq, data: { role: "super-admin" } })).toBe(
      false,
    );
    expect(
      await (canAssignRole as any)({ req: adminReq, siblingData: { role: "super-admin" } }),
    ).toBe(false);

    // Super-admin assigning super-admin -> ALLOWED
    expect(
      await (canAssignRole as any)({ req: superAdminReq, data: { role: "super-admin" } }),
    ).toBe(true);

    // Regular staff attempting to assign role -> REJECTED
    expect(await (canAssignRole as any)({ req: editorReq, data: { role: "admin" } })).toBe(false);
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
