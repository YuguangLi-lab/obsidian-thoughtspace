import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the card library keeps one selection mark and leaves other ticks alone',()=>{
 const library=readFileSync('src/card-library-polish.css','utf8');
 const visual=readFileSync('src/visual-system.css','utf8');
 const database=readFileSync('src/workflow.css','utf8');
 assert.match(library,/\.ts-database-modal\.ts-ui-modal \.ts-card-library \.ts-library-card\.is-selected::after\s*\{[^}]*content:\s*none/);
 assert.match(library,/button\.ts-library-select\s*\{[^}]*width:\s*18px/);
 assert.match(visual,/\.ts-node\.is-selected::after/);
 assert.match(visual,/\.ts-library-card\.is-selected:not\(:where\(\.ts-node \*\)\)::after[^}]*content:"✓"/);
 assert.match(visual,/\.ts-library-card,\.ts-outline-row,\.ts-tree-row\)\.is-selected:not\(:where\(\.ts-node \*\)\)\{[^}]*box-shadow:inset 0 0 0 1px var\(--ts-e-selected\)/);
 assert.match(database,/\.ts-database \.ts-library-card\.is-selected::after\{content:\s*none;/);
 assert.doesNotMatch(library,/\.ts-node\.is-selected::after\s*\{[^}]*content:\s*none/);
 assert.doesNotMatch(library,/\.ts-database \.ts-library-card\.is-selected::after/);
});
