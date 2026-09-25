import type {Board} from './model';
import {branchState,visibleBranchBoard} from './mindmap';

export interface BranchRenderSnapshot {
 state(board:Board):ReturnType<typeof branchState>;
 visible(board:Board):Board;
}
/** One synchronous render only. Saved, inline and drag geometry stay distinct;
 * the next render must rebuild from current folds, connections and containment. */
export function branchRenderSnapshot():BranchRenderSnapshot {
 const states=new Map<Board,ReturnType<typeof branchState>>(),visibleBoards=new Map<Board,Board>();
 const state=(board:Board)=>{let value=states.get(board);if(!value){value=branchState(board);states.set(board,value);}return value;};
 return{state,visible(board){let value=visibleBoards.get(board);if(!value){value=visibleBranchBoard(board,()=>state(board));visibleBoards.set(board,value);}return value;}};
}
