import type { CollectionConfig, Access } from "payload";
import { ValidationError } from "payload";
import type { UserRole } from "@alte/shared";
import path from "path";
import { ALLOWED_MIME_TYPES, sanitizeUploadFilename, isAllowedMimeType } from "../lib/media-utils";
import { canDeleteContent } from "../access/content";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateFileSize(fileSize?: number): boolean {
  if (!fileSize) return true;
  return fileSize <= MAX_FILE_SIZE_BYTES;
}

const isStaffOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false;
  const role = user.role as UserRole;
  return ["super-admin", "admin", "shop-manager", "editor"].includes(role);
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
    // Strictly whitelist safe raster formats: JPEG, PNG, WebP, AVIF. NO SVG allowed (XSS prevention).
    mimeTypes: [...ALLOWED_MIME_TYPES],
    imageSizes: [
      {
        name: "thumbnail",
        width: 400,
        position: "centre",
      },
      {
        name: "medium",
        width: 800,
        position: "centre",
      },
      {
        name: "large",
        width: 1600,
        position: "centre",
      },
    ],
    adminThumbnail: "thumbnail",
  },
  access: {
    // Media files are publicly viewable on the storefront
    read: () => true,
    // Staff and editors can upload media
    create: isStaffOrAdmin,
    update: isStaffOrAdmin,
    // ONLY super-admin and admin can delete media (Editor CANNOT delete!)
    delete: canDeleteContent,
  },
  hooks: {
    beforeOperation: [
      ({ req, operation }) => {
        if (operation === "create" && req.file) {
          if (!validateFileSize(req.file.size)) {
            throw new ValidationError({
              errors: [
                {
                  message: `Dosya boyutu 5 MB sınırını aşamaz (Yüklenen boyut: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB).`,
                  path: "file",
                },
              ],
            });
          }
          if (req.file.mimetype && !isAllowedMimeType(req.file.mimetype)) {
            throw new ValidationError({
              errors: [
                {
                  message: `Güvenlik uyarısı: ${req.file.mimetype} dosya türü kabul edilemez. SVG ve çalıştırılabilir dosyalar yasaktır.`,
                  path: "file",
                },
              ],
            });
          }
          if (req.file.name) {
            req.file.name = sanitizeUploadFilename(req.file.name);
          }
        }
      },
    ],
    beforeChange: [
      ({ req, data }) => {
        const file = (req as any)?.file;
        if (file && !validateFileSize(file.size)) {
          throw new ValidationError({
            errors: [
              {
                message: `Dosya boyutu 5 MB sınırını aşamaz (Yüklenen boyut: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
                path: "file",
              },
            ],
          });
        }
        return data;
      },
    ],
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
