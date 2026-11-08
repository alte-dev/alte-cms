/**
 * Puck Data Zod Schema & Server-Side Security Validator
 * Enforces strict limits:
 * - Max payload size: 512 KB
 * - Max total components: 200
 * - Max nesting depth: 6 levels
 * - Allowed component whitelist
 * - Safe hrefs in component props
 */

import { z } from "zod";
import { isSafeHref } from "../safe-href";

export const ALLOWED_PUCK_COMPONENTS = [
  // Sections
  "Hero",
  "RichText",
  "ImageBlock",
  "Columns",
  "Spacer",
  "Divider",
  "Accordion",
  "Banner",
  "ContactInfo",
  // Commerce
  "ProductGrid",
  "FeaturedProducts",
  "CategoryList",
  "FreeShippingBar",
  // Content
  "LatestPosts",
] as const;

export type AllowedPuckComponent = (typeof ALLOWED_PUCK_COMPONENTS)[number];

export const MAX_PUCK_PAYLOAD_BYTES = 512 * 1024; // 512 KB
export const MAX_PUCK_COMPONENTS = 200;
export const MAX_PUCK_DEPTH = 6;

interface PuckComponentNode {
  type: string;
  props?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ValidationContext {
  totalComponents: number;
  maxDepthReached: number;
  violations: string[];
}

function traversePuckTree(nodes: unknown, depth: number, ctx: ValidationContext): void {
  if (!nodes || typeof nodes !== "object") return;

  if (depth > ctx.maxDepthReached) {
    ctx.maxDepthReached = depth;
  }

  if (depth > MAX_PUCK_DEPTH) {
    ctx.violations.push(
      `Bileşen iç içe derinliği izin verilen maksimum sınırı (${MAX_PUCK_DEPTH} seviye) aştı (Tespit edilen: ${depth}).`,
    );
    return;
  }

  if (Array.isArray(nodes)) {
    for (const item of nodes) {
      if (item && typeof item === "object") {
        ctx.totalComponents += 1;
        if (ctx.totalComponents > MAX_PUCK_COMPONENTS) {
          ctx.violations.push(
            `Toplam bileşen sayısı izin verilen sınırı (${MAX_PUCK_COMPONENTS}) aştı.`,
          );
          return;
        }

        const node = item as PuckComponentNode;
        if (!node.type || typeof node.type !== "string") {
          ctx.violations.push("Bileşen tanımında 'type' alanı eksik veya geçersiz.");
        } else if (!ALLOWED_PUCK_COMPONENTS.includes(node.type as AllowedPuckComponent)) {
          ctx.violations.push(`Bilinmeyen bileşen tipi tespit edildi: '${node.type}'.`);
        }

        // Validate links inside component props
        if (node.props && typeof node.props === "object") {
          for (const [key, val] of Object.entries(node.props)) {
            if (
              (key.toLowerCase().includes("url") ||
                key.toLowerCase().includes("href") ||
                key.toLowerCase().includes("link")) &&
              typeof val === "string" &&
              val.trim().length > 0
            ) {
              if (!isSafeHref(val)) {
                ctx.violations.push(
                  `Bileşen ('${node.type}') güvenli olmayan bir bağlantı içeriyor (${key}: '${val}'). Sadece '/' veya 'https://' kabul edilir.`,
                );
              }
            }
          }
        }

        // Check nested zones or slots inside item
        for (const [key, val] of Object.entries(item)) {
          if (key === "zones" && val && typeof val === "object") {
            for (const zoneItems of Object.values(val as Record<string, unknown>)) {
              traversePuckTree(zoneItems, depth + 1, ctx);
            }
          }
        }
      }
    }
  } else {
    // If object with zones property
    const obj = nodes as Record<string, unknown>;
    if (obj.zones && typeof obj.zones === "object") {
      for (const zoneItems of Object.values(obj.zones as Record<string, unknown>)) {
        traversePuckTree(zoneItems, depth + 1, ctx);
      }
    }
  }
}

/**
 * Validates Puck Data against security and structural limits.
 */
export function validatePuckData(data: unknown): {
  valid: boolean;
  totalComponents: number;
  maxDepth: number;
  sizeBytes: number;
  error?: string;
} {
  if (data === null || data === undefined) {
    return { valid: true, totalComponents: 0, maxDepth: 0, sizeBytes: 0 };
  }

  if (typeof data !== "object") {
    return {
      valid: false,
      totalComponents: 0,
      maxDepth: 0,
      sizeBytes: 0,
      error: "puckData geçerli bir JSON nesnesi olmalıdır.",
    };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch {
    return {
      valid: false,
      totalComponents: 0,
      maxDepth: 0,
      sizeBytes: 0,
      error: "puckData seri hale getirilemeyen döngüsel veri içeriyor.",
    };
  }

  const sizeBytes = Buffer.byteLength(serialized, "utf8");
  if (sizeBytes > MAX_PUCK_PAYLOAD_BYTES) {
    return {
      valid: false,
      totalComponents: 0,
      maxDepth: 0,
      sizeBytes,
      error: `puckData boyutu (${Math.round(sizeBytes / 1024)} KB) izin verilen 512 KB sınırını aşıyor.`,
    };
  }

  const ctx: ValidationContext = {
    totalComponents: 0,
    maxDepthReached: 1,
    violations: [],
  };

  const obj = data as Record<string, unknown>;
  if (obj.content && Array.isArray(obj.content)) {
    traversePuckTree(obj.content, 1, ctx);
  }

  if (obj.zones && typeof obj.zones === "object") {
    for (const zoneItems of Object.values(obj.zones as Record<string, unknown>)) {
      traversePuckTree(zoneItems, 1, ctx);
    }
  }

  if (ctx.violations.length > 0) {
    return {
      valid: false,
      totalComponents: ctx.totalComponents,
      maxDepth: ctx.maxDepthReached,
      sizeBytes,
      error: ctx.violations[0],
    };
  }

  return {
    valid: true,
    totalComponents: ctx.totalComponents,
    maxDepth: ctx.maxDepthReached,
    sizeBytes,
  };
}

/**
 * Zod Schema for Puck Data validation
 */
export const PuckDataZodSchema = z.unknown().superRefine((data, ctx) => {
  const res = validatePuckData(data);
  if (!res.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: res.error || "Geçersiz puckData yapısı.",
    });
  }
});
