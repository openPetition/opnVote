import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import stylisticJs from "@stylistic/eslint-plugin-js";

export default [
  {
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"]
  },
  {
    languageOptions: { globals: globals.browser }
  },
  pluginJs.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    plugins: {
      '@stylistic/js': stylisticJs
    }
  },
  {
    rules: {
      '@stylistic/js/brace-style': ["error", "1tbs", { "allowSingleLine": true }],
      '@stylistic/js/indent': ['error', 4],
      '@stylistic/js/no-trailing-spaces': ["error"]
    }
  }
];