/** Read-only drafts still permit keyboard selection and copying while a write is pending. */
export function allowsReadOnlyKey(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>){
 if(event.key==='Tab')return true;
 if(event.altKey)return false;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))return true;
 return (event.ctrlKey||event.metaKey)&&!event.shiftKey&&['a','c','Insert'].includes(event.key.length===1?event.key.toLowerCase():event.key)&&(!(event.key==='Insert')||event.ctrlKey);
}
