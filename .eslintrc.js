module.exports = {
    env: {
      browser: true,
      node: true,
      es6: true,
    },
    extends: [
      "prettier",
      "eslint:recommended",
      "plugin:jsdoc/recommended",
    ],
    plugins: ["jsdoc", "prettier"],
    globals: {
      Atomics: "readonly",
      SharedArrayBuffer: "readonly",
    },
    parser: "@babel/eslint-parser",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      ecmaVersion: 2018,
      sourceType: "module",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // jsdoc
      "jsdoc/check-access": "error", // Recommended
      "jsdoc/check-alignment": "error", // Recommended
      "jsdoc/check-examples": "error",
      "jsdoc/check-indentation": "error",
      "jsdoc/check-line-alignment": "error",
      "jsdoc/check-param-names": "error", // Recommended
      "jsdoc/check-property-names": "error", // Recommended
      "jsdoc/check-syntax": "error",
      "jsdoc/check-tag-names": "error", // Recommended
      "jsdoc/check-types": "error", // Recommended
      "jsdoc/check-values": "error", // Recommended
      "jsdoc/empty-tags": "error", // Recommended
      "jsdoc/implements-on-classes": "error", // Recommended
      "jsdoc/match-description": "error",
      "jsdoc/newline-after-description": "error", // Recommended
      "jsdoc/no-bad-blocks": "error",
      "jsdoc/no-defaults": "error",
      "jsdoc/no-undefined-types": "error", // Recommended
      "jsdoc/require-description": "error",
      "jsdoc/require-description-complete-sentence": "error",
      "jsdoc/require-example": "error",
      "jsdoc/require-file-overview": "off",
      "jsdoc/require-hyphen-before-param-description": "error",
      "jsdoc/require-jsdoc": "error", // Recommended
      "jsdoc/require-param": "error", // Recommended
      "jsdoc/require-param-description": "error", // Recommended
      "jsdoc/require-param-name": "error", // Recommended
      "jsdoc/require-param-type": "error", // Recommended
      "jsdoc/require-property": "error", // Recommended
      "jsdoc/require-property-description": "error", // Recommended
      "jsdoc/require-property-name": "error", // Recommended
      "jsdoc/require-property-type": "error", // Recommended
      "jsdoc/require-returns": "error", // Recommended
      "jsdoc/require-returns-check": "error", // Recommended
      "jsdoc/require-returns-description": "error", // Recommended
      "jsdoc/require-returns-type": "error", // Recommended
      "jsdoc/valid-types": "error", // Recommended
    },
    overrides: [
      {
        files: ["**/*.test.js"],
        rules: {
          "no-undef": "off",
        },
      },
    ],
  };