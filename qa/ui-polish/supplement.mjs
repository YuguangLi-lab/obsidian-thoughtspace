const parts={reuse:['./supplement-reuse.mjs','runReuse'],brain:['./supplement-brain.mjs','runBrain'],media:['./supplement-media.mjs','runMedia'],settings:['./supplement-settings.mjs','runSettings']};
export async function run(ctx){
 const selected=process.env.QA_SUPPLEMENT_PART?.split(',')||Object.keys(parts);
 ctx.report.supplement={scope:'Four bounded native coverage gaps. No brain pager layout, external platform/account or separate Calendar integration changes.',parts:selected};
 for(const name of selected){if(!parts[name])throw Error('Unknown supplement part: '+name);const [resource,entry]=parts[name];const module=await import(resource);console.log('START SUPPLEMENT '+name);await module[entry](ctx);console.log('END SUPPLEMENT '+name);}
}
