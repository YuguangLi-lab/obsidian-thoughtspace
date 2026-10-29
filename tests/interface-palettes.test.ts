import test from 'node:test';
import assert from 'node:assert/strict';
import {interfacePaletteIds,interfacePalettes,cleanInterfaceMode,cleanInterfacePalette} from '../src/interface-palettes';
import {cleanPluginSettings} from '../src/plugin-settings';
import {exportSettingsProfile,parseSettingsProfile} from '../src/settings-preferences';
import {interfaceStyleRules} from '../src/interface-style-tokens';
import {cleanLibraryModules,cleanDatabasePreferences} from '../src/database-custom';
function contrast(a:string,b:string){const luminance=(s:string)=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('six distinct light/dark presets retain readable text and action colors',()=>{
 assert.equal(interfacePaletteIds.length,6);assert.equal(new Set(interfacePaletteIds.map(id=>interfacePalettes[id].light.paper)).size,6);
 for(const id of interfacePaletteIds)for(const mode of ['light','dark'] as const){const p=interfacePalettes[id][mode];for(const bg of ['sheet','paper','wash']as const)for(const fg of ['ink','muted','accent']as const)assert.ok(contrast(p[fg],p[bg])>=4.5,`${id}/${mode} ${fg}/${bg} ${contrast(p[fg],p[bg])}`);}
});
test('palette and mode roundtrip without replacing authored canvas or collection settings',()=>{
 for(const id of interfacePaletteIds)for(const mode of ['auto','light','dark']as const){const saved={interfacePalette:id,interfaceMode:mode,accent:'palette',paperPreset:'custom',paperColor:'#abcdef',paperTexture:63,canvasBackground:'paper',collectionBackground:{canvasBackground:'plain',paperPreset:'custom',paperColor:'#ddeeff',paperTexture:21}},prefs=cleanPluginSettings(saved);assert.equal(prefs.interfacePalette,id);assert.equal(prefs.interfaceMode,mode);assert.equal(prefs.paperColor,'#abcdef');assert.deepEqual(cleanPluginSettings(prefs),prefs);const exported=parseSettingsProfile(exportSettingsProfile(prefs));assert.equal(exported.interfacePalette,id);assert.equal(exported.interfaceMode,mode);assert.equal(exported.accent,'palette');assert.deepEqual(prefs.collectionBackground,cleanPluginSettings(saved).collectionBackground);}
 assert.equal(cleanInterfacePalette('editorial'),'paper');assert.equal(cleanInterfacePalette('glass'),'paper');assert.equal(cleanInterfaceMode('bad'),'auto');assert.equal(cleanPluginSettings({accent:'rose',density:'compact'}).accent,'rose');assert.ok(!interfacePaletteIds.includes('editorial' as never));
});
test('explicit modes ignore host darkness while automatic mode retains scoped theme following',()=>{
 for(const id of interfacePaletteIds){assert.match(interfaceStyleRules('paper',false,id,'auto'),/\.theme-dark /);for(const mode of ['light','dark']){const css=interfaceStyleRules('paper',false,id,mode);assert.doesNotMatch(css,/\.theme-dark /);assert.ok(css.includes(interfacePalettes[id][mode as 'light'|'dark'].paper));assert.doesNotMatch(css,/blur\(|url\(/);}}
});
test('optional library modules do not discard legacy views or cardbox rules',()=>{
 const base=cleanDatabasePreferences({fields:[],views:[],library:{}}),next=cleanDatabasePreferences({...base,modules:{table:false,kanban:false,insights:true,notes:false,unknown:true}});assert.deepEqual(next.modules,{table:false,kanban:false,notes:false,insights:true});assert.deepEqual(next.library,base.library);assert.deepEqual(next.views,base.views);assert.deepEqual(cleanLibraryModules(null),{table:true,kanban:true,notes:true,insights:false});
});

test('palette choice preserves the verified legacy shadow, including previously saved finish fields',()=>{for(const id of interfacePaletteIds){const before=JSON.stringify(interfacePalettes[id]),css=interfaceStyleRules('paper',false,id,'auto','soft');assert.equal(interfaceStyleRules('paper',false,id,'auto','paper'),css);assert.match(css,/--ts-e-shadow:0 1px 3px #00000009/);assert.equal(JSON.stringify(interfacePalettes[id]),before);}});

test('primary text has AA contrast for each recommended light and dark palette',()=>{for(const id of interfacePaletteIds)for(const mode of ['light','dark']as const){const p=interfacePalettes[id][mode];assert.ok(contrast(mode==='dark'?p.paper:p.sheet,p.accent)>=4.5,`${id}/${mode} primary`);}});
