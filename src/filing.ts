/** 标签的斜线对应真实目录层级，不接受路径跳转或平台非法字符。 */
export function tagFolder(tag: string, root = 'ThoughtSpace/卡片'): string {
  const parts = tag.replace(/^#/, '').split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[\\:*?"<>|\[\]#^\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^\s/.test(p))) throw new Error(`标签不能用作文件夹：${tag}`);
  return `${root}/${parts.join('/')}`;
}
export function journalFolder(day: string, root = 'ThoughtSpace/日记'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error('日记文件名必须是 YYYY-MM-DD');
  const date = new Date(`${day}T12:00:00`);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== Number(m[1]) || date.getMonth() + 1 !== Number(m[2]) || date.getDate() !== Number(m[3])) throw new Error(`无效日记日期：${day}`);
  return `${root}/${m[1]}/${m[2]}`;
}
export function localDay(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export interface FilingSettings { cardFolder: string; journalFolder: string; autoFileCards: boolean; cleanupEmptyFolders: boolean }
export const defaultFilingSettings: FilingSettings = { cardFolder: 'ThoughtSpace/卡片', journalFolder: 'ThoughtSpace/日记', autoFileCards: true, cleanupEmptyFolders: true };
export function vaultFolder(value: string): string {
  const path = value.trim().replace(/\/$/, '');
  if (!path || path.startsWith('.') || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..' || /[\\:*?"<>|\x00-\x1f]/.test(p) || /[. ]$/.test(p))) throw new Error('请输入仓库内的有效文件夹路径，不含开头斜线或 ..');
  return path;
}
export function validateFolders(card: string, journal: string) {
  const cardFolder = vaultFolder(card), journalFolder = vaultFolder(journal);
  if (cardFolder === journalFolder || cardFolder.startsWith(journalFolder + '/') || journalFolder.startsWith(cardFolder + '/')) throw new Error('卡片目录和日记目录不能互相包含');
  return { cardFolder, journalFolder };
}
