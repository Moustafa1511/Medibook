import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

/**
 * Custom rule scopes referenced below map to the binding contract:
 *   C6  — no local-time Date construction in server code
 *   C11 — middleware must stay Edge-safe (no argon2 / Prisma / full auth import)
 *   C16 — src/lib/env.ts is the only file allowed to touch process.env
 *   C22 — src/lib/clock.ts is the only file allowed to read the current time
 * Section 2.2 — one-directional layering: app -> features -> server -> lib
 */

const CLOCK_SEAM_SCOPE = ["src/server/**/*.ts", "src/features/**/actions.ts"];

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "docs/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---------------------------------------------------------------- Next.js
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  // ------------------------------------------------- repo-wide code quality
  {
    files: ["**/*.{ts,tsx,mjs}"],
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
    rules: {
      // Brief NFR: "no `any`". Section 14.2 restates it; this is where it is pinned.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // Section 2.2 — one zone per forbidden UPWARD edge.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            { target: "./src/lib", from: ["./src/app", "./src/features", "./src/server"] },
            { target: "./src/components", from: ["./src/app", "./src/features", "./src/server"] },
            { target: "./src/server", from: ["./src/app", "./src/features"] },
            { target: "./src/features", from: ["./src/app"] },
          ],
        },
      ],

      // C16 — process.env is readable in exactly one file (override below exempts it).
      "no-restricted-syntax": [
        "error",
        {
          selector: 'MemberExpression[object.name="process"][property.name="env"]',
          message:
            "C16: read configuration from src/lib/env.ts, which is the only file permitted to access process.env.",
        },
      ],
    },
  },

  // ------------------------------ C22: the clock seam (scoped, not repo-wide)
  {
    files: CLOCK_SEAM_SCOPE,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'MemberExpression[object.name="process"][property.name="env"]',
          message:
            "C16: read configuration from src/lib/env.ts, which is the only file permitted to access process.env.",
        },
        {
          selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
          message:
            "C22: inject a Clock and call clock.now() instead of new Date(), so the slot engine, hold expiry and OTP windows stay unit-testable.",
        },
        {
          selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
          message:
            "C22: inject a Clock and call clock.now() instead of Date.now(), so the slot engine, hold expiry and OTP windows stay unit-testable.",
        },
        {
          // C6 — new Date(2026, 9, 5) builds a LOCAL time, silently wrong for a
          // clinic in another zone. Build the instant with date-fns-tz instead.
          selector: 'NewExpression[callee.name="Date"][arguments.length>=2]',
          message:
            "C6: never construct a local-time Date in server code. Build the UTC instant from clinic-local wall time with fromZonedTime() (src/lib/dates.ts).",
        },
      ],
    },
  },

  // --------------------------- C16/C22 sanctioned exceptions (exactly two files)
  {
    files: ["src/lib/env.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["src/lib/clock.ts"],
    rules: { "no-restricted-syntax": "off" },
  },

  // ------------------------------------- C11: middleware must stay Edge-safe
  {
    files: ["src/middleware.ts", "src/auth.config.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@node-rs/argon2",
              message:
                "C11: argon2 is a native Node module. Importing it here drags it into the Edge middleware bundle and breaks the build. Keep it in src/auth.ts.",
            },
            {
              name: "@prisma/client",
              message:
                "C11: Prisma cannot run on the Edge runtime. Keep database access in src/auth.ts (Node runtime).",
            },
            {
              name: "@/server/db",
              message: "C11: no database access from Edge middleware.",
            },
            {
              name: "./auth",
              message:
                "C11: importing the full auth config pulls Credentials + argon2 + Prisma into middleware. Import ./auth.config instead (the Edge-safe split).",
            },
            {
              name: "@/auth",
              message:
                "C11: importing the full auth config pulls Credentials + argon2 + Prisma into middleware. Import @/auth.config instead (the Edge-safe split).",
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Section 2.2 says app/ holds "route segments only ... no business logic", so a
  // page or layout reaches the server layer THROUGH a feature. Route handlers
  // (route.ts) are the documented exception: C13 defines four of them whose whole
  // job is server work, so they are deliberately not covered here.
  // ---------------------------------------------------------------------------
  {
    files: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/app/**/template.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/*", "@/server"],
              message:
                "Section 2.2: a page or layout renders feature components; it does not reach into the server layer. Put the query in features/<feature>/queries.ts and import that. (Route handlers are exempt.)",
            },
          ],
        },
      ],
    },
  },

  // ------------------------------------------- Node scripts and config files
  // Plain .mjs tooling runs in Node, so declare the globals it uses. (TS files
  // need no equivalent: typescript-eslint turns no-undef off, since tsc checks it.)
  {
    files: [
      "scripts/**/*.{mjs,ts}",
      "prisma/**/*.ts",
      "*.config.mjs",
      "*.config.ts",
      "*.config.mts",
    ],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        fetch: "readonly",
        // Code inside a Playwright page.evaluate() callback runs in the browser,
        // not in Node, so these are legitimately defined at that call site.
        document: "readonly",
        window: "readonly",
      },
    },
    rules: {
      // Tooling legitimately reads argv/stdout; the C16 process.env ban still
      // applies to application code under src/.
      "no-restricted-syntax": "off",
    },
  },

  // -------------------------------------------------------- test ergonomics
  {
    files: ["tests/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "**/*.config.{ts,mts}"],
    rules: {
      "no-restricted-syntax": "off",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
