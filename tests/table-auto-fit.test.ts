import {selectionFormatKey} from '../src/selection-format';
import {emptyBoard} from '../src/model';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {textHasTable,textFitsContent} from '../src/text-sizing';
import {fitTextNode} from '../src/text-tools';
import {TextDocument} from './text-dom-fixture';
import type {Card} from '../src/model';
const table='| 项目 | 金额 |\n| --- | ---: |\n| 阅读 | 20 |';
const node=(text=table):Card=>({id:'t',kind:'text',text,x:0,y:0,width:520,height:180,color:'sand',autoSize:true});
test('tables auto-fit by default, including existing text tables',()=>{assert.equal(textFitsContent(node()),true);assert.equal(textFitsContent({...node(),autoSize:undefined}),true);});
test('manual resizing and explicit opt-out take precedence over table detection',()=>{assert.equal(textFitsContent({...node(),autoSize:false}),false);assert.equal(textFitsContent({...node(),textAutoHeight:false}),false);assert.equal(textFitsContent({...node(),autoSize:false,textAutoHeight:true}),true);});
test('table detection cache refreshes after source edits',()=>{const n=node();assert.equal(textHasTable(n),true);n.text='plain text';assert.equal(textFitsContent(n),false);n.text=table;assert.equal(textFitsContent(n),true);});
for(const [name,text] of [['fence','```md\n'+table+'\n```'],['comment','<!--\n'+table+'\n-->'],['obsidian comment','%%\n'+table+'\n%%'],['frontmatter','---\n'+table+'\n---'],['indented',table.split('\n').map(s=>'    '+s).join('\n')],['ordinary','some | words\n---']])test(`${name} does not enable table auto-fit`,()=>assert.equal(textFitsContent(node(text)),false));
test('table measurement uses intrinsic columns without mutating live preview and respects manual width',()=>{
 const doc=new TextDocument(),host=doc.createElement('div'),body=doc.createElement('div'),t=doc.createElement('table');body.dataset.markdownStatus='ready';body.appendChild(t);
 const n=node();fitTextNode(n,host as unknown as HTMLElement,body as unknown as HTMLElement);
 const frame=doc.elements.find(e=>e.classList.contains('ts-text-fit-context'))!.children[0];
 assert.equal(frame.style.maxWidth,'960px');assert.equal(frame.children[0].querySelector('table')!.style.maxWidth,'100%');assert.equal(frame.children[0].querySelector('table')!.style.display,'table');assert.equal(t.style.display,undefined);assert.equal(n.width,344);
 n.textAutoHeight=true;n.width=200;fitTextNode(n,host as unknown as HTMLElement,body as unknown as HTMLElement);assert.equal(n.width,200);
});

test('toolbar eligibility refreshes only when text changes between table and prose',()=>{
 const board=emptyBoard();board.nodes=[node('plain')];const ids=new Set(['t']),before=selectionFormatKey(board,ids,undefined);
 board.nodes[0].text='ordinary prose';assert.equal(selectionFormatKey(board,ids,undefined),before);
 board.nodes[0].text=table;const tableKey=selectionFormatKey(board,ids,undefined);assert.notEqual(tableKey,before);
 board.nodes[0].text+='\n| extra | 3 |';assert.equal(selectionFormatKey(board,ids,undefined),tableKey);
});

test('table draft measurement discards surrounding text-frame padding',()=>{
 const doc=new TextDocument();Object.assign(doc.computed,{paddingTop:'14px',paddingBottom:'14px',paddingLeft:'16px',paddingRight:'16px'});
 const host=doc.createElement('div'),body=doc.createElement('div');body.dataset.markdownStatus='ready';body.appendChild(doc.createElement('table'));
 fitTextNode(node(),host as unknown as HTMLElement,body as unknown as HTMLElement);
 const probe=doc.elements.find(e=>e.classList.contains('ts-text-fit-context'))!.children[0].children[0];
 for(const key of ['paddingTop','paddingRight','paddingBottom','paddingLeft'])assert.equal(probe.style[key],'0px');
});
