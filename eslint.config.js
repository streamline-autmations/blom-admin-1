import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'docs/archive'] },
  {
    // Node-side code: build/maintenance scripts and Netlify Functions.
    // Without this they reported `process`, `require`, `module`, `__dirname`
    // and `Buffer` as undefined (155 false positives).
    files: ['scripts/**/*.js', 'netlify/**/*.js', '*.config.js', 'vite-plugins/**/*.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
      ecmaVersion: 'latest',
    },
    rules: { ...js.configs.recommended.rules },
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      // This codebase does not use PropTypes anywhere (React's own PropTypes
      // support was removed in React 19). Leaving the rule on produced ~830
      // findings that no one can action without adopting a validation library.
      'react/prop-types': 'off',
      // cmdk (used by the shadcn Command component) styles via this custom attribute.
      'react/no-unknown-property': ['error', { ignore: ['cmdk-input-wrapper'] }],
      // `_`-prefixed bindings mark a deliberately unused value.
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
