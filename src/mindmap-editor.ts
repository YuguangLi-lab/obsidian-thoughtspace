import {sizeTemplateTopic} from './mindmap-sizing';
import {reparentBranch} from './mindmap-flow';
import {Board,Card,clone,parseBoard,uid} from './model';
import {branchState,layoutMindmap,mindmapRoot,validateBranches} from './mindmap';
export const topicLabel=(n:Card)=>(n.kind==='text'?n.text:n.title||n.file?.split('/').pop()?.replace(/\.md$/i,''))||'未命名主题';
/** Edge order is the canonical sibling order, independent of the current layout. */
export function topicRows(board:Board,root:string){
 const parents=validateBranches(board),{children}=branchState(board),nodes=new Map(board.nodes.map(n=>[n.id,n]));
 if(!nodes.has(root))throw Error('主题已不存在');
 const rows:{node:Card;depth:number;parent?:string}[]=[],stack=[{id:root,depth:0}];
 while(stack.length){const {id,depth}=stack.pop()!,node=nodes.get(id)!;rows.push({node,depth,parent:parents.get(id)});const kids=children.get(id)||[];for(let i=kids.length-1;i>=0;i--)stack.push({id:kids[i],depth:depth+1});}return rows;
}
export type TopicAction='child'|'sibling'|'parent'|'up'|'down'|'indent'|'outdent'|'duplicate'|'fold'|'promote'|'reparent';
export interface TopicResult {board:Board;selected:string;root:string;}
export interface TopicEditOptions {
 /** Apply final typography and measure new nodes before their first layout. */
 prepareNode?:(node:Card)=>void;
 /** Child/sibling creation only: the owning transaction must immediately reflow automatic trees. */
 deferAutomaticLayout?:boolean;
}
/** A command produces a validated draft. Source data is never partially modified on failure. */
export function editTopic(source:Board,id:string,action:TopicAction,values:readonly string[]=[],makeId:()=>string=uid,options:TopicEditOptions={}):TopicResult{
 const b=clone(source),parents=validateBranches(b),{children}=branchState(b),byId=new Map(b.nodes.map(n=>[n.id,n])),n=byId.get(id);
 if(!n||n.kind==='section')throw Error('请选择一个内容主题');
 // Reuse the command's validated forest instead of rebuilding it for each lookup.
 const rootOf=(start:string)=>{let at=start;while(parents.has(at))at=parents.get(at)!;return at;};
 const subtree=(start:string)=>{const pending=[start],nodes:Card[]=[];while(pending.length){const id=pending.pop()!;nodes.push(byId.get(id)!);const kids=children.get(id)||[];for(let i=kids.length-1;i>=0;i--)pending.push(kids[i]);}return nodes;};
 let root=rootOf(id),selected=id;
 if(subtree(root).some(node=>node.locked))throw Error('主题树中有锁定对象，请先解锁');
 const parent=parents.get(id),siblings=parent===undefined?[]:children.get(parent)||[],index=siblings.indexOf(id),incoming=b.edges.find(e=>e.kind==='branch'&&e.to===id);
 const ids=new Set([...b.nodes,...b.edges].map(n=>n.id));
 const fresh=()=>{const value=makeId();if(!value||ids.has(value))throw Error('标识冲突，请重试');ids.add(value);return value;};
 const add=(text:string):Card=>{const node:Card={id:fresh(),kind:'text',text,topic:true,...(byId.get(root)?.mindmapRules?.automatic?{autoSize:true,textMaxWidth:280}:{}),x:n.x,y:n.y,width:220,height:70,color:n.color};if(node.autoSize)sizeTemplateTopic(node);options.prepareNode?.(node);b.nodes.push(node);return node;};
 const connect=(from:string,to:string)=>({id:fresh(),from,to,kind:'branch' as const,label:'',direction:'none' as const,style:'curve' as const,color:n.color});
 const moveAfter=(child:string,after:string)=>{const edge=b.edges.find(e=>e.kind==='branch'&&e.to===child)!;b.edges=b.edges.filter(e=>e!==edge);const pos=b.edges.findIndex(e=>e.kind==='branch'&&e.to===after);b.edges.splice(pos+1,0,edge);};
 if(action==='child'||action==='sibling'){
  if(action==='sibling'&&parent===undefined)throw Error('中心主题没有同级主题');
  const labels=(values.length?values:['新主题']).map(v=>v.trim()).filter(Boolean);
  if(!labels.length||labels.length>100||labels.some(v=>v.length>10000))throw Error('每次添加 1–100 个主题，每个最多 10,000 字符');
  const added:ReturnType<typeof connect>[]=[];for(const text of labels){const node=add(text),edge=connect(action==='child'?id:parent!,node.id);if(action==='sibling')added.push(edge);else b.edges.push(edge);selected=node.id;}
  // Preserve canonical sibling order with one insertion, including interleaved relations.
  if(action==='sibling')b.edges.splice(b.edges.indexOf(incoming!)+1,0,...added);
  if(action==='child')delete n.branchFolded;
 }else if(action==='parent'){
  const node=add(values[0]?.trim()||'父主题');if(incoming)incoming.to=node.id;else {root=node.id;if(n.mindmapRules){node.mindmapRules={...n.mindmapRules};delete n.mindmapRules;}}
  b.edges.push(connect(node.id,id));selected=node.id;
 }else if(action==='up'||action==='down'){
  const neighbor=siblings[index+(action==='up'?-1:1)];if(!neighbor)throw Error('已经到达同级边界');
  const i=b.edges.indexOf(incoming!),j=b.edges.findIndex(e=>e.kind==='branch'&&e.to===neighbor);[b.edges[i],b.edges[j]]=[b.edges[j],b.edges[i]];
 }else if(action==='indent'){
  if(!incoming||index<=0)throw Error('前面没有可作为父级的同级主题');incoming.from=siblings[index-1];delete byId.get(incoming.from)!.branchFolded;
 }else if(action==='outdent'){
  const grand=parent===undefined?undefined:parents.get(parent);if(!incoming||grand===undefined)throw Error('此主题不能再提升层级');incoming.from=grand;moveAfter(id,parent!);
 }else if(action==='duplicate'){
  const nodes=subtree(id),mapping=new Map(nodes.map(node=>[node.id,fresh()]));
  for(const node of nodes)b.nodes.push({...clone(node),id:mapping.get(node.id)!});
  for(const edge of [...b.edges])if(edge.kind==='branch'&&mapping.has(edge.from)&&mapping.has(edge.to))b.edges.push({...clone(edge),id:fresh(),from:mapping.get(edge.from)!,to:mapping.get(edge.to)!});
  selected=mapping.get(id)!;
  // A copied center becomes a branch; copies share note files, never duplicate vault files.
  b.edges.push(connect(parent??id,selected));if(parent!==undefined)moveAfter(selected,id);else delete n.branchFolded;
 }else if(action==='fold'){
  if(!children.has(id))throw Error('此主题没有子主题');n.branchFolded=!n.branchFolded;
 }else if(action==='reparent'){
  const target=values[0];if(!target||!byId.has(target)||rootOf(target)!==root)throw Error('请拖到当前主题树中的主题');reparentBranch(b,id,target,fresh());delete byId.get(target)!.branchFolded;
 }else if(action==='promote'){
  if(parent===undefined)throw Error('请保留中心主题');
  const outgoing=b.edges.filter(e=>e.kind==='branch'&&e.from===id),at=b.edges.indexOf(incoming!);
  b.edges=b.edges.filter(e=>e.from!==id&&e.to!==id);b.edges.splice(Math.min(at,b.edges.length),0,...outgoing.map(e=>({...e,from:parent})));
  b.nodes=b.nodes.filter(node=>node.id!==id);selected=parent;
 }else throw Error('未知主题操作');
 if(!(options.deferAutomaticLayout&&(action==='child'||action==='sibling')&&byId.get(root)?.mindmapRules?.automatic))layoutMindmap(b,root);
 parseBoard(JSON.stringify(b));return{board:b,root,selected};
}
/** Bounded draft history; typing is committed explicitly instead of cloning on each keystroke. */
export class TopicDraft {
 board:Board;selected:string;root:string;private undoStack:(TopicResult&{bytes:number})[]=[];private redoStack:(TopicResult&{bytes:number})[]=[];
 constructor(board:Board,id:string){this.board=clone(board);this.selected=id;this.root=mindmapRoot(board,id);}
 get canUndo(){return this.undoStack.length>0;}get canRedo(){return this.redoStack.length>0;}
 private snapshot():TopicResult&{bytes:number}{return {board:this.board,root:this.root,selected:this.selected,bytes:JSON.stringify(this.board).length*2};}
 private install(next:TopicResult){this.board=next.board;this.root=next.root;this.selected=next.selected;}
 commit(next:TopicResult){this.undoStack.push(this.snapshot());this.redoStack=[];this.install(next);let bytes=0;for(let i=this.undoStack.length-1;i>=0;i--){bytes+=this.undoStack[i].bytes;if(this.undoStack.length-i>20||bytes>16_000_000){this.undoStack.splice(0,i+1);break;}}}
 act(action:TopicAction,values?:readonly string[]){this.commit(editTopic(this.board,this.selected,action,values));}
 rename(text:string,fit?:(node:Card)=>void){const node=this.board.nodes.find(n=>n.id===this.selected);if(node?.locked)throw Error('主题已锁定');if(!node||node.kind!=='text')throw Error('笔记请使用 Obsidian 编辑器编辑原文');if(!text.trim()||text.length>10000)throw Error('请输入 1–10,000 字符');if(text===node.text)return;const b=clone(this.board);const changed=b.nodes.find(n=>n.id===node.id)!;changed.text=text;if(fit){fit(changed);layoutMindmap(b,this.root);}this.commit({board:b,root:this.root,selected:this.selected});}
 undo(){const next=this.undoStack.pop();if(next){this.redoStack.push(this.snapshot());this.install(next);}}
 redo(){const next=this.redoStack.pop();if(next){this.undoStack.push(this.snapshot());this.install(next);}}
}
