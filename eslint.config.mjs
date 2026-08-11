import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // Global ignores — these are excluded from linting entirely.
    ignores: [
      ".next/**",
      ".next",
      "node_modules/**",
      "node_modules",
      "prisma/dev.db*",
      "prisma/test.db*",
      // next-env.d.ts is auto-generated; eslint-config-next flags triple-slash
      // but the generated file needs it. Suppress here only.
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
