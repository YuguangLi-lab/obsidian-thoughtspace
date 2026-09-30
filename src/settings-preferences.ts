import {boardInputPreferenceKeys,defaultBoardPreferences} from './board-experience';
import {cardStyleChoices} from './card-style';
import {defaultAppearance} from './workspace';
import type {ThoughtSpacePreferences} from './plugin-settings';

export type SettingsLanguage='zh-CN'|'en';
export type SettingsLanguagePreference='auto'|SettingsLanguage;
export function resolveSettingsLanguage(preference:SettingsLanguagePreference|undefined,hostLocale:string):SettingsLanguage {
 if(preference==='en'||preference==='zh-CN')return preference;
 return /^zh(?:[-_]|$)/i.test(hostLocale.trim())?'zh-CN':'en';
}

export const settingsCategoryKeys={
 general:['surfaceStyle','accent','glassEffects','density'],
 cards:['defaultCardStyle','defaultCardWidth','defaultTextSize','defaultEdgeStyle','defaultEdgeDirection','noteMarkdownToolbar'],
 board:['canvasBackground','showMinimap','boardSearchEnabled','toolbarDensity','gridStep','alignmentGuides','axisLock','aspectLock','previewLimit','detailZoom','showCardTags','showPorts','showBoardHints'],
 input:boardInputPreferenceKeys,
 reading:['readingSize','readingWidth'],
} as const;
export type SettingsCategory=keyof typeof settingsCategoryKeys;
export type SettingsPreferenceKey=typeof settingsCategoryKeys[SettingsCategory][number];
export type SettingsPreferencePatch=Partial<Pick<ThoughtSpacePreferences,SettingsPreferenceKey>>;

const categoryDefaults={...defaultAppearance,...defaultBoardPreferences,noteMarkdownToolbar:true,boardSearchEnabled:true} as const;
export function settingsCategoryDefaults(category:SettingsCategory):SettingsPreferencePatch {
 const result:SettingsPreferencePatch={};
 for(const key of settingsCategoryKeys[category])Object.assign(result,{[key]:categoryDefaults[key]});
 return result;
}
/** Page resets never replace the full settings object or touch vault-specific state. */
export function resetSettingsCategory(settings:ThoughtSpacePreferences,category:SettingsCategory):void {
 Object.assign(settings,settingsCategoryDefaults(category));
}

const oneOf=(...values:readonly (string|number)[])=>(value:unknown)=>values.some(item=>item===value);
const boolean=(value:unknown)=>typeof value==='boolean';
const numberIn=(min:number,max:number)=>(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const profileValidators:Record<SettingsPreferenceKey,(value:unknown)=>boolean>={
 surfaceStyle:oneOf('soft','paper'),accent:oneOf('forest','blue','amber','rose'),glassEffects:boolean,density:oneOf('comfortable','compact'),
 defaultCardStyle:oneOf(...Object.keys(cardStyleChoices)),defaultCardWidth:numberIn(220,520),defaultTextSize:numberIn(12,32),defaultEdgeStyle:oneOf('curve','straight','elbow'),defaultEdgeDirection:oneOf('forward','both','none'),noteMarkdownToolbar:boolean,
 // Custom image files are vault-local and are deliberately not portable in a profile.
 canvasBackground:oneOf('dots','grid','plain','paper'),showMinimap:boolean,boardSearchEnabled:boolean,toolbarDensity:oneOf('compact','comfortable'),gridStep:numberIn(8,64),alignmentGuides:boolean,axisLock:boolean,aspectLock:boolean,previewLimit:numberIn(20,160),detailZoom:numberIn(.2,.9),showCardTags:boolean,showPorts:boolean,showBoardHints:boolean,
 leftDrag:oneOf('pan','select','none'),rightDrag:oneOf('pan','select','none'),middleDrag:oneOf('pan','select','none'),wheelMode:oneOf('zoom','pan'),zoomSpeed:numberIn(.3,2),reverseWheelZoom:boolean,boardQuickKeys:boolean,panSpeed:numberIn(.3,3),reverseWheelPan:boolean,zoomAnchor:oneOf('pointer','center'),dragThreshold:numberIn(2,12),arrowNudge:boolean,deleteKeys:boolean,nudgeStep:numberIn(1,10),fastNudge:numberIn(10,100),
 readingSize:oneOf(14,16,18,20),readingWidth:oneOf('standard','wide'),
};
export const settingsProfileMaxLength=64*1024;
export type SettingsProfileErrorCode='too-large'|'invalid-json'|'invalid-format'|'unsupported-version'|'invalid-preferences'|'unknown-key'|'invalid-value';
export class SettingsProfileError extends Error {
 constructor(readonly code:SettingsProfileErrorCode,readonly key?:string){super(`Invalid ThoughtSpace preferences: ${code}`);this.name='SettingsProfileError';}
}

function plainRecord(value:unknown):value is Record<string,unknown> {
 return typeof value==='object'&&value!==null&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
}
function validatePreferences(value:unknown):SettingsPreferencePatch {
 if(!plainRecord(value)||!Object.keys(value).length)throw new SettingsProfileError('invalid-preferences');
 const result:SettingsPreferencePatch={};
 for(const [key,item] of Object.entries(value)){
  if(!Object.hasOwn(profileValidators,key))throw new SettingsProfileError('unknown-key',key);
  const knownKey=key as SettingsPreferenceKey;
  if(!profileValidators[knownKey](item))throw new SettingsProfileError('invalid-value',key);
  Object.assign(result,{[knownKey]:item});
 }
 return result;
}

/** Only appearance and interaction values leave the vault; paths and state never do. */
export function exportSettingsProfile(settings:ThoughtSpacePreferences):string {
 const preferences:SettingsPreferencePatch={};
 for(const key of Object.keys(profileValidators) as SettingsPreferenceKey[]){
  if(key==='canvasBackground'&&settings[key]==='image')continue;
  Object.assign(preferences,{[key]:settings[key]??categoryDefaults[key]});
 }
 return JSON.stringify({format:'thoughtspace-preferences',version:1,preferences:validatePreferences(preferences)},null,2);
}

/** Strict import returns a patch: callers retain every omitted or non-portable preference. */
export function parseSettingsProfile(text:string):SettingsPreferencePatch {
 if(typeof text!=='string')throw new SettingsProfileError('invalid-json');
 if(text.length>settingsProfileMaxLength||new TextEncoder().encode(text).length>settingsProfileMaxLength)throw new SettingsProfileError('too-large');
 let value:unknown;
 try{value=JSON.parse(text);}catch{throw new SettingsProfileError('invalid-json');}
 if(!plainRecord(value)||Object.keys(value).some(key=>!['format','version','preferences'].includes(key))||value.format!=='thoughtspace-preferences')throw new SettingsProfileError('invalid-format');
 if(value.version!==1)throw new SettingsProfileError('unsupported-version');
 return validatePreferences(value.preferences);
}
