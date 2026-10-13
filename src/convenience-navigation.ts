/** A navigation lease can accept only the current location or an explicitly
 * declared transition. Once a different location is observed it never revives. */
export class ConvenienceNavigationLease {
 private stopped=false;private accepting:(()=>boolean);private watchers=new Set<()=>void>();
 constructor(initial:()=>boolean,private readonly cleanup:()=>void=()=>{}){this.accepting=initial;}
 current(){if(!this.stopped&&!this.accepting())this.stop();return !this.stopped;}
 observe(){this.current();}
 bind(location:()=>boolean){if(this.stopped)throw Error('页面已变化，跳转已取消');this.accepting=location;this.observe();}
 watch(invalidate:()=>void){if(this.stopped)invalidate();else this.watchers.add(invalidate);return()=>{this.watchers.delete(invalidate);};}
 stop(){if(this.stopped)return;this.stopped=true;this.cleanup();for(const invalidate of this.watchers)invalidate();this.watchers.clear();}
}
