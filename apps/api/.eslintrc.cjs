module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json"],
    tsconfigRootDir: __dirname,
    sourceType: "module"
  },
  plugins: ["@typescript-eslint", "prettier"],
  extends: ["plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"],
  env: {
    node: true,
    es2020: true
  },
  ignorePatterns: ["dist", "node_modules"],
  rules: {
    "prettier/prettier": "error"
  }
};
