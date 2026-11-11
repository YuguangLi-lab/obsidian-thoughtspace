import type {LibraryBoardSource} from './card-property-views';

const maxConcurrentReads=4;

/** Share a small I/O limit across scans, including reads still draining after a modal closes. */
export function createLibraryBoardReader<T>(read:(file:T)=>Promise<LibraryBoardSource>){
 const active=new Set<Promise<void>>();
 return async (files:readonly T[],current:()=>boolean)=>{
  const sources=new Array<LibraryBoardSource|undefined>(files.length);
  let next=0,cancelled=false;
  const live=()=>{
   if(!cancelled&&!current())cancelled=true;
   return !cancelled;
  };
  const worker=async()=>{
   while(next<files.length&&live()){
    if(active.size>=maxConcurrentReads){await Promise.race(active);continue;}
    const index=next++;
    const task=Promise.resolve().then(async()=>{
     if(!live())return;
     try{
      const source=await read(files[index]);
      if(live())sources[index]=source;
     }catch{/* Keep unreadable boards available for a later retry. */}
    });
    active.add(task);
    try{await task;}finally{active.delete(task);}
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
