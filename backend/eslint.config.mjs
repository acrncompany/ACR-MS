import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/generated'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Nest DI relies on runtime class imports; keep value imports for injected classes.
      '@typescript-eslint/consistent-type-imports': 'off',
      // PrismaClient must only be reached through the services in core/database.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/prisma/*', '@prisma/client'],
              message: 'Use PrismaService (tenant-scoped) from core/database instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // The only place allowed to touch the raw Prisma client.
    files: ['src/core/database/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Only the tenant module (and future admin modules) may use the unscoped client.
    files: ['src/modules/**/*.ts'],
    ignores: ['src/modules/tenant/**', 'src/modules/admin/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/generated/prisma/*', '@prisma/client'],
              message: 'Use PrismaService (tenant-scoped) from core/database instead.',
            },
            {
              group: ['**/system-prisma.service*'],
              message: 'SystemPrismaService is only for tenant/admin modules.',
            },
          ],
        },
      ],
    },
  },
);
