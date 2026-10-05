import {emptyBoard,type Board} from './model';
import {createBoardMindmapState,validBoardMindmapState,type BoardMindmapState} from './board-mindmap';

/** A full-canvas presentation of existing board objects and relationships. */
export type BrainBoard=Board&{version:3;presentation:'brain';brain:BoardMindmapState};

/** Creation is explicit; no legacy mode or embedded container implies this presentation. */
export function createBrainBoard(centerId?:string):BrainBoard {
 return{...emptyBoard(),version:3,presentation:'brain',brain:createBoardMindmapState(centerId)};
}

export function isBrainBoard(board:Board|null|undefined):board is BrainBoard {
 return board?.presentation==='brain'&&board.version===3&&validBoardMindmapState(board.brain);
}
