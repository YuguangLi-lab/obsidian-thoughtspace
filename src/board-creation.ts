import {isOneOf,isRecord} from './value-guards';

export type BoardCreationFormat='legacy'|'markdown';
export type BoardCreationPresentation='board'|'brain';
export interface BoardCreationPreferences {presentation:BoardCreationPresentation;format:BoardCreationFormat;}
/** Creation preferences affect new documents only; existing sources keep their codec. */
export function cleanBoardCreationPreferences(raw:unknown):BoardCreationPreferences {
 const value=isRecord(raw)?raw:{};
 return {presentation:isOneOf(value.presentation,['board','brain'])?value.presentation:'board',format:isOneOf(value.format,['legacy','markdown'])?value.format:'legacy'};
}
