import {isRecord} from './value-guards';

export const brainColorKeys=['background','node','border','text','line'] as const;
export type BrainColorKey=typeof brainColorKeys[number];
/** Optional board-local overrides. An absent key follows the live host theme. */
export type BrainColors=Partial<Record<BrainColorKey,string>>;
export function brainColor(value:unknown):string|undefined {
 if(typeof value!=='string')return;
 const hex=value.trim();
 if(/^#[\da-f]{6}$/i.test(hex))return hex.toLowerCase();
 if(/^#[\da-f]{3}$/i.test(hex))return '#'+[...hex.slice(1)].map(c=>c+c).join('').toLowerCase();
}
/** Ignore unsafe/unknown values without making legacy boards unreadable. */
export function cleanBrainColors(raw:unknown):BrainColors {
 const colors:BrainColors={};if(!isRecord(raw))return colors;
 for(const key of brainColorKeys){const value=brainColor(raw[key]);if(value)colors[key]=value;}
 return colors;
}
export function brainColorsStamp(raw:unknown){return JSON.stringify(cleanBrainColors(raw));}
export function brainContrast(a:string,b:string):number {
 const luminance=(hex:string)=>{const color=brainColor(hex);if(!color)return 0;return [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);};
 const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function brainStateInk(background:string){return brainContrast('#ffffff',background)>brainContrast('#202020',background)?'#ffffff':'#202020';}
