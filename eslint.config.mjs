import { fixupConfigRules } from "@eslint/compat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTypeScript),
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  globalIgnores([
    "**/.superpowers/**",
    "**/.worktrees/**",
    "**/.next/**",
    "**/.next-review/**",
    "**/coverage/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/dist/**",
    "**/next-env.d.ts",
  ]),
]);
