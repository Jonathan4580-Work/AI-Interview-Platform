import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "dist/**",
      "*.config.*",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-extraneous-class": "off",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*/internal/*"],
              message:
                "Module internals are private. Import from the module public boundary instead.",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
