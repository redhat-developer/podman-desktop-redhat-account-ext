/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import header from 'eslint-plugin-header';
import importPlugin from 'eslint-plugin-import';
import noNull from 'eslint-plugin-no-null';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import typescriptLint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

// eslint-plugin-header does not declare a schema, which ESLint 10 rejects, and it still
// uses the legacy context API. Allow any options and let @eslint/compat patch the context.
const headerRule = header.rules.header;
const headerPlugin = fixupPluginRules({
  rules: {
    header: {
      ...headerRule,
      meta: { ...headerRule.meta, schema: [{}, {}, {}] },
    },
  },
});

export default defineConfig([
  globalIgnores([
    // ignorePatterns from .eslintrc.json
    'node_modules/**/*',
    'dist/**/*',
    // patterns from .eslintignore
    '**/test-resources/**',
    '**/www/**',
    '**/*.config.js',
    '**/*.config.ts',
    '**/types/**/*.ts',
    '**/__mocks__/**',
    '**/src/rh-api/gen/**',
    // the flat config file itself is not part of the sources
    '**/eslint.config.mjs',
  ]),

  js.configs.recommended,
  ...typescriptLint.configs.recommended,
  sonarjs.configs.recommended,
  // eslint-plugin-import does not ship a flat config, so it is loaded through FlatCompat
  ...fixupConfigRules(compat.extends('plugin:import/recommended', 'plugin:import/typescript')),

  {
    plugins: {
      // plug-ins still using the legacy context API
      header: headerPlugin,
      import: fixupPluginRules(importPlugin),
      'no-null': fixupPluginRules(noNull),
      // plug-ins with native flat config support
      'simple-import-sort': simpleImportSort,
      unicorn,
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, 'off'])),
      },

      ecmaVersion: 12,
      sourceType: 'module',

      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
        projectService: {
          allowDefaultProject: ['types/*.d.ts'],
        },
        tsconfigRootDir: __dirname,
      },
    },

    settings: {
      'import/resolver': {
        typescript: true,
        node: true,

        'eslint-import-resolver-custom-alias': {
          alias: {
            '/@': './src',
            '/@gen': './src-generated',
          },

          extensions: ['.ts'],
          packages: [],
        },
      },
    },

    rules: {
      eqeqeq: 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],

      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'prefer-promise-reject-errors': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      'no-null/no-null': 'error',
      semi: ['error', 'always'],
      'comma-dangle': ['warn', 'always-multiline'],

      quotes: ['error', 'single', {
        allowTemplateLiterals: true,
      }],

      // disabled import/namespace rule as the plug-in is not fully compatible using the compat mode
      'import/namespace': 'off',
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off',
      'import/default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-named-as-default': 'off',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-empty-collection': 'off',
      'sonarjs/no-small-switch': 'off',
      'sonarjs/no-commented-code': 'error',
      'import/no-extraneous-dependencies': 'error',

      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'sonarjs/no-ignored-exceptions': 'off',
      'sonarjs/todo-tag': 'off',
      'sonarjs/no-misused-promises': 'off',
    },
  },

  {
    files: ['**/*.ts'],

    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      'header/header': [2, 'block', [{
        pattern: 'SPDX-License-Identifier: Apache-2\\.0',
      }]],
    },
  },

  {
    // these files are derived from VS Code and keep their MIT license header
    files: ['src/logger.ts', 'src/authentication-service.ts'],

    rules: {
      'header/header': 'off',
    },
  },

  {
    files: ['tests/**/*.spec.ts'],

    rules: {
      'sonarjs/no-skipped-tests': 'off',
      'sonarjs/assertions-in-tests': 'off',
    },
  },
]);
