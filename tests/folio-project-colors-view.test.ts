import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,access,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {transform} from 'esbuild';
import {ProjectColorRegistry} from '../src/folio-project-colors';

class Folder {constructor(public path:string){}}
class File {constructor(public path:string){}}
class Adapter {
  constructor(private root:string){}
  getBasePath(){return this.root;}
  async exists(path:string){try{await access(join(this.root,path));return true;}catch{return false;}}
  read(path:string){return readFile(join(this.root,path),'utf8');}
}
async function bridgeClass(){
  const path=join(__dirname,'../src/folio-project-colors-view.ts');
  const {code}=await transform(await readFile(path,'utf8'),{loader:'ts',format:'cjs',target:'es2022'});
  const sourceRequire=createRequire(path),module={exports:{} as any};
  const obsidian={App:class{},Component:class{},FileSystemAdapter:Adapter,TFolder:Folder,TFile:File,normalizePath:(path:string)=>path};
  new Function('require','module','exports',code)((id:string)=>id==='obsidian'?obsidian:sourceRequire(id),module,module.exports);
  return module.exports.FolioProjectColorBridge;
}
function appFor(adapter:Adapter,folders:Map<string,Folder>){
  return {vault:{adapter,getRoot:()=>({children:[...folders.values()]}),getAbstractFileByPath:(path:string)=>folders.get(path)},
    workspace:{containerEl:{ownerDocument:{defaultView:{setTimeout,clearTimeout}}},iterateAllLeaves:()=>{}}};
}

test('the real bridge preserves unsupported, malformed and invalid registry files byte for byte',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'folio-bridge-'));
  try{
    const pluginDir='.obsidian/plugins/thoughtspace',file=join(dir,pluginDir,'folio-project-colors.json');
    await mkdir(join(dir,pluginDir),{recursive:true});
    const Bridge=await bridgeClass();
    for(const original of ['{broken','null','{"version":2,"nextId":1,"projects":[]}','{"version":1,"nextId":0,"projects":[]}']){
      await writeFile(file,original);
      const errors:unknown[]=[],app=appFor(new Adapter(dir),new Map([['项目甲',new Folder('项目甲')]]));
      const bridge=new Bridge(app,pluginDir,()=>false,(error:unknown)=>errors.push(error));
      await bridge.initialize();bridge.seedProjects();bridge.flush();await bridge.queue.run(async()=>{});
      assert.equal(await readFile(file,'utf8'),original);
      assert.equal(errors.length,1);
      assert.equal(bridge.registry.folder('项目甲').slot,1);
      bridge.onunload();
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('the real native bridge ignores an obsolete directory path during rename and restores the migrated identity',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'folio-bridge-'));
  try{
    const Bridge=await bridgeClass(),folders=new Map([['旧项目',new Folder('旧项目')]]);
    const bridge=new Bridge(appFor(new Adapter(dir),folders),'.obsidian/plugins/thoughtspace',()=>false,()=>{});
    const registry=new ProjectColorRegistry();const original=registry.folder('旧项目')!;
    bridge.registry=registry;bridge.persistenceAvailable=false;
    const attributes=new Map<string,string>();let path='旧项目';
    const element={querySelector:()=>({getAttribute:()=>path}),setAttribute:(key:string,value:string)=>attributes.set(key,value),removeAttribute:(key:string)=>attributes.delete(key)};
    const scope={folders:new Set()};
    bridge.nativeFolder(element,scope);assert.equal(attributes.get('data-folio-project-id'),String(original.id));
    registry.rename('旧项目','新项目',true);folders.delete('旧项目');folders.set('新项目',new Folder('新项目'));
    bridge.nativeFolder(element,scope);
    assert.equal(attributes.has('data-folio-project'),false);
    assert.deepEqual(registry.snapshot().projects.map(project=>project.path),['新项目']);
    path='新项目';bridge.nativeFolder(element,scope);
    assert.equal(attributes.get('data-folio-project-id'),String(original.id));
    assert.equal(attributes.get('data-folio-folder-slot'),String(original.slot));
    bridge.onunload();
  }finally{await rm(dir,{recursive:true,force:true});}
});
