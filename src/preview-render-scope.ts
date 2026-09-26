import {Component} from 'obsidian';
import {releaseEditorResource} from './editor-cleanup';

/** One-shot native preview ownership. A cancelled async processor may still
 * register resources after its component has already been unloaded. */
export class PreviewRenderScope extends Component {
 private closed=false;
 override load(){if(!this.closed)super.load();}
 override unload(){if(this.closed)return;this.closed=true;super.unload();}
 override register(cleanup:()=>unknown){
  if(this.closed){releaseEditorResource('late preview resource',cleanup);return;}
  // One failed processor cleanup must not strand subsequent callbacks.
  super.register(()=>releaseEditorResource('preview resource',cleanup));
 }
 override addChild<T extends Component>(child:T):T {
  if(!this.closed)return super.addChild(child);
  // Match native addChild loading, then release even if onload fails halfway.
  releaseEditorResource('late preview child',()=>{try{child.load();}finally{child.unload();}});
  return child;
 }
}
