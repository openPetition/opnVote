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
      "no-unused-vars": ["error", {
        "vars": "all",
        "args": "after-used",
        "caughtErrors": "none",
        "ignoreRestSiblings": false,
        "reportUsedIgnorePattern": false
      }],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      '@stylistic/js/brace-style': ["error", "1tbs", { "allowSingleLine": true }],
      '@stylistic/js/indent': ['error', 4],
      '@stylistic/js/no-trailing-spaces': ["error"],
      '@stylistic/js/semi': ["warn", "always"],
    }
  }
];