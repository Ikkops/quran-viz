import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "public", "android", "src/test/setup.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        location: "readonly",
        matchMedia: "readonly",
        HTMLElement: "readonly",
        SVGElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        URL: "readonly",
        console: "readonly",
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // The v7 react-hooks rules below fire on legitimate patterns here
      // (fetch-in-effect lazy hooks; local var reassignment inside useMemo).
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/no-mutation-after-render": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "off",
    },
  },
  prettier,
);
