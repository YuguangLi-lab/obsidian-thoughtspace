import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

// Shared historical class names must not style the independent calendar.
// Apply the boundary to the subject, including descendants and pseudo-elements.
const boundary = ':not(:where(.ts-calendar-plugin, .ts-calendar-plugin *))';
export function isolateBoardStyles(css) {
  const root = postcss.parse(css);
  root.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    const selectors = selectorParser().astSync(rule.selector);
    selectors.each(selector => {
      let owned = false;
      selector.walkClasses(node => { if (node.value.startsWith('ts-')) owned = true; });
      if (!owned || selector.nodes.some(node => node.toString() === boundary)) return;
      const guard = selectorParser().astSync(boundary).first.first.clone();
      const pseudoElement = selector.nodes.find(node => node.type === 'pseudo' && (node.value.startsWith('::') || [':before', ':after', ':first-line', ':first-letter'].includes(node.value)));
      if (pseudoElement) selector.insertBefore(pseudoElement, guard);
      else selector.append(guard);
    });
    rule.selector = selectors.toString();
  });
  return root.toString();
}
