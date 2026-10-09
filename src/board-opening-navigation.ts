import type {WorkspaceLeaf} from 'obsidian';

/** Own only the leaf allocated/reused by this open request. acquire wraps the
 * synchronous getLeaf activation so callers can distinguish it from user
 * navigation; target runs before deferred loading or any leaf awaits. */
export interface BoardOpenNavigation {
 acquire:(create:()=>WorkspaceLeaf)=>WorkspaceLeaf;
 target:(leaf:WorkspaceLeaf)=>void;
}
