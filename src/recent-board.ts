export interface RecentBoardHost<T> {
 current:()=>boolean;
 resolve:(path:string)=>T|undefined;
 valid:(file:T)=>boolean;
 /** False means navigation was cancelled; it must not fall through to another board. */
 open:(file:T,current:()=>boolean)=>Promise<boolean>;
 visited:(file:T)=>Promise<void>;
}
export type RecentBoardResult={status:'opened';path:string;skipped:number}|{status:'empty'|'cancelled';skipped:number};

/** Visit order belongs to the existing hub preferences. This command never
 * creates files, migrates formats, fits the camera or caches a board snapshot. */
export async function resumeRecentBoard<T>(recent:readonly {path:string}[],host:RecentBoardHost<T>):Promise<RecentBoardResult>{
 let skipped=0;const seen=new Set<string>();
 for(const {path}of recent){
  if(!host.current())return{status:'cancelled',skipped};
  if(seen.has(path))continue;seen.add(path);
  const file=host.resolve(path);
  if(file===undefined||!host.valid(file)||host.resolve(path)!==file){skipped++;continue;}
  const current=()=>host.current()&&host.resolve(path)===file&&host.valid(file);
  let opened:boolean;
  try{opened=await host.open(file,current);}
  catch{if(!host.current())return{status:'cancelled',skipped};skipped++;continue;}
  if(!opened||!current())return{status:'cancelled',skipped};
  // Preference-write errors occur after successful navigation. Do not treat
  // those errors as an invalid board and open a different page.
  await host.visited(file);return{status:'opened',path,skipped};
 }
 return{status:host.current()?'empty':'cancelled',skipped};
}
