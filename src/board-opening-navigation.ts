import type {WorkspaceLeaf} from 'obsidian';

/** Own only the leaf allocated/reused by this open request. acquire wraps the
 * synchronous getLeaf activation so callers can distinguish it from user
 * navigation; target runs before deferred loading or any leaf awaits. */
export interface BoardOpenNavigation {
 /** Convenience navigation keeps its origin alive and opens only in that
  * document. Other callers retain the workspace's default routing. */
 scope?:{document:Document;origin:WorkspaceLeaf};
 acquire:(create:()=>WorkspaceLeaf)=>WorkspaceLeaf;
 target:(leaf:WorkspaceLeaf)=>void;
 /** Optional disposal lease when another request can reuse the same empty tab.
  * Called only while the opener's original empty view and state still match. */
 ownsPlaceholder?:(leaf:WorkspaceLeaf)=>boolean;
}
