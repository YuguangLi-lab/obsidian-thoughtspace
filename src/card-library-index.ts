import type {LibraryBoardSource} from './card-property-views';

const maxConcurrentReads=4;

/** Share a small I/O limit across scans. Cancelling a scan frees its slots at once so the next open can read; a read already in flight may finish, and its result is discarded. */
export function createLibraryBoardReader<T>(read:(file:T)=>Promise<LibraryBoardSource>){
 const active=new Set<Promise<void>>();
 const gates:{live:()=>boolean;drop:()=>void}[]=[];
 const reap=()=>{for(const gate of gates)if(!gate.live())gate.drop();};
 return async (files:readonly T[],current:()=>boolean)=>{
  const sources=new Array<LibraryBoardSource|undefined>(files.length);
  let next=0,cancelled=false;
  const live=()=>{
   if(!cancelled&&!current())cancelled=true;
   return !cancelled;
  };
  const worker=async()=>{
   while(next<files.length&&live()){
    reap();
    if(active.size>=maxConcurrentReads){await Promise.race(active);continue;}
    const index=next++;
    let finish!:()=>void;
    const slot=new Promise<void>(resolve=>{finish=resolve;});
    let dropped=false;
    const release=()=>{if(dropped)return;dropped=true;active.delete(slot);finish();};
    const gate={live,drop:release};
    gates.push(gate);
    active.add(slot);
    const task=(async()=>{
     await Promise.resolve();
     try{
      if(!live())return;
      const source=await read(files[index]);
      if(live())sources[index]=source;
     }catch{/* Keep unreadable boards available for a later retry. */}
     finally{
      release();
      const at=gates.indexOf(gate);
      if(at>=0)gates.splice(at,1);
     }
    })();
    await Promise.race([slot,task]);
   }
  };
  await Promise.all(Array.from({length:Math.min(maxConcurrentReads,files.length)},worker));
  if(!live())return undefined;
  const boards:LibraryBoardSource[]=[],failed:T[]=[];
  // Completion order depends on the adapter. Keep the original index order.
  for(const [index,file] of files.entries()){
   const source=sources[index];
   if(source)boards.push(source);else failed.push(file);
  }
  return {boards,failed};
 };
}
