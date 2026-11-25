import { build, transform } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import postcss from 'postcss';
import { isolateBoardStyles } from './scripts/isolate-board-styles.mjs';

const dev = process.env.THOUGHTSPACE_DEV === '1';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: [
    '@electron/remote', 'node:https', 'fs/promises', 'fs', 'url', 'path',
    'crypto', 'electron', 'obsidian', '@codemirror/view', '@codemirror/state',
  ],
  format: 'cjs',
  target: 'es2022',
  outfile: 'main.js',
  sourcemap: false,
  minify: !dev,
  legalComments: 'none',
  treeShaking: true,
});

// Assemble all modular CSS layers in memory in one pass instead of 58 disk writes.
const cssModules = [
  'journal-quiet', 'sidebar', 'layout-planner', 'task-schedule', 'workspace-polish',
  'inline-node-editor', 'workflow', 'visual-system', 'section-catalog', 'mindmap-studio',
  'board-polish', 'saved-views', 'group-organizer', 'paper-settings', 'background-image',
  'text-markdown', 'interaction-chrome', 'branch-controls', 'sidebar-refinement',
  'workspace-refinement', 'edge-workflow', 'section-appearance', 'context-toolbar',
  'canvas-dock', 'board-search', 'space-hub', 'reading-workspace', 'reference-reading',
  'object-chrome', 'card-surfaces', 'card-styles', 'reading-media', 'yingjian-workspace',
  'media-card-player', 'media-workspace-view', 'online-workspace-view', 'online-preview',
  'online-board-player', 'settings', 'local-relations', 'board-mindmap', 'brain-board',
  'handwriting', 'mobile', 'board-modal-viewport', 'board-conflict-compare',
  'handwriting-export', 'brain-reading-positions', 'capture-delivery-modal',
  'reference-occurrences', 'collection-view', 'collection-heatmap-view',
  'collection-context', 'editorial-dialogs', 'mermaid-card', 'component-gallery',
  'card-library-polish',
];

const [baseCss, ...moduleContents] = await Promise.all([
  readFile('src/base-styles.css', 'utf8'),
  ...cssModules.map(name => readFile(`src/${name}.css`, 'utf8')),
]);

const assembled = [baseCss, ...moduleContents].join('\n');
let isolated = isolateBoardStyles(assembled);
if (!dev) {
  const ast = postcss.parse(isolated);
  ast.walkComments(comment => comment.remove());
  isolated = ast.toString();
}
const optimized = await transform(isolated, {
  loader: 'css',
  minifyWhitespace: !dev,
  legalComments: 'none',
});

await writeFile('styles.css', optimized.code);
