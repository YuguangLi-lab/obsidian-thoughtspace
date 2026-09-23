export interface RefreshClock {frame:(run:()=>void)=>number;cancelFrame:(id:number)=>void;later:(run:()=>void,ms:number)=>number;cancelLater:(id:number)=>void;}
/** rAF keeps typing smooth; a timer also services occluded or background windows. */
export class LayoutRefreshQueue {
 private frame?:number;private timer?:number;private generation=0;private pending=false;
 constructor(private refresh:()=>void,private clock:RefreshClock={frame:run=>window.requestAnimationFrame(run),cancelFrame:id=>window.cancelAnimationFrame(id),later:(run,ms)=>window.setTimeout(run,ms),cancelLater:id=>window.clearTimeout(id)}){}
 schedule(){if(this.pending)return;this.pending=true;const generation=this.generation;const run=()=>{if(!this.pending||generation!==this.generation)return;this.cancel();this.refresh();};this.frame=this.clock.frame(run);this.timer=this.clock.later(run,120);}
 flush(){if(this.pending){this.cancel();this.refresh();}}
 cancel(){this.generation++;this.pending=false;if(this.frame!==undefined)this.clock.cancelFrame(this.frame);if(this.timer!==undefined)this.clock.cancelLater(this.timer);this.frame=this.timer=undefined;}
}
