import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

// Shared historical class names must not style the independent calendar.
// CSS @scope isolates the entire board/modal rule tree in one wrapper instead
// of repeating a 56-byte :not(:where(...)) guard on 7,000+ individual selectors.
export const CALENDAR_SCOPE_PARAMS = '(:root) to (.ts-calendar-plugin)';

const legacyBoundary = ':not(:where(.ts-calendar-plugin, .ts-calendar-plugin *))';
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

function insideCalendarScope(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'atrule' && current.name === 'scope' && current.params === CALENDAR_SCOPE_PARAMS) return true;
    current = current.parent;
  }
  return false;
}

function insideKeyframes(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'atrule' && /keyframes$/i.test(current.name)) return true;
    current = current.parent;
  }
  return false;
}

function isCalendarScope(node) {
  return node?.type === 'atrule' && node.name === 'scope' && node.params === CALENDAR_SCOPE_PARAMS;
}

function mergeAdjacentScopes(container) {
  if (!container.nodes) return;
  for (const child of container.nodes) {
    if (child.type === 'atrule' && !isCalendarScope(child)) {
      mergeAdjacentScopes(child);
    }
  }
  for (let i = 0; i < container.nodes.length; i++) {
    const a = container.nodes[i];
    if (!isCalendarScope(a)) continue;
    let j = i + 1;
    while (j < container.nodes.length && container.nodes[j].type === 'comment') j++;
    const b = container.nodes[j];
    if (isCalendarScope(b)) {
      for (let k = i + 1; k < j; k++) a.append(container.nodes[k].clone());
      a.append(...b.nodes.map(n => n.clone()));
      for (let k = j; k > i; k--) container.nodes[k].remove();
      i--;
    }
  }
}

export function isolateBoardStyles(css) {
  const root = postcss.parse(css);
  const rules = [];
  root.walkRules(rule => {
    if (!insideKeyframes(rule) && !insideCalendarScope(rule)) rules.push(rule);
  });

  for (const rule of rules) {
    if (!rule.parent) continue;
    const selectors = selectorParser().astSync(rule.selector);
    const guarded = [];
    const unguarded = [];

    selectors.each(selector => {
      // Strip any legacy per-selector guard before re-evaluating.
      selector.nodes = selector.nodes.filter(node => node.toString() !== legacyBoundary);
      if (needsCalendarGuard(selector)) guarded.push(selector.toString().trim());
      else unguarded.push(selector.toString().trim());
    });

    if (guarded.length === 0) {
      rule.selector = unguarded.join(',');
      continue;
    }

    if (unguarded.length === 0) {
      const scopeRule = postcss.atRule({ name: 'scope', params: CALENDAR_SCOPE_PARAMS });
      const cleanRule = rule.clone({ selector: guarded.join(',') });
      scopeRule.append(cleanRule);
      rule.replaceWith(scopeRule);
    } else {
      rule.selector = unguarded.join(',');
      const scopeRule = postcss.atRule({ name: 'scope', params: CALENDAR_SCOPE_PARAMS });
      const guardedRule = rule.clone({ selector: guarded.join(',') });
      scopeRule.append(guardedRule);
      rule.after(scopeRule);
    }
  }

  mergeAdjacentScopes(root);
  return root.toString();
}
