import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

// Shared historical class names must not style the independent calendar.
// Apply the boundary to the subject, including descendants and pseudo-elements.
const boundary = ':not(:where(.ts-calendar-plugin, .ts-calendar-plugin *))';
// The calendar plugin renders inside a note preview (.ts-root) and also uses
// .ts-journal and .ts-ui-modal on its own surfaces. Selectors that require a
// sealed ThoughtSpace surface, and none of those leaky ancestors, cannot reach it.
const leaky = new Set(['ts-root', 'ts-journal', 'ts-ui-modal', 'ts-card-preview', 'ts-node', 'ts-world', 'ts-stage', 'ts-main']);
const sealed = new Set([
  'ts-writing', 'ts-handwriting', 'ts-brain-shell', 'ts-brain-stage', 'ts-brain',
  'ts-collection', 'ts-collection-content', 'ts-media-workspace', 'ts-online-workspace',
  'ts-materials-panel', 'ts-materials-modal', 'ts-local-relations', 'ts-settings',
  'ts-space-modal', 'ts-space-hub', 'ts-note-markdown-toolbar', 'ts-native-header',
  'ts-reading-desk', 'ts-layout-planner', 'ts-mindmap-studio', 'ts-database', 'ts-yingjian',
]);
function needsCalendarGuard(selector) {
  let owned = false, hasSealed = false, hasLeaky = false;
  selector.walkClasses(node => {
    if (!node.value.startsWith('ts-')) return;
    owned = true;
    if (sealed.has(node.value)) hasSealed = true;
    if (leaky.has(node.value)) hasLeaky = true;
  });
  return owned && !(hasSealed && !hasLeaky);
}
export function isolateBoardStyles(css) {
  const root = postcss.parse(css);
  root.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    const selectors = selectorParser().astSync(rule.selector);
    selectors.each(selector => {
      if (!needsCalendarGuard(selector) || selector.nodes.some(node => node.toString() === boundary)) return;
      const guard = selectorParser().astSync(boundary).first.first.clone();
      const pseudoElement = selector.nodes.find(node => node.type === 'pseudo' && (node.value.startsWith('::') || [':before', ':after', ':first-line', ':first-letter'].includes(node.value)));
      if (pseudoElement) selector.insertBefore(pseudoElement, guard);
      else selector.append(guard);
    });
    rule.selector = selectors.toString();
  });
  return root.toString();
}
