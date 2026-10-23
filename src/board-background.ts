import {cleanBackgroundImagePreferences,type BackgroundImagePreferences} from './background-image';
import {cleanPaperPreferences,type PaperPreferences} from './paper-appearance';
import {isRecord,isOneOf} from './value-guards';

export type CanvasBackground='dots'|'grid'|'plain'|'paper'|'image';
export const backgroundOptions=[['dots','点阵','circle-dot'],['grid','网格','grid'],['plain','纯色','square'],['paper','纸张纹理','file-text'],['image','背景图片','image']] as const;
/** Uses the existing preferences and native dialogs. An optional board override
 * follows the board through conversion, history and reopening; old boards inherit. */
export interface BoardBackground extends PaperPreferences,BackgroundImagePreferences {canvasBackground:CanvasBackground}
export function cleanBoardBackground(raw:unknown):BoardBackground {
 return {canvasBackground:isRecord(raw)&&isOneOf(raw.canvasBackground,['dots','grid','plain','paper','image'])?raw.canvasBackground:'dots',...cleanPaperPreferences(raw),...cleanBackgroundImagePreferences(raw)};
}
export function boardBackground(board:{background?:BoardBackground}|undefined,defaults:unknown){return cleanBoardBackground(board?.background??defaults);}
