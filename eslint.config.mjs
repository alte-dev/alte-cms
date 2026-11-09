import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
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
  }
);
