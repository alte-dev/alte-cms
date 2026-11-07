import type { CollectionConfig, Access, FieldAccess } from "payload";
import { USER_ROLES, type UserRole } from "@alte/shared";

// Check if user has administrative or staff role
const isStaff = (role?: UserRole): boolean => {
  return ["super-admin", "admin", "shop-manager", "editor", "author"].includes(role as string);
};

const isAdmin = (role?: UserRole): boolean => {
  return role === "super-admin" || role === "admin";
};

// Access Control: Read Users
// Anonymous cannot read; Customers only read their own document; Staff/Admins can read all.
export const canReadUsers: Access = ({ req: { user } }) => {
  if (!user) {
    return false; // Default closed: anonymous blocked!
  }

  const role = user.role as UserRole;
  if (isAdmin(role) || isStaff(role)) {
    return true;
  }

  // Customer can only read their own profile
  return {
    id: {
      equals: user.id,
    },
  };
};

// Access Control: Update Users
export const canUpdateUsers: Access = ({ req: { user } }) => {
  if (!user) return false;
  const role = user.role as UserRole;
  if (isAdmin(role)) return true;

  // Customers and staff can only update themselves
  return {
    id: {
      equals: user.id,
    },
  };
};

// Access Control: Delete Users
export const canDeleteUsers: Access = ({ req: { user } }) => {
  if (!user) return false;
  return isAdmin(user.role as UserRole);
};

// Field Level Access: Only Admins can modify the role field
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
    create: () => true, // Registration allowed
    update: canUpdateUsers,
    delete: canDeleteUsers,
    admin: ({ req: { user } }) => {
      if (!user) return false;
      return isStaff(user.role as UserRole);
    },
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
      defaultValue: "customer",
      options: USER_ROLES.map((role) => ({
        label: role,
        value: role,
      })),
      access: {
        update: canChangeRole,
      },
      hooks: {
        beforeChange: [
          ({ req: { user }, value, operation }) => {
            // If creating an account anonymously or by non-admin, force default role 'customer'
            if (operation === "create") {
              if (!user || !isAdmin(user.role as UserRole)) {
                return "customer";
              }
            }
            return value;
          },
        ],
      },
    },
  ],
};
