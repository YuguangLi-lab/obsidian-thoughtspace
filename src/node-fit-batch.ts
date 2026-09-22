import {Card} from './model';
export interface NodeFit {width:number;height:number;key:string;}
/** Decide against live nodes before cloning, persisting or notifying any view. */
export function nodeFitChanges(nodes:readonly Card[],fits:ReadonlyMap<string,NodeFit>,keys:ReadonlyMap<string,string>,editing:ReadonlySet<string>){
 const changes=new Map<string,{width:number;height:number}>();
 for(const n of nodes){const s=fits.get(n.id);
  if(!s||editing.has(n.id)||n.locked||n.collapsed||keys.get(n.id)!==s.key)continue;
  if(n.kind!=='image'&&n.kind!=='pdf'&&(n.kind==='text'?n.autoSize===false:n.kind!=='card'||!n.autoFit))continue;
  if(!Number.isFinite(s.width)||!Number.isFinite(s.height)||s.width<=0||s.height<=0)continue;
  if(Math.abs(s.width-n.width)<1&&Math.abs(s.height-n.height)<1)continue;
  changes.set(n.id,{width:s.width,height:s.height});
 }
 return changes;
}
