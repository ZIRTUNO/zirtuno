import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "Dead Code/**", // quarantined source is retained for recovery, never active
      ".claude/**", // local agent worktrees and their generated builds
      ".next/**",
      ".next-*/**", // NEXT_DIST_DIR verification / lab builds
      ".open-next/**", // the Cloudflare Worker build output
      ".wrangler/**", // wrangler's local state
      "artifacts/**", // visual evidence and recoverable cache backups
      "captures/**", // local screenshot / QA scratch, never shipped
      "s4-diag/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
