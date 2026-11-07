import type { CollectionConfig, Access } from "payload";
import type { UserRole } from "@alte/shared";
import path from "path";

const isStaffOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false;
  const role = user.role as UserRole;
  return ["super-admin", "admin", "shop-manager", "editor"].includes(role);
};

const isAdminOrShopManager: Access = ({ req: { user } }) => {
  if (!user) return false;
  const role = user.role as UserRole;
  return ["super-admin", "admin", "shop-manager"].includes(role);
};

// Resolve media upload path from environment variable or default to relative path
const getMediaUploadDir = () => {
  const envDir = process.env.PAYLOAD_MEDIA_DIR;
  if (envDir && path.isAbsolute(envDir)) {
    return envDir;
  }
  return path.resolve(process.cwd(), envDir || "media/uploads");
};

export const Media: CollectionConfig = {
  slug: "media",
  upload: {
    staticDir: getMediaUploadDir(),
    // Strictly whitelist safe raster formats. NO SVG allowed (XSS prevention).
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    imageSizes: [
      {
        name: "thumbnail",
        width: 300,
        height: 300,
        position: "centre",
      },
      {
        name: "card",
        width: 768,
        height: 512,
        position: "centre",
      },
      {
        name: "hero",
        width: 1920,
        height: 1080,
        position: "centre",
      },
    ],
    adminThumbnail: "thumbnail",
  },
  access: {
    // Media files are publicly viewable on the storefront
    read: () => true,
    // Only staff and admins can upload or modify media
    create: isStaffOrAdmin,
    update: isStaffOrAdmin,
    delete: isAdminOrShopManager,
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      label: "Alternatif Metin (SEO ve Erişilebilirlik)",
    },
    {
      name: "caption",
      type: "text",
      label: "Görsel Açıklaması",
    },
  ],
};
