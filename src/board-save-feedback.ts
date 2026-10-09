/** The save acknowledgement and its optional contextual action share one status
 * location. No source text or recovery document is retained by this renderer. */
export type BoardSaveFeedbackAction='locate-native'|'open-recovery';
export interface BoardSaveFeedback {
 state:'saved'|'saving'|'paused'|'error';text:string;detail?:string;recoveryPath?:string;
 action?:{kind:BoardSaveFeedbackAction;label:string};
}
interface FeedbackElements {text:HTMLElement;detail?:HTMLElement;action?:HTMLButtonElement;stamp:string;}
const elements=new WeakMap<HTMLElement,FeedbackElements>();
export function renderBoardSaveFeedback(el:HTMLElement,feedback:BoardSaveFeedback,onAction:(action:BoardSaveFeedbackAction)=>void){
 const stamp=JSON.stringify(feedback);let mounted=elements.get(el);
 if(!mounted||!el.contains(mounted.text)){el.empty();mounted={text:el.createSpan('ts-save-feedback-text'),stamp:''};elements.set(el,mounted);}
 if(mounted.stamp!==stamp){
  mounted.stamp=stamp;mounted.text.setText(feedback.text);el.dataset.state=feedback.state;el.classList.toggle('is-error',feedback.state==='error');el.classList.toggle('has-save-action',!!feedback.action);
  const description=[feedback.text,feedback.detail,feedback.recoveryPath].filter(Boolean).join(' · ');el.title=description;el.setAttribute('aria-label',description);
  if(feedback.detail){mounted.detail??=el.createSpan('ts-save-feedback-detail');mounted.detail.setText(feedback.detail);}else{mounted.detail?.remove();mounted.detail=undefined;}
  if(!feedback.action){mounted.action?.remove();mounted.action=undefined;}
  else{mounted.action??=el.createEl('button',{cls:'ts-save-feedback-action',attr:{type:'button'}});mounted.action.setText(feedback.action.label);mounted.action.dataset.saveFeedbackAction=feedback.action.kind;mounted.action.setAttribute('aria-label',feedback.action.label);mounted.action.title=description;}
 }
 // The owning view supplies a fresh guarded callback even when text is unchanged.
 if(mounted.action&&feedback.action){const action=feedback.action.kind;mounted.action.onclick=event=>{event.stopPropagation();onAction(action);};}
}
