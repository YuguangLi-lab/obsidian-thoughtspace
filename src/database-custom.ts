import {DatabaseFilter,propertyKeys,dateValid} from './database';
export type CustomType='text'|'number'|'date'|'checkbox'|'list';
export interface CustomField{key:string;type:CustomType}
export interface CustomCondition{key:string;op:'eq'|'contains'|'gte'|'lte'|'empty';value:string}
export interface SavedDatabaseView{id:string;name:string;source:'cards'|'vault'|'board';boardPath?:string;layout:'table'|'kanban';filter:DatabaseFilter;conditions:CustomCondition[]}
export interface DatabasePreferences{fields:CustomField[];views:SavedDatabaseView[]}
export function validCustomKey(key:unknown):key is string{return typeof key==='string'&&!!key.trim()&&key===key.trim()&&key.length<=80&&!/[\r\n.]/.test(key)&&!['__proto__','constructor','prototype','tags','aliases','cssclasses',...Object.values(propertyKeys)].includes(key);}
export function customValue(field:CustomField,value:string|boolean){
 if(!validCustomKey(field.key))throw Error('属性名称无效或属于已有内置属性');
 if(field.type==='checkbox'){if(typeof value!=='boolean')throw Error('复选框须为布尔值');return value;}
 if(typeof value!=='string')throw Error('属性值无效');if(!value.trim())return undefined;
 if(field.type==='number'){if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())||!Number.isFinite(Number(value)))throw Error('请输入有效数字');return Number(value);}
 if(field.type==='date'){if(!dateValid(value))throw Error('请输入有效日期');return value;}
 if(field.type==='list')return [...new Set(value.split(/[,，\n]/).map(s=>s.trim()).filter(Boolean))];return value;
}
export function customMatches(fm:Record<string,unknown>,conditions:CustomCondition[],fields:CustomField[]){return conditions.every(c=>{try{
 const field=fields.find(f=>f.key===c.key);if(!field)return false;const value=fm[c.key];if(c.op==='empty')return value==null||value===''||Array.isArray(value)&&!value.length;
 if(c.op==='contains')return Array.isArray(value)?value.some(v=>String(v)===c.value):typeof value==='string'&&value.includes(c.value);
 const expected=field.type==='checkbox'?c.value==='true':customValue(field,c.value);if(c.op==='eq')return JSON.stringify(value)===JSON.stringify(expected);
 if(value==null||expected==null)return false;if(field.type==='number'&&typeof value==='number'&&typeof expected==='number')return c.op==='gte'?value>=expected:value<=expected;
 if(field.type==='date'&&typeof value==='string'&&typeof expected==='string'&&dateValid(value))return c.op==='gte'?value>=expected:value<=expected;return false;
 }catch{return false;} });}
export function cleanDatabasePreferences(value:unknown):DatabasePreferences{
 const raw=value as Partial<DatabasePreferences>|undefined,fields:CustomField[]=[],views:SavedDatabaseView[]=[];
 for(const f of Array.isArray(raw?.fields)?raw.fields:[])if(f&&validCustomKey(f.key)&&['text','number','date','checkbox','list'].includes(f.type)&&!fields.some(e=>e.key===f.key)&&fields.length<30)fields.push({key:f.key,type:f.type});
 for(const v of Array.isArray(raw?.views)?raw.views:[])if(v&&typeof v.id==='string'&&typeof v.name==='string'&&v.name.trim()&&['cards','vault','board'].includes(v.source)&&['table','kanban'].includes(v.layout)&&v.filter&&typeof v.filter.query==='string'&&['updated','title','due','priority'].includes(v.filter.sort)&&Array.isArray(v.conditions)&&views.length<50)views.push({...v,conditions:v.conditions.filter(c=>c&&fields.some(f=>f.key===c.key)&&['eq','contains','gte','lte','empty'].includes(c.op)&&typeof c.value==='string').slice(0,20)});
 return {fields,views};
}
/** Bases and UI share typed operands. Bracket notation preserves native property names. */
export function conditionExpression(c:CustomCondition,fields:CustomField[]){const f=fields.find(f=>f.key===c.key);if(!f)throw Error('筛选字段已移除');const key=`note[${JSON.stringify(c.key)}]`;if(c.op==='empty')return `(${key} == null || ${key} == "" || ${key} == [])`;
 if(c.op==='contains')return `${key}.contains(${JSON.stringify(c.value)})`;
 const value=f.type==='checkbox'?c.value==='true':customValue(f,c.value);if(value===undefined)throw Error('请填写筛选值');
 if(f.type==='date')return `date(${key}) ${c.op==='eq'?'==':c.op==='gte'?'>=':'<='} date(${JSON.stringify(value)})`;
 return `${key} ${c.op==='eq'?'==':c.op==='gte'?'>=':'<='} ${JSON.stringify(value)}`;
}
export function databaseBase(view:SavedDatabaseView,fields:CustomField[],folder:string,boardPaths:readonly string[]=[]){
 const f=view.filter,filters:string[]=['file.ext == "md"'];
 if(view.source==='cards')filters.push(`file.inFolder(${JSON.stringify(folder)})`);
 if(view.source==='board')filters.push(boardPaths.length?'('+boardPaths.map(p=>`file.path == ${JSON.stringify(p)}`).join(' || ')+')':'false');
 if(f.query)filters.push(`(file.name.lower().contains(${JSON.stringify(f.query.toLocaleLowerCase())}) || file.path.lower().contains(${JSON.stringify(f.query.toLocaleLowerCase())}) || file.tags.toString().lower().contains(${JSON.stringify(f.query.toLocaleLowerCase())}))`);
 if(f.tag)filters.push(`file.hasTag(${JSON.stringify(f.tag.replace(/^#/,''))})`);
 if(f.status)filters.push(f.status==='inbox'?`(!${propertyKeys.status} || ${propertyKeys.status} == "inbox")`:`${propertyKeys.status} == ${JSON.stringify(f.status)}`);
 if(f.priority)filters.push(`${propertyKeys.priority} == ${JSON.stringify(f.priority)}`);
 if(f.overdue)filters.push(`(${propertyKeys.status} != "done" && ${propertyKeys.due} && date(${propertyKeys.due}) < today())`);
 filters.push(...view.conditions.map(c=>conditionExpression(c,fields)));
 const order=['file.name',...Object.values(propertyKeys).map(k=>'note.'+k),...fields.map(f=>'note.'+f.key)];
 const sort=[{property:f.sort==='updated'?'file.mtime':f.sort==='title'?'file.name':f.sort==='due'?'note.'+propertyKeys.due:'formula.thoughtspace_priority_order',direction:f.sort==='updated'?'DESC':'ASC'}];
 return {filters:{and:filters},properties:Object.fromEntries([['note.'+propertyKeys.status,{displayName:'状态'}],['note.'+propertyKeys.priority,{displayName:'优先级'}],['note.'+propertyKeys.due,{displayName:'截止日期'}]]),formulas:{thoughtspace_priority_order:`if(${propertyKeys.priority} == "high", 0, if(${propertyKeys.priority} == "medium", 1, if(${propertyKeys.priority} == "low", 2, 3)))`},views:[{type:'table',name:view.name,order,sort},{type:'cards',name:view.name+' · 卡片',order,sort}]};
}
