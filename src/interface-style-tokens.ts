import type { InterfaceStyle } from './workspace';

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

const editorialLight: Palette = {
  paper: '#f5f1e8', sheet: '#fffdf7', ink: '#342e28', muted: '#6c6055',
  line: '#ddd4c5', wash: '#ece5d8', editorial: '#a24b32', edge: '#938574',
  faint: '#736457', shadow: '0 2px 8px #4e351c08,0 16px 40px #4e351c0c',
};
const editorialDark: Palette = {
  paper: '#24211d', sheet: '#2d2822', ink: '#eee3d2', muted: '#bcad99',
  line: '#4a4034', wash: '#342e26', editorial: '#e0a081', edge: '#968571',
  faint: '#b3a18a', shadow: '0 2px 8px #0003,0 16px 40px #0004',
};
const glassLight: Palette = {
  paper: '#ededf0', sheet: '#fbfbfd', ink: '#1d1d1f', muted: '#606064',
  line: '#d1d1d6', wash: '#e7e7ec', editorial: '#0058bc', edge: '#85858d',
  shadow: 'inset 0 1px 0 #ffffffed,inset 0 -1px 0 #00000006,0 2px 5px #00000008,0 8px 24px #00000012',
};
const glassDark: Palette = {
  paper: '#1c1c1e', sheet: '#2c2c2e', ink: '#f5f5f7', muted: '#b8b8bf',
  line: '#48484b', wash: '#363639', editorial: '#80b6ff', edge: '#8d8d95',
  shadow: 'inset 0 1px 0 #ffffff29,inset 0 -1px 0 #ffffff06,0 2px 5px #00000024,0 12px 32px #0000003d',
};
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

const editorialSerif = '"Songti SC","STSong","Noto Serif CJK SC","Iowan Old Style","Palatino Linotype",serif';
const collectionSerif = '"Iowan Old Style","Palatino Linotype","Songti SC","STSong","Noto Serif CJK SC",serif';

/** Generate one selected interface, without mutating a document or global host tokens. */
export function interfaceStyleRules(style: InterfaceStyle, glassEffects: boolean): string {
  const paper = style === 'paper';
  const glass = style === 'glass';
  const light = paper ? paperPalette(paperLight) : glass ? glassLight : editorialLight;
  const dark = paper ? paperPalette(paperDark) : glass ? glassDark : editorialDark;
  const font = style === 'editorial' ? editorialSerif : 'var(--font-interface)';
  const radius = glass ? '16px' : '8px';
  const shared = `
    --ts-e-serif:${font};--ts-e-radius:${radius};--ts-e-control-radius:${glass ? '9px' : '5px'};
    --ts-design-line:var(--ts-e-line);--ts-design-panel:var(--ts-e-sheet);
    --ts-design-wash:color-mix(in srgb,var(--ts-accent,var(--interactive-accent)) 6%,var(--ts-e-sheet));
    --ts-design-hover:var(--ts-design-wash);--ts-design-overlay-shadow:var(--ts-e-shadow);
    --ts-design-radius:${radius};
    --ts-c-paper:var(--ts-e-paper);--ts-c-sheet:var(--ts-e-sheet);
    --ts-c-ink:var(--ts-e-ink);--ts-c-muted:var(--ts-e-muted);--ts-c-line:var(--ts-e-line);
    --ts-c-wash:var(--ts-e-wash);--ts-c-editorial:var(--ts-e-editorial);
    --ts-c-serif:${style === 'editorial' ? collectionSerif : font};
    --ts-c-radius:${glass ? '12px' : '6px'};--ts-c-control-radius:${glass ? '9px' : '5px'};
  `;
  let css = rule(allRoots, shared + paletteRules(light, paper ? paperLight : undefined)) +
    rule(`.theme-dark ${allRoots}`, paletteRules(dark, paper ? paperDark : undefined));
  // The marker is attached only to menus created by ThoughtSpace. Native menus
  // and another plugin's .menu are intentionally outside this layer.
  css += rule(owned('.ts-ui-menu'), 'background:var(--ts-e-sheet);color:var(--ts-e-ink);border-color:var(--ts-e-line);box-shadow:var(--ts-e-shadow);') +
    rule(within('.ts-ui-menu', '.menu-item.selected:not(.is-disabled):not(.is-warning)'), 'background:var(--ts-e-wash);color:var(--ts-e-ink);') +
    rule(within('.ts-ui-menu', '.menu-separator'), 'border-color:var(--ts-e-line);');

  // Keep the released magazine's type, shadows and shape exactly as authored.
  if (style === 'editorial') {
    return css + rule(allRoots, '--ts-design-shadow:0 1px 2px #4e351c08,0 4px 16px #4e351c09;--ts-c-shadow:0 8px 28px rgba(78,53,28,.045);') +
      rule(`.theme-dark ${allRoots}`, '--ts-design-shadow:0 1px 2px #00000024,0 3px 10px #00000018;--ts-design-overlay-shadow:0 2px 8px #00000035,0 18px 48px #00000042;--ts-c-shadow:0 8px 28px rgba(0,0,0,.12);');
  }

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

  if (!glass) return css;

  // macOS-inspired Liquid Glass stays in the navigation/control layer. Reading,
  // composition and settings content remain solid, with no stacked glass sheets.
  const glassChrome = [
    within('.ts-root', '.ts-commandbar,.ts-tour-bar,.ts-board-rail,.ts-rail-popover,.ts-footer .ts-view-dock'),
    within('.ts-writing', '.ts-writing-header,.ts-writing-formatbar,.ts-writing-dock-head'),
    within('.ts-media-workspace', '.ts-media-workspace__header,.ts-media-workspace__savebar,.ts-media-workspace__panel-switcher,.ts-media-workspace__layout-control'),
    within('.ts-online-workspace', '.ts-online-workspace__header,.ts-online-workspace__composer-actions'),
    within('.ts-handwriting', '.ts-handwriting-toolbar,.ts-handwriting-footer,.ts-handwriting-popover,.ts-handwriting-selection-actions'),
    within('.ts-collection-content', '.ts-collection-nav'),
    within('.ts-settings', '.ts-settings-nav'),
    owned('.ts-native-header'), owned('.ts-note-markdown-toolbar'), owned('.ts-ui-menu'),
  ].join(',');
  // The static baseline protects contrast over arbitrary user content. The
  // bounded runtime enhancement below adds refraction, not a native Apple API.
  css += rule(allRoots, glassEffects
    ? '--ts-glass-surface:color-mix(in srgb,var(--ts-e-sheet) 94%,transparent);--ts-glass-reflection:linear-gradient(135deg,#ffffff70 0%,#ffffff00 36%,#ffffff0a 72%,#ffffff24 100%);'
    : '--ts-glass-surface:var(--ts-e-sheet);--ts-glass-reflection:none;') +
    rule(`.theme-dark ${allRoots}`, glassEffects
      ? '--ts-glass-reflection:linear-gradient(135deg,#ffffff12 0%,#ffffff00 36%,#ffffff02 72%,#ffffff08 100%);'
      : '--ts-glass-reflection:none;') +
    rule(allRoots, '--ts-chrome-radius:16px;--ts-ui-radius:9px;--ts-c-shadow:0 1px 3px #00000008;') +
    rule(`.theme-dark ${allRoots}`, '--ts-c-shadow:0 1px 3px #00000020;') +
    rule(glassChrome, 'background:var(--ts-glass-reflection),var(--ts-glass-surface)!important;') +
    rule(within('.ts-settings', '.ts-settings-nav'), 'border-radius:var(--ts-e-radius);box-shadow:var(--ts-e-shadow);') +
    rule(within('.ts-settings', '.ts-settings-nav button'), 'border-radius:var(--ts-e-control-radius);') +
    rule(within('.ts-root', '.ts-commandbar,.ts-board-rail,.ts-rail-popover,.ts-footer .ts-view-dock'), 'border-radius:var(--ts-e-radius)!important;') +
    rule(owned('.ts-ui-menu'), 'border-radius:var(--ts-e-radius);') +
    rule(within('.ts-ui-menu', '.menu-item'), 'border-radius:var(--ts-e-control-radius);');

  if (glassEffects) {
    // The only blur layer is the compact board dock. Both viewport and the
    // board's own container must be wide, so a narrow split never enables it.
    const dock = within('.ts-root', '.ts-footer .ts-view-dock');
    css += `@supports ((backdrop-filter:blur(6px)) or (-webkit-backdrop-filter:blur(6px))){
      @media (min-width:761px) and (any-pointer:fine){
        @container ts-board-canvas (min-width:681px){
          ${rule(dock, 'backdrop-filter:blur(6px)!important;-webkit-backdrop-filter:blur(6px)!important;')}
        }
      }
    }`;
  }
  // An opaque baseline also covers engines without filter/container support.
  // Reduced transparency removes static reflections. The optional optical
  // enhancement below also disables its press transitions for reduced motion.
  css += `@media (prefers-reduced-transparency:reduce), (prefers-contrast:more){
    ${rule(`${allRoots},.theme-dark ${allRoots}`, '--ts-glass-surface:var(--ts-e-sheet);--ts-glass-reflection:none;')}
    ${rule(glassChrome, 'background:var(--ts-e-sheet)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;')}
  }
  @media (max-width:760px), (any-pointer:coarse){
    ${rule(allRoots, '--ts-glass-surface:var(--ts-e-sheet);')}
  }
  @container (max-width:680px){
    ${rule(glassChrome, 'background:var(--ts-e-sheet)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;')}
  }
  @supports not ((backdrop-filter:blur(6px)) or (-webkit-backdrop-filter:blur(6px))){
    ${rule(allRoots, '--ts-glass-surface:var(--ts-e-sheet);')}
  }`;
  if (glassEffects) {
    // The runtime-owned SVG contains definitions only. Keep it measurable by
    // filter references without allocating layout space or hiding the SVG.
    css += rule(`.ts-glass-filter-definitions${outsideCalendar}`, 'position:absolute;pointer-events:none;width:0;height:0;');
    // Runtime marks at most a few verified, visible floating surfaces. Never
    // apply optics to an entire workspace, the reading layer, or card content.
    const opticsTargets = [
      within('.ts-root', '.ts-main>.ts-rail-popover[data-ts-glass-optics=true],.ts-footer .ts-view-dock[data-ts-glass-optics=true]'),
      within('.ts-handwriting', '.ts-handwriting-popover[data-ts-glass-optics=true]'),
      `${owned('.ts-ui-menu')}[data-ts-glass-optics=true]`,
    ];
    const optics = opticsTargets.join(',');
    const shields = opticsTargets.map(target => `${target}>.ts-glass-content-shield${outsideCalendar}`).join(',');
    const active = opticsTargets.map(target => `${target}[data-ts-glass-active=true]`).join(',');
    const pressedShields = opticsTargets.map(target => `${target}[data-ts-glass-pressed=true]>.ts-glass-content-shield${outsideCalendar}`).join(',');
    const solidOptics = 'background:var(--ts-e-sheet)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;';
    // A hidden shield is the default even if runtime attributes momentarily
    // outlive CSS support. The filter establishes its own stacking/positioning
    // context; negative z keeps this decorative span behind real controls.
    css += rule(shields, 'display:none;pointer-events:none;') + `
    @supports ((backdrop-filter:url("#ts-glass-optics")) or (-webkit-backdrop-filter:url("#ts-glass-optics"))){
      @media (min-width:761px) and (pointer:fine) and (hover:hover){
        ${rule(optics, '--ts-glass-optic-highlight:color-mix(in srgb,var(--ts-e-sheet) 94%,white);background:var(--ts-glass-reflection),color-mix(in srgb,var(--ts-e-sheet) 26%,transparent)!important;backdrop-filter:var(--ts-glass-filter,none)!important;-webkit-backdrop-filter:var(--ts-glass-filter,none)!important;')}
        ${rule(active, '--ts-glass-optic-highlight:color-mix(in srgb,var(--ts-e-sheet) 82%,white);')}
        ${rule(shields, 'display:block;position:absolute;inset:7px;z-index:-1;pointer-events:none;user-select:none;margin:0;padding:0;border:0;border-radius:max(0px,calc(var(--ts-glass-radius,16px) - 7px));background:radial-gradient(ellipse 130px 80px at calc(var(--ts-glass-x,50%) - 7px) calc(var(--ts-glass-y,50%) - 7px),var(--ts-glass-optic-highlight),transparent 72%),color-mix(in srgb,var(--ts-e-sheet) 96%,transparent);box-shadow:0 0 5px 5px color-mix(in srgb,var(--ts-e-sheet) 84%,transparent);transition:inset 140ms ease,border-radius 140ms ease,box-shadow 140ms ease;')}
        ${rule(pressedShields, 'inset:6px;border-radius:max(0px,calc(var(--ts-glass-radius,16px) - 6px));box-shadow:0 0 4px 4px color-mix(in srgb,var(--ts-e-sheet) 90%,transparent);')}
      }
    }
    @media (prefers-reduced-motion:reduce), (prefers-reduced-transparency:reduce), (prefers-contrast:more), (forced-colors:active), (max-width:760px), (any-pointer:coarse), (hover:none){
      ${rule(optics, solidOptics)}
      ${rule(shields, 'display:none!important;transition:none!important;')}
    }
    @container (max-width:680px){
      ${rule(optics, solidOptics)}
      ${rule(shields, 'display:none!important;transition:none!important;')}
    }
    @supports not ((backdrop-filter:url("#ts-glass-optics")) or (-webkit-backdrop-filter:url("#ts-glass-optics"))){
      ${rule(optics, solidOptics)}
      ${rule(shields, 'display:none!important;transition:none!important;')}
    }`;
  }
  return css;
}
