import path from 'node:path';
import {load} from 'js-yaml';
import {BoardDocumentError,createMarkdownBoardDocument,readBoardDocument} from './schema/board-document';
import {emptyBoard,type Board} from './schema/model';
import {boardErrorLocation,causeText,deepestMessage,normalizationDiagnostics,record,recoverableBrainDiagnostics} from './diagnostics';
import {checkReferences} from './references';
import {readLocalFile,writeNewFile} from './safe-files';
import {TOOL_VERSION,type CreateKind,type CreateOptions,type ToolCommand,type ToolReport,type ValidationOptions,type ValidationResult} from './types';
export * from './types';

export function failureReport(command:ToolCommand,code:string,error:unknown,pointer:string|null=null):ToolReport{
 return{toolVersion:TOOL_VERSION,command,overall:'failed',format:{status:'failed'},references:{status:'not_checked',totalCount:0,checkedCount:0,details:[],limitations:['Format or file access failed before reference checking.']},diagnostics:[{severity:'error',code,message:error instanceof Error?error.message:String(error),pointer,cause:causeText(error)}]};
}
/** Extract the original tree only for diagnostics. The production reader alone decides acceptance. */
function originalBoard(source:string,extension:string):unknown{
 try{
  if(extension.toLowerCase().replace(/^\./,'')==='thoughtspace')return JSON.parse(source.replace(/^\uFEFF/,'')) as unknown;
  const zone=/^[ \t]*<!-- thoughtspace-board-layout:start -->[ \t]*\r?\n[ \t]*```json[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*\r?\n[ \t]*<!-- thoughtspace-board-layout:end -->[ \t]*(?:\r?\n|$)/m.exec(source);
  if(!zone)return undefined;const envelope:unknown=JSON.parse(zone[1]);return record(envelope)?envelope.board:undefined;
 }catch{return undefined;}
}
export async function validateSource(source:string,extension:string,options:ValidationOptions={}):Promise<ValidationResult>{
 const base=extension.toLowerCase().replace(/^\./,'')==='md'?'/board':'',raw=originalBoard(source,extension);
 let document:ReturnType<typeof readBoardDocument>;
 try{document=readBoardDocument(source,extension,load);}
 catch(error){
  const code=error instanceof BoardDocumentError?error.code:'parser-error',report=failureReport('validate',code,error,error instanceof BoardDocumentError&&error.code==='board-invalid'?base:null);
  if(error instanceof BoardDocumentError&&error.code==='board-invalid')Object.assign(report.diagnostics[0],boardErrorLocation(raw,base,deepestMessage(error)));
  return{report};
 }
 const board=document.board,normalized=normalizationDiagnostics(originalBoard(document.layoutSource,extension),board,base),references=await checkReferences(board,base,options);
 const report:ToolReport={toolVersion:TOOL_VERSION,command:'validate',overall:references.status==='failed'?'failed':references.status==='not_checked'?'format_only':'passed',format:{status:'passed',document:document.format,...(document.format==='markdown'?{envelopeVersion:1 as const}:{}),boardVersion:board.version,presentation:board.presentation||'ordinary'},references,diagnostics:[...normalized.diagnostics,...recoverableBrainDiagnostics(board,base)],normalizationCount:normalized.count,summary:{nodes:board.nodes.length,edges:board.edges.length,strokes:board.ink?.strokes.length||0,points:board.ink?.strokes.reduce((sum,stroke)=>sum+stroke.points.length,0)||0}};
 for(const detail of references.details)if(detail.status==='failed')report.diagnostics.push({severity:'error',code:'reference-failed',pointer:detail.pointer,message:detail.message});
 return{report,board};
}
export async function validateFile(filePath:string,options:ValidationOptions={}):Promise<ValidationResult>{
 try{const result=await validateSource(await readLocalFile(filePath),path.extname(filePath),options);result.report.path=path.resolve(filePath);return result;}
 catch(error){return{report:{...failureReport('validate','file-read-failed',error),path:path.resolve(filePath)}};}
}
export async function inspectFile(filePath:string,options:ValidationOptions={}):Promise<ValidationResult>{
 const result=await validateFile(filePath,options);result.report.command='inspect';return result;
}
function template(kind:CreateKind):Board{
 const board=emptyBoard();board.version=3;
 if(kind==='brain'){board.presentation='brain';board.brain={version:1,expandedIds:[],pins:[],history:{entries:[],index:-1}};}
 if(kind==='ink'){board.presentation='handwriting';board.ink={version:1,strokes:[]};}
 return board;
}
export async function createFile(kind:CreateKind,outputPath:string,options:CreateOptions={}):Promise<ValidationResult>{
 const fail=(code:string,error:unknown):ValidationResult=>({report:{...failureReport('create',code,error),path:path.resolve(outputPath),created:false}});
 try{
  if(!['ordinary','brain','ink'].includes(kind))return fail('invalid-kind',Error('create kind must be ordinary, brain or ink'));
  const extension=path.extname(outputPath).toLowerCase(),format=options.format||(extension==='.thoughtspace'?'legacy':'markdown');
  if(!['markdown','legacy'].includes(format)||extension!==(format==='legacy'?'.thoughtspace':'.md'))return fail('invalid-output-format',Error('Output must be .md for markdown or .thoughtspace for legacy'));
  const input=options.boardJsonPath!==undefined?await readLocalFile(options.boardJsonPath):JSON.stringify(template(kind)),validated=await validateSource(input,'thoughtspace',options);
  if(!validated.board||validated.report.overall==='failed'){validated.report.command='create';validated.report.created=false;validated.report.path=path.resolve(outputPath);return validated;}
  const board=validated.board,expected=kind==='ink'?'handwriting':kind==='brain'?'brain':undefined;
  if(board.presentation!==expected)return fail('kind-mismatch',Error('Input Board presentation does not match requested create kind'));
  const source=format==='legacy'?JSON.stringify(board,null,2):createMarkdownBoardDocument(board,options.title||'ThoughtSpace 白板'),result=await validateSource(source,extension,options);
  result.report.command='create';result.report.path=path.resolve(outputPath);result.report.created=false;
  if(result.report.overall==='failed')return result;
  // Report input normalization separately; the generated document is already normalized.
  if(validated.report.normalizationCount){result.report.diagnostics.unshift(...validated.report.diagnostics.filter(issue=>issue.severity==='normalized'));result.report.normalizationCount=validated.report.normalizationCount;}
  const serialized=normalizationDiagnostics(board,result.board!,format==='markdown'?'/board':'');
  if(serialized.count){result.report.diagnostics.unshift(...serialized.diagnostics.map(issue=>({...issue,code:'serialization-normalization',message:'生成序列化改变了此值（如负零或未知非有限数）；原输入文件未改写'})));result.report.normalizationCount=(result.report.normalizationCount||0)+serialized.count;}
  try{await writeNewFile(outputPath,source);result.report.created=true;}
  catch(error){result.report.overall='failed';result.report.diagnostics.push({severity:'error',code:'file-create-failed',pointer:null,message:error instanceof Error?error.message:String(error),cause:causeText(error)});}
  return result;
 }catch(error){return fail('create-failed',error);}
}
