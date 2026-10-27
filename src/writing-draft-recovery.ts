export interface WritingRecovery {id:string;name:string;text:string}
const recoveries=new WeakMap<object,Map<object,WritingRecovery[]>>();

/** These copies exist only in process memory, not durable storage. A restart or
 * forced exit loses them. Reopening never overwrites
 * a manuscript that another window has changed. Each window keeps its snapshot. */
export function rememberWritingRecovery(host:object,source:object,name:string,text:string):WritingRecovery {
 let files=recoveries.get(host);if(!files){files=new Map();recoveries.set(host,files);}
 let entries=files.get(source);if(!entries){entries=[];files.set(source,entries);}
 const same=entries.find(entry=>entry.text===text&&entry.name===name);if(same)return same;
 const entry={id:crypto.randomUUID(),name,text};entries.push(entry);return entry;
}
export function writingRecoveryEntries(host:object,source:object):readonly WritingRecovery[]{return [...recoveries.get(host)?.get(source)||[]];}
export function discardWritingRecovery(host:object,source:object,id:string):void {
 const files=recoveries.get(host),entries=files?.get(source);if(!entries)return;
 const retained=entries.filter(entry=>entry.id!==id);if(retained.length)files!.set(source,retained);else files!.delete(source);
}

/** Read-only enumeration for the recovery center; these are still volatile process memory. */
export function allWritingRecoveryEntries(host:object){return [...(recoveries.get(host)?.entries()||[])].flatMap(([source,entries])=>entries.map(entry=>({source,entry:{...entry}})));}
