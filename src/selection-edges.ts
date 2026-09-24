import {colors, type Board, type Edge} from './model';
import {branchState} from './mindmap';

export type SelectionEdgeScope = 'internal' | 'connected';
export type SelectionEdgePatch = Partial<Pick<Edge, 'style' | 'direction' | 'dashed' | 'color'>>;

/** Keep this index transaction-local: selection menus can outlive edits and undo. */
function editableEndpoints(board: Board): Set<string> {
  const editable = new Set<string>();
  let hasFolds = false;
  for (const node of board.nodes) {
    if (!node.locked) editable.add(node.id);
    if (node.branchFolded || node.sectionFolded) hasFolds = true;
  }
  // Toolbar refreshes also run during drags. Unfolded boards need no branch
  // adjacency maps; any fold still resolves fresh geometry and descendants.
  if (hasFolds) for (const id of branchState(board).hidden) editable.delete(id);
  return editable;
}

/** O(nodes + edges); internal links are the safe default for a marquee selection. */
export function selectionEdges(board: Board, selectedNodeIds: ReadonlySet<string>, scope: SelectionEdgeScope = 'internal'): Edge[] {
  if (!selectedNodeIds.size) return [];
  const editable = editableEndpoints(board);
  return board.edges.filter(edge => {
    if (edge.from === edge.to || !editable.has(edge.from) || !editable.has(edge.to)) return false;
    const from = selectedNodeIds.has(edge.from), to = selectedNodeIds.has(edge.to);
    return scope === 'connected' ? from || to : from && to;
  });
}

/** Reject malformed controls before touching any edge; extra properties are never copied. */
function validatePatch(patch: SelectionEdgePatch): void {
  if ((patch.style !== undefined && !['curve', 'straight', 'elbow'].includes(patch.style)) ||
      (patch.direction !== undefined && !['forward', 'both', 'none'].includes(patch.direction)) ||
      (patch.dashed !== undefined && typeof patch.dashed !== 'boolean') ||
      (patch.color !== undefined && !colors.includes(patch.color))) {
    throw new Error('连线样式无效');
  }
}

/** Recheck current endpoints on apply. The caller owns a single undo transaction. */
export function patchSelectionEdges(board: Board, edgeIds: ReadonlySet<string>, patch: SelectionEdgePatch): number {
  validatePatch(patch);
  const keys = (['style', 'direction', 'dashed', 'color'] as const).filter(key => Object.hasOwn(patch, key));
  if (!edgeIds.size || !keys.length) return 0;
  const editable = editableEndpoints(board);
  let changed = 0;
  for (const edge of board.edges) {
    if (!edgeIds.has(edge.id) || edge.from === edge.to || !editable.has(edge.from) || !editable.has(edge.to)) continue;
    let touched = false;
    for (const key of keys) {
      if (patch[key] === undefined) {
        if (Object.hasOwn(edge, key)) { delete edge[key]; touched = true; }
      } else if (edge[key] !== patch[key]) {
        // Assign explicitly so each optional field retains its own union type.
        if (key === 'style') edge.style = patch.style;
        else if (key === 'direction') edge.direction = patch.direction;
        else if (key === 'dashed') edge.dashed = patch.dashed;
        else edge.color = patch.color;
        touched = true;
      }
    }
    if (touched) changed++;
  }
  if (changed) board.version = 3;
  return changed;
}
