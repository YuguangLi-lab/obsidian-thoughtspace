/** 属性使用独立键，避免覆盖用户自己的 status / due 等属性。 */
export const propertyKeys = { status: 'thoughtspace_status', priority: 'thoughtspace_priority', due: 'thoughtspace_due' } as const;
export type PropertyField = keyof typeof propertyKeys;
export const statuses: Record<string, string> = { inbox: '待整理', active: '进行中', done: '已完成' };
export const priorities: Record<string, string> = { '': '未设置', high: '高优先级', medium: '中优先级', low: '低优先级' };
export interface NoteProperties { status: string; priority: string; due: string; }
export function dateValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z'); return Number.isFinite(+date) && date.toISOString().slice(0,10) === value;
}
export function readProperties(frontmatter: Record<string, unknown> = {}): NoteProperties {
  const text = (field: PropertyField) => { const v = frontmatter[propertyKeys[field]]; return v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v); };
  return { status: text('status') || 'inbox', priority: text('priority'), due: text('due') };
}
export function propertyPatch(field: PropertyField, value: string): string | undefined {
  if (field === 'status' && value && !Object.hasOwn(statuses, value)) throw new Error('未知状态');
  if (field === 'priority' && !Object.hasOwn(priorities, value)) throw new Error('未知优先级');
  if (field === 'due' && value && !dateValid(value)) throw new Error('请输入有效日期');
  return value || undefined;
}
export function isOverdue(props: NoteProperties, today: string): boolean { return props.status !== 'done' && dateValid(props.due) && props.due < today; }
export interface DatabaseRow { path: string; title: string; tags: string[]; mtime: number; props: NoteProperties; }
export interface DatabaseFilter { query: string; tag: string; status: string; priority: string; overdue: boolean; sort: 'updated'|'title'|'due'|'priority'; today: string; }
export function filterRows<T extends DatabaseRow>(rows: readonly T[], f: DatabaseFilter): T[] {
  const ranks: Record<string,number> = { high: 0, medium: 1, low: 2 };
  const query=f.query.toLocaleLowerCase(),dates=f.overdue||f.sort==='due'?new Map<string,boolean>():undefined;
  const validDate=(value:string)=>{let valid=dates!.get(value);if(valid===undefined){valid=dateValid(value);dates!.set(value,valid);}return valid;};
  return rows.filter(r => (!f.query || [r.title,r.path,...r.tags].join(' ').toLocaleLowerCase().includes(query)) && (!f.tag || r.tags.includes(f.tag)) && (!f.status || r.props.status === f.status) && (!f.priority || r.props.priority === f.priority) && (!f.overdue || r.props.status!=='done'&&validDate(r.props.due)&&r.props.due<f.today))
    .sort((a,b) => {
      let result = 0;
      if (f.sort === 'title') result = a.title.localeCompare(b.title);
      if (f.sort === 'updated') result = b.mtime - a.mtime;
      if (f.sort === 'priority') result = (ranks[a.props.priority] ?? 3) - (ranks[b.props.priority] ?? 3);
      if (f.sort === 'due') result = (validDate(a.props.due) ? a.props.due : '9999-99-99').localeCompare(validDate(b.props.due) ? b.props.due : '9999-99-99');
      return result || a.path.localeCompare(b.path);
    });
}
/** 为电子表格保留文本语义，避免把标题当成公式执行。 */
export function databaseCsv(rows: readonly DatabaseRow[]): string {
  const cell = (text: string) => '"' + (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g,'""') + '"';
  const lines = [['笔记','路径','状态','优先级','截止日期','标签'],...rows.map(r=>[r.title,r.path,Object.hasOwn(statuses,r.props.status)?statuses[r.props.status]:r.props.status,Object.hasOwn(priorities,r.props.priority)?priorities[r.props.priority]:r.props.priority,r.props.due,r.tags.join(' ')])];
  return '\uFEFF' + lines.map(row=>row.map(cell).join(',')).join('\r\n') + '\r\n';
}
