/** Narrow untrusted JSON and host extension values before reading their fields. */
export function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
export function isUnknownArray(value:unknown):value is unknown[]{return Array.isArray(value);}
export function isFiniteNumber(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value);}
export function isOneOf<T extends string|number>(value:unknown,values:readonly T[]):value is T{return values.some(candidate=>candidate===value);}
/** ASCII controls are invalid in vault paths and single-line labels. */
export function hasAsciiControl(value:string):boolean{for(let i=0;i<value.length;i++)if(value.charCodeAt(i)<=31)return true;return false;}
