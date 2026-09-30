import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardInputPreferenceKeys} from '../src/board-experience';
import {cleanPluginSettings} from '../src/plugin-settings';
import {exportSettingsProfile,parseSettingsProfile,resetSettingsCategory,resolveSettingsLanguage,settingsCategoryDefaults,settingsCategoryKeys,SettingsProfileError,settingsProfileMaxLength,type SettingsCategory,type SettingsProfileErrorCode} from '../src/settings-preferences';

const profile=(preferences:unknown)=>JSON.stringify({format:'thoughtspace-preferences',version:1,preferences});
const rejects=(text:string,code:SettingsProfileErrorCode)=>assert.throws(()=>parseSettingsProfile(text),(error:unknown)=>error instanceof SettingsProfileError&&error.code===code);

test('settings language follows the host unless explicitly selected and survives persistence',()=>{
 assert.equal(cleanPluginSettings(null).settingsLanguage,'auto');
 for(const language of ['auto','en','zh-CN'] as const)assert.equal(cleanPluginSettings(JSON.parse(JSON.stringify({settingsLanguage:language}))).settingsLanguage,language);
 for(const invalid of ['zh','EN','fr','',null,[],{},false,10])assert.equal(cleanPluginSettings({settingsLanguage:invalid}).settingsLanguage,'auto');
 for(const host of ['zh','zh-CN','zh-TW','zh-Hant','ZH_CN',' zh-HK '])assert.equal(resolveSettingsLanguage('auto',host),'zh-CN');
 for(const host of ['en','en-US','fr','ja','', 'zhinese'])assert.equal(resolveSettingsLanguage('auto',host),'en');
 assert.equal(resolveSettingsLanguage('en','zh-CN'),'en');
 assert.equal(resolveSettingsLanguage('zh-CN','en'),'zh-CN');
 assert.equal(resolveSettingsLanguage(undefined,'zh-CN'),'zh-CN');
});

test('settings categories own disjoint preference sets and input matches the gesture model',()=>{
 const all=Object.values(settingsCategoryKeys).flat();
 assert.equal(all.length,new Set(all).size);
 assert.deepEqual(settingsCategoryKeys.input,boardInputPreferenceKeys);
 for(const category of Object.keys(settingsCategoryKeys) as SettingsCategory[])assert.deepEqual(Object.keys(settingsCategoryDefaults(category)),settingsCategoryKeys[category]);
});

test('each category reset preserves all other settings, vault data, and image and paper customization',()=>{
 const custom=cleanPluginSettings({settingsLanguage:'en',surfaceStyle:'paper',accent:'rose',glassEffects:false,density:'compact',defaultCardStyle:'sticky',defaultCardWidth:420,defaultTextSize:24,defaultEdgeStyle:'elbow',defaultEdgeDirection:'both',noteMarkdownToolbar:false,canvasBackground:'image',showMinimap:false,boardSearchEnabled:false,toolbarDensity:'comfortable',gridStep:48,alignmentGuides:false,axisLock:false,aspectLock:false,previewLimit:160,detailZoom:.85,showCardTags:false,showPorts:false,showBoardHints:false,leftDrag:'none',rightDrag:'none',middleDrag:'none',wheelMode:'pan',zoomSpeed:1.5,reverseWheelZoom:true,boardQuickKeys:false,panSpeed:2,reverseWheelPan:true,zoomAnchor:'center',dragThreshold:12,arrowNudge:false,deleteKeys:false,nudgeStep:5,fastNudge:50,readingSize:20,readingWidth:'wide',backgroundImagePath:'Assets/private-image.png',backgroundImageFit:'tile',backgroundImageOpacity:36,paperPreset:'custom',paperColor:'#bbcccc',paperTexture:87,favoriteBoards:['Boards/research.thoughtspace'],cardFolder:'Private/cards',imageHostEnabled:true,notePaneLeafId:'native-leaf-id',pendingBookmarkChanges:{'private-note.md':true}});
 for(const category of Object.keys(settingsCategoryKeys) as SettingsCategory[]){
  const settings=structuredClone(custom),before=structuredClone(custom),expected=settingsCategoryDefaults(category);
  resetSettingsCategory(settings,category);
  for(const key of Object.keys(before) as (keyof typeof before)[]){
   assert.deepEqual(settings[key],Object.hasOwn(expected,key)?expected[key as keyof typeof expected]:before[key],`${category}: ${key}`);
  }
 }
 const board=structuredClone(custom);resetSettingsCategory(board,'board');
 assert.equal(board.canvasBackground,'dots');
 assert.equal(board.backgroundImagePath,custom.backgroundImagePath);
 assert.equal(board.paperTexture,custom.paperTexture);
});

test('category defaults are independent patches and feature defaults retain enabled behavior',()=>{
 const first=settingsCategoryDefaults('cards');first.defaultCardStyle='sticky';
 assert.equal(settingsCategoryDefaults('cards').defaultCardStyle,'transparent');
 assert.equal(settingsCategoryDefaults('cards').noteMarkdownToolbar,true);
 assert.equal(settingsCategoryDefaults('board').boardSearchEnabled,true);
});

test('profiles round-trip all portable preferences without mutating their source',()=>{
 const settings=cleanPluginSettings({settingsLanguage:'en',defaultCardStyle:'index',canvasBackground:'grid',accent:'rose',defaultCardWidth:337,defaultTextSize:19,gridStep:31,previewLimit:78,detailZoom:.37,zoomSpeed:.72,panSpeed:1.7,dragThreshold:7,nudgeStep:3,fastNudge:33,noteMarkdownToolbar:false,boardSearchEnabled:false});
 const before=structuredClone(settings),text=exportSettingsProfile(Object.freeze(settings)),parsed=JSON.parse(text);
 assert.equal(parsed.format,'thoughtspace-preferences');assert.equal(parsed.version,1);
 assert.deepEqual(settings,before);
 const patch=parseSettingsProfile(text);
 assert.equal(Object.keys(patch).length,Object.values(settingsCategoryKeys).flat().length);
 for(const [key,value] of Object.entries(patch))assert.deepEqual(value,settings[key as keyof typeof settings],key);
 const target=cleanPluginSettings({settingsLanguage:'zh-CN',cardFolder:'Unchanged/cards'});Object.assign(target,patch);
 assert.equal(target.defaultCardStyle,'index');assert.equal(target.defaultCardWidth,337);assert.equal(target.zoomSpeed,.72);
 assert.equal(target.settingsLanguage,'zh-CN');assert.equal(target.cardFolder,'Unchanged/cards');
});

test('export excludes private paths, filing and upload flags, language, and native state',()=>{
 const settings=cleanPluginSettings({canvasBackground:'image',backgroundImagePath:'Secret/image.png',cardFolder:'Secret/cards',journalFolder:'Secret/journal',autoFileCards:true,cleanupEmptyFolders:true,imageHostEnabled:true,settingsLanguage:'en',notePaneLeafId:'secret-session',favoriteBoards:['secret.thoughtspace'],nativeBookmarksMigrated:true,pendingBookmarkChanges:{'Secret/note.md':true}});
 const text=exportSettingsProfile(settings),patch=parseSettingsProfile(text);
 for(const key of ['canvasBackground','backgroundImagePath','cardFolder','journalFolder','autoFileCards','cleanupEmptyFolders','imageHostEnabled','settingsLanguage','notePaneLeafId','favoriteBoards','database','hub','layoutPresets','nativeBookmarksMigrated','pendingBookmarkChanges'])assert.equal(Object.hasOwn(patch,key),false,key);
 assert.equal(text.includes('Secret'),false);assert.equal(text.includes('secret'),false);
 assert.equal(patch.noteMarkdownToolbar,true);assert.equal(patch.boardSearchEnabled,true);
 assert.equal(settings.canvasBackground,'image');
});

test('import returns only provided keys and never fills omitted preferences',()=>{
 const patch=parseSettingsProfile(profile({defaultCardStyle:'sticky',zoomSpeed:1.23}));
 assert.deepEqual(patch,{defaultCardStyle:'sticky',zoomSpeed:1.23});
 const current=cleanPluginSettings({accent:'amber',readingSize:20,canvasBackground:'image',backgroundImagePath:'Assets/keep.png',favoriteBoards:['keep.thoughtspace']});
 const before=structuredClone(current);Object.assign(current,patch);
 assert.deepEqual(current,{...before,defaultCardStyle:'sticky',zoomSpeed:1.23});
});

test('profiles reject malformed envelopes, unsupported versions and excessive byte length',()=>{
 for(const input of ['', '{', 'not JSON'])rejects(input,'invalid-json');
 for(const value of [null,[],42,true,'profile',{}, {format:'other',version:1,preferences:{accent:'blue'}},{format:'thoughtspace-preferences',version:1,preferences:{accent:'blue'},extra:true}])rejects(JSON.stringify(value),'invalid-format');
 for(const version of [undefined,0,2,'1',null])rejects(JSON.stringify({format:'thoughtspace-preferences',version,preferences:{accent:'blue'}}),'unsupported-version');
 for(const preferences of [undefined,null,[],{},true,42,'blue'])rejects(profile(preferences),'invalid-preferences');
 rejects(' '.repeat(settingsProfileMaxLength+1),'too-large');
 rejects('界'.repeat(Math.ceil(settingsProfileMaxLength/3)),'too-large');
});

test('profiles reject every nonportable, unknown and prototype-related key',()=>{
 for(const key of ['backgroundImagePath','cardFolder','journalFolder','autoFileCards','cleanupEmptyFolders','imageHostEnabled','settingsLanguage','favoriteBoards','database','hub','layoutPresets','notePaneLeafId','pendingBookmarkChanges','unexpected','__proto__','prototype','constructor']){
  rejects(`{"format":"thoughtspace-preferences","version":1,"preferences":{"${key}":true,"accent":"blue"}}`,'unknown-key');
 }
 assert.equal(Object.hasOwn({},'polluted'),false);
});

test('all imported values are strictly typed and validated instead of coerced or clamped',()=>{
 const invalid:{[key:string]:unknown[]}={
  accent:['purple',null,1],glassEffects:['false',0,{},[]],readingSize:[15,'16',null],defaultCardStyle:['unknown',null,{}],
  defaultCardWidth:[219,521,'300'],defaultTextSize:[11,33,'16'],gridStep:[7,65],previewLimit:[19,161],detailZoom:[.19,.91],zoomSpeed:[.29,2.01],panSpeed:[.29,3.01],dragThreshold:[1,13],nudgeStep:[0,11],fastNudge:[9,101],
  canvasBackground:['image','transparent'],leftDrag:['drag',null],wheelMode:['scroll',1],zoomAnchor:['cursor',true],defaultEdgeDirection:['backward'],defaultEdgeStyle:['rounded'],toolbarDensity:['dense'],surfaceStyle:['solid'],density:['dense'],readingWidth:['full'],
 };
 for(const [key,values] of Object.entries(invalid))for(const value of values)rejects(profile({[key]:value}),'invalid-value');
 rejects('{"format":"thoughtspace-preferences","version":1,"preferences":{"zoomSpeed":1e999}}','invalid-value');
 assert.deepEqual(parseSettingsProfile(profile({zoomSpeed:.3,panSpeed:3,dragThreshold:2,defaultCardWidth:520,defaultTextSize:12,gridStep:64,previewLimit:20,detailZoom:.9,nudgeStep:1,fastNudge:100})),{zoomSpeed:.3,panSpeed:3,dragThreshold:2,defaultCardWidth:520,defaultTextSize:12,gridStep:64,previewLimit:20,detailZoom:.9,nudgeStep:1,fastNudge:100});
});
