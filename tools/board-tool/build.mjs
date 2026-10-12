import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(root,'tools/dist');
await mkdir(out,{recursive:true});
for(const [entry,name] of [['cli.ts','thoughtspace-board'],['index.ts','board-tool']]){
 const result=await build({absWorkingDir:root,entryPoints:[`tools/board-tool/${entry}`],outfile:`tools/dist/${name}.mjs`,bundle:true,platform:'node',format:'esm',target:'node22',metafile:true,legalComments:'eof',logLevel:'info'});
 await writeFile(path.join(out,`${name}.meta.json`),JSON.stringify(result.metafile,null,2)+'\n');
}
