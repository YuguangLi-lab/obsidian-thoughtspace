/** Presentation only. Each caller retains its own transaction and lifecycle guards. */
export type UiFeedback = 'info'|'loading'|'success'|'warning'|'error';

export function setUiFeedback(element:HTMLElement|undefined, state:UiFeedback, text:string){
 if(!element)return;
 if(text)element.dataset.feedback=state;
 else delete element.dataset.feedback;
 element.setText(text);
}

export function clearUiFeedback(element:HTMLElement|undefined){
 if(!element)return;
 delete element.dataset.feedback;
 element.empty();
}
