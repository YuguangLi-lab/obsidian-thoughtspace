/** 安装备份可由原生文件管理器查看，但不作为当前工作台资料，也不随重命名改写。 */
export function isWorkspaceFile(file: {path: string}): boolean {
  return !file.path.startsWith('ThoughtSpace/白板搜索/') && file.path !== 'ThoughtSpace-plugin-backups' && !file.path.startsWith('ThoughtSpace-plugin-backups/');
}
export interface AppearanceSettings {
  surfaceStyle:'soft'|'paper';readingSize:number;readingWidth:'standard'|'wide';
  accent: 'forest' | 'blue' | 'amber' | 'rose';
  density: 'comfortable' | 'compact';
  canvasBackground: 'dots' | 'grid' | 'plain';
  showMinimap: boolean;
  glassEffects: boolean;
}
export const defaultAppearance: AppearanceSettings = { surfaceStyle:'soft',readingSize:16,readingWidth:'standard',accent: 'forest', density: 'comfortable', canvasBackground: 'dots', showMinimap: true, glassEffects: true };
export type LibraryScope = 'vault' | 'cards' | 'board';
export type LibrarySort = 'updated' | 'title';
export function libraryFiles<T extends {path: string; basename: string; stat: {mtime: number}}>(files: readonly T[], scope: LibraryScope, sort: LibrarySort, cardRoot: string, boardPaths: ReadonlySet<string>): T[] {
  return files.filter(isWorkspaceFile).filter(f => scope === 'vault' || (scope === 'cards' ? f.path.startsWith(cardRoot + '/') : boardPaths.has(f.path)))
    .sort((a,b) => (sort === 'updated' ? b.stat.mtime - a.stat.mtime : a.basename.localeCompare(b.basename)) || a.path.localeCompare(b.path));
}
/** 侧栏摘要只显示可读正文；原文不改写，也不把 YAML、代码块展示为摘要。 */
export function noteExcerpt(text: string, limit = 150): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/^\s*(`{3,}|~{3,}).*\r?\n[\s\S]*?^\s*\1\s*$/gm, '')
    .replace(/^# .*(?:\r?\n|$)/m, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m:string, path:string, label:string|undefined) => label || path)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/(^|\s)#[\p{L}\p{N}_/-]+/gu, '$1')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '').replace(/^[\s>#*-]+/gm, '').replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, limit);
}
