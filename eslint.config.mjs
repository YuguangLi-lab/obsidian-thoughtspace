import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

// Run the official plugin checks against shipped TypeScript sources.
// Packaging/build scripts and test fixtures run outside the Obsidian host.
export default defineConfig([
  { ignores: ['node_modules/**', 'dist/**', 'main.js', 'tests/**', 'qa/**', 'scripts/**', '*.mjs'] },
  ...obsidianmd.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { parserOptions: { projectService: true } },
    // The directory reports these general JS/TS diagnostics as warnings.
    // Keep them visible without conflating them with blocking Obsidian rules.
    // Every obsidianmd/* rule retains the official recommended severity.
    rules: {
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn',
      'no-empty': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-duplicate-type-constituents': 'warn',
    },
  },
]);
