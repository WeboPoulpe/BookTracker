import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Bundles du service worker, écrits par Serwist au build. La source
      // est app/sw.ts, elle, bien vérifiée.
      "public/sw.js",
      "public/sw.js.map",
      "public/swe-worker-*.js",
    ],
  },
];

export default eslintConfig;
