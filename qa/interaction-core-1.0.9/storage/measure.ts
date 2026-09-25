import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import * as model from '../../../src/model';
import * as mindmap from '../../../src/mindmap';

const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('class Session {'),end=source.indexOf('\nexport default class ThoughtSpace',start);
const deps={...model,...mindmap,Notice:class{},EXT:'thoughtspace',report:()=>{}};
const load=(raw:string)=>new Function(...Object.keys(deps),transformSync(raw+';return Session',{loader:'ts'}).code)(...Object.values(deps));
const statusStart=source.indexOf('  private renderSaveStatus(){'),statusEnd=source.indexOf('\n',statusStart);
const StatusView=new Function(transformSync('class StatusView{'+source.slice(statusStart,statusEnd)+'};return StatusView',{loader:'ts'}).code)();
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function measure(raw:string){
 const Session=load(raw);let disk=JSON.stringify(model.emptyBoard(),null,2),writes=0,statusCallbacks=0,boardCallbacks=0,attributeWrites=0,classUpdates=0,textWrites=0;
 const releases:(()=>void)[]=[],plugin={app:{vault:{process:async(_f:unknown,edit:(raw:string)=>string)=>{writes++;await new Promise<void>(resolve=>releases.push(resolve));disk=edit(disk);},read:async()=>disk}},createUnique:async()=>({path:'recovery'})};
 const session=new Session(plugin,{path:'board.thoughtspace',basename:'board'},disk);
 for(let i=0;i<3;i++){
  const view=new StatusView();view.session=session;
  view.status={textContent:'已保存',setText(text:string){textWrites++;this.textContent=text;},toggleClass(){classUpdates++;},dataset:new Proxy({},{set(){attributeWrites++;return true;}}),set title(_text:string){attributeWrites++;},setAttribute(){attributeWrites++;}};
  session.listeners.add((kind:string)=>{if(kind==='status'){statusCallbacks++;view.renderSaveStatus();}else boardCallbacks++;});
 }
 session.board.viewport.x=100;session.persist();await tick();
 for(let i=0;i<5000;i++){session.board.viewport.x=i;session.persist();}
 releases[0]();await tick();releases[1]();await session.flush();
 return{statusCallbacks,attributeWrites,classUpdates,textWrites,writes,boardCallbacks,finalDiskX:JSON.parse(disk).viewport.x,baselineMatchesDisk:session.baseline===disk,status:session.status,blocked:session.blocked};
}

async function main(){
 const before=await measure(readFileSync('qa/interaction-core-1.0.9/storage/session-before.ts','utf8')),after=await measure(source.slice(start,end));
 console.log(JSON.stringify({scenario:'5000 viewport persist calls while the first write is pending; three linked status views',method:'Production Session and BoardView.renderSaveStatus methods; controlled vault.process and counted status-element setters, without a browser or real vault.',before,after,statusCallbackReductionPercent:100*(1-after.statusCallbacks/before.statusCallbacks)},null,2));
}
void main();
