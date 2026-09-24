import {setIcon} from 'obsidian';
import {colorNames,type Edge} from './model';
import type {SelectionEdgePatch} from './selection-edges';

/** Single and batch selection share controls; callers revalidate their live scope. */
export function renderEdgeFormatControls(host:HTMLElement,edges:readonly Edge[],blocked:boolean,apply:(patch:SelectionEdgePatch)=>void){
 const group=host.createDiv({cls:'ts-edge-format-group',attr:{role:'group','aria-label':'连线外观'}});
 const select=(label:string,short:string,icon:string,options:Record<string,string>,values:string[],patch:(value:string)=>SelectionEdgePatch)=>{
  const field=group.createEl('label',{cls:'ts-format-field',attr:{'data-format':label,title:label}});
  setIcon(field.createSpan({cls:'ts-format-label-icon',attr:{'aria-hidden':'true'}}),icon);
  field.createSpan({cls:'ts-format-label',text:short});
  const input=field.createEl('select',{attr:{'aria-label':label,title:label}}),same=values.every(value=>value===values[0]);
  if(!same)input.createEl('option',{value:'',text:'混合'}).disabled=true;
  for(const[value,text]of Object.entries(options))input.createEl('option',{value,text});
  input.value=same?values[0]??'':'';input.disabled=blocked||!edges.length;
  input.onchange=()=>{if(input.isConnected&&!input.disabled&&Object.hasOwn(options,input.value))apply(patch(input.value));};
 };
 select('连线路径','路径','git-commit-horizontal',{curve:'曲线',straight:'直线',elbow:'圆角折线'},edges.map(e=>e.style||'curve'),value=>({style:value as Edge['style']}));
 select('连线方向','箭头','arrow-right',{forward:'单向',both:'双向',none:'无箭头'},edges.map(e=>e.direction||'forward'),value=>({direction:value as Edge['direction']}));
 select('连线线型','线型','ellipsis',{solid:'实线',dashed:'虚线'},edges.map(e=>e.dashed?'dashed':'solid'),value=>({dashed:value==='dashed'}));
 select('连线颜色','颜色','palette',{default:'默认',...colorNames},edges.map(e=>e.color||'default'),value=>({color:value==='default'?undefined:value as Edge['color']}));
 return group;
}
