import eslint from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "Mobile/android/**", "docs/ui-verification/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Empty catch blocks in this codebase are deliberate best-effort fallbacks
      // (for storage cleanup, optional notifications, and cleanup handlers).
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    files: ["client/src/**/*.tsx"],
    plugins: { "jsx-a11y": jsxA11y },
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  {
    files: ["client/src/**/*.{ts,tsx}", "Mobile/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.es2022, ...globals.node } },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-refresh/only-export-components": ["error", { allowConstantExport: true, allowExportNames: ["useAuth", "useAppSession", "useToast", "toast"] }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    files: ["server/**/*.js", "scripts/**/*.{js,mjs}", "*.config.js"],
    languageOptions: { sourceType: "module", globals: { ...globals.node } },
  },
  {
    files: ["**/*.cjs", "Mobile/*.config.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node, module: "readonly", require: "readonly" } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
