/** Enter the note only when Right would not be needed to edit the middle of a query. */
export function canEnterReference(value:string,start:number|null,end:number|null){return start!==null&&end!==null&&((start===value.length&&end===value.length)||(start===0&&end===value.length));}
