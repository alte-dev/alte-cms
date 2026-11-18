export type ThemeFontFamily = "inter" | "system" | "serif" | "mono";
export type ThemeHeadingFontFamily = "inherit" | "inter" | "serif" | "system";
export type ThemeFontSize = "14px" | "15px" | "16px" | "17px";
export type ThemeHeadingWeight = "600" | "700" | "800";
export type ThemeLetterSpacing = "tight" | "normal" | "wide";
export type ThemeLineHeight = "compact" | "normal" | "relaxed";
export type ThemeRadius = "none" | "sm" | "md" | "lg" | "full";
export type ThemeButtonTransform = "none" | "uppercase";
export type ThemeButtonWeight = "500" | "600" | "700";

export interface ResolvedThemeSettings {
  primaryColor: string;
  primaryHoverColor: string;
  primaryTextColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  surfaceSubduedColor: string;
  borderColor: string;
  textColor: string;
  textMutedColor: string;
  announcementBgColor: string;
  announcementTextColor: string;
  headerBgColor: string;
  footerBgColor: string;
  footerTextColor: string;
  checkoutLeftBgColor: string;
  checkoutSummaryBgColor: string;
  checkoutBadgeBgColor: string;
  fontFamily: ThemeFontFamily;
  headingFontFamily: ThemeHeadingFontFamily;
  baseFontSize: ThemeFontSize;
  headingWeight: ThemeHeadingWeight;
  headingLetterSpacing: ThemeLetterSpacing;
  lineHeight: ThemeLineHeight;
  borderRadius: ThemeRadius;
  buttonRadius: ThemeRadius;
  buttonTextTransform: ThemeButtonTransform;
  buttonFontWeight: ThemeButtonWeight;
}

export const DEFAULT_THEME_SETTINGS: ResolvedThemeSettings = {
  primaryColor: "#3A4A5B",
  primaryHoverColor: "#2E3B49",
  primaryTextColor: "#FFFFFF",
  accentColor: "#92A3B6",
  backgroundColor: "#FAFAF9",
  surfaceColor: "#FFFFFF",
  surfaceSubduedColor: "#F5F5F5",
  borderColor: "#DEDEDE",
  textColor: "#1C1917",
  textMutedColor: "#666666",
  announcementBgColor: "#3A4A5B",
  announcementTextColor: "#FFFFFF",
  headerBgColor: "#FFFFFF",
  footerBgColor: "#1C1917",
  footerTextColor: "#E7E5E4",
  checkoutLeftBgColor: "#FFFFFF",
  checkoutSummaryBgColor: "#F5F5F5",
  checkoutBadgeBgColor: "#666666",
  fontFamily: "inter",
  headingFontFamily: "inherit",
  baseFontSize: "16px",
  headingWeight: "700",
  headingLetterSpacing: "tight",
  lineHeight: "normal",
  borderRadius: "md",
  buttonRadius: "md",
  buttonTextTransform: "none",
  buttonFontWeight: "600",
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value.trim());
}

function pickHex(value: unknown, fallback: string): string {
  return isValidHexColor(value) ? value.trim().toUpperCase() : fallback;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

const FONT_STACKS: Record<ThemeFontFamily, string> = {
  inter: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  system: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

const HEADING_FONT_STACKS: Record<ThemeHeadingFontFamily, string> = {
  inherit: "inherit",
  inter: FONT_STACKS.inter,
  serif: FONT_STACKS.serif,
  system: FONT_STACKS.system,
};

const LETTER_SPACING_MAP: Record<ThemeLetterSpacing, string> = {
  tight: "-0.025em",
  normal: "0em",
  wide: "0.04em",
};

const LINE_HEIGHT_MAP: Record<ThemeLineHeight, string> = {
  compact: "1.35",
  normal: "1.5",
  relaxed: "1.7",
};

const RADIUS_MAP: Record<ThemeRadius, string> = {
  none: "0px",
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.625rem",
  full: "9999px",
};

export function resolveThemeSettings(raw: unknown): ResolvedThemeSettings {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const colors = (src.colors && typeof src.colors === "object" ? src.colors : src) as Record<
    string,
    unknown
  >;
  const typography = (
    src.typography && typeof src.typography === "object" ? src.typography : src
  ) as Record<string, unknown>;
  const buttons = (src.buttons && typeof src.buttons === "object" ? src.buttons : src) as Record<
    string,
    unknown
  >;
  const checkout = (
    src.checkoutTheme && typeof src.checkoutTheme === "object" ? src.checkoutTheme : src
  ) as Record<string, unknown>;

  return {
    primaryColor: pickHex(colors.primaryColor, DEFAULT_THEME_SETTINGS.primaryColor),
    primaryHoverColor: pickHex(colors.primaryHoverColor, DEFAULT_THEME_SETTINGS.primaryHoverColor),
    primaryTextColor: pickHex(colors.primaryTextColor, DEFAULT_THEME_SETTINGS.primaryTextColor),
    accentColor: pickHex(colors.accentColor, DEFAULT_THEME_SETTINGS.accentColor),
    backgroundColor: pickHex(colors.backgroundColor, DEFAULT_THEME_SETTINGS.backgroundColor),
    surfaceColor: pickHex(colors.surfaceColor, DEFAULT_THEME_SETTINGS.surfaceColor),
    surfaceSubduedColor: pickHex(
      colors.surfaceSubduedColor,
      DEFAULT_THEME_SETTINGS.surfaceSubduedColor,
    ),
    borderColor: pickHex(colors.borderColor, DEFAULT_THEME_SETTINGS.borderColor),
    textColor: pickHex(colors.textColor, DEFAULT_THEME_SETTINGS.textColor),
    textMutedColor: pickHex(colors.textMutedColor, DEFAULT_THEME_SETTINGS.textMutedColor),
    announcementBgColor: pickHex(
      colors.announcementBgColor,
      DEFAULT_THEME_SETTINGS.announcementBgColor,
    ),
    announcementTextColor: pickHex(
      colors.announcementTextColor,
      DEFAULT_THEME_SETTINGS.announcementTextColor,
    ),
    headerBgColor: pickHex(colors.headerBgColor, DEFAULT_THEME_SETTINGS.headerBgColor),
    footerBgColor: pickHex(colors.footerBgColor, DEFAULT_THEME_SETTINGS.footerBgColor),
    footerTextColor: pickHex(colors.footerTextColor, DEFAULT_THEME_SETTINGS.footerTextColor),
    checkoutLeftBgColor: pickHex(
      checkout.checkoutLeftBgColor,
      DEFAULT_THEME_SETTINGS.checkoutLeftBgColor,
    ),
    checkoutSummaryBgColor: pickHex(
      checkout.checkoutSummaryBgColor,
      DEFAULT_THEME_SETTINGS.checkoutSummaryBgColor,
    ),
    checkoutBadgeBgColor: pickHex(
      checkout.checkoutBadgeBgColor,
      DEFAULT_THEME_SETTINGS.checkoutBadgeBgColor,
    ),
    fontFamily: pickEnum(
      typography.fontFamily,
      ["inter", "system", "serif", "mono"] as const,
      DEFAULT_THEME_SETTINGS.fontFamily,
    ),
    headingFontFamily: pickEnum(
      typography.headingFontFamily,
      ["inherit", "inter", "serif", "system"] as const,
      DEFAULT_THEME_SETTINGS.headingFontFamily,
    ),
    baseFontSize: pickEnum(
      typography.baseFontSize,
      ["14px", "15px", "16px", "17px"] as const,
      DEFAULT_THEME_SETTINGS.baseFontSize,
    ),
    headingWeight: pickEnum(
      typography.headingWeight,
      ["600", "700", "800"] as const,
      DEFAULT_THEME_SETTINGS.headingWeight,
    ),
    headingLetterSpacing: pickEnum(
      typography.headingLetterSpacing,
      ["tight", "normal", "wide"] as const,
      DEFAULT_THEME_SETTINGS.headingLetterSpacing,
    ),
    lineHeight: pickEnum(
      typography.lineHeight,
      ["compact", "normal", "relaxed"] as const,
      DEFAULT_THEME_SETTINGS.lineHeight,
    ),
    borderRadius: pickEnum(
      buttons.borderRadius,
      ["none", "sm", "md", "lg", "full"] as const,
      DEFAULT_THEME_SETTINGS.borderRadius,
    ),
    buttonRadius: pickEnum(
      buttons.buttonRadius,
      ["none", "sm", "md", "lg", "full"] as const,
      DEFAULT_THEME_SETTINGS.buttonRadius,
    ),
    buttonTextTransform: pickEnum(
      buttons.buttonTextTransform,
      ["none", "uppercase"] as const,
      DEFAULT_THEME_SETTINGS.buttonTextTransform,
    ),
    buttonFontWeight: pickEnum(
      buttons.buttonFontWeight,
      ["500", "600", "700"] as const,
      DEFAULT_THEME_SETTINGS.buttonFontWeight,
    ),
  };
}

export function buildThemeCssVariables(theme: ResolvedThemeSettings): Record<string, string> {
  return {
    "--theme-primary": theme.primaryColor,
    "--theme-primary-hover": theme.primaryHoverColor,
    "--theme-primary-text": theme.primaryTextColor,
    "--theme-accent": theme.accentColor,
    "--theme-bg": theme.backgroundColor,
    "--theme-surface": theme.surfaceColor,
    "--theme-surface-subdued": theme.surfaceSubduedColor,
    "--theme-border": theme.borderColor,
    "--theme-text": theme.textColor,
    "--theme-text-muted": theme.textMutedColor,
    "--theme-announcement-bg": theme.announcementBgColor,
    "--theme-announcement-text": theme.announcementTextColor,
    "--theme-header-bg": theme.headerBgColor,
    "--theme-footer-bg": theme.footerBgColor,
    "--theme-footer-text": theme.footerTextColor,
    "--theme-checkout-left-bg": theme.checkoutLeftBgColor,
    "--theme-checkout-summary-bg": theme.checkoutSummaryBgColor,
    "--theme-checkout-badge-bg": theme.checkoutBadgeBgColor,
    "--theme-font-body": FONT_STACKS[theme.fontFamily],
    "--theme-font-heading": HEADING_FONT_STACKS[theme.headingFontFamily],
    "--theme-font-size": theme.baseFontSize,
    "--theme-heading-weight": theme.headingWeight,
    "--theme-heading-tracking": LETTER_SPACING_MAP[theme.headingLetterSpacing],
    "--theme-line-height": LINE_HEIGHT_MAP[theme.lineHeight],
    "--theme-radius": RADIUS_MAP[theme.borderRadius],
    "--theme-button-radius": RADIUS_MAP[theme.buttonRadius],
    "--theme-button-transform": theme.buttonTextTransform,
    "--theme-button-weight": theme.buttonFontWeight,
  };
}
