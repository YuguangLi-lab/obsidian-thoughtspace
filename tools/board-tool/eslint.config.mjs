import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
 {ignores:['**/dist/**']},
 js.configs.recommended,
 ...tseslint.configs.recommended,
 {files:['tools/board-tool/**/*.{ts,mjs}'],languageOptions:{globals:{process:'readonly',console:'readonly',URL:'readonly',structuredClone:'readonly'}},rules:{'no-control-regex':'off'}},
);
