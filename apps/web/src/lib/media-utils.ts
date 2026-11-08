import path from "path";
import { slugify } from "./slugify";

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const FORBIDDEN_EXTENSIONS = [".svg", ".svgz", ".html", ".htm", ".xml", ".js", ".php"];

/**
 * Sanitizes an uploaded image filename:
 * - Strips directory traversal
 * - Transliterates Turkish / special characters
 * - Converts to lowercase safe slug
 * - Appends timestamp for uniqueness
 * - Strictly prevents SVG or dangerous extensions
 */
export function sanitizeUploadFilename(filename: string): string {
  const parsed = path.parse(filename);
  const ext = parsed.ext.toLowerCase();

  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    throw new Error(`Güvenlik uyarısı: ${ext} uzantılı dosya yüklenemez. SVG ve çalıştırılabilir dosyalar yasaktır.`);
  }

  const baseSlug = slugify(parsed.name || "media") || "media";
  const timestamp = Date.now();
  // Safe filename pattern: e.g. "urun-gorseli-1-1715000000000.webp"
  return `${baseSlug}-${timestamp}${ext}`;
}

export function isAllowedMimeType(mime?: string): boolean {
  if (!mime) return false;
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime.toLowerCase());
}
