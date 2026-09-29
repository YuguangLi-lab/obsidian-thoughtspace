import {clone,emptyBoard,History,type Board,type Card} from '../../src/model';
import {foldCards} from '../../src/board-tools';
import {visibleBranchBoard} from '../../src/mindmap';
import {sectionContains} from '../../src/sections';
import {connectionPath} from '../../src/connections';
import {reflowExpandedContent} from '../../src/expansion-layout';

const world=document.querySelector<HTMLElement>('.ts-world')!;
const node=(id:string,kind:Card['kind'],x:number,y:number,width:number,height:number):Card=>({id,kind,x,y,width,height,color:'slate'});
function initial():Board{return{...emptyBoard(),version:3,nodes:[
 {...node('group','section',0,0,760,750),title:'课程资料'},
 {...node('notes','text',32,72,480,72),collapsed:true,expandedHeight:460,text:'排版与课程笔记'},
 {...node('image','image',280,220,330,200),file:'sample.png'},
 {...node('audio','audio',40,470,300,140),file:'lecture.mp3'},
 {...node('pdf','pdf',440,500,240,190),file:'reading.pdf'},
 {...node('outside','text',80,850,360,100),text:'分组外的独立笔记'},
 {...node('unrelated','text',840,72,230,100),text:'旁边一列保持原位置'}
],edges:[{id:'citation',from:'notes',to:'image',label:'摘录',style:'curve'}]};}
let board=initial(),history=new History(),scale=.7;
const labels:Record<string,string>={notes:'排版与课程笔记',image:'视频画面',audio:'课程录音',pdf:'参考资料.pdf',outside:'分组外的独立笔记',unrelated:'旁边一列保持原位置'};
function render(){
 world.replaceChildren();world.style.transform=`scale(${scale})`;
 const display=visibleBranchBoard(board),byId=new Map(display.nodes.map(n=>[n.id,n]));
 for(const edge of display.edges){const a=byId.get(edge.from)!,b=byId.get(edge.to)!,svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');
  svg.setAttribute('class','ts-edges');path.setAttribute('d',connectionPath(a,b,edge).path);path.setAttribute('fill','none');path.setAttribute('stroke','#657980');path.setAttribute('stroke-width','2');svg.append(path);world.append(svg);
 }
 for(const n of display.nodes){
  const el=document.createElement('div');el.className=`ts-node ts-${n.kind}${n.collapsed?' is-compact-fold':''}`;el.dataset.id=n.id;
  Object.assign(el.style,{left:`${n.x}px`,top:`${n.y}px`,width:`${n.width}px`,height:`${n.height}px`});
  const heading=document.createElement('div');heading.className=n.collapsed?'ts-compact-fold-row':'ts-node-header';heading.textContent=n.title||labels[n.id];el.append(heading);
  if(n.id==='notes'&&!n.collapsed){const body=document.createElement('div');body.className='ts-text-body';body.innerHTML='<h3>1. 中英混排</h3><p>课程笔记、截图、录音和参考资料分别保留在各自节点中。</p><p>中文标点与英文内容保持自然间距。公式和代码使用独立段落，正文连续阅读。</p><h3>2. 课堂重点</h3><ul><li>保留完整的文字内容。</li><li>图片和附件与笔记关联。</li><li>通过时间链接回到课程片段。</li></ul><p>下一步：核对原始材料，补充例题与练习记录。</p>';el.append(body);}
  if(n.id==='image'){const img=document.createElement('img');img.alt='合成视频卡片测试画面';img.src=(window as any).fixtureImage;Object.assign(img.style,{width:'100%',height:'calc(100% - 36px)',objectFit:'contain'});el.append(img);}
  if(n.id==='audio'){const content=document.createElement('div');content.className='qa-audio';content.textContent='课程录音　01:24 / 18:50';el.append(content);}
  if(n.id==='pdf'){const body=document.createElement('div');body.className='qa-paper';body.innerHTML='<h4>Reading Notes</h4><p>课程补充阅读</p><hr><p>研究背景 · 关键概念</p><p>方法摘要 · 讨论问题</p>';el.append(body);}
  world.append(el);
 }
 const right=Math.max(...display.nodes.map(n=>n.x+n.width)),bottom=Math.max(...display.nodes.map(n=>n.y+n.height));
 const canvas=document.querySelector<HTMLElement>('.qa-canvas')!;canvas.style.width=`${right*scale+64}px`;canvas.style.height=`${bottom*scale+64}px`;
}
function expand(legacy=false){const before=clone(board);history.push(before);foldCards(board,new Set(['notes']),false);if(!legacy)reflowExpandedContent(board,before);render();}
function measure(){const before=clone(board);board.nodes.find(n=>n.id==='notes')!.height=720;reflowExpandedContent(board,before);render();}
function snapshot(){
 const visible=visibleBranchBoard(board),items=[...world.querySelectorAll<HTMLElement>('.ts-node')].map(el=>{const r=el.getBoundingClientRect();return{id:el.dataset.id!,x:r.x,y:r.y,width:r.width,height:r.height};});
 const content=items.filter(n=>n.id!=='group'),overlaps:string[][]=[];
 for(let i=0;i<content.length;i++)for(const b of content.slice(i+1)){const a=content[i];if(a.x<b.x+b.width-.1&&a.x+a.width>b.x+.1&&a.y<b.y+b.height-.1&&a.y+a.height>b.y+.1)overlaps.push([a.id,b.id]);}
 const group=board.nodes.find(n=>n.id==='group')!,membership=board.nodes.filter(n=>sectionContains(group,n)).map(n=>n.id).sort();
 return{board:clone(board),visible:visible.nodes.length,items,overlaps,membership,unrelated:board.nodes.find(n=>n.id==='unrelated'),outsideCaptured:membership.includes('outside')};
}
(window as any).expansionFixture={reset(){board=initial();history=new History();render();},expand,measure,snapshot,
 undo(){board=history.undo(board)!;render();},redo(){board=history.redo(board)!;render();},setScale(value:number){scale=value;render();}};
render();
