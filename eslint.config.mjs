import js from "@eslint/js";

export default [
  {
    ignores: [
      "node_modules/**",
      "packs/**",
      "css/**",
      "dist/**",
      "docs/**",
      "icon/**",
      "templates/**"
    ]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {
      // fvtt-types checks Foundry globals through jsconfig.json, more
      // accurately than a hand-maintained list would.
      "no-undef": "off",

      // Style, not defects. Kept visible as warnings so errors stay meaningful:
      // every remaining error is something that can misbehave at runtime.
      "no-case-declarations": "warn",
      "no-extra-boolean-cast": "warn",
      "no-useless-escape": "warn",
      "no-regex-spaces": "warn",
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-prototype-builtins": "off",

      // The let x = null; try { x = ... } catch { return null; } idiom reads as
      // a dead store to this rule, and is used deliberately across the module.
      "no-useless-assignment": "off",

      "no-constant-condition": ["error", { checkLoops: false }],
      "no-unsafe-optional-chaining": "error",
      "no-self-compare": "error",
      "no-unmodified-loop-condition": "warn"
    }
  }
];
