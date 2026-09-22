export function boardLink(vault: string, file: string, node?: string): string {
  const params = new URLSearchParams({vault,space:vault,file});
  if (node) params.set('node',node);
  return `obsidian://thoughtspace?${params.toString()}`;
}
export function parseBoardLink(params: Record<string,string>, vault: string): {file:string;node?:string} {
  // Obsidian consumes the routing vault parameter before invoking plugin handlers.
  if((params.space ?? params.vault)!==vault)throw new Error('此链接属于另一个仓库，请先在对应仓库启用 ThoughtSpace');
  if(!params.file?.endsWith('.thoughtspace') || /(^\/|(^|\/)\.\.?(\/|$)|\\|[\u0000-\u001f])/.test(params.file))throw new Error('白板链接路径无效');
  return {file:params.file,...(params.node?{node:params.node}:{})};
}
