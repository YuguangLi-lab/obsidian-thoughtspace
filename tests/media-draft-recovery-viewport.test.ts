import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

test('media recovery bounds its centering container and releases each viewport binding once',()=>{
 const bindings:{container:unknown;stops:number}[]=[];
 class Modal{containerEl={};modalEl={addClass(){}};contentEl={empty(){}};}
 const module={exports:{} as Record<string,any>};
 const bind=(container:unknown)=>{const entry={container,stops:0};bindings.push(entry);return()=>{entry.stops++;};};
 const compiled=transformSync(readFileSync('src/media-draft-recovery.ts','utf8'),{loader:'ts',format:'cjs'}).code;
 new Function('require','module','exports',compiled)((name:string)=>name==='obsidian'?{Modal}:name==='./board-modal-viewport'?{bindBoardModalViewport:bind}:name==='./ui-tokens'?{themeSurface(){}}:{},module,module.exports);
 const view=new module.exports.MediaDraftRecoveryModal({}, {}, async()=>{});let renders=0;view.render=()=>{renders++;};
 view.onOpen();assert.equal(bindings.length,1);assert.equal(bindings[0].container,view.containerEl);assert.notEqual(bindings[0].container,view.modalEl);
 view.onClose();view.onClose();assert.equal(bindings[0].stops,1);
 view.onOpen();view.onOpen();assert.equal(bindings[1].stops,1);assert.equal(bindings[2].stops,0);view.onClose();assert.equal(bindings[2].stops,1);assert.equal(renders,3);
});
