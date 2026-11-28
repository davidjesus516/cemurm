import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

// Flat config. Replaces .eslintrc.cjs; ESLint 10 no longer reads eslintrc at
// all, so this file is the only config the lint step will see.
//
// THREE DIFFERENCES FROM THE eslintrc THAT ARE EASY TO MISS:
//
// 1. `--ext` is gone. Flat config derives the file set from the `files`
//    patterns below, so package.json's lint script no longer passes
//    `--ext js,jsx,mjs,ts,tsx` (ESLint 10 rejects the flag outright).
//
// 2. Dotfolders are NO LONGER ignored by default. eslintrc skipped every
//    dot-path implicitly; flat config only skips `node_modules` and `.git`.
//    That matters here because `.worktrees/` holds a full checkout of this
//    repo (~600 script files) — without the explicit ignore below, `eslint .`
//    lints a second copy of the tree and reports its problems twice.
//
// 3. `parserOptions.ecmaFeatures.jsx` is no longer implied by the extension.
//    Under eslintrc, `.jsx` was parsed as JSX because of the extension; espree
//    in flat config needs the flag, or every component file is a syntax error.
//
// The React plugin's rules applied to the whole tree under eslintrc (its
// `extends` were global), so they are repeated on the TS block rather than
// scoped to JS only — dropping them there would silently shrink the gate.

const REACT_RULES = {
  ...react.configs.flat.recommended.rules,
  ...react.configs.flat['jsx-runtime'].rules,

  // react-hooks 7's `recommended` also enables the React Compiler rules
  // (purity, immutability, refs, set-state-in-effect, static-components…).
  // Adopting those is a real behaviour gate over the whole app, not a config
  // migration, so this block keeps exactly the two rules
  // eslint-plugin-react-hooks 4 enabled and leaves the compiler set to its own
  // unit.
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
}

const REACT_SHARED = {
  plugins: { react, 'react-hooks': reactHooks },
  // Pinned, not 'detect'. eslint-plugin-react 7.37.5 calls context.getFilename()
  // to resolve the installed React version, and ESLint 10 removed that API —
  // with 'detect' every rule throws TypeError. The plugin still declares a peer
  // range of `eslint … ^9.7`, so this pin is what keeps it usable on 10 at all;
  // the pin is also more honest than a filesystem probe.
  settings: { react: { version: '19.3' } },
  rules: REACT_RULES,
}

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'dist/**',
      // A self-contained nested package (spike/audio-core and friends have
      // their own package.json). Its TypeScript is outside the src-scoped
      // typescript-eslint block, so the base parser cannot read it.
      'spike/**',
      // Deno, not Node: supabase/functions/** sits outside every JS gate by
      // the documented rule, and `deno check` is its gate instead.
      'supabase/**',
      // Local worktrees and agent scratch dirs: not this tree's source.
      '.worktrees/**',
      '.opencode/**',
      '.claude/**',
      '.freebuff/**',
      '.atl/**',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    ...REACT_SHARED,
    rules: {
      ...REACT_SHARED.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },

  {
    // Node ESM scripts (scripts/**/*.mjs) run in Node, not in the browser the
    // base config targets, so without this override every `process.exit()` in
    // them is a `no-undef` error. The agent guards, their selftest and the
    // PR-size gates are all `.mjs`. `.opencode/` is not listed: it is ignored
    // wholesale above, and the plugin there imports these same modules.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    // The unit tests run in Node, not the browser. eslintrc got this from a
    // `/* eslint-env node */` comment, which ESLint 10 rejects outright ("no
    // longer supported"), so the environment is declared here instead.
    //
    // `tests/**` is NOT included: the Playwright specs and fixtures under it
    // import `process`/`Buffer` from `node:*` explicitly, and adding the Node
    // globals on top of those imports turns each one into a `no-redeclare`.
    files: ['src/test/**/*.{js,jsx,mjs}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    // Playwright fixtures receive a `use` callback from the fixture API. It has
    // nothing to do with React, but react-hooks 7 reads the name as a hook call
    // inside a non-component function.
    files: ['tests/**/*.js'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },

  // TS/TSX half (tw4-stack-foundation S5, odd/tasks/tw4-stack-foundation.md L3).
  // Scoped to src/ on purpose: supabase/functions/*.ts run on Deno and sit
  // outside every gate by the documented AGENTS.md rule — Node-based
  // typescript-eslint rules must not judge them. Non-type-aware configs only,
  // so no tsconfig project service is needed.
  //
  // Written out rather than spreading `flat/recommended`: that config applies
  // its parser to EVERY file (its first entry carries no `files` pattern), so
  // spreading it would hand the TS parser files this project never meant to
  // type-check. The two rule maps below are the flat equivalents of the
  // eslintrc's `plugin:@typescript-eslint/eslint-recommended` and
  // `plugin:@typescript-eslint/recommended`, in the same order.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    plugins: { ...REACT_SHARED.plugins, '@typescript-eslint': tseslint },
    settings: REACT_SHARED.settings,
    rules: {
      ...REACT_SHARED.rules,
      ...tseslint.configs['eslint-recommended'].overrides[0].rules,
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
]
