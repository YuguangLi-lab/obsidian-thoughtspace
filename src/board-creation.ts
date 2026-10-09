import {isOneOf,isRecord} from './value-guards';

export type BoardCreationFormat='legacy'|'markdown';
export type BoardCreationPresentation='board'|'brain';
export interface BoardCreationPreferences {presentation:BoardCreationPresentation;format:BoardCreationFormat;}
/** Creation preferences affect new documents only; existing sources keep their codec. */
export function cleanBoardCreationPreferences(raw:unknown):BoardCreationPreferences {
 const value=isRecord(raw)?raw:{};
 return {presentation:isOneOf(value.presentation,['board','brain'])?value.presentation:'board',format:isOneOf(value.format,['legacy','markdown'])?value.format:'legacy'};
}

/** A multi-file template cannot be restarted blindly after a partial write. */
export class TemplateCreationIncompleteError extends Error {
 constructor(cause:unknown,readonly createdPaths:string[]){
  super(`${cause instanceof Error?cause.message:String(cause)}\n模板创建已停止。以下已创建文件保留，请先检查，再从新建入口开始新的请求：\n${createdPaths.join('\n')}`);
  this.name='TemplateCreationIncompleteError';
 }
}
