/** Palette/material changes only: document content and board objects own their colors. */
const roots = [
  '.ts-root', '.ts-journal', '.ts-ui-modal', '.ts-space-modal', '.ts-settings',
  '.ts-native-header', '.ts-writing', '.ts-note-markdown-toolbar',
  '.ts-media-workspace', '.ts-online-workspace', '.ts-materials-panel',
  '.ts-materials-modal', '.ts-brain-shell', '.ts-handwriting',
  '.ts-local-relations', '.ts-collection-content', '.ts-ui-menu',
];
const outsideCalendar = ':not(:where(.ts-calendar-plugin,.ts-calendar-plugin *))';
// Obsidian can load styles.css after onload. Four owned classes deliberately beat
// legacy .theme-light .ts-root[data-surface=paper], regardless of sheet order.
const owned = (root: string) => root.repeat(4) + outsideCalendar;
const allRoots = `:is(${roots.map(owned).join(',')})`;
const within = (root: string, descendants: string) => `${owned(root)} :is(${descendants})${outsideCalendar}`;
const rule = (selector: string, declarations: string) => `${selector}{${declarations}}`;

// The original Paper finish, unchanged from 0.97.0 (d55a251) through 1.3.36
// (6e92b93). Steps 7–10 are the original Radix sage / sageDark values. This is
// independent of the canvas paper preset/texture and does not add paper noise.
const paperLight = [
  '#fffdf8', '#f6f4ee', '#eeece4', '#e6e4dc', '#dedcd3', '#d3d1c7',
  '#cbcfcd', '#b8bcba', '#868e8b', '#7c8481', '#67675f', '#272a25',
];
const paperDark = [
  '#20211e', '#252620', '#2c2d27', '#34352e', '#3c3e35', '#4c4e43',
  '#444947', '#5b625f', '#63706b', '#717d79', '#b9bcaf', '#e9ebdf',
];

interface Palette {
  paper: string;
  sheet: string;
  ink: string;
  muted: string;
  line: string;
  wash: string;
  editorial: string;
  edge: string;
  shadow: string;
  faint?: string;
}

const paperPalette = (scale: string[]): Palette => ({
  paper: scale[1], sheet: scale[0], ink: scale[11], muted: scale[10],
  line: scale[4], wash: scale[2], editorial: scale[10], edge: scale[8],
  shadow: '0 1px 3px #00000009',
});

function paletteRules(palette: Palette, scale?: string[]): string {
  const values = Object.entries(palette)
    .filter(([name]) => name !== 'faint')
    .map(([name, value]) => `--ts-e-${name}:${value};`).join('');
  const ui = scale ?? [
    palette.sheet, palette.paper, palette.wash, palette.wash,
    palette.line, palette.line, palette.edge, palette.edge,
    palette.editorial, palette.editorial, palette.muted, palette.ink,
  ];
  return values + ui.map((value, i) => `--ts-ui-${i + 1}:${value};`).join('') +
    `--ts-c-faint:${palette.faint ?? palette.muted};`;
}

/** One historical paper interface, regardless of retired saved style values. */
export function interfaceStyleRules(_style?: unknown, _glassEffects?: boolean): string {
  const light = paperPalette(paperLight);
  const dark = paperPalette(paperDark);
  const font = 'var(--font-interface)';
  const radius = '8px';
  const shared = `
    --ts-e-serif:${font};--ts-e-radius:${radius};--ts-e-control-radius:5px;
    --ts-design-line:var(--ts-e-line);--ts-design-panel:var(--ts-e-sheet);
    --ts-design-wash:color-mix(in srgb,var(--ts-accent,var(--interactive-accent)) 6%,var(--ts-e-sheet));
    --ts-design-hover:var(--ts-design-wash);--ts-design-overlay-shadow:var(--ts-e-shadow);
    --ts-design-radius:${radius};
    --ts-c-paper:var(--ts-e-paper);--ts-c-sheet:var(--ts-e-sheet);
    --ts-c-ink:var(--ts-e-ink);--ts-c-muted:var(--ts-e-muted);--ts-c-line:var(--ts-e-line);
    --ts-c-wash:var(--ts-e-wash);--ts-c-editorial:var(--ts-e-editorial);
    --ts-c-serif:${font};
    --ts-c-radius:6px;--ts-c-control-radius:5px;
  `;
  let css = rule(allRoots, shared + paletteRules(light, paperLight)) +
    rule(`.theme-dark ${allRoots}`, paletteRules(dark, paperDark));
  // The marker is attached only to menus created by ThoughtSpace. Native menus
  // and another plugin's .menu are intentionally outside this layer.
  css += rule(owned('.ts-ui-menu'), 'background:var(--ts-e-sheet);color:var(--ts-e-ink);border-color:var(--ts-e-line);box-shadow:var(--ts-e-shadow);') +
    rule(within('.ts-ui-menu', '.menu-item.selected:not(.is-disabled):not(.is-warning)'), 'background:var(--ts-e-wash);color:var(--ts-e-ink);') +
    rule(within('.ts-ui-menu', '.menu-separator'), 'border-color:var(--ts-e-line);');

  css += rule(allRoots, `--ts-design-shadow:var(--ts-e-shadow);--ts-c-shadow:var(--ts-e-shadow);
    --ts-canvas-chrome-surface:var(--ts-e-sheet);--ts-canvas-chrome-line:var(--ts-e-line);
    --ts-canvas-chrome-shadow:var(--ts-e-shadow);
    --ts-work-line:var(--ts-e-line);--ts-work-wash:var(--ts-e-wash);
    --ts-work-hover:var(--ts-design-hover);--ts-work-panel:var(--ts-e-sheet);
    --ts-work-raised:var(--ts-e-sheet);--ts-work-shadow:var(--ts-e-shadow);`) +
    rule(within('.ts-root', '.ts-main'), '--ts-canvas-chrome-shadow:var(--ts-e-shadow);--ts-board-shadow:var(--ts-e-shadow);--ts-board-menu-shadow:var(--ts-e-shadow);') +
    rule(owned('.ts-media-workspace'), '--ts-mw-line:var(--ts-e-line);--ts-mw-soft:var(--ts-e-wash);--ts-mw-page:var(--ts-e-paper);--ts-mw-accent-soft:var(--ts-design-hover);');

  // Only named plugin chrome. In particular, there are no Markdown/editor,
  // node, media player, ink stage, canvas background or native-menu selectors.
  const sheetChrome = [
    within('.ts-root', '.ts-commandbar,.ts-inspector,.ts-minimap,.ts-calendar,.ts-tour-bar,.ts-board-rail,.ts-rail-popover,.ts-footer .ts-view-dock'),
    within('.ts-writing', '.ts-writing-header,.ts-writing-formatbar,.ts-writing-dock-head,.ts-writing-reference-heading,.ts-writing-panel-head,.ts-writing-transition'),
    within('.ts-media-workspace', '.ts-media-workspace__header,.ts-media-workspace__savebar,.ts-media-workspace__panel-switcher,.ts-media-workspace__layout-control'),
    within('.ts-online-workspace', '.ts-online-workspace__header,.ts-online-workspace__composer-actions'),
    within('.ts-handwriting', '.ts-handwriting-toolbar,.ts-handwriting-footer,.ts-handwriting-popover,.ts-handwriting-selection-actions'),
    owned('.ts-native-header'), owned('.ts-note-markdown-toolbar'),
    owned('.ts-ui-modal'), owned('.ts-space-modal'), owned('.ts-materials-modal'),
    owned('.ts-ui-menu'),
  ].join(',');
  // Legacy paper/soft surfaces already use !important; limit its replacement
  // to these owned material declarations, never dimensions/content or colors.
  css += rule(sheetChrome, 'background:var(--ts-e-sheet)!important;border-color:var(--ts-e-line);backdrop-filter:none!important;-webkit-backdrop-filter:none!important;');
  const elevated = [
    within('.ts-root', '.ts-commandbar,.ts-inspector,.ts-minimap,.ts-tour-bar,.ts-footer .ts-view-dock'),
    within('.ts-handwriting', '.ts-handwriting-popover,.ts-handwriting-selection-actions'),
    owned('.ts-ui-modal'), owned('.ts-space-modal'), owned('.ts-materials-modal'),
  ].join(',');
  css += rule(elevated, 'box-shadow:var(--ts-e-shadow)!important;');

  // These writing chrome slots predate the editorial token layer. Preserve
  // semantic colors on errors, primary actions and the article/native editor.
  css += rule(owned('.ts-writing'), '--writing-line:var(--ts-e-line);--writing-soft:var(--ts-e-paper);') +
    rule(within('.ts-writing', '.ts-writing-search'), 'background:var(--ts-e-paper);color:var(--ts-e-ink);') +
    rule(within('.ts-writing', '.ts-writing-search:focus-within'), 'background:var(--ts-e-sheet);') +
    rule(within('.ts-writing', '.ts-writing-panel-head h3,.ts-writing-reference-heading,.ts-writing-transition>div>strong'), 'color:var(--ts-e-ink);') +
    rule(within('.ts-writing', '.ts-writing-ref-label,.ts-writing-name small,.ts-writing-panel-foot,.ts-writing-reference-kind,.ts-writing-status-mode,.ts-writing-status-text,.ts-writing-preview-summary,.ts-writing-material-icon,.ts-writing-transition>div>span'), 'color:var(--ts-e-muted);') +
    rule(within('.ts-writing', '.ts-writing-material:hover'), 'background:var(--ts-e-wash);') +
    rule(within('.ts-writing', '.ts-writing-transition-icon'), 'background:var(--ts-e-paper);color:var(--ts-e-muted);');

  for (const root of ['.ts-materials-panel', '.ts-materials-modal']) {
    css += rule(within(root, '.ts-materials-tabs'), 'background:var(--ts-e-paper);') +
      rule(within(root, '.ts-materials-library,.ts-materials-tabs button[aria-selected=true]'), 'background:var(--ts-e-sheet);color:var(--ts-e-ink);');
  }

  return css;
}
