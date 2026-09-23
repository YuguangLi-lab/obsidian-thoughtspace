import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyBoardMousePreset,boardInputPreferenceKeys,cleanBoardPreferences,defaultBoardPreferences,resetBoardInputPreferences,resetBoardPagePreferences} from '../src/board-experience';
import {cleanPluginSettings} from '../src/plugin-settings';

test('older preferences acquire the default mouse map and quick keys without changing existing choices',()=>{
 const settings=cleanBoardPreferences({wheelMode:'pan',zoomSpeed:1.5,gridStep:32});
 assert.deepEqual([settings.leftDrag,settings.rightDrag,settings.middleDrag],['pan','select','pan']);
 assert.equal(settings.reverseWheelZoom,false);assert.equal(settings.boardQuickKeys,true);
 assert.equal(settings.wheelMode,'pan');assert.equal(settings.zoomSpeed,1.5);assert.equal(settings.gridStep,32);
 assert.equal(settings.panSpeed,1);assert.equal(settings.reverseWheelPan,false);assert.equal(settings.zoomAnchor,'pointer');assert.equal(settings.dragThreshold,4);assert.equal(settings.arrowNudge,true);assert.equal(settings.deleteKeys,true);
});
test('each mouse button accepts all supported actions independently and round-trips as JSON',()=>{
 for(const action of ['pan','select','none'] as const){
  const raw={leftDrag:action,rightDrag:action,middleDrag:action,reverseWheelZoom:true,boardQuickKeys:false};
  const settings=cleanBoardPreferences(JSON.parse(JSON.stringify(raw)));
  assert.deepEqual([settings.leftDrag,settings.rightDrag,settings.middleDrag],[action,action,action]);
  assert.equal(settings.reverseWheelZoom,true);assert.equal(settings.boardQuickKeys,false);
 }
});
test('malformed mouse and keyboard settings fall back instead of coercing untrusted values',()=>{
 for(const invalid of [null,undefined,{},[],42,true,'PAN','drag','',()=> 'pan']){
  const settings=cleanBoardPreferences({leftDrag:invalid,rightDrag:invalid,middleDrag:invalid,reverseWheelZoom:invalid,boardQuickKeys:invalid});
  assert.deepEqual([settings.leftDrag,settings.rightDrag,settings.middleDrag],['pan','select','pan']);
  if(typeof invalid!=='boolean'){assert.equal(settings.reverseWheelZoom,false);assert.equal(settings.boardQuickKeys,true);}
 }
 assert.equal(cleanBoardPreferences({reverseWheelZoom:'false',boardQuickKeys:0}).reverseWheelZoom,false);
 assert.equal(cleanBoardPreferences({reverseWheelZoom:'false',boardQuickKeys:0}).boardQuickKeys,true);
});
test('cleaning input settings creates independent values and never changes the defaults or caller object',()=>{
 const raw=Object.freeze({leftDrag:'none',rightDrag:'pan',middleDrag:'select',reverseWheelZoom:true,boardQuickKeys:false});
 const before=JSON.stringify(defaultBoardPreferences),settings=cleanBoardPreferences(raw);settings.leftDrag='pan';
 assert.equal(raw.leftDrag,'none');assert.equal(JSON.stringify(defaultBoardPreferences),before);
 assert.equal(cleanBoardPreferences(raw).leftDrag,'none');
});
test('plugin preference loading retains the new input preferences alongside existing persisted settings',()=>{
 const settings=cleanPluginSettings({leftDrag:'select',rightDrag:'none',middleDrag:'none',reverseWheelZoom:true,boardQuickKeys:false,wheelMode:'pan',zoomSpeed:.5,panSpeed:1.5,reverseWheelPan:true,zoomAnchor:'center',dragThreshold:8,arrowNudge:false,deleteKeys:false});
 assert.deepEqual([settings.leftDrag,settings.rightDrag,settings.middleDrag],['select','none','none']);
 assert.equal(settings.reverseWheelZoom,true);assert.equal(settings.boardQuickKeys,false);assert.equal(settings.wheelMode,'pan');assert.equal(settings.zoomSpeed,.5);
 assert.equal(settings.panSpeed,1.5);assert.equal(settings.reverseWheelPan,true);assert.equal(settings.zoomAnchor,'center');assert.equal(settings.dragThreshold,8);assert.equal(settings.arrowNudge,false);assert.equal(settings.deleteKeys,false);
});
test('restoring mouse and keyboard defaults preserves all unrelated preferences and data',()=>{
 const settings={...cleanBoardPreferences({leftDrag:'none',rightDrag:'pan',middleDrag:'select',wheelMode:'pan',zoomSpeed:1.5,reverseWheelZoom:true,boardQuickKeys:false,panSpeed:2,reverseWheelPan:true,zoomAnchor:'center',dragThreshold:12,arrowNudge:false,deleteKeys:false,nudgeStep:5,fastNudge:50,gridStep:48,defaultTextSize:24,showPorts:false}),custom:'unchanged'};
 resetBoardInputPreferences(settings);
 assert.deepEqual([settings.leftDrag,settings.rightDrag,settings.middleDrag],['pan','select','pan']);
 assert.equal(settings.wheelMode,'zoom');assert.equal(settings.zoomSpeed,1);assert.equal(settings.reverseWheelZoom,false);assert.equal(settings.boardQuickKeys,true);
 assert.equal(settings.gridStep,48);assert.equal(settings.defaultTextSize,24);assert.equal(settings.showPorts,false);assert.equal(settings.custom,'unchanged');
 for(const key of boardInputPreferenceKeys)assert.equal(settings[key],defaultBoardPreferences[key],key);
});
test('wheel speed and drag threshold reject coercion and nonfinite values, and clamp both bounds',()=>{
 for(const invalid of [null,'2',{},[],NaN,Infinity,-Infinity]){const settings=cleanBoardPreferences({panSpeed:invalid,dragThreshold:invalid});assert.equal(settings.panSpeed,1);assert.equal(settings.dragThreshold,4);}
 const low=cleanBoardPreferences({panSpeed:-100,dragThreshold:0}),high=cleanBoardPreferences({panSpeed:99,dragThreshold:99});
 assert.equal(low.panSpeed,.3);assert.equal(low.dragThreshold,2);assert.equal(high.panSpeed,3);assert.equal(high.dragThreshold,12);
 const valid=cleanBoardPreferences({panSpeed:.5,dragThreshold:6});assert.equal(valid.panSpeed,.5);assert.equal(valid.dragThreshold,6);
});
test('zoom anchor and direct-key toggles retain only valid persisted types',()=>{
 for(const invalid of [null,undefined,{},42,'mouse','CENTER'])assert.equal(cleanBoardPreferences({zoomAnchor:invalid}).zoomAnchor,'pointer');
 for(const invalid of ['false',0,null,{}]){const settings=cleanBoardPreferences({reverseWheelPan:invalid,arrowNudge:invalid,deleteKeys:invalid});assert.equal(settings.reverseWheelPan,false);assert.equal(settings.arrowNudge,true);assert.equal(settings.deleteKeys,true);}
});
test('separate board page reset preserves every input field, including relocated nudge steps',()=>{
 const settings=cleanBoardPreferences({leftDrag:'none',rightDrag:'pan',middleDrag:'none',wheelMode:'pan',zoomSpeed:.5,reverseWheelZoom:true,boardQuickKeys:false,panSpeed:2,reverseWheelPan:true,zoomAnchor:'center',dragThreshold:12,arrowNudge:false,deleteKeys:false,nudgeStep:5,fastNudge:50,gridStep:48,defaultTextSize:24,showPorts:false});
 const before={...settings};resetBoardPagePreferences(settings,false);
 for(const key of boardInputPreferenceKeys)assert.equal(settings[key],before[key],key);
 assert.equal(settings.gridStep,24);assert.equal(settings.defaultTextSize,16);assert.equal(settings.showPorts,true);
});
test('legacy combined board page resets only its visible wheel and nudge controls among input settings',()=>{
 const settings=cleanBoardPreferences({leftDrag:'none',wheelMode:'pan',zoomSpeed:.5,nudgeStep:5,fastNudge:50,panSpeed:2,zoomAnchor:'center',dragThreshold:12,deleteKeys:false});
 resetBoardPagePreferences(settings);
 assert.equal(settings.wheelMode,'zoom');assert.equal(settings.zoomSpeed,1);assert.equal(settings.nudgeStep,1);assert.equal(settings.fastNudge,10);
 assert.equal(settings.leftDrag,'none');assert.equal(settings.panSpeed,2);assert.equal(settings.zoomAnchor,'center');assert.equal(settings.dragThreshold,12);assert.equal(settings.deleteKeys,false);
});
test('mouse presets affect only the intended gesture and wheel settings',()=>{
 for(const preset of ['default','leftSelect','trackpad'] as const){
  const settings={...cleanBoardPreferences({leftDrag:'none',rightDrag:'none',middleDrag:'none',wheelMode:'zoom',zoomSpeed:.5,panSpeed:3,reverseWheelZoom:true,reverseWheelPan:true,zoomAnchor:'center',dragThreshold:12,boardQuickKeys:false,arrowNudge:false,deleteKeys:false,nudgeStep:5,fastNudge:50,gridStep:48,showPorts:false}),content:'preserved'};
  const before={...settings};applyBoardMousePreset(settings,preset);
  assert.deepEqual([settings.leftDrag,settings.rightDrag,settings.middleDrag],preset==='leftSelect'?['select','pan','pan']:['pan','select','pan']);
  assert.equal(settings.wheelMode,preset==='trackpad'?'pan':'zoom');assert.equal(settings.zoomSpeed,1);assert.equal(settings.panSpeed,1);assert.equal(settings.reverseWheelZoom,false);assert.equal(settings.reverseWheelPan,false);assert.equal(settings.zoomAnchor,'pointer');assert.equal(settings.dragThreshold,4);
  for(const key of ['boardQuickKeys','arrowNudge','deleteKeys','nudgeStep','fastNudge','gridStep','showPorts','content'] as const)assert.equal(settings[key],before[key],`${preset}: ${key}`);
 }
});
