/** @type {import("stylelint").Config} */
module.exports = {
  plugins: ["stylelint-order"],
  extends: ["stylelint-config-standard"],
  rules: {
    "selector-pseudo-class-no-unknown": [
      true,
      {
        ignorePseudoClasses: ["global"],
      },
    ],
    "selector-class-pattern": null,
    "import-notation": null,
  },
};
