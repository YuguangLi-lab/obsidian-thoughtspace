const fs=require('node:fs'),{buildSync,transformSync}=require('esbuild'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/main.ts','utf8');
function take(start,end){const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0&&to>from,`Missing toolbar implementation: ${start}`);return source.slice(from,to);}
// Bundle real runtime dependencies, including branch visibility. Only host UI APIs
// are supplied below; control rendering, eligibility and cache behavior stay real.
const helperCode=buildSync({stdin:{contents:`
 export {selectionFormatKey} from './src/selection-format';
 export {selectionEdges,patchSelectionEdges} from './src/selection-edges';
 export {renderEdgeFormatControls} from './src/edge-format-controls';
 export {preserveToolbarFocus} from './src/toolbar-focus';
 export {markdownToolbar} from './src/markdown-toolbar';
 export {colorNames,emptyBoard} from './src/model';
`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',external:['obsidian']}).outputFiles[0].text;
const obsidian={setIcon(element,icon){element.dataset.icon=icon;},Notice:class{constructor(message){throw Error(message);}}};
const helper={exports:{}};new Function('require','module','exports',helperCode)(name=>name==='obsidian'?obsidian:require(name),helper,helper.exports);
const ui=new Function('setIcon','Notice',transformSync(take('const report =','class Prompt')+'\nreturn {button,act};',{loader:'ts'}).code)(obsidian.setIcon,obsidian.Notice);
const methods=take('  private buildSingleEdgeTools(','  refreshStyleControls()')+take('  private renderSelectionTools(){','  private renderInspector()');
const dependencies={...helper.exports,...ui};
const View=new Function(...Object.keys(dependencies),transformSync(`class View{${methods}}\nreturn View;`,{loader:'ts'}).code)(...Object.values(dependencies));

function createHarness(){
 const counts={created:0,emptied:0,changes:0},frames=new Map();let nextFrame=0;
 const document={activeElement:null,defaultView:{getComputedStyle:()=>({overflowX:'visible'}),requestAnimationFrame(fn){const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);}}};
 class El{
  constructor(tag='div'){
   this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.value='';this.text='';this.disabled=false;this.attached=true;this.scrollLeft=0;this.ownerDocument=document;this.listeners=new Map();
   const classes=new Set();this.classList={add:(...names)=>names.forEach(name=>classes.add(name)),contains:name=>classes.has(name),toggle:(name,on)=>{if(on??!classes.has(name)){classes.add(name);return true;}classes.delete(name);return false;}};
   this.style={setProperty(key,value){this[key]=value;}};
  }
  get isConnected(){return this.attached&&(!this.parentElement||this.parentElement.isConnected);}
  get options(){return this.children.filter(child=>child.tagName==='OPTION');}
  get ariaLabel(){return this.attrs['aria-label'];}
  createEl(tag,options={}){counts.created++;const child=new El(tag);child.parentElement=this;child.value=options.value??'';child.text=options.text??'';for(const[key,value]of Object.entries(options.attr||{}))child.setAttribute(key,value);if(options.type)child.setAttribute('type',options.type);if(options.cls)child.addClass(...options.cls.split(' '));this.children.push(child);return child;}
  createSpan(options={}){return this.createEl('span',typeof options==='string'?{cls:options}:options);}
  createDiv(options={}){return this.createEl('div',typeof options==='string'?{cls:options}:options);}
  empty(){counts.emptied++;for(const child of this.children)child.attached=false;this.children=[];}
  addClass(...names){this.classList.add(...names);}
  toggleClass(name,on){this.classList.toggle(name,on);}
  setText(text){this.text=text;}
  setAttribute(key,value){this.attrs[key]=String(value);}
  getAttribute(key){return this.attrs[key]??null;}
  contains(element){return element===this||this.children.some(child=>child.contains(element));}
  matches(selector){return selector.split(',').some(part=>{part=part.trim();if(part===':disabled')return this.disabled;if(part.startsWith('.'))return this.classList.contains(part.slice(1));if(part.startsWith('[')){const attr=part.slice(1,-1);return attr.startsWith('data-')?attr.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()) in this.dataset:attr in this.attrs;}return this.tagName===part.toUpperCase();});}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  focus(){document.activeElement=this;}
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener);}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
 }
 document.body=new El('body');document.activeElement=document.body;
 const view=new View(),board=helper.exports.emptyBoard(),host=new El();board.version=3;
 board.nodes=['a','b','parent'].map((id,i)=>({id,kind:'card',file:`${id}.md`,x:i*500,y:0,width:300,height:200,color:'sand'}));
 board.edges=[{id:'e',from:'a',to:'b',label:'支持',color:'sand'},{id:'branch',from:'parent',to:'a',label:'',kind:'branch'}];
 const owner={board,blocked:false,change(run){counts.changes++;run(this.board);}};
 Object.assign(view,{selectionTools:host,selected:new Set(),selectedEdge:'e',session:owner,plugin:{},requireOwner(expected){assert.equal(this.session,expected);return this.session;}});
 const control=label=>{const element=host.querySelectorAll('select').find(item=>item.ariaLabel===label);assert.ok(element,`Missing control: ${label}`);return element;};
 return{view,board,owner,host,counts,control,El};
}

function verifyEdgeStability(f){
 const{view,board,counts,control}=f;
 view.renderSelectionTools();const initialCreated=counts.created,initialControl=control('连线颜色');
 assert.equal(initialControl.disabled,false);
 for(let i=0;i<200;i++){board.viewport.x=i;board.nodes[0].x=i;view.renderSelectionTools();}
 console.log(JSON.stringify({initialCreated,...counts,frames:200}));
 assert.equal(counts.emptied,1,'pan frames must not rebuild unchanged toolbar');assert.equal(control('连线颜色'),initialControl);
 board.edges[0].color='red';view.renderSelectionTools();assert.equal(counts.emptied,2);assert.equal(control('连线颜色').value,'red');
 view.session.blocked=true;view.renderSelectionTools();assert.equal(counts.emptied,3);assert.equal(control('连线颜色').disabled,true);
 view.session={...view.session};view.renderSelectionTools();assert.equal(counts.emptied,4);
 view.session.blocked=false;view.renderSelectionTools();assert.equal(control('连线颜色').disabled,false);
 board.nodes[0].locked=true;view.renderSelectionTools();const lockedControl=control('连线颜色');assert.equal(lockedControl.disabled,true);
 delete board.nodes[0].locked;view.renderSelectionTools();assert.equal(control('连线颜色').disabled,false);assert.equal(lockedControl.isConnected,false);
 board.nodes[2].branchFolded=true;view.renderSelectionTools();assert.equal(control('连线颜色').disabled,true);
 delete board.nodes[2].branchFolded;view.renderSelectionTools();assert.equal(control('连线颜色').disabled,false);
 const endpoint=board.nodes.splice(1,1)[0];view.renderSelectionTools();assert.equal(control('连线颜色').disabled,true);
 board.nodes.splice(1,0,endpoint);view.renderSelectionTools();assert.equal(control('连线颜色').disabled,false);
 assert.equal(counts.changes,0,'refreshing controls must not edit the document');
 console.log('PASS unchanged controls retained; color/blocked/owner changes invalidate; live endpoint lock/unlock and visibility refresh');
}
module.exports={createHarness,verifyEdgeStability};
if(require.main===module)verifyEdgeStability(createHarness());
