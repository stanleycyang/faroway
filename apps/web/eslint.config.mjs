import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16.4 enables the React Compiler hook rules as errors.
// Downgrade them on the config object that already registers the plugin so
// this security PR does not change runtime behavior. Cleaning the warnings
// up is a separate follow-up. rules-of-hooks stays an error.
const reactCompilerRules = {
  "react-hooks/config": "warn",
  "react-hooks/error-boundaries": "warn",
  "react-hooks/gating": "warn",
  "react-hooks/globals": "warn",
  "react-hooks/immutability": "warn",
  "react-hooks/preserve-manual-memoization": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/refs": "warn",
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/set-state-in-render": "warn",
  "react-hooks/static-components": "warn",
  "react-hooks/use-memo": "warn",
};

function warnOnReactCompilerRules(configs) {
  return configs.map((config) => {
    if (!config?.plugins?.["react-hooks"]) return config;
    return {
      ...config,
      rules: {
        ...config.rules,
        ...reactCompilerRules,
      },
    };
  });
}

const eslintConfig = defineConfig([
  ...warnOnReactCompilerRules(nextVitals),
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated files
    "app/.well-known/**",
  ]),
]);

export default eslintConfig;
