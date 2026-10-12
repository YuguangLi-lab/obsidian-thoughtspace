import {isRecord,isFiniteNumber} from './value-guards';

/** Shared preset names and pigments for the board, settings and visual previews. */
export const paperPresets={
 cream:{name:'米黄纸',color:'#f3e9d4'},
 white:{name:'纯白纸',color:'#ffffff'},
 ivory:{name:'象牙白',color:'#f7f2e7'},
 kraft:{name:'牛皮纸',color:'#d6ba8f'},
 recycled:{name:'再生纸',color:'#dedbd1'},
 custom:{name:'自定义',color:'#f3e9d4'},
} as const;
export interface PaperPreferences {paperPreset:keyof typeof paperPresets;paperColor:string;paperTexture:number}
export const defaultPaperPreferences:PaperPreferences={paperPreset:'cream',paperColor:'#f3e9d4',paperTexture:55};
/** Never pass persisted colors or arbitrary properties straight to CSS. */
export function cleanPaperPreferences(raw:unknown):PaperPreferences{
 const saved=isRecord(raw)?raw:{};
 return{
  paperPreset:typeof saved.paperPreset==='string'&&Object.hasOwn(paperPresets,saved.paperPreset)?saved.paperPreset as PaperPreferences['paperPreset']:defaultPaperPreferences.paperPreset,
  paperColor:typeof saved.paperColor==='string'&&/^#[0-9a-fA-F]{6}$/.test(saved.paperColor)?saved.paperColor.toLowerCase():defaultPaperPreferences.paperColor,
  paperTexture:isFiniteNumber(saved.paperTexture)?Math.max(0,Math.min(100,saved.paperTexture)):defaultPaperPreferences.paperTexture,
 };
}
export function paperBaseColor(prefs:PaperPreferences):string{const clean=cleanPaperPreferences(prefs);return clean.paperPreset==='custom'?clean.paperColor:paperPresets[clean.paperPreset].color;}
/** Include the remembered custom pigment so stale saves never overwrite another window. */
export function paperAppearanceStamp(prefs:PaperPreferences):string{const clean=cleanPaperPreferences(prefs);return `${clean.paperPreset}:${clean.paperColor}:${clean.paperTexture}`;}
