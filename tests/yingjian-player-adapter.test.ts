import {test} from 'node:test';import assert from 'node:assert/strict';import {playInYingjianPlugin} from '../src/yingjian-player-adapter';
test('missing or incompatible player leaves desktop fallback available',async()=>{for(const player of [undefined,{}, {videoApi:{version:2,play(){throw Error('must not call')}}}])assert.equal(await playInYingjianPlugin(player,'/a.mp4',1,'a.md','vault'),false);});
test('native player receives the exact source, fractional time, note and vault identity',async()=>{let args:unknown[]=[];const player={videoApi:{version:1,async play(...input:unknown[]){args=input;}}};assert.equal(await playInYingjianPlugin(player,'/a (上).mp4',12.5,'学习/a.md','vault'),true);assert.deepEqual(args,['/a (上).mp4',12.5,'学习/a.md','vault']);});
test('bridge rejection propagates rather than opening a second player',async()=>{await assert.rejects(()=>playInYingjianPlugin({videoApi:{version:1,async play(){throw Error('wrong vault');}}},'/a.mp4',1,'a.md','vault'),/wrong vault/);});

import {yingjianPlayerActions,yingjianPlayerConnection} from '../src/yingjian-player-adapter';
test('player shortcuts only advertise real registered commands in stable workflow order',()=>{
 const commands=[{id:'yingjian:capture-moment'},{id:'another:open-player'},{id:'yingjian:split-player'},{id:'yingjian:open-player'},{id:'yingjian:capture-moment'}];
 assert.deepEqual(yingjianPlayerActions(commands).map(x=>x.id),['yingjian:open-player','yingjian:split-player','yingjian:capture-moment']);assert.deepEqual(yingjianPlayerActions([]),[]);
});
test('player shortcut descriptors cannot be changed through a previous caller',()=>{
 const command={id:'yingjian:open-player'},first=yingjianPlayerActions([command]);first[0].label='changed';assert.equal(yingjianPlayerActions([command])[0].label,'打开播放器');
});
test('integration status detects the installed bridge without touching private playback data',()=>{
 assert.deepEqual(yingjianPlayerConnection(undefined),{installed:false,nativePlayback:false});
 assert.deepEqual(yingjianPlayerConnection({manifest:{version:'0.9.5'},videoApi:{version:1,play(){}},get data(){throw Error('private state');}}),{installed:true,nativePlayback:true,version:'0.9.5'});
 for(const videoApi of [undefined,{version:2,play(){}},{version:1,play:null}])assert.deepEqual(yingjianPlayerConnection({videoApi}),{installed:true,nativePlayback:false});
});
