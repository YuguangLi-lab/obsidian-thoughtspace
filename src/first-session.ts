export interface FirstSessionStep {title:string;body:string}
export const firstSessionSteps:readonly FirstSessionStep[]=[
 {title:'卡片是引用',body:'放上一篇笔记时，白板只记住它的路径。同一篇笔记可以出现在多块白板上，改正文会一起更新。'},
 {title:'三种看法',body:'卡片库可以用列表、表格或看板查看同一批笔记。表格按属性浏览，看板按状态分列。'},
 {title:'高亮也是笔记',body:'从 PDF 或视频留下的高亮会写成一篇 Markdown 笔记，再引用到白板上。可以从库里打开它所在的白板，并回到原来的页码或时间。'},
];
export function firstSessionDismissed(value:unknown):boolean{return value===true;}
/** Remember “不再提示”. A failed save puts the flag back so the next launch can show the dialog again. */
export async function persistFirstSessionDismissal(save:()=>Promise<void>,assign:(dismissed:boolean)=>void):Promise<void>{
 assign(true);
 try{await save();}
 catch{assign(false);throw Error('说明未能记住，下次仍会显示');}
}
