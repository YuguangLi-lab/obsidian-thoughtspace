import {parseBoard} from './model';
import {isRecord} from './value-guards';

export function parseLayoutSnapshot(text:string) {
 const value:unknown=JSON.parse(text);
 if(!isRecord(value)||!isRecord(value.board))throw Error('布局快照格式无效');
 return {label:typeof value.label==='string'&&value.label?value.label:'布局快照',
  createdAt:typeof value.createdAt==='string'?value.createdAt:'',board:parseBoard(JSON.stringify(value.board))};
}
