/** A capture draft belongs to the plugin, not to a modal. It survives a close,
 * late create result and failed board save without rewriting the new note. */
export interface CaptureFile {path:string;}
export interface CaptureGroup {id:string;title:string;}
export interface CaptureDestination<T> {
 key:string;title:string;pathSnapshot:string;target:T;
 groups:readonly CaptureGroup[];groupId?:string;hint?:string;
}
export interface CaptureInput {title:string;body:string;id:string;}
export interface CaptureAttempt<F extends CaptureFile,T,P> {
 input:Readonly<CaptureInput>;destination?:CaptureDestination<T>;file?:F;
 placement?:P;placed:boolean;saved:boolean;creationUnconfirmed?:string;
}
export interface CaptureResult<F extends CaptureFile,T,P> {
 file:F;destination?:CaptureDestination<T>;placement?:P;
}
export interface CaptureDraft<F extends CaptureFile,T,P> {
 title:string;body:string;destination?:CaptureDestination<T>;
 attempt?:CaptureAttempt<F,T,P>;
 pending?:Promise<CaptureResult<F,T,P>>;
}
export interface CaptureDeliveryHost<F extends CaptureFile,T,P> {
 /** Must become false permanently for this invocation on unrelated navigation. */
 current:()=>boolean;
 createNote:(input:Readonly<CaptureInput>,current:()=>boolean)=>Promise<F>;
 validateCreatedFile:(file:F)=>void;
 /** Exact path, TFile/Session identity, group, native ownership and save lock. */
 validateDestination:(destination:CaptureDestination<T>)=>void;
 /** Synchronous, one transaction, idempotent by id. Return the receipt before
  * awaiting persistence. Throw before mutation, never after an unrecorded edit. */
 placeReference:(file:F,destination:CaptureDestination<T>,id:string,current:()=>boolean)=>P;
 /** Validate receipt + blocked state after flush; Session.flush alone may resolve
  * even when persistence failed. Never add a second card while retrying. */
 flushPlacement:(placement:P,current:()=>boolean)=>Promise<void>;
 newId:()=>string;
}
export class CaptureDeliveryError extends Error {
 constructor(message:string,readonly retainedPath?:string){super(message);this.name='CaptureDeliveryError';}
}
/** A storage API whose create outcome cannot be proved must not retry blindly.
 * A host can attach the verified created file instead of using this error. */
export class CaptureCreationUnconfirmedError extends Error {
 constructor(message:string){super(message);this.name='CaptureCreationUnconfirmedError';}
}
export function newCaptureDraft<F extends CaptureFile,T,P>():CaptureDraft<F,T,P>{return{title:'',body:''};}
export function captureNoteSource(input:Pick<CaptureInput,'title'|'body'>):string {
 const title=input.title.trim();
 if(!title||title.length>100||Array.from(title).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127))throw Error('请输入 1–100 字的单行标题');
 if(input.body.length>100000)throw Error('一次最多收集 100,000 个字符，请在原生笔记中继续');
 return `# ${title}\n\n${input.body}${input.body.endsWith('\n')?'':'\n'}`;
}
function copyDestination<T>(destination:CaptureDestination<T>):CaptureDestination<T> {
 return{...destination,groups:destination.groups.map(group=>({...group}))};
}
/** All modal instances sharing a draft share its in-flight promise. Closing a
 * modal invalidates its writes/navigation, but its late file result is retained. */
export class CaptureDeliveryOperation<F extends CaptureFile,T,P> {
 private cancelled=false;
 constructor(readonly draft:CaptureDraft<F,T,P>,private readonly host:CaptureDeliveryHost<F,T,P>){}
 get busy(){return !!this.draft.pending;}
 get createdFile(){return this.draft.attempt?.file;}
 get completed(){return !!this.draft.attempt?.saved;}
 get contentLocked(){return this.busy||!!this.createdFile||!!this.draft.attempt?.creationUnconfirmed;}
 get destinationLocked(){return this.busy||!!this.draft.attempt?.placed||!!this.draft.attempt?.saved||!!this.draft.attempt?.creationUnconfirmed;}
 cancel(){this.cancelled=true;}
 private ensure(){if(this.cancelled||!this.host.current())throw new CaptureDeliveryError('收集窗口或原位置已变化；输入已保留',this.createdFile?.path);}
 setContent(title:string,body:string){
  this.ensure();if(this.contentLocked)throw new CaptureDeliveryError('这条笔记已开始保存；输入保留，不能覆盖已创建的笔记',this.createdFile?.path);
  this.draft.title=title;this.draft.body=body;this.draft.attempt=undefined;
 }
 selectDestination(destination?:CaptureDestination<T>){
  this.ensure();if(this.destinationLocked)throw new CaptureDeliveryError('投递已提交；请先确认保存，不会另建一张引用',this.createdFile?.path);
  if(destination)this.host.validateDestination(destination);
  this.draft.destination=destination?copyDestination(destination):undefined;
  if(this.draft.attempt)this.draft.attempt.destination=this.draft.destination?copyDestination(this.draft.destination):undefined;
 }
 /** Deliberate new capture only. A failed/uncertain draft cannot be discarded by
  * the submit button or by reopening the modal. */
 startAnother(){
  this.ensure();if(this.busy||this.draft.attempt&&!this.draft.attempt.saved)throw Error('请先完成或核对这条收集，输入仍保留');
  this.draft.title='';this.draft.body='';this.draft.attempt=undefined;
 }
 run():Promise<CaptureResult<F,T,P>> {
  if(this.draft.pending)return this.draft.pending;
  let attempt:CaptureAttempt<F,T,P>;
  try{
   this.ensure();
   if(this.draft.attempt?.creationUnconfirmed)throw new CaptureDeliveryError(this.draft.attempt.creationUnconfirmed,this.createdFile?.path);
   if(!this.draft.attempt){
    captureNoteSource(this.draft);
    this.draft.attempt={input:Object.freeze({title:this.draft.title.trim(),body:this.draft.body,id:this.host.newId()}),destination:this.draft.destination?copyDestination(this.draft.destination):undefined,placed:false,saved:false};
   }
   attempt=this.draft.attempt;
   if(attempt.destination&&!attempt.saved)this.host.validateDestination(attempt.destination);
  }catch(error){return Promise.reject(error instanceof Error?error:new Error(String(error)));}
  // Deferring work one microtask installs the shared promise before any host
  // callback can re-enter run, including synchronously resolving test adapters.
  const work=Promise.resolve().then(async()=>{
   this.ensure();
   if(!attempt.file){
    try{attempt.file=await this.host.createNote(attempt.input,()=>!this.cancelled&&this.host.current()&&this.draft.attempt===attempt);}
    catch(error){if(error instanceof CaptureCreationUnconfirmedError)attempt.creationUnconfirmed=error.message;throw error;}
   }
   // Record the returned file *before* checking cancellation. It remains in the
   // retained draft for a safe retry from a later invocation.
   this.ensure();this.host.validateCreatedFile(attempt.file);
   if(!attempt.saved){
    if(attempt.destination){
     this.host.validateDestination(attempt.destination);
     if(!attempt.placed){
      const placement=this.host.placeReference(attempt.file,attempt.destination,attempt.input.id,()=>!this.cancelled&&this.host.current()&&this.draft.attempt===attempt);
      attempt.placement=placement;attempt.placed=true;
     }
     this.ensure();
     await this.host.flushPlacement(attempt.placement!,()=>!this.cancelled&&this.host.current()&&this.draft.attempt===attempt);
    }
    // A successful flush may finish after close/navigation. Preserve success,
    // while rejecting navigation from the no longer current modal.
    attempt.saved=true;
   }
   this.ensure();this.host.validateCreatedFile(attempt.file);
   return{file:attempt.file,destination:attempt.destination,placement:attempt.placement};
  }).catch((error:unknown)=>{
   if(error instanceof CaptureDeliveryError||error instanceof CaptureCreationUnconfirmedError)throw error;
   const message=error instanceof Error?error.message:String(error);
   throw new CaptureDeliveryError(message+(attempt.file?`。新笔记已保留：${attempt.file.path}；重试不会重复创建。`:'；输入已保留'),attempt.file?.path);
  }).finally(()=>{if(this.draft.pending===work)this.draft.pending=undefined;});
  this.draft.pending=work;return work;
 }
}
