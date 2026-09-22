/** 只接受 Obsidian 可识别的标签；输入分隔符不会成为标签内容。 */
export function normalizeNativeTags(input:string):string[]{
  const values=input.split(/[\s,，;；]+/u).map(v=>v.replace(/^#+/,'').trim()).filter(Boolean);
  for(const value of values){
    if(!/^[\p{L}\p{M}\p{N}_/-]+$/u.test(value)||!/[\p{L}\p{M}_/-]/u.test(value)||value.split('/').some(p=>!p))throw new Error(`标签格式无效：${value}。可使用文字、数字、下划线、短横线和 / 层级；不能只有数字。`);
  }
  return [...new Map(values.map(v=>[v.toLocaleLowerCase(),v])).values()];
}
export function suggestedNoteName(text:string){return text.split('\n').map(s=>s.trim().replace(/^#{1,6}\s+/,'')).find(Boolean)?.slice(0,80)||'未命名笔记';}
