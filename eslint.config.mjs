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
    // Build artifacts and generated code:
    "public/sw.js",
    "src/generated/**",
  ]),
  {
    rules: {
      // Mount-time browser-state syncs (theme, online status, install prompt)
      // predate useSyncExternalStore; treat as tech debt, not build breakers.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
