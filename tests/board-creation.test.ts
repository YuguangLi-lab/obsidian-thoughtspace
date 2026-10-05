import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {emptyBoard,parseBoard,safeName} from '../src/model';
import {createBrainBoard,isBrainBoard} from '../src/brain-board';

const source=readFileSync('src/main.ts','utf8');
function take(start:string,end:string){const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert(from>=0&&to>from,start);return source.slice(from,to);}
function compile(code:string,deps:Record<string,unknown>){return new Function(...Object.keys(deps),transformSync(code,{loader:'ts'}).code)(...Object.values(deps));}
class Element {
 children:Element[]=[];attrs:Record<string,string>={};value='';text='';disabled=false;focused=false;selected=false;onkeydown?:((event:any)=>void);onclick?:()=>void;
 constructor(readonly tag:string,options:any={}){this.value=options.value||'';this.text=options.text||'';this.attrs={...(options.attr||{})};if(options.type)this.attrs.type=options.type;if(options.cls)this.attrs.class=options.cls;}
 createEl(tag:string,options:any={}){const child=new Element(tag,options);this.children.push(child);return child;}
 createSpan(options:any={}){return this.createEl('span',options);}
 addClass(){}empty(){this.children=[];this.text='';}focus(){this.focused=true;}select(){this.selected=true;}
 all(tag:string):Element[]{return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.all(tag)]);}
 click(){if(!this.disabled)this.onclick?.();}
 get textContent():string{return this.text+this.children.map(child=>child.textContent).join('');}
}
function fixture(){
 const modals:any[]=[],files=new Map<string,{path:string;body:string}>(),folders=new Set<string>(),opened:string[]=[],errors:unknown[]=[],actions:Promise<unknown>[]=[];
 const hooks:{create?:(path:string,body:string)=>Promise<void>}={};
 class Modal {
  modalEl=new Element('modal');contentEl=new Element('content');closed=false;
  constructor(public app:unknown){}
  open(){modals.push(this);(this as any).onOpen();}
  close(){this.closed=true;(this as any).onClose();}
 }
 const act=(run:()=>unknown)=>{try{const pending=Promise.resolve(run());actions.push(pending);void pending.catch(error=>errors.push(error));}catch(error){errors.push(error);}};
 const Prompt=compile(take('function button(','class NotePicker ')+';return Prompt;',{Modal,act,setIcon(){},themeSurface(){}});
 const Host=compile('class Host{'+take('  async folder(','  async openDeepLink(')+take('  promptBoard(','  private serializeFiling')+'};return Host;',{Prompt,emptyBoard,createBrainBoard,safeName,normalizePath:(path:string)=>path,ROOT:'ThoughtSpace',EXT:'thoughtspace'});
 const host=new Host();host.app={vault:{getAbstractFileByPath:(path:string)=>files.get(path)||(folders.has(path)?{path}:undefined),createFolder:async(path:string)=>{folders.add(path);},create:async(path:string,body:string)=>{await hooks.create?.(path,body);const file={path,body};files.set(path,file);return file;}}};host.openBoard=async(file:{path:string})=>{opened.push(file.path);};
 const modal=()=>modals.at(-1)!,input=()=>modal().contentEl.all('input')[0] as Element,type=()=>modal().contentEl.all('select')[0] as Element,save=()=>modal().contentEl.all('button')[0] as Element;
 const flush=async()=>{await Promise.allSettled(actions);await Promise.resolve();};
 const reopen=(path=opened.at(-1)!)=>parseBoard(files.get(path)!.body);
 return{host,modals,files,folders,opened,errors,hooks,modal,input,type,save,flush,reopen};
}

test('existing new-board entry opens one native naming modal with ordinary and brain choices',()=>{
 const f=fixture();f.host.promptBoard();
 assert.equal(f.modals.length,1);assert.equal(f.modal().contentEl.all('h2')[0].text,'新建白板');assert.equal(f.type().attrs['aria-label'],'白板类型');
 assert.match(f.type().attrs.class,/(^| )dropdown( |$)/);assert.match(f.type().attrs.class,/(^| )ts-prompt-choice( |$)/);
 assert.deepEqual(f.type().children.map(option=>[option.value,option.text]),[['board','普通白板'],['brain','脑图白板']]);assert.equal(f.type().value,'board');
 assert.equal(f.input().value,'新的研究主题');assert.equal(f.input().focused,true);assert.equal(f.input().selected,true);assert.equal(f.files.size,0);
});

test('choosing brain in the existing entry saves a dedicated empty board before opening it',async()=>{
 const f=fixture();f.host.promptBoard();f.type().value='brain';f.input().value='  知识管理  ';f.save().click();await f.flush();
 assert.equal(f.modal().closed,true);assert.deepEqual(f.opened,['ThoughtSpace/白板/知识管理.thoughtspace']);assert.equal(f.files.size,1);assert.deepEqual(f.errors,[]);
 const board=f.reopen();assert(isBrainBoard(board));assert.deepEqual(board,createBrainBoard());assert.deepEqual(board.nodes,[]);assert.deepEqual(board.brain.history,{entries:[],index:-1});
});

test('ordinary creation retains its existing format and saved viewport',async()=>{
 const f=fixture();f.host.promptBoard();f.input().value='普通主题';f.save().click();await f.flush();
 assert.deepEqual(f.reopen(),emptyBoard());assert.equal(f.reopen().presentation,undefined);assert.equal(f.reopen().brain,undefined);assert.equal(f.files.size,1);assert.equal(f.modal().closed,true);
});

test('the dedicated brain shortcut preselects brain in the shared modal and can choose ordinary',async()=>{
 const f=fixture();f.host.promptBrainBoard();assert.equal(f.type().value,'brain');assert.equal(f.input().value,'新的脑图');
 f.type().value='board';f.input().value='普通主题';f.save().click();await f.flush();assert.deepEqual(f.reopen(),emptyBoard());
 f.host.promptBrainBoard();f.save().click();await f.flush();assert(isBrainBoard(f.reopen()));assert.equal(f.files.size,2);
});

for(const presentation of ['board','brain'])test(`${presentation} creation uses existing legal-name and duplicate handling without overwriting`,async()=>{
 const f=fixture(),path='ThoughtSpace/白板/-研究-目标-.thoughtspace',existing={path,body:'existing saved board'};f.files.set(path,existing);
 f.host.promptBoard();f.type().value=presentation;f.input().value='  ../研究:目标?  ';f.save().click();await f.flush();
 assert.deepEqual(f.opened,['ThoughtSpace/白板/-研究-目标- 2.thoughtspace']);assert.equal(f.files.get(path),existing);assert.equal(f.files.size,2);assert.equal(isBrainBoard(f.reopen()),presentation==='brain');
});

for(const entry of ['promptBoard','promptBrainBoard'])test(`${entry} cancel and blank submission create no files or tabs`,async()=>{
 const f=fixture();f.host[entry]();f.input().value='  ';f.save().click();await f.flush();assert.equal(f.modal().closed,false);
 f.input().value='未创建主题';f.modal().close();await f.flush();assert.equal(f.files.size,0);assert.equal(f.folders.size,0);assert.deepEqual(f.opened,[]);assert.deepEqual(f.errors,[]);
});

test('board naming respects composition and normal Enter submits once with the chosen type',async()=>{
 const f=fixture();f.host.promptBoard();f.type().value='brain';f.input().value='中文知识';
 const press=(extra:Record<string,unknown>={})=>f.input().onkeydown!({key:'Enter',isComposing:false,keyCode:13,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra});
 press({isComposing:true});press({keyCode:229});press({defaultPrevented:true});assert.equal(f.files.size,0);assert.equal(f.save().disabled,false);
 press();press();await f.flush();assert.equal(f.files.size,1);assert.equal(f.opened.length,1);assert(isBrainBoard(f.reopen()));
});

test('pending creation holds the type and blocks a repeated save until the file is written',async()=>{
 const f=fixture();let resolve!:()=>void;const gate=new Promise<void>(done=>{resolve=done;});f.hooks.create=async()=>gate;
 f.host.promptBoard();f.type().value='brain';f.input().value='待保存主题';const save=f.save(),type=f.type();save.click();save.click();
 assert.equal(save.disabled,true);assert.equal(type.disabled,true);assert.equal(f.modal().closed,false);assert.equal(f.files.size,0);
 resolve();await f.flush();assert.equal(f.files.size,1);assert.equal(f.opened.length,1);assert(isBrainBoard(f.reopen()));assert.equal(f.modal().closed,true);
});

test('a failed write keeps the name and type available for one successful retry',async()=>{
 const f=fixture();f.hooks.create=async()=>{throw Error('test write failure');};f.host.promptBoard();f.type().value='brain';f.input().value='可重试主题';f.save().click();await f.flush();
 assert.equal(f.modal().closed,false);assert.equal(f.save().disabled,false);assert.equal(f.type().disabled,false);assert.equal(f.type().value,'brain');assert.equal(f.input().value,'可重试主题');assert.equal(f.files.size,0);assert.deepEqual(f.opened,[]);assert.match(String(f.errors[0]),/test write failure/);
 f.hooks.create=undefined;f.save().click();await f.flush();assert.equal(f.modal().closed,true);assert.equal(f.files.size,1);assert(isBrainBoard(f.reopen()));
});
