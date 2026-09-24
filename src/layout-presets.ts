import {LayoutOptions,layoutModes,sectionLayoutModes} from './layout-planner';
import {uid} from './model';
import {isRecord,isUnknownArray,hasAsciiControl} from './value-guards';

export interface LayoutPreset {id:string;name:string;options:LayoutOptions}
export const MAX_LAYOUT_PRESETS=20;
/** Persist only layout choices; never selections, board IDs, geometry or focus state. */
export function cleanLayoutOptions(raw:unknown):LayoutOptions|undefined{
 if(!isRecord(raw)||typeof raw.mode!=='string'||!Object.hasOwn(layoutModes,raw.mode)||!Number.isInteger(raw.columns)||typeof raw.columns!=='number'||raw.columns<1||raw.columns>12||typeof raw.gap!=='number'||!Number.isFinite(raw.gap)||raw.gap<8||raw.gap>240||(raw.sort!=='position'&&raw.sort!=='title')||(raw.anchor!=='corner'&&raw.anchor!=='center'))return;
 const mode=raw.mode as LayoutOptions['mode'];
 return{mode,columns:raw.columns,gap:raw.gap,sort:raw.sort as LayoutOptions['sort'],anchor:raw.anchor as LayoutOptions['anchor'],...(raw.createSections===true&&sectionLayoutModes.has(mode)?{createSections:true}:{})};
}
export function cleanLayoutPresets(raw:unknown):LayoutPreset[]{
 if(!isUnknownArray(raw))return[];const result:LayoutPreset[]=[],ids=new Set<string>(),names=new Set<string>();
 for(const item of raw){if(result.length>=MAX_LAYOUT_PRESETS)break;if(!isRecord(item)||typeof item.id!=='string'||!item.id.trim()||item.id.length>100||hasAsciiControl(item.id)||ids.has(item.id)||typeof item.name!=='string')continue;const name=item.name.trim(),options=cleanLayoutOptions(item.options);if(!name||name.length>60||hasAsciiControl(name)||names.has(name)||!options)continue;result.push({id:item.id,name,options});ids.add(item.id);names.add(name);}
 return result;
}
function presetName(items:LayoutPreset[],name:string,id?:string){name=name.trim();if(!name||name.length>60||hasAsciiControl(name))throw Error('布局预设名称需要 1–60 个字符');if(items.some(p=>p.id!==id&&p.name===name))throw Error('布局预设名称已存在');return name;}
/** Omitting id creates a new preset; passing id replaces only that existing preset. */
export function saveLayoutPreset(presets:readonly LayoutPreset[],name:string,options:LayoutOptions,id?:string):LayoutPreset[]{
 const items=cleanLayoutPresets(presets),clean=cleanLayoutOptions(options);if(!clean)throw Error('请先设置有效的排列参数');name=presetName(items,name,id);
 if(id){const at=items.findIndex(p=>p.id===id);if(at<0)throw Error('布局预设已删除，请重新选择');items[at]={id,name,options:clean};}
 else{if(items.length>=MAX_LAYOUT_PRESETS)throw Error('最多保存 20 个布局预设，请先删除旧预设');items.push({id:uid(),name,options:clean});}return items;
}
export function renameLayoutPreset(presets:readonly LayoutPreset[],id:string,name:string):LayoutPreset[]{const items=cleanLayoutPresets(presets),target=items.find(p=>p.id===id);if(!target)throw Error('布局预设已删除，请重新选择');target.name=presetName(items,name,id);return items;}
export function removeLayoutPreset(presets:readonly LayoutPreset[],id:string):LayoutPreset[]{return cleanLayoutPresets(presets).filter(p=>p.id!==id);}
