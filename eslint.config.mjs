import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prebuilt Next output for the bundled CLI (generated, not source).
    ".next-cli-build/**",
    "cli/app/.next-cli-build/**",
    // Generated knowledge-graph artifacts.
    "graphify-out/**",
  ]),
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      // The React Compiler rules shipped with eslint-config-next 16 flag ~150
      // pre-existing patterns (setState-in-effect, immutability, refs) across
      // dashboard components. They are real modernization targets but fixing
      // them means reworking component state flow, which is out of scope for
      // CI hardening and carries UI regression risk. Keep them visible as
      // warnings so `npm run lint` can gate real errors without forcing a
      // risky mass refactor. Revisit rule-by-rule, not all at once.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
]);

export default eslintConfig;
