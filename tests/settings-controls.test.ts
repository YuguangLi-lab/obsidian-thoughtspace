import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {applyBoardMousePreset,cleanBoardPreferences,defaultBoardPreferences,resetBoardInputPreferences,resetBoardPagePreferences,type BoardPreferences} from '../src/board-experience';

class Element{
 texts:string[]=[];rows:Setting[]=[];
 createEl(_tag:string,options:{text?:string}){this.texts.push(options.text||'');return new Element();}
 empty(){this.texts=[];this.rows=[];}
 allText(){return [...this.texts,...this.rows.flatMap(row=>[row.name,row.desc,...row.buttons.map(button=>button.text),...Object.values(row.dropdown?.options||{})])].join('\n');}
}
class Dropdown{
 options:Record<string,string>={};value='';change?:(value:string)=>void;
 addOptions(options:Record<string,string>){this.options={...options};return this;}
 setValue(value:string){this.value=value in this.options?value:'';return this;}
 onChange(callback:(value:string)=>void){this.change=callback;return this;}
}
class Toggle{
 value=false;change?:(value:boolean)=>void;
 setValue(value:boolean){this.value=value;return this;}
 onChange(callback:(value:boolean)=>void){this.change=callback;return this;}
}
class Button{
 text='';click?:()=>void;
 setButtonText(text:string){this.text=text;return this;}
 onClick(callback:()=>void){this.click=callback;return this;}
}
class Setting{
 name='';desc='';buttons:Button[]=[];dropdown?:Dropdown;toggle?:Toggle;settingEl={dataset:{} as Record<string,string>};
 constructor(el:Element){el.rows.push(this);}
 setName(value:string){this.name=value;return this;}
 setDesc(value:string){this.desc=value;return this;}
 addDropdown(callback:(control:Dropdown)=>void){this.dropdown=new Dropdown();callback(this.dropdown);return this;}
 addToggle(callback:(control:Toggle)=>void){this.toggle=new Toggle();callback(this.toggle);return this;}
 addButton(callback:(button:Button)=>void){const button=new Button();this.buttons.push(button);callback(button);return this;}
}
const notices:string[]=[];
class Notice{constructor(message:string){notices.push(message);}}
const text=readFileSync('src/board-experience-view.ts','utf8');
const source=text.slice(text.indexOf('type PreferenceControlOptions=')).replace(/^export /gm,'');
const deps={Setting,Notice,applyBoardMousePreset,defaultBoardPreferences,resetBoardInputPreferences,resetBoardPagePreferences};
const controls=new Function(...Object.keys(deps),transformSync(source+'\nreturn {mousePreferenceControls,boardPreferenceControls};',{loader:'ts'}).code)(...Object.values(deps));
const board=controls.boardPreferenceControls as (el:Element,settings:BoardPreferences,persist:()=>Promise<void>,options?:{language?:'zh-CN'|'en';includeMouse?:boolean;section?:'board'|'cards';hideReset?:boolean})=>void;
const mouse=controls.mousePreferenceControls as (el:Element,settings:BoardPreferences,persist:()=>Promise<void>,openHotkeys?:()=>void,options?:{language?:'zh-CN'|'en';hideReset?:boolean})=>void;
const tick=async()=>{await Promise.resolve();await Promise.resolve();};
const row=(el:Element,name:string)=>{const found=el.rows.find(item=>item.name===name);assert.ok(found,`Missing row: ${name}`);return found;};
const button=(el:Element,name:string)=>{const found=el.rows.flatMap(item=>item.buttons).find(item=>item.text===name);assert.ok(found,`Missing button: ${name}`);return found;};

test('existing controls remain Chinese by default and retain all combined board controls',()=>{
 const el=new Element();board(el,cleanBoardPreferences({}),async()=>{});
 assert.ok(row(el,'顶部工具栏密度'));assert.ok(row(el,'新卡片宽度'));assert.ok(row(el,'滚轮操作'));assert.ok(row(el,'详细预览数量'));assert.ok(button(el,'恢复默认'));
 const input=new Element();mouse(input,cleanBoardPreferences({}),async()=>{});
 assert.ok(row(input,'常用鼠标方案'));assert.ok(row(input,'方向键步长'));assert.ok(button(input,'恢复默认'));
});
test('English board and input controls translate headings, labels, descriptions, choices and buttons',()=>{
 const boardEl=new Element(),inputEl=new Element();
 board(boardEl,cleanBoardPreferences({}),async()=>{},{language:'en'});
 mouse(inputEl,cleanBoardPreferences({}),async()=>{},()=>{},{language:'en'});
 assert.doesNotMatch(boardEl.allText()+inputEl.allText(),/[\u3400-\u9fff]/);
 assert.ok(row(boardEl,'New card width'));assert.ok(row(inputEl,'Mouse presets'));assert.ok(button(inputEl,'Open hotkey settings'));
});
test('split sections contain only their assigned controls and can omit local reset actions',()=>{
 const boardEl=new Element(),cardEl=new Element(),inputEl=new Element(),settings=cleanBoardPreferences({});
 board(boardEl,settings,async()=>{},{section:'board',includeMouse:false,hideReset:true,language:'en'});
 board(cardEl,settings,async()=>{},{section:'cards',hideReset:true,language:'en'});
 mouse(inputEl,settings,async()=>{},undefined,{hideReset:true,language:'en'});
 assert.deepEqual(cardEl.rows.map(item=>item.name),['New card width','New text size','New connection path','New connection arrows']);
 assert.ok(row(boardEl,'Grid spacing'));assert.ok(row(boardEl,'Detailed preview limit'));
 assert.equal(boardEl.rows.some(item=>item.name==='New card width'||item.name==='Scroll action'),false);
 for(const el of [boardEl,cardEl,inputEl])assert.equal(el.rows.flatMap(item=>item.buttons).some(item=>item.text==='Restore defaults'),false);
});
test('every saved intermediate numeric preference appears as a valid selected dropdown option',()=>{
 const settings=cleanBoardPreferences({dragThreshold:3,panSpeed:1.2,zoomSpeed:.8,nudgeStep:3,fastNudge:30,gridStep:30,defaultCardWidth:275,defaultTextSize:17,previewLimit:75,detailZoom:.55});
 const input=new Element(),all=new Element();mouse(input,settings,async()=>{},undefined,{language:'en'});board(all,settings,async()=>{},{language:'en'});
 for(const [name,value]of [['Drag threshold',3],['Scroll pan speed',1.2],['Zoom sensitivity',.8],['Arrow-key step',3],['Fast arrow-key step',30]] as const){
  const control=row(input,name).dropdown!;assert.equal(control.value,String(value));assert.equal(control.options[String(value)],`Current: ${value}`);
 }
 for(const [name,value]of [['Grid spacing',30],['New card width',275],['New text size',17],['Detailed preview limit',75],['Detailed preview zoom threshold',.55]] as const)assert.equal(row(all,name).dropdown!.value,String(value));
 assert.doesNotMatch(input.allText()+all.allText(),/[\u3400-\u9fff]/);
});
test('dropdowns and toggles persist their original typed values and hotkey action is forwarded',async()=>{
 const el=new Element(),settings=cleanBoardPreferences({});let saves=0,hotkeys=0;
 mouse(el,settings,async()=>{saves++;},()=>{hotkeys++;},{language:'en'});
 row(el,'Zoom sensitivity').dropdown!.change!('1.5');row(el,'Zoom anchor').dropdown!.change!('center');row(el,'Reverse scroll zoom').toggle!.change!(true);button(el,'Open hotkey settings').click!();await tick();
 assert.equal(settings.zoomSpeed,1.5);assert.equal(settings.zoomAnchor,'center');assert.equal(settings.reverseWheelZoom,true);assert.equal(saves,3);assert.equal(hotkeys,1);
});
test('mouse preset refresh preserves the chosen language and hidden reset option',async()=>{
 const el=new Element(),settings=cleanBoardPreferences({boardQuickKeys:false,gridStep:48});let saves=0;
 mouse(el,settings,async()=>{saves++;},undefined,{language:'en',hideReset:true});
 button(el,'Trackpad').click!();await tick();
 assert.equal(settings.wheelMode,'pan');assert.equal(settings.boardQuickKeys,false);assert.equal(settings.gridStep,48);assert.equal(saves,1);
 assert.doesNotMatch(el.allText(),/[\u3400-\u9fff]/);assert.equal(el.rows.some(item=>item.name==='Reset mouse and keyboard'),false);
});
test('card-only reset preserves board, input and root-owned card style settings',async()=>{
 const el=new Element(),settings=cleanBoardPreferences({defaultCardWidth:420,defaultTextSize:24,defaultEdgeStyle:'straight',defaultEdgeDirection:'both',defaultCardStyle:'index',gridStep:48,leftDrag:'none'});let saves=0;
 board(el,settings,async()=>{saves++;},{section:'cards',language:'en'});button(el,'Restore defaults').click!();await tick();
 for(const key of ['defaultCardWidth','defaultTextSize','defaultEdgeStyle','defaultEdgeDirection'] as const)assert.equal(settings[key],defaultBoardPreferences[key]);
 assert.equal(settings.defaultCardStyle,'index');assert.equal(settings.gridStep,48);assert.equal(settings.leftDrag,'none');assert.equal(saves,1);
 assert.equal(el.rows.length,5);assert.doesNotMatch(el.allText(),/[\u3400-\u9fff]/);
});
test('board-only reset restores displayed fields without resetting hidden cards or mouse controls',async()=>{
 const el=new Element(),settings=cleanBoardPreferences({defaultCardWidth:420,defaultCardStyle:'sticky',wheelMode:'pan',nudgeStep:5,gridStep:48,showPorts:false});
 board(el,settings,async()=>{},{section:'board',includeMouse:false,language:'en'});button(el,'Restore defaults').click!();await tick();
 assert.equal(settings.gridStep,24);assert.equal(settings.showPorts,true);assert.equal(settings.defaultCardWidth,420);assert.equal(settings.defaultCardStyle,'sticky');assert.equal(settings.wheelMode,'pan');assert.equal(settings.nudgeStep,5);
 assert.equal(el.rows.some(item=>item.name==='New card width'||item.name==='Scroll action'),false);
});
test('legacy board reset behavior remains available when no section is requested',async()=>{
 const el=new Element(),settings=cleanBoardPreferences({defaultCardWidth:420,defaultCardStyle:'index',gridStep:48,wheelMode:'pan',leftDrag:'none'});
 board(el,settings,async()=>{});button(el,'恢复默认').click!();await tick();
 assert.equal(settings.defaultCardWidth,300);assert.equal(settings.defaultCardStyle,'transparent');assert.equal(settings.gridStep,24);assert.equal(settings.wheelMode,'zoom');assert.equal(settings.leftDrag,'none');
});
test('failed saves report a localized notice and preserve the error detail',async()=>{
 const english=new Element(),chinese=new Element();notices.length=0;
 board(english,cleanBoardPreferences({}),async()=>{throw Error('disk unavailable');},{language:'en'});
 mouse(chinese,cleanBoardPreferences({}),async()=>{throw Error('磁盘不可写');});
 row(english,'Grid spacing').dropdown!.change!('32');row(chinese,'方向键移动对象').toggle!.change!(false);await tick();
 assert.equal(notices[0],'Could not save preferences: Error: disk unavailable');assert.equal(notices[1],'保存设置失败: Error: 磁盘不可写');
});
