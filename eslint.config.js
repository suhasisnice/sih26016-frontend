import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

/* Lint config for the build. Deliberately small: the rules that catch real
   bugs (unused bindings, undefined names, hook dependency mistakes) and
   nothing that argues about formatting. */
export default [
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Without eslint-plugin-react the base rule cannot see a binding used
      // only inside JSX, so capitalised names — components, and component
      // types pulled out of a map — are exempted rather than deleted.
      'no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^[A-Z_]',
          argsIgnorePattern: '^[A-Z_]',
          args: 'after-used',
        },
      ],
    },
  },
];
