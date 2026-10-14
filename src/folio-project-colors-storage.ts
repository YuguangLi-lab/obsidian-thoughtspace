import {open,rename,unlink} from 'fs/promises';
import {randomUUID} from 'crypto';

/** Desktop-only plugin metadata: stage beside the target, then replace it. */
export async function atomicWriteProjectColors(path:string,contents:string):Promise<void>{
  const staged=`${path}.folio-tmp-${randomUUID()}`;
  try{
    const file=await open(staged,'wx',0o600);
    try{await file.writeFile(contents,'utf8');await file.sync();}
    finally{await file.close();}
    await rename(staged,path);
  }finally{
    // After a successful rename the stage no longer exists; on failure only
    // this invocation's unique file is removed, preserving the old target.
    await unlink(staged).catch(()=>undefined);
  }
}
