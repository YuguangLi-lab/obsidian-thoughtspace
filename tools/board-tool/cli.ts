import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFile,failureReport,inspectFile,validateFile} from './index';
import {TOOL_VERSION,type CreateKind,type CreateOptions,type ToolReport} from './types';
export * from './index';

const usage='thoughtspace-board validate|inspect FILE [--vault-root DIR] [--json]\nthoughtspace-board create ordinary|brain|ink OUTPUT [--title TEXT] [--format markdown|legacy] [--board-json FILE] [--vault-root DIR] [--json]';
export async function runCLI(args:string[]):Promise<number>{
 const json=args.includes('--json');let report:ToolReport;
 try{
  if(args.length===1&&args[0]==='--version'){console.log(TOOL_VERSION);return 0;}
  if(args.length===1&&args[0]==='--help'){console.log(usage);return 0;}
  const command=args[0],positional:string[]=[],values=new Map<string,string>(),flags=new Set<string>();
  if(!['validate','inspect','create'].includes(command||''))throw Error('Unknown command. '+usage);
  const allowed=command==='create'?['--title','--format','--board-json','--vault-root']:['--vault-root'];
  for(let i=1;i<args.length;i++){
   const value=args[i];
   if(value==='--json'){if(flags.has(value))throw Error('Duplicate --json');flags.add(value);continue;}
   if(value.startsWith('--')){
    if(!allowed.includes(value)||values.has(value))throw Error('Unknown or duplicate option: '+value);
    const next=args[++i];if(next===undefined||next.startsWith('--'))throw Error('Option needs a value: '+value);values.set(value,next);
   }else{if(value.startsWith('-'))throw Error('Unknown option: '+value);positional.push(value);}
  }
  if(positional.length!==(command==='create'?2:1))throw Error('Incorrect positional arguments. '+usage);
  const vaultRoot=values.get('--vault-root');
  if(command==='create'){
   const kind=positional[0],format=values.get('--format');
   if(!['ordinary','brain','ink'].includes(kind)||format!==undefined&&!['markdown','legacy'].includes(format))throw Error('Unknown create kind or format');
   const options:CreateOptions={vaultRoot,title:values.get('--title'),format:format as CreateOptions['format'],boardJsonPath:values.get('--board-json')};
   report=(await createFile(kind as CreateKind,positional[1],options)).report;
  }else report=(await(command==='inspect'?inspectFile:validateFile)(positional[0],{vaultRoot})).report;
 }catch(error){report=failureReport('validate','usage-error',error);if(args[0]==='create'){report.command='create';report.created=false;}emit(report,json);return 64;}
 emit(report,json);return report.overall==='passed'?0:report.overall==='format_only'?2:1;
}
function emit(report:ToolReport,json:boolean){
 if(json){console.log(JSON.stringify(report,null,2));return;}
 console.log(`${report.command}: ${report.overall}${report.created===true?' (created)':report.created===false?' (not created)':''}${report.path?' — '+report.path:''}`);
 console.log(`format: ${report.format.status}; references: ${report.references.status} (${report.references.checkedCount}/${report.references.totalCount})`);
 for(const issue of report.diagnostics)console.log(`${issue.severity} ${issue.code} ${issue.pointer===null?'(document)':issue.pointer||'(root)'}: ${issue.message}`);
 if(report.overall==='format_only')console.log('The format passed; references remain unchecked. Exit 2 can accompany a successfully created candidate.');
}
// Importing the standalone bundle exports its API without running a command.
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 runCLI(process.argv.slice(2)).then(code=>{process.exitCode=code;}).catch(error=>{console.log(JSON.stringify(failureReport('validate','unexpected-error',error)));process.exitCode=1;});
}
