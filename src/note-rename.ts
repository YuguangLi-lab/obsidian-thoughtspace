/** Keep the existing folder and reject invalid names rather than silently sanitizing them. */
export function noteRenamePath(original:string,value:string){
 const name=value.trim();if(!name)throw Error('笔记标题不能为空');
 if(name==='.'||name==='..'||/[\\/:*?"<>|\x00-\x1f]/.test(name)||/[. ]$/.test(name))throw Error('标题不能包含路径分隔符或文件名非法字符');
 const slash=original.lastIndexOf('/');return (slash<0?'':original.slice(0,slash+1))+name+'.md';
}
