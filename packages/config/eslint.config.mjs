import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared flat ESLint config for the monorepo.
 * Apps/packages extend this and may append framework-specific configs.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.config.*",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  }
);
