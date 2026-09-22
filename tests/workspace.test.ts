import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libraryFiles, noteExcerpt, isWorkspaceFile } from '../src/workspace';
const files = [{path:'Cards/B.md',basename:'B',stat:{mtime:2}},{path:'Cards/A.md',basename:'A',stat:{mtime:1}},{path:'Cards-extra/C.md',basename:'C',stat:{mtime:3}},{path:'Diary/D.md',basename:'D',stat:{mtime:4}}];
test('Library card scope uses directory boundary',()=>assert.deepEqual(libraryFiles(files,'cards','title','Cards',new Set()).map(f=>f.basename),['A','B']));
test('Current board scope includes only referenced notes',()=>assert.deepEqual(libraryFiles(files,'board','updated','Cards',new Set(['Cards/B.md','Diary/D.md'])).map(f=>f.basename),['D','B']));
test('Library sort is stable and never mutates source array',()=>{assert.deepEqual(libraryFiles(files,'vault','updated','Cards',new Set()).map(f=>f.basename),['D','C','B','A']);assert.equal(files[0].basename,'B');});
test('Preview excerpt omits metadata, code, heading and tag-only lines',()=>assert.equal(noteExcerpt('---\ntags: [secret]\n---\n# Title\n\n```js\nsecret();\n```\n\nVisible **idea**.\n#研究/阅读'), 'Visible idea.'));
test('Preview links remain readable and excerpt is bounded',()=>{assert.equal(noteExcerpt('[[Source|Evidence]] and [paper](https://example.org)'), 'Evidence and paper');assert.equal(noteExcerpt('x'.repeat(500)).length,150);});

test('Installation backups stay out of workspace indexes without hiding user backup folders',()=>{
 assert.equal(isWorkspaceFile({path:'ThoughtSpace-plugin-backups/2026/board.thoughtspace'}),false);
 assert.equal(isWorkspaceFile({path:'ThoughtSpace-plugin-backups-other/A.md'}),true);
 assert.equal(isWorkspaceFile({path:'Research/backups/A.md'}),true);
 const backup={path:'ThoughtSpace-plugin-backups/2026/note.md',basename:'note',stat:{mtime:999}};
 assert.deepEqual(libraryFiles([backup,...files],'vault','title','Cards',new Set()).map(f=>f.basename),['A','B','C','D']);
});
