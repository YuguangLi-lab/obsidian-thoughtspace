import {constants} from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';

/** File commands intentionally reject symlink components, including a symlink root.
 * On macOS, callers using /tmp or /var aliases can supply their canonical /private paths. */
export async function assertNoSymlinks(input:string,allowMissingLeaf=false):Promise<string> {
 const absolute=path.resolve(input),parsed=path.parse(absolute);let current=parsed.root;
 const parts=absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
 for(let i=0;i<parts.length;i++){
  current=path.join(current,parts[i]);
  let info;
  try{info=await fs.lstat(current);}catch(error){
   if(allowMissingLeaf&&i===parts.length-1&&error instanceof Error&&'code' in error&&error.code==='ENOENT')return absolute;
   throw error;
  }
  if(info.isSymbolicLink())throw Error(`拒绝符号链接路径：${current}`);
  if(i<parts.length-1&&!info.isDirectory())throw Error(`路径父级不是目录：${current}`);
 }
 return absolute;
}

/** Bind the open handle to the still-present regular file before and after reading. */
export async function readLocalFile(input:string):Promise<string> {
 const absolute=await assertNoSymlinks(input),before=await fs.lstat(absolute);
 if(!before.isFile())throw Error('输入路径不是普通文件');
 const handle=await fs.open(absolute,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const opened=await handle.stat();await assertNoSymlinks(absolute);
  const current=await fs.lstat(absolute);
  if(!opened.isFile()||opened.dev!==current.dev||opened.ino!==current.ino)throw Error('读取前文件身份已变化');
  const text=await handle.readFile('utf8'),after=await handle.stat();await assertNoSymlinks(absolute);
  const final=await fs.lstat(absolute);
  if(opened.dev!==final.dev||opened.ino!==final.ino||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||final.size!==after.size||final.mtimeMs!==after.mtimeMs)throw Error('读取期间文件已变化');
  return text;
 }finally{await handle.close();}
}

export async function referencePath(root:string,target:string):Promise<string> {
 if(!target||target.trim()!==target||/[\\\u0000-\u001f\u007f]/.test(target)||path.isAbsolute(target)||/^[a-z][a-z\d+.-]*:/i.test(target)||target.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('引用必须为根目录内的仓库相对路径');
 const absoluteRoot=await assertNoSymlinks(root),rootInfo=await fs.lstat(absoluteRoot);
 if(!rootInfo.isDirectory())throw Error('vault-root 不是目录');
 const absolute=path.resolve(absoluteRoot,...target.split('/')),relative=path.relative(absoluteRoot,absolute);
 if(!relative||relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))throw Error('引用路径逃逸 vault-root');
 await assertNoSymlinks(absolute);const info=await fs.lstat(absolute);
 if(!info.isFile())throw Error('引用目标不是普通文件');
 const realRoot=await fs.realpath(absoluteRoot),real=await fs.realpath(absolute);
 if(real!==absolute||realRoot!==absoluteRoot||!real.startsWith(realRoot+path.sep))throw Error('引用路径身份或根目录已变化');
 return absolute;
}

/** The only output mutation: exclusive creation. No mkdir, process, rename or overwrite. */
export async function writeNewFile(input:string,source:string):Promise<void> {
 const absolute=await assertNoSymlinks(input,true),parent=path.dirname(absolute),parentInfo=await fs.lstat(parent);
 if(!parentInfo.isDirectory())throw Error('输出父级不是目录');
 const handle=await fs.open(absolute,'wx',0o600);let completed=false,failed=false,failure:unknown;
 try{
  await assertNoSymlinks(parent);
  const stat=await handle.stat(),current=await fs.lstat(absolute);
  if(stat.dev!==current.dev||stat.ino!==current.ino||current.isSymbolicLink())throw Error('输出文件身份已变化');
  await handle.writeFile(source,'utf8');await handle.sync();await assertNoSymlinks(parent);
  const final=await fs.lstat(absolute);if(final.isSymbolicLink()||stat.dev!==final.dev||stat.ino!==final.ino)throw Error('输出期间文件身份已变化');completed=true;
 }catch(error){failed=true;failure=error;}
 const stat=await handle.stat().catch(()=>undefined);
 try{await handle.close();}catch(error){completed=false;if(!failed){failed=true;failure=error;}}
 // Clean up only this invocation's incomplete new inode, never a replacement.
 try{if(!completed&&stat){const safe=await assertNoSymlinks(parent).then(()=>true,()=>false);const current=safe?await fs.lstat(absolute).catch(()=>undefined):undefined;if(current&&!current.isSymbolicLink()&&stat.dev===current.dev&&stat.ino===current.ino)await fs.unlink(absolute);}}
 catch(error){failed=true;failure=new Error('新输出未能安全清理；请核对报告路径，工具没有覆盖其他文件',{cause:error});}
 if(failed)throw failure;
}
