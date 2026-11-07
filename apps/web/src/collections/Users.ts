import type { CollectionConfig, Access, FieldAccess, Where } from "payload";
import { USER_ROLES, type UserRole } from "@alte/shared";

// Access Control: Read Users
// Only authenticated staff members can read the Users collection.
// Anonymous visitors and external customers have ZERO access.
export const canReadUsers: Access = ({ req: { user } }) => {
  if (!user) {
    return false; // Default closed: anonymous blocked!
  }
  return true; // All users in this collection are authenticated staff
};

// Access Control: Create Users
// ONLY existing Admins or Super-Admins can create new staff users.
// Public / anonymous registration is strictly BLOCKED.
// 'super-admin' role can ONLY be assigned by an existing 'super-admin'.
export const canCreateUsers: Access = ({ req: { user }, data }) => {
  if (!user) return false;
  const userRole = user.role as UserRole;
  if (userRole === "super-admin") return true;
  if (userRole === "admin") {
    // Admin cannot create a super-admin user
    if (data?.role === "super-admin") return false;
    return true;
  }
  return false;
};

// Access Control: Update Users
// Super-Admins can update any staff user.
// Admins can update staff users EXCEPT super-admin users (cannot edit super-admin or self-elevate).
// Individual staff can only update their own profile (name, password).
export const canUpdateUsers: Access = ({ req: { user } }) => {
  if (!user) return false;
  const userRole = user.role as UserRole;
  if (userRole === "super-admin") return true;
  if (userRole === "admin") {
    // Admin can update staff users EXCEPT super-admin users
    const query: Where = {
      role: {
        not_equals: "super-admin",
      },
    };
    return query;
  }

  // Staff can only update their own profile
  const query: Where = {
    id: {
      equals: user.id,
    },
  };
  return query;
};

// Access Control: Delete Users
// Super-Admins can delete any staff account.
// Admins can delete staff accounts EXCEPT super-admin users.
export const canDeleteUsers: Access = ({ req: { user } }) => {
  if (!user) return false;
  const userRole = user.role as UserRole;
  if (userRole === "super-admin") return true;
  if (userRole === "admin") {
    // Admin can delete staff accounts EXCEPT super-admin users
    const query: Where = {
      role: {
        not_equals: "super-admin",
      },
    };
    return query;
  }
  return false;
};

// Field Level Access: Role assignment and modification
// Only Super-Admin can assign or elevate to 'super-admin'.
// Admin can assign other staff roles, but cannot assign/elevate to 'super-admin'.
export const canAssignRole: FieldAccess = ({ req: { user }, data, siblingData }) => {
  if (!user) return false;
  const userRole = user.role as UserRole;
  if (userRole === "super-admin") return true;
  if (userRole === "admin") {
    const targetRole = (siblingData?.role ?? data?.role) as UserRole | undefined;
    if (targetRole === "super-admin") return false;
    return true;
  }
  return false;
};

// Backward compatible export alias
export const canChangeRole = canAssignRole;

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    tokenExpiration: 7200, // 2 hours
    verify: false,
    maxLoginAttempts: 5,
    lockTime: 600 * 1000, // 10 minutes lockout on brute force
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "role", "createdAt"],
  },
  access: {
    read: canReadUsers,
    create: canCreateUsers,
    update: canUpdateUsers,
    delete: canDeleteUsers,
    admin: ({ req: { user } }) => Boolean(user), // All users in Users collection are staff
  },
  fields: [
    {
      name: "name",
      type: "text",
      label: "Ad Soyad",
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      options: USER_ROLES.map((role) => ({
        label: role,
        value: role,
      })),
      access: {
        create: canAssignRole,
        update: canAssignRole,
      },
    },
  ],
};
