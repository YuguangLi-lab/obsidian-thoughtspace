import {App,Modal,setIcon} from 'obsidian';
import {themeSurface} from './ui-tokens';
import {editorMatches,editorReplacement,editorMatchLines,editorSearchSeed,SearchRange} from './editor-search';
export interface EditorSearchHost {
 read:()=>{text:string;start:number;end:number;disabledReason?:string};
 apply:(expected:string,change:NonNullable<ReturnType<typeof editorReplacement>>)=>void;
 locate:(expected:string,range:SearchRange)=>void;
}
/** Owns a bounded snapshot; commits only after the editor confirms it is still current. */
export class EditorSearchModal extends Modal {
 private lines:number[]=[];private composing=false;private pendingReset=false;
 private expected='';private selectedRange?:SearchRange;private matches:SearchRange[]=[];private active=0;private closed=false;private busy=false;private timer?:number;
 private matchSnapshot?:{text:string;query:string;caseSensitive:boolean;wholeWord:boolean;from?:number;to?:number};
 private query!:HTMLInputElement;private replacement!:HTMLInputElement;private sensitive!:HTMLInputElement;private whole!:HTMLInputElement;private scoped!:HTMLInputElement;
 private status!:HTMLElement;private preview!:HTMLElement;private error!:HTMLElement;private actions:HTMLButtonElement[]=[];
 constructor(app:App,private host:EditorSearchHost,private done:()=>void){super(app);const state=host.read();if(state.disabledReason)throw Error(state.disabledReason);if(state.text.length>2000000)throw Error('当前内容超过 2,000,000 字符，请使用 Obsidian 原生查找');this.expected=state.text;if(state.end>state.start)this.selectedRange={from:state.start,to:state.end};}
 private button(parent:HTMLElement,label:string,icon:string,run:()=>void){const b=parent.createEl('button',{attr:{'aria-label':label,title:label}});setIcon(b.createSpan(),icon);b.createSpan({text:label});b.onclick=()=>{if(!this.closed&&!this.busy)this.run(run);};return b;}
 private run(action:()=>void){try{this.error.empty();action();}catch(e){this.error.setText(e instanceof Error?e.message:String(e));}}
 onOpen(){
  themeSurface(this.modalEl);this.modalEl.addClass('ts-editor-search');this.titleEl.setText('查找与替换');
  const form=this.contentEl.createDiv('ts-editor-search-fields');
  const field=(label:string)=>{const row=form.createEl('label');row.createSpan({text:label});return row.createEl('input',{type:'text',attr:{'aria-label':label}});};
  this.query=field('查找文字');this.query.maxLength=1000;this.replacement=field('替换为');this.replacement.maxLength=10000;this.replacement.placeholder='留空则删除匹配文字';
  if(this.selectedRange&&this.selectedRange.to-this.selectedRange.from<=1000)this.query.value=editorSearchSeed(this.expected,this.selectedRange.from,this.selectedRange.to);
  const options=this.contentEl.createDiv('ts-editor-search-options');
  const toggle=(label:string)=>{const l=options.createEl('label'),input=l.createEl('input',{type:'checkbox'});l.createSpan({text:label});input.setAttribute('aria-label',label);input.onchange=()=>{this.pendingReset=true;if(!this.composing)this.settle();};return input;};
  this.sensitive=toggle('区分大小写');this.whole=toggle('整词匹配');this.whole.title='匹配前后不能紧邻字母、汉字、数字或下划线';this.scoped=toggle('仅选中文字');this.scoped.disabled=!this.selectedRange;
  const nav=this.contentEl.createDiv('ts-editor-search-nav');this.status=nav.createSpan({attr:{role:'status','aria-live':'polite'}});
  this.actions.push(this.button(nav,'上一处','chevron-up',()=>this.step(-1)),this.button(nav,'下一处','chevron-down',()=>this.step(1)));
  this.preview=this.contentEl.createDiv('ts-editor-search-preview');this.error=this.contentEl.createDiv({cls:'ts-editor-search-error',attr:{role:'alert'}});
  const footer=this.contentEl.createDiv('ts-editor-search-footer');this.button(footer,'刷新内容','refresh-cw',()=>this.refresh());
  this.actions.push(this.button(footer,'定位原文','crosshair',()=>{this.validate();const match=this.matches[this.active];if(match){this.host.locate(this.expected,match);this.close();}}));
  this.actions.push(this.button(footer,'替换此处','replace',()=>this.replace(false)),this.button(footer,'全部替换','replace-all',()=>this.replace(true)));
  this.actions.at(-1)!.addClass('mod-cta');
  this.contentEl.createDiv({cls:'ts-editor-search-hint',text:'按源码字面匹配，包含代码、链接和属性。先检查预览；替换可在编辑器中撤销。'});
  this.query.oninput=()=>this.schedule(true);this.replacement.oninput=()=>this.schedule(false);
  for(const input of [this.query,this.replacement]){
   input.addEventListener('compositionstart',()=>{this.composing=true;this.contentEl.win.clearTimeout(this.timer);this.timer=undefined;this.actions.forEach(b=>b.disabled=true);});
   input.addEventListener('compositionend',()=>{this.composing=false;this.schedule(input===this.query);});
  }
  this.query.onkeydown=e=>{if(this.composing||e.isComposing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey||e.key!=='Enter')return;e.preventDefault();if(this.timer!==undefined)this.settle();else this.step(e.shiftKey?-1:1);};
  this.render();this.query.focus();this.query.select();
 }
 private schedule(reset:boolean){if(this.closed)return;this.contentEl.win.clearTimeout(this.timer);this.timer=undefined;this.pendingReset ||= reset;this.actions.forEach(b=>b.disabled=true);if(this.composing)return;this.timer=this.contentEl.win.setTimeout(()=>this.settle(),120);}
 private settle(){this.contentEl.win.clearTimeout(this.timer);this.timer=undefined;if(this.closed||this.composing)return;const reset=this.pendingReset;this.pendingReset=false;if(reset)this.active=0;this.render(reset);}
 private validate(){if(this.closed||this.composing)throw Error(this.composing?'请先完成输入法组字':'查找窗口已关闭');const current=this.host.read();if(current.disabledReason)throw Error(current.disabledReason);if(current.text!==this.expected)throw Error('编辑内容已变化，请刷新后检查预览再替换');}
 /** Reuse only the exact search snapshot; validation against the live editor still runs before every action. */
 private currentMatches(){
  const range=this.scoped.checked?this.selectedRange:undefined,next={text:this.expected,query:this.query.value,caseSensitive:this.sensitive.checked,wholeWord:this.whole.checked,from:range?.from,to:range?.to},old=this.matchSnapshot;
  if(old&&old.text===next.text&&old.query===next.query&&old.caseSensitive===next.caseSensitive&&old.wholeWord===next.wholeWord&&old.from===next.from&&old.to===next.to)return this.matches;
  const matches=editorMatches(next.text,next.query,{caseSensitive:next.caseSensitive,wholeWord:next.wholeWord,range});
  this.lines=editorMatchLines(next.text,matches);this.matches=matches;this.matchSnapshot=next;return matches;
 }
 private render(recalculate=true,nextFrom?:number){if(this.closed)return;this.error.empty();this.preview.empty();
  try{this.validate();if(recalculate)this.currentMatches();}
  catch(e){this.matches=[];this.lines=[];this.matchSnapshot=undefined;this.error.setText(e instanceof Error?e.message:String(e));}
  if(nextFrom!==undefined)this.active=Math.max(0,this.matches.findIndex(m=>m.from>=nextFrom));
  this.active=Math.max(0,Math.min(this.active,this.matches.length-1));this.status.setText(this.matches.length?`${this.active+1} / ${this.matches.length} 处`:(this.query.value?'没有匹配':'输入文字开始查找'));this.actions.forEach(b=>b.disabled=!this.matches.length||this.busy);
  const m=this.matches[this.active];if(!m)return;
  const line=this.lines[this.active];this.preview.createEl('small',{text:`第 ${line} 行 · ${this.scoped.checked?'所选范围':'整篇内容'}`});
  const before=this.expected.slice(Math.max(0,m.from-90),m.from),after=this.expected.slice(m.to,m.to+90);
  const original=this.preview.createEl('pre');original.appendText(before);original.createEl('mark',{text:this.expected.slice(m.from,m.to)});original.appendText(after);
  this.preview.createEl('small',{text:`替换预览 · 全部替换将处理 ${this.matches.length} 处`});const next=this.preview.createEl('pre');next.appendText(before);next.createEl('ins',{text:this.replacement.value||'〔删除匹配文字〕'});next.appendText(after);
 }
 private step(delta:number){if(!this.matches.length)return;this.active=(this.active+delta+this.matches.length)%this.matches.length;this.render(false);}
 private refresh(){if(this.composing)return;this.contentEl.win.clearTimeout(this.timer);this.timer=undefined;this.pendingReset=false;const s=this.host.read();if(s.disabledReason)throw Error(s.disabledReason);if(s.text.length>2000000)throw Error('当前内容超过 2,000,000 字符，请使用 Obsidian 原生查找');if(s.text!==this.expected){this.selectedRange=undefined;this.scoped.checked=false;this.scoped.disabled=true;}this.expected=s.text;this.active=0;this.render();}
 private replace(all:boolean){
  this.validate();const current=this.currentMatches();
  const chosen=all?current:current.slice(this.active,this.active+1),plan=editorReplacement(this.expected,chosen,this.replacement.value);if(!plan)return;
  const result=this.expected.slice(0,plan.from)+plan.text+this.expected.slice(plan.to);if(result===this.expected){this.step(1);return;}
  this.busy=true;try{this.host.apply(this.expected,plan);if(this.closed)return;this.expected=result;if(this.selectedRange){if(this.scoped.checked)this.selectedRange.to+=plan.delta;else{this.selectedRange=undefined;this.scoped.checked=false;this.scoped.disabled=true;}}
   this.active=0;this.render(true,all?undefined:plan.from+this.replacement.value.length);this.status.setText(`已替换 ${plan.count} 处 · 剩余 ${this.matches.length} 处`);this.query.focus({preventScroll:true});
  }finally{this.busy=false;this.actions.forEach(b=>b.disabled=!this.matches.length);}
 }
 onClose(){this.closed=true;this.contentEl.win.clearTimeout(this.timer);this.expected='';this.matches=[];this.lines=[];this.matchSnapshot=undefined;this.pendingReset=false;this.selectedRange=undefined;this.actions=[];this.contentEl.empty();this.done();}
}
