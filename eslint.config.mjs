import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.next-dev/**",
      "**/dist/**",
      "**/build/**",
      "**/.medusa/**",
      "**/coverage/**",
      "docs/measurements/**",
      "*.mjs",
      "*.cjs",
      "**/apps/web/src/app/(payload)/admin/importMap.js",
      "**/apps/web/src/payload-types.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["apps/web/src/tests/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='setContent']",
          message:
            "page.setContent() yasaktır (AGENTS.md §5). Doğrulama ve testler gerçek çalışan sunucudaki canlı sayfaları ziyaret etmelidir.",
        },
      ],
    },
  }
);
