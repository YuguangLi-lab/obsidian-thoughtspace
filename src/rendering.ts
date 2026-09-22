import type { Board, Card } from './model';
export interface Rect {x:number;y:number;width:number;height:number}
export const intersects=(a:Rect,b:Rect)=>a.x<=b.x+b.width&&a.x+a.width>=b.x&&a.y<=b.y+b.height&&a.y+a.height>=b.y;
export function viewportRect(v:Board['viewport'],width:number,height:number,padding=180):Rect {
 return {x:(-v.x-padding)/v.zoom,y:(-v.y-padding)/v.zoom,width:(width+padding*2)/v.zoom,height:(height+padding*2)/v.zoom};
}
/** Only visible cards own DOM/render components. Low zoom uses lightweight titles. */
export function visibleNodes(nodes:Card[],rect:Rect){return nodes.filter(n=>intersects(n,rect));}
export function edgeBounds(a:Card,b:Card):Rect {const x=Math.min(a.x,b.x)-240,y=Math.min(a.y,b.y)-240;return{x,y,width:Math.max(a.x+a.width,b.x+b.width)+240-x,height:Math.max(a.y+a.height,b.y+b.height)+240-y};}
/** Bound preview work at block boundaries; close a clipped fence so following UI stays valid. */
export function markdownPreview(raw:string,limit=16000):string {
 const text=raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'');if(text.length<=limit)return text;
 let prefix=text.slice(0,limit);if(/[\uD800-\uDBFF]$/.test(prefix))prefix=prefix.slice(0,-1);
 const lines=prefix.split('\n');let fence='';for(const l of lines){const m=l.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);if(m){if(!fence){if(m[1][0]!=='`'||!m[2].includes('`'))fence=m[1];}else if(m[1][0]===fence[0]&&m[1].length>=fence.length&&!m[2].trim())fence='';}}
 return lines.join('\n')+(fence?'\n'+fence:'')+'\n\n… 双击打开完整笔记';
}
/** At most four renderers in flight, dropping detached jobs before file I/O. */
export class RenderQueue {
 private jobs:{alive:()=>boolean;run:()=>Promise<void>}[]=[];private head=0;private pruneAt=32;active=0;
 constructor(private limit=4){}
 add(alive:()=>boolean,run:()=>Promise<void>){
  if(!alive())return;
  // Amortized pruning bounds detached backlog without O(n²) scans during a burst.
  if(this.pending>=this.pruneAt){this.jobs=this.jobs.slice(this.head).filter(j=>j.alive());this.head=0;this.pruneAt=Math.max(32,this.jobs.length*2);}
  this.jobs.push({alive,run});this.drain();
 }
 clear(){this.jobs=[];this.head=0;this.pruneAt=32;}
 get pending(){return this.jobs.length-this.head;}
 private compact(){if(!this.pending)this.clear();else if(this.head>=64&&this.head*2>=this.jobs.length){this.jobs=this.jobs.slice(this.head);this.head=0;this.pruneAt=Math.max(32,this.pending*2);}}
 private drain(){
  while(this.active<this.limit&&this.pending){const j=this.jobs[this.head++];if(!j.alive())continue;this.active++;let task:Promise<void>;
   try{task=j.run();}catch{this.active--;continue;}
   void Promise.resolve(task).catch(()=>{}).finally(()=>{this.active--;this.drain();});
  }
  this.compact();
 }
}
