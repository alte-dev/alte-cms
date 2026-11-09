/**
 * Puck Data Zod Schema & Server-Side Security Validator
 * Enforces strict limits:
 * - Max payload size: 512 KB
 * - Max total components: 200
 * - Max nesting depth: 6 levels
 * - Allowed component whitelist
 * - Per-component strict Zod schemas rejecting unknown props
 * - Deep recursive link and unsafe protocol inspection
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

// Per-component strict Zod schemas
export const HeroPropsSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    bgImage: z.string().optional(),
    bgColor: z.enum(["white", "gray", "dark", "rose"]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    primaryButtonText: z.string().optional(),
    primaryButtonHref: z.string().optional(),
    secondaryButtonText: z.string().optional(),
    secondaryButtonHref: z.string().optional(),
  })
  .strict();

export const RichTextPropsSchema = z
  .object({
    content: z.string().optional(),
    maxWidth: z.enum(["prose", "prose-lg", "full"]).optional(),
  })
  .strict();

export const ImageBlockPropsSchema = z
  .object({
    src: z.string().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    linkHref: z.string().optional(),
  })
  .strict();

export const ColumnsPropsSchema = z
  .object({
    columns: z.enum(["2", "3", "4"]).optional(),
    col1Title: z.string().optional(),
    col1Content: z.string().optional(),
    col2Title: z.string().optional(),
    col2Content: z.string().optional(),
    col3Title: z.string().optional(),
    col3Content: z.string().optional(),
    col4Title: z.string().optional(),
    col4Content: z.string().optional(),
  })
  .strict();

export const SpacerPropsSchema = z
  .object({
    height: z.enum(["small", "medium", "large", "xlarge"]).optional(),
  })
  .strict();

export const DividerPropsSchema = z
  .object({
    style: z.enum(["solid", "dashed", "dotted"]).optional(),
  })
  .strict();

export const AccordionPropsSchema = z
  .object({
    q1: z.string().optional(),
    a1: z.string().optional(),
    q2: z.string().optional(),
    a2: z.string().optional(),
    q3: z.string().optional(),
    a3: z.string().optional(),
  })
  .strict();

export const BannerPropsSchema = z
  .object({
    text: z.string().optional(),
    style: z.enum(["info", "warning", "success", "accent"]).optional(),
    linkText: z.string().optional(),
    linkHref: z.string().optional(),
  })
  .strict();

export const ContactInfoPropsSchema = z
  .object({
    title: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    workingHours: z.string().optional(),
  })
  .strict();

export const ProductGridPropsSchema = z
  .object({
    title: z.string().optional(),
    limit: z.number().optional(),
  })
  .strict();

export const FeaturedProductsPropsSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
  })
  .strict();

export const CategoryListPropsSchema = z
  .object({
    title: z.string().optional(),
  })
  .strict();

export const FreeShippingBarPropsSchema = z
  .object({
    threshold: z.number().optional(),
    message: z.string().optional(),
  })
  .strict();

export const LatestPostsPropsSchema = z
  .object({
    title: z.string().optional(),
    limit: z.number().optional(),
  })
  .strict();

export const COMPONENT_PROP_SCHEMAS: Record<AllowedPuckComponent, z.ZodTypeAny> = {
  Hero: HeroPropsSchema,
  RichText: RichTextPropsSchema,
  ImageBlock: ImageBlockPropsSchema,
  Columns: ColumnsPropsSchema,
  Spacer: SpacerPropsSchema,
  Divider: DividerPropsSchema,
  Accordion: AccordionPropsSchema,
  Banner: BannerPropsSchema,
  ContactInfo: ContactInfoPropsSchema,
  ProductGrid: ProductGridPropsSchema,
  FeaturedProducts: FeaturedProductsPropsSchema,
  CategoryList: CategoryListPropsSchema,
  FreeShippingBar: FreeShippingBarPropsSchema,
  LatestPosts: LatestPostsPropsSchema,
};

const LINK_KEY_PATTERN = /(?:href|url|link|src|action)/i;

/**
 * Recursively scans all nested objects and arrays for link-like keys and unsafe protocols.
 */
export function recursivelyScanForUnsafeHrefs(
  value: unknown,
  path: string,
  violations: string[],
): void {
  if (!value) return;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      const isLinkKey = LINK_KEY_PATTERN.test(path);
      if (isLinkKey) {
        if (!isSafeHref(trimmed)) {
          violations.push(
            `Güvenli olmayan bağlantı tespit edildi (${path}: '${trimmed}'). Sadece '/' veya 'https://' kabul edilir.`,
          );
        }
      } else {
        const sanitized = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, "");
        if (
          /^(javascript|data|vbscript|file):/i.test(sanitized) ||
          sanitized.startsWith("//") ||
          sanitized.startsWith("\\\\")
        ) {
          violations.push(`Güvenli olmayan protokol tespit edildi (${path}: '${trimmed}').`);
        }
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      recursivelyScanForUnsafeHrefs(value[i], `${path}[${i}]`, violations);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (LINK_KEY_PATTERN.test(key) && typeof val === "string" && val.trim().length > 0) {
        if (!isSafeHref(val)) {
          violations.push(
            `Güvenli olmayan bağlantı tespit edildi (${childPath}: '${val}'). Sadece '/' veya 'https://' kabul edilir.`,
          );
          continue;
        }
      }
      recursivelyScanForUnsafeHrefs(val, childPath, violations);
    }
  }
}

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
          continue;
        }

        if (!ALLOWED_PUCK_COMPONENTS.includes(node.type as AllowedPuckComponent)) {
          ctx.violations.push(`Bilinmeyen bileşen tipi tespit edildi: '${node.type}'.`);
          continue;
        }

        const componentType = node.type as AllowedPuckComponent;
        const schema = COMPONENT_PROP_SCHEMAS[componentType];

        // Validate props with component's strict Zod schema
        if (schema) {
          const propsToValidate = node.props || {};
          const result = schema.safeParse(propsToValidate);
          if (!result.success) {
            const firstErr = result.error.issues?.[0];
            const errField = firstErr?.path?.join(".") || "props";
            ctx.violations.push(
              `Bileşen ('${componentType}') geçersiz veya bilinmeyen alan içeriyor: ${errField} (${firstErr?.message || "Doğrulama hatası"}).`,
            );
          }
        }

        // Deep recursive link and unsafe protocol scan on the entire node
        recursivelyScanForUnsafeHrefs(node, node.type, ctx.violations);

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
    const obj = nodes as Record<string, unknown>;
    if (obj.zones && typeof obj.zones === "object") {
      for (const zoneItems of Object.values(obj.zones as Record<string, unknown>)) {
        traversePuckTree(zoneItems, depth + 1, ctx);
      }
    }
  }
}

/**
 * Validates Puck Data against security, strict schemas, and structural limits.
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

  // Also scan root props
  if (obj.root && typeof obj.root === "object") {
    recursivelyScanForUnsafeHrefs(obj.root, "root", ctx.violations);
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

/**
 * Safe helper to parse unknown puckData into validated object or null.
 */
export function safeParsePuckData(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const result = PuckDataZodSchema.safeParse(data);
  if (!result.success) return null;
  return data as Record<string, unknown>;
}
