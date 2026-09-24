import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {outlineBoard,parseOutline} from '../src/materials';
import {parseBoard} from '../src/model';

test('material outlines can import multiple roots upward and keep their insertion anchor',()=>{let i=0;const b=outlineBoard(parseOutline('# 事实\n- 证据\n# 观点'),'材料',{x:150,y:480},'up',()=>String(++i));assert.equal(b.nodes[0].text,'材料');assert.deepEqual([b.nodes[0].x,b.nodes[0].y],[150,480]);assert.equal(b.mindmapDirection,'up');const byId=new Map(b.nodes.map(n=>[n.id,n]));for(const e of b.edges){assert(byId.get(e.to)!.y+byId.get(e.to)!.height<byId.get(e.from)!.y);assert.equal(e.fromSide,'top');assert.equal(e.toSide,'bottom');}assert.deepEqual(parseBoard(JSON.stringify(b)),b);});

class ElementStub {
 children:ElementStub[]=[];text='';disabled=false;attrs:Record<string,string>={};onclick?:()=>unknown;
 constructor(options:any={}){this.text=options.text||'';}
 createDiv(options:any={}){const child=new ElementStub(options);this.children.push(child);return child;}
 createSpan(options:any={}){return this.createDiv(options);}
 createEl(_tag:string,options:any={}){return this.createDiv(options);}
 setAttribute(key:string,value:string){this.attrs[key]=value;}
 empty(){this.children=[];}
 all():ElementStub[]{return this.children.flatMap(child=>[child,...child.all()]);}
}
function workbench(){const source=readFileSync('src/materials-view.ts','utf8'),start=source.indexOf(' private renderFooter(){'),end=source.indexOf('\n private canApply()',start),applyStart=source.indexOf(' private async apply(){'),applyEnd=source.indexOf('\n close()',applyStart);assert(start>=0&&end>start&&applyStart>=0&&applyEnd>applyStart);const Harness=new Function(transformSync('class Harness{'+source.slice(start,end)+source.slice(applyStart,applyEnd)+'};return Harness',{loader:'ts'}).code)();const ui=new Harness(),calls:unknown[][]=[];Object.assign(ui,{alive:true,busy:false,stale:false,truncated:false,mode:'outline',direction:'right',topics:parseOutline('# 根\n- 子'),raw:'# 根\n- 子',file:{basename:'材料'},adapter:{outline:(...args:unknown[])=>calls.push(args)},footer:new ElementStub(),canApply:()=>true,action:(parent:ElementStub,label:string,_icon:string,run:()=>unknown)=>{const b=parent.createEl('button',{text:label});b.onclick=run;return b;},close:()=>{},fail:(error:unknown)=>{throw error;}});return{ui,calls};}
test('material import direction UI exposes upward, tracks selection and passes it to the import command',async()=>{const{ui,calls}=workbench();ui.renderFooter();const up=ui.footer.all().find((el:ElementStub)=>el.text==='向上');assert(up,'向上 must be available alongside 向右/向下');assert.equal(up.attrs['aria-pressed'],'false');up.onclick!();assert.equal(ui.direction,'up');assert.equal(ui.footer.all().find((el:ElementStub)=>el.text==='向上')!.attrs['aria-pressed'],'true');await ui.apply();assert.equal(calls.length,1);assert.equal(calls[0][2],'up');ui.busy=true;ui.renderFooter();assert(ui.footer.all().filter((el:ElementStub)=>['向上','向下','向右'].includes(el.text)).every((el:ElementStub)=>el.disabled));});

test('imported upward outline keeps its own growth direction inside an existing right-facing board',async()=>{const{editTopic}=await import('../src/mindmap-editor');let i=0;const b=outlineBoard(parseOutline('# 已有树\n- 原节点'),'old',{x:0,y:0},'right',()=>String(++i));const imported=outlineBoard(parseOutline('# 新树\n- 新节点'),'new',{x:1400,y:0},'up',()=>String(++i));b.nodes.push(...imported.nodes);b.edges.push(...imported.edges);const before=JSON.stringify(b.nodes.slice(0,2)),result=editTopic(b,imported.nodes[0].id,'child',['继续向上'],()=>String(++i)),node=result.board.nodes.find(n=>n.id===result.selected)!,root=result.board.nodes.find(n=>n.id===imported.nodes[0].id)!;assert.equal(JSON.stringify(result.board.nodes.slice(0,2)),before);assert(node.y+node.height<root.y);assert.equal(result.board.edges.find(e=>e.to===node.id)?.fromSide,'top');});
