/** Read-only drafts still permit keyboard selection and copying while a write is pending. */
export function allowsReadOnlyKey(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>){
 if(event.key==='Tab')return true;
 if(event.altKey)return false;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))return true;
 return (event.ctrlKey||event.metaKey)&&!event.shiftKey&&['a','c','Insert'].includes(event.key.length===1?event.key.toLowerCase():event.key)&&(!(event.key==='Insert')||event.ctrlKey);
}

/** Topic shortcuts must never take over Markdown's own list/table/math editing. */
export function isSimpleTopicContinuation(value:string,start:number,end:number,selectionCount=1){
 if(selectionCount!==1||start!==end||end!==value.length)return false;
 // A multiline draft is a document, not a short topic. Keep all native Enter
 // and Tab behavior, including blank lines between Markdown blocks.
 if(/[\r\n\t]/u.test(value)||/^ {4}/u.test(value))return false;
 const topic=value.trim();
 if(/^(?:#{1,6}(?:\s|$)|>|[-+*](?:\s|$)|\d+[.)](?:\s|$)|-{3,}$|={3,}$)/u.test(topic))return false;
 // Even partially typed syntax belongs to the editor: "$", a table's first
 // row, or an opening code fence must not accidentally create a new node.
 return !/[`$|[\]<>\\*_~]/u.test(topic);
}
