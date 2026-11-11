import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      ".next-dev/**",
      "dist/**",
      "node_modules/**",
      "src/app/(payload)/admin/importMap.js",
      "src/payload-types.ts",
      "src/payload-generated-schema.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/tests/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='setContent']",
          message:
            "page.setContent() yasaktır (AGENTS.md §5). Testler gerçek çalışan sunucudaki canlı sayfaları ziyaret etmelidir.",
        },
      ],
    },
  }
);
