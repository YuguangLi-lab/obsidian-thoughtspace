import {isRecord,isUnknownArray} from './value-guards';

/** One extra select, stored as a normal Obsidian property. Not a per-tag schema. */
export const choiceKey='thoughtspace_choice';
export const defaultChoiceOptions=['主张','证据','问题'] as const;
export interface ChoiceField {options:string[]}
export function cleanChoiceField(value:unknown):ChoiceField{
 const raw=isRecord(value)?value:{};
 const options:string[]=[];
 for(const item of isUnknownArray(raw.options)?raw.options:[]){
  if(typeof item!=='string')continue;
  const text=item.trim();
  if(!text||text.length>40||options.includes(text)||options.length>=12)continue;
  options.push(text);
 }
 return {options:options.length?options:[...defaultChoiceOptions]};
}
function choiceText(value:unknown):string{
 if(typeof value==='string')return value;
 if(typeof value==='number'&&Number.isFinite(value))return String(value);
 if(typeof value==='boolean')return value?'true':'false';
 return '';
}
/** Obsidian may parse an unquoted option as a number or boolean. Match the option text. */
export function choiceValue(properties:Record<string,unknown>,field:ChoiceField):string{
 const text=choiceText(properties[choiceKey]);
 return text&&field.options.includes(text)?text:'';
}
