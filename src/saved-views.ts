import {Board,clone} from './model';

export type SavedView=NonNullable<Board['savedViews']>[number];
export function savedViewStamp(view:SavedView){return JSON.stringify(view);}
export function savedViewOrderStamp(board:Board){return JSON.stringify((board.savedViews||[]).map(view=>view.id));}
function title(name:string){const value=name.trim();if(!value||value.length>100)throw Error('视角名称需要 1–100 个字符');return value;}
function camera(viewport:Board['viewport']){if(![viewport.x,viewport.y,viewport.zoom].every(Number.isFinite)||viewport.zoom<.15||viewport.zoom>2.5)throw Error('当前视角无效，请调整缩放后重试');return clone(viewport);}
function current(board:Board,id:string,expected?:string){const view=board.savedViews?.find(v=>v.id===id);if(!view)throw Error('视角已移除，请刷新列表');if(expected!==undefined&&savedViewStamp(view)!==expected)throw Error('视角已变化，请刷新后重试');return view;}
/** Resolve the reviewed camera without touching the live board or its history. */
export function savedViewViewport(board:Board,id:string,expected?:string){return camera(current(board,id,expected).viewport);}
export function addSavedView(board:Board,id:string,name:string){
 const value=title(name),viewport=camera(board.viewport);if(!id||board.savedViews?.some(v=>v.id===id))throw Error('视角标识冲突，请重试');
 if((board.savedViews?.length||0)>=50)throw Error('最多保存 50 个视角，请先移除旧视角');
 board.version=3;(board.savedViews||=[]).push({id,name:value,viewport});
}
export function renameSavedView(board:Board,id:string,name:string,expected?:string){const value=title(name);current(board,id,expected).name=value;}
export function updateSavedView(board:Board,id:string,viewport:Board['viewport'],expected?:string){const value=camera(viewport);current(board,id,expected).viewport=value;}
export function removeSavedView(board:Board,id:string,expected?:string){current(board,id,expected);board.savedViews=board.savedViews!.filter(v=>v.id!==id);}
export function reorderSavedView(board:Board,id:string,direction:-1|1,expectedOrder?:string){
 if(expectedOrder!==undefined&&savedViewOrderStamp(board)!==expectedOrder)throw Error('视角顺序已变化，请刷新列表后重试');
 current(board,id);const views=board.savedViews!,index=views.findIndex(v=>v.id===id),next=index+direction;
 if(next>=0&&next<views.length)[views[index],views[next]]=[views[next],views[index]];
}
