import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Assets de Tesseract.js vendorizados para OCR offline (worker/core
    // WASM minificados de terceros, servidos tal cual desde /public).
    "public/tesseract/**",
    // Salida del postbuild (ver DEPLOY.md) — ya gitignored, no es código fuente.
    "deploy/**",
  ]),
]);

export default eslintConfig;
