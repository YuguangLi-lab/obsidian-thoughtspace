/** Workspace chrome only. Reading/editor typography and toolbar density stay independent. */
export type WorkspaceDensity='comfortable'|'compact';
export function applyWorkspaceDensity(element:HTMLElement,density?:string){element.dataset.density=density==='compact'?'compact':'comfortable';}
