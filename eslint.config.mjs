import typescriptEslint from "@typescript-eslint/eslint-plugin";
import _import from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import { fixupPluginRules } from "@eslint/compat";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat
    .extends(
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "prettier"
    )
    .map((config) => ({
      ...config,
      files: ["**/*.ts", "**/*.tsx"],
    })),
  globalIgnores(["dist/", "node_modules/"]),
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
      import: fixupPluginRules(_import),
      "simple-import-sort": simpleImportSort,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tsParser,
    },
    rules: {
      "no-console": "warn",
      "no-debugger": "error",
      "no-shadow": "error",
      "no-irregular-whitespace": "warn",
      "prefer-const": "warn",
      "simple-import-sort/exports": "error",
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^\\u0000"],
            ["^@?\\w"],
            ["^~"],
            ["^\\.\\.", "^\\."],
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "import/no-cycle": "error",
      "import/no-useless-path-segments": "error",
      "import/no-default-export": "error",
      "import/first": "error",
      "no-unused-vars": "off",
    },
  },
  {
    files: ["vite.config.ts", "**/*.d.ts", "**/vite-env.d.ts"],
    rules: {
      "import/no-default-export": "off",
    },
  },
];
