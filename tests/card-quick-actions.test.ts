import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCardQuickActions, type CardQuickActionsOptions} from '../src/card-quick-actions';

// Node's EventTarget exercises stopPropagation/default prevention without loading
// Obsidian. Layout, native focus and DOM bubbling still require the app QA pass.
class Control extends EventTarget {
  attributes=new Map<string,string>();
  classes=new Set<string>();
  classList={toggle:(name:string,force:boolean)=>{if(force)this.classes.add(name);else this.classes.delete(name);return force;}};
  disabled=false;
  type='';
  title='';
  constructor(public label='',public icon='',public callback:()=>unknown=()=>{}){super();}
  setAttribute(name:string,value:string){this.attributes.set(name,value);}
  getAttribute(name:string){return this.attributes.get(name)??null;}
  click(){if(!this.disabled)return this.callback();}
}

function fixture(overrides:Partial<Omit<CardQuickActionsOptions,'add'>>={}){
  const actions=new Control(),buttons:Control[]=[],calls:string[]=[];
  const invoke=(name:string)=>()=>{calls.push(name);};
  const controls=mountCardQuickActions(actions as unknown as HTMLElement,{
    kind:'card',autoFit:false,edit:invoke('edit'),read:invoke('read'),preview:invoke('preview'),
    toggleAutoFit:invoke('autoFit'),fold:invoke('fold'),...overrides,
    add:(label,icon,callback,className)=>{
      const button=new Control(label,icon,callback);
      className.split(/\s+/).forEach(name=>button.classes.add(name));buttons.push(button);
      return button as unknown as HTMLButtonElement;
    }
  });
  return{actions,buttons,calls,controls};
}

test('note controls expose five explicit actions and forward each callback once',()=>{
  const f=fixture();
  assert.deepEqual(f.buttons.map(button=>button.icon),['pencil','panel-right-open','eye','scan-text','chevron-up']);
  assert.deepEqual(f.buttons.map(button=>button.label),[
    '编辑笔记','在右侧阅读笔记','阅读与关联',
    '自动适应大小（按内容调整，长文可滚动）','折叠卡片'
  ]);
  for(const button of f.buttons)button.click();
  assert.deepEqual(f.calls,['edit','read','preview','autoFit','fold']);
  assert.equal(f.controls.read,f.buttons[1]);
  assert.equal(f.controls.fold,f.buttons[4]);
});

test('text controls omit unavailable note operations and keep their height-only sizing language',()=>{
  const f=fixture({kind:'text',read:undefined,preview:undefined});
  assert.deepEqual(f.buttons.map(button=>button.label),[
    '编辑文本','自动适应高度（保持宽度，随正文增减）','折叠文本'
  ]);
  assert.equal(f.controls.read,undefined);assert.equal(f.controls.preview,undefined);
  assert.ok((f.controls.autoFit as unknown as Control).classes.has('ts-text-auto-height'));
  assert.equal((f.controls.autoFit as unknown as Control).icon,'move-vertical');
});

test('automatic sizing exposes current state and explains that turning it off preserves the size',()=>{
  for(const kind of ['card','text'] as const){
    for(const automatic of [false,true]){
      const f=fixture({kind,autoFit:automatic});
      const sizing=f.controls.autoFit as unknown as Control;
      assert.equal(sizing.getAttribute('aria-pressed'),String(automatic));
      assert.equal(sizing.classes.has('is-active'),automatic);
      if(automatic)assert.equal(sizing.label,`关闭自动适应${kind==='text'?'高度':'大小'}（保留当前尺寸）`);
    }
  }
});

test('locked and read-only cards disable mutations while keeping both reading entries available',()=>{
  for(const state of [{locked:true},{readOnly:true},{locked:true,readOnly:true}]){
    const f=fixture(state);
    assert.deepEqual(f.buttons.map(button=>button.disabled),[true,false,false,true,true]);
    for(const button of f.buttons)button.click();
    assert.deepEqual(f.calls,['read','preview']);
  }
});

test('editable cards have enabled mutation controls',()=>{
  const f=fixture({locked:false,readOnly:false});
  assert.ok(f.buttons.every(button=>!button.disabled));
});

test('missing callbacks never advertise unavailable edit, reading or sizing actions',()=>{
  const f=fixture({edit:undefined,read:undefined,preview:undefined,toggleAutoFit:undefined});
  assert.equal(f.buttons.length,1);assert.equal(f.buttons[0].label,'折叠卡片');
  assert.equal(f.controls.edit,undefined);assert.equal(f.controls.autoFit,undefined);
});

test('fold controls expose the rendered expansion state for notes and text',()=>{
  for(const kind of ['card','text'] as const){
    for(const collapsed of [false,true]){
      const f=fixture({kind,collapsed}),fold=f.controls.fold as unknown as Control;
      assert.equal(fold.getAttribute('aria-expanded'),String(!collapsed));
      assert.equal(fold.icon,collapsed?'chevron-down':'chevron-up');
      assert.equal(fold.label,`${collapsed?'展开':'折叠'}${kind==='text'?'文本':'卡片'}`);
    }
  }
});

test('all controls have native button type, matching accessible label and tooltip',()=>{
  const f=fixture();
  assert.equal(f.actions.getAttribute('role'),'group');
  assert.equal(f.actions.getAttribute('aria-label'),'笔记卡片操作');
  assert.equal(fixture({kind:'text'}).actions.getAttribute('aria-label'),'文本卡片操作');
  for(const button of f.buttons){
    assert.equal(button.type,'button');assert.equal(button.title,button.label);
    assert.equal(button.getAttribute('aria-label'),button.label);
    assert.ok(button.classes.has('ts-icon-button'));
  }
});

test('dock padding pointer and double-click events stop before reaching board gestures without cancelling focus',()=>{
  const f=fixture();
  for(const type of ['pointerdown','dblclick']){
    let received=false,stopped=false;
    f.actions.addEventListener(type,event=>{received=true;stopped=event.cancelBubble;});
    const event=new Event(type,{bubbles:true,cancelable:true});
    assert.equal(f.actions.dispatchEvent(event),true);
    assert.equal(received,true,'local listeners can still run');
    assert.equal(stopped,true,'the board must not receive the event');
    assert.equal(event.defaultPrevented,false,'native focus must remain available');
    assert.deepEqual(f.calls,[]);
  }
});

test('keyboard events retain their native defaults and propagation',()=>{
  const f=fixture();let stopped=false;
  f.actions.addEventListener('keydown',event=>{stopped=event.cancelBubble;});
  const event=new Event('keydown',{bubbles:true,cancelable:true});
  assert.equal(f.actions.dispatchEvent(event),true);
  assert.equal(event.defaultPrevented,false);assert.equal(stopped,false);
});
