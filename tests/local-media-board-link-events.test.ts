import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {parseMediaSourceUrl} from '../src/media-source';
import {parseMediaPlayerUrl} from '../src/media-notes';
import {isWorkspaceFile} from '../src/workspace';

const source=readFileSync('src/main.ts','utf8');
const start=source.lastIndexOf("    this.registerDomEvent(this.stage,'click',e=>{",source.indexOf("href?.startsWith('yingjian://')"));
const end=source.indexOf('    const openOnlineBoardLink=',start);
assert.ok(start>=0&&end>start);
const compiled=transformSync(source.slice(start,end),{loader:'ts'}).code;
function method(name:string){
 const at=source.indexOf(name);assert.ok(at>=0,`Missing ${name}`);
 const tail=source.slice(at+name.length),next=/\n  (?:(?:private|public|protected|async|static)\s+)*(?:get\s+)?[A-Za-z_$][\w$]*\(/.exec(tail);
 assert.ok(next);return source.slice(at,at+name.length+next.index);
}
class TFile {constructor(public path:string){}get extension(){return this.path.split('.').at(-1)!;}}
const vault='Research + Notes',board='白板/课程 + 1.thoughtspace',file='引用/课程 + 100%2F.tsvideo',time=12.125;
// Pre-fix links use form encoding; the Obsidian callback decodes percent escapes only.
function legacyUrl(player=false,overrides:Record<string,string>={}){
 return 'obsidian://thoughtspace-'+(player?'player':'media')+'?'+new URLSearchParams({vault,...(player?{}:{board,node:'video'}),file,t:String(time),...overrides}).toString();
}
function callback(url:string){
 const [action,query]=url.slice('obsidian://'.length).split('?');
 return {...Object.fromEntries(query.split('&').map(part=>part.split('=').map(decodeURIComponent))),action};
}
type Options={href?:string;boundary?:string;modifier?:boolean;button?:number;prevented?:boolean;missingLink?:boolean;missingFile?:boolean};
function fixture(options:Options={}){
 const calls={native:0,seeks:[] as unknown[],players:[] as unknown[][],errors:[] as string[],stop:0},pending:Promise<unknown>[]=[],listeners:{handle:(e:unknown)=>void;capture:boolean}[]=[];
 const href=options.href??legacyUrl(),link={getAttribute:()=>href,closest:(selector:string)=>options.boundary&&selector.includes(options.boundary)?{}:null};
 const event={defaultPrevented:!!options.prevented,button:options.button??0,stopped:false,target:{closest:()=>options.missingLink?null:link},
  preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;calls.stop++;}};
 const boardFile=new TFile(board),mediaFile=new TFile(file),files=new Map([[board,boardFile],[file,mediaFile]]);if(options.missingFile)files.delete(file);
 const deps={parseMediaSourceUrl,parseMediaPlayerUrl,TFile,isWorkspaceFile};
 const methods=method('  async openMediaSource(')+(source.includes('  async openMediaPlayerSource(')?method('  async openMediaPlayerSource('):'');
 const Plugin=new Function(...Object.keys(deps),transformSync(`class Plugin{${methods}};return Plugin;`,{loader:'ts'}).code)(...Object.values(deps));
 const plugin=new Plugin(),app={vault:{getName:()=>vault,getAbstractFileByPath:(path:string)=>files.get(path)}};
 Object.assign(plugin,{app,openBoard:async()=>{},currentBoard:{file:boardFile,closed:false,seekMediaSource:(data:unknown)=>calls.seeks.push(data)},openMediaWorkspace:async(...args:unknown[])=>calls.players.push(args)});
 const act=(run:()=>unknown)=>pending.push(Promise.resolve().then(run).catch(error=>calls.errors.push(error.message)));
 new Function('Keymap','parseMediaSourceUrl','parseMediaPlayerUrl','act',compiled).call({stage:{},app,plugin,registerDomEvent:(_target:unknown,_type:string,handle:(e:unknown)=>void,settings?:{capture?:boolean})=>listeners.push({handle,capture:!!settings?.capture})},
  {isModEvent:()=>!!options.modifier},parseMediaSourceUrl,parseMediaPlayerUrl,act);
 async function dispatch(){
  listeners.filter(listener=>listener.capture).forEach(listener=>listener.handle(event));
  if(!event.stopped){calls.native++;act(async()=>{
   const params=callback(href),parsed=params.action==='thoughtspace-media'?parseMediaSourceUrl(params):parseMediaPlayerUrl(params);
   if(!parsed||parsed.vault!==vault)throw Error('媒体链接无效或属于其他仓库');
  });event.defaultPrevented=true;}
  if(!event.stopped)listeners.filter(listener=>!listener.capture).forEach(listener=>listener.handle(event));
  await Promise.all(pending);
 }
 return{calls,event,dispatch,mediaFile};
}

test('legacy external-video backlink is read before Obsidian loses spaces and literal plus signs',async()=>{
 const f=fixture();await f.dispatch();assert.deepEqual(f.calls.errors,[]);assert.equal(f.calls.native,0);
 assert.deepEqual(f.calls.seeks,[{vault,board,node:'video',file,time}]);
});
test('legacy standalone external-video timestamp opens the exact reference at its recorded time',async()=>{
 const f=fixture({href:legacyUrl(true)});await f.dispatch();assert.deepEqual(f.calls.errors,[]);assert.equal(f.calls.native,0);
 assert.deepEqual(f.calls.players,[[f.mediaFile,'tab',time]]);
});
for(const boundary of ['.markdown-embed','.internal-embed'])test(`local media links in ${boundary} preserve raw source identity`,async()=>{
 const f=fixture({boundary});await f.dispatch();assert.deepEqual(f.calls.errors,[]);assert.equal(f.calls.native,0);assert.equal(f.calls.seeks.length,1);
});
test('legacy standalone link still rejects a missing external reference',async()=>{
 const f=fixture({href:legacyUrl(true),missingFile:true});await f.dispatch();assert.deepEqual(f.calls.players,[]);assert.deepEqual(f.calls.errors,['来源媒体已移动或删除']);
});
test('foreign vaults, malformed paths and unrelated links are not intercepted',async()=>{
 for(const href of [legacyUrl(false,{vault:'Other Vault'}),legacyUrl(false,{file:'../outside.mp4'}),'https://example.com/']){
  const f=fixture({href});await f.dispatch();assert.equal(f.calls.stop,0);assert.equal(f.calls.seeks.length,0);assert.equal(f.calls.players.length,0);
 }
});
test('native editor and modified clicks keep ownership of their links',async()=>{
 for(const options of [{modifier:true},{button:1},{button:2},{prevented:true},{missingLink:true},...['.ts-inline-editor','.cm-editor','.is-editing-title'].map(boundary=>({boundary}))]){
  const f=fixture(options);await f.dispatch();assert.equal(f.calls.stop,0);assert.equal(f.calls.seeks.length,0);assert.equal(f.calls.players.length,0);
 }
});
