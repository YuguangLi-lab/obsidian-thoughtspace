import {parseBoard,type Board} from './model';
import {isRecord} from './value-guards';

export type YamlParser=(yaml:string)=>unknown;
export interface BoardDocument {
 readonly format:'legacy'|'markdown';
 readonly board:Board;
 readonly source:string;
 readonly layoutSource:string;
 readonly layoutStart?:number;
 readonly layoutEnd?:number;
}
export type BoardDocumentErrorCode='unsupported-extension'|'frontmatter-missing'|'frontmatter-invalid'|'yaml-invalid'|'not-board'|'layout-missing'|'layout-duplicate'|'layout-damaged'|'layout-json-invalid'|'layout-envelope-invalid'|'layout-version-unsupported'|'board-invalid'|'layout-conflict'|'legacy-conflict'|'baseline-invalid'|'serialization-failed';
export class BoardDocumentError extends Error {
 constructor(readonly code:BoardDocumentErrorCode,message:string,cause?:unknown){super(message,cause===undefined?undefined:{cause});this.name='BoardDocumentError';}
}
const START='<!-- thoughtspace-board-layout:start -->',END='<!-- thoughtspace-board-layout:end -->';
interface Metadata {source:string;layoutSource:string;format:BoardDocument['format'];extras:Record<string,unknown>;eol:string}
interface LayoutZone {start:number;end:number;source:string;payload:string;eol:string}
// Metadata is attached to the validated document's lifetime. Keeping only envelope
// extras avoids a second retained Board and repeated parsing on every save.
const metadata=new WeakMap<BoardDocument,Metadata>();

export function isMarkdownBoardFrontmatter(raw:unknown):boolean {
 return isRecord(raw)&&Object.hasOwn(raw,'thoughtspace')&&raw.thoughtspace==='board';
}

export function readBoardDocument(text:string,extension:string,parseYaml:YamlParser):BoardDocument {
 const suffix=extension.toLowerCase().replace(/^\./,'');
 if(suffix==='thoughtspace') {
  const board=validatedBoard(text.replace(/^\uFEFF/,''));
  return remember({format:'legacy',board,source:text,layoutSource:text},{extras:{},eol:'\n'});
 }
 if(suffix!=='md')throw new BoardDocumentError('unsupported-extension','不支持的白板文件扩展名');
 const frontmatterEnd=validateFrontmatter(text,parseYaml),zone=layoutZone(text,frontmatterEnd);
 let envelope:unknown;
 try {envelope=JSON.parse(zone.payload) as unknown;}catch(cause){throw new BoardDocumentError('layout-json-invalid','白板布局区的 JSON 无效，原文未更改',cause);}
 if(!isRecord(envelope)||envelope.format!=='thoughtspace-board'||!Object.hasOwn(envelope,'board'))throw new BoardDocumentError('layout-envelope-invalid','白板布局数据封装无效，原文未更改');
 if(envelope.version!==1)throw new BoardDocumentError('layout-version-unsupported','不支持的白板布局版本，原文未更改');
 const board=validatedBoard(serialize(envelope.board)),extras={...envelope};delete extras.board;delete extras.format;delete extras.version;
 return remember({format:'markdown',board,source:text,layoutSource:zone.source,layoutStart:zone.start,layoutEnd:zone.end},{extras,eol:zone.eol});
}

export function createMarkdownBoardDocument(board:Board,title:string):string {
 const heading=(title.replace(/[\r\n\u2028\u2029]+/g,' ').trim()||'ThoughtSpace 白板').replace(/[\\`*_[\]<>#]/g,'\\$&');
 return `---\nthoughtspace: board\n---\n\n# ${heading}\n\n可在布局区外添加 Markdown 正文；白板布局区由 ThoughtSpace 管理。\n\n${serializeZone(board,{},'\n')}\n`;
}

/** The caller validates its runtime Board before persistence. Baseline must be
 * an unchanged document object returned by read/replace, not a reconstructed copy. */
export function replaceBoardDocumentLayout(disk:string,baseline:BoardDocument,board:Board,parseYaml:YamlParser):BoardDocument {
 const cached=metadata.get(baseline);
 if(!cached||cached.format!==baseline.format||cached.source!==baseline.source||cached.layoutSource!==baseline.layoutSource)throw new BoardDocumentError('baseline-invalid','白板保存基线未验证，请重新读取原文件');
 if(baseline.format==='legacy') {
  if(disk!==baseline.source)throw new BoardDocumentError('legacy-conflict','白板文件已被其他编辑修改，未覆盖原文');
  const source=(disk.startsWith('\uFEFF')?'\uFEFF':'')+serialize(board);
  return remember({format:'legacy',board,source,layoutSource:source},{extras:{},eol:'\n'});
 }
 const frontmatterEnd=validateFrontmatter(disk,parseYaml),zone=layoutZone(disk,frontmatterEnd);
 if(zone.source!==baseline.layoutSource)throw new BoardDocumentError('layout-conflict','白板布局区已被其他编辑修改，未覆盖原文');
 // Identical layout bytes have already passed JSON/envelope/Board validation.
 // Revalidate the current structure and YAML, then preserve all external bytes.
 const layoutSource=serializeZone(board,cached.extras,zone.eol),source=disk.slice(0,zone.start)+layoutSource+disk.slice(zone.end);
 return remember({format:'markdown',board,source,layoutSource,layoutStart:zone.start,layoutEnd:zone.start+layoutSource.length},{extras:cached.extras,eol:zone.eol});
}

function remember(document:BoardDocument,extra:Pick<Metadata,'extras'|'eol'>):BoardDocument {
 metadata.set(document,{source:document.source,layoutSource:document.layoutSource,format:document.format,...extra});return document;
}
function validatedBoard(text:string):Board {
 try {return parseBoard(text);}catch(cause){throw new BoardDocumentError('board-invalid','白板数据无效，原文未更改',cause);}
}
function serialize(value:unknown):string {
 try {const result=JSON.stringify(value,null,2);if(result===undefined)throw Error('No JSON value');return result;}catch(cause){throw new BoardDocumentError('serialization-failed','白板布局无法序列化，原文未更改',cause);}
}
function serializeZone(board:Board,extras:Record<string,unknown>,eol:string):string {
 const payload=serialize({...extras,format:'thoughtspace-board',version:1,board}).replaceAll('\n',eol);
 return [START,'```json',payload,'```',END].join(eol);
}
function validateFrontmatter(text:string,parseYaml:YamlParser):number {
 const opening=/^(?:\uFEFF)?---[ \t]*(?:\r?\n)/.exec(text);
 if(!opening)throw new BoardDocumentError('frontmatter-missing','Markdown 白板缺少顶部 YAML 属性，原文未更改');
 const closing=/^---[ \t]*(?:\r?\n|$)/gm;closing.lastIndex=opening[0].length;const match=closing.exec(text);
 if(!match)throw new BoardDocumentError('frontmatter-invalid','Markdown 白板的 YAML 属性区未完整闭合，原文未更改');
 let raw:unknown;
 try {raw=parseYaml(text.slice(opening[0].length,match.index));}catch(cause){throw new BoardDocumentError('yaml-invalid','Markdown 白板的 YAML 属性无效，原文未更改',cause);}
 if(!isMarkdownBoardFrontmatter(raw))throw new BoardDocumentError('not-board','Markdown 文件未声明 thoughtspace: board，原文未更改');
 return match.index+match[0].length;
}
function layoutZone(text:string,frontmatterEnd:number):LayoutZone {
 const markers=/^[ \t]*<!--[ \t]*thoughtspace-board-layout\b[^\r\n]*(?:\r?\n|$)/gmi;
 const starts:{index:number;line:string}[]=[],ends:{index:number;line:string}[]=[];let match:RegExpExecArray|null;
 while((match=markers.exec(text))) {
  const line=match[0].replace(/\r?\n$/,''),trimmed=line.trim();
  if(trimmed!==START&&trimmed!==END)throw new BoardDocumentError('layout-damaged','白板布局标记已损坏，原文未更改');
  (trimmed===START?starts:ends).push({index:match.index,line});
 }
 if(starts.length>1||ends.length>1)throw new BoardDocumentError('layout-duplicate','文件包含重复的白板布局标记，原文未更改');
 if(starts.length!==1||ends.length!==1)throw new BoardDocumentError('layout-missing','文件缺少完整的白板布局区，原文未更改');
 const begin=starts[0],finish=ends[0];
 if(begin.index<frontmatterEnd||finish.index<=begin.index)throw new BoardDocumentError('layout-damaged','白板布局标记顺序或位置无效，原文未更改');
 const body=text.slice(begin.index+begin.line.length,finish.index),fence=/^(\r?\n)[ \t]*```json[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*\r?\n$/.exec(body);
 // Additional standalone fences indicate a duplicated or damaged data zone.
 const fences=body.match(/^[ \t]*`{3,}[^\r\n]*$/gm);
 if(!fence||fences?.length!==2)throw new BoardDocumentError('layout-damaged','白板布局区必须包含一个完整的 JSON 代码块，原文未更改');
 const end=finish.index+finish.line.length;
 return {start:begin.index,end,source:text.slice(begin.index,end),payload:fence[2],eol:fence[1]};
}
