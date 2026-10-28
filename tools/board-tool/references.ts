import {promises as fs} from 'node:fs';
import path from 'node:path';
import {load} from 'js-yaml';
import {readBoardDocument} from './schema/board-document';
import type {Board} from './schema/model';
import {pointer} from './diagnostics';
import {assertNoSymlinks,readLocalFile,referencePath} from './safe-files';
import type {ReferenceDetail,ToolReport,ValidationOptions} from './types';

interface Reference {kind:string;target:string;pointer:string;semantic?:string;child?:boolean;remote?:boolean;}
const limitations=[
 'Checks structured direct references only; child boards are parsed once, without recursively checking their references or cross-board cycles.',
 'Ordinary note and attachment checks establish regular-file existence only; no codecs, PDF pages, timestamps, anchors, capture IDs or remote resources are resolved.',
 'Markdown inline links and references hidden in opaque unknown fields are not resolved. This report does not certify the whole vault or a concurrent future state.',
];
function collect(board:Board,base:string):Reference[]{
 const refs:Reference[]=[];
 board.nodes.forEach((node,i)=>{
  const np=pointer(pointer(base,'nodes'),i),add=(kind:string,target:string,keys:string|string[],extra:Partial<Reference>={})=>refs.push({kind,target,pointer:(typeof keys==='string'?[keys]:keys).reduce(pointer,np),...extra});
  if(node.file!==undefined&&['card','board','image','pdf','audio','video'].includes(node.kind))add(node.kind,node.file,'file',{child:node.kind==='board',...(node.kind==='pdf'&&node.pdfPage!==undefined?{semantic:'PDF page existence is not checked.'}:{}),...((node.kind==='audio'||node.kind==='video')&&node.mediaStart!==undefined?{semantic:'Media timestamp is not checked.'}:{})});
  if(node.paragraphQuote)add('paragraph',node.paragraphQuote.path,['paragraphQuote','path'],{semantic:'Paragraph selection/hash and native heading/block anchors are not checked.'});
  if(node.pdfExcerpt)add('pdf-excerpt',node.pdfExcerpt.path,['pdfExcerpt','path'],{semantic:'PDF page text and precise selection are not checked.'});
  if(node.pdfQuote)add('pdf-quote',node.pdfQuote.sourcePath,['pdfQuote','sourcePath'],{semantic:'PDF quote text, pages and coordinates are not checked.'});
  if(node.videoCapture)add('video-capture',node.videoCapture.note,['videoCapture','note'],{semantic:'Capture ID within the note is not checked.'});
  if(node.webUrl)add('web',node.webUrl,'webUrl',{remote:true});
  if(node.imageUrl)add('remote-image',node.imageUrl,'imageUrl',{remote:true});
  if(node.text&&(/\[\[[^\]\r\n]+\]\]|\]\([^)\r\n]+\)/.test(node.text)))add('inline-markdown','Inline Markdown destinations','text',{remote:true,semantic:'Inline Markdown destinations are not resolved.'});
 });
 if(board.background?.backgroundImagePath)refs.push({kind:'background-image',target:board.background.backgroundImagePath,pointer:pointer(pointer(base,'background'),'backgroundImagePath')});
 if(board.writing?.draftPath)refs.push({kind:'writing-draft',target:board.writing.draftPath,pointer:pointer(pointer(base,'writing'),'draftPath')});
 return refs;
}
export async function checkReferences(board:Board,base:string,options:ValidationOptions):Promise<ToolReport['references']>{
 const refs=collect(board,base),details:ReferenceDetail[]=[];let root:string|undefined;
 if(options.vaultRoot!==undefined){
  try{if(!options.vaultRoot.trim())throw Error('vault-root must be an explicit nonempty directory');root=await assertNoSymlinks(options.vaultRoot);if(!(await fs.lstat(root)).isDirectory())throw Error('vault-root is not a directory');}
  catch(error){return{status:'failed',totalCount:refs.length,checkedCount:0,details:[{kind:'vault-root',target:options.vaultRoot,pointer:base,status:'failed',message:String(error)}],limitations};}
 }
 for(const ref of refs){
  const detail={kind:ref.kind,target:ref.target,pointer:ref.pointer};
  if(ref.remote){details.push({...detail,status:'not_checked',message:ref.semantic||'Remote resource is not checked; no network request is made.'});continue;}
  if(root===undefined){details.push({...detail,status:'not_checked',message:'Provide an explicit --vault-root to check this direct reference.'});continue;}
  try{
   const target=await referencePath(root,ref.target);
   let semantic=ref.semantic;
   if(ref.child){const child=readBoardDocument(await readLocalFile(target),path.extname(target),load);if(collect(child.board,'').length)semantic='Direct child document passed the real parser, but its known references remain unchecked. No recursive reads are performed.';}
   details.push({...detail,status:semantic?'not_checked':'checked',message:semantic?'Regular file exists. '+semantic:ref.child?'Direct child document passed the real parser and has no known references detected; unknown opaque references are not resolved.':'Regular file exists; content semantics are outside this check.'});
  }catch(error){details.push({...detail,status:'failed',message:String(error)});}
 }
 const failed=details.some(detail=>detail.status==='failed'),unchecked=details.some(detail=>detail.status==='not_checked');
 return{status:failed?'failed':unchecked?'not_checked':refs.length?'checked':'not_applicable',totalCount:refs.length,checkedCount:details.filter(detail=>detail.status==='checked').length,details,limitations};
}
