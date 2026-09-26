import {textBlockPadding} from '../src/text-sizing';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {cardFillHex, colors, type Card} from '../src/model';
import {sectionDisplayNode} from '../src/sections';
import {textFontFamily} from '../src/text-tools';
import {syncNodeGeometry} from '../src/node-render-key';

const source=readFileSync(process.env.POSITION_SOURCE||'src/main.ts','utf8'),start=source.indexOf('  private positionNode('),end=source.indexOf('  private applyInlineSize(',start);
assert.ok(start>0&&end>start);
const deps={textBlockPadding,cardFillHex,colors,sectionDisplayNode,textFontFamily,syncNodeGeometry};
const View=new Function(...Object.keys(deps),transformSync(`class View{${source.slice(start,end)}};return View`,{loader:'ts'}).code)(...Object.values(deps));
const node=(patch:Partial<Card>={}):Card=>({id:'node',kind:'card',file:'note.md',x:20,y:30,width:300,height:180,color:'blue',transparent:true,fillColor:'blue',...patch});
function surface(){
 const classes=new Set<string>(),properties=new Map<string,string>(),writes:string[]=[];
 const style=new Proxy({left:'',top:'',width:'',height:'',borderStyle:'',borderWidth:'',
  getPropertyValue:(key:string)=>properties.get(key)||'',setProperty:(key:string,value:string)=>{writes.push(key);properties.set(key,value);},
  removeProperty:(key:string)=>{writes.push(key);properties.delete(key);}
 },{set(target,key,value){writes.push(String(key));return Reflect.set(target,key,value);}});
 const element={style,dataset:{} as Record<string,string>,classList:{contains:(name:string)=>classes.has(name)},toggleClass(name:string,on:boolean){writes.push('.'+name);if(on)classes.add(name);else classes.delete(name);}};
 return {element,style,classes,properties,writes};
}

test('repeated viewport refreshes leave unchanged node presentation untouched',()=>{
 const view=new View();
 for(const kind of ['card','text','image','pdf','board','section'] as const){
  const f=surface(),n=node({kind});view.positionNode(n,f.element);f.writes.length=0;
  for(let i=0;i<120;i++)view.positionNode(n,f.element);
  assert.deepEqual(f.writes,[],`${kind}: no repeated class or CSS writes`);
 }
});

test('120 horizontal drag frames only update the changed coordinate',()=>{
 const view=new View(),f=surface(),n=node();view.positionNode(n,f.element);f.writes.length=0;
 for(let i=0;i<120;i++)view.positionNode({...n,x:21+i},f.element);
 assert.equal(f.writes.length,120);assert.ok(f.writes.every(key=>key==='left'));
 assert.deepEqual([f.style.left,f.style.top,f.style.width,f.style.height],['140px','30px','300px','180px']);
});

test('presentation changes still apply immediately without a cached node identity',()=>{
 const view=new View(),f=surface(),n=node();view.positionNode(n,f.element);f.writes.length=0;
 Object.assign(n,{transparent:false,fillColor:'#123abc',fontSize:24,fontFamily:'serif',customBorder:true,borderWidth:3,borderStyle:'dashed'});
 view.positionNode(n,f.element);
 assert.equal(f.classes.has('is-transparent'),false);assert.equal(f.classes.has('has-card-fill'),true);assert.equal(f.classes.has('has-custom-border'),true);
 assert.equal(f.properties.get('--ts-card-fill'),'#123abc');assert.equal(f.properties.get('--ts-card-body-size'),'24px');assert.equal(f.properties.get('--ts-card-body-font'),textFontFamily('serif'));
 assert.equal(f.style.borderWidth,'3px');assert.equal(f.style.borderStyle,'dashed');assert.ok(!f.writes.includes('left'));
 delete n.fillColor;delete n.borderWidth;delete n.borderStyle;n.customBorder=false;view.positionNode(n,f.element);
 assert.equal(f.classes.has('has-card-fill'),false);assert.equal(f.properties.has('--ts-card-fill'),false);assert.equal(f.style.borderWidth,'');assert.equal(f.style.borderStyle,'');
});

test('reused nodes synchronize border and text colors through replacements and undo',()=>{
 const view=new View(),f=surface(),n=node({color:'blue',textColor:'rose'});view.positionNode(n,f.element);
 assert.equal(f.classes.has('ts-color-blue'),true);assert.equal(f.element.dataset.ink,'rose');
 view.positionNode({...n,color:'green',textColor:'purple'},f.element);
 assert.equal(f.classes.has('ts-color-blue'),false);assert.equal(f.classes.has('ts-color-green'),true);assert.equal(f.element.dataset.ink,'purple');
 view.positionNode(n,f.element);assert.equal(f.classes.has('ts-color-green'),false);assert.equal(f.classes.has('ts-color-blue'),true);assert.equal(f.element.dataset.ink,'rose');
 view.positionNode({...n,textColor:undefined},f.element);assert.equal(f.element.dataset.ink,'default');
});

test('appearance refresh keeps an inline editor draft size while updating its position and font',()=>{
 const view=new View(),f=surface(),n=node();view.positionNode(n,f.element);f.style.width='420px';f.style.height='270px';f.writes.length=0;
 view.positionNode({...n,x:50,y:80,fontSize:20},f.element,true);
 assert.deepEqual([f.style.left,f.style.top,f.style.width,f.style.height],['50px','80px','420px','270px']);
 assert.equal(f.properties.get('--ts-card-body-size'),'20px');assert.ok(!f.writes.includes('width')&&!f.writes.includes('height'));
});

test('folded section presentation tracks compact geometry without mutating logical bounds',()=>{
 const view=new View(),f=surface(),n=node({kind:'section',sectionFolded:true,width:800,height:600}),before=structuredClone(n),display=sectionDisplayNode(n);
 view.positionNode(n,f.element);assert.equal(f.style.width,`${display.width}px`);assert.equal(f.style.height,`${display.height}px`);assert.deepEqual(n,before);
 delete n.sectionFolded;view.positionNode(n,f.element);assert.equal(f.style.width,'800px');assert.equal(f.style.height,'600px');
});
