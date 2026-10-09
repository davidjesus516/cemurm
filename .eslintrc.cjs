module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'CEMURM'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.3' } },
  rules: {
    'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
  },
  overrides: [
    {
      // The domain layer is pure logic with no I/O. This rule is the machine check for
      // that boundary: docs/decisions.md (ADR-010) states the boundary is "a rule, not a
      // compiler check". This is that check. Intra-domain relative imports are unaffected.
      files: ['src/domain/**/*.js', 'src/domain/**/*.jsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '../../data/**',
                  '../../app/**',
                  '../../offline/**',
                  '../../features/**',
                  '../../integrations/**',
                  '../../hooks/**',
                  '../../ui/**',
                  '../../lib/**',
                ],
                message:
                  'src/domain must stay pure. Keep the I/O in src/data (or another outer layer) and pass the result in as a parameter.',
              },
            ],
          },
        ],
        // no-restricted-imports only inspects static import/export declarations. A lazy
        // `await import('../../data/…')` slips straight through it, which is exactly how
        // src/domain/music/annotations.js reached the Supabase client. Close that hole here.
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "ImportExpression[source.value=/^\\.\\.\\/\\.\\.\\/(data|app|offline|features|integrations|hooks|ui|lib)\\//]",
            message:
              'src/domain must stay pure. A dynamic import does not make an I/O dependency pure. Move this read into src/data and inject the result.',
          },
        ],
      },
    },
  ],
}
