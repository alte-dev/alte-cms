import type { CollectionConfig, Access, FieldAccess } from "payload";
import { USER_ROLES, type UserRole } from "@alte/shared";

// Check if user has administrative privileges
const isAdmin = (role?: UserRole): boolean => {
  return role === "super-admin" || role === "admin";
};

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
export const canCreateUsers: Access = ({ req: { user } }) => {
  if (!user) return false;
  return isAdmin(user.role as UserRole);
};

// Access Control: Update Users
// Admins can update any staff user; individual staff can update their own profile (name, password).
export const canUpdateUsers: Access = ({ req: { user } }) => {
  if (!user) return false;
  const role = user.role as UserRole;
  if (isAdmin(role)) return true;

  // Staff can only update their own profile
  return {
    id: {
      equals: user.id,
    },
  };
};

// Access Control: Delete Users
// Only Admins or Super-Admins can delete staff accounts.
export const canDeleteUsers: Access = ({ req: { user } }) => {
  if (!user) return false;
  return isAdmin(user.role as UserRole);
};

// Field Level Access: Only Admins/Super-Admins can assign or modify roles
export const canChangeRole: FieldAccess = ({ req: { user } }) => {
  if (!user) return false;
  return isAdmin(user.role as UserRole);
};

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
    create: canCreateUsers, // Strictly restricted to admin/super-admin
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
        update: canChangeRole,
      },
    },
  ],
};
