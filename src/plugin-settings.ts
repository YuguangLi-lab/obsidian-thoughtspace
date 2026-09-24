import {cleanPaperPreferences} from './paper-appearance';
import {cleanBackgroundImagePreferences} from './background-image';
import {cleanLayoutPresets,type LayoutPreset} from './layout-presets';
import {cleanDatabasePreferences,type DatabasePreferences} from './database-custom';
import {cleanHubPreferences,type HubPreferences} from './space-hub';
import {cleanBoardPreferences,type BoardPreferences} from './board-experience';
import {defaultFilingSettings,validateFolders,type FilingSettings} from './filing';
import {defaultAppearance,type AppearanceSettings} from './workspace';
import {cleanFavorites} from './navigation';
import {isOneOf,isRecord} from './value-guards';

export type ThoughtSpacePreferences=FilingSettings&AppearanceSettings&BoardPreferences&{
 layoutPresets:LayoutPreset[];imageHostEnabled?:boolean;database:DatabasePreferences;hub:HubPreferences;favoriteBoards:string[];
 notePaneLeafId?:string;noteMarkdownToolbar?:boolean;boardSearchEnabled?:boolean;
 nativeBookmarksMigrated?:boolean;pendingBookmarkChanges?:Record<string,boolean>;
};
/** Persisted plugin data is untrusted JSON, including after sync or manual editing. */
export function cleanPluginSettings(raw:unknown):ThoughtSpacePreferences {
 const saved=isRecord(raw)?raw:{};
 const out:ThoughtSpacePreferences={...defaultFilingSettings,...defaultAppearance,...cleanBoardPreferences(saved),...cleanPaperPreferences(saved),...cleanBackgroundImagePreferences(saved),
  layoutPresets:cleanLayoutPresets(saved.layoutPresets),database:cleanDatabasePreferences(saved.database),hub:cleanHubPreferences(saved.hub),favoriteBoards:cleanFavorites(saved.favoriteBoards)};
 try{Object.assign(out,validateFolders(typeof saved.cardFolder==='string'?saved.cardFolder:out.cardFolder,typeof saved.journalFolder==='string'?saved.journalFolder:out.journalFolder));}catch{/* Invalid folders never redirect automatic filing outside the configured vault paths. */}
 for(const key of ['autoFileCards','cleanupEmptyFolders','showMinimap','glassEffects','imageHostEnabled','noteMarkdownToolbar','boardSearchEnabled','nativeBookmarksMigrated'] as const)if(typeof saved[key]==='boolean')out[key]=saved[key];
 if(isOneOf(saved.surfaceStyle,['soft','paper']))out.surfaceStyle=saved.surfaceStyle;
 if(isOneOf(saved.readingSize,[14,16,18,20]))out.readingSize=saved.readingSize;
 if(isOneOf(saved.readingWidth,['standard','wide']))out.readingWidth=saved.readingWidth;
 if(isOneOf(saved.accent,['forest','blue','amber','rose']))out.accent=saved.accent;
 if(isOneOf(saved.density,['comfortable','compact']))out.density=saved.density;
 if(isOneOf(saved.canvasBackground,['dots','grid','plain','paper','image']))out.canvasBackground=saved.canvasBackground;
 if(typeof saved.notePaneLeafId==='string')out.notePaneLeafId=saved.notePaneLeafId;
 if(isRecord(saved.pendingBookmarkChanges))out.pendingBookmarkChanges=Object.fromEntries(Object.entries(saved.pendingBookmarkChanges).filter((entry):entry is [string,boolean]=>typeof entry[1]==='boolean'));
 return out;
}
