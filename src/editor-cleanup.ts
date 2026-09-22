/** One failing host cleanup must not strand the remaining editor resources. */
export function releaseEditorResource(name:string,release?:()=>void){
 try{release?.();}catch(error){console.warn(`ThoughtSpace could not release ${name}`,error);}
}
