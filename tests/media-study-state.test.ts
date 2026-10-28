import test from 'node:test';
import assert from 'node:assert/strict';
import {canResumeMedia,cleanMediaStudy,mediaRecordKey,type MediaResumeTicket} from '../src/media-study-state';

test('study layouts preserve valid configuration and bound restored ratios',()=>{
 assert.equal(cleanMediaStudy(undefined).enabled,false);
 const state=cleanMediaStudy({enabled:true,id:'pair',mode:'board',title:'纸质视频工作区',board:'Boards/A.md',noteLeaf:'native-note',boardLeaf:'native-board',ratio:100});
 assert.equal(state.ratio,70);assert.equal(state.mode,'board');assert.equal(state.board,'Boards/A.md');assert.equal(state.noteLeaf,'native-note');assert.equal(cleanMediaStudy({...state,title:'bad\nlabel',ratio:-2}).title,undefined);assert.equal(cleanMediaStudy({...state,ratio:-2}).ratio,38);
});
test('resume is exclusive to an acknowledged pause/record ticket and unchanged active source',()=>{
 const ticket:MediaResumeTicket={source:'Media/A.webm',draft:'one',generation:2,time:12.5},current={...ticket,active:true,paused:true};assert.equal(canResumeMedia(ticket,current),true);
 for(const patch of [{source:'Media/B.webm'},{draft:'two'},{generation:3},{time:13.1},{time:NaN},{active:false},{paused:false}])assert.equal(canResumeMedia(ticket,{...current,...patch}),false);
 assert.equal(canResumeMedia(undefined,current),false);assert.equal(canResumeMedia(ticket,{...current,time:12.7}),true);
});
test('M does not consume native writing, IME, modified keys or key repeat',()=>{
 const event={key:'m',repeat:false,isComposing:false,keyCode:77,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,defaultPrevented:false};assert.equal(mediaRecordKey(event,false),true);assert.equal(mediaRecordKey({...event,key:'M'},false),true);assert.equal(mediaRecordKey(event,true),false);
 for(const patch of [{isComposing:true},{keyCode:229},{repeat:true},{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{defaultPrevented:true},{key:'n'}])assert.equal(mediaRecordKey({...event,...patch},false),false);
});
