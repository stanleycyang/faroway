import base from "@faroway/eslint-config/base.mjs";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "ios/**",
      "android/**",
      "coverage/**",
      ".turbo/**",
      "scripts/**",
      "e2e/**",
      "expo-env.d.ts",
      "nativewind-env.d.ts",
    ],
  },
  ...base,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        __DEV__: "readonly",
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        XMLHttpRequest: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        localStorage: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        ReadableStream: "readonly",
      },
    },
    settings: {
      react: { version: "19.1" },
    },
    rules: {
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react/no-unused-state": "warn",
      "react/jsx-key": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // React 17+ runtime — no need to import React in scope
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
  {
    files: ["__tests__/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: {
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
