/** Share only in-flight work. Closed pages and failed opens are never cached. */
export class SharedOpen<K,V>{
 private pending=new Map<K,Promise<V>>();
 run(key:K,open:()=>Promise<V>):Promise<V>{const existing=this.pending.get(key);if(existing)return existing;const work=Promise.resolve().then(open).finally(()=>{if(this.pending.get(key)===work)this.pending.delete(key)});this.pending.set(key,work);return work;}
}
