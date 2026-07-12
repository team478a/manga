import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [{ ignores: ["apps/desktop/**", "packages/**"] }, ...nextVitals];

export default eslintConfig;
