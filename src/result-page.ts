/** One bounded result window; invalid page values never address outside the array. */
export function resultPage<T>(items:readonly T[],requested:number,size:number){
 if(!Number.isInteger(size)||size<1)throw Error('Invalid page size');
 const pages=Math.max(1,Math.ceil(items.length/size)),page=Math.max(0,Math.min(pages-1,Number.isFinite(requested)?Math.trunc(requested):0)),start=page*size;
 return {items:items.slice(start,start+size),page,pages,start,total:items.length};
}
