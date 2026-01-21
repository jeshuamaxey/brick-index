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
  ]),
  // Custom rules for consistent logging
  {
    files: ["app/**/*.ts", "app/**/*.tsx", "lib/**/*.ts", "hooks/**/*.ts", "components/**/*.tsx"],
    rules: {
      // Warn about console usage to encourage structured logging via Pino
      // Set to "warn" initially to allow gradual migration, can be changed to "error" later
      "no-console": "warn",
    },
  },
  // Allow console in scripts and tests
  {
    files: ["scripts/**/*.ts", "tests/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
