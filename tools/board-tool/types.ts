import type {Board} from './schema/model';

export const TOOL_VERSION='1.0.0-local' as const;
export type ToolCommand='validate'|'inspect'|'create';
export interface Diagnostic {
 severity:'error'|'normalized'|'recoverable';code:string;message:string;pointer:string|null;
 cause?:string;relatedPointers?:string[];
}
export interface ReferenceDetail {
 kind:string;target:string;pointer:string;status:'checked'|'not_checked'|'failed';message:string;
}
export interface ToolReport {
 toolVersion:typeof TOOL_VERSION;command:ToolCommand;overall:'passed'|'format_only'|'failed';
 format:{status:'passed'|'failed';document?:'legacy'|'markdown';envelopeVersion?:1;boardVersion?:number;presentation?:'ordinary'|'brain'|'handwriting'};
 references:{status:'not_checked'|'not_applicable'|'checked'|'failed';totalCount:number;checkedCount:number;details:ReferenceDetail[];limitations:string[]};
 diagnostics:Diagnostic[];summary?:{nodes:number;edges:number;strokes:number;points:number};
 path?:string;created?:boolean;normalizationCount?:number;
}
export interface ValidationResult {report:ToolReport;board?:Board;}
export interface ValidationOptions {vaultRoot?:string;}
export interface CreateOptions extends ValidationOptions {title?:string;format?:'markdown'|'legacy';boardJsonPath?:string;}
export type CreateKind='ordinary'|'brain'|'ink';
