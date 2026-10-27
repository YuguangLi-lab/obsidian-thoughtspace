export type RecoveryStorage='checkpoint'|'memory'|'unknown';
export interface RecoveryCenterItem {id:string;kind:string;title:string;storage:RecoveryStorage;description:string;read:()=>string|Promise<string>;open?:()=>unknown;}
export const recoveryStorageLabel=(storage:RecoveryStorage)=>storage==='checkpoint'?'已确认落盘检查点':storage==='memory'?'易失会话内存 · 重启会丢失':'状态待核对 · 不作恢复保证';
/** No writes, merging, deletion, lease renewal, or automatic replay belong to this list. */
export function validateRecoveryItems(items:readonly RecoveryCenterItem[]){const ids=new Set<string>();return items.filter(item=>{if(!item.id||ids.has(item.id)||!['checkpoint','memory','unknown'].includes(item.storage)||typeof item.read!=='function')return false;ids.add(item.id);return true;}).slice(0,1000);}
