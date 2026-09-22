import type {App,TFile,WorkspaceLeaf} from 'obsidian';
export interface CalendarService{
 calendarApiVersion:1;ready:boolean;settings:{journalFolder:string};
 ensureCalendar(show?:boolean):Promise<WorkspaceLeaf>;ensureJournal(show?:boolean):Promise<WorkspaceLeaf>;
 ensureJournalFile(day?:string):Promise<TFile>;getJournalFile(day?:string):Promise<TFile>;journal():Promise<TFile>;
 selectJournalDay(day:string):Promise<void>;selectJournalMonth(day:string,month:string,todo:boolean):Promise<void>;
 fileOldJournals():Promise<unknown>;
}
export function calendarService(app:App):CalendarService|undefined{
 const service=(app as unknown as {plugins?:{getPlugin(id:string):Partial<CalendarService>|undefined}}).plugins?.getPlugin('thoughtspace-calendar');
 return service?.calendarApiVersion===1&&service.ready&&typeof service.ensureCalendar==='function'?service as CalendarService:undefined;
}
export function requireCalendar(app:App){const service=calendarService(app);if(!service)throw Error('日历已独立为“ThoughtSpace 日历与日记”，请先在第三方插件中启用它。');return service;}
