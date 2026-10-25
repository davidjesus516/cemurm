module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'CEMURM', 'supabase'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: 'detect' } },
  rules: {
    'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
  },
  overrides: [
    {
      // TS/TSX half (tw4-stack-foundation S5, odd/tasks/tw4-stack-foundation.md
      // L3). Scoped to src/ on purpose: --ext ts,tsx would also admit
      // supabase/functions/*.ts, which run on Deno and sit outside every
      // gate by the documented AGENTS.md rule — Node-based typescript-eslint
      // rules must not judge them. Non-type-aware configs only, so no tsconfig
      // project service is needed. Note: eslintrc resolves `extends` eagerly,
      // so this override loads the plugin at lint boot even with zero matching
      // files — under typescript 7 this throw-killed the lint (see L2); it is
      // here precisely because the repo is on 6.0.3 now.
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      extends: [
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          { varsIgnorePattern: '^[A-Z_]' },
        ],
      },
    },
  ],
}
