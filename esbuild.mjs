import { build } from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
await build({entryPoints:['src/main.ts'],bundle:true,external:['path','crypto','electron','obsidian','@codemirror/view','@codemirror/state'],format:'cjs',target:'es2022',outfile:'main.js',sourcemap:false});
const css=await readFile('styles.css','utf8'),journal=await readFile('src/journal-quiet.css','utf8');
const section=`/* BEGIN journal-quiet generated */\n${journal}\n/* END journal-quiet generated */`;
const marker=/\/\* BEGIN journal-quiet generated \*\/[\s\S]*?\/\* END journal-quiet generated \*\//;
await writeFile('styles.css',marker.test(css)?css.replace(marker,()=>section):css+'\n'+section+'\n');
const sidebar=await readFile('src/sidebar.css','utf8'),current=await readFile('styles.css','utf8');
const sidebarSection=`/* BEGIN sidebar generated */\n${sidebar}\n/* END sidebar generated */`;
const sidebarMarker=/\/\* BEGIN sidebar generated \*\/[\s\S]*?\/\* END sidebar generated \*\//;
await writeFile('styles.css',sidebarMarker.test(current)?current.replace(sidebarMarker,()=>sidebarSection):current+'\n'+sidebarSection+'\n');
const layout=await readFile('src/layout-planner.css','utf8'),layoutCurrent=await readFile('styles.css','utf8');
const layoutSection=`/* BEGIN layout-planner generated */\n${layout}\n/* END layout-planner generated */`;
const layoutMarker=/\/\* BEGIN layout-planner generated \*\/[\s\S]*?\/\* END layout-planner generated \*\//;
await writeFile('styles.css',layoutMarker.test(layoutCurrent)?layoutCurrent.replace(layoutMarker,()=>layoutSection):layoutCurrent+'\n'+layoutSection+'\n');
const schedule=await readFile('src/task-schedule.css','utf8'),scheduleCurrent=await readFile('styles.css','utf8');
const scheduleSection=`/* BEGIN task-schedule generated */\n${schedule}\n/* END task-schedule generated */`;
const scheduleMarker=/\/\* BEGIN task-schedule generated \*\/[\s\S]*?\/\* END task-schedule generated \*\//;
await writeFile('styles.css',scheduleMarker.test(scheduleCurrent)?scheduleCurrent.replace(scheduleMarker,()=>scheduleSection):scheduleCurrent+'\n'+scheduleSection+'\n');
const polish=await readFile('src/workspace-polish.css','utf8'),polishCurrent=await readFile('styles.css','utf8');
const polishSection=`/* BEGIN workspace-polish generated */\n${polish}\n/* END workspace-polish generated */`;
const polishMarker=/\/\* BEGIN workspace-polish generated \*\/[\s\S]*?\/\* END workspace-polish generated \*\//;
await writeFile('styles.css',polishMarker.test(polishCurrent)?polishCurrent.replace(polishMarker,()=>polishSection):polishCurrent+'\n'+polishSection+'\n');
const inline=await readFile('src/inline-node-editor.css','utf8'),inlineCurrent=await readFile('styles.css','utf8');
const inlineSection=`/* BEGIN inline-editor generated */\n${inline}\n/* END inline-editor generated */`;
const inlineMarker=/\/\* BEGIN inline-editor generated \*\/[\s\S]*?\/\* END inline-editor generated \*\//;
await writeFile('styles.css',inlineMarker.test(inlineCurrent)?inlineCurrent.replace(inlineMarker,()=>inlineSection):inlineCurrent+'\n'+inlineSection+'\n');
const workflow=await readFile('src/workflow.css','utf8'),workflowCurrent=await readFile('styles.css','utf8');
const workflowSection=`/* BEGIN workflow generated */\n${workflow}\n/* END workflow generated */`;
const workflowMarker=/\/\* BEGIN workflow generated \*\/[\s\S]*?\/\* END workflow generated \*\//;
await writeFile('styles.css',workflowMarker.test(workflowCurrent)?workflowCurrent.replace(workflowMarker,()=>workflowSection):workflowCurrent+'\n'+workflowSection+'\n');
const visual=await readFile('src/visual-system.css','utf8'),visualCurrent=await readFile('styles.css','utf8');
const visualSection=`/* BEGIN visual-system generated */\n${visual}\n/* END visual-system generated */`;
const visualMarker=/\/\* BEGIN visual-system generated \*\/[\s\S]*?\/\* END visual-system generated \*\//;
await writeFile('styles.css',visualMarker.test(visualCurrent)?visualCurrent.replace(visualMarker,()=>visualSection):visualCurrent+'\n'+visualSection+'\n');
const catalog=await readFile('src/section-catalog.css','utf8'),catalogCurrent=await readFile('styles.css','utf8');
const catalogSection=`/* BEGIN section-catalog generated */\n${catalog}\n/* END section-catalog generated */`;
const catalogMarker=/\/\* BEGIN section-catalog generated \*\/[\s\S]*?\/\* END section-catalog generated \*\//;
await writeFile('styles.css',catalogMarker.test(catalogCurrent)?catalogCurrent.replace(catalogMarker,()=>catalogSection):catalogCurrent+'\n'+catalogSection+'\n');

const mm=await readFile('src/mindmap-studio.css','utf8'),mmCurrent=await readFile('styles.css','utf8');
const mmSection=`/* BEGIN mindmap-studio generated */\n${mm}\n/* END mindmap-studio generated */`;
const mmMarker=/\/\* BEGIN mindmap-studio generated \*\/[\s\S]*?\/\* END mindmap-studio generated \*\//;
await writeFile('styles.css',mmMarker.test(mmCurrent)?mmCurrent.replace(mmMarker,()=>mmSection):mmCurrent+'\n'+mmSection+'\n');

const boardPolish=await readFile('src/board-polish.css','utf8'),boardPolishCurrent=await readFile('styles.css','utf8');
const boardPolishSection=`/* BEGIN board-polish generated */\n${boardPolish}\n/* END board-polish generated */`;
const boardPolishMarker=/\/\* BEGIN board-polish generated \*\/[\s\S]*?\/\* END board-polish generated \*\//;
await writeFile('styles.css',boardPolishMarker.test(boardPolishCurrent)?boardPolishCurrent.replace(boardPolishMarker,()=>boardPolishSection):boardPolishCurrent+'\n'+boardPolishSection+'\n');

for(const name of ['saved-views','group-organizer','paper-settings','background-image','text-markdown','interaction-chrome','branch-controls','sidebar-refinement','workspace-refinement','edge-workflow']){
 const content=await readFile(`src/${name}.css`,'utf8'),current=await readFile('styles.css','utf8');
 const start=`/* BEGIN ${name} generated */`,end=`/* END ${name} generated */`,from=current.indexOf(start),to=current.indexOf(end,from),section=`${start}\n${content}\n${end}`;
 await writeFile('styles.css',from>=0&&to>=from?current.slice(0,from)+section+current.slice(to+end.length):current+'\n'+section+'\n');
}

// Keep legacy shared selectors out of the separately installed calendar plugin.
const {isolateBoardStyles}=await import('./scripts/isolate-board-styles.mjs');
await writeFile('styles.css',isolateBoardStyles(await readFile('styles.css','utf8')));
