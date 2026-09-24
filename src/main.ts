import {consumeMarkdownPreviewWheel} from './markdown-preview-scroll';
import {InlineTextFit} from './inline-text-fit';
import {markdownEdit} from './markdown-edit';
import {SavedViewsModal} from './saved-views-view';
import {PaperSettingsModal} from './paper-settings-view';
import {BackgroundImageModal} from './background-image-view';
import {cleanBackgroundImagePreferences,backgroundImageStamp,validateBackgroundImageBytes,MAX_BACKGROUND_IMAGE_BYTES} from './background-image';
import {cleanPaperPreferences,paperBaseColor,paperAppearanceStamp} from './paper-appearance';
import {addSavedView} from './saved-views';
import {cleanLayoutPresets} from './layout-presets';
import {GroupOrganizerModal} from './group-organizer-view';
import {outlineTree} from './group-organizer';
import {renderTextPreview} from './text-preview';
import {whenBoardStylesReady} from './stylesheet-ready';
import {BlankDoubleClick} from './blank-double-click';
import {createHash} from 'crypto';
import {resolve as resolvePath} from 'path';
import {cleanPluginSettings,type ThoughtSpacePreferences} from './plugin-settings';
import {hostPlugin,fileExplorer,hostSettings,workspaceLeafId} from './host-capabilities';
import {parseLayoutSnapshot} from './layout-snapshot-data';
import {isRecord,isUnknownArray} from './value-guards';
import {mediaDimensions} from './media-geometry';
import {setBoardEdgeStyle,inheritNewEdgeStyle} from './model';
import {BoardSearchSync,SEARCH_FOLDER,searchBoardPath,searchIndexTarget} from './native-search';
import {PdfDocumentPool} from './pdf-document-pool';
import {discloseBranches,makeChildConnection,makeChildConnections,childConnectionCandidates,type BranchDisclosure} from './branch-disclosure';
import {pdfCard,pdfSubpath,pdfPage,renderPdfThumbnail,isPdfFile,pdfDropReference,pdfPageKey} from './pdf-card';
import {selectionFormatKey} from './selection-format';
import {selectionEdges,patchSelectionEdges,type SelectionEdgeScope,type SelectionEdgePatch} from './selection-edges';
import {cardDisplayTitle,setCardTitle} from './card-title-model';
import {bindCardTitle} from './card-title-edit';
import {noteRenamePath} from './note-rename';
import {SharedOpen} from './view-opening';
import {replaceSidebarContents,firstNoteReferences} from './sidebar-content';
import {sidebarSearchNavigation} from './sidebar-navigation';
import {toolbarNavigation} from './toolbar-navigation';
import type {SessionUpdate} from './session-events';
import {nodeRenderKey,syncNodeGeometry} from './node-render-key';
import {editTopic} from './mindmap-editor';
import {mindmapNavigation,mindmapParent} from './mindmap-navigation';
import {MindmapPresetsModal} from './mindmap-presets-view';
import {MindmapStudioModal} from './mindmap-studio-view';
import {mindmapSignature} from './mindmap-studio';
import {uploadHostedImage,imageHostApi,remoteImageUrl} from './image-host';
import {YingjianModal} from './yingjian-view';
import {playInYingjianPlugin} from './yingjian-player-adapter';
import {videoCaptureRequest,addVideoCaptureCard,addVideoCaptureObjects,videoCaptureContent} from './video-capture';
import {yingjianLink,yingjianNotePath} from './yingjian';
import {BoardReuseModal,ReuseDestination} from './board-reuse-view';
import {ReuseBundle,ReuseOptions,reuseBundle,reuseStamp,reusePlan,rebaseReuseSources} from './board-reuse';
import {BoardSearchModal} from './board-search-view';
import {dragStartSnapshot,dragGeometry,dragDisplayBoard,dragCommitChanges} from './drag-draft';
import {inlineDisplayBoard,InlineGeometry} from './inline-geometry';
import {nodeFitChanges} from './node-fit-batch';
import {dragTargets,activeDragTargets,DragTarget} from './drag-targets';
import {alignmentIndex,alignDrag,AlignmentIndex,Guide} from './alignment-guides';
import {SectionCatalogModal} from './section-catalog-view';
import {WRITING,WritingView} from './writing-view';
import {appendEvidence,evidenceTarget,MaterialPoint} from './evidence';
import {preserveToolbarFocus} from './toolbar-focus';
import {installToolbarOverflow} from './toolbar-overflow';
import {installToolbarWheel} from './toolbar-scroll';
import {installRailToolSearch} from './rail-tool-search';
import {boardWheelIntent} from './board-wheel';
import {boardInputCommands,type BoardInputAction,type BoardInputCommandTarget} from './board-input-commands';
import {writeNativeNoteDraft,readCurrentNativeNote} from './native-note-state';
import {NoteMarkdownToolbars} from './note-markdown-toolbar';
import {InlineCardFit} from './inline-card-fit';
import {InlineNodeEditor} from './inline-node-editor';
import {markdownToolbar} from './markdown-toolbar';
import {LayoutRefreshQueue} from './layout-refresh-queue';
import {branchOutline,branchMarkdown,reparentBranch} from './mindmap-flow';
import {relationSelection,shortestRelationPath,unfoldRelationAncestors,insertBetween,insertionPosition,disconnectInternal,RelationDirection} from './graph-navigation';
import {excerptPresentation,textExcerptPresentation,ExcerptSource,sourceLinkTarget,conceptDocument} from './excerpt-sources';
import {MaterialsModal,MaterialsWorkbench,MaterialAdapter} from './materials-view';
import {Fragment,OutlineTopic,outlineBoard,rebaseFragment,selectionFragment,pdfLiteralText,pdfExcerptDocument,excerptNoteMarkdown,MaterialImportOptions,MaterialImportResult,excerptDocuments} from './materials';
import {EdgeLayer} from './edge-layer';
import {connectionTarget,duplicateConnection,reconnectEdge} from './connection-flow';
import {sectionBounds,validSectionRect,SectionRect,foldSections,sectionDisplayNode} from './sections';
import {gridLanding,gridSteps,visibleGridSize} from './canvas-controls';
import {NativeBridgeModal} from './native-bridge-view';
import {boardNotePaths,nativeIndex} from './native-bridge';
import {SpaceHubModal} from './space-hub-view';
import {rememberBoard,remapHubPaths,addHubNotes} from './space-hub';
import {LayoutPlannerModal} from './layout-planner-view';
import {ReadingDesk} from './reading-desk-view';
import {reviewLabels,readingTitle} from './reading-desk';
import {BoardStudioModal} from './board-studio-view';
import {studioDraft,nodeName,mergeTexts,splitParagraphs} from './board-studio';
import {NodeStyle,ObjectFilter,ViewTrail,filterObjects,readNodeStyle,applyNodeStyle,stepLayers,fitSections,directionalNode,boardIssues,textBatch,constrainedDrag,resized} from './board-experience';
import {BoardAction,BoardActionModal,boardPreferenceControls,mousePreferenceControls} from './board-experience-view';
import { boardOutline, measureNoteCard } from './workspace-tools';
import { designTokens, themeSurface } from './ui-tokens';
import { fitTextNode, inkLabels, textFontFamily } from './text-tools';
import { boardLink, parseBoardLink } from './deeplinks';
import { nativeBookmarks, NativeBookmarks, bookmarkedBoards } from './bookmarks';
import { normalizeNativeTags, suggestedNoteName } from './native-tags';
import { viewportRect, visibleNodes, intersects, markdownPreview, RenderQueue } from './rendering';
import { connectionPath, connectionSides, Side } from './connections';
import { branchDescendants, branchState, visibleBranchBoard, unfoldAncestors, layoutMindmap, reflowAutomaticMindmaps, validateBranches } from './mindmap';
import { TextModal, EdgeModal, ImagePicker, isImage } from './content-tools';
import {calendarService,requireCalendar} from './calendar-integration';
import { boardTemplates, cleanFavorites, remapFavorites,  OutlineKind, taskSummary, TaskFilter, visibleTasks } from './navigation';
import { Alignment, alignmentLabels, alignSelection, foldCards, marqueeSelection, moveSelection, selectionRect } from './board-tools';
import { isOverdue, readProperties, statuses } from './database';
import { DatabaseModal, PropertyStore } from './database-view';
import { App, type CachedMetadata, Component, FileSystemAdapter, FileView, ItemView, Keymap, FuzzySuggestModal, MarkdownView, MarkdownRenderer, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder, WorkspaceLeaf, ViewStateResult, getAllTags, getFrontMatterInfo, loadPdfJs, normalizePath, parseLinktext, setIcon } from 'obsidian';
import { assertBoardGeometry, Board, Card, cardFillHex, History, boardLinks, wouldCycle, expandedSelection, movableSelection, extractSubboard, tidyBoard, canvasExport, clone, colors, colorNames, contained, emptyBoard, extractTasks, fitViewport, parseBoard, removeNodes, safeName, toggleTask, uid } from './model';
import { validateFolders, localDay, tagFolder } from './filing';
import { AppearanceSettings, LibraryScope, LibrarySort, libraryFiles, noteExcerpt, isWorkspaceFile } from './workspace';

const DOCK = 'thoughtspace-navigator',MATERIALS='thoughtspace-materials',MATERIAL_DRAG='text/x-thoughtspace-fragment';
const VIEW = 'thoughtspace-board', EXT = 'thoughtspace', ROOT = 'ThoughtSpace';
const report = (e: unknown) => { console.error('[ThoughtSpace]', e); new Notice(`思维白板：${e instanceof Error ? e.message : String(e)}`, 8000); };
const act = (f: () => unknown) => { try { Promise.resolve(f()).catch(report); } catch (e) { report(e); } };
function button(parent: HTMLElement, label: string, icon: string, callback: () => unknown, cls = '') {
  const b = parent.createEl('button', { cls: `ts-button ${cls}`, attr: { 'aria-label': label, title: label } });
  if (icon) setIcon(b.createSpan(), icon);
  b.createSpan({ text: label }); b.onclick = () => act(callback); return b;
}
class Prompt extends Modal {
  constructor(app: App, private title: string, private initial: string, private submit: (text: string) => Promise<void> | void) { super(app); }
  onOpen() {
    this.modalEl.addClass('ts-prompt-modal');themeSurface(this.modalEl);
    this.contentEl.createEl('h2', { text: this.title });
    const input = this.contentEl.createEl('input', { type: 'text', value: this.initial, cls: 'ts-wide' });
    const save = button(this.contentEl, '确定', 'check', async () => { if (!input.value.trim()) return; save.disabled = true; try { await this.submit(input.value.trim()); this.close(); } finally { save.disabled = false; } }, 'mod-cta');
    input.onkeydown = e => { if (e.key === 'Enter') save.click(); }; input.focus(); input.select();
  }
  onClose() { this.contentEl.empty(); }
}
class NotePicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private pick: (file: TFile) => unknown, placeholder='搜索仓库中的 Markdown 笔记…',private includePdf=false) { super(app); this.setPlaceholder(placeholder); }
  getItems() { return (this.includePdf?this.app.vault.getFiles().filter(f=>f.extension==='md'||isPdfFile(f.path)):this.app.vault.getMarkdownFiles()).filter(isWorkspaceFile); }
  getItemText(file: TFile) { return file.path; }
  onChooseItem(file: TFile) { act(() => this.pick(file)); }
}
class ReadingSourcePicker extends FuzzySuggestModal<TFile>{
 constructor(app:App,private pick:(file:TFile)=>unknown,private pdfOnly=false){super(app);this.setPlaceholder(pdfOnly?'选择仓库中的 PDF…':'打开 Markdown 笔记或 PDF，选字拖入白板…');}
 getItems(){return this.app.vault.getFiles().filter(f=>isWorkspaceFile(f)&&(isPdfFile(f.path)||!this.pdfOnly&&f.extension==='md'));}
 getItemText(file:TFile){return file.path;}
 onChooseItem(file:TFile){act(()=>this.pick(file));}
}
class BoardPicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private current: TFile | null, private pick: (file: TFile) => unknown) { super(app); this.setPlaceholder('搜索要放入当前白板的子白板…'); }
  getItems() { return this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => f.extension === EXT && f !== this.current); }
  getItemText(file: TFile) { return file.path; }
  onChooseItem(file: TFile) { act(() => this.pick(file)); }
}
class BoardFinder extends FuzzySuggestModal<Card> {
  constructor(app: App, private nodes: Card[], private choose: (node: Card) => unknown) { super(app); this.setPlaceholder('查找当前白板的卡片、分组或子白板…'); }
  getItems() { return this.nodes; }
  getItemText(node: Card) {
    const file = node.file ? this.app.vault.getAbstractFileByPath(node.file) : null;
    const tags = file instanceof TFile ? getAllTags(this.app.metadataCache.getFileCache(file) || {}) || [] : [];
    return `${node.kind === 'section' ? '分组' : node.kind === 'board' ? '子白板' : '卡片'} · ${file instanceof TFile ? file.basename : node.title || node.text || node.file} ${tags.join(' ')}`;
  }
  onChooseItem(node: Card) { act(() => this.choose(node)); }
}
class ActionPicker extends FuzzySuggestModal<{title:string;run:()=>unknown}>{
 constructor(app:App,title:string,private actions:{title:string;run:()=>unknown}[]){super(app);this.setPlaceholder(title);}
 getItems(){return this.actions;}getItemText(item:{title:string}){return item.title;}onChooseItem(item:{run:()=>unknown}){act(item.run);}
}
class NotePreview extends Modal {
  private previewScope?: Component;
  private generation = 0;
  constructor(app: App, private file: TFile, private plugin: ThoughtSpace) { super(app); }
  async onOpen() {
    this.modalEl.addClass('ts-preview-modal');themeSurface(this.modalEl);this.titleEl.setText(this.file.basename);
    const header=this.contentEl.createDiv('ts-preview-heading');
    header.createDiv({cls:'ts-preview-path',text:this.file.path,attr:{title:this.file.path}});
    const actions=header.createDiv('ts-preview-actions');
    button(actions,'编辑笔记','pencil',async()=>{this.close();await this.plugin.editNote(this.file);});
    button(actions,'打开原文','external-link',async()=>{this.close();await this.app.workspace.getLeaf('tab').openFile(this.file);});
    const body=this.contentEl.createDiv('ts-preview-body');
    await this.loadPreview(body);
  }
  private async loadPreview(body:HTMLElement) {
    const run=++this.generation;
    this.previewScope?.unload();const scope=this.previewScope=new Component();scope.load();
    const current=()=>run===this.generation&&body.isConnected;
    body.empty();body.setAttribute('aria-busy','true');
    const status=body.createDiv({cls:'ts-preview-loading',text:'正在加载笔记…',attr:{role:'status'}});
    try {
      const text=await this.app.vault.read(this.file);if(!current())return;
      status.remove();const document=body.createDiv('ts-preview-document markdown-rendered');
      // Use Obsidian's frontmatter boundary; the document's own headings are content.
      const info=getFrontMatterInfo(text),content=info.exists?text.slice(info.contentStart):text;
      await MarkdownRenderer.render(this.app,content,document,this.file.path,scope);
      if(!current())return;
      document.querySelectorAll('input').forEach(input=>{input.disabled=true;});
      this.renderContext(body);
    } catch {
      if(!current())return;
      scope.unload();body.empty();
      const error=body.createDiv({cls:'ts-preview-error',attr:{role:'status'}});
      error.createSpan({text:'暂时无法读取这篇笔记'});
      button(error,'重试','rotate-cw',()=>this.loadPreview(body));
    } finally {
      // A Markdown postprocessor may attach children after the modal was closed.
      if(!current())scope.unload();else body.setAttribute('aria-busy','false');
    }
  }
  private renderContext(body:HTMLElement) {
    const context=body.createDiv('ts-note-context');
    const details=context.createEl('details',{cls:'ts-preview-relations'});
    details.createEl('summary',{text:'出现在哪些白板'});
    const boards=details.createDiv('ts-context-links');let loaded=false;
    details.ontoggle=async()=>{
      if(!details.open||loaded||!details.isConnected)return;
      loaded=true;boards.setAttribute('aria-busy','true');
      const loading=boards.createSpan({cls:'ts-muted',text:'正在查找关联白板…'});
      let count=0,skipped=0;
      try {
        for(const file of this.app.vault.getFiles().filter(isWorkspaceFile).filter(f=>f.extension===EXT)) {
          if(!details.isConnected||!details.open){loaded=false;boards.empty();return;}
          try {
            const board=await this.plugin.readBoard(file);
            if(!details.isConnected||!details.open){loaded=false;boards.empty();return;}
            const nodes=board.nodes.filter(n=>n.kind==='card'&&n.file===this.file.path);
            if(!nodes.length)continue;count++;
            button(boards,`${file.basename}${nodes.length>1?` · ${nodes.length} 处`:''}`,'layout-dashboard',async()=>{
              this.close();await this.plugin.openBoard(file);
              const view=this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).find(v=>v instanceof BoardView&&v.file===file) as BoardView|undefined;
              await new Promise<void>(resolve=>(body.ownerDocument.defaultView||window).requestAnimationFrame(()=>resolve()));view?.locateFile(this.file.path);
            });
          } catch {skipped++;}
        }
        if(!count)boards.createSpan({cls:'ts-muted',text:skipped?'暂未找到可读取的关联白板':'尚未加入白板'});
        if(skipped)boards.createSpan({cls:'ts-muted',text:`${skipped} 块白板无法读取`});
      } finally {loading.remove();boards.removeAttribute('aria-busy');}
    };
    const links=this.app.metadataCache.resolvedLinks;
    const incoming=Object.keys(links).filter(path=>path!==this.file.path&&isWorkspaceFile({path})&&links[path]?.[this.file.path]);
    const outgoing=Object.keys(links[this.file.path]||{}).filter(path=>path!==this.file.path&&isWorkspaceFile({path}));
    for(const [heading,paths] of [['链接到此笔记',incoming],['此笔记的链接',outgoing]] as const) {
      const section=context.createEl('details',{cls:'ts-preview-links'});
      section.createEl('summary',{text:`${heading} · ${paths.length}`});
      const list=section.createDiv('ts-context-links');
      for(const path of paths.slice(0,100)){const file=this.app.vault.getAbstractFileByPath(path);if(file instanceof TFile)button(list,file.basename,'link',async()=>{this.close();await this.app.workspace.getLeaf('tab').openFile(file);});}
      if(!paths.length)list.createSpan({cls:'ts-muted',text:'暂无已解析的笔记链接'});
      if(paths.length>100)list.createSpan({cls:'ts-muted',text:'显示前 100 条；更多链接可在原生反向链接中查看'});
    }
  }
  onClose(){++this.generation;this.previewScope?.unload();this.contentEl.empty();}
}
/** 一个文件共用一个会话，多窗口共享状态；保存串行化并比较磁盘原文。 */
class Session {
  readonly convertingTexts=new Set<string>();
  board: Board; history = new History(); listeners = new Set<(kind:SessionUpdate) => void>(); baseline: string;
  saving = false; blocked = false; status = '已保存'; private persistQueued=false;private externalRead=0; private queue: Promise<void> = Promise.resolve();
  constructor(private plugin: ThoughtSpace, public file: TFile, raw: string) { this.board = parseBoard(raw); this.baseline = raw; }
  emit(kind:SessionUpdate='board') { this.listeners.forEach(fn => {try{fn(kind);}catch(e){report(e);}}); }
  change(fn: (b: Board) => void, before = clone(this.board), allowLocked=false, recordHistory=true) {
    if (this.blocked) { new Notice('白板已暂停写入，请关闭所有该白板标签页后重新打开。'); return; }
    try { fn(this.board); inheritNewEdgeStyle(this.board,before); const nodeIndex=new Map(this.board.nodes.map(n=>[n.id,n]));for(const old of before.nodes.filter(n=>n.locked&&!allowLocked)){const current=nodeIndex.get(old.id);if(!current)throw Error('请先解锁对象再移出或转换');if(current.locked)Object.assign(current,{x:old.x,y:old.y,width:old.width,height:old.height,collapsed:old.collapsed,expandedHeight:old.expandedHeight});}assertBoardGeometry(this.board);validateBranches(this.board);reflowAutomaticMindmaps(this.board,before);assertBoardGeometry(this.board); } catch(e) { this.board=before; throw e; } if (this.board.version < 2 && this.board.nodes.some(n => n.kind === 'board')) this.board.version = 2;
    if(recordHistory)this.history.push(before); this.persist(); this.emit();
  }
  undo(redo = false) { if (this.blocked) return; const b = redo ? this.history.redo(this.board) : this.history.undo(this.board); if (b) { this.board = b; this.persist(); this.emit(); } }
  persist() {
    if(this.blocked)return;
    this.status = '保存中…';this.emit('status');
    if(this.persistQueued)return;this.persistQueued=true;
    this.queue = this.queue.then(async () => {
      this.persistQueued=false;
      if (this.blocked) return;
      try{assertBoardGeometry(this.board);}catch(e){this.blocked=true;this.status='布局数据无效 · 原文件未覆盖';this.emit('board');report(e);return;}
      const next = JSON.stringify(this.board, null, 2); if (next === this.baseline) { this.status = '已保存'; this.emit('status'); return; }
      this.saving = true;
      try {
        await this.plugin.app.vault.process(this.file, disk => { if (disk !== this.baseline) throw new Error('检测到其他窗口或同步工具修改了白板'); return next; });
        this.baseline = next; this.status = this.persistQueued?'保存中…':'已保存';
      } catch (e) {
        this.blocked = true; this.status = '保存失败 · 本地草稿保留中';
        try {
          const recovered = await this.plugin.createUnique(this.file.parent?.path || '', `${this.file.basename}-恢复草稿`, EXT, JSON.stringify(this.board, null, 2));
          this.status = '写入暂停 · 已另存恢复草稿'; new Notice(`原白板未被覆盖。当前布局已另存：${recovered.path}`, 12000);
        } catch (backupError) { report(backupError); this.status = '保存失败 · 请用导出保留布局'; }
        report(e);
      } finally { this.saving = false; this.emit(this.blocked?'board':'status'); }
    });
  }
  async flush() { let pending:Promise<void>;do{pending=this.queue;await pending;}while(pending!==this.queue); }
  async externalUpdate() {
    if (this.saving || this.blocked) return;
    const readId=++this.externalRead;await this.flush();
    if (readId!==this.externalRead||this.saving || this.blocked) return;
    const baseline=this.baseline,board=this.board,pending=this.queue;
    const raw = await this.plugin.app.vault.read(this.file);
    // A newer local transaction or another completed read owns the current state.
    if(readId!==this.externalRead||this.blocked||this.saving||pending!==this.queue||baseline!==this.baseline||board!==this.board)return;
    if (raw === this.baseline) return;
    try { const b = parseBoard(raw); this.board = b; this.baseline = raw; this.history = new History(); this.status = '已同步外部修改'; this.emit(); }
    catch (e) { this.blocked = true; this.status = '外部文件格式错误 · 已暂停写入'; this.emit(); report(e); }
  }
}

type BoardGraph={graph:Map<string,string[]>;errors:Set<string>};
export default class ThoughtSpace extends Plugin {
  private videoCaptureQueue:Promise<unknown>=Promise.resolve();
  private async revealVideoCapture(raw:unknown){
    const request=videoCaptureRequest(raw);if(request.vaultId!==this.yingjianVaultId())throw Error('记录不属于此仓库');
    const board=this.app.vault.getAbstractFileByPath(request.board);if(!(board instanceof TFile)||!isWorkspaceFile(board))throw Error('白板已移除');
    await this.openBoard(board);
    const view=this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).find(v=>v instanceof BoardView&&v.file===board) as BoardView|undefined;
    if(!view)throw Error('白板尚未就绪');
    const nodes=view.session?.board.nodes.filter(n=>n.id==='yingjian-'+request.id||n.videoCapture?.id===request.id)||[];
    if(!nodes.length)throw Error('白板对象已移除，原始记录备份仍保留');view.revealNode(nodes[0].id);
  }
  readonly videoCaptureApi={version:1,nativeObjects:true,reveal:(raw:unknown)=>this.revealVideoCapture(raw),append:(raw:unknown)=>{const next=this.videoCaptureQueue.catch(()=>undefined).then(()=>this.receiveVideoCapture(raw));this.videoCaptureQueue=next;return next;},prepareNote:async(path:string)=>{
    const valid=yingjianNotePath(path),file=valid&&this.app.vault.getAbstractFileByPath(valid);if(!(file instanceof TFile))throw Error('记录笔记不存在');
    for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof BoardView)await leaf.view.prepareNoteOpen(file);
  }};
  sessions = new Map<TFile, Promise<Session>>();
  propertyStore!: PropertyStore;
  get journalRoot(){return calendarService(this.app)?.settings.journalFolder||this.settings.journalFolder;}
  copiedNodeStyle?:NodeStyle;
  noteToolbar?:NoteMarkdownToolbars;
  settings:ThoughtSpacePreferences=cleanPluginSettings(null);
  currentBoard?: BoardView;
  private spaceHub?:SpaceHubModal;
  private paperSettingsModal?:PaperSettingsModal;
  private backgroundImageModal?:BackgroundImageModal;
  private backgroundImagesClosed=false;
  private nativeBridge?:NativeBridgeModal;
  private nativeFilePopup?:Menu;
  private dockOpening?: Promise<WorkspaceLeaf>;private materialsOpening?:Promise<WorkspaceLeaf>;private materialFeedback?:()=>void;private materialDrag?:{token:string;text?:string;label?:string;run:(view:BoardView,point:{x:number;y:number})=>Promise<void>};
  readonly pdfDocuments=new PdfDocumentPool(loadPdfJs,{set:(fn,ms)=>window.setTimeout(fn,ms),clear:id=>window.clearTimeout(id)});
  private searchSync?:BoardSearchSync;private searchTimer?:number;
  private searchNavigationSequence=0;private searchNavigationStopped=false;
  private knownTags = new Map<TFile, string>();
  private hierarchyQueue: Promise<unknown> = Promise.resolve();
  private filingQueue: Promise<unknown> = Promise.resolve();
  private referenceQueue: Promise<void> = Promise.resolve();
  async onload() {
    this.registerHoverLinkSource('thoughtspace',{display:'ThoughtSpace 思维白板',defaultMod:true});
    const tokens=designTokens(document);this.register(()=>tokens.remove());
    this.register(()=>{this.backgroundImagesClosed=true;this.backgroundImageModal?.close();this.backgroundImageModal=undefined;this.paperSettingsModal?.close();this.paperSettingsModal=undefined;this.spaceHub?.close();this.spaceHub=undefined;this.nativeBridge?.close();this.nativeBridge=undefined;this.nativeFilePopup?.hide();});
    this.propertyStore = new PropertyStore(this.app, this.manifest.id);
    this.settings = cleanPluginSettings(await this.loadData());
    this.setupBoardSearch();this.register(()=>this.pdfDocuments.clear());
    this.noteToolbar=new NoteMarkdownToolbars(this.app,()=>this.settings.noteMarkdownToolbar!==false,(name,source)=>this.createConceptLinkNote(name,source));this.addChild(this.noteToolbar);this.registerEditorExtension(this.noteToolbar.extension());
    this.addSettingTab(new ThoughtSpaceSettings(this.app, this));
    this.registerView(WRITING,leaf=>new WritingView(leaf,this));this.addCommand({id:'board-writing',name:'白板写作模式',callback:()=>act(()=>this.openWriting())});
    this.registerView(MATERIALS,leaf=>new MaterialsView(leaf,this));this.register(()=>{this.materialDrag=undefined;});
    this.addRibbonIcon('clapperboard','ThoughtSpace 影笺视频笔记',()=>act(()=>this.openYingjian()));this.addCommand({id:'yingjian-video-notes',name:'打开影笺视频笔记联动',callback:()=>act(()=>this.openYingjian())});this.register(()=>{this.videoBridgeDisposed=true;this.videoBridge?.close();this.videoBridge=undefined;});
    this.addRibbonIcon('notebook-pen','ThoughtSpace 打开笔记摘录',()=>act(()=>this.openExcerptNote()));this.addCommand({id:'open-materials',name:'打开材料工作台',callback:()=>act(()=>this.openMaterialPanel())});
    this.installNativeSelectionDrag(document);
    this.app.workspace.onLayoutReady(()=>this.app.workspace.iterateAllLeaves(l=>this.installNativeSelectionDrag(l.view.containerEl.ownerDocument)));
    this.registerEvent(this.app.workspace.on('window-open',(_win,win)=>this.installNativeSelectionDrag(win.document)));
    this.addCommand({id:'open-excerpt-note',name:'在右侧打开笔记，选字拖入白板',callback:()=>act(()=>this.openExcerptNote())});
    this.addCommand({id:'open-pdf-reader',name:'在右侧阅读 PDF 并摘录',callback:()=>new ReadingSourcePicker(this.app,file=>this.openExcerptNote(file),true).open()});
    this.registerView(DOCK, leaf => new NavigatorView(leaf, this));
    this.addCommand({id:'show-calendar',name:'打开日历',callback:()=>act(()=>this.ensureCalendar(true))});
    this.addCommand({id:'show-journal-sidebar',name:'打开日历与日记',callback:()=>act(()=>this.ensureJournal(true))});
    this.registerView(VIEW, leaf => new BoardView(leaf, this)); this.registerExtensions([EXT], VIEW);
    this.registerObsidianProtocolHandler('thoughtspace-yingjian', params => act(()=>this.openYingjianLink(params)));
    this.registerObsidianProtocolHandler('thoughtspace', params => act(() => this.openDeepLink(params)));
    this.addRibbonIcon('network', 'ThoughtSpace 侧边栏', () => act(() => this.ensureDock(true)));
    this.addCommand({id:'section-catalog',name:'打开分组总览',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard;if(!view?.session||view.closed)return false;if(!checking)act(()=>view.sectionNavigator());return true;}});
    this.addRibbonIcon('layout-dashboard','ThoughtSpace 整理白板',()=>act(()=>this.openBoardOrganizer()));
    this.addRibbonIcon('table-2', 'ThoughtSpace 资料库', () => act(() => this.openDatabase(this.currentBoard)));
    this.registerEvent(this.app.workspace.on('file-menu',(menu,file)=>this.nativeFileMenu(menu,[file])));
    this.registerEvent(this.app.workspace.on('files-menu',(menu,files)=>this.nativeFileMenu(menu,files)));
    this.registerEvent(this.app.workspace.on('editor-menu',(menu,editor,info)=>{
      if(info.file)this.nativeFileMenu(menu,[info.file]);
      const board=this.currentBoard?.file,sourceFile=info.file;
      if(board&&sourceFile)menu.addItem(i=>i.setTitle('ThoughtSpace · 插入当前白板链接').setIcon('link').onClick(()=>act(()=>{
        if(this.app.vault.getAbstractFileByPath(board.path)!==board)throw Error('白板已删除');
        if(info.file!==sourceFile||this.app.vault.getAbstractFileByPath(sourceFile.path)!==sourceFile)throw Error('编辑器已切换，请重新打开菜单');
        editor.replaceSelection(this.app.fileManager.generateMarkdownLink(board,sourceFile.path));
      })));
    }));
    this.addCommand({id:'native-add-note',name:'将当前笔记加入白板…',checkCallback:checking=>{const file=this.app.workspace.getActiveFile();if(file?.extension!=='md'||!isWorkspaceFile(file))return false;if(!checking)this.pickNativeDestination([file]);return true;}});
    this.addCommand({id:'native-note-relations',name:'查看当前笔记的 Obsidian 关联',checkCallback:checking=>{const file=this.app.workspace.getActiveFile();if(file?.extension!=='md'||!isWorkspaceFile(file))return false;if(!checking)this.openNativeRelations(file);return true;}});
    this.addCommand({id:'native-board-index',name:'导出当前白板的原生链接索引',checkCallback:checking=>{const file=this.currentBoard?.file;if(!file)return false;if(!checking)act(()=>this.exportNativeIndex(file));return true;}});
    this.addCommand({id:'space-hub',name:'打开空间总览',callback:()=>this.openSpaceHub()});
    this.addCommand({id:'open-navigator',name:'打开 ThoughtSpace 侧边栏',callback:()=>act(()=>this.ensureDock(true))});
    this.addCommand({id:'board-templates',name:'从模板创建白板',callback:()=>new TemplatePicker(this.app,this).open()});
    this.addCommand({id:'quick-capture',name:'快速收集一条笔记',callback:()=>this.quickCapture()});
    this.registerEvent(this.app.workspace.on('active-leaf-change',leaf=>{if(leaf?.view instanceof BoardView&&leaf.view.session){this.currentBoard=leaf.view;this.refreshDock();for(const l of this.app.workspace.getLeavesOfType(MATERIALS))if(l.view instanceof MaterialsView)l.view.workbench?.refreshTarget();const file=leaf.view.file;if(file)act(()=>this.recordBoardVisit(file));}}));
    this.app.workspace.onLayoutReady(()=>act(()=>this.ensureDock(false)));
    this.app.workspace.onLayoutReady(()=>act(()=>this.setupBookmarks()));
    this.registerEvent(this.app.workspace.on('layout-change',()=>act(()=>this.setupBookmarks())));
    this.addCommand({ id: 'open-workspace', name: '打开研究工作台', callback: () => act(() => this.openHome()) });
    this.addCommand({id:'new-mindmap',name:'新建思维导图',callback:()=>this.promptMindmap()});
    this.addCommand({id:'mindmap-studio',name:'思维导图工作台（布局、配色与层级）',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard;if(!view?.session||view.closed)return false;if(!checking)act(()=>view.openMindmapStudio());return true;}});
    this.addCommand({ id: 'new-board', name: '新建白板', callback: () => this.promptBoard() });
    this.addCommand({ id: 'open-journal', name: '打开今日日记', callback: () => act(() => this.journal()) });
    this.addCommand({ id: 'file-cards-by-tags', name: '按标签整理卡片文件夹', callback: () => act(() => this.fileAllCards()) });
    this.addCommand({ id: 'file-current-card', name: '将当前笔记按标签归档', callback: () => { const f = this.app.workspace.getActiveFile(); if (f?.extension === 'md') this.pickFilingTag(f); else new Notice('请先打开 Markdown 笔记，或在白板卡片上点击右键'); } });
    this.addCommand({ id: 'file-journals-by-month', name: '将旧日记整理到年月文件夹', callback: () => act(() => this.fileOldJournals()) });
    this.addCommand({ id: 'create-database-demo', name: '创建资料表与看板示例', callback: () => act(() => this.databaseDemo()) });
    this.addCommand({ id: 'create-demo', name: '创建入门示例白板', callback: () => act(() => this.demo()) });
    this.addCommand({ id: 'create-nested-demo', name: '创建嵌套研究工作台示例', callback: () => act(() => this.nestedDemo()) });
    this.addCommand({ id: 'new-child-board', name: '在当前白板中新建子白板', callback: () => this.app.workspace.getActiveViewOfType(BoardView)?.newChildBoard() });
    this.addCommand({id:'insert-pdf-card',name:'在当前白板插入 PDF 卡片',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard;if(!view?.session||view.closed||view.session.blocked)return false;if(!checking)act(()=>view.insertPdfCard());return true;}});
    this.addCommand({id:'insert-existing-note',name:'在当前白板插入已有笔记',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard;if(!view?.session||view.closed||view.session.blocked)return false;if(!checking)act(()=>view.insertExistingNote());return true;}});
    this.addCommand({ id: 'tidy-board', name: '整理白板（预览后应用）', checkCallback: checking => { const view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard; if(!view?.session||view.closed)return false;if(!checking)act(()=>view.openLayoutPlanner());return true; } });
    this.addCommand({id:'reuse-selection',name:'将所选内容复用到其他白板',checkCallback:checking=>{const v=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard;if(!v?.session||v.closed||!v.canReuseSelection())return false;if(!checking)act(()=>v.openReuse());return true;}});
    this.addCommand({ id: 'find-on-board', name: '搜索当前白板中的内容', callback: () => this.app.workspace.getActiveViewOfType(BoardView)?.findOnBoard() });
    this.addCommand({ id: 'open-database', name: '打开卡片资料库与看板', callback: () => this.openDatabase(this.app.workspace.getActiveViewOfType(BoardView) || undefined) });
    this.addCommand({ id: 'toggle-focus', name: '切换白板专注模式', callback: () => this.app.workspace.getActiveViewOfType(BoardView)?.toggleFocus() });
    for(const command of boardInputCommands(()=>this.app.workspace.getActiveViewOfType(BoardView)?.inputCommandTarget()))this.addCommand(command);
    this.registerEvent(this.app.vault.on('modify', f => { if (f instanceof TFile) { const s = this.sessions.get(f); if (s) act(async () => (await s).externalUpdate()); } }));
    this.app.workspace.onLayoutReady(() => { for (const f of this.app.vault.getMarkdownFiles().filter(isWorkspaceFile)) { const cache = this.app.metadataCache.getFileCache(f); if (cache) this.knownTags.set(f, JSON.stringify(getAllTags(cache) || [])); } });
    this.registerEvent(this.app.metadataCache.on('changed', (file, _data, cache) => {
      const tags = getAllTags(cache) || [], signature = JSON.stringify(tags), previous = this.knownTags.get(file);
      this.knownTags.set(file, signature);
      if (previous === undefined || previous === signature || !this.settings.autoFileCards || !file.path.startsWith(this.settings.cardFolder + '/')) return;
      act(() => this.serializeFiling(async () => {
        if (this.knownTags.get(file) !== signature || !this.settings.autoFileCards || !file.path.startsWith(this.settings.cardFolder + '/')) return;
        await this.moveFiled(file, tags.length ? tagFolder(tags[0], this.settings.cardFolder) : this.settings.cardFolder + '/未分类');
      }));
    }));
    this.registerEvent(this.app.vault.on('delete', file => { this.settings.hub=remapHubPaths(this.settings.hub,file.path);act(()=>this.saveData(this.settings)); if (file instanceof TFile) this.knownTags.delete(file);const next=remapFavorites(this.settings.favoriteBoards,file.path);if(next.length!==this.settings.favoriteBoards.length){this.settings.favoriteBoards=next;act(()=>this.savePreferences());} }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      this.settings.hub=remapHubPaths(this.settings.hub,oldPath,file.path);act(()=>this.saveData(this.settings));
      this.referenceQueue = this.referenceQueue.catch(() => {}).then(async () => { const next=remapFavorites(this.settings.favoriteBoards,oldPath,file.path);if(JSON.stringify(next)!==JSON.stringify(this.settings.favoriteBoards)){this.settings.favoriteBoards=next;await this.savePreferences();} await this.renameReferences(file, oldPath); });
      act(() => this.referenceQueue);
    }));
  }
  showNativeFileMenu(file:TFile){
    if(this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('文件已删除，请刷新白板');
    this.nativeFilePopup?.hide();const menu=this.nativeFilePopup=new Menu().setUseNativeMenu(false);
    this.app.workspace.trigger('file-menu',menu,file,'thoughtspace');
    menu.showAtPosition({x:Math.max(16,Math.min(window.innerWidth-280,window.innerWidth/2)),y:120});return menu;
  }
  private nativeFileMenu(menu:Menu,files:TAbstractFile[]){
    if(files.length===1&&files[0] instanceof TFile&&['md','pdf'].includes(files[0].extension)){const file=files[0];menu.addItem(i=>i.setTitle('ThoughtSpace · 右侧阅读与拖放摘录').setIcon('book-open').onClick(()=>act(()=>this.openExcerptNote(file))));}
    if(files.length===1&&files[0] instanceof TFile&&isPdfFile(files[0].path)){const file=files[0],view=this.currentBoard;if(view?.session&&!view.closed)menu.addItem(i=>i.setTitle('ThoughtSpace · 插入 PDF 卡片到当前白板').setIcon('file-plus').setDisabled(view.session!.blocked).onClick(()=>act(()=>view.insertPdfCard(undefined,file))));}
    const notes=files.filter((f):f is TFile=>f instanceof TFile&&f.extension==='md'&&isWorkspaceFile(f));
    if(notes.length){
      menu.addSeparator();menu.addItem(i=>i.setTitle(`ThoughtSpace · 加入白板${notes.length>1?'（'+notes.length+' 篇）':''}…`).setIcon('panels-top-left').setDisabled(notes.length>100).onClick(()=>this.pickNativeDestination(notes)));
      if(notes.length===1)menu.addItem(i=>i.setTitle('ThoughtSpace · Obsidian 关联').setIcon('network').onClick(()=>this.openNativeRelations(notes[0])));
    }
    if(files.length===1&&files[0] instanceof TFile&&files[0].extension===EXT&&isWorkspaceFile(files[0])){
      const file=files[0];menu.addItem(i=>i.setTitle('ThoughtSpace · 导出原生链接索引').setIcon('file-output').onClick(()=>act(()=>this.exportNativeIndex(file))));
    }
  }
  pickNativeDestination(files:TFile[]){
    if(!files.length||files.length>100){new Notice('每次请选择 1–100 篇笔记');return;}
    const picker=new BoardPicker(this.app,null,async file=>{
      const count=await this.addNativeNotes(file,files);new Notice(count?`已加入 ${count} 篇笔记；原文件保留`:'这些笔记已在白板中');
    });picker.setPlaceholder(`选择接收 ${files.length} 篇笔记的白板…`);picker.open();
  }
  async addNativeNotes(board:TFile,files:TFile[]){
    if(!files.length||files.length>100)throw Error('每次最多加入 100 篇笔记');
    for(const file of [board,...files])if(this.app.vault.getAbstractFileByPath(file.path)!==file||!isWorkspaceFile(file))throw Error('文件已移动或删除，请重新选择');
    if(board.extension!==EXT||files.some(f=>f.extension!=='md'))throw Error('请选择白板和 Markdown 笔记');
    await this.openBoard(board);
    const view=this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).find(v=>v instanceof BoardView&&v.file===board) as BoardView|undefined;
    if(!view?.session)throw Error('白板尚未就绪，请稍后重试');
    return view.addNotesFromHub(files.map(f=>f.path),view.session);
  }
  openNativeRelations(file:TFile){
    this.nativeBridge?.close();this.nativeBridge=new NativeBridgeModal(this.app,file,{
      open:f=>{this.nativeBridge?.close();return this.openNoteInSidebar(f);},add:files=>this.pickNativeDestination(files),openBoard:f=>{this.nativeBridge?.close();return this.openBoard(f);},
      usages:async (note,active)=>{const files:TFile[]=[];let errors=0;for(const f of this.app.vault.getFiles().filter(isWorkspaceFile).filter(f=>f.extension===EXT)){
        if(!active())break;
        if(f.stat.size>8*1024*1024){errors++;continue;}try{const b=await this.readBoard(f);if(b.nodes.some(n=>n.kind==='card'&&n.file===note.path))files.push(f);}catch{errors++;}
      }return {files,errors};}
    });this.nativeBridge.open();return this.nativeBridge;
  }
  async exportNativeIndex(file:TFile){
    if(this.app.vault.getAbstractFileByPath(file.path)!==file||file.extension!==EXT||!isWorkspaceFile(file))throw Error('白板已变化，请重新打开');
    const board=await this.readBoard(file),source=`${ROOT}/导出/白板索引.md`,links:string[]=[],missing:string[]=[];
    for(const path of boardNotePaths(board)){const note=this.app.vault.getAbstractFileByPath(path);if(note instanceof TFile&&note.extension==='md'&&isWorkspaceFile(note))links.push(this.app.fileManager.generateMarkdownLink(note,source));else missing.push(path);}
    const content=nativeIndex(file.basename,this.app.fileManager.generateMarkdownLink(file,source),links,missing);
    const out=await this.createUnique(`${ROOT}/导出`,`${file.basename}-链接索引`,'md',content);await this.openNoteInSidebar(out);new Notice('已创建 Markdown 索引，可在原生反向链接和关系图中查看');return out;
  }
  private setupBoardSearch(){
    const vault=this.app.vault,errors=new Set<string>();
    this.searchSync=new BoardSearchSync({
      board:async path=>{const file=vault.getAbstractFileByPath(path);return file instanceof TFile&&file.extension===EXT&&isWorkspaceFile(file)?parseBoard(await vault.cachedRead(file)):undefined;},
      read:async path=>{const file=vault.getAbstractFileByPath(path);if(file&&! (file instanceof TFile))throw Error('搜索索引路径被文件夹占用');return file instanceof TFile?vault.read(file):undefined;},
      write:async(path,content,expected)=>{if(this.settings.boardSearchEnabled===false)return;await this.folder(path.slice(0,path.lastIndexOf('/')));const file=vault.getAbstractFileByPath(path);
        if(file instanceof TFile)await vault.process(file,disk=>{if(disk!==expected)throw Error('索引文件同时发生修改，已保留原内容');return content;});
        else if(!file&&expected===undefined)await vault.create(path,content);else throw Error('索引路径已变化');},
      remove:async(path,expected)=>{const file=vault.getAbstractFileByPath(path);if(file instanceof TFile&&await vault.read(file)===expected&&this.settings.boardSearchEnabled!==false)await this.app.fileManager.trashFile(file);}
    },vault.getName(),(path,error)=>{if(!errors.has(path)){errors.add(path);console.warn('ThoughtSpace search index:',path,error);new Notice(`白板搜索索引暂未更新：${path}。原白板未修改。`);}});
    const enqueue=(path:string)=>{if(this.settings.boardSearchEnabled===false||!path.endsWith('.'+EXT)||!isWorkspaceFile({path}))return;this.searchSync?.enqueue(path);if(this.searchTimer!==undefined)window.clearTimeout(this.searchTimer);this.searchTimer=window.setTimeout(()=>{this.searchTimer=undefined;void this.searchSync?.flush();},1200);};
    this.registerEvent(vault.on('create',file=>{if(file instanceof TFile)enqueue(file.path);}));
    this.registerEvent(vault.on('modify',file=>{if(file instanceof TFile)enqueue(file.path);}));
    this.registerEvent(vault.on('delete',file=>{if(file instanceof TFile)enqueue(file.path);else this.rebuildBoardSearch();}));
    this.registerEvent(vault.on('rename',(file,old)=>{if(file instanceof TFile){enqueue(old);enqueue(file.path);}else this.rebuildBoardSearch();}));
    this.app.workspace.onLayoutReady(()=>this.rebuildBoardSearch());
    this.registerEvent(this.app.workspace.on('file-open',file=>act(()=>this.openSearchResult(file))));
    this.app.workspace.onLayoutReady(()=>act(()=>this.openSearchResult(this.app.workspace.getActiveFile())));
    this.addCommand({id:'rebuild-native-search',name:'重建白板原生搜索索引',callback:()=>{errors.clear();this.rebuildBoardSearch();}});
    this.register(()=>{this.searchNavigationStopped=true;this.searchNavigationSequence++;if(this.searchTimer!==undefined)window.clearTimeout(this.searchTimer);this.searchSync?.stop();});
  }
  private async openSearchResult(file:TFile|null){
    const sequence=++this.searchNavigationSequence,workspace=this.app.workspace;
    if(this.searchNavigationStopped||this.settings.boardSearchEnabled===false||!file||!searchBoardPath(file.path))return;
    const path=file.path;
    // file-open can fire while the previous BoardView is still attached to the result leaf.
    await new Promise<void>(resolve=>(workspace.containerEl?.ownerDocument?.defaultView||window).requestAnimationFrame(()=>resolve()));
    if(this.searchNavigationStopped||sequence!==this.searchNavigationSequence||file.path!==path)return;
    const view=workspace.getActiveViewOfType(MarkdownView);
    if(!view||view.file!==file)return;
    const alive=()=>!this.searchNavigationStopped&&sequence===this.searchNavigationSequence&&workspace.getActiveViewOfType(MarkdownView)===view&&view.file===file&&file.path===path;
    const content=await this.app.vault.cachedRead(file);if(!alive())return;
    // Native search applies the match location after opening the Markdown view.
    await new Promise<void>(resolve=>(view.containerEl?.ownerDocument?.defaultView||window).requestAnimationFrame(()=>resolve()));
    if(!alive()||view.editor.getValue()!==content)return;
    const state=view.getEphemeralState(),line=typeof state.line==='number'?state.line:view.editor.getCursor().line;
    const target=searchIndexTarget(path,content,this.app.vault.getName(),line);if(!target)return;
    const board=this.app.vault.getAbstractFileByPath(target.file);
    if(!(board instanceof TFile)||!isWorkspaceFile(board)){new Notice('搜索结果对应的白板已移动或删除，请重建白板搜索索引');return;}
    // Reuse the result tab, including Cmd/Ctrl-click tabs, instead of leaving an index tab behind.
    const leaf=view.leaf;await leaf.openFile(board,{state:{tsSearchRedirect:true}});
    await new Promise<void>(resolve=>(view.containerEl?.ownerDocument?.defaultView||window).requestAnimationFrame(()=>resolve()));
    const opened=workspace.getActiveViewOfType(BoardView);
    if(!this.searchNavigationStopped&&opened&&leaf.view===opened&&opened.file===board&&!opened.closed&&target.node&&opened.session?.board.nodes.some(n=>n.id===target.node))opened.revealNode(target.node);
  }
  rebuildBoardSearch(){if(this.settings.boardSearchEnabled===false)return;for(const file of this.app.vault.getFiles()){
    if(file.extension===EXT&&isWorkspaceFile(file))this.searchSync?.enqueue(file.path);
    else if(file.path.startsWith(SEARCH_FOLDER+'/')&&file.path.endsWith('.thoughtspace.md'))this.searchSync?.enqueue(file.path.slice(SEARCH_FOLDER.length+1,-3));
  }void this.searchSync?.flush();}
  async ensureDock(show=false):Promise<WorkspaceLeaf> {
    let leaf=this.app.workspace.getLeavesOfType(DOCK)[0];
    if(!leaf){
      if(!this.dockOpening)this.dockOpening=(async()=>{const created=this.app.workspace.getLeftLeaf(false);if(!created)throw new Error('无法创建左侧面板');await created.setViewState({type:DOCK,active:false});return created;})();
      try{leaf=await this.dockOpening;}finally{this.dockOpening=undefined;}
    }
    this.refreshDock();leaf=this.app.workspace.getLeavesOfType(DOCK)[0]||leaf;if(show)await this.app.workspace.revealLeaf(leaf);return leaf;
  }
  refreshDock(){
    const views=this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).filter((v):v is BoardView=>v instanceof BoardView&&!!v.session&&!v.closed);
    if(!this.currentBoard||!views.includes(this.currentBoard))this.currentBoard=views[0];
    const docks=this.app.workspace.getLeavesOfType(DOCK);
    // 插件重载与工作区恢复可能交错创建面板；只合并本插件的重复面板。
    for(const extra of docks.slice(1))extra.detach();
    const leaf=docks[0];if(leaf?.view instanceof NavigatorView)leaf.view.bind(this.currentBoard);
  }
  private bookmarks?:NativeBookmarks;private bookmarkSetup?:Promise<void>;
  async setupBookmarks(){
    if(this.bookmarkSetup)return this.bookmarkSetup;
    const native=nativeBookmarks(this.app);if(!native||(native===this.bookmarks&&!Object.keys(this.settings.pendingBookmarkChanges||{}).length))return;
    this.bookmarkSetup=(async()=>{
      if(!this.settings.nativeBookmarksMigrated){
        const existing=new Set(bookmarkedBoards(native.getBookmarks()));
        for(const path of this.settings.favoriteBoards)if(!existing.has(path)&&this.app.vault.getAbstractFileByPath(path) instanceof TFile)native.addItem({type:'file',path,ctime:Date.now()});
        await native.saveData();this.settings.nativeBookmarksMigrated=true;
      }
      for(const [path,add] of Object.entries(this.settings.pendingBookmarkChanges||{})){const matches=native.getBookmarks().filter(i=>i.type==='file'&&i.path===path&&!i.subpath);if(add&&!matches.length&&this.app.vault.getAbstractFileByPath(path) instanceof TFile)native.addItem({type:'file',path,ctime:Date.now()});else if(!add)for(const entry of matches)native.removeItem(entry);}
      await native.saveData();delete this.settings.pendingBookmarkChanges;
      if(this.bookmarks!==native)this.registerEvent(native.on('changed',()=>{if(nativeBookmarks(this.app)===native)act(()=>this.syncBookmarks(native));}));
      this.bookmarks=native;
      await this.syncBookmarks(native);
    })();try{await this.bookmarkSetup;}finally{this.bookmarkSetup=undefined;}
  }
  private async syncBookmarks(native:NativeBookmarks){
    const next=cleanFavorites(bookmarkedBoards(native.getBookmarks())).filter(path=>this.app.vault.getAbstractFileByPath(path) instanceof TFile);
    const changed=JSON.stringify(next)!==JSON.stringify(this.settings.favoriteBoards);this.settings.favoriteBoards=next;
    if(changed)await this.savePreferences();else await this.saveData(this.settings);
    for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof BoardView)leaf.view.refreshNavigation();
  }
  async toggleFavorite(file:TFile){
    await this.setupBookmarks();const native=nativeBookmarks(this.app);
    if(native){const entries=native.getBookmarks().filter(i=>i.type==='file'&&i.path===file.path&&!i.subpath);if(entries.length)for(const entry of entries)native.removeItem(entry);else native.addItem({type:'file',path:file.path,ctime:Date.now()});await native.saveData();await this.syncBookmarks(native);}
    else{const paths=this.settings.favoriteBoards;this.settings.favoriteBoards=paths.includes(file.path)?paths.filter(p=>p!==file.path):cleanFavorites([...paths,file.path]);this.settings.pendingBookmarkChanges={...this.settings.pendingBookmarkChanges,[file.path]:!paths.includes(file.path)};await this.savePreferences();new Notice('已更新白板收藏；启用 Obsidian 核心插件“书签”后可同步原生面板');}
    for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof BoardView)leaf.view.refreshNavigation();
  }
  quickCapture(){new Prompt(this.app,'快速收集笔记','',async title=>{const file=await this.createUnique(this.settings.cardFolder,title,'md',`# ${title}\n\n`);await this.editNote(file);}).open();}
  async createFromTemplate(id:string,name:string){
    const template=boardTemplates.find(t=>t.id===id);if(!template)throw new Error('未知白板模板');
    const board=emptyBoard();
    for(let i=0;i<template.titles.length;i++){
      const title=template.titles[i], file=await this.createUnique(`${this.settings.cardFolder}/${safeName(name)}`,title,'md',`---\nthoughtspace_status: inbox\n---\n# ${title}\n\n${template.bodies[i]}\n`);
      board.nodes.push({id:uid(),kind:'card',transparent:true,file:file.path,x:80+(i%2)*440,y:80+Math.floor(i/2)*370,width:360,height:290,color:colors[i]});
    }
    board.edges=[{id:uid(),from:board.nodes[0].id,to:board.nodes[1].id,label:'展开'},{id:uid(),from:board.nodes[1].id,to:board.nodes[3].id,label:'形成判断'}];
    const file=await this.createUnique(`${ROOT}/白板`,name,EXT,JSON.stringify(board,null,2));await this.openBoard(file,true);return file;
  }
  async duplicateBoard(file:TFile){const board=clone(await this.readBoard(file));board.spaceId=uid();return this.createUnique(file.parent?.path||ROOT,`${file.basename} 副本`,EXT,JSON.stringify(board,null,2));}
  async saveLayoutSnapshot(file:TFile,label='手动快照'){
    const session=await this.session(file);try{
      if(session.blocked)throw Error('白板暂停写入，不能创建快照');
      if(!session.board.spaceId)session.change(b=>{b.version=3;b.spaceId=uid();});await session.flush();
      const folder=`${this.app.vault.configDir}/plugins/${this.manifest.id}/layout-snapshots/${session.board.spaceId}`;await this.app.vault.adapter.mkdir(folder);
      const path=`${folder}/${Date.now()}-${uid()}.json`;await this.app.vault.adapter.write(path,JSON.stringify({label,createdAt:new Date().toISOString(),board:clone(session.board)},null,2));return path;
    }finally{if(!session.listeners.size)await this.release(session);}
  }
  async layoutSnapshots(file:TFile){const board=await this.readBoard(file);if(!board.spaceId)return [];const folder=`${this.app.vault.configDir}/plugins/${this.manifest.id}/layout-snapshots/${board.spaceId}`;
    if(!await this.app.vault.adapter.exists(folder))return [];const list=await this.app.vault.adapter.list(folder);const items=[];
    for(const path of list.files.filter(f=>f.endsWith('.json')).sort().reverse()){try{const value=parseLayoutSnapshot(await this.app.vault.adapter.read(path));items.push({path,label:value.label,createdAt:value.createdAt,nodes:value.board.nodes.length});}catch{/* Corrupt snapshots do not block valid ones. */}}
    return items;
  }
  async restoreLayoutSnapshot(file:TFile,path:string){const session=await this.session(file);try{
    const allowed=(await this.layoutSnapshots(file)).some(item=>item.path===path);if(!allowed||session.blocked)throw Error('快照不属于当前白板或白板暂停写入');
    const restored=parseLayoutSnapshot(await this.app.vault.adapter.read(path)).board,before=JSON.stringify(session.board);
    await this.saveLayoutSnapshot(file,'恢复前自动备份');if(session.blocked||JSON.stringify(session.board)!==before)throw Error('白板已变化，请重新选择快照');
    const currentFiles=new Map(session.board.nodes.map(n=>[n.id,n.file]));for(const n of restored.nodes){const current=currentFiles.get(n.id);if(n.file&&!this.app.vault.getAbstractFileByPath(n.file)&&current&&this.app.vault.getAbstractFileByPath(current))n.file=current;}
    restored.spaceId=session.board.spaceId;session.change(()=>{session.board=restored;},clone(session.board),true);await session.flush();new Notice('已恢复布局；原始笔记内容保持不变');
    }finally{if(!session.listeners.size)await this.release(session);}
  }
  async showSnapshots(file:TFile){const items=await this.layoutSnapshots(file);if(!items.length){new Notice('还没有布局快照，请先保存一个');return;}
    new ActionPicker(this.app,'恢复布局（自动备份当前布局；不回滚笔记正文）',items.map(item=>({title:`${new Date(item.createdAt).toLocaleString()} · ${item.label} · ${item.nodes} 个对象`,run:()=>this.restoreLayoutSnapshot(file,item.path)}))).open();
  }
  async exportOutline(file:TFile){const board=await this.readBoard(file),out=await this.createUnique(`${ROOT}/导出`,`${file.basename}-大纲`,'md',boardOutline(board,file.basename));new Notice(`已导出 ${out.path}`);return out;}
  openDatabase(view?: BoardView) {
    const modal=new DatabaseModal(this.app, { preferences:this.settings.database,savePreferences:()=>this.saveData(this.settings),boardPath:view?.file?.path,cardFolder: this.settings.cardFolder, boardPaths: view?.session ? new Set(view.session.board.nodes.filter(n => n.kind === 'card' && n.file).map(n => n.file!)) : undefined, boardTitle: view?.file?.basename, preview: file => new NotePreview(this.app, file, this).open() }, this.propertyStore);modal.open();return modal;
  }
  private writingOpening=new SharedOpen<TFile,WorkspaceLeaf>();
  private writingPreparation=new SharedOpen<BoardView,void>();
  private boardOpening=new SharedOpen<TFile,WorkspaceLeaf>();
  async openWriting(view=this.currentBoard){
    if(!view?.file||!view.session)throw Error('请先打开白板');const file=view.file,owner=view.session;
    const validate=()=>{if(owner.blocked)throw Error('白板写入已暂停，请先处理保存冲突');if(view.closed||view.file!==file||view.session!==owner)throw Error('白板已切换，请从当前白板重新打开写作');};
    await this.writingPreparation.run(view,async()=>{await view.prepareWriting();await owner.flush();validate();});
    const leaf=await this.writingOpening.run(file,async()=>{
      validate();
      const existing=this.app.workspace.getLeavesOfType(WRITING).find(l=>l.getViewState().state?.board===file.path);
      if(existing){await existing.loadIfDeferred();return existing;}
      const created=this.app.workspace.getLeaf('tab');await created.setViewState({type:WRITING,state:{board:file.path},active:true});return created;
    });
    await this.app.workspace.revealLeaf(leaf);this.app.workspace.setActiveLeaf(leaf,{focus:true});return leaf;
  }

  async recordBoardVisit(file:TFile){
    const first=this.settings.hub.recent[0];if(first?.path===file.path&&Date.now()-first.at<30000)return;
    this.settings.hub=rememberBoard(this.settings.hub,file.path);await this.saveData(this.settings);
  }
  openSpaceHub(){
    if(this.spaceHub?.modalEl.isConnected){this.spaceHub.modalEl.querySelector<HTMLInputElement>('input[type=search]')?.focus();return this.spaceHub;}
    const view=this.currentBoard,owner=view?.session;
    const modal=new SpaceHubModal(this.app,{
      preferences:()=>this.settings.hub,save:async prefs=>{this.settings.hub=prefs;await this.saveData(this.settings);},favorites:()=>this.settings.favoriteBoards,
      journalFolder:this.journalRoot,readBoard:file=>this.readBoard(file),
      openBoard:async file=>{await this.openBoard(file);await this.recordBoardVisit(file);},openNote:file=>this.openNoteInSidebar(file),favorite:file=>this.toggleFavorite(file),
      capture:()=>this.quickCapture(),createBoard:()=>this.promptBoard(),calendar:()=>this.ensureCalendar(true),
      target:view&&owner?{title:owner.file.basename,add:paths=>view.addNotesFromHub(paths,owner)}:undefined
    });this.spaceHub=modal;modal.open();return modal;
  }
  refreshStyleClipboard(){
    for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof BoardView)leaf.view.refreshStyleControls();
  }
  backgroundImageResource(path:string){const clean=cleanBackgroundImagePreferences({backgroundImagePath:path}).backgroundImagePath;return clean?this.app.vault.adapter.getResourcePath(clean):'';}
  openBackgroundImageSettings(){
    if(this.backgroundImageModal?.modalEl.isConnected){this.backgroundImageModal.modalEl.querySelector<HTMLButtonElement>('button')?.focus();return this.backgroundImageModal;}
    const modal=new BackgroundImageModal(this.app,{preferences:()=>cleanBackgroundImagePreferences(this.settings),resource:path=>this.backgroundImageResource(path),save:async(preferences,file)=>{
      if(this.backgroundImagesClosed)throw Error('插件已关闭，请重新打开设置。');
      const previous={...cleanBackgroundImagePreferences(this.settings),canvasBackground:this.settings.canvasBackground},baseline=backgroundImageStamp(previous),next=cleanBackgroundImagePreferences(preferences);
      if(file){
        if(file.size>MAX_BACKGROUND_IMAGE_BYTES)throw Error('请选择不超过 20 MB 的图片。');
        const bytes=await file.arrayBuffer(),extension=validateBackgroundImageBytes(new Uint8Array(bytes));
        const folder=normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}/backgrounds`),digest=createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
        next.backgroundImagePath=`${folder}/${digest}.${extension}`;
        if(!await this.app.vault.adapter.exists(folder))await this.app.vault.adapter.mkdir(folder);
        if(await this.app.vault.adapter.exists(next.backgroundImagePath)){
          const cached=await this.app.vault.adapter.readBinary(next.backgroundImagePath);
          if(createHash('sha256').update(new Uint8Array(cached)).digest('hex')!==digest)throw Error('已保存的背景图片内容发生变化，请先检查插件 backgrounds 文件夹。为保护原文件，本次未覆盖。');
        }else await this.app.vault.adapter.writeBinary(next.backgroundImagePath,bytes);
      }
      if(this.backgroundImagesClosed)throw Error('插件已关闭，请重新打开设置。');
      if(backgroundImageStamp(this.settings)!==baseline||this.settings.canvasBackground!==previous.canvasBackground)throw Error('背景已在其他窗口改变，请重新打开设置后应用。');
      if(next.backgroundImagePath&&!await this.app.vault.adapter.exists(next.backgroundImagePath))throw Error('背景图片已不存在，请重新选择图片。');
      if(this.backgroundImagesClosed||backgroundImageStamp(this.settings)!==baseline||this.settings.canvasBackground!==previous.canvasBackground)throw Error('背景已改变，请重新打开设置后应用。');
      const mode=next.backgroundImagePath?'image':'plain';Object.assign(this.settings,next,{canvasBackground:mode});
      try{await this.savePreferences();}catch(error){if(backgroundImageStamp(this.settings)===backgroundImageStamp(next)&&this.settings.canvasBackground===mode){Object.assign(this.settings,previous);for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof BoardView)leaf.view.applyPreferences();}throw error;}
    }});this.backgroundImageModal=modal;modal.open();return modal;
  }
  openPaperSettings(){
    if(this.paperSettingsModal?.modalEl.isConnected){this.paperSettingsModal.modalEl.querySelector<HTMLButtonElement>('button[aria-pressed=true]')?.focus();return this.paperSettingsModal;}
    const modal=new PaperSettingsModal(this.app,{preferences:()=>cleanPaperPreferences(this.settings),save:async preferences=>{
      const previous={...cleanPaperPreferences(this.settings),canvasBackground:this.settings.canvasBackground},next=cleanPaperPreferences(preferences);
      Object.assign(this.settings,next,{canvasBackground:'paper'});
      try{await this.savePreferences();}catch(error){if(paperAppearanceStamp(this.settings)===paperAppearanceStamp(next)&&this.settings.canvasBackground==='paper'){Object.assign(this.settings,previous);for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof BoardView)leaf.view.applyPreferences();}throw error;}
    }});this.paperSettingsModal=modal;modal.open();return modal;
  }
  async savePreferences() {
    await this.saveData(this.settings);
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) if (leaf.view instanceof BoardView) leaf.view.applyPreferences();
    this.refreshDock();
  }
  async session(file: TFile) {
    let result = this.sessions.get(file);
    if (!result) { result = this.app.vault.read(file).then(raw => new Session(this, file, raw)); this.sessions.set(file, result); }
    try { return await result; } catch (e) { if(this.sessions.get(file)===result)this.sessions.delete(file); throw e; }
  }
  async release(s: Session) {
    const cached=this.sessions.get(s.file);await s.flush();
    if(s.listeners.size||!cached||this.sessions.get(s.file)!==cached)return;
    // A late close belongs to its original session, never a replacement for the same file.
    const current=await cached.catch(()=>undefined);
    if(current===s&&!s.listeners.size&&this.sessions.get(s.file)===cached)this.sessions.delete(s.file);
  }
  async readBoard(file: TFile): Promise<Board> { const loaded = this.sessions.get(file); return loaded ? clone((await loaded).board) : parseBoard(await this.app.vault.cachedRead(file)); }
  async boardGraph():Promise<BoardGraph>;
  async boardGraph(current:()=>boolean):Promise<BoardGraph|undefined>;
  async boardGraph(current?:()=>boolean):Promise<BoardGraph|undefined> {
    if(current&&!current())return;
    const graph = new Map<string, string[]>(), errors = new Set<string>();
    for (const f of this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => f.extension === EXT)) {
      if(current&&!current())return;
      try { const board=await this.readBoard(f);if(current&&!current())return;graph.set(f.path,boardLinks(board)); }
      catch { if(current&&!current())return;errors.add(f.path); }
    }
    return { graph, errors };
  }
  /** 所有由本插件创建的嵌套关系串行校验，避免两个窗口同时加入相反关系。 */
  hierarchy<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.hierarchyQueue.then(operation); this.hierarchyQueue = next.catch(() => {}); return next;
  }
  async assertCanNest(parent: TFile, child: TFile) {
    const { graph, errors } = await this.boardGraph();
    const pending = [child.path], visited = new Set<string>();
    while (pending.length) {
      const path = pending.pop()!; if (visited.has(path)) continue; visited.add(path);
      if (errors.has(path) || !graph.has(path)) throw new Error('目标白板或其子白板无法读取，请先修复引用');
      pending.push(...(graph.get(path) || []));
    }
    if (wouldCycle(graph, parent.path, child.path)) throw new Error('不能把白板放入自身或后代中，这会形成循环嵌套');
  }
  async folder(path: string) {
    let cursor = ''; for (const part of normalizePath(path).split('/')) { if (!part) continue; cursor = cursor ? `${cursor}/${part}` : part; if (!this.app.vault.getAbstractFileByPath(cursor)) { try { await this.app.vault.createFolder(cursor); } catch (e) { if (!this.app.vault.getAbstractFileByPath(cursor)) throw e; } } }
  }
  async createConceptLinkNote(name:string,source:TFile){
    if(this.app.vault.getAbstractFileByPath(source.path)!==source)throw Error('来源笔记已删除');const title=safeName(name);const link=this.app.fileManager.generateMarkdownLink(source,normalizePath(this.settings.cardFolder+'/概念.md'));
    return this.createUnique(this.settings.cardFolder,title,'md',`# ${title}\n\n来源：${link}\n\n`);
  }
  async createUnique(folder: string, title: string, ext: string, body: string): Promise<TFile> {
    await this.folder(folder);
    const name = safeName(title);
    for (let n = 0; n < 10000; n++) {
      const path = normalizePath(`${folder}/${name}${n ? ` ${n + 1}` : ''}.${ext}`);
      if (this.app.vault.getAbstractFileByPath(path)) continue;
      try { return await this.app.vault.create(path, body); } catch (e) { if (!this.app.vault.getAbstractFileByPath(path)) throw e; }
    }
    throw new Error('无法生成唯一文件名');
  }
  async openDeepLink(params: Record<string,string>) {
    const target = parseBoardLink(params,this.app.vault.getName());
    const file = this.app.vault.getAbstractFileByPath(target.file);
    if (!(file instanceof TFile)) throw new Error('白板已移动或不存在，请重新复制链接');
    for(const leaf of this.app.workspace.getLeavesOfType(VIEW)) if(leaf.isDeferred) await leaf.loadIfDeferred();
    await this.openBoard(file);
    const view = this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).find(v=>v instanceof BoardView && v.file===file) as BoardView | undefined;
    if(target.node && view) {
      if(!view.session?.board.nodes.some(n=>n.id===target.node)) {new Notice('已打开白板；链接中的内容已被移除');return;}
      await new Promise<void>(resolve=>(view.containerEl?.ownerDocument?.defaultView||window).requestAnimationFrame(()=>resolve()));view.revealNode(target.node);
    }
  }
  async renameNote(file:TFile,value:string,original=file.path){
    if(file.path!==original||this.app.vault.getAbstractFileByPath(original)!==file)throw Error('笔记已移动或删除，请重新编辑标题');
    const path=noteRenamePath(original,value);if(path===original)return;
    if(this.app.vault.getAbstractFileByPath(path))throw Error('已有同名笔记，请换一个名称');
    await this.app.fileManager.renameFile(file,path);await this.referenceQueue;
  }
  promptRenameNote(file:TFile){const original=file.path;new Prompt(this.app,'重命名笔记',file.basename,value=>this.renameNote(file,value,original)).open();}
  async openBoard(file: TFile, fit = false) {
    const leaf=await this.boardOpening.run(file,async()=>{
      const existing=this.app.workspace.getLeavesOfType(VIEW).find(l=>(l.view as BoardView).file===file||l.getViewState().state?.file===file.path);
      if(existing){await existing.loadIfDeferred();return existing;}
      const created=this.app.workspace.getLeaf('tab');await created.openFile(file);return created;
    });
    await this.app.workspace.revealLeaf(leaf);this.app.workspace.setActiveLeaf(leaf,{focus:true});if(leaf.view instanceof BoardView)this.currentBoard=leaf.view;
    if(fit&&leaf.view instanceof BoardView){await new Promise<void>(resolve=>(leaf.view.containerEl?.ownerDocument?.defaultView||window).requestAnimationFrame(()=>resolve()));leaf.view.fit();}
  }

  openBoardOrganizer(view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard){
    if(view?.session&&!view.closed){act(()=>view.openLayoutPlanner());return;}
    const picker=new BoardPicker(this.app,null,async file=>{
      await this.openBoard(file);const target=this.currentBoard;
      if(!target?.session||target.closed||target.file!==file)throw Error('白板尚未就绪，请重新打开后再整理');
      await target.openLayoutPlanner();
    });
    picker.setPlaceholder('选择要整理的白板…');picker.open();
  }
  openSectionCatalog(view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard){
    if(view?.session&&!view.closed){view.sectionNavigator();return;}
    const picker=new BoardPicker(this.app,null,async file=>{
      await this.openBoard(file);const target=this.currentBoard;
      if(!target?.session||target.closed||target.file!==file)throw Error('白板尚未就绪，请重新打开后再预览');
      target.sectionNavigator();
    });
    picker.setPlaceholder('选择要预览分组的白板…');picker.open();
  }
  async openHome() {
    const files = this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => f.extension === EXT).sort((a, b) => b.stat.mtime - a.stat.mtime);
    if (files[0]) await this.openBoard(files[0]); else await this.demo();
  }
  promptMindmap(){new MindmapPresetsModal(this.app,async b=>{const title=b.nodes[0].text||'我的思维导图',file=await this.createUnique(`${ROOT}/白板`,title,EXT,JSON.stringify(b,null,2));await this.openBoard(file,true);const v=this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).find(v=>v instanceof BoardView&&v.file===file) as BoardView|undefined;v?.fit();}).open();}
  promptBoard() { new Prompt(this.app, '新建白板', '新的研究主题', async name => this.openBoard(await this.createUnique(`${ROOT}/白板`, name, EXT, JSON.stringify(emptyBoard(), null, 2)))).open(); }
  private serializeFiling<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.filingQueue.then(operation); this.filingQueue = next.catch(() => {}); return next;
  }
  pickFilingTag(file: TFile) {
    const tags = [...new Set(getAllTags(this.app.metadataCache.getFileCache(file) || {}) || [])];
    if (!tags.length) { new Notice('这张卡片还没有标签。先在正文或属性 tags 中添加标签。'); return; }
    const modal = new Modal(this.app); modal.titleEl.setText('按标签归档');
    modal.contentEl.createEl('p', { text: '选择一个标签作为实际文件夹。原文和所有其他标签保留。' });
    const select = modal.contentEl.createEl('select', { cls: 'ts-wide', attr: { 'aria-label': '归档标签' } });
    for (const tag of tags) select.createEl('option', { value: tag, text: tag });
    const path = modal.contentEl.createDiv('ts-filing-path');
    const preview = () => { try { path.setText(`${tagFolder(select.value, this.settings.cardFolder)}/${file.name}`); } catch (e) { path.setText(String(e)); } };
    select.onchange = preview; preview();
    button(modal.contentEl, '移动到此文件夹', 'folder-input', async () => { await this.fileCard(file, select.value); modal.close(); new Notice(`已归档：${file.path}`); }, 'mod-cta'); modal.open();
  }
  async fileCard(file: TFile, tag: string) {
    if (file.extension !== 'md') throw new Error('只能归档 Markdown 卡片');
    if (file.path.startsWith(this.journalRoot + '/')) throw new Error('日记使用年月目录，不按卡片标签移动');
    return this.serializeFiling(() => this.moveFiled(file, tagFolder(tag, this.settings.cardFolder)));
  }
  /** 先备份笔记及引用它的白板，再用 Obsidian 文件管理器移动；已有同名文件不覆盖。 */
  private async moveFiled(file: TFile, folder: string, exactName = false): Promise<boolean> {
    if (!isWorkspaceFile(file)) throw new Error('备份文件不参与自动归档，请先将需要恢复的文件复制到工作目录');
    if (file.parent?.path === folder) return false;
    const oldPath = file.path;
    await this.referenceQueue;
    for (const pending of this.sessions.values()) { const s = await pending; await s.flush(); }
    const affected: Array<{file: TFile; raw: string}> = [];
    for (const board of this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => f.extension === EXT)) {
      const raw = await this.app.vault.read(board);
      let data: Board;
      try { data = parseBoard(raw); } catch { if (raw.includes(oldPath)) throw new Error(`引用白板无法读取：${board.path}`); else continue; }
      const loaded = this.sessions.get(board), session = loaded ? await loaded : undefined;
      if (data.nodes.some(n => n.file === oldPath) || session?.board.nodes.some(n => n.file === oldPath)) {
        if (session?.blocked) throw new Error(`引用白板已暂停写入，请先修复：${board.path}`);
        affected.push({ file: board, raw });
      }
    }
    let target = `${folder}/${file.name}`;
    for (let number = 2; this.app.vault.getAbstractFileByPath(target); number++) {
      if (exactName) throw new Error(`目标日记已存在，原文件保留：${target}`);
      target = `${folder}/${file.basename} ${number}.${file.extension}`;
    }
    const backup = `${this.app.vault.configDir}/plugins/${this.manifest.id}/filing-backups/${Date.now()}-${uid()}`;
    await this.app.vault.adapter.mkdir(backup);
    await this.app.vault.adapter.write(`${backup}/note.md`, await this.app.vault.read(file));
    for (const [i, entry] of affected.entries()) await this.app.vault.adapter.write(`${backup}/board-${i}.thoughtspace`, entry.raw);
    await this.app.vault.adapter.write(`${backup}/record.json`, JSON.stringify({ from: oldPath, to: target, boards: affected.map((entry, i) => ({ path: entry.file.path, backup: `board-${i}.thoughtspace` })), status: 'prepared' }, null, 2));
    await this.folder(folder);
    await this.app.fileManager.renameFile(file, target);
    await this.referenceQueue;
    for (const entry of affected) {
      const current = parseBoard(await this.app.vault.read(entry.file));
      if (current.nodes.some(n => n.file === oldPath)) throw new Error(`文件已移动，但白板引用未完成更新：${entry.file.path}；备份：${backup}`);
    }
    await this.app.vault.adapter.write(`${backup}/completed.json`, JSON.stringify({ from: oldPath, to: file.path }, null, 2));
    if (this.settings.cleanupEmptyFolders && oldPath.startsWith(this.settings.cardFolder + '/')) await this.cleanupFolders(oldPath.slice(0, oldPath.lastIndexOf('/')));
    return true;
  }
  private async cleanupFolders(path: string) {
    while (path.startsWith(this.settings.cardFolder + '/')) {
      const folder = this.app.vault.getAbstractFileByPath(path);
      if (!(folder instanceof TFolder) || folder.children.length) break;
      await this.app.fileManager.trashFile(folder);
      path = path.slice(0, path.lastIndexOf('/'));
    }
  }
  async fileAllCards() {
    const files = this.app.vault.getMarkdownFiles().filter(isWorkspaceFile).filter(f => f.path.startsWith(this.settings.cardFolder + '/'));
    let moved = 0, skipped = 0; const failed: string[] = [];
    for (const file of files) {
      const tags = getAllTags(this.app.metadataCache.getFileCache(file) || {}) || [];
      try { const changed = tags.length ? await this.fileCard(file, tags[0]) : await this.serializeFiling(() => this.moveFiled(file, this.settings.cardFolder + '/未分类')); if (changed) moved++; else skipped++; } catch (e) { failed.push(`${file.path}：${String(e)}`); }
    }
    new Notice(`卡片整理完成：移动 ${moved}，保留 ${skipped}，失败 ${failed.length}`, 8000);
    if (failed.length) { const modal = new Modal(this.app); modal.titleEl.setText('以下文件未完成归档'); failed.forEach(text => modal.contentEl.createEl('p', { text })); modal.open(); }
    return { moved, skipped, failed };
  }
  async fileOldJournals(){return requireCalendar(this.app).fileOldJournals();}
  async getJournalFile(day=localDay()){return requireCalendar(this.app).getJournalFile(day);}
  async ensureJournalFile(day=localDay()){return requireCalendar(this.app).ensureJournalFile(day);}
  materialAdapter():MaterialAdapter{
    const current=()=>{const view=this.currentBoard;if(!view?.session||view.closed||!view.file)throw Error('请先选择目标白板');return view;};
    return {docked:true,target:()=>{const v=this.currentBoard;return v?.file&&!v.closed?{name:v.file.basename,path:v.file.path}:undefined;},pickTarget:()=>new ActionPicker(this.app,'选择目标白板',this.app.vault.getFiles().filter(f=>f.extension===EXT&&isWorkspaceFile(f)).map(file=>({title:file.basename,run:()=>this.openBoard(file)})).concat([{title:'＋ 新建白板',run:async()=>this.promptBoard()}])).open(),
      pick:done=>new NotePicker(this.app,done).open(),open:async(file,line)=>{const leaf=await this.openNoteInSidebar(file);const editor=leaf.view instanceof MarkdownView?leaf.view.editor:undefined;if(editor&&line!==undefined){const pos={line,ch:0};editor.setCursor(pos);editor.scrollIntoView({from:pos,to:pos},true);}},
      excerpts:(file,raw,fragments,group,link,options)=>{const view=current();return view.importExcerpts(file,raw,fragments,group,link,view.session,options);},outline:(topics,title,direction)=>current().importOutline(topics,title,direction),
      locate:async result=>{const file=this.app.vault.getAbstractFileByPath(result.boardPath);if(!(file instanceof TFile))throw Error('目标白板已移动或删除');await this.openBoard(file);const view=this.app.workspace.getLeavesOfType(VIEW).find(l=>(l.view as BoardView).file===file)?.view as BoardView|undefined;if(!view?.session?.board.nodes.some(n=>n.id===result.ids[0]))throw Error('摘录已从白板移除，笔记文件仍可在资料库找到');view.revealNode(result.ids[0]);},
      watch:notify=>{const session=this.currentBoard?.session,listener=(kind:SessionUpdate)=>{if(kind==='board')notify();};session?.listeners.add(listener);return()=>{session?.listeners.delete(listener);};},
      placed:result=>{const v=this.currentBoard;return v?.file?.path===result.boardPath&&result.ids.every(id=>v.session?.board.nodes.some(n=>n.id===id));},
      drag:(event,accept)=>{const token=uid();if(!event.dataTransfer)return;event.dataTransfer.setData(MATERIAL_DRAG,token);event.dataTransfer.effectAllowed='copy';this.materialDrag={token,run:async(view,position)=>{await accept((file,raw,fragments,group,link,options)=>view.importExcerpts(file,raw,fragments,group,link,view.session,{...options,asText:true}),position);this.currentBoard=view;for(const l of this.app.workspace.getLeavesOfType(MATERIALS))if(l.view instanceof MaterialsView)l.view.workbench?.refreshTarget();}};},endDrag:()=>this.clearMaterialDrag()};
  }
  private nativeSelection(target:HTMLElement,doc:Document):{text:string;label?:string;pdf?:boolean;run:(board:BoardView,position:{x:number;y:number})=>Promise<void>}|undefined{
    const view=this.app.workspace.getLeavesOfType('markdown').map(l=>l.view).find(v=>v instanceof MarkdownView&&v.contentEl.contains(target));
    if(view instanceof MarkdownView&&target.closest('.cm-content')&&view.file&&view.editor.listSelections().length===1){
      const editor=view.editor,raw=editor.getValue(),from=editor.posToOffset(editor.getCursor('from')),to=editor.posToOffset(editor.getCursor('to'));
      if(from===to||!raw.slice(from,to).trim())return;const fragment=selectionFragment(raw,from,to),source=view.file,sourcePath=source.path;
      return{text:fragment.body,run:async(board,position)=>{
        const owner=board.session;
        if(view.file!==source||source.path!==sourcePath||editor.getValue()!==raw)throw Error('原笔记或选区内容已变化，请重新选择文字');
        if((await this.app.vault.read(source)).replace(/\r\n?/g,'\n')!==raw)await view.save();
        if(view.file!==source||source.path!==sourcePath||editor.getValue()!==raw)throw Error('原笔记已变化，请重新选择文字');
        await board.importExcerpts(source,raw,[fragment],false,false,owner,{position,focus:false,asText:true});
        if(view.file===source&&editor.getValue()===raw)editor.setSelection(editor.offsetToPos(from),editor.offsetToPos(to));
        
      }};
    }
    const pdf=this.app.workspace.getLeavesOfType('pdf').map(l=>l.view).find(v=>v instanceof FileView&&v.containerEl.contains(target));
    const selection=doc.getSelection();if(!(pdf instanceof FileView)||!pdf.file||!selection||selection.rangeCount!==1||selection.isCollapsed)return;
    const range=selection.getRangeAt(0),element=(node:Node)=>node.nodeType===1?node as Element:node.parentElement;
    const first=element(range.startContainer)?.closest('.page[data-page-number]'),last=element(range.endContainer)?.closest('.page[data-page-number]');
    if(!first||!last||!pdf.containerEl.contains(first)||!pdf.containerEl.contains(last)||!target.closest('.textLayer')||!element(range.startContainer)?.closest('.textLayer')||!element(range.endContainer)?.closest('.textLayer'))return;
    const text=selection.toString().trim(),page=Number(first.getAttribute('data-page-number')),endPage=Number(last.getAttribute('data-page-number'));
    const source=pdf.file,path=source.path,mtime=source.stat.mtime,size=source.stat.size;
    pdfExcerptDocument(text,'来源',page,endPage); // Validate bounded text and page numbers before retaining a drag.
    return{text,pdf:true,label:`${source.basename} · 第 ${page===endPage?page:page+'–'+endPage} 页`,run:async(board,position)=>{
      if(pdf.file!==source||source.path!==path||source.stat.mtime!==mtime||source.stat.size!==size)throw Error('PDF 已变化，请重新选择文字');
      await board.importPdfExcerpt(source,text,page,endPage,position,{mtime,size});
    }};
  }
  private dragDocuments=new WeakSet<Document>();
  private nativeDragCancels=new Set<()=>void>();
  private installNativeSelectionDrag(doc:Document){
    if(this.dragDocuments.has(doc))return;this.dragDocuments.add(doc);
    type Snapshot=NonNullable<ReturnType<ThoughtSpace['nativeSelection']>>;
    let pointer:{snapshot:Snapshot;x:number;y:number;id:number;handle?:boolean}|undefined;
    let bar:HTMLElement|undefined,barSnapshot:Snapshot|undefined,ghost:HTMLElement|undefined,refreshTimer:number|undefined,busy=false;
    const boardAt=(target:EventTarget|null)=>this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).find(v=>v instanceof BoardView&&v.acceptsMaterialTarget(target)) as BoardView|undefined;
    const hideBar=()=>{bar?.remove();bar=undefined;barSnapshot=undefined;};
    let feedbackFrame:number|undefined,pendingFeedback:{snapshot:Snapshot;x:number;y:number}|undefined;
    const hideGhost=()=>{if(feedbackFrame!==undefined)doc.defaultView?.cancelAnimationFrame(feedbackFrame);feedbackFrame=undefined;pendingFeedback=undefined;ghost?.remove();ghost=undefined;};
    const cancelPointer=()=>{pointer=undefined;hideGhost();};this.nativeDragCancels.add(cancelPointer);this.register(()=>this.nativeDragCancels.delete(cancelPointer));
    const feedback=(snapshot:Snapshot,x:number,y:number)=>{
      if(snapshot.text&&!ghost){ghost=doc.body.createDiv('ts-excerpt-drag-preview');themeSurface(ghost);ghost.createDiv({cls:'ts-excerpt-drag-caption',text:snapshot.label||'笔记摘录'});ghost.createDiv({cls:'ts-excerpt-drag-text',text:snapshot.text.slice(0,160)});ghost.createDiv({cls:'ts-excerpt-drag-hint',text:'拖到白板 · Esc 取消'});this.materialFeedback=hideGhost;}
      const win=doc.defaultView!;if(ghost){ghost.style.left=Math.max(8,Math.min(win.innerWidth-ghost.offsetWidth-8,x+18))+'px';ghost.style.top=Math.max(8,Math.min(win.innerHeight-ghost.offsetHeight-8,y+18))+'px';}
      const board=boardAt(doc.elementFromPoint(x,y));ghost?.toggleClass('is-over-board',!!board&&!board.session?.blocked);
      for(const l of this.app.workspace.getLeavesOfType(VIEW))if(l.view instanceof BoardView){if(l.view===board&&!board.session?.blocked)l.view.showMaterialLanding(x,y);else l.view.clearMaterialLanding();}
    };
    const queueFeedback=(snapshot:Snapshot,x:number,y:number)=>{
      pendingFeedback={snapshot,x,y};if(feedbackFrame!==undefined)return;
      feedbackFrame=doc.defaultView!.requestAnimationFrame(()=>{feedbackFrame=undefined;const latest=pendingFeedback;pendingFeedback=undefined;if(latest)feedback(latest.snapshot,latest.x,latest.y);});
    };
    const reset=()=>{pointer=undefined;hideGhost();this.clearMaterialDrag();};
    const queueBar=()=>{if(refreshTimer!==undefined)(doc.defaultView||window).clearTimeout(refreshTimer);refreshTimer=(doc.defaultView||window).setTimeout(()=>{refreshTimer=undefined;refreshBar();},70);};
    const refreshBar=()=>{
      if(pointer||this.materialDrag||busy)return;
      const selection=doc.getSelection();if(!selection||selection.isCollapsed||selection.rangeCount!==1){hideBar();return;}
      const range=selection.getRangeAt(0),target=range.startContainer.nodeType===1?range.startContainer as HTMLElement:range.startContainer.parentElement;
      if(!target?.closest('.textLayer')){hideBar();return;}
      let snapshot:Snapshot|undefined;try{snapshot=this.nativeSelection(target,doc);}catch{hideBar();return;}if(!snapshot?.pdf){hideBar();return;}
      const rects=Array.from(range.getClientRects()),win=doc.defaultView!,pane=target.closest('.workspace-leaf-content')?.getBoundingClientRect();
      const visible=rects.filter(r=>r.width>0&&r.height>0&&r.bottom>(pane?.top||0)&&r.top<Math.min(pane?.bottom||win.innerHeight,win.innerHeight));
      if(!visible.length){hideBar();return;}const anchor=visible[0];barSnapshot=snapshot;
      if(!bar){
        bar=doc.body.createDiv({cls:'ts-pdf-selection-tools',attr:{role:'toolbar','aria-label':'PDF 文字摘录'}});themeSurface(bar);
        const handle=button(bar,'拖到白板','grip-vertical',()=>{},'ts-pdf-drag-handle');handle.title='按住此处拖到白板，或直接拖动已选文字';handle.setAttribute('aria-description','按住并拖动，松开后创建摘录文本；Esc 取消');
        handle.onpointerdown=e=>{if(e.button!==0||!barSnapshot||busy)return;e.preventDefault();e.stopPropagation();reset();pointer={snapshot:barSnapshot,x:e.clientX,y:e.clientY,id:e.pointerId,handle:true};};
        button(bar,'加入白板','plus',()=>{const current=barSnapshot,board=this.currentBoard;if(!current||busy)return;if(!board?.session||board.closed){new Notice('请先打开目标白板');return;}busy=true;bar?.setAttribute('aria-busy','true');act(async()=>{try{await current.run(board,board.materialCenter());}finally{busy=false;bar?.removeAttribute('aria-busy');queueBar();}});},'ts-pdf-quick-add');
        button(bar,'关闭摘录工具','x',()=>hideBar(),'ts-icon-button');
        bar.onpointerdown=e=>e.preventDefault(); // Toolbar interaction must not collapse the PDF selection.
      }
      bar.setAttribute('aria-label',`PDF 文字摘录 · ${snapshot.label}`);
      bar.style.left=Math.max(8,Math.min(win.innerWidth-bar.offsetWidth-8,anchor.left))+'px';
      const top=anchor.top-bar.offsetHeight-8;bar.style.top=Math.max(8,Math.min(win.innerHeight-bar.offsetHeight-8,top>(pane?.top||0)?top:anchor.bottom+8))+'px';
    };
    this.registerDomEvent(doc,'selectionchange',queueBar);
    this.registerDomEvent(doc,'scroll',()=>{if(!pointer&&!this.materialDrag)hideBar();queueBar();},true);
    if(doc.defaultView)this.registerDomEvent(doc.defaultView,'resize',queueBar);
    this.registerDomEvent(doc,'dragstart',event=>{
      const held=pointer?.snapshot;pointer=undefined;if(!event.dataTransfer||event.defaultPrevented)return;
      try{const snapshot=held||this.nativeSelection(event.target as HTMLElement,doc);if(!snapshot)return;
        const plain=event.dataTransfer.getData('text/plain');if(plain&&plain.trim()!==snapshot.text&&!held)return;
        const token=uid();event.dataTransfer.setData(MATERIAL_DRAG,token);event.dataTransfer.setData('text/plain',snapshot.text);event.dataTransfer.effectAllowed='copy';this.materialDrag={token,run:snapshot.run,text:snapshot.text,label:snapshot.label};
        hideBar();
      }catch(e){new Notice(String(e));}
    });
    this.registerDomEvent(doc,'dragover',event=>{const pending=this.materialDrag;if(pending)queueFeedback({text:pending.text||'',label:pending.label,run:pending.run},event.clientX,event.clientY);});
    // Arm only on an existing selection. For PDF, suppress browser re-selection and keep the source highlighted.
    this.registerDomEvent(doc,'pointerdown',event=>{
      if((event.target as Element)?.closest?.('.ts-pdf-selection-tools'))return;
      pointer=undefined;if(event.button!==0||event.detail>1||event.shiftKey||event.altKey||event.ctrlKey||event.metaKey)return;
      const selection=doc.getSelection();if(!selection||selection.isCollapsed||selection.rangeCount!==1)return;
      if(!Array.from(selection.getRangeAt(0).getClientRects()).some(r=>event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom))return;
      try{const snapshot=this.nativeSelection(event.target as HTMLElement,doc);if(snapshot){pointer={snapshot,x:event.clientX,y:event.clientY,id:event.pointerId};if(snapshot.pdf&&event.detail<2){event.preventDefault();event.stopPropagation();}}}catch(e){new Notice(String(e));}
    },true);
    this.registerDomEvent(doc,'pointermove',event=>{
      if(!pointer||pointer.id!==event.pointerId||Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)<=8)return;
      queueFeedback(pointer.snapshot,event.clientX,event.clientY);if(pointer.snapshot.pdf)event.preventDefault();
    });
    this.registerDomEvent(doc,'pointerup',event=>{
      if(!pointer||pointer.id!==event.pointerId)return;const start=pointer,board=boardAt(doc.elementFromPoint(event.clientX,event.clientY));reset();queueBar();
      if(!board||Math.hypot(event.clientX-start.x,event.clientY-start.y)<=8)return;
      event.preventDefault();event.stopPropagation();act(()=>start.snapshot.run(board,board.materialDropPoint(event.clientX,event.clientY)));
    },true);
    if(doc.defaultView)this.registerDomEvent(doc.defaultView,'blur',()=>{reset();hideBar();});
    this.registerDomEvent(doc,'pointercancel',event=>{
      // Starting native HTML drag cancels the pointer stream, not the drag.
      // Keep its single-use source token until drop, dragend, Escape or blur.
      if(this.materialDrag)return;
      if(!pointer||pointer.id!==event.pointerId)return;
      reset();
    });this.registerDomEvent(doc,'dragend',()=>{reset();queueBar();});
    this.registerDomEvent(doc,'keydown',e=>{if(e.key==='Escape'){reset();hideBar();if(refreshTimer!==undefined)(doc.defaultView||window).clearTimeout(refreshTimer);}});
    this.register(()=>{pointer=undefined;if(refreshTimer!==undefined)(doc.defaultView||window).clearTimeout(refreshTimer);hideBar();hideGhost();});
  }
  private videoBridge?:YingjianModal;private videoBridgeDisposed=false;
  private async receiveVideoCapture(raw:unknown){
    if(this.videoBridgeDisposed)throw Error('ThoughtSpace 已关闭');
    const request=videoCaptureRequest(raw);if(request.vaultId!==this.yingjianVaultId())throw Error('记录与白板不属于同一仓库');
    const board=this.app.vault.getAbstractFileByPath(request.board),note=this.app.vault.getAbstractFileByPath(request.note);
    if(!(board instanceof TFile)||!(note instanceof TFile)||!isWorkspaceFile(board)||!isWorkspaceFile(note))throw Error('记录或目标白板已移除');
    const text=await this.app.vault.read(note);if(!text.startsWith('---\n')||!text.split('\n---')[0].includes('yingjian-capture-id: '+JSON.stringify(request.id)))throw Error('笔记不是此条视频记录');
    const content=request.presentation==='objects'?videoCaptureContent(text,request.id):undefined;
    if(content?.image){
      const image=this.app.vault.getAbstractFileByPath(content.image);
      if(!(image instanceof TFile)||!isWorkspaceFile(image))throw Error('截图附件已移除，原始记录仍保留');
      const bytes=new Uint8Array(await this.app.vault.readBinary(image));
      if(bytes.length<24||bytes.length>16*1024*1024||![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))throw Error('截图不是有效的 PNG');
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);content.imageSize={width:view.getUint32(16),height:view.getUint32(20)};
    }
    const session=await this.session(board);
    try {
      await session.flush();if(session.blocked)throw Error('白板有保存冲突，请先处理后重试');
      if(this.app.workspace.getLeavesOfType(VIEW).some(l=>l.view instanceof BoardView&&l.view.session===session&&l.view.hasInlineEditor))throw Error('请先结束白板卡片编辑，再重试接收记录');
      const draft=clone(session.board),count=draft.nodes.length;
      // Saved provenance prevents a late result from targeting renamed/replaced files.
      if(board.path!==request.board||note.path!==request.note||this.app.vault.getAbstractFileByPath(request.board)!==board||this.app.vault.getAbstractFileByPath(request.note)!==note)throw Error('记录目标已变化，请重试');
      const id=content?addVideoCaptureObjects(draft,request,content,n=>fitTextNode(n,this.app.workspace.containerEl)):addVideoCaptureCard(draft,request);
      if(draft.nodes.length!==count)session.change(()=>{session.board=draft;});
      await session.flush();if(session.blocked)throw Error('白板未保存，视频记录已保留为笔记草稿');
      return{id,board:board.path};
    } finally { await this.release(session); }
  }
  private yingjianVaultId(){const adapter=this.app.vault.adapter;if(!(adapter instanceof FileSystemAdapter))throw Error('影笺联动需要桌面版 Obsidian');return createHash('sha256').update(resolvePath(adapter.getBasePath())).digest('hex').slice(0,20);}
  async openYingjianLink(params:Record<string,string>){const path=yingjianNotePath(params.note);if(params.vault!==undefined&&params.vault!==this.app.vault.getName()||!path||params.vaultId!==undefined&&params.vaultId!==this.yingjianVaultId())throw Error('影笺入口的仓库或笔记路径无效');let file=this.app.vault.getAbstractFileByPath(path);for(let attempt=0;!file&&attempt<12;attempt++){await new Promise(resolve=>window.setTimeout(resolve,150));file=this.app.vault.getAbstractFileByPath(path);}if(!(file instanceof TFile)||!isWorkspaceFile(file))throw Error('影笺笔记尚未同步到当前仓库，请同步后重试');await this.openYingjian(file);}
  async openYingjian(initial?:TFile,target?:BoardView){if(this.videoBridgeDisposed)return;if(this.videoBridge?.modalEl.isConnected){if(initial)await this.videoBridge.selectNote(initial.path);return;}
    const view=target||this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard,owner=view&&!view.closed?view.session:undefined;
    if(view)await view.prepareVideoBridge();
    const ensure=()=>{if(!view||!owner||view.closed||view.session!==owner||owner.blocked||view.hasInlineEditor||!this.videoBridge?.modalEl.isConnected)throw Error('接收白板或编辑状态已变化，请关闭联动窗口后重新打开');};
    const modal=new YingjianModal(this.app,{
      boardTitle:owner?.file.basename,
      chooseBoard:file=>{modal.close();const picker=new BoardPicker(this.app,null,async board=>{await this.openBoard(board);const target=this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).find(v=>v instanceof BoardView&&v.file===board) as BoardView|undefined;if(!target)throw Error('接收白板未打开，请重试');await this.openYingjian(file,target);});picker.setPlaceholder('选择接收影笺摘录的白板…');picker.open();},
      play:async(source,time,file)=>{if(await playInYingjianPlugin(hostPlugin(this.app,'yingjian'),source,time,file.path,this.yingjianVaultId())){modal.close();return;}modal.containerEl.ownerDocument.defaultView?.open(yingjianLink(source,time,file.path,this.yingjianVaultId()),'_blank','noopener,noreferrer');},
      open:file=>this.openNoteInSidebar(file),
      addNote:owner&&view?async file=>{ensure();return view.addNotesFromHub([file.path],owner);}:undefined,
      addMoments:owner&&view?async(file,raw,moments)=>{ensure();return view.importExcerpts(file,raw,moments.map(m=>m.fragment),false,false,owner,{asText:true});}:undefined
    },()=>{this.videoBridge=undefined;});this.videoBridge=modal;modal.open();if(initial)await modal.selectNote(initial.path);
  }
  async openExcerptNote(initial?:TFile){
    const active=this.app.workspace.getActiveFile(),source=initial||this.currentBoard?.materialSource()||(active&&['md','pdf'].includes(active.extension)?active:undefined);
    if(source){const leaf=await this.openNoteInSidebar(source);new Notice('选中文字后，从选区内按住拖到白板，即可创建摘录文本');return leaf;}
    new ReadingSourcePicker(this.app,file=>this.openExcerptNote(file)).open();
  }
  clearMaterialDrag(){for(const cancel of this.nativeDragCancels)cancel();this.materialDrag=undefined;this.materialFeedback?.();this.materialFeedback=undefined;for(const l of this.app.workspace.getLeavesOfType(VIEW))if(l.view instanceof BoardView)l.view.clearMaterialLanding();}
  async receiveMaterial(event:DragEvent,view:BoardView,position:{x:number;y:number}){const pending=this.materialDrag;const token=event.dataTransfer?.getData(MATERIAL_DRAG);this.clearMaterialDrag();if(!pending||pending.token!==token)return;await pending.run(view,position);}
  async openMaterialPanel(initial?:TFile){
    const active=this.app.workspace.getActiveFile(),suggested=active?.extension==='md'?active:this.currentBoard?.materialSource();
    let leaf=this.app.workspace.getLeavesOfType(MATERIALS)[0];if(!leaf){if(!this.materialsOpening)this.materialsOpening=(async()=>{const created=this.app.workspace.getRightLeaf(false);if(!created)throw Error('无法创建材料侧栏');await created.setViewState({type:MATERIALS,active:false});return created;})();try{leaf=await this.materialsOpening;}finally{this.materialsOpening=undefined;}}
    await leaf.loadIfDeferred();const view=leaf.view as MaterialsView;view.workbench?.refreshTarget();this.app.workspace.rightSplit.expand();await this.app.workspace.revealLeaf(leaf);const source=initial||(!view.workbench?.sourceFile?suggested:undefined);if(source&&view.workbench)await view.workbench.load(source);return view;
  }
  async ensureCalendar(show=false):Promise<WorkspaceLeaf>{return requireCalendar(this.app).ensureCalendar(show);}
  async ensureJournal(show=false):Promise<WorkspaceLeaf>{return requireCalendar(this.app).ensureJournal(show);}
  async selectJournalDay(day:string){return requireCalendar(this.app).selectJournalDay(day);}
  async selectJournalMonth(day:string,month:string,todo:boolean){return requireCalendar(this.app).selectJournalMonth(day,month,todo);}
  private noteQueue:Promise<unknown>=Promise.resolve();
  async editNote(file:TFile){
    if(file.extension!=='md')throw Error('请选择 Markdown 笔记');
    return this.openNoteInSidebar(file,undefined,true);
  }
  openNoteInSidebar(file:TFile,subpath?:string,editing=false):Promise<WorkspaceLeaf>{
    const work=this.noteQueue.catch(()=>{}).then(async()=>{
      if(this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('笔记已移动或删除，请刷新后重试');
      // Finish an inline draft before another view starts editing the same file.
      for(const board of this.app.workspace.getLeavesOfType(VIEW))if(board.view instanceof BoardView)await board.view.prepareNoteOpen(file);
      const right=(l:WorkspaceLeaf)=>!!l.view.containerEl.closest('.mod-right-split');
      let leaf=this.app.workspace.getLeavesOfType(isPdfFile(file.path)?'pdf':'markdown').find(l=>right(l)&&l.getViewState().state?.file===file.path);
      if(!leaf&&this.settings.notePaneLeafId){const existing=this.app.workspace.getLeafById(this.settings.notePaneLeafId);if(existing&&right(existing)&&['markdown','pdf'].includes(existing.getViewState().type)&&!existing.getViewState().pinned)leaf=existing;}
      if(!leaf){const created=this.app.workspace.getRightLeaf(false);if(!created)throw new Error('无法创建右侧笔记面板');leaf=created;}
      const same=leaf.getViewState().state?.file===file.path;
      if(!same)await leaf.openFile(file,{state:editing?{mode:'source'}:undefined,eState:subpath?{subpath}:undefined});
      else {
        if(leaf.isDeferred)await leaf.loadIfDeferred();
        if(editing&&leaf.view instanceof MarkdownView&&leaf.view.getMode()!=='source')await leaf.setViewState({...leaf.getViewState(),state:{...leaf.view.getState(),mode:'source'}});
        if(subpath)leaf.setEphemeralState({subpath});
      }
      this.settings.notePaneLeafId=workspaceLeafId(leaf);await this.saveData(this.settings);await this.app.workspace.revealLeaf(leaf);
      if(editing&&leaf.view instanceof MarkdownView){this.app.workspace.setActiveLeaf(leaf,{focus:true});leaf.view.editor.focus();}return leaf;
    });this.noteQueue=work;return work;
  }
  async waitNoteTags(file:TFile):Promise<string[]>{
    const cache=this.app.metadataCache.getFileCache(file);if(cache)return getAllTags(cache)||[];
    return new Promise((resolve,reject)=>{const ref=this.app.metadataCache.on('changed',changed=>{if(changed===file){window.clearTimeout(timer);this.app.metadataCache.offref(ref);resolve(getAllTags(this.app.metadataCache.getFileCache(file)||{})||[]);}});const timer=window.setTimeout(()=>{this.app.metadataCache.offref(ref);reject(new Error('笔记已保存，原生标签索引暂未就绪，请稍后重试归档'));},5000);});
  }
  editNativeTags(file:TFile){
    const cache=this.app.metadataCache.getFileCache(file);const raw:unknown=cache?.frontmatter?.tags;
    const initial=isUnknownArray(raw)?raw.filter((tag):tag is string=>typeof tag==='string').join(' '):typeof raw==='string'?raw:'';
    const modal=new Modal(this.app);modal.modalEl.addClass('ts-tags-modal');modal.titleEl.setText('编辑笔记标签');
    modal.contentEl.createDiv({cls:'ts-muted',text:'保存到 Obsidian 原生 tags 属性，可用空格或逗号分隔，支持 #研究/阅读。'});
    const input=modal.contentEl.createEl('input',{cls:'ts-wide',type:'text',value:initial,attr:{'aria-label':'笔记标签',placeholder:'研究/阅读 待整理'}});
    const inline=[...new Set(cache?.tags?.map(t=>t.tag)||[])];if(inline.length)modal.contentEl.createDiv({cls:'ts-inline-tag-hint',text:'正文标签：'+inline.join('、')+'。正文标签请在右侧原文中修改。'});
    button(modal.contentEl,'保存标签','tags',async()=>{const tags=normalizeNativeTags(input.value);await this.app.fileManager.processFrontMatter(file,(fm:unknown)=>{if(!isRecord(fm))throw new Error('笔记属性格式无效');if(JSON.stringify(fm.tags)!==JSON.stringify(raw))throw new Error('标签已被其他窗口修改，请重新打开');if(tags.length)fm.tags=tags;else delete fm.tags;});modal.close();new Notice('已保存为 Obsidian 原生标签');},'mod-cta');modal.open();input.focus();
  }
  editJournal(file:TFile){act(()=>this.editNote(file));}
  async journal(){return requireCalendar(this.app).journal();}

  async renameReferences(file: TAbstractFile, oldPath: string) {
    // 自定义扩展名不会被 Obsidian 的双链重命名机制自动更新，因此显式迁移引用。
    const matches=(p?:string)=>p===oldPath||!!p?.startsWith(oldPath+'/');
    const affected=(n:Card)=>matches(n.file)||matches(n.videoCapture?.note);
    const update = (b: Board) => { for (const n of b.nodes) {if(n.file&&matches(n.file))n.file=file.path+n.file.slice(oldPath.length);if(n.videoCapture&&matches(n.videoCapture.note))n.videoCapture.note=file.path+n.videoCapture.note.slice(oldPath.length);} };
    for (const f of this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => f.extension === EXT)) {
      const loaded = this.sessions.get(f);
      try {
        if (loaded) { const s = await loaded; if (s.board.nodes.some(affected)) { if (s.blocked) throw new Error(`引用白板已暂停写入：${f.path}`); s.change(update); s.history = new History(); await s.flush(); } }
        else await this.app.vault.process(f, raw => { const b = parseBoard(raw); if (!b.nodes.some(affected)) return raw; update(b); return JSON.stringify(b, null, 2); });
      } catch (e) { report(e); }
    }
  }
  async databaseDemo() {
    const b = emptyBoard(), folder = tagFolder('#示例/项目进度', this.settings.cardFolder);
    const specs = [
      ['整理证据卡片', '把原始发现和自己的推论分开，标明每条证据的来源。', 'inbox', 'medium'],
      ['起草研究说明', '将研究问题、证据与方法组织成可以讨论的初稿。', 'inbox', 'medium'],
      ['收集核心文献', '围绕研究问题检索原始研究，优先保存可核对的来源。', 'active', 'high'],
      ['核对分析方法', '检查样本、测量、假设与证据适用范围。', 'active', 'high'],
      ['明确研究问题', '把宽泛主题收敛成一个能够用证据回答的问题。', 'done', 'high'],
      ['建立阅读清单', '把待读资料和已经完成的工作放进同一份项目记录。', 'done', 'low'],
    ] as const;
    const cols = ['inbox','active','done'], labels = ['待整理','进行中','已完成'];
    cols.forEach((_,i) => b.nodes.push({id:uid(),kind:'section',title:labels[i],x:70+i*370,y:45,width:345,height:685,color: ['sand','blue','green'][i] as Card['color']}));
    const files:TFile[]=[];
    for (const [i, [title, content, status, priority]] of specs.entries()) {
      const date = new Date(); date.setDate(date.getDate() + (status === 'done' ? -1 : i + 1));
      const f = await this.createUnique(folder,title,'md',`---\ntags: [示例/项目进度]\nthoughtspace_status: ${status}\nthoughtspace_priority: ${priority}\nthoughtspace_due: ${localDay(date)}\n---\n# ${title}\n\n${content}\n`); files.push(f);
      b.nodes.push({id:uid(),kind:'card',transparent:true,file:f.path,x:88+cols.indexOf(status)*370,y:105+(i%2)*300,width:310,height:245,color:status==='done'?'green':status==='active'?'blue':'sand'});
    }
    await this.app.vault.append(files[2],`\n前置问题：[[${files[4].path}|明确研究问题]]\n`);
    await this.app.vault.append(files[0],`\n材料来源：[[${files[2].path}|收集核心文献]]\n`);
    const board=await this.createUnique(`${ROOT}/白板`,'项目进度与资料库','thoughtspace',JSON.stringify(b,null,2));
    await this.openBoard(board,true);return board;
  }
  async demo() {
    const specs = [
      ['从问题开始', '# 从问题开始\n\n把一个宽泛主题，变成一个可以回答的问题。\n\n> 什么证据会改变我的判断？\n\n#研究/问题\n', 'sand', 80, 115],
      ['收集与阅读', '# 收集与阅读\n\n一张卡片只保留一个核心想法。把来源、摘录和自己的解释放在一起。\n\n- [ ] 加入一篇待读文献\n- [ ] 记录来源与关键结论\n\n#研究/阅读\n', 'blue', 440, 115],
      ['让观点发生联系', '# 让观点发生联系\n\n点击工具栏的「连线」，依次选择两张卡片。\n\n为箭头添加标签：支持、反驳、引出问题。\n\n#研究/思考\n', 'green', 800, 115],
      ['整理成自己的解释', '# 整理成自己的解释\n\n移动卡片，在空间里组织证据。\n\n- [ ] 写下当前解释\n- [ ] 找到一条反例\n\n#研究/写作\n', 'purple', 440, 490],
    ] as const;
    const b = emptyBoard(); b.nodes.push({ id: uid(), kind: 'section', title: '01  探索与理解', x: 45, y: 50, width: 1115, height: 390, color: 'blue' });
    for (const [title, content, color, x, y] of specs) { const f = await this.createUnique(this.settings.cardFolder, title, 'md', content); b.nodes.push({ id: uid(), kind:'card',transparent:true, file: f.path, x, y, width: 300, height: 270, color }); }
    const cards = b.nodes.filter(n => n.kind === 'card');
    b.edges = [[0, 1, '寻找证据'], [1, 2, '提炼观点'], [2, 3, '形成解释']].map(([a, z, label]) => ({ id: uid(), from: cards[Number(a)].id, to: cards[Number(z)].id, label: String(label) }));
    b.viewport = { x: 20, y: 15, zoom: .75 };
    await this.openBoard(await this.createUnique(`${ROOT}/白板`, '开始你的思维地图', EXT, JSON.stringify(b, null, 2)), true);
  }
  async nestedDemo() {
    const note = async (title: string, text: string, x: number, color: Card['color'] = 'sand'): Promise<Card> => {
      const f = await this.createUnique(this.settings.cardFolder, title, 'md', `# ${title}\n\n${text}`);
      return { id: uid(), kind:'card',transparent:true, file: f.path, x, y: 45, width: 315, height: 265, color };
    };
    const save = async (title: string, nodes: Card[], labels: string[] = []) => {
      const b = emptyBoard(); b.version = nodes.some(n => n.kind === 'board') ? 2 : 1; b.nodes = nodes;
      b.edges = labels.map((label, i) => ({ id: uid(), from: nodes[i].id, to: nodes[i + 1].id, label }));
      return this.createUnique(`${ROOT}/白板`, title, EXT, JSON.stringify(b, null, 2));
    };
    const portal = (file: TFile, x: number): Card => ({ id: uid(), kind: 'board', file: file.path, x, y: 45, width: 340, height: 265, color: 'green' });
    const methods = await save('方法与可重复性', [
      await note('方法核对清单', '一条结论，先核对它是如何得到的。\n\n- [ ] 记录样本与测量方式\n- [ ] 检查分析假设\n- [ ] 标出证据边界\n\n#研究/方法\n', 30, 'blue'),
      await note('保留可重复的记录', '把来源、处理过程和自己的判断分开记录。\n\n> 让未来的自己能够重新走一遍推理过程。\n\n#研究/方法\n', 425, 'green')
    ], ['可复核']);
    const evidence = await save('文献与证据', [
      await note('收集值得追问的材料', '每张卡片只记录一个观点。\n\n- [ ] 补充原始来源\n- [ ] 摘录关键证据\n\n#研究/阅读\n', 30, 'blue'),
      await note('区分事实与解释', '哪些是观察到的事实，哪些是作者的推论？\n\n> 反例同样值得保留。\n\n#研究/证据\n', 425, 'sand'), portal(methods, 820)
    ], ['核对', '追溯方法']);
    const writing = await save('写作与输出', [
      await note('写出自己的解释', '把有关联的卡片组合成一段完整的论证。\n\n- [ ] 写出核心判断\n- [ ] 标明支持与反对的证据\n\n#研究/写作\n', 30, 'purple'),
      await note('下一步值得做什么', '把尚未回答的问题变成下一轮行动。\n\n- [ ] 列出最关键的缺口\n- [ ] 决定下一个验证步骤\n\n#研究/行动\n', 425, 'green')
    ], ['转化为行动']);
    const root = await save('我的研究工作台', [
      await note('从一个好问题出发', '用白板看清全局，用子白板深入主题。\n\n**我想回答的核心问题是什么？**\n\n- [ ] 把研究主题收敛成一句问题\n\n#研究/问题\n', 30), portal(evidence, 435), portal(writing, 865)
    ], ['寻找证据', '形成解释']);
    await this.openBoard(root, true);
  }
}

class TemplatePicker extends Modal {
  constructor(app:App,private plugin:ThoughtSpace){super(app);}
  onOpen(){
    this.modalEl.addClass('ts-template-modal');themeSurface(this.modalEl);this.titleEl.setText('从一个清晰的结构开始');
    this.contentEl.createEl('p',{cls:'ts-template-intro',text:'选择一种工作方式，创建独立白板和四张可编辑的 Markdown 卡片。'});
    const grid=this.contentEl.createDiv('ts-template-grid');
    for(const t of boardTemplates){
      const card=grid.createDiv('ts-template-card');setIcon(card.createDiv('ts-template-icon'),t.icon);card.createEl('h3',{text:t.name});card.createEl('p',{text:t.description});
      const preview=card.createDiv('ts-template-preview');for(const title of t.titles)preview.createSpan({text:title});
      button(card,'使用 '+t.name,'arrow-up-right',()=>{new Prompt(this.app,'新白板名称',t.name,async name=>{await this.plugin.createFromTemplate(t.id,name);this.close();}).open();},'ts-template-use');
    }
  }
  onClose(){this.contentEl.empty();}
}
/** 原生侧栏只承载当前白板自己的导航 DOM，避免多个白板的操作目标混淆。 */
class NavigatorView extends ItemView {
  private host!:HTMLElement;private bound?:BoardView;
  constructor(leaf:WorkspaceLeaf,private plugin:ThoughtSpace){super(leaf);}
  getViewType(){return DOCK;}getDisplayText(){return 'ThoughtSpace';}getIcon(){return 'network';}
  async onOpen(){
    this.contentEl.empty();this.contentEl.addClass('ts-root','ts-dock');
    const quick=this.contentEl.createDiv('ts-dock-quick');button(quick,'收集笔记','plus',()=>this.plugin.quickCapture(),'ts-primary');button(quick,'新建白板','panels-top-left',()=>this.plugin.promptBoard(),'ts-icon-button');button(quick,'白板模板','layout-template',()=>new TemplatePicker(this.app,this.plugin).open(),'ts-icon-button');
    const entry=this.contentEl.createDiv({cls:'ts-dock-shortcuts',attr:{role:'navigation','aria-label':'知识空间快捷入口'}});button(entry,'空间总览','compass',()=>this.plugin.openSpaceHub());const excerpt=button(entry,'笔记摘录','notebook-pen',()=>this.plugin.openExcerptNote());excerpt.setAttribute('aria-label','打开笔记摘录');excerpt.title='打开笔记摘录';
    const tidy=button(entry,'整理白板','layout-dashboard',()=>this.plugin.openBoardOrganizer(this.bound&&!this.bound.closed?this.bound:undefined),'ts-dock-organize-button');tidy.title='整理当前白板 · 选择布局，预览后应用';
    const preview=button(entry,'分组预览','panels-top-left',()=>this.plugin.openSectionCatalog(this.bound&&!this.bound.closed?this.bound:undefined),'ts-dock-organize-button ts-dock-section-preview');preview.title='分组预览 · 搜索、查看缩略图并定位分组';
    this.host=this.contentEl.createDiv('ts-dock-host');
    this.registerEvent(this.app.vault.on('create',()=>{if(!this.bound)this.bind();}));this.registerEvent(this.app.vault.on('delete',()=>{if(!this.bound)this.bind();}));this.registerEvent(this.app.vault.on('rename',()=>{if(!this.bound)this.bind();}));
    this.bind(this.plugin.currentBoard);
  }
  bind(view?:BoardView){
    if(!this.host)return;
    this.contentEl.dataset.surface=this.plugin.settings.surfaceStyle;
    this.contentEl.dataset.glass=String(this.plugin.settings.glassEffects!==false);
    for(const key of ['accent','density'] as const)this.contentEl.dataset[key]=this.plugin.settings[key];
    if(view?.closed||!view?.session)view=undefined;
    if(view&&this.bound===view&&view.sidebar.parentElement===this.host)return;
    this.bound=view;this.host.empty();
    if(view){this.host.appendChild(view.sidebar);view.refreshNavigation();return;}
    const empty=this.host.createDiv('ts-dock-welcome');empty.createEl('h3',{text:'打开一个思考空间'});empty.createEl('p',{text:'选择白板后，在这里管理卡片、任务与大纲。文件列表仍在原生侧栏页签中。'});
    const boards=this.plugin.app.vault.getFiles().filter(isWorkspaceFile).filter(f=>f.extension===EXT).sort((a,b)=>Number(this.plugin.settings.favoriteBoards.includes(b.path))-Number(this.plugin.settings.favoriteBoards.includes(a.path))||b.stat.mtime-a.stat.mtime);
    for(const file of boards.slice(0,30))button(empty,file.basename,this.plugin.settings.favoriteBoards.includes(file.path)?'star':'panels-top-left',()=>this.plugin.openBoard(file),'ts-dock-board-link');
    if(!boards.length)button(empty,'选择入门模板','layout-template',()=>new TemplatePicker(this.app,this.plugin).open(),'ts-primary');
  }
  async onClose(){this.bound=undefined;this.host?.empty();}
}

class MaterialsView extends ItemView {
 workbench?:MaterialsWorkbench;
 constructor(leaf:WorkspaceLeaf,private plugin:ThoughtSpace){super(leaf);}
 getViewType(){return MATERIALS;}getDisplayText(){return '材料工作台';}getIcon(){return 'notebook-pen';}
 async onOpen(){this.contentEl.empty();const title=this.contentEl.createEl('h2',{cls:'ts-materials-panel-title'}),body=this.contentEl.createDiv('ts-materials-panel-content');this.workbench=new MaterialsWorkbench(this.app,this.plugin.materialAdapter(),this.contentEl,body,title,()=>this.leaf.detach());this.workbench.onOpen();}
 async onClose(){this.plugin.clearMaterialDrag();this.workbench?.onClose();this.workbench=undefined;this.contentEl.empty();}
}

class BoardView extends FileView {
  session?: Session; private unsubscribe?: () => void;
  private snapToggle?:HTMLButtonElement;private gridSelect?:HTMLSelectElement;private canvasControls?:HTMLElement;private canvasSummary?:HTMLElement;private snapTarget?:HTMLElement;private snapReadout?:HTMLElement;
  private stage!: HTMLElement; private world!: HTMLElement; private svg!: SVGSVGElement;
  sidebar!: HTMLElement; closed=false; private dockContext?:HTMLElement; private list!: HTMLElement; private status!: HTMLElement; private inspector!: HTMLElement; private zoomLabel!: HTMLElement;
  private nodeScopes=new Map<string,Component>(); private nodeKeys=new Map<string,string>(); private previewQueue=new RenderQueue(); private pdfPreviewQueue=new RenderQueue(2); private renderFrame=0; private viewportOnlyRender=true; private mapKey=''; private mapViewport?:()=>void; private connectSide?:Side; private selected = new Set<string>(); private selectedEdge?: string;
  private batchFormatTarget:'nodes'|'edges'='nodes';private batchEdgeScope:SelectionEdgeScope='internal';
  private mode: 'select' | 'connect' = 'select'; private connectFrom?: string; private connectButton?: HTMLButtonElement;
  private tab: 'library' | 'boards' | 'tasks' | 'outline' = 'boards'; private query = '';private sidebarQueries=new Map<string,string>(); private tag = ''; private sidebarRun = 0;private sidebarContentKey='';
  private boardScope:'spaces'|'favorites'='spaces';private boardSort:'title'|'updated'='title';
  private taskFilter:TaskFilter='all';private outlineKind:OutlineKind='all';private outlineCollapsed=new Set<string>();private startScreen?:HTMLElement;private savedViewsModal?:SavedViewsModal;private dialogEpoch=0;private groupOrganizer?:GroupOrganizerModal;private layoutPlannerModal?:LayoutPlannerModal;
  private favoriteButton?:HTMLElement;private mindmapButton?:HTMLElement;private mindmapTools?:HTMLElement;private inlineAppearance=false;
  private taskScope: 'board' | 'vault' = 'board'; private sidebarTimer?: number;
  private libraryScope: LibraryScope = 'vault'; private librarySort: LibrarySort = 'updated';
  private selectionTool = false; private selectionButton?: HTMLButtonElement;
  private sectionTool=false; private sectionButton?:HTMLButtonElement; private sectionHint?:HTMLElement;
  private marquee?: {id:number;start:{x:number;y:number};base:Set<string>;baseEdge?:string;box:HTMLElement;section?:boolean;rect?:SectionRect;};
  private rightMarquee?:{id:number;x:number;y:number;start:{x:number;y:number};event:PointerEvent;menu?:MouseEvent;owner:Session;moved:boolean;additive:boolean;action:'pan'|'select';viewport:Board['viewport']};
  private suppressBoardContext=false;
  private focusMode = false; private focusButton?: HTMLElement;
  private trail: TFile[] = []; private crumbs!: HTMLElement; private boardStats!: HTMLElement;
  private minimap!: HTMLElement; private collapsedBoards = new Set<string>();
  private navigationQueue: Promise<void> = Promise.resolve();
  private positions = new Map<string, HTMLElement>(); private space = false; private dragging = false;
  private endpointPorts=new Map<Element,string>();private edgeLayer?:EdgeLayer;private pointerFrame=0;private pendingPointer?:PointerEvent;
  private linkDrag?:{id:number;x:number;y:number;moved:boolean;owner:Session;topicClick?:boolean;edge?:{id:string;end:'from'|'to';expected:string}};
  private linkPreview?:SVGPathElement;private linkTarget?:{id:string;side:Side};private linkTargetEl?:HTMLElement;private linkTargetPort?:Element;private flowHint?:HTMLElement;private backToContent?:HTMLButtonElement;

  // Reuse viewport culling for hit tests; the id index lives only for one connection.
  private connectionCandidates:Card[]=[];
  private connectionIndex?:{owner:Session;nodes:Card[];size:number;byId:Map<string,Card>};
  private connectionGeometryKey='';
  private connectionNodes(owner:Session){
    const nodes=owner.board.nodes,cached=this.connectionIndex;
    if(cached?.owner===owner&&cached.nodes===nodes&&cached.size===nodes.length)return cached.byId;
    const byId=new Map(nodes.map(n=>[n.id,n]));this.connectionIndex={owner,nodes,size:nodes.length,byId};return byId;
  }
  private markerId = `ts-arrow-${uid()}`;
  private alignmentLines:HTMLElement[]=[];
  private gesture?: { draft:Map<string,Card>;targets:DragTarget[];alignmentReady?:boolean;lockedAxis?:'x'|'y';alignment?:AlignmentIndex;guides?:Guide[];originals:Map<string,Card>;idSet:Set<string>; id: number; x: number; y: number; before: Board; ids: string[]; pan: boolean; clearSelectionOnClick?:boolean;resize?: string };
  private inspectorChoiceState?:{title:string;choices:{label:string;checked?:boolean;swatch?:string;run:()=>unknown}[];grid:boolean;owner:Session|undefined;key:string};
  private selectionTools?:HTMLElement;
  private selectionFormatCache?:{host:HTMLElement;owner:Session|undefined;editor:InlineNodeEditor|undefined;key:string};
  private topicAdding=false;
  private inlineLayout?:Board;private inlineGeometry?:InlineGeometry;private inline?:InlineNodeEditor;private inlineId?:string;private inlineTarget?:string;private inlineStart=0;private inlineExit?:Promise<void>;private inlineStyleKey='';private inlineMeasureKey='';private nodeFitQueue=new LayoutRefreshQueue(()=>this.flushNodeFits());
  private previewMetricsReady=false;
  private blankClicks=new BlankDoubleClick();private blankClickOwner?:Session;private blankTextCreating=false;
  private objectMenu?:Menu;private contextOpen=false;private relatedFocus?:Set<string>;private pendingFits=new Map<string,{width:number;height:number;key:string}>();
  private contextPoint?:{x:number;y:number};
  private nativeHeader?:HTMLElement;private fileTitle?:HTMLElement;
  private viewTrail=new ViewTrail();private lastWheelHistory=0;private objectFilter:ObjectFilter={kind:'',color:'',query:''};private filterMatches?:Set<string>;private filterBadge?:HTMLElement;
  private rememberViewport(){if(this.session)this.viewTrail.remember(this.session.board.viewport);}
  private travelViewport(forward=false){if(!this.session)return;const v=this.viewTrail.travel(this.session.board.viewport,forward);if(v){this.session.board.viewport=v;this.transform();this.session.persist();}}
  private zoomPresets(){
    const owner=this.session;if(!owner)return;
    const menu=new Menu().setUseNativeMenu(false),current=()=>this.session===owner&&!this.closed&&!owner.blocked;
    menu.addItem(i=>i.setTitle('聚焦所选 · Shift+F').setIcon('focus').setDisabled(owner.blocked||!this.selected.size).onClick(()=>{if(current()&&this.selected.size)this.focusSelection();}));
    menu.addItem(i=>i.setTitle('适应全部内容').setIcon('scan').setDisabled(owner.blocked).onClick(()=>{if(current())this.fit();}));menu.addSeparator();
    for(const value of [.25,.5,.75,1,1.5,2])menu.addItem(i=>i.setTitle(`${value*100}%`).setChecked(Math.abs(owner.board.viewport.zoom-value)<.01).setDisabled(owner.blocked).onClick(()=>{if(!current())return;this.rememberViewport();this.zoom(value/owner.board.viewport.zoom);}));
    const rect=this.zoomLabel.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.top-300});
  }
  private chooseObjects(){const owner=this.session;if(!owner)return;const m=new Modal(this.app);themeSurface(m.modalEl);m.modalEl.addClass('ts-object-filter-modal');m.titleEl.setText('筛选白板对象');const draft={...this.objectFilter};const controls=m.contentEl.createDiv('ts-object-filter-controls');const query=controls.createEl('input',{type:'search',value:draft.query,attr:{placeholder:'搜索内容或笔记路径','aria-label':'对象内容筛选'}});query.oninput=()=>draft.query=query.value;
    const kind=controls.createEl('select',{attr:{'aria-label':'对象类型'}});for(const [value,text]of Object.entries({'':'全部类型',card:'笔记卡片',text:'文本',image:'图片',pdf:'PDF',board:'子白板',section:'分组'}))kind.createEl('option',{value,text});kind.value=draft.kind;kind.onchange=()=>draft.kind=kind.value;
    const color=controls.createEl('select',{attr:{'aria-label':'对象颜色'}});color.createEl('option',{value:'',text:'全部颜色'});for(const value of colors)color.createEl('option',{value,text:colorNames[value]});color.value=draft.color;color.onchange=()=>draft.color=color.value;
    button(m.contentEl,'应用筛选','filter',()=>{this.requireOwner(owner);this.objectFilter=draft;this.renderBoard();m.close();});button(m.contentEl,'清除筛选','x',()=>{this.objectFilter={kind:'',color:'',query:''};this.renderBoard();m.close();});m.open();}
  private updateObjectFilter(){if(!this.session)return;const active=Object.values(this.objectFilter).some(Boolean);this.filterMatches=active?filterObjects(this.session.board.nodes,this.objectFilter):undefined;this.filterBadge?.toggleClass('is-visible',active);if(this.filterBadge){this.filterBadge.empty();if(active){this.filterBadge.createSpan({text:`匹配 ${this.filterMatches!.size} / ${this.session.board.nodes.length}`});button(this.filterBadge,'选择匹配','check-check',()=>{this.selected=new Set(this.filterMatches);this.contextOpen=false;this.updateSelection();});button(this.filterBadge,'清除对象筛选','x',()=>{this.objectFilter={kind:'',color:'',query:''};this.renderBoard();});}}for(const[id,el]of this.positions)el.toggleClass('is-filtered-out',!!this.filterMatches&&!this.filterMatches.has(id));}
  pasteTexts(text:string,split=true){const owner=this.requireOwner(),position=this.point(),lines=split?textBatch(text):[text];if(!text.trim())return;if(text.length>100000)throw Error('一次最多粘贴 100,000 个字符');const nodes=lines.map((text,i)=>{const n:Card={id:uid(),kind:'text',text,x:position.x,y:position.y,width:240,height:60,color:'sand',fontSize:this.plugin.settings.defaultTextSize};fitTextNode(n,this.contentEl);return n;});let y=position.y;for(const n of nodes){n.y=y;y+=n.height+24;}owner.change(b=>{b.version=3;b.nodes.push(...nodes);});this.selected=new Set(nodes.map(n=>n.id));this.updateSelection();}
  private textBatchPrompt(){const owner=this.session;new TextModal(this.app,'逐行创建文本框','',text=>{this.requireOwner(owner);this.pasteTexts(text);}).open();}
  private async linkedText(){const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);const parent=owner.board.nodes.find(n=>this.selected.has(n.id)&&n.kind!=='section');if(!parent)return;const id=uid();owner.change(b=>{b.version=3;const n:Card={id,kind:'text',text:'',x:parent.x+parent.width+90,y:parent.y,width:80,height:60,color:parent.color,fontSize:this.plugin.settings.defaultTextSize};fitTextNode(n,this.contentEl);b.nodes.push(n);b.edges.push({id:uid(),from:parent.id,to:id,label:'',style:this.plugin.settings.defaultEdgeStyle,direction:this.plugin.settings.defaultEdgeDirection});});await this.startInlineEdit(id,false,true);}
  private checkBoard(){const owner=this.session;if(!owner)return;const issues=boardIssues(owner.board,path=>this.app.vault.getAbstractFileByPath(path) instanceof TFile),m=new Modal(this.app);themeSurface(m.modalEl);m.modalEl.addClass('ts-board-check-modal');m.titleEl.setText('白板检查');for(const [key,label]of [['missing','缺失引用'],['isolated','未连接对象'],['locked','已锁定对象']] as const){m.contentEl.createEl('h3',{text:`${label} · ${issues[key].length}`});for(const n of issues[key].slice(0,100))button(m.contentEl,n.title||n.file?.split('/').pop()||n.text?.slice(0,55)||n.id,'locate-fixed',()=>{if(this.session===owner){m.close();this.revealNode(n.id);}});if(issues[key].length>100)m.contentEl.createDiv({text:'显示前 100 项，请结合对象筛选继续定位。'});}m.open();}
  materialSource(){const n=this.session?.board.nodes.find(n=>this.selected.has(n.id)&&n.kind==='card'),f=n?.file?this.app.vault.getAbstractFileByPath(n.file):undefined;return f instanceof TFile?f:undefined;}
  openMaterials(){this.plugin.currentBoard=this;return this.plugin.openExcerptNote(this.materialSource());}
  openMaterialsModal(){const owner=this.requireOwner(),node=owner.board.nodes.find(n=>this.selected.has(n.id)&&n.kind==='card'),file=node?.file?this.app.vault.getAbstractFileByPath(node.file):undefined;
    const modal=new MaterialsModal(this.app,{initial:file instanceof TFile?file:undefined,pick:done=>new NotePicker(this.app,done).open(),open:file=>this.plugin.openNoteInSidebar(file),excerpts:(file,raw,fragments,group,link,options)=>this.importExcerpts(file,raw,fragments,group,link,owner,options),outline:(topics,title,direction)=>this.importOutline(topics,title,direction,owner)});modal.open();return modal;
  }
  private materialPoint(){const point=this.point();for(const n of this.session?.board.nodes||[])point.x=Math.max(point.x,n.x+n.width+96);return point;}
  importOutline(topics:OutlineTopic[],title:string,direction:'right'|'down'|'up',owner=this.session){
    this.requireOwner(owner);const draft=outlineBoard(topics,title,this.materialPoint(),direction,uid);for(const n of draft.nodes)fitTextNode(n,this.contentEl);layoutMindmap(draft,draft.nodes[0].id,direction);
    owner!.change(b=>{b.version=3;b.mode='mindmap';b.mindmapDirection=direction;b.nodes.push(...draft.nodes);b.edges.push(...draft.edges);});this.revealNode(draft.nodes[0].id);new Notice(`已生成 ${draft.nodes.length} 个主题，可通过节点旁的按钮折叠分支`);
  }
  async prepareWriting(){if(this.inline&&!await this.inline.commit())throw Error('请先处理卡片编辑冲突');}
  acceptsMaterialTarget(target:EventTarget|null){return !!target&&this.stage?.contains(target as Node);}
  materialDropPoint(x:number,y:number):MaterialPoint{const point=this.point(x,y);return {...point,targetId:this.session?evidenceTarget(this.session.board,point)?.id:undefined};}
  materialCenter(){const r=this.stage.getBoundingClientRect();return this.point(r.left+r.width/2,r.top+r.height/2);}
  showMaterialLanding(x:number,y:number){
    if(!this.session||this.session.blocked)return;this.contentEl.addClass('ts-receiving-material');
    let hint=this.world.querySelector<HTMLElement>('.ts-material-landing');if(!hint)hint=this.world.createDiv({cls:'ts-material-landing',attr:{'aria-hidden':'true'}});
    const point=this.materialDropPoint(x,y),target=this.session.board.nodes.find(n=>n.id===point.targetId);hint.toggleClass('is-evidence',!!target);hint.toggleClass('is-blocked',!!target?.locked);hint.setText(target?(target.locked?'卡片已锁定':`＋ 追加证据 · ${target.title||target.file?.split('/').pop()||'笔记'}`):'松开创建摘录文本');Object.assign(hint.style,{left:(target?.x??point.x)+'px',top:(target?target.y+target.height-4:point.y)+'px',width:(target?.width??this.plugin.settings.defaultCardWidth)+'px',height:target?'4px':'160px'});
  }
  clearMaterialLanding(){this.contentEl.removeClass('ts-receiving-material');this.world?.querySelector('.ts-material-landing')?.remove();}
  async appendCardEvidence(id:string,evidence:string,owner=this.requireOwner()):Promise<MaterialImportResult>{
    const node=owner.board.nodes.find(n=>n.id===id),path=node?.file,file=path&&this.app.vault.getAbstractFileByPath(path);
    if(!node||node.kind!=='card'||node.locked||!(file instanceof TFile))throw Error('目标卡片已锁定、移除或来源不存在');
    const validate=()=>{this.requireOwner(owner);const current=owner.board.nodes.find(n=>n.id===id);if(!current||current.kind!=='card'||current.locked||current.file!==path||file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file)throw Error('目标卡片已变化，未追加证据');};
    for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof BoardView)await leaf.view.prepareNoteOpen(file);
    validate();const before=await readCurrentNativeNote(this.app,file);validate();const after=appendEvidence(before,evidence);
    await writeNativeNoteDraft(this.app,file,before,after,validate);this.renderBoard();new Notice('证据已追加到卡片末尾，来源链接已保留');
    return {ids:[id],files:[file.path],boardPath:owner.file.path};
  }
  async importPdfExcerpt(source:TFile,text:string,page:number,endPage:number,position:MaterialPoint,stamp:{mtime:number;size:number}){
    const owner=this.requireOwner(),path=source.path;
    const ensure=()=>{this.requireOwner(owner);if(this.app.vault.getAbstractFileByPath(path)!==source||source.path!==path||source.stat.mtime!==stamp.mtime||source.stat.size!==stamp.size)throw Error('PDF 已移动或变化，请重新选择文字');};ensure();
    const link=`[[${source.path}#page=${page}]]`,document=pdfExcerptDocument(text,link,page,endPage);
    const citation=excerptPresentation(document.body).sources[0].citation;
    ensure();if(position.targetId)return this.appendCardEvidence(position.targetId,pdfLiteralText(text.trim())+'\n\n'+citation,owner);return this.placeExcerptTexts([text.trim()+'\n\n> '+citation],position,owner,'purple');
  }
  private async placeExcerptTexts(texts:string[],position:{x:number;y:number},owner:Session,color:Card['color']='sand'):Promise<MaterialImportResult>{
    this.requireOwner(owner);let y=position.y;const nodes=texts.map(text=>{const n:Card={id:uid(),kind:'text',text,x:position.x,y,width:240,height:60,color,fontSize:this.plugin.settings.defaultTextSize,autoSize:true,review:'later'};fitTextNode(n,this.contentEl);y+=n.height+24;return n;});
    owner.change(b=>{b.version=3;b.nodes.push(...nodes);});this.selected=new Set(nodes.map(n=>n.id));this.contextOpen=false;this.updateSelection();this.renderBoard();await owner.flush();return{ids:nodes.map(n=>n.id),files:[],boardPath:owner.file.path};
  }
  async importExcerpts(source:TFile,raw:string,fragments:Fragment[],group=true,link=true,owner=this.session,options:MaterialImportOptions={}):Promise<MaterialImportResult>{
    this.requireOwner(owner);if(!fragments.length||fragments.length>200)throw Error('请选择 1–200 个片段');
    if(this.app.vault.getAbstractFileByPath(source.path)!==source||(await this.app.vault.read(source)).replace(/\r\n?/g,'\n')!==raw.replace(/\r\n?/g,'\n'))throw Error('原文已变化，请刷新材料后重新选择');
    this.requireOwner(owner);const existingGroup=group&&options.groupId?owner!.board.nodes.find(n=>n.kind==='section'&&n.id===options.groupId):undefined;if(existingGroup?.locked)throw Error('摘录分组已锁定，请解锁或取消汇入分组');
    const point=options.position?{...options.position}:this.materialPoint(),created:TFile[]=[],nodes:Card[]=[],sourcePath=source.path;const width=this.plugin.settings.defaultCardWidth;if(link&&!options.position&&!existingGroup&&!owner!.board.nodes.some(n=>n.kind==='card'&&n.file===source.path))point.x+=width+96;if(existingGroup&&!options.position){const members=owner!.board.nodes.filter(n=>contained(existingGroup,n));point.x=existingGroup.x+30;point.y=Math.max(existingGroup.y+60,...members.map(n=>n.y+n.height+40));}
    const targetNode=options.position?.targetId?owner!.board.nodes.find(n=>n.id===options.position!.targetId):undefined;const destination=targetNode?.file||`${this.plugin.settings.cardFolder}/摘录.md`;
    const cache=this.app.metadataCache.getFileCache(source);if(!cache)throw Error('笔记索引尚未就绪，请稍后刷新材料');
    const references=[...(cache.links||[]),...(cache.embeds||[])].flatMap(ref=>{const parts=parseLinktext(ref.link),target=parts.path?this.app.metadataCache.getFirstLinkpathDest(parts.path,source.path):source;if(!(target instanceof TFile))return [];let replacement=this.app.fileManager.generateMarkdownLink(target,destination,parts.subpath,ref.displayText);if(ref.original.startsWith('!')&&!replacement.startsWith('!'))replacement='!'+replacement;return [{original:ref.original,replacement,start:ref.position.start,end:ref.position.end}];});
    const prepared=fragments.map(f=>({...f,body:rebaseFragment(raw,f,references)}));
    if(options.position?.targetId){const sourceLink=this.app.fileManager.generateMarkdownLink(source,destination);const documents=excerptDocuments(prepared,sourceLink,options);return this.appendCardEvidence(options.position.targetId,documents.map(d=>d.body.replace(/^# [^\n]*\n\n/,'')).join('\n\n'),this.requireOwner(owner));}
    if(options.asText){const documents=excerptDocuments(prepared,`[[${source.path}]]`,options);return this.placeExcerptTexts(documents.map(d=>d.body.replace(/^# [^\n]*\n\n/,'')),point,this.requireOwner(owner));}
    const sourceLink=this.app.fileManager.generateMarkdownLink(source,`${this.plugin.settings.cardFolder}/摘录.md`),documents=excerptDocuments(prepared,sourceLink,options);let groupId:string|undefined;
    try{
      for(const [i,f]of documents.entries()){
        this.requireOwner(owner);if(source.path!==sourcePath)throw Error('原文已移动，请重新读取材料');
        const file=await this.plugin.createUnique(this.plugin.settings.cardFolder,`${source.basename} · ${f.title}`, 'md',f.body);created.push(file);
        nodes.push({id:uid(),kind:'card',transparent:true,file:file.path,x:point.x+(i%3)*(width+32),y:point.y+Math.floor(i/3)*310,width,height:270,color:f.kind==='quote'?'purple':f.kind==='task'?'sand':'green',review:'later'});
      }
      this.requireOwner(owner);if(source.path!==sourcePath||(await this.app.vault.read(source)).replace(/\r\n?/g,'\n')!==raw.replace(/\r\n?/g,'\n'))throw Error('原文在导入期间发生变化');this.requireOwner(owner);
      owner!.change(b=>{b.version=3;if(group){const previous=existingGroup&&b.nodes.find(n=>n.id===existingGroup.id);if(existingGroup&&(!previous||previous.locked))throw Error('分组已变化，请刷新后继续');const frame=sectionBounds([...(previous?b.nodes.filter(n=>contained(previous,n)):[]),...nodes])!;if(previous){Object.assign(previous,frame);groupId=previous.id;}else{groupId=uid();b.nodes.push({id:groupId,kind:'section',title:`${source.basename} · 摘录`,color:'green',...frame});}}b.nodes.push(...nodes);
        if(link){let sourceNode=b.nodes.find(n=>n.kind==='card'&&n.file===source.path);if(!sourceNode){sourceNode={id:uid(),kind:'card',transparent:true,file:source.path,x:point.x-width-96,y:point.y,width,height:270,color:'slate'};b.nodes.push(sourceNode);}unfoldAncestors(b,sourceNode.id);for(const n of nodes)b.edges.push({id:uid(),from:sourceNode.id,to:n.id,label:'摘录',style:'curve',direction:'forward',color:'slate'});}
      });if(options.focus!==false)this.revealNode(nodes[0].id);else{if(!options.position)this.revealNode(nodes[0].id,false);this.selected=new Set(nodes.map(n=>n.id));this.updateSelection();this.renderBoard();}await owner!.flush();if(options.focus!==false)new Notice(`已创建 ${created.length} 篇摘录笔记；撤销白板操作时笔记文件仍会保留`);return {ids:nodes.map(n=>n.id),files:created.map(f=>f.path),boardPath:owner!.file.path,groupId};
    }catch(e){throw Error(`${e instanceof Error?e.message:String(e)}${created.length?`。已创建的 ${created.length} 篇笔记保留在 ${created[0].parent?.path}，可从资料库引用到白板。`:''}`);}
  }
  selectBranch(){const owner=this.requireOwner(),ids=new Set(this.selected);branchDescendants(owner.board,ids).forEach(id=>ids.add(id));this.foldBranches(ids,false);this.selected=ids;this.updateSelection();}
  foldBranches(ids:ReadonlySet<string>,fold:boolean,disclosure?:BranchDisclosure,connectChildren=false){const owner=this.requireOwner();
    // Conversion clones changed edges only; node flags are applied after editor checks.
    const prepared=connectChildren?{...owner.board}:owner.board;
    if(connectChildren)makeChildConnections(prepared,ids);
    const state=branchState(prepared);const targets=owner.board.nodes.filter(n=>ids.has(n.id)&&state.children.has(n.id));if(!targets.length)return;if(targets.some(n=>n.locked)){new Notice('请先解锁分支根节点，再修改折叠状态');return;}
    const apply=(b:Board)=>{if(connectChildren){b.version=3;b.edges=prepared.edges;}if(disclosure)discloseBranches(b,ids,disclosure);else{b.version=3;for(const n of b.nodes)if(ids.has(n.id)&&state.children.has(n.id)){if(fold)n.branchFolded=true;else delete n.branchFolded;}}};
    const editing=new Set([this.inlineId,this.inlineTarget].filter((id):id is string=>!!id));for(const[id,el]of this.positions)if(el.querySelector('.ts-card-title-input'))editing.add(id);
    if(editing.size){
      // Disclosure changes flags only: copy nodes without cloning note contents or
      // touching the live editor. One-level expansion can also hide a deeper draft.
      const draft={...owner.board,nodes:owner.board.nodes.map(n=>({...n}))};apply(draft);const hidden=branchState(draft).hidden;
      if([...editing].some(id=>hidden.has(id))){new Notice('请先完成子节点编辑，再折叠分支');return;}
    }
    this.cancelConnection();owner.change(apply);
    const hidden=branchState(owner.board).hidden;this.selected=new Set([...this.selected].filter(id=>!hidden.has(id)));const edge=owner.board.edges.find(e=>e.id===this.selectedEdge);if(edge&&(hidden.has(edge.from)||hidden.has(edge.to)))this.selectedEdge=undefined;this.contextOpen=false;this.renderBoard();
  }
  async openMindmapStudio(){const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    if(!owner.board.nodes.some(n=>n.kind!=='section')){await this.newText(this.point(),true);return;}
    new MindmapStudioModal(this.app,{board:()=>this.requireOwner(owner).board,selected:owner.board.nodes.find(n=>this.selected.has(n.id)&&n.kind!=='section')?.id,
      apply:(draft,signature,ids)=>{this.requireOwner(owner);if(mindmapSignature(owner.board)!==signature)throw Error('白板内容已变化，请重新打开导图工作台预览');draft.viewport={...owner.board.viewport};owner.change(()=>{owner.board=draft;});this.selected=ids;this.renderBoard();this.focusSelection();},
      outline:id=>{this.requireOwner(owner);this.openBranchOutline(id);}
    }).open();
  }
  async openGroupOrganizer(){const epoch=this.dialogEpoch,owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;if(epoch!==this.dialogEpoch)return;this.requireOwner(owner);this.groupOrganizer?.close();const modal=new GroupOrganizerModal(this.app,{board:()=>this.requireOwner(owner).board,ids:new Set(this.selected),commit:edit=>{this.requireOwner(owner);const draft=studioDraft(owner.board,edit);if(draft)owner.change(()=>{owner.board=draft;});}});this.groupOrganizer=modal;modal.open();}
  async openSavedViews(){const epoch=this.dialogEpoch,owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;if(epoch!==this.dialogEpoch)return;this.requireOwner(owner);this.savedViewsModal?.close();const modal=new SavedViewsModal(this.app,{board:()=>this.requireOwner(owner).board,commit:edit=>{this.requireOwner(owner);const draft=studioDraft(owner.board,edit);if(draft)owner.change(()=>{owner.board=draft;});},restore:id=>{this.requireOwner(owner);this.restoreView(id);}});this.savedViewsModal=modal;modal.open();}
  async openLayoutPlanner(){const epoch=this.dialogEpoch,owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;if(epoch!==this.dialogEpoch)return;this.requireOwner(owner);this.layoutPlannerModal?.close();const modal=new LayoutPlannerModal(this.app,{presets:()=>this.plugin.settings.layoutPresets,savePresets:async presets=>{const previous=this.plugin.settings.layoutPresets,next=cleanLayoutPresets(presets);this.plugin.settings.layoutPresets=next;try{await this.plugin.saveData(this.plugin.settings);}catch(error){if(this.plugin.settings.layoutPresets===next)this.plugin.settings.layoutPresets=previous;throw error;}},board:()=>this.requireOwner(owner).board,ids:new Set(this.selected),viewport:()=>{this.requireOwner(owner);const v=owner.board.viewport;return{x:-v.x/v.zoom,y:-v.y/v.zoom,width:this.stage.clientWidth/v.zoom,height:this.stage.clientHeight/v.zoom};},commit:edit=>{this.requireOwner(owner);const draft=studioDraft(owner.board,edit);if(draft)owner.change(()=>{owner.board=draft;});},focus:ids=>{this.requireOwner(owner);this.selected=ids;this.contextOpen=false;this.relatedFocus=undefined;this.objectFilter={kind:'',color:'',query:''};this.query='';this.renderBoard();this.focusSelection();}});this.layoutPlannerModal=modal;modal.open();}
  openReadingDesk(ids:ReadonlySet<string>=this.selected){const owner=this.requireOwner();new ReadingDesk(this.app,{board:()=>this.requireOwner(owner).board,ids:new Set(ids),title:owner.file.basename,settings:this.plugin.settings,commit:edit=>{this.requireOwner(owner);const draft=studioDraft(owner.board,edit);if(draft)owner.change(()=>{owner.board=draft;});},reveal:id=>{this.requireOwner(owner);this.revealNode(id);},open:async file=>{this.requireOwner(owner);return this.plugin.openNoteInSidebar(file);}}).open();}
  private tourBar?:HTMLElement;
  openStudio(){const owner=this.requireOwner();const ensure=()=>this.requireOwner(owner);new BoardStudioModal(this.app,{
    layout:()=>{ensure();act(()=>this.openLayoutPlanner());},read:()=>{ensure();this.openReadingDesk();},board:()=>ensure().board,ids:()=>new Set(this.selected),
    commit:edit=>{const session=ensure(),draft=studioDraft(session.board,b=>{edit(b);const before=new Map(session.board.nodes.map(n=>[n.id,n.text]));for(const n of b.nodes)if(n.kind==='text'&&before.get(n.id)!==n.text)fitTextNode(n,this.contentEl);});if(draft)session.change(()=>{session.board=draft;});},
    select:ids=>{ensure();this.selected=ids;this.contextOpen=false;this.updateSelection();},reveal:id=>{ensure();this.revealNode(id);},
    viewport:()=>{ensure();const v=owner.board.viewport;return{x:-v.x/v.zoom,y:-v.y/v.zoom,width:this.stage.clientWidth/v.zoom,height:this.stage.clientHeight/v.zoom};},
    tour:ids=>{ensure();this.tourBar?.remove();const list=ids.filter(id=>owner.board.nodes.some(n=>n.id===id));if(!list.length)return;let i=0;const bar=this.stage.createDiv({cls:'ts-tour-bar',attr:{'aria-label':'选区阅读巡览'}});this.tourBar=bar;bar.onpointerdown=e=>e.stopPropagation();bar.onkeydown=e=>e.stopPropagation();
      const prev=button(bar,'上一项','chevron-left',()=>show(i-1),'ts-icon-button'),name=bar.createSpan('ts-tour-title'),next=button(bar,'下一项','chevron-right',()=>show(i+1),'ts-icon-button');button(bar,'退出巡览','x',()=>{bar.remove();this.tourBar=undefined;this.stage.focus();},'ts-icon-button');
      const show=(index:number)=>{if(this.session!==owner){bar.remove();return;}i=Math.max(0,Math.min(list.length-1,index));const n=owner.board.nodes.find(n=>n.id===list[i]);name.setText(`${i+1} / ${list.length} · ${n?nodeName(n):'对象已移除'}`);prev.disabled=i===0;next.disabled=i===list.length-1;if(n)this.revealNode(n.id);};show(0);
    }
  }).open();}
  private relationBar?:HTMLElement;private relationLens?:{seeds:Set<string>;depth:number;direction:RelationDirection};
  exploreRelations(mode:RelationDirection|'path'|'focus',ids:ReadonlySet<string>=this.selected,depth=Infinity){
    const owner=this.requireOwner(),valid=new Set(owner.board.nodes.filter(n=>ids.has(n.id)&&n.kind!=='section').map(n=>n.id));if(!valid.size)throw Error('请先选择内容对象');
    let found:Set<string>,steps:number|undefined;
    if(mode==='path'){if(valid.size!==2)throw Error('请选择两个内容对象');const [a,b]=[...valid],path=shortestRelationPath(owner.board,a,b);if(!path)throw Error('两个对象之间还没有连通路径');found=new Set(path.nodes);steps=path.edges.length;}
    else found=mode==='focus'?valid:relationSelection(owner.board,valid,mode,depth);
    this.relationLens=mode==='connected'||mode==='upstream'||mode==='downstream'?{seeds:valid,depth,direction:mode}:undefined;
    const draft=studioDraft(owner.board,b=>{unfoldRelationAncestors(b,found);});if(draft)owner.change(()=>{owner.board=draft;});
    this.cancelConnection();this.selected=found;this.selectedEdge=undefined;this.contextOpen=false;this.relatedFocus=new Set(found);this.objectFilter={kind:'',color:'',query:''};this.query='';this.renderBoard();this.focusSelection();
    new Notice(steps!==undefined?`最短路径：${steps} 条连接，${found.size} 个对象`:`已选中 ${found.size} 个关系对象`);return [...found];
  }
  private relationMenu(){const owner=this.requireOwner(),ids=new Set(this.selected);const actions:BoardAction[]=[
    {label:'分层聚焦关联',icon:'radar',group:'关系',hint:'从 1 层开始，随时调整深度与方向',run:()=>this.exploreRelations('connected',ids,1)},
    {label:'选择上游内容',icon:'arrow-up-left',group:'关系',hint:'沿箭头回溯来源',run:()=>this.exploreRelations('upstream',ids)},
    {label:'选择下游内容',icon:'arrow-down-right',group:'关系',hint:'沿箭头追踪后续',run:()=>this.exploreRelations('downstream',ids)},
    {label:'两点最短路径',icon:'route',group:'关系',hint:'忽略箭头方向，找最少连接',disabled:ids.size!==2,run:()=>this.exploreRelations('path',ids)},
    {label:'聚焦所选关系',icon:'scan-eye',group:'关系',run:()=>this.exploreRelations('focus',ids)},
    {label:'解除所选内部连线',icon:'unlink',group:'关系',hint:'保留外部连线与导图分支',disabled:ids.size<2,run:()=>this.disconnectSelection(ids)}
    ];for(const action of actions){const run=action.run;action.run=()=>{this.requireOwner(owner);return run();};}new BoardActionModal(this.app,actions).open();}
  moveBranch(id:string,parentId:string|undefined,owner=this.session){
    this.requireOwner(owner);let changed=false;const draft=studioDraft(owner!.board,b=>{changed=reparentBranch(b,id,parentId,uid());if(changed)unfoldRelationAncestors(b,new Set([id]));});if(draft)owner!.change(()=>{owner!.board=draft;});
    this.contextOpen=false;this.relatedFocus=undefined;this.relationLens=undefined;this.selected=new Set([id]);this.renderBoard();new Notice(changed?'已更新分支层级，位置保持不变，可撤销':'分支层级未变化');return changed;
  }
  private moveBranchPrompt(id:string){const owner=this.requireOwner(),excluded=new Set(branchOutline(owner.board,id).map(r=>r.node.id)),old=branchState(owner.board).parents.get(id),expected=JSON.stringify(owner.board.edges.filter(e=>e.kind==='branch'));
    const picker=new BoardFinder(this.app,owner.board.nodes.filter(n=>n.kind!=='section'&&!n.locked&&!excluded.has(n.id)&&n.id!==old),node=>{this.requireOwner(owner);if(JSON.stringify(owner.board.edges.filter(e=>e.kind==='branch'))!==expected)throw Error('导图层级已变化，请重新选择父主题');this.moveBranch(id,node.id,owner);});picker.setPlaceholder('搜索新父主题；保留整个子分支和现有位置…');picker.open();
  }
  private branchSaving=false;
  async saveBranchNote(id:string,title:string,expected?:string,owner=this.session){
    this.requireOwner(owner);if(this.branchSaving)throw Error('分支笔记正在保存');const body=branchMarkdown(owner!.board,id);if(expected!==undefined&&body!==expected)throw Error('分支内容已变化，请重新打开预览');if(!title.trim()||title.trim().length>100)throw Error('笔记名称需要 1–100 个字符');this.branchSaving=true;
    try{const folder=owner!.file.parent?.path||'',file=await this.plugin.createUnique(folder,title,'md',`# ${title.replace(/[\r\n]+/g,' ').trim()}\n\n${body}\n> 来自白板：[[${owner!.file.path}]]\n`);new Notice(`分支笔记已保存：${file.path}；原分支保留`);return file;}finally{this.branchSaving=false;}
  }
  openBranchOutline(id:string){const owner=this.requireOwner(),body=branchMarkdown(owner.board,id),rows=branchOutline(owner.board,id),modal=new Modal(this.app);themeSurface(modal.modalEl);modal.modalEl.addClass('ts-branch-outline-modal');modal.titleEl.setText('分支大纲与笔记');
    const info=modal.contentEl.createDiv('ts-branch-outline-info');info.createSpan({text:`${rows.length} 个主题 · ${Math.max(...rows.map(r=>r.depth))+1} 层`});info.createSpan({text:'卡片保留链接，文本保留全文与来源'});
    const preview=modal.contentEl.createEl('textarea',{cls:'ts-branch-outline-preview',attr:{'aria-label':'分支 Markdown 大纲',readonly:'true'}});preview.value=body;
    const title=modal.contentEl.createEl('input',{type:'text',value:nodeName(rows[0].node).replace(/\.md$/,'').slice(0,80)+' · 分支笔记',attr:{'aria-label':'分支笔记名称',maxlength:'100'}});
    modal.contentEl.createEl('p',{cls:'ts-muted',text:'保存到当前白板所在目录，保留相对链接和原分支。'});const actions=modal.contentEl.createDiv('ts-branch-outline-actions');
    button(actions,'复制大纲','copy',async()=>{await navigator.clipboard.writeText(body);new Notice('已复制带层级的 Markdown 大纲');});const save=button(actions,'保存为笔记','file-plus',async()=>{if(save.disabled)return;save.disabled=true;try{const file=await this.saveBranchNote(id,title.value,body,owner);modal.close();await this.plugin.openNoteInSidebar(file);}finally{save.disabled=false;}},'mod-cta');modal.open();
  }
  disconnectSelection(ids:ReadonlySet<string>=this.selected){const owner=this.requireOwner();let count=0;const draft=studioDraft(owner.board,b=>{count=disconnectInternal(b,ids);});if(draft)owner.change(()=>{owner.board=draft;});this.contextOpen=false;this.renderBoard();new Notice(count?`已解除 ${count} 条内部连线，可撤销`:'没有可解除的普通内部连线');return count;}
  insertTextOnEdge(edgeId:string,text:string,expected?:string,owner=this.session){
    this.requireOwner(owner);const edge=owner!.board.edges.find(e=>e.id===edgeId),a=owner!.board.nodes.find(n=>n.id===edge?.from),b=owner!.board.nodes.find(n=>n.id===edge?.to);if(!edge||!a||!b)throw Error('连线已不存在');if(!text.trim()||text.length>100000)throw Error('请输入 1–100,000 字符');
    const node:Card={id:uid(),kind:'text',text,x:0,y:0,width:240,height:60,color:edge.color||a.color,fontSize:this.plugin.settings.defaultTextSize,autoSize:true,topic:edge.kind==='branch'||undefined};fitTextNode(node,this.contentEl);Object.assign(node,insertionPosition(owner!.board,edgeId,node));
    const draft=studioDraft(owner!.board,d=>{insertBetween(d,edgeId,node,uid(),expected);unfoldRelationAncestors(d,new Set([node.id]));})!;owner!.change(()=>{owner!.board=draft;});this.contextOpen=false;this.relatedFocus=undefined;this.revealNode(node.id);return node.id;
  }
  private promptEdgeText(id:string){const owner=this.requireOwner(),edge=owner.board.edges.find(e=>e.id===id);if(!edge)return;const expected=JSON.stringify(edge);new TextModal(this.app,'在线条中间插入文本','',text=>{this.insertTextOnEdge(id,text,expected,owner);}).open();}
  reworkTexts(mode:'merge'|'split',ids:ReadonlySet<string>=this.selected){const owner=this.requireOwner();let result:string[]=[];const draft=studioDraft(owner.board,b=>{result=mode==='merge'?[mergeTexts(b,ids)]:splitParagraphs(b,ids);const nodes=result.map(id=>b.nodes.find(n=>n.id===id)!);let y=nodes[0].y;for(const n of nodes){fitTextNode(n,this.contentEl);if(mode==='split'){n.y=y;y+=n.height+24;}}});if(draft)owner.change(()=>{owner.board=draft;});this.selected=new Set(result);this.contextOpen=false;this.relatedFocus=undefined;this.renderBoard();this.focusSelection();return result;}
  unifyEdgeStyle(style:NonNullable<Board['defaultEdgeStyle']>='straight'){const owner=this.requireOwner();if(owner.blocked)return;if(owner.board.defaultEdgeStyle===style&&owner.board.edges.every(edge=>edge.style===style))return;owner.change(b=>setBoardEdgeStyle(b,style));new Notice('当前白板连线路径已统一，后续新连线沿用此设置；可撤销');}
  boardActions(){const owner=this.session;if(!owner)return;const ids=new Set(this.selected),one=owner.board.nodes.find(n=>ids.has(n.id)),has=ids.size>0,section=owner.board.nodes.some(n=>ids.has(n.id)&&n.kind==='section');const actions:BoardAction[]=[];
    const add=(label:string,group:string,icon:string,run:()=>unknown,disabled=false,hint?:string)=>actions.push({label,group,icon,run:()=>{this.requireOwner(owner);this.selected=new Set([...ids].filter(id=>owner.board.nodes.some(n=>n.id===id)));return run();},disabled,hint});
    add('分层聚焦关联','关系','radar',()=>this.exploreRelations('connected',ids,1),!has);
    add('选择上游内容','关系','arrow-up-left',()=>this.exploreRelations('upstream',ids),!has);add('选择下游内容','关系','arrow-down-right',()=>this.exploreRelations('downstream',ids),!has);add('两点最短路径','关系','route',()=>this.exploreRelations('path',ids),ids.size!==2);add('聚焦所选关系','关系','scan-eye',()=>this.exploreRelations('focus',ids),!has);add('解除所选内部连线','关系','unlink',()=>this.disconnectSelection(ids),ids.size<2);
    add('连线统一为直线','样式与排列','move-up-right',()=>this.unifyEdgeStyle('straight'));
    add('整理白板','样式与排列','layout-dashboard',()=>this.openLayoutPlanner());
    add('移入已有分组','样式与排列','folder-input',()=>this.openGroupOrganizer(),!has);add('管理常用视角','视角','scan',()=>this.openSavedViews());
    add('打开笔记摘录','内容','notebook-pen',()=>this.openMaterials());add('复用到其他白板','内容','copy-plus',()=>this.openReuse(),!has);
    add('分支大纲与笔记','导图','file-tree',()=>this.openBranchOutline(one!.id),ids.size!==1||one?.kind==='section');add('移动分支到主题…','导图','git-pull-request',()=>this.moveBranchPrompt(one!.id),ids.size!==1||one?.kind==='section');add('分支独立为主题','导图','git-branch',()=>this.moveBranch(one!.id,undefined),ids.size!==1||!one||!branchState(owner.board).parents.has(one.id));
    add('选择整个导图分支','导图','list-tree',()=>this.selectBranch(),!has);
    add('折叠导图分支','导图','list-collapse',()=>this.foldBranches(ids,true),!has);add('展开下一层','导图','list-tree',()=>this.foldBranches(ids,false,'level'),!has);add('展开全部导图分支','导图','unfold-vertical',()=>this.foldBranches(new Set(owner.board.nodes.map(n=>n.id)),false));
    add('打开阅读桌','内容','book-open',()=>this.openReadingDesk());
    add('白板工作台','内容','sliders-horizontal',()=>this.openStudio());
    add('筛选对象','查找与选择','filter',()=>this.chooseObjects());add('白板检查','查找与选择','scan-search',()=>this.checkBoard());add('逐行创建文本框','内容','list-plus',()=>this.textBatchPrompt());add('向右添加关联文本','内容','corner-down-right',()=>this.linkedText(),!has||one?.kind==='section');
    add('复制对象样式','样式与排列','pipette',()=>this.copyObjectStyle(ids,owner),ids.size!==1);add('粘贴对象样式','样式与排列','paintbrush',()=>this.pasteObjectStyle(ids,owner),!has||!this.plugin.copiedNodeStyle);
    add('上移一层','样式与排列','bring-to-front',()=>owner.change(b=>stepLayers(b,ids,true)),!has);add('下移一层','样式与排列','send-to-back',()=>owner.change(b=>stepLayers(b,ids,false)),!has);add('分组贴合内容','样式与排列','group',()=>owner.change(b=>fitSections(b,ids)),!section);
    add('返回上一视角','视角','arrow-left',()=>this.travelViewport(),false,'Alt + ←');add('前进到下一视角','视角','arrow-right',()=>this.travelViewport(true),false,'Alt + →');add('适应全部内容','视角','maximize',()=>this.fit(),false,'F');add('聚焦所选','视角','focus',()=>this.focusSelection(),!has,'Shift + F');add('搜索白板','查找与选择','search',()=>this.findOnBoard(),false,'⌘ / Ctrl + F');
    new BoardActionModal(this.app,actions).open();}

  private paint = (kind:SessionUpdate='board') => { if(kind==='status'){this.renderSaveStatus();return;}this.connectionIndex=undefined;this.renderBoard(); this.renderSidebar(); };
  private renderSaveStatus(){if(!this.status||!this.session)return;const text=this.session.status;if(this.status.textContent!==text)this.status.setText(text);this.status.toggleClass('is-error',this.session.blocked);this.status.dataset.state=this.session.blocked?'error':text==='保存中…'?'saving':'saved';this.status.title=text;this.status.setAttribute('aria-label',text);}
  private scheduleRender(viewportOnly=false){
    if(this.closed)return;
    // A content update upgrades an already queued camera refresh; later wheel events
    // must not downgrade it and leave changed notes or controls stale.
    this.viewportOnlyRender=this.renderFrame?this.viewportOnlyRender&&viewportOnly:viewportOnly;
    if(this.renderFrame)return;
    this.renderFrame=(this.contentEl?.ownerDocument?.defaultView||window).requestAnimationFrame(()=>{this.renderFrame=0;const only=this.viewportOnlyRender;this.viewportOnlyRender=true;this.renderBoard(only);});
  }
  private clearNodes(){this.connectionCandidates=[];this.connectionIndex=undefined;this.connectionGeometryKey='';(this.contentEl?.ownerDocument?.defaultView||window).cancelAnimationFrame(this.renderFrame);this.renderFrame=0;this.viewportOnlyRender=true;this.relationBar?.remove();this.relationBar=undefined;this.nodeFitQueue.cancel();this.pendingFits.clear();this.previewQueue.clear();this.pdfPreviewQueue.clear();this.nodeScopes.forEach(s=>s.unload());this.nodeScopes.clear();this.nodeKeys.clear();this.positions.forEach(e=>e.remove());this.positions.clear();this.endpointPorts.clear();this.mapKey='';this.edgeLayer?.clear();}
  constructor(leaf: WorkspaceLeaf, private plugin: ThoughtSpace) { super(leaf); }
  getViewType() { return VIEW; } getIcon() { return 'network'; }
  getState() { return { ...super.getState(), tsTrail: this.trail.map(f => f.path) }; }
  async setState(state: Record<string, unknown>, result: ViewStateResult) {
    const paths = Array.isArray(state.tsTrail) ? state.tsTrail : [];
    this.trail = [...new Set(paths)].filter((p): p is string => typeof p === 'string' && p !== state.file).slice(0, 64)
      .map(p => this.app.vault.getAbstractFileByPath(p)).filter((f): f is TFile => f instanceof TFile && f.extension === EXT);
    const {tsSearchRedirect,...savedState}=state;
    await super.setState(savedState, result);if(tsSearchRedirect===true)result.history=false;this.renderNavigation();
  }
  async navigate(file: TFile, trail: TFile[] = []) {
    this.navigationQueue = this.navigationQueue.catch(() => {}).then(async () => {
      await this.session?.flush(); await this.leaf.setViewState({ type: VIEW, state: { file: file.path, tsTrail: trail.map(f => f.path) } });
      this.app.workspace.setActiveLeaf(this.leaf, { focus: true }); this.app.workspace.requestSaveLayout();
    });
    return this.navigationQueue;
  }
  private enterBoard(file: TFile) {
    const index = this.trail.indexOf(file);
    return this.navigate(file, index >= 0 ? this.trail.slice(0, index) : [...this.trail, ...(this.file ? [this.file] : [])]);
  }
  applyPreferences() {
    const root = this.contentEl; if (!root) return;
    root.dataset.surface=this.plugin.settings.surfaceStyle;
    root.dataset.glass=String(this.plugin.settings.glassEffects!==false);
    if(this.nativeHeader)this.nativeHeader.dataset.glass=root.dataset.glass;
    root.dataset.accent = this.plugin.settings.accent;
    root.dataset.density = this.plugin.settings.density;
    root.dataset.background = this.plugin.settings.canvasBackground;
    const paper=cleanPaperPreferences(this.plugin.settings);root.style.setProperty('--ts-paper-color',paperBaseColor(paper));root.style.setProperty('--ts-paper-texture',String(paper.paperTexture/100));
    const background=cleanBackgroundImagePreferences(this.plugin.settings),imageResource=this.plugin.backgroundImageResource(background.backgroundImagePath);
    root.style.setProperty('--ts-background-image',imageResource?`url(${JSON.stringify(imageResource)})`:'none');root.style.setProperty('--ts-background-image-fit',background.backgroundImageFit==='tile'?'auto':background.backgroundImageFit);root.style.setProperty('--ts-background-image-repeat',background.backgroundImageFit==='tile'?'repeat':'no-repeat');root.style.setProperty('--ts-background-image-opacity',String(background.backgroundImageOpacity/100));
    this.syncCanvasControls();if(this.session&&this.stage)this.transform();
    root.toggleClass('ts-hide-minimap', !this.plugin.settings.showMinimap);root.dataset.toolbarDensity=this.plugin.settings.toolbarDensity;root.toggleClass('ts-hide-card-tags',!this.plugin.settings.showCardTags);root.toggleClass('ts-hide-ports',!this.plugin.settings.showPorts);root.toggleClass('ts-hide-hints',!this.plugin.settings.showBoardHints);if(this.stage)this.scheduleRender();
  }
  toggleFocus() {
    this.focusMode = !this.focusMode; this.contentEl.toggleClass('ts-focus-mode', this.focusMode);
    const title = this.focusMode ? '退出专注' : '专注模式';
    this.focusButton?.setAttribute('aria-label', title); this.focusButton?.setAttribute('title', title);
    this.focusButton?.toggleClass('is-active', this.focusMode);
  }
  private searchModal?:BoardSearchModal;
  findOnBoard() {
    if(this.searchModal?.modalEl.isConnected){this.searchModal.modalEl.querySelector<HTMLInputElement>('input[type="search"]')?.focus();return this.searchModal;}
    const owner = this.session; if (!owner) return;
    const modal=new BoardSearchModal(this.app,{title:owner.file.basename,board:()=>this.requireOwner(owner).board,
      locate:async id=>{this.requireOwner(owner);if(this.inline&&!await this.inline.commit())throw Error('编辑内容尚未保存，请先处理保存冲突');this.requireOwner(owner);if(!owner.board.nodes.some(n=>n.id===id))throw Error('内容已移除，请刷新搜索');this.objectFilter={kind:'',color:'',query:''};this.relatedFocus=undefined;this.relationLens=undefined;this.revealNode(id);},
      open:async id=>{this.requireOwner(owner);if(this.inline&&!await this.inline.commit())throw Error('编辑内容尚未保存，请先处理保存冲突');this.requireOwner(owner);const node=owner.board.nodes.find(n=>n.id===id),file=node?.file?this.app.vault.getAbstractFileByPath(node.file):undefined;if(!(file instanceof TFile))throw Error('原笔记已移动或移除，请刷新搜索');await this.plugin.openNoteInSidebar(file);},
      link:id=>{this.requireOwner(owner);if(!owner.board.nodes.some(n=>n.id===id))throw Error('内容已移除，请刷新搜索');return boardLink(this.app.vault.getName(),owner.file.path,id);}});this.searchModal=modal;modal.open();return modal;
  }
  locateFile(path: string) { const node = this.session?.board.nodes.find(n => n.kind === 'card' && n.file === path); if (node) this.revealNode(node.id); }
  revealNode(id: string, focus=true) {
    const node = this.session?.board.nodes.find(n => n.id === id); if (!node || !this.session || this.session.blocked) return;
    this.clearCanvasGesture();
    if(branchState(this.session.board).hidden.has(id))this.session.change(b=>unfoldAncestors(b,id));
    if(focus)this.app.workspace.setActiveLeaf(this.leaf,{focus:true});
    this.rememberViewport();const v = this.session.board.viewport;
    this.selected = new Set([id]); this.selectedEdge = undefined; this.mode = 'select'; this.connectFrom = undefined;this.connectSide=undefined;this.stage?.removeClass('ts-connecting'); this.connectButton?.removeClass('is-active');
    v.x = this.stage.clientWidth / 2 - (node.x + node.width / 2) * v.zoom;
    v.y = Math.max(100, this.stage.clientHeight - 90) / 2 - (node.y + node.height / 2) * v.zoom;
    this.transform(); this.updateSelection(); this.session.persist(); if(focus)this.stage.focus();
  }
  async copyDeepLink(id?:string) {
    if(!this.file || (id && !this.session?.board.nodes.some(n=>n.id===id))) throw new Error('内容已移除，请重新打开菜单');
    await navigator.clipboard.writeText(boardLink(this.app.vault.getName(),this.file.path,id));
    new Notice(id?'已复制内容定位链接':'已复制白板链接');
  }
  private titleMenu(e:MouseEvent) {
    e.preventDefault();e.stopPropagation();const owner=this.session;const menu=new Menu().setUseNativeMenu(false);
    menu.addItem(i=>i.setTitle('重命名白板').setIcon('pencil').setDisabled(!owner || owner.blocked).onClick(()=>{if(this.session===owner)this.renameBoard();}));
    menu.addItem(i=>i.setTitle('复制白板链接').setIcon('link').onClick(()=>act(()=>{if(this.session===owner)return this.copyDeepLink();})));
    menu.showAtMouseEvent(e);
  }
  private renameBoard() {
    const file = this.file,owner=this.session,original=file?.path; if (!file || !owner || owner.blocked) return;
    new Prompt(this.app, '重命名白板', file.basename, async value => {
      this.requireOwner(owner);if(file.path!==original)throw new Error('白板已移动，请重新打开菜单');
      const path = `${file.parent?.path ? file.parent.path + '/' : ''}${safeName(value)}.${EXT}`;
      if (path === file.path) return;
      if (this.app.vault.getAbstractFileByPath(path)) throw new Error('已有同名白板，请换一个名称');
      await owner.flush();this.requireOwner(owner);await this.app.fileManager.renameFile(file, path);
    }).open();
  }
  async onOpen() {
    const root = this.contentEl; root.empty(); root.addClass('ts-root');
    this.register(whenBoardStylesReady(root,()=>{this.previewMetricsReady=true;this.refreshFontMetrics();}));
    this.registerEvent(this.app.workspace.on('css-change',()=>this.refreshFontMetrics()));
    const fonts=root.ownerDocument.fonts,onFonts=()=>this.refreshFontMetrics();fonts.addEventListener('loadingdone',onFonts);this.register(()=>fonts.removeEventListener('loadingdone',onFonts));
    this.applyPreferences();
    const top = root.createDiv('ts-topbar');
    const nativeHeader=this.containerEl.querySelector<HTMLElement>('.view-header');
    const nativeTitle=nativeHeader?.querySelector<HTMLElement>('.view-header-title');
    const extras:HTMLElement[]=[];
    const fallback=(!nativeHeader || !nativeTitle)?top.createDiv('ts-brand'):undefined;
    this.fileTitle=nativeTitle || fallback!.createSpan({cls:'ts-board-title',text:this.file?.basename||'思维白板'});
    this.fileTitle.addClass('ts-board-title');
    if(nativeHeader && nativeTitle){this.nativeHeader=nativeHeader;nativeHeader.addClass('ts-native-header');root.addClass('ts-native-chrome');}
    this.registerDomEvent(this.fileTitle,'contextmenu',e=>{e.stopImmediatePropagation();this.titleMenu(e);},{capture:true});
    this.registerDomEvent(this.fileTitle,'dblclick',e=>{e.preventDefault();e.stopImmediatePropagation();this.renameBoard();},{capture:true});
    const fallbackActions=fallback?top.createDiv('ts-actions'):undefined;
    const headerAction=(label:string,icon:string,fn:()=>unknown)=>{
      let pending=false;
      const run=()=>{if(pending||!this.session)return;const result=fn();if(result&&typeof (result as PromiseLike<unknown>).then==='function'){
        pending=true;const disabled=el.getAttribute('aria-disabled'),title=el.getAttribute('title');el.addClass('is-busy');el.setAttribute('aria-busy','true');el.setAttribute('aria-disabled','true');el.setAttribute('title',label+' · 正在处理');
        return Promise.resolve(result).finally(()=>{pending=false;el.removeClass('is-busy');el.removeAttribute('aria-busy');if(disabled===null)el.removeAttribute('aria-disabled');else el.setAttribute('aria-disabled',disabled);if(title===null)el.removeAttribute('title');else el.setAttribute('title',title);});
      }return result;};
      const el=fallbackActions?button(fallbackActions,label,icon,run):this.addAction(icon,label,()=>act(run));
      el.addClass('ts-header-action');extras.push(el);return el;
    };
    const commands=top.createDiv({cls:'ts-commandbar',attr:{role:'toolbar','aria-label':'白板工具栏'}});
    this.registerDomEvent(commands,'focusout',()=>this.inline?.checkFocus());
    this.register(toolbarNavigation(commands));
    this.register(installToolbarWheel(commands));
    this.registerDomEvent(commands,'keydown',e=>{if(e.key==='Escape'&&!e.isComposing&&this.inline&&!this.inline.saving){e.preventDefault();e.stopPropagation();this.inline.input.focus({preventScroll:true});}});
    this.register(()=>{extras.forEach(el=>el.remove());nativeHeader?.removeClass('ts-native-header');if(nativeHeader)delete nativeHeader.dataset.glass;nativeTitle?.removeClass('ts-board-title');});
    const body = root.createDiv('ts-body'); this.sidebar = this.contentEl.ownerDocument.createDocumentFragment().createDiv();this.sidebar.className='ts-sidebar';

    const nav = this.sidebar.createDiv({cls:'ts-tabs',attr:{role:'tablist','aria-label':'空间导航'}});
    const tabs = ['library','boards','tasks','outline'] as const;
    for (const [id, title, icon] of [['library', '卡片', 'layers'], ['boards', '白板', 'layout-dashboard'], ['tasks', '任务', 'list-checks'], ['outline','大纲','list-tree']] as const) {
      const btn = button(nav, title, icon, () => this.selectTab(id));
      btn.setAttribute('role','tab');btn.setAttribute('aria-selected',String(id===this.tab));btn.tabIndex=id===this.tab?0:-1;
      btn.toggleClass('is-active',id===this.tab);
    }
    nav.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const i=tabs.indexOf(this.tab),next=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowRight'?1:-1)+4)%4;this.selectTab(tabs[next]);nav.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();};
    const searchBox=this.sidebar.createDiv({cls:'ts-sidebar-search',attr:{role:'search'}});
    setIcon(searchBox.createSpan('ts-sidebar-search-icon'),'search');
    const search = searchBox.createEl('input', { cls: 'ts-search', type: 'search', placeholder: '搜索白板…', attr: { 'aria-label': '搜索卡片、白板或任务' } });
    const clear=button(searchBox,'清除搜索','x',()=>{search.value='';search.dispatchEvent(new Event('input'));search.focus();},'ts-icon-button ts-search-clear');clear.hidden=true;
    search.oninput = () => { this.query = search.value.toLocaleLowerCase();clear.hidden=!search.value; this.renderSidebar(); };
    search.onkeydown=e=>{if(!e.isComposing&&e.keyCode!==229&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.key==='Escape'&&search.value){e.preventDefault();e.stopPropagation();clear.click();}};
    this.list = this.sidebar.createDiv({cls:'ts-library',attr:{role:'tabpanel','aria-label':'白板'}});
    search.title='↓ 进入结果 · ↑ 从末项开始 · Esc 清除搜索';
    this.register(sidebarSearchNavigation(search,this.list,()=>!this.closed&&!this.sidebarTimer&&this.list.getAttribute('aria-busy')!=='true'));
    const main = body.createDiv('ts-main');
    const formatbar=main.createDiv('ts-floating-formatbar');
    const previous=button(formatbar,'前面的格式工具','chevron-left',()=>{},'ts-icon-button ts-format-scroll ts-format-scroll-prev');previous.hidden=true;
    formatbar.append(commands);
    const next=button(formatbar,'后面的格式工具','chevron-right',()=>{},'ts-icon-button ts-format-scroll ts-format-scroll-next');next.hidden=true;
    for(const arrow of [previous,next])arrow.onmousedown=e=>e.preventDefault();
    this.registerDomEvent(formatbar,'focusout',()=>this.inline?.checkFocus());
    this.register(installToolbarOverflow(formatbar,commands,previous,next));
    this.crumbs = this.contentEl.ownerDocument.createDocumentFragment().createDiv();
    this.boardStats=this.contentEl.ownerDocument.createDocumentFragment().createDiv();
    headerAction('撤销','undo-2',()=>this.session?.undo()).addClass('ts-board-history-action');
    headerAction('重做','redo-2',()=>this.session?.undo(true)).addClass('ts-board-history-action');
    this.status=this.contentEl.ownerDocument.createDocumentFragment().createDiv();this.status.className='ts-save-status';this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');this.status.setAttribute('aria-atomic','true');extras.push(this.status);
    (nativeHeader?.querySelector('.view-actions') || fallbackActions)!.prepend(this.status);
    this.favoriteButton=headerAction('收藏白板','star',()=>this.file&&this.plugin.toggleFavorite(this.file));
    headerAction('搜索白板','search',()=>this.findOnBoard());
    headerAction('常用视角','scan',()=>this.openSavedViews());
    this.focusButton=headerAction('专注模式','focus',()=>this.toggleFocus());
    const workspaceEntry=headerAction('工作区','panels-top-left',()=>this.headerWorkspaceMenu(workspaceEntry));workspaceEntry.addClass('ts-workspace-menu-entry');
    (nativeHeader?.querySelector('.view-actions') || fallbackActions)?.prepend(...extras);
    this.applyPreferences();
    this.selectionTools=commands.createDiv({cls:'ts-selection-tools',attr:{'aria-label':'选中对象格式'}});
    this.stage = main.createDiv({ cls: 'ts-stage', attr: { tabindex: '0', 'aria-label': '思维白板；鼠标与快捷键可在插件设置中自定义。Shift 加左键框选，空格加左键平移，右键单击打开菜单，双击空白新建文本，双击已有节点编辑。思维导图：Tab 子主题，Enter 同级，Shift+Tab 父主题' } });
    this.world = this.stage.createDiv('ts-world'); this.svg = this.world.createSvg('svg', { cls: 'ts-edges' });this.edgeLayer=new EdgeLayer(this.svg,this.markerId,id=>this.labelEdge(id));
    this.startScreen=this.stage.createDiv({cls:'ts-start-screen',attr:{'aria-label':'开始使用白板'}});this.startScreen.hidden=true;
    this.startScreen.createEl('h2',{cls:'ts-start-heading',text:'从一个想法开始'});
    this.startScreen.createEl('p',{cls:'ts-start-copy',text:'把文字、笔记和材料放在一起，让思路慢慢清晰。'});
    const startActions=this.startScreen.createDiv('ts-start-actions');
    button(startActions,'写下想法','type',()=>this.newText(),'ts-primary');button(startActions,'插入已有笔记','file-input',()=>this.insertExistingNote());button(startActions,'思维导图模板','git-fork',()=>this.plugin.promptMindmap());
    this.startScreen.createDiv({cls:'ts-start-tip',text:'也可以双击空白处写文本，或把笔记拖进白板。'});
    this.registerDomEvent(this.startScreen,'wheel',e=>e.stopPropagation(),{passive:true});this.registerDomEvent(this.startScreen,'pointerdown',e=>e.stopPropagation());this.registerDomEvent(this.startScreen,'dblclick',e=>e.stopPropagation());
    const rail=main.createDiv({cls:'ts-board-rail',attr:{role:'toolbar','aria-label':'白板创作工具','aria-orientation':'vertical'}});
    const railTools=rail.createDiv('ts-rail-tools');
    const panel=main.createDiv({cls:'ts-rail-popover',attr:{role:'dialog','aria-label':'更多白板工具'}});panel.hidden=true;
    const toolbar = panel.createDiv('ts-rail-actions');
    const arrange=button(railTools,'整理白板','layout-dashboard',()=>this.openLayoutPlanner(),'ts-arrange-entry');
    const creation=toolbar.createDiv({cls:'ts-tool-cluster ts-cluster-create',attr:{role:'group','aria-label':'创作内容'}}),organize=toolbar.createDiv({cls:'ts-tool-cluster',attr:{role:'group','aria-label':'组织内容'}}),workspace=toolbar.createDiv({cls:'ts-tool-cluster',attr:{role:'group','aria-label':'白板与历史'}});
    button(workspace,'白板写作模式','notebook-pen',()=>this.plugin.openWriting(this));button(workspace,'打开笔记摘录','notebook-pen',()=>this.openMaterials());button(workspace,'插入 PDF 卡片','file-plus',()=>this.insertPdfCard());button(workspace,'阅读 PDF','file-text',()=>new ReadingSourcePicker(this.app,file=>this.plugin.openExcerptNote(file),true).open());
    button(workspace,'白板操作','command',()=>this.boardActions());
    button(workspace,'连线统一为直线','move-up-right',()=>this.unifyEdgeStyle('straight'));
    this.selectionButton = button(organize, '框选', 'scan', () => this.toggleSelectionTool());this.selectionButton.title='开启后左键框选 · Shift 累加 · 空格加左键平移 · 鼠标操作可在设置中修改';
    button(creation, '新建卡片', 'plus', () => this.newCard(), 'ts-primary');
    button(creation,'文本','type',()=>this.newText());button(creation,'表格','table-2',()=>this.newTable());button(creation,'图片','image-plus',()=>this.imageMenu());
    const insert=button(creation, '插入笔记', 'file-input', () => this.insertExistingNote(), 'ts-insert-note-entry');insert.title='插入已有 Markdown 笔记或 PDF · 搜索名称或路径';creation.insertBefore(insert,creation.children[1]);
    this.connectButton = button(organize, '连线', 'move-up-right', () => this.toggleConnectionTool());
    this.sectionButton=button(organize, '分组框', 'group', () => this.sectionAction(),'ts-section-tool');this.sectionButton.title='框住所选内容，或拖动画出分组框';
    button(organize, '子白板', 'panels-top-left', () => this.newChildBoard());
    button(organize,'分组总览','list-tree',()=>this.sectionNavigator());
    button(organize,'移入已有分组','folder-input',()=>this.openGroupOrganizer());
    button(organize, '引用白板', 'folder-input', () => new BoardPicker(this.app, this.file, f => this.addBoard(f)).open());
    button(organize,'复用到其他白板','copy-plus',()=>this.openReuse());
    button(workspace,'白板工作台','sliders-horizontal',()=>this.openStudio());
    button(workspace,'常用视角','scan',()=>this.openSavedViews());
    button(workspace,'视角与快照','bookmark-plus',()=>this.workspaceMenu());
    // Creation and navigation live in the rail; object formatting stays above the canvas.
    railTools.append(this.selectionButton,this.connectButton,...Array.from(creation.children),this.sectionButton,arrange);
    creation.remove();button(railTools,'思维导图工作台','git-fork',()=>this.openMindmapStudio(),'ts-mindmap-studio-entry');button(railTools,'搜索白板','search',()=>this.findOnBoard());
    this.mindmapTools=toolbar.createDiv({cls:'ts-tool-cluster ts-more-mindmap-tools',attr:{role:'group','aria-label':'思维导图工具'}});
    toolbar.insertBefore(this.mindmapTools,workspace);
    button(this.mindmapTools,'导图布局与配色','settings-2',()=>this.openMindmapStudio());
    button(this.mindmapTools,'中心主题','circle-dot',()=>this.newText(this.point(),true));
    button(this.mindmapTools,'子主题 · Tab','corner-down-right',()=>this.addTopic());
    button(this.mindmapTools,'同级主题 · Enter','list-plus',()=>this.addTopic(true));
    button(this.mindmapTools,'向右整理','align-start-vertical',()=>this.layoutTopics('right'));
    button(this.mindmapTools,'向下整理','align-start-horizontal',()=>this.layoutTopics('down'));
    button(this.mindmapTools,'向上整理','arrow-up-from-line',()=>this.layoutTopics('up'));
    const toolSearch=installRailToolSearch(panel,toolbar);this.register(toolSearch.dispose);
    const more=button(railTools,'更多白板工具','ellipsis',()=>{panel.hidden=!panel.hidden;more.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)toolSearch.open();});more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-expanded','false');
    for(const entry of [railTools.querySelector('.ts-primary'),this.sectionButton,more])if(entry){const divider=railTools.ownerDocument.createDocumentFragment().createDiv();divider.className='ts-rail-divider';divider.setAttribute('role','separator');divider.setAttribute('aria-orientation','horizontal');railTools.insertBefore(divider,entry);}
    const closeTools=(focus=false)=>{panel.hidden=true;more.setAttribute('aria-expanded','false');if(focus)more.focus();};
    main.addEventListener('pointerdown',e=>{if(!rail.contains(e.target as Node)&&!panel.contains(e.target as Node))closeTools();});
    panel.addEventListener('click',e=>{if(toolbar.contains(e.target as Node)&&(e.target as Element).closest('button'))closeTools();});
    panel.addEventListener('focusout',()=>(panel.ownerDocument.defaultView||window).setTimeout(()=>{const active=panel.ownerDocument.activeElement;if(!panel.contains(active)&&!rail.contains(active))closeTools();},0));
    for(const area of [rail,panel]){
      area.addEventListener('keydown',e=>{e.stopPropagation();if(e.defaultPrevented||e.isComposing||e.keyCode===229||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;if(e.key==='Escape'){e.preventDefault();closeTools(true);return;}if(!(e.target instanceof HTMLButtonElement)||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;const buttons=Array.from(area.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')).filter(b=>b.offsetWidth>0),at=buttons.indexOf(e.target);if(at<0)return;e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(at+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();});
    }
    const footer=main.createDiv('ts-footer');
    this.canvasControls=footer.createDiv({cls:'ts-canvas-controls',attr:{role:'toolbar','aria-label':'画布控制台'}});
    this.snapToggle=button(this.canvasControls,'网格吸附','magnet',()=>this.mutate(b=>{b.version=3;b.snapToGrid=!b.snapToGrid;}),'ts-snap-toggle');
    this.snapToggle.createSpan({cls:'ts-snap-state',text:'关闭'});
    const spacing=this.canvasControls.createEl('label',{cls:'ts-grid-spacing',attr:{title:'吸附间距 · 缩小时只显示主要网格线，吸附精度保持不变'}});setIcon(spacing.createSpan(),'ruler');
    this.gridSelect=spacing.createEl('select',{attr:{'aria-label':'网格间距'}});for(const step of gridSteps)this.gridSelect.createEl('option',{value:String(step),text:`${step} px`});
    this.gridSelect.onchange=()=>act(async()=>{const value=Number(this.gridSelect!.value);if(!gridSteps.some(step=>step===value))return;this.plugin.settings.gridStep=value;await this.plugin.savePreferences();});
    const backgrounds=this.canvasControls.createDiv({cls:'ts-background-switch',attr:{role:'group','aria-label':'画布背景'}});
    for(const [value,label,icon] of [['dots','点阵背景','circle-dot'],['grid','网格背景','grid'],['plain','纯色背景','square'],['paper','纸张纹理','file-text']] as const){const b=button(backgrounds,label,icon,async()=>{if(value==='paper'&&this.plugin.settings.canvasBackground==='paper'){this.plugin.openPaperSettings();return;}this.plugin.settings.canvasBackground=value;await this.plugin.savePreferences();});b.dataset.backgroundChoice=value;}
    button(backgrounds,'纸张外观','palette',()=>this.plugin.openPaperSettings(),'ts-paper-settings-entry');
    this.canvasSummary=footer.createDiv({cls:'ts-canvas-summary',attr:{role:'status','aria-live':'polite'}});
    const zoom=footer.createDiv('ts-zoom');button(zoom,'−','minus',()=>this.zoom(.85));this.zoomLabel=zoom.createSpan({attr:{role:'button',tabindex:'0','aria-label':'缩放比例与视图定位',title:'缩放比例 · 聚焦所选 · 适应全部'}});this.zoomLabel.onclick=()=>this.zoomPresets();this.zoomLabel.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.zoomPresets();}};button(zoom,'+','plus',()=>this.zoom(1.18));button(zoom,'适应','scan',()=>this.fit());
    this.snapTarget=this.stage.createDiv({cls:'ts-snap-target',attr:{'aria-hidden':'true'}});this.snapReadout=this.stage.createDiv({cls:'ts-snap-readout',attr:{'aria-hidden':'true'}});
    this.flowHint=this.stage.createDiv({cls:'ts-flow-hint',attr:{role:'status','aria-live':'polite'}});
    this.backToContent=button(this.stage,'返回内容','scan',()=>this.fit(),'ts-back-content');
    this.sectionHint=this.stage.createDiv({cls:'ts-section-hint',text:'拖动画出分组框 · 松手后命名 · Esc 取消',attr:{role:'status'}});
    this.syncCanvasControls();
    this.filterBadge=main.createDiv({cls:'ts-object-filter-status',attr:{'aria-live':'polite'}});this.inspector = main.createDiv('ts-inspector');
    this.minimap = main.createDiv({ cls: 'ts-minimap', attr: { 'aria-label': '白板缩略图' } });
    const resizeObserver=new ResizeObserver(()=>this.scheduleRender());resizeObserver.observe(this.stage);this.register(()=>resizeObserver.disconnect());
    this.registerDomEvent(this.stage,'pointerdown',e=>{
      if(this.blankClickOwner!==this.session){this.blankClicks.cancel();this.blankClickOwner=this.session;}
      this.blankClicks.down(e,this.canCreateBlankText(e),this.plugin.settings.dragThreshold??4);
    },{capture:true});
    this.registerDomEvent(this.contentEl.ownerDocument,'pointermove',e=>this.blankClicks.move(e),{capture:true,passive:true});
    this.registerDomEvent(this.contentEl.ownerDocument,'pointerup',e=>this.blankClicks.up(e),{capture:true});
    this.registerDomEvent(this.contentEl.ownerDocument,'pointercancel',e=>this.blankClicks.up(e,true),{capture:true});
    this.registerDomEvent(this.stage,'click',e=>this.blankClicks.click(e),{capture:true});
    this.registerDomEvent(this.stage,'dblclick',e=>act(()=>this.blankDoubleClick(e)));
    this.registerDomEvent(this.contentEl.ownerDocument.defaultView!,'blur',()=>this.blankClicks.cancel());
    this.registerDomEvent(this.stage, 'pointerdown', e => this.pointerDown(e));
    this.registerDomEvent(this.stage, 'contextmenu', e => this.contextMenu(e));
    this.registerDomEvent(this.stage, 'pointermove', e => this.pointerMove(e));
    this.registerDomEvent(this.stage, 'pointerup', e => this.pointerUp(e));
    this.registerDomEvent(this.stage, 'pointercancel', e => this.pointerUp(e, true));
    // A floating panel may swallow the release after pointer capture is lost.
    this.registerDomEvent(this.contentEl.ownerDocument,'pointerup',e=>this.finishMarqueeFromDocument(e),{capture:true});
    this.registerDomEvent(this.contentEl.ownerDocument,'pointercancel',e=>this.finishMarqueeFromDocument(e,true),{capture:true});
    this.registerDomEvent(this.stage,'lostpointercapture',e=>this.pointerCaptureLost(e));
    this.registerDomEvent(this.contentEl.ownerDocument.defaultView!,'blur',()=>{this.cancelRightMarquee();this.cancelConnection();this.flushPointer(false);this.setSectionTool(false);this.space=false;if(this.gesture)this.pointerUp(new PointerEvent('pointercancel',{pointerId:this.gesture.id}),true);if(this.marquee)this.finishMarquee(true);});
    this.registerDomEvent(this.stage,'wheel',e=>{
      if(!this.session)return;if(consumeMarkdownPreviewWheel(e))return;e.preventDefault();if(this.gesture||this.marquee||this.rightMarquee||this.linkDrag)return;
      const intent=boardWheelIntent(e,this.plugin.settings,this.stage.clientWidth,this.stage.clientHeight);
      if(intent.kind==='pan'?!intent.dx&&!intent.dy:intent.factor===1)return;
      if(Date.now()-this.lastWheelHistory>600)this.rememberViewport();this.lastWheelHistory=Date.now();
      if(intent.kind==='pan'){this.session.board.viewport.x-=intent.dx;this.session.board.viewport.y-=intent.dy;this.transform();this.session.persist();}
      else this.zoom(intent.factor,intent.atPointer?e.clientX:undefined,intent.atPointer?e.clientY:undefined);
    },{passive:false});
    const openStageLink=(e:MouseEvent)=>{
      const link = (e.target as Element).closest('a'); if (!link) return;
      if (link.classList.contains('internal-link')) {
        const path = link.getAttribute('data-href') || link.getAttribute('href');
        const id = link.closest('[data-id]')?.getAttribute('data-id');
        const source = this.session?.board.nodes.find(n => n.id === id)?.file || this.session?.file.path || '';
        if (path) { e.preventDefault(); e.stopPropagation(); const parts=parseLinktext(path),target=this.app.metadataCache.getFirstLinkpathDest(parts.path,source);act(() => target?.extension==='pdf'&&!Keymap.isModEvent(e)?this.plugin.openNoteInSidebar(target,parts.subpath):this.app.workspace.openLinkText(path, source, Keymap.isModEvent(e)||'tab')); }
      } else if (link.classList.contains('tag')) {
        e.preventDefault(); e.stopPropagation(); this.tag = link.textContent?.trim() || ''; this.selectTab('library','');
      }
    };
    this.registerDomEvent(this.stage,'click',openStageLink);
    this.registerDomEvent(this.stage,'auxclick',e=>{if(e.button===1&&(e.target as Element).closest('a.internal-link'))openStageLink(e);});
    this.registerDomEvent(root,'mouseover',e=>{
      const target=(e.target as Element).closest<HTMLElement>('a.internal-link,[data-ts-note-path]');
      if(!target||target.closest('.ts-inline-editor,.is-editing-title,.markdown-embed,.internal-embed')||(e.relatedTarget instanceof Node&&target.contains(e.relatedTarget)))return;
      const id=target.closest('[data-id]')?.getAttribute('data-id'),sourcePath=this.session?.board.nodes.find(n=>n.id===id)?.file||this.file?.path||'';
      const linktext=target.dataset.tsNotePath||target.getAttribute('data-href')||target.getAttribute('href');if(!linktext)return;
      this.app.workspace.trigger('hover-link',{event:e,source:'thoughtspace',hoverParent:this.leaf,targetEl:target,linktext,sourcePath});
    });
    this.registerDomEvent(root, 'keydown', e => this.key(e));
    this.registerDomEvent(root, 'keyup', e => { if (e.code === 'Space') this.space = false; });
    this.registerDomEvent(root, 'focusout', () => { this.space = false; });
    this.registerDomEvent(this.stage, 'dragover', e => { if (['Files','text/plain','text/x-thoughtspace-note', 'text/x-thoughtspace-board',MATERIAL_DRAG].some(t => e.dataTransfer?.types.includes(t))){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';} });
    this.registerDomEvent(this.stage,'paste',e=>{const files=Array.from(e.clipboardData?.files||[]).filter(f=>isImage(f.name));if(files.length){e.preventDefault();act(()=>this.importImages(files));}else if(e.target===this.stage){const text=e.clipboardData?.getData('text/plain');if(text?.trim()){e.preventDefault();act(()=>this.pasteTexts(text,false));}}});
    this.registerDomEvent(this.stage,'dragleave',e=>{if(!this.stage.contains(e.relatedTarget as Node|null))this.clearMaterialLanding();});
    this.registerDomEvent(this.stage, 'drop', e => { if(e.dataTransfer?.types.includes(MATERIAL_DRAG)){e.preventDefault();e.stopPropagation();act(()=>this.plugin.receiveMaterial(e,this,this.materialDropPoint(e.clientX,e.clientY)));return;}if(e.dataTransfer?.files.length){e.preventDefault();act(()=>this.importBoardAttachments(Array.from(e.dataTransfer!.files),this.point(e.clientX,e.clientY)));return;} const path = e.dataTransfer?.getData('text/x-thoughtspace-note') || e.dataTransfer?.getData('text/x-thoughtspace-board'); if (!path) {const ref=pdfDropReference(e.dataTransfer?.getData('text/plain')||'');if(ref){const file=this.app.metadataCache.getFirstLinkpathDest(ref.path,this.file?.path||'');if(file instanceof TFile&&isPdfFile(file.path)){e.preventDefault();act(()=>this.insertPdfCard(this.point(e.clientX,e.clientY),file,ref.page));}}return;} e.preventDefault(); const f = this.app.vault.getAbstractFileByPath(path); if (f instanceof TFile) { if (f.extension === EXT) act(() => this.addBoard(f, this.point(e.clientX, e.clientY))); else this.addFile(f, this.point(e.clientX, e.clientY)); } });
    this.registerEvent(this.app.vault.on('modify', f => { if (f instanceof TFile && ['md','pdf'].includes(f.extension.toLowerCase())) { if (this.session?.board.nodes.some(n => n.file === f.path)) this.scheduleRender(); if(this.tab==='library'||this.tab==='tasks')this.renderSidebar(); } }));
    this.registerEvent(this.app.vault.on('create', () => {this.scheduleRender();this.renderSidebar();}));
    this.registerEvent(this.app.vault.on('delete', () => {this.scheduleRender();this.renderSidebar();}));
    this.registerEvent(this.app.vault.on('rename', () => {this.scheduleRender();this.renderSidebar();}));
    this.registerEvent(this.app.metadataCache.on('changed', file => { if(this.tab==='library'||this.tab==='tasks')this.renderSidebar(); if (!this.gesture && !this.marquee && this.session?.board.nodes.some(n => n.file === file.path)) this.scheduleRender(); }));
    this.registerEvent(this.app.vault.on('modify', f => { if (f instanceof TFile && f.extension === EXT && f !== this.file) { if (this.session?.board.nodes.some(n => n.kind === 'board' && n.file === f.path)) this.scheduleRender(); this.renderSidebar(); } }));
  }
  async onLoadFile(file: TFile) {
    ++this.dialogEpoch;this.blankClicks.cancel();this.blankClickOwner=undefined;
    this.tourBar?.remove();this.tourBar=undefined;this.searchModal?.close();this.searchModal=undefined;this.reuseModal?.close();this.reuseModal=undefined;this.savedViewsModal?.close();this.savedViewsModal=undefined;this.groupOrganizer?.close();this.groupOrganizer=undefined;this.layoutPlannerModal?.close();this.layoutPlannerModal=undefined;
    this.finishMarquee(true); this.setSectionTool(false); this.selectionTool = false; this.syncSelectionTool();
    this.viewTrail.clear();this.outlineCollapsed.clear();this.objectFilter={kind:'',color:'',query:''};this.contextOpen=false;this.relatedFocus=undefined;this.relationLens=undefined;this.clearNodes();this.unsubscribe?.(); this.selected.clear(); this.selectedEdge = undefined; this.connectFrom = undefined;this.connectSide=undefined;this.stage?.removeClass('ts-connecting'); this.mode = 'select'; this.connectButton?.removeClass('is-active');
    try {
      const s = await this.plugin.session(file); this.session = s;this.contentEl.querySelectorAll<HTMLElement>('.ts-board-rail,.ts-commandbar,.ts-footer').forEach(el=>el.inert=false); s.listeners.add(this.paint);
      if (!this.svg.isConnected) { this.world.empty(); this.svg = this.world.createSvg('svg', { cls: 'ts-edges' });this.edgeLayer=new EdgeLayer(this.svg,this.markerId,id=>this.labelEdge(id)); }
      this.unsubscribe = () => { s.listeners.delete(this.paint); act(() => this.plugin.release(s)); };
      const legacy=s.board.nodes.filter(n=>n.kind==='text' && n.autoSize===undefined);
      if(legacy.length && !s.blocked)s.change(b=>b.nodes.filter(n=>n.kind==='text' && n.autoSize===undefined).forEach(n=>fitTextNode(n,this.contentEl)));
      this.paint();await this.plugin.ensureDock(false);if(this.app.workspace.getActiveViewOfType(BoardView)===this)this.plugin.currentBoard=this;this.plugin.refreshDock();
    } catch (e) { this.session = undefined;this.contentEl.querySelectorAll<HTMLElement>('.ts-board-rail,.ts-commandbar,.ts-footer').forEach(el=>el.inert=true);this.minimap?.empty();this.inspector?.removeClass('is-visible');this.selectionTools?.empty();this.world.style.removeProperty('transform'); this.world.empty(); this.status.setText('文件无法读取 · 原文件保持不变'); this.world.createDiv({ cls: 'ts-error', text: `无法打开白板：${String(e)}。请检查 JSON 文件或恢复备份。` }); report(e); }
  }
  async onUnloadFile() { ++this.dialogEpoch;this.blankClicks.cancel();this.blankClickOwner=undefined;this.searchModal?.close();this.searchModal=undefined;this.reuseModal?.close();this.reuseModal=undefined;this.savedViewsModal?.close();this.savedViewsModal=undefined;this.groupOrganizer?.close();this.groupOrganizer=undefined;this.layoutPlannerModal?.close();this.layoutPlannerModal=undefined;await this.finishInlineForNavigation(); if(this.plugin.currentBoard===this)this.plugin.clearMaterialDrag();this.clearCanvasGesture();this.clearNodes();this.finishMarquee(true); this.sidebarRun++; this.unsubscribe?.(); this.unsubscribe = undefined; if (this.session) await this.session.flush(); this.session = undefined;this.plugin.refreshDock(); }
  async onClose() { ++this.dialogEpoch;this.blankClicks.cancel();this.blankClickOwner=undefined;this.objectMenu?.hide();this.searchModal?.close();this.searchModal=undefined;this.reuseModal?.close();this.reuseModal=undefined;this.savedViewsModal?.close();this.savedViewsModal=undefined;this.groupOrganizer?.close();this.groupOrganizer=undefined;this.layoutPlannerModal?.close();this.layoutPlannerModal=undefined;await this.finishInlineForNavigation();if(this.plugin.currentBoard===this)this.plugin.clearMaterialDrag();this.clearCanvasGesture();this.closed=true;this.plugin.refreshDock();this.sidebar?.remove(); this.finishMarquee(true); this.sidebarRun++; if (this.sidebarTimer) window.clearTimeout(this.sidebarTimer); this.unsubscribe?.(); (this.contentEl?.ownerDocument?.defaultView||window).cancelAnimationFrame(this.renderFrame);this.clearNodes(); }
  private point(clientX?: number, clientY?: number) {
    const rect = this.stage.getBoundingClientRect(), v = this.requireOwner().board.viewport;
    return { x: ((clientX ?? rect.left + rect.width / 2) - rect.left - v.x) / v.zoom, y: ((clientY ?? rect.top + rect.height / 2) - rect.top - v.y) / v.zoom };
  }
  private mutate(fn: (b: Board) => void) { this.session?.change(fn); }
  async addBoard(file: TFile, position = this.point(), owner = this.session) {
    if (!owner || owner.blocked) throw new Error('当前白板不可编辑');
    await this.plugin.hierarchy(async () => {
      await this.plugin.assertCanNest(owner.file, file);
      const id = uid();
      owner.change(b => b.nodes.push({ id, kind: 'board', file: file.path, x: position.x - 170, y: position.y - 100, width: 340, height: 265, color: 'green' }));
      if (this.session === owner) { this.selected = new Set([id]); this.selectedEdge = undefined; this.updateSelection(); }
      await owner.flush();
    });
  }
  newChildBoard(position = this.point()) {
    if (!this.session || this.session.blocked) return;
    const owner = this.session;
    new Prompt(this.app, '新建子白板', '新的研究主题', async title => {
      if (this.session !== owner) throw new Error('白板已切换，请回到原白板重试');
      const file = await this.plugin.createUnique(`${ROOT}/白板`, title, EXT, JSON.stringify(emptyBoard(), null, 2));
      await this.addBoard(file, position, owner);
      if (!owner.blocked && this.session === owner) await this.enterBoard(file);
    }).open();
  }
  private convertSelection() {
    const owner = this.session, ids = new Set(this.selected); if (!owner || !ids.size || owner.blocked) return;
    const section = owner.board.nodes.find(n => n.kind === 'section' && ids.has(n.id));
    new Prompt(this.app, '转换为子白板', section?.title || '新的子主题', title => this.extractToChild(title, ids, owner).then(() => {})).open();
  }
  async extractToChild(title: string, ids = new Set(this.selected), owner = this.session) {
    if (!owner || owner.blocked) throw new Error('当前白板不可编辑');
    return this.plugin.hierarchy(async () => {
      const before = clone(owner.board), fingerprint = JSON.stringify(before);
      const result = extractSubboard(before, ids, 'pending.thoughtspace', title);
      if(before.nodes.some(n=>n.locked&&!result.parent.nodes.some(remaining=>remaining.id===n.id)))throw new Error('请先解锁对象再转换为子白板');
      // 子白板成功落盘以后才替换父白板；中途失败不移除原卡片。
      const file = await this.plugin.createUnique(`${ROOT}/白板`, title, EXT, JSON.stringify(result.child, null, 2));
      if (owner.blocked || JSON.stringify(owner.board) !== fingerprint) throw new Error(`父白板已经变化，原卡片未移除。已保留复制的子白板：${file.path}`);
      await this.plugin.assertCanNest(owner.file, file);
      if (owner.blocked || JSON.stringify(owner.board) !== fingerprint) throw new Error(`父白板已经变化，原卡片未移除。已保留复制的子白板：${file.path}`);
      result.portal.file = file.path;
      if (this.session === owner) { this.selected = new Set([result.portal.id]); this.selectedEdge = undefined; }
      owner.change(b => Object.assign(b, result.parent), before); await owner.flush();
      new Notice('已转换为子白板，内部连线与对外关系均已保留'); return file;
    });
  }
  tidy() { this.mutate(b => {const old=new Map(b.nodes.filter(n=>n.locked).map(n=>[n.id,{x:n.x,y:n.y,width:n.width,height:n.height}]));tidyBoard(b,this.selected);for(const n of b.nodes){const value=old.get(n.id);if(value)Object.assign(n,value);}});this.fit(); }
  selectTab(tab: 'library' | 'boards' | 'tasks' | 'outline',query?:string) {
    const search=this.sidebar.querySelector<HTMLInputElement>('.ts-search');this.sidebarQueries.set(this.tab,search?.value??this.query);if(query!==undefined)this.sidebarQueries.set(tab,query);const restored=this.sidebarQueries.get(tab)||'';this.query=restored.toLocaleLowerCase();if(search)search.value=restored;const clear=this.sidebar.querySelector<HTMLElement>('.ts-search-clear');if(clear)clear.hidden=!restored;
    this.tab = tab;
    this.sidebar.querySelectorAll<HTMLButtonElement>('.ts-tabs button').forEach((b, i) => {const active=['library','boards','tasks','outline'][i]===tab;b.toggleClass('is-active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    const name={library:'卡片',boards:'白板',tasks:'任务',outline:'大纲'}[tab];if(search){search.setAttribute('aria-label',`搜索${name}`);search.placeholder=`搜索${name}…`;}this.list.setAttribute('aria-label',name);
    this.renderSidebar();this.plugin.currentBoard=this;act(()=>this.plugin.ensureDock(true));
  }
  refreshNavigation(){this.renderNavigation();this.renderSidebar();}
  private renderNavigation() {
    if (!this.crumbs || !this.session) return;
    this.crumbs.empty();this.contentEl.toggleClass('ts-has-trail',this.trail.length>0);

    if(this.favoriteButton&&this.file){const pinned=this.plugin.settings.favoriteBoards.includes(this.file.path),label=pinned?'取消收藏':'收藏白板';this.favoriteButton.toggleClass('is-active',pinned);this.favoriteButton.setAttribute('aria-label',label);this.favoriteButton.setAttribute('title',label);this.favoriteButton.setAttribute('aria-pressed',String(pinned));}
    button(this.crumbs, '白板空间', 'panels-top-left', () => this.selectTab('boards'));
    for (const [index, file] of this.trail.entries()) {
      this.crumbs.createSpan({ text: '/', cls: 'ts-crumb-separator' });
      button(this.crumbs, file.basename, '', () => this.navigate(file, this.trail.slice(0, index)));
    }
    this.crumbs.createSpan({ text: '/', cls: 'ts-crumb-separator' });
    this.crumbs.createSpan({ text: this.file?.basename || '', cls: 'ts-crumb-current' });
    const b = this.session.board;
    this.boardStats.setText(`${b.nodes.filter(n => n.kind === 'card').length} 张卡片  ·  ${b.nodes.filter(n => n.kind === 'board').length} 个子白板  ·  ${b.nodes.filter(n => n.kind === 'text').length} 文本  ·  ${b.nodes.filter(n => n.kind === 'image').length} 图片  ·  ${b.nodes.filter(n => n.kind === 'pdf').length} PDF  ·  ${b.edges.length} 条关系`);
    if (this.trail.length) button(this.crumbs, '返回上级', 'corner-left-up', () => this.navigate(this.trail[this.trail.length - 1], this.trail.slice(0, -1)), 'ts-back-parent');
  }
  private mapPreview(parent: HTMLElement, board: Board, interactive = false) {
    const width = 300, height = 136, visible = board.nodes;
    const map = parent.createSvg('svg', { cls: 'ts-map-svg', attr: { viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' } });
    if (!visible.length) { parent.createSpan({ cls: 'ts-map-empty', text: '一个新的思考空间' }); return; }
    // fitViewport 用于主白板时限制最小缩放，缩略图需要允许更小比例。
    const left = Math.min(...visible.map(n => n.x)), top = Math.min(...visible.map(n => n.y));
    const w = Math.max(...visible.map(n => n.x + n.width)) - left, h = Math.max(...visible.map(n => n.y + n.height)) - top;
    const z = Math.min((width - 24) / w, (height - 24) / h), ox = (width - w * z) / 2 - left * z, oy = (height - h * z) / 2 - top * z;
    const byId=new Map(visible.map(n=>[n.id,n]));
    for (const edge of board.edges) {
      const a = byId.get(edge.from), b = byId.get(edge.to); if (!a || !b) continue;
      map.createSvg('line', { cls: 'ts-map-edge', attr: { x1: (a.x + a.width / 2) * z + ox, y1: (a.y + a.height / 2) * z + oy, x2: (b.x + b.width / 2) * z + ox, y2: (b.y + b.height / 2) * z + oy } });
    }
    for (const n of [...visible].sort((a, b) => Number(a.kind !== 'section') - Number(b.kind !== 'section'))) {
      const rect = map.createSvg('rect', { cls: 'ts-map-node', attr: { x: n.x * z + ox, y: n.y * z + oy, width: n.width * z, height: n.height * z, rx: 3 } });
      rect.classList.add(`ts-color-${n.color}`);if((n.kind==='card'||n.kind==='text')&&n.transparent)rect.classList.add('is-transparent');else if((n.kind==='card'||n.kind==='text')&&n.fillColor&&n.fillColor!=='none')rect.style.fill=n.fillColor.startsWith('#')?n.fillColor:cardFillHex[n.fillColor as Card['color']]; if (n.kind === 'section') rect.classList.add('ts-map-section');
      if (!interactive && n.kind !== 'section' && n.width * z > 58 && n.height * z > 28) {
        const label = map.createSvg('text', { cls: 'ts-map-title', attr: { x: n.x * z + ox + 5, y: n.y * z + oy + 13 } });
        const title = n.title || n.file?.split('/').pop()?.replace(/\.(md|thoughtspace)$/, '') || n.text?.split('\n')[0] || ''; 
        label.textContent = title.length > 9 ? title.slice(0, 8) + '…' : title;
      }
    }
    if (interactive) {
      const v = board.viewport;
      const frame=map.createSvg('rect', { cls: 'ts-map-viewport', attr: { x: -v.x / v.zoom * z + ox, y: -v.y / v.zoom * z + oy, width: this.stage.clientWidth / v.zoom * z, height: this.stage.clientHeight / v.zoom * z } });
      this.mapViewport=()=>{const v=this.session?.board.viewport;if(!v)return;for(const [k,value] of Object.entries({x:-v.x/v.zoom*z+ox,y:-v.y/v.zoom*z+oy,width:this.stage.clientWidth/v.zoom*z,height:this.stage.clientHeight/v.zoom*z})){const text=String(value);if(frame.getAttribute(k)!==text)frame.setAttribute(k,text);}};
      map.onclick = e => {
        if (!this.session || this.session.blocked) return; const v=this.session.board.viewport,r = map.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width * width - ox) / z, y = ((e.clientY - r.top) / r.height * height - oy) / z;
        this.session.board.viewport.x = this.stage.clientWidth / 2 - x * v.zoom; this.session.board.viewport.y = this.stage.clientHeight / 2 - y * v.zoom;
        this.transform(); this.session.persist();
      };
    }
  }
  private renderMinimap() {
    if (!this.minimap || !this.session) return;
    if(!this.plugin.settings.showMinimap){if(this.mapKey)this.minimap.empty();this.mapKey='';this.mapViewport=undefined;return;} const display=visibleBranchBoard(this.session.board);const key=JSON.stringify([display.nodes.map(n=>[n.id,n.x,n.y,n.width,n.height,n.color,n.fillColor,n.transparent]),display.edges.map(e=>[e.from,e.to])]);if(key===this.mapKey){this.mapViewport?.();return;}this.mapKey=key;this.mapViewport=undefined;this.minimap.empty();
    this.minimap.createSpan({ text: '总览', cls: 'ts-map-label' }); this.mapPreview(this.minimap, display, true);
    this.minimap.toggleClass('is-empty', !this.session.board.nodes.length);
  }
  private async importBoardAttachments(files:File[],position=this.point()) {
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    let offset=0;
    for(const input of files.filter(f=>isPdfFile(f.name))) {
      this.requireOwner(owner);const bytes=await input.arrayBuffer();this.requireOwner(owner);
      const path=await this.app.fileManager.getAvailablePathForAttachment(input.name,owner.file.path);this.requireOwner(owner);
      const file=await this.app.vault.createBinary(path,bytes);
      if(this.session!==owner||this.closed||owner.blocked){new Notice(`PDF 已保存：${file.path}；白板已切换，未添加卡片`);return;}
      this.addFile(file,{x:position.x+offset,y:position.y+offset});offset+=32;
    }
    const images=files.filter(f=>isImage(f.name));if(images.length){this.requireOwner(owner);await this.importImages(images,{x:position.x+offset,y:position.y+offset});}
  }
  async insertPdfCard(position=this.point(),initial?:TFile,page=1) {
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    const accept=(file:TFile)=>{this.requireOwner(owner);if(this.app.vault.getAbstractFileByPath(file.path)!==file||!isPdfFile(file.path)||!isWorkspaceFile(file))throw Error('PDF 已移动或删除，请重新选择');this.addFile(file,position,page);this.contextOpen=false;this.updateSelection();this.stage.focus();};
    if(initial){accept(initial);return;}new ReadingSourcePicker(this.app,accept,true).open();
  }
  async insertExistingNote(position=this.point()) {
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    const picker=new NotePicker(this.app,file=>{
      this.requireOwner(owner);
      if(this.app.vault.getAbstractFileByPath(file.path)!==file||!(file.extension==='md'||isPdfFile(file.path))||!isWorkspaceFile(file))throw Error('笔记已移动或删除，请重新选择');
      this.addFile(file,position);this.contextOpen=false;this.updateSelection();this.stage.focus();
    },'插入 Markdown 笔记或 PDF · 搜索名称或路径…',true);
    picker.setInstructions([{command:'↑ ↓',purpose:'选择笔记'},{command:'↵',purpose:'插入白板'},{command:'esc',purpose:'取消'}]);picker.open();return picker;
  }
  private addFile(file: TFile, position = this.point(),page=1) {
    if (!this.session) return;
    if(isPdfFile(file.path)){const id=uid();this.selected=new Set([id]);this.selectedEdge=undefined;this.mutate(b=>{b.version=3;b.nodes.push({...pdfCard(id,file.path,position.x,position.y,this.plugin.settings.defaultCardWidth),pdfPage:pdfPage(page)});});return;}
    if(file.extension!=='md')throw Error('仅支持 Markdown 笔记或 PDF 卡片');
    const id = uid(); this.selected = new Set([id]); this.selectedEdge = undefined;
    this.mutate(b => b.nodes.push({ id, kind:'card',transparent:true, file: file.path, x: position.x - this.plugin.settings.defaultCardWidth/2, y: position.y - 70, width: this.plugin.settings.defaultCardWidth, height: 270, color: 'sand', autoFit:true,preferredWidth:this.plugin.settings.defaultCardWidth }));
  }
  private async newCard(position = this.point()) {
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;
    const file=await this.plugin.createUnique(this.plugin.settings.cardFolder,'未命名笔记','md','');
    if(this.session!==owner||this.closed||owner.blocked){new Notice(`笔记已创建：${file.path}；原白板已切换，未添加引用`);return;}
    this.addFile(file,position);const id=[...this.selected][0];await this.startInlineEdit(id,false,true);
  }
  toggleMindmap(){this.mutate(b=>{b.version=3;b.mode=b.mode==='mindmap'?'free':'mindmap';});}
  get hasInlineEditor(){return !!this.inline;}
  async prepareVideoBridge(){if(this.inline&&!await this.inline.commit())throw Error('请先处理白板编辑草稿后再打开播放器联动');}
  async addNotesFromHub(paths:string[],owner=this.session){
    this.requireOwner(owner);
    for(const path of paths){const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile)||file.extension!=='md'||!isWorkspaceFile(file))throw Error('笔记已移动或删除，请刷新总览');}
    const draft=clone(owner!.board),position=this.point();
    // Put imported notes beside existing material instead of covering it.
    for(const node of draft.nodes)if(node.kind!=='section')position.x=Math.max(position.x,node.x+node.width+48);
    const ids=addHubNotes(draft,paths,position,this.plugin.settings.defaultCardWidth,uid);
    if(!ids.length)return 0;
    owner!.change(()=>{owner!.board=draft;});this.selected=new Set(ids);this.contextOpen=false;this.updateSelection();this.revealNode(ids[0]);await owner!.flush();return ids.length;
  }
  private requireOwner(owner=this.session){if(!owner||this.closed||this.session!==owner||owner.blocked)throw new Error('白板已切换或暂停写入，请回到原白板重试');return owner;}
  private canCreateBlankText(e:MouseEvent){return !!this.session&&!this.closed&&!this.session.blocked&&!this.blankTextCreating&&!this.inlineExit&&!this.space&&!this.sectionTool&&this.mode!=='connect'&&e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&(e.target===this.stage||e.target===this.world||e.target===this.svg);}
  private async blankDoubleClick(e:MouseEvent){
    const clean=this.blankClicks.consume();
    if(!clean||this.blankClickOwner!==this.session||!this.canCreateBlankText(e)||this.gesture||this.marquee||this.rightMarquee||this.linkDrag)return;
    e.preventDefault();e.stopPropagation();this.blankTextCreating=true;
    try{await this.newText(this.point(e.clientX,e.clientY));}finally{this.blankTextCreating=false;}
  }
  async newText(position=this.point(),topic=false){const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    const id=uid();owner.change(b=>{b.version=3;if(topic)b.mode='mindmap';const node:Card={id,kind:'text',text:topic?'中心主题':'',topic,...(topic?{mindmapRules:{layout:b.mindmapLayout||'right',density:b.mindmapDensity||'standard',automatic:true} as NonNullable<Card['mindmapRules']>}:{}),x:position.x-40,y:position.y-30,width:80,height:60,color:topic?'green':'sand',fontSize:this.plugin.settings.defaultTextSize,autoSize:true};fitTextNode(node,this.contentEl);b.nodes.push(node);});this.selected=new Set([id]);this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();await this.startInlineEdit(id,topic,true);
  }
  async newTable(position=this.point()){
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    const template=markdownEdit('',0,0,'table'),id=uid();
    owner.change(b=>{b.version=3;b.nodes.push({id,kind:'text',text:template.text,x:position.x-40,y:position.y-30,width:520,height:180,textMaxWidth:720,color:'sand',fontSize:this.plugin.settings.defaultTextSize,autoSize:true});});
    this.selected=new Set([id]);this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();await this.startInlineEdit(id,false,true);
    if(this.session===owner&&this.inlineId===id)this.inline?.input.setSelectionRange(template.start,template.end);
  }
  editText(id:string){act(()=>this.startInlineEdit(id));}
  async prepareNoteOpen(file:TFile){if(this.inline&&this.session?.board.nodes.find(n=>n.id===this.inlineId)?.file===file.path&&!await this.inline.commit())throw Error('白板编辑草稿与原文冲突，草稿已保留。请先处理后再打开原生编辑器。');}
  private endInline(){this.inline?.dispose();this.inline=undefined;this.inlineId=undefined;this.inlineTarget=undefined;this.inlineStyleKey='';this.inlineMeasureKey='';this.inlineGeometry=undefined;this.inlineLayout=undefined;this.renderBoard();}
  private finishInlineForNavigation():Promise<void>{
    if(this.inlineExit)return this.inlineExit;
    this.inlineStart++;const editor=this.inline;if(!editor)return Promise.resolve();
    // Both file-unload and view-close can enter here. One draft has one exit operation.
    const exiting=Promise.resolve().then(async()=>{
      if(await editor.commit())return;
      if(editor.dirty){
        const recovered=await editor.backup(async value=>{
          const draft=await this.plugin.createUnique(`${this.plugin.settings.cardFolder}/恢复草稿`,'白板编辑草稿','md',value);
          new Notice(`原文未覆盖，编辑草稿已保存到 ${draft.path}`);
        });
        if(!recovered)throw Error('草稿备份失败，编辑内容仍保留；请复制草稿后重试退出。');
      }
      if(this.inline===editor)this.endInline();
    });
    this.inlineExit=exiting;
    const release=()=>{if(this.inlineExit===exiting)this.inlineExit=undefined;};
    void exiting.then(release,release);return exiting;
  }
  private async startInlineEdit(id:string,selectAll=false,preserveViewport=false){
    if(this.inlineExit)return;
    const request=++this.inlineStart,owner=this.requireOwner();
    if(this.inlineId===id&&this.inline&&!this.inline.saving){this.inline.input.focus({preventScroll:true});return;}
    const previous=this.inline;if(previous&&!await previous.commit())return;
    if(request!==this.inlineStart)return;this.requireOwner(owner);let node=owner.board.nodes.find(n=>n.id===id);
    if(!node||!['text','card'].includes(node.kind))return;if(node.locked)throw Error('对象已锁定，请先解锁再编辑');
    const kind=node.kind,file=kind==='card'?this.app.vault.getAbstractFileByPath(node.file!):undefined;if(kind==='card'&&!(file instanceof TFile))throw Error('原笔记不存在，请先重新关联');
    let original:string;
    try{original=file instanceof TFile?await readCurrentNativeNote(this.app,file):node.text||'';}
    catch(error){if(request!==this.inlineStart||this.closed)return;throw error;}
    if(request!==this.inlineStart)return;this.requireOwner(owner);const latest=owner.board.nodes.find(n=>n.id===id);if(!latest||latest.locked||latest.kind!==kind)throw Error('对象已变化，请重新打开编辑');
    if(file instanceof TFile&&(latest.file!==file.path||this.app.vault.getAbstractFileByPath(file.path)!==file))throw Error('关联笔记已改变，请重新打开卡片编辑');
    node=latest;
    this.inlineTarget=id;this.selected=new Set([id]);this.selectedEdge=undefined;this.contextOpen=false;
    if(node.collapsed)owner.change(b=>foldCards(b,new Set([id]),false));
    if(preserveViewport){
      // Creation owns selection and focus, but must not pan or zoom the canvas.
      // Keep a new object visible after its temporary editing pin is released.
      if(branchState(owner.board).hidden.has(id))owner.change(b=>unfoldAncestors(b,id));
      this.clearCanvasGesture();this.app.workspace.setActiveLeaf(this.leaf,{focus:true});
      this.mode='select';this.connectFrom=undefined;this.connectSide=undefined;this.stage.removeClass('ts-connecting');this.connectButton?.removeClass('is-active');this.updateSelection();
    }else{if(owner.board.viewport.zoom<.75)owner.board.viewport.zoom=.9;this.revealNode(id);}
    this.renderBoard();const el=this.positions.get(id);if(!el){this.inlineTarget=undefined;return;}
    this.pendingFits.delete(id);this.inlineStyleKey=this.nodeAppearanceKey(node);this.inlineMeasureKey=this.nodeMeasureKey(node);let editor:InlineNodeEditor;let draftSize:{width:number;height:number}|undefined;let lastDraftValue=original;
    const cardFit=node.kind==='card'&&node.autoFit?new InlineCardFit(this.app,el.querySelector<HTMLElement>('.ts-card-preview')!,file!.path,node.preferredWidth,size=>{draftSize=size;if(this.session===owner)this.applyInlineSize(id,size);editor?.syncGeometry();}):undefined;
    let editHeight=0;
    const applyTextSize=()=>{const current=owner.board.nodes.find(n=>n.id===id);if(this.session!==owner||this.closed||owner.blocked||this.inlineTarget!==id||current?.kind!=='text'||current.locked)return;const size=draftSize??current;this.applyInlineSize(id,{width:size.width,height:Math.max(size.height,editHeight)});editor?.syncGeometry();};
    const textFit=node.kind==='text'?new InlineTextFit(this.app,el.querySelector<HTMLElement>('.ts-text-body')!,owner.file.path,()=>owner.board.nodes.find(n=>n.id===id),size=>{draftSize=size;applyTextSize();}):undefined;
    const end=()=>{if(this.inline===editor){const doc=this.contentEl.ownerDocument,restore=editor.el.contains(doc.activeElement)||doc.activeElement===doc.body;this.endInline();if(restore)this.stage.focus();}};
    editor=new InlineNodeEditor(el,{createLinkedNote:(name,source)=>this.plugin.createConceptLinkNote(name,source),app:this.app,file:file instanceof TFile?file:undefined,contextFile:owner.file,nodeKind:kind==='text'?'text':'card',value:original,label:node.kind==='text'?'编辑白板 Markdown':'编辑卡片 Markdown',selectAll,continueTopic:node.kind==='text'&&owner.board.mode==='mindmap'?sibling=>this.addTopic(sibling,id):undefined,placeholder:'写下内容，支持 Markdown、公式和表格…',markdown:true,focusWithin:active=>!!active&&!!this.selectionTools?.closest('.ts-floating-formatbar')?.contains(active),
      temporaryHeight:kind==='text'?height=>{if(Number.isFinite(height)&&height>=60&&height<=1200&&height!==editHeight){editHeight=height;applyTextSize();}}:undefined,
      resize:(value,_input,appearanceChanged)=>{const current=owner.board.nodes.find(n=>n.id===id);if(!current)return;if(node.kind==='text'){textFit?.schedule(value,appearanceChanged);}else if(value!==lastDraftValue||appearanceChanged){lastDraftValue=value;cardFit?.schedule(value,appearanceChanged);}},
      dispose:()=>{cardFit?.dispose();textFit?.dispose();},
      cancel:end,
      save:async value=>{
        textFit?.schedule(value);await textFit?.flush();
        const validate=()=>{this.requireOwner(owner);const current=owner.board.nodes.find(n=>n.id===id);
          if(!current||current.locked||current.kind!==kind)throw Error('对象已改变，草稿保留；请复制后重新编辑');
          if(value!==original&&file instanceof TFile&&(current.file!==file.path||this.app.vault.getAbstractFileByPath(file.path)!==file))throw Error('关联笔记已改变，未写入原文件');
          return current;
        };
        const current=validate(),sizeBefore={width:current.width,height:current.height,appearance:this.nodeAppearanceKey(current)};
        if(value!==original){if(file instanceof TFile)await writeNativeNoteDraft(this.app,file,original,value,validate);
          else{if(current.text!==original)throw Error('原文本已变化，未覆盖。请复制草稿后重新编辑');owner.change(b=>{const n=b.nodes.find(n=>n.id===id)!;n.text=value;if(draftSize)Object.assign(n,draftSize);else fitTextNode(n,this.contentEl);});}}
        // Content is committed. A changed/removed card must not receive an old draft size.
        const latest=owner.board.nodes.find(n=>n.id===id);
        if(draftSize&&Number.isFinite(draftSize.width)&&Number.isFinite(draftSize.height)&&draftSize.width>=80&&draftSize.height>=60&&value!==original&&this.session===owner&&!this.closed&&!owner.blocked&&latest?.kind===kind&&!latest.locked&&latest.autoFit&&latest.file===file?.path&&latest.width===sizeBefore.width&&latest.height===sizeBefore.height&&this.nodeAppearanceKey(latest)===sizeBefore.appearance){
          const size=draftSize;
          if(latest.width!==size.width||latest.height!==size.height)owner.change(b=>Object.assign(b.nodes.find(n=>n.id===id)!,size),clone(owner.board),false,false);
        }
        end();
      }
    });this.inline=editor;this.inlineId=id;this.inlineAppearance=false;this.renderSelectionTools();
    editor.input.dispatchEvent(new Event('input'));
  }
  promptTextToNote(id:string){const owner=this.session,n=owner?.board.nodes.find(n=>n.id===id);if(!n||n.kind!=='text')return;new Prompt(this.app,'转换为笔记',suggestedNoteName(n.text||''),title=>this.textToNote(id,title,owner).then(()=>{})).open();}
  async textToNote(id:string,title:string,owner=this.session){
    const conversions=this.requireOwner(owner).convertingTexts;
    if(conversions.has(id))throw new Error('此文本正在转换，请稍候');
    conversions.add(id);
    try{
      const initial=owner!.board.nodes.find(n=>n.id===id);
      if(!initial||initial.kind!=='text')throw new Error('请选择一个文本框');
      if(initial.locked)throw new Error('请先解锁文本框');
      if(this.inline&&!await this.inline.commit())throw new Error('请先处理编辑保存冲突，再转换为笔记');
      this.requireOwner(owner);
      const node=owner!.board.nodes.find(n=>n.id===id);
      if(!node||node.kind!=='text'||node.locked)throw new Error('文本框已锁定或变化，请重新选择');
      const original=node.text||'';
      const file=await this.plugin.createUnique(this.plugin.settings.cardFolder,title,'md',excerptNoteMarkdown(original));
      if(this.plugin.settings.autoFileCards){try{const tags=await this.plugin.waitNoteTags(file);if(this.plugin.settings.autoFileCards&&tags.length)await this.plugin.fileCard(file,tags[0]);}catch(e){new Notice(String(e));}}
      const current=owner!.board.nodes.find(n=>n.id===id);
      if(this.session!==owner||this.closed||owner!.blocked||!current||current.locked||current.kind!=='text'||current.text!==original)throw new Error(`文本或白板已变化，文本框保留；笔记另存为 ${file.path}`);
      owner!.change(b=>{const n=b.nodes.find(n=>n.id===id)!;n.kind='card';n.transparent=true;n.file=file.path;delete n.text;delete n.textColor;delete n.fontSize;delete n.fontFamily;delete n.textAlign;delete n.autoSize;delete n.textMaxWidth;n.width=Math.max(280,n.width);n.height=Math.max(220,n.height);});await owner!.flush();
      if(owner!.blocked)throw new Error(`笔记已创建，但白板保存失败，请先处理保存冲突：${file.path}`);
      const saved=owner!.board.nodes.find(n=>n.id===id);
      if(this.session===owner&&!this.closed&&saved?.kind==='card'&&saved.file===file.path)await this.plugin.openNoteInSidebar(file);
      return file;
    }finally{conversions.delete(id);}
  }
  async addTopic(sibling=false,sourceId?:string){
    if(this.topicAdding)return;this.topicAdding=true;
    try{const owner=this.requireOwner(),selectedId=sourceId||[...this.selected][0];if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
      const selected=owner.board.nodes.find(n=>n.id===selectedId);if(!selected||selected.kind==='section'){new Notice('请先选中一个主题；也可以点击“中心主题”开始');return;}
      const parents=validateBranches(owner.board);if(sibling&&!parents.has(selected.id))sibling=false;
      const result=editTopic(owner.board,selected.id,sibling?'sibling':'child',[sibling?'同级主题':'子主题'],uid,{prepareNode:node=>{node.autoSize=true;node.textMaxWidth=280;node.fontSize=this.plugin.settings.defaultTextSize;fitTextNode(node,this.contentEl);},deferAutomaticLayout:true}),node=result.board.nodes.find(n=>n.id===result.selected)!;
      owner.change(()=>{owner.board=result.board;});this.selected=new Set([node.id]);this.selectedEdge=undefined;this.contextOpen=false;await this.startInlineEdit(node.id,true,true);
    }finally{this.topicAdding=false;}
  }
  layoutTopics(direction:'right'|'down'|'up'){const owner=this.session;if(!owner)return;const n=owner.board.nodes.find(n=>this.selected.has(n.id)&&n.kind!=='section')||owner.board.nodes.find(n=>n.topic);if(!n){new Notice('请先选择一个主题，或新建中心主题');return;}owner.change(b=>layoutMindmap(b,n.id,direction));this.fit();}
  styleEdge(id:string){const owner=this.session,edge=owner?.board.edges.find(e=>e.id===id);if(!edge)return;const before=JSON.stringify(edge);new EdgeModal(this.app,edge,draft=>{this.requireOwner(owner);const current=owner!.board.edges.find(e=>e.id===id);if(!current||JSON.stringify(current)!==before)throw new Error('连线已变化，请重新打开样式面板');owner!.change(b=>{b.version=3;Object.assign(b.edges.find(e=>e.id===id)!,draft);for(const key of ['color','fromSide','toSide'] as const)if(draft[key]===undefined)delete b.edges.find(e=>e.id===id)![key];});}).open();}
  imageMenu(position=this.point()){
    const owner=this.session;const menu=new Menu().setUseNativeMenu(false);
    menu.addItem(i=>i.setTitle('选择仓库中的图片').setIcon('image').onClick(()=>new ImagePicker(this.app,f=>{this.requireOwner(owner);this.addImage(f,position);}).open()));
    menu.addItem(i=>i.setTitle('从电脑导入图片…').setIcon('upload').onClick(()=>{const input=this.contentEl.ownerDocument.createDocumentFragment().createEl('input');input.type='file';input.accept='.png,.jpg,.jpeg,.gif,.webp,.avif,.bmp';input.multiple=true;input.onchange=()=>act(()=>{this.requireOwner(owner);return this.importImages(Array.from(input.files||[]),position,owner);});input.click();}));
    const r=this.stage.getBoundingClientRect(),v=this.session!.board.viewport;menu.showAtPosition({x:Math.min(r.right-240,Math.max(r.left,position.x*v.zoom+v.x+r.left)),y:Math.min(r.bottom-100,Math.max(r.top,position.y*v.zoom+v.y+r.top))});
  }
  addImage(file:TFile,position=this.point(),size={width:320,height:240},imageUrl?:string){this.requireOwner();const fitted=mediaDimensions(size.width,size.width,size.height);if(!fitted)throw Error('图片尺寸无效');size=fitted;if(imageUrl&&!remoteImageUrl(imageUrl))throw Error('图床地址无效');if(!isImage(file.path))throw new Error('请选择支持的图片文件');const id=uid();this.selected=new Set([id]);this.selectedEdge=undefined;this.mutate(b=>{b.version=3;b.nodes.push({id,kind:'image',file:file.path,...(imageUrl?{imageUrl}:{}),x:position.x-size.width/2,y:position.y-size.height/2,width:size.width,height:size.height,color:'blue'});});}
  private hostedUploads=new Set<string>();
  async uploadExistingImage(nodeId:string){
    const owner=this.requireOwner(),node=owner.board.nodes.find(n=>n.id===nodeId);
    if(!node||node.kind!=='image'||this.hostedUploads.has(nodeId))return;if(node.locked)throw Error('请先解锁图片');
    const file=this.app.vault.getAbstractFileByPath(node.file!);if(!(file instanceof TFile))throw Error('本地图片不存在');
    const originalPath=file.path,originalUrl=node.imageUrl,boardPath=this.file!.path;this.hostedUploads.add(nodeId);
    try{const bytes=await this.app.vault.readBinary(file);this.requireOwner(owner);
      const url=await uploadHostedImage(this.app,bytes,file.name,boardPath);
      this.requireOwner(owner);const current=owner.board.nodes.find(n=>n.id===nodeId);
      if(!current||current.kind!=='image'||current.file!==originalPath||current.imageUrl!==originalUrl)throw Error('图片引用已变化，本地图片保留，云端结果未覆盖当前内容');
      owner.change(b=>{b.nodes.find(n=>n.id===nodeId)!.imageUrl=url;});new Notice('已上传到极速图床，本地图片已保留');
    }finally{this.hostedUploads.delete(nodeId);}
  }
  private imageImportBusy=false;
  async importImages(files:File[],position=this.point(),owner=this.session){this.requireOwner(owner);if(this.imageImportBusy)throw Error('正在导入图片，请稍候');this.imageImportBusy=true;try{let imported=0;const hosting=this.plugin.settings.imageHostEnabled===true;
    for(const file of files){if(!isImage(file.name)){new Notice(`不支持的图片类型：${file.name}`);continue;}if(file.size>20*1024*1024){new Notice(`图片超过 20 MB：${file.name}`);continue;}
      const bytes=await file.arrayBuffer();const url=URL.createObjectURL(new Blob([bytes]));let width=320,height=240;
      try{const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error(`图片无法解码：${file.name}`));img.src=url;});if(!img.naturalWidth||!img.naturalHeight)throw new Error('图片尺寸无效');height=Math.max(80,Math.min(480,width*img.naturalHeight/img.naturalWidth));}finally{URL.revokeObjectURL(url);}
      this.requireOwner(owner);const folder=`${ROOT}/附件`;await this.plugin.folder(folder);this.requireOwner(owner);const extension=file.name.split('.').pop()!.toLowerCase(),name=safeName(file.name.replace(/\.[^.]+$/,''));let path=`${folder}/${name}.${extension}`,i=1;
      while(this.app.vault.getAbstractFileByPath(path))path=`${folder}/${name} ${i++}.${extension}`;
      const saved=await this.app.vault.createBinary(path,bytes);if(this.session!==owner||this.closed||owner?.blocked)throw new Error(`白板已切换，图片保留在 ${saved.path}，请重新引用`);
      let imageUrl:string|undefined;if(hosting){new Notice('正在通过极速图床上传图片…');try{imageUrl=await uploadHostedImage(this.app,bytes,file.name,this.file!.path,file.type);}catch(e){new Notice(`${e instanceof Error?e.message:'上传失败'}；已保留本地图片`);}this.requireOwner(owner);}
      this.addImage(saved,{x:position.x+imported*35,y:position.y+imported*35},{width,height},imageUrl);imported++;
    }
    if(imported)new Notice(`已添加 ${imported} 张图片，可拖动、缩放和连线`);
    }finally{this.imageImportBusy=false;}
  }
  private setSectionTool(active:boolean){
    if(active)this.cancelConnection();
    this.sectionTool=active;this.sectionButton?.toggleClass('is-active',active);this.sectionButton?.setAttribute('aria-pressed',String(active));
    this.stage?.toggleClass('ts-section-tool-active',active);this.sectionHint?.toggleClass('is-visible',active);
  }
  private sectionAction(){
    if(!this.session||this.session.blocked)return;
    const active=!this.sectionTool;this.clearCanvasGesture();
    if(this.session.board.nodes.some(n=>this.selected.has(n.id)&&n.kind!=='section')){this.newSection();return;}
    this.toggleSectionTool(active);
  }
  private toggleSectionTool(active=!this.sectionTool){
    if(!this.session||this.session.blocked)return;
    this.clearCanvasGesture();
    this.contextOpen=false;this.selectionTool=false;this.syncSelectionTool();this.mode='select';this.connectFrom=undefined;this.connectSide=undefined;
    this.stage.removeClass('ts-connecting');this.connectButton?.removeClass('is-active');this.setSectionTool(active);this.updateSelection();this.stage.focus();
  }
  private newSection(p = this.point(),rect?:SectionRect) {
    const owner=this.session;if(!owner||owner.blocked)return;
    const ids=new Set(this.selected);
    new Prompt(this.app,'命名分组框','新的主题',title=>{
      this.requireOwner(owner);
      const nodes=owner.board.nodes.filter(n=>ids.has(n.id)&&n.kind!=='section');
      const bounds=rect||sectionBounds(nodes)||{x:p.x-250,y:p.y-150,width:560,height:400};
      if(!validSectionRect(bounds))throw new Error('分组框尺寸无效，请重新绘制');
      const id=uid();owner.change(b=>b.nodes.unshift({id,kind:'section',title:title.trim().slice(0,100),...bounds,color:'blue'}));
      this.selected=new Set([id]);this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();
    }).open();
  }
  private renameSection(id:string){
    const owner=this.session,node=owner?.board.nodes.find(n=>n.id===id&&n.kind==='section');if(!owner||!node||node.locked||owner.blocked)return;
    const previous=node.title;
    new Prompt(this.app,'重命名分组框',previous||'',title=>{
      this.requireOwner(owner);const current=owner.board.nodes.find(n=>n.id===id&&n.kind==='section');
      if(!current||current.locked||current.title!==previous)throw new Error('分组框已改变，请重新打开重命名');
      owner.change(()=>{current.title=title.trim().slice(0,100);});
    }).open();
  }
  private zoom(factor: number, clientX?: number, clientY?: number) {
    if (!this.session || this.session.blocked) return;
    const p = this.point(clientX, clientY), v = this.session.board.viewport;
    const next = Math.min(2.5, Math.max(.15, v.zoom * factor)); v.x += p.x * (v.zoom - next); v.y += p.y * (v.zoom - next); v.zoom = next;
    this.transform(); this.session.persist();
  }
  fit() { if (!this.session || this.session.blocked || !this.stage.clientWidth || !this.stage.clientHeight) return; this.rememberViewport();this.session.board.viewport = fitViewport(visibleBranchBoard(this.session.board).nodes, this.stage.clientWidth, Math.max(200, this.stage.clientHeight - 85)); this.transform(); this.session.persist(); }
  private updateBackToContent(){
    const original=this.session?.board,control=this.backToContent;if(!original||!control)return;
    const b=visibleBranchBoard(original);
    // All nodes share one viewport; avoid repeated layout reads while offscreen.
    const rect=b.nodes.length?viewportRect(b.viewport,this.stage.clientWidth,this.stage.clientHeight,0):undefined;
    const visible=!!rect&&!b.nodes.some(n=>intersects(n,rect));
    if(control.classList.contains('is-visible')!==visible)control.toggleClass('is-visible',visible);
  }
  private transform() {
    if(!this.session||this.closed)return;
    // Pan/zoom inputs update the camera immediately, but commit DOM and the visible
    // node window together once per animation frame, including the minimap frame.
    this.scheduleRender(true);
  }
  private sourcePopover?:HTMLElement;private sourcePopoverClose?:()=>void;
  private sourceFile(note:TFile,source:ExcerptSource){const target=sourceLinkTarget(source.link),parts=parseLinktext(target);return{file:this.app.metadataCache.getFirstLinkpathDest(parts.path,note.path),subpath:parts.subpath};}
  async openExcerptSource(note:TFile,source:ExcerptSource){
    const target=this.sourceFile(note,source);if(!(target.file instanceof TFile))throw Error('找不到来源文件，原始引用仍保留在摘录笔记中');
    const leaf=await this.plugin.openNoteInSidebar(target.file,target.subpath);
    if(source.line&&leaf.view instanceof MarkdownView){const editor=leaf.view.editor,pos={line:Math.min(editor.lineCount()-1,source.line-1),ch:0};editor.setCursor(pos);editor.scrollIntoView({from:pos,to:pos},true);}
  }
  private addSourceBadge(footer:HTMLElement,note:TFile,sources:ExcerptSource[],scope:Component){
    const trigger=button(footer,`摘录来源（${sources.length}）`,'link',()=>{if(popover?.isConnected)close();else show();},'ts-source-trigger');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.title=sources.map(s=>`${this.sourceFile(note,s).file?.basename||sourceLinkTarget(s.link)} · ${s.location}`).join('\n');
    let popover:HTMLElement|undefined,timer:number|undefined;const cancel=()=>{if(timer!==undefined)(footer.ownerDocument.defaultView||window).clearTimeout(timer);timer=undefined;};
    const close=()=>{cancel();footer.ownerDocument.removeEventListener('keydown',onEscape,true);footer.ownerDocument.removeEventListener('pointerdown',onOutside,true);popover?.remove();if(this.sourcePopover===popover){this.sourcePopover=undefined;this.sourcePopoverClose=undefined;}popover=undefined;trigger.setAttribute('aria-expanded','false');};
    const later=()=>{cancel();timer=(footer.ownerDocument.defaultView||window).setTimeout(close,180);};
    const show=()=>{cancel();if(popover?.isConnected)return;this.sourcePopoverClose?.();const doc=footer.ownerDocument,win=doc.defaultView!;popover=doc.body.createDiv({cls:'ts-source-popover',attr:{role:'dialog','aria-label':'摘录来源'}});this.sourcePopover=popover;this.sourcePopoverClose=close;themeSurface(popover);trigger.setAttribute('aria-expanded','true');doc.addEventListener('keydown',onEscape,true);doc.addEventListener('pointerdown',onOutside,true);
      const header=popover.createDiv('ts-source-popover-title');header.createSpan({text:`${sources.length} 条摘录来源`});button(header,'关闭来源','x',close,'ts-icon-button');
      const list=popover.createDiv('ts-source-list');for(const source of sources){const target=this.sourceFile(note,source),row=list.createDiv('ts-source-row');button(row,`${target.file?.basename||sourceLinkTarget(source.link)} · ${source.location}`,'arrow-up-right',()=>this.openExcerptSource(note,source),'ts-source-open');
        const actions=row.createDiv('ts-source-actions');button(actions,'同源摘录','layers',()=>{close();return this.selectSourceExcerpts(note,source);});button(actions,'复制来源','copy',async()=>{await win.navigator.clipboard.writeText(source.citation);new Notice('已复制来源引用');});}
      popover.onpointerenter=cancel;popover.onpointerleave=later;popover.addEventListener('focusin',cancel);popover.addEventListener('focusout',e=>{if(!popover?.contains(e.relatedTarget as Node)&&e.relatedTarget!==trigger)later();});
      const r=trigger.getBoundingClientRect(),w=Math.min(340,win.innerWidth-24);popover.style.width=w+'px';popover.style.maxHeight=Math.max(100,win.innerHeight-24)+'px';const h=popover.getBoundingClientRect().height;popover.style.left=Math.max(12,Math.min(win.innerWidth-w-12,r.left))+'px';popover.style.top=Math.max(12,r.top-h-8)+'px';
    };
    trigger.onpointerdown=e=>e.stopPropagation();trigger.ondblclick=e=>e.stopPropagation();trigger.onpointerenter=show;trigger.onpointerleave=later;trigger.onfocus=show;trigger.onblur=e=>{if(!popover?.contains(e.relatedTarget as Node))later();};
    const onEscape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&popover){e.stopPropagation();close();}};
    const onOutside=(e:PointerEvent)=>{if(popover&&!popover.contains(e.target as Node)&&!trigger.contains(e.target as Node))close();};scope.register(close);
  }
  async selectSourceExcerpts(note:TFile,source:ExcerptSource){
    const owner=this.requireOwner(),target=this.sourceFile(note,source).file;if(!(target instanceof TFile))throw Error('找不到来源文件');
    const cards=owner.board.nodes.filter(n=>n.kind==='card'),files=[...new Set(cards.map(n=>n.file!))],paths=new Set<string>();
    // Bound concurrent reads; retain only matching paths rather than a second vault content cache.
    for(let i=0;i<files.length;i+=4){this.requireOwner(owner);await Promise.all(files.slice(i,i+4).map(async path=>{const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile))return;const raw=await this.app.vault.cachedRead(file);if(excerptPresentation(raw).sources.some(s=>this.sourceFile(file,s).file===target))paths.add(path);}));}
    this.requireOwner(owner);this.selected=new Set(owner.board.nodes.filter(n=>n.kind==='card'?paths.has(n.file!):n.kind==='text'&&textExcerptPresentation(n.text||'').sources.some(s=>this.sourceFile(owner.file,s).file===target)).map(n=>n.id));unfoldRelationAncestors(owner.board,this.selected);this.contextOpen=false;this.relatedFocus=undefined;this.objectFilter={kind:'',color:'',query:''};this.renderBoard();this.focusSelection();new Notice(`已选中 ${this.selected.size} 张同源摘录`);return this.selected.size;
  }
  async mergeConcept(ids:ReadonlySet<string>,title:string){
    const owner=this.requireOwner(),nodes=owner.board.nodes.filter(n=>ids.has(n.id));if(nodes.length<2||nodes.length>50||nodes.some(n=>n.kind!=='card'))throw Error('请选择 2–50 张笔记卡片');
    const files=[...new Set(nodes.map(n=>n.file!))].map(path=>this.app.vault.getAbstractFileByPath(path));if(files.some(f=>!(f instanceof TFile)))throw Error('有原笔记不存在，请先修复引用');if(files.length<2)throw Error('请选择至少两篇不同的笔记');
    const snapshots:{file:TFile;path:string;raw:string;body:string;link:string;title:string}[]=[];let size=0;
    for(const f of files as TFile[]){this.requireOwner(owner);const raw=await this.app.vault.read(f);size+=raw.length;if(raw.length>100000||size>500000)throw Error('内容较长，请分组整理（单篇上限 100,000 字符，总计 500,000）');const cache=this.app.metadataCache.getFileCache(f);if(!cache)throw Error('笔记索引未就绪，请稍后再试');const refs=[...(cache.links||[]),...(cache.embeds||[])].flatMap(ref=>{const parts=parseLinktext(ref.link),target=parts.path?this.app.metadataCache.getFirstLinkpathDest(parts.path,f.path):f;if(!(target instanceof TFile))return[];let replacement=this.app.fileManager.generateMarkdownLink(target,`${this.plugin.settings.cardFolder}/概念.md`,parts.subpath,ref.displayText);if(ref.original.startsWith('!')&&!replacement.startsWith('!'))replacement='!'+replacement;return[{original:ref.original,replacement,start:ref.position.start,end:ref.position.end}];});
      const normalized=raw.replace(/\r\n?/g,'\n'),body=normalized.trim()?rebaseFragment(normalized,selectionFragment(normalized,0,normalized.length),refs):'';snapshots.push({file:f,path:f.path,raw,body,link:this.app.fileManager.generateMarkdownLink(f,`${this.plugin.settings.cardFolder}/概念.md`),title:f.basename});}
    const ensure=async()=>{this.requireOwner(owner);for(const s of snapshots)if(s.file.path!==s.path||this.app.vault.getAbstractFileByPath(s.path)!==s.file||await this.app.vault.read(s.file)!==s.raw)throw Error('原笔记已变化，请重新合并');this.requireOwner(owner);if(nodes.some(n=>!owner.board.nodes.some(current=>current.id===n.id&&current.file===n.file)))throw Error('所选卡片已变化，请重新选择');};await ensure();
    const body=conceptDocument(title,snapshots),file=await this.plugin.createUnique(this.plugin.settings.cardFolder,title,'md',body);
    try{await ensure();const p=this.materialPoint(),id=uid();owner.change(b=>{b.version=3;b.nodes.push({id,kind:'card',transparent:true,file:file.path,...p,width:this.plugin.settings.defaultCardWidth,height:320,color:nodes[0].color,fillColor:nodes[0].fillColor});for(const source of nodes)b.edges.push({id:uid(),from:source.id,to:id,label:'综合',style:'curve',direction:'forward',color:source.color});});this.revealNode(id);await owner.flush();new Notice('已生成概念笔记，原卡片和原笔记均保留');return file;
    }catch(e){throw Error(`${String(e)}。已生成的概念笔记保留在 ${file.path}`);}
  }
  private renderBoard(viewportOnly=false) {
    if (this.closed || !this.session || !this.world || (this.dragging&&!this.gesture?.pan)) return;
    if(this.renderFrame){(this.contentEl?.ownerDocument?.defaultView||window).cancelAnimationFrame(this.renderFrame);this.renderFrame=0;viewportOnly=viewportOnly&&this.viewportOnlyRender;this.viewportOnlyRender=true;}
    if(!viewportOnly){
    this.inlineLayout=this.inlineTarget===this.inlineGeometry?.id&&this.session.board.nodes.some(n=>n.mindmapRules?.automatic)?inlineDisplayBoard(this.session.board,this.inlineGeometry):undefined;
    this.relationBar?.remove();this.relationBar=undefined;if(this.relatedFocus){
      const bar=this.relationBar=this.stage.createDiv({cls:'ts-relation-focus',attr:{'aria-label':'关系聚焦工具'}});bar.createSpan({text:`关系聚焦 · ${this.relatedFocus.size} 项`});const lens=this.relationLens,owner=this.session;
      if(lens){const choose=(label:string,values:[string,string][],value:string,apply:(value:string)=>void)=>{const select=bar.createEl('select',{attr:{'aria-label':label}});for(const[v,text]of values)select.createEl('option',{value:v,text});select.value=value;select.onchange=()=>act(()=>{this.requireOwner(owner);apply(select.value);});};
        choose('关联层数',[['1','1 层'],['2','2 层'],['3','3 层'],['Infinity','全部层级']],String(lens.depth),value=>this.exploreRelations(lens.direction,lens.seeds,Number(value)));
        choose('关联方向',[['connected','双向'],['upstream','上游'],['downstream','下游']],lens.direction,value=>this.exploreRelations(value as RelationDirection,lens.seeds,lens.depth));
        button(bar,'回到起点','locate-fixed',()=>{this.requireOwner(owner);this.selected=new Set([...lens.seeds].filter(id=>owner!.board.nodes.some(n=>n.id===id)));this.updateSelection();this.focusSelection();},'ts-icon-button');
      }
      button(bar,'显示全部','x',()=>{this.relatedFocus=undefined;this.relationLens=undefined;this.renderBoard();},'ts-icon-button');bar.onpointerdown=e=>e.stopPropagation();bar.onkeydown=e=>{if(e.key!=='Escape')e.stopPropagation();};
    }
    }
    this.updateBackToContent();const b = this.displayBoard();if(!viewportOnly){this.syncCanvasControls();this.contentEl.toggleClass('ts-mindmap-mode',b.mode==='mindmap');this.mindmapButton?.toggleClass('is-active',b.mode==='mindmap');this.mindmapButton?.setAttribute('aria-pressed',String(b.mode==='mindmap'));}
    if(this.startScreen)this.startScreen.hidden=!!b.nodes.length;
    if(!viewportOnly){this.updateObjectFilter();this.renderSaveStatus(); this.fileTitle?.setText(this.file?.basename || '研究工作台'); this.renderNavigation();}
    const v=b.viewport;this.world.style.transform=`translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;this.stage.style.backgroundSize=`${visibleGridSize(this.plugin.settings.gridStep,v.zoom)}px ${visibleGridSize(this.plugin.settings.gridStep,v.zoom)}px`;this.stage.style.backgroundPosition=`${v.x}px ${v.y}px`;this.zoomLabel.setText(`${Math.round(v.zoom*100)}%`);
    const branches=branchState(b);const visible=visibleNodes(b.nodes.filter(n=>!branches.hidden.has(n.id)).map(sectionDisplayNode),viewportRect(v,this.stage.clientWidth,this.stage.clientHeight));for(const id of new Set([this.inlineId,this.inlineTarget])){const editing=b.nodes.find(n=>n.id===id);if(editing&&!visible.some(n=>n.id===editing.id))visible.push(editing);}for(const node of b.nodes){if(this.positions.get(node.id)?.querySelector('.ts-card-title-input')&&!visible.some(n=>n.id===node.id))visible.push(node);}const live=new Set(visible.map(n=>n.id));let childCandidates:ReturnType<typeof childConnectionCandidates>|undefined;
    for(const [id,el] of this.positions){if(!live.has(id)){el.remove();this.positions.delete(id);this.nodeScopes.get(id)?.unload();this.nodeScopes.delete(id);this.nodeKeys.delete(id);}}
    // File metadata is shared only inside this synchronous render. Even a missing
    // cache is read once; the next content refresh always starts from current data.
    const fileMetadata=new Map<TFile,{cache:CachedMetadata|null;tags:string[]|null}>();
    // Stable buckets preserve preview priority and stacking order without sorting
    // the same visible nodes for detail allocation, mounting and DOM placement.
    const preferred:string[]=[],remaining:string[]=[],sections:Card[]=[],objects:Card[]=[];
    for(const n of visible){(this.selected.has(n.id)?preferred:remaining).push(n.id);(n.kind==='section'?sections:objects).push(n);}
    const detailIds=new Set(preferred.concat(remaining).slice(0,this.plugin.settings.previewLimit)),ordered=sections.concat(objects);
    this.connectionCandidates=ordered;
    for (const n of ordered) {
      const editingTitle=this.positions.get(n.id);if(editingTitle?.querySelector('.ts-card-title-input')){this.positionNode(n,editingTitle);continue;}
      if(this.inlineId===n.id&&this.inline&&this.positions.get(n.id)?.contains(this.inline.el)){this.syncInlineAppearance(n,this.positions.get(n.id)!);continue;}
      const detail=n.id===this.inlineTarget||(v.zoom>=this.plugin.settings.detailZoom && detailIds.has(n.id));
      // Camera-only frames can reuse unchanged card DOM without serializing note
      // content or consulting metadata. Crossing the detail threshold still rebuilds.
      const mounted=this.positions.get(n.id);
      if(viewportOnly&&mounted&&(n.kind==='section'||mounted.classList.contains('ts-node-summary')===!detail)){this.positionNode(n,mounted);continue;}
      // Mounted camera-only previews need no child-relation index. Build it once
      // per render only when a node must be checked or created, never across edits.
      childCandidates??=childConnectionCandidates(b,live);
      const fileInfo=n.file?this.app.vault.getAbstractFileByPath(n.file):undefined;
      let metadata=fileInfo instanceof TFile?fileMetadata.get(fileInfo):undefined;
      if(fileInfo instanceof TFile&&!metadata){const cache=this.app.metadataCache.getFileCache(fileInfo);metadata={cache,tags:getAllTags(cache||{})};fileMetadata.set(fileInfo,metadata);}
      const key=nodeRenderKey(n,[branches.children.get(n.id)?.length||0,childCandidates.get(n.id)?.length||0,detail,this.session.blocked,fileInfo instanceof TFile?[fileInfo.stat.mtime,fileInfo.stat.size,metadata?.cache?.frontmatter,metadata?.tags]:null]);
      const old=this.positions.get(n.id);if(old&&this.nodeKeys.get(n.id)===key){this.positionNode(n,old);old.toggleClass('is-filtered-out',!!this.filterMatches&&!this.filterMatches.has(n.id));old.toggleClass('is-selected',this.selected.has(n.id));old.toggleClass('is-unrelated',!!this.relatedFocus&&!this.relatedFocus.has(n.id));continue;}
      old?.remove();this.nodeScopes.get(n.id)?.unload();const scope=new Component();scope.load();this.nodeScopes.set(n.id,scope);this.nodeKeys.set(n.id,key);
      const el = this.world.createDiv({ cls: `ts-node ts-${n.kind} ts-color-${n.color}`, attr: { 'data-id': n.id } });
      el.toggleClass('is-filtered-out',!!this.filterMatches&&!this.filterMatches.has(n.id));el.toggleClass('is-locked',!!n.locked);el.toggleClass('is-unrelated',!!this.relatedFocus&&!this.relatedFocus.has(n.id));el.toggleClass('ts-topic',!!n.topic);this.positions.set(n.id, el); this.positionNode(n, el); el.toggleClass('is-selected', this.selected.has(n.id));
      const childCount=branches.children.get(n.id)?.length||0;if(childCount){const fold=button(el,n.branchFolded?`展开下一层 · ${childCount} 个子节点`:'折叠分支',n.branchFolded?'plus':'minus',()=>this.foldBranches(new Set([n.id]),!n.branchFolded,n.branchFolded?'level':'collapse'),'ts-branch-toggle');fold.disabled=!!this.session.blocked||!!n.locked;fold.setAttribute('aria-expanded',String(!n.branchFolded));fold.onpointerdown=e=>e.stopPropagation();fold.ondblclick=e=>e.stopPropagation();if(n.branchFolded)fold.createSpan({text:String(childCount),cls:'ts-branch-count'});el.classList.toggle('has-folded-branches',!!n.branchFolded);}
      else if(childCandidates.has(n.id)){
        const fold=button(el,'设为子节点并折叠 · 可撤销','git-branch',()=>this.foldBranches(new Set([n.id]),true,'collapse',true),'ts-branch-toggle ts-branch-setup');
        fold.disabled=!!this.session.blocked||!!n.locked;fold.onpointerdown=e=>e.stopPropagation();fold.ondblclick=e=>e.stopPropagation();
      }
      if(n.review&&n.review!=='later')el.createDiv({cls:'ts-review-badge',text:reviewLabels[n.review],attr:{'aria-label':`阅读状态：${reviewLabels[n.review]}`}});
      // Resize is an interaction affordance, independent of expensive preview detail.
      if (!n.collapsed&&!n.sectionFolded&&!n.locked) el.createDiv({ cls: 'ts-resize', attr: { 'aria-label': '拖动调整大小' } });
      if(!detail&&n.kind!=='section'){el.addClass('ts-node-summary');if(['card','text','image','pdf'].includes(n.kind))this.addPorts(el,n.id);el.createDiv({cls:'ts-summary-title',text:n.kind==='card'?cardDisplayTitle(n,fileInfo instanceof TFile?fileInfo:undefined):fileInfo instanceof TFile?fileInfo.basename:n.title||n.text?.split('\n')[0]||'笔记'});el.ondblclick=e=>{if((e.target as Element).closest('button'))return;e.stopPropagation();if(n.kind==='card'||n.kind==='text')act(()=>this.startInlineEdit(n.id));else if(n.kind==='pdf'&&fileInfo instanceof TFile)act(()=>this.plugin.openNoteInSidebar(fileInfo,pdfSubpath(n.pdfPage)));else{this.revealNode(n.id);this.session!.board.viewport.zoom=1;this.revealNode(n.id);}};continue;}
      const header = el.createDiv('ts-node-header'); el.toggleClass('is-folded', !!n.collapsed);
      if (n.kind === 'section') {
        el.toggleClass('is-section-folded',!!n.sectionFolded);setIcon(header.createSpan(),n.sectionFolded?'folder':'folder-open');header.createSpan({text:n.title,cls:'ts-section-title'});
        const fold=button(header,n.sectionFolded?'展开分组':'折叠分组',n.sectionFolded?'chevron-down':'chevron-up',()=>this.setSelectionFold(new Set([n.id]),!n.sectionFolded,true),'ts-icon-button ts-section-fold');
        fold.disabled=this.session.blocked||!!n.locked;fold.setAttribute('aria-expanded',String(!n.sectionFolded));fold.onpointerdown=e=>e.stopPropagation();fold.ondblclick=e=>e.stopPropagation();
        header.title='双击重命名 · 拖动标题移动框内内容';header.ondblclick=e=>{if((e.target as Element).closest('button'))return;e.stopPropagation();this.renameSection(n.id);};
      } else if (n.kind === 'board') {
        const owner=this.session;
        const file = this.app.vault.getAbstractFileByPath(n.file!);
        el.addClass('ts-board-portal'); setIcon(header.createSpan('ts-portal-icon'), 'panels-top-left');
        header.createSpan({ cls:'ts-portal-title',text: file instanceof TFile ? file.basename : n.title || '白板不存在' });
        const fold=button(header,n.collapsed?'展开子白板':'折叠子白板',n.collapsed?'chevron-down':'chevron-up',()=>{
          this.requireOwner(owner);this.mutate(b=>foldCards(b,new Set([n.id]),!n.collapsed));
        },'ts-icon-button ts-portal-fold');
        fold.disabled=owner.blocked||!!n.locked;fold.setAttribute('aria-expanded',String(!n.collapsed));
        fold.onpointerdown=e=>e.stopPropagation();fold.ondblclick=e=>e.stopPropagation();
        if (file instanceof TFile) {
          if(!n.collapsed){
            const preview = el.createDiv('ts-portal-preview'), meta = el.createDiv('ts-portal-meta');
            preview.createSpan({ text: '正在读取白板…', cls: 'ts-map-empty' });
            act(async () => {
              try { const child = await this.plugin.readBoard(file); if (!preview.isConnected||this.session!==owner) return; preview.empty(); this.mapPreview(preview, child);
                meta.createSpan({ text: `${child.nodes.filter(n => n.kind === 'card').length} 张卡片 · ${boardLinks(child).length} 个子白板` });
              } catch { if (preview.isConnected&&this.session===owner) preview.setText('白板无法读取，请检查文件'); }
            });
            button(meta, '进入白板', 'arrow-up-right', () => this.enterBoard(file));
          }else button(header,'进入白板','arrow-up-right',()=>this.enterBoard(file),'ts-icon-button');
          el.ondblclick = e => { if ((e.target as Element).closest('button')) return; e.stopPropagation(); act(() => this.enterBoard(file)); };
        } else if(!n.collapsed) { el.createDiv('ts-portal-preview').createDiv({ cls: 'ts-missing', text: '找不到子白板。原入口保留，可以重新关联。' }); }
      } else if(n.kind==='text'){
        header.remove();el.dataset.ink=n.textColor || 'default';
        const presentation=textExcerptPresentation(n.text||'');el.toggleClass('has-excerpt-source',!!presentation.sources.length);
        const actions=el.createDiv('ts-card-actions ts-text-actions');
        const folding=button(actions,n.collapsed?'展开文本':'折叠文本',n.collapsed?'chevron-down':'chevron-up',()=>this.foldText(n.id,!n.collapsed),'ts-icon-button');
        folding.disabled=this.session.blocked||!!n.locked;folding.setAttribute('aria-expanded',String(!n.collapsed));folding.onpointerdown=e=>e.stopPropagation();folding.ondblclick=e=>e.stopPropagation();
        const textBody=el.createDiv({cls:'ts-text-body'});textBody.style.fontFamily=textFontFamily(n.fontFamily);textBody.style.fontSize=`${n.collapsed?Math.min(n.fontSize||16,24):n.fontSize||16}px`;textBody.style.textAlign=n.textAlign || 'left';
        if(n.collapsed){textBody.setText(presentation.body.split(/\r?\n/).find(line=>line.trim())?.trim()||'空文本');}
        else{
          renderTextPreview(textBody,presentation.sources.length?presentation.body.trimEnd():presentation.body,scope,()=>{if(textBody.isConnected)this.queueTextFit(n);},(alive,run)=>this.previewQueue.add(alive,run),{app:this.app,sourcePath:this.session.file.path});
          if(presentation.sources.length){textBody.appendText('\u2060');this.addSourceBadge(textBody,this.session.file,presentation.sources,scope);}
          this.queueTextFit(n);
        }
        el.ondblclick=e=>{if((e.target as Element).closest('button,a'))return;e.stopPropagation();this.editText(n.id);};
      } else if(n.kind==='pdf'){
        this.renderPdfCard(n,el,header,scope);
      } else if(n.kind==='image'){
        const owner=this.session!,file=this.app.vault.getAbstractFileByPath(n.file!),remote=remoteImageUrl(n.imageUrl);header.remove();el.setAttribute('aria-label',n.title||(file instanceof TFile?file.basename:'图片'));el.addClass('ts-media-card');
        if(file instanceof TFile||remote){const local=file instanceof TFile?this.app.vault.getResourcePath(file):undefined;let fallback=false;const img=el.createEl('img',{cls:'ts-image-body',attr:{src:remote||local!,alt:n.title||(file instanceof TFile?file.basename:'图床图片'),draggable:'false',referrerpolicy:'no-referrer'}});const fit=()=>{if(!img.isConnected||this.session!==owner)return;const size=mediaDimensions(n.width,img.naturalWidth,img.naturalHeight);if(size)this.queueNodeFit(n,size);};img.onload=fit;scope.register(()=>{img.onload=null;img.onerror=null;});if(img.complete)fit();img.onerror=()=>{if(remote&&local&&!fallback){fallback=true;img.src=local;img.title='图床暂不可用，显示本地备份';return;}img.replaceWith(el.createDiv({cls:'ts-missing',text:'图片无法显示，请检查图床或本地备份'}));};el.ondblclick=e=>{e.stopPropagation();if(remote)el.ownerDocument.defaultView?.open(remote,'_blank','noopener,noreferrer');else if(file instanceof TFile)act(()=>this.app.workspace.getLeaf('tab').openFile(file));};}
        else el.createDiv({cls:'ts-missing',text:'找不到图片文件，请右键重新关联。'});
      } else {
        const file = fileInfo;
        setIcon(header.createSpan(), 'file-text'); const noteTitle=header.createSpan({ text:cardDisplayTitle(n,file instanceof TFile?file:undefined) });if(file instanceof TFile)noteTitle.dataset.tsNotePath=file.path;
        {const owner=this.session!;let previous=n.title;scope.register(bindCardTitle(noteTitle,{
          getTitle:()=>cardDisplayTitle(owner.board.nodes.find(node=>node.id===n.id)||n,file instanceof TFile?file:undefined),
          started:()=>{previous=owner.board.nodes.find(node=>node.id===n.id)?.title;},
          canEdit:()=>{this.requireOwner(owner);const current=owner.board.nodes.find(node=>node.id===n.id);if(!current||current.kind!=='card')throw Error('卡片已变化，请重新编辑');if(current.locked||owner.blocked)throw Error('卡片已锁定或白板暂不可编辑');},
          save:async value=>{this.requireOwner(owner);owner.change(board=>setCardTitle(board,n.id,value,previous));previous=owner.board.nodes.find(node=>node.id===n.id)?.title;await owner.flush();},
          finished:()=>this.renderBoard()
        }));}

        const actions = el.createDiv('ts-card-actions');
        if (file instanceof TFile) button(actions, '阅读与关联', 'eye', () => new NotePreview(this.app, file, this.plugin).open(), 'ts-icon-button');
        const folding = button(actions, n.collapsed ? '展开卡片' : '折叠卡片', n.collapsed ? 'chevron-down' : 'chevron-up', () => this.mutate(b => foldCards(b, new Set([n.id]), !n.collapsed)), 'ts-icon-button'); folding.disabled = this.session.blocked||!!n.locked;folding.setAttribute('aria-expanded',String(!n.collapsed));
        const preview = n.collapsed ? undefined : el.createDiv('ts-card-preview markdown-rendered');
        if(preview){el.dataset.ink=n.textColor||'default';preview.style.fontFamily=textFontFamily(n.fontFamily);preview.style.fontSize=`${n.fontSize||14}px`;preview.style.textAlign=n.textAlign||'left';}
        if (file instanceof TFile) {
          if (preview) {preview.addClass('ts-preview-pending');preview.setAttribute('aria-busy','true');preview.setAttribute('aria-label','正在加载笔记');this.previewQueue.add(()=>preview.isConnected,async () => { try { const content = await this.app.vault.cachedRead(file); if (!preview.isConnected) return;
            const presentation=excerptPresentation(content),excerpt=markdownPreview(presentation.body);
            if(presentation.sources.length){const footer=el.querySelector<HTMLElement>('.ts-card-meta');if(footer){footer.querySelector('.ts-card-meta-placeholder')?.remove();this.addSourceBadge(footer,file,presentation.sources,scope);}}
            preview.removeClass('ts-preview-pending');preview.removeAttribute('aria-label');
            await MarkdownRenderer.render(this.app, excerpt, preview, file.path, scope);if(!preview.isConnected){scope.unload();return;}
            // 卡片预览只读；交互任务集中在任务页，避免渲染器复选框误导用户。
            preview.querySelectorAll('input').forEach(i => { i.disabled = true; });
            preview.querySelectorAll('p').forEach(p => { if (Array.from(p.childNodes).every(n => n.nodeType === 3 ? !n.textContent?.trim() : n.instanceOf(Element) && n.matches('a.tag'))) p.remove(); });
            if(n.autoFit&&!n.locked){this.queueCardFit(n,preview);for(const img of Array.from(preview.querySelectorAll('img'))){const ready=()=>{if(preview.isConnected)this.queueCardFit(n,preview);};img.addEventListener('load',ready,{once:true});scope.register(()=>img.removeEventListener('load',ready));}}
          }catch{if(preview.isConnected){preview.removeClass('ts-preview-pending');preview.removeAttribute('aria-label');preview.empty();const error=preview.createDiv({cls:'ts-preview-error',attr:{role:'status'}});error.createSpan({text:'暂时无法加载笔记'});button(error,'重试','rotate-cw',()=>{if(preview.isConnected){this.nodeKeys.delete(n.id);this.scheduleRender();}},'ts-icon-button');}}finally{preview.setAttribute('aria-busy','false');} });}
          const footer = n.collapsed ? undefined : el.createDiv('ts-card-meta');
          if (footer) {
          const fm = metadata?.cache?.frontmatter || {}, props = readProperties(fm);
          if (fm.thoughtspace_status) footer.createSpan({cls:`ts-state-pill ts-state-${Object.hasOwn(statuses, props.status) ? props.status : 'other'}`,text:statuses[props.status] || props.status});
          if (isOverdue(props, localDay())) footer.createSpan({cls:'ts-state-pill ts-state-overdue',text:'已逾期'});
          for (const tag of (metadata?.tags || []).slice(0, 3)) footer.createEl('a', { cls: 'ts-tag tag', text: tag, href: tag });
          if (!footer.childElementCount) footer.createSpan({ cls:'ts-card-meta-placeholder',text: 'Markdown · 本地笔记' });
          }
          el.ondblclick = e => { if ((e.target as Element).closest('a,button')) return; e.stopPropagation(); act(()=>this.startInlineEdit(n.id)); };
        } else preview?.createDiv({ cls: 'ts-missing', text: '找不到原笔记。请选择此卡片，使用“重新关联”修复引用。' });
      }
      if(['card','text','image','pdf','section'].includes(n.kind))this.addPorts(el,n.id);
    }
    let previous:Element=this.svg;for(const n of ordered){const el=this.positions.get(n.id);if(el){if(previous.nextElementSibling!==el)this.world.insertBefore(el,previous.nextSibling);previous=el;}}
    this.renderEdges();if(!viewportOnly)this.renderInspector();if(!viewportOnly||!this.mapKey)this.renderMinimap();else this.mapViewport?.();
  }
  private pdfTotals=new Map<string,{stamp:number;total:number}>();
  private choosePdfPage(id:string,total?:number) {
    const owner=this.requireOwner(),node=owner.board.nodes.find(n=>n.id===id);if(node?.kind!=='pdf')return;
    new Prompt(this.app,total?`PDF 页码 · 共 ${total} 页`:'PDF 页码',String(node.pdfPage||1),value=>{
      this.requireOwner(owner);const page=pdfPage(Number(value));if(total&&page>total)throw Error(`最多 ${total} 页`);
      this.setPdfPage(id,page,owner);
    }).open();
  }
  private setPdfPage(id:string,page:number,owner=this.session) {
    this.requireOwner(owner);pdfPage(page);const current=owner!.board.nodes.find(n=>n.id===id);if(current?.pdfPage===page||current?.pdfPage===undefined&&page===1)return;owner!.change(b=>{const node=b.nodes.find(n=>n.id===id);if(node?.kind!=='pdf')throw Error('PDF 卡片已变化');if(node.locked)throw Error('请先解锁卡片');node.pdfPage=page;});
  }
  private renderPdfCard(n:Card,el:HTMLElement,header:HTMLElement,scope:Component) {
    const owner=this.session!,file=this.app.vault.getAbstractFileByPath(n.file!);el.addClass('ts-media-card');el.setAttribute('aria-label',`${file instanceof TFile?file.basename:n.title||'PDF 文件'} · 第 ${n.pdfPage||1} 页`);
    if(n.collapsed){setIcon(header.createSpan(),'file-text');header.createSpan({text:file instanceof TFile?file.basename:n.title||'PDF 文件',cls:'ts-pdf-title'});}
    const fold=button(header,n.collapsed?'展开 PDF':'折叠 PDF',n.collapsed?'chevron-down':'chevron-up',()=>this.mutate(b=>foldCards(b,new Set([n.id]),!n.collapsed)),'ts-icon-button');fold.disabled=owner.blocked||!!n.locked;fold.setAttribute('aria-expanded',String(!n.collapsed));
    if(n.collapsed){el.createDiv({cls:'ts-pdf-folded-info',text:`第 ${n.pdfPage||1} 页 · 已折叠`});return;}
    const preview=el.createDiv('ts-pdf-preview'),footer=el.createDiv('ts-pdf-controls'),page=n.pdfPage||1;
    footer.setAttribute('aria-label','PDF 翻页：PageUp / PageDown，Home / End');
    if(!(file instanceof TFile)){preview.createDiv({cls:'ts-missing',text:'找不到 PDF 文件。原卡片已保留。'});return;}
    const stamp=file.stat.mtime;
    const open=()=>this.plugin.openNoteInSidebar(file,pdfSubpath(page));
    const previous=button(footer,'上一页','chevron-left',()=>this.setPdfPage(n.id,page-1,owner),'ts-icon-button');previous.disabled=owner.blocked||!!n.locked||page===1;
    let total=this.pdfTotals.get(file.path)?.stamp===file.stat.mtime?this.pdfTotals.get(file.path)?.total:undefined;
    const indicator=button(footer,`第 ${page} 页`,'',()=>this.choosePdfPage(n.id,total),'ts-pdf-page');indicator.disabled=owner.blocked||!!n.locked;
    const next=button(footer,'下一页','chevron-right',()=>this.setPdfPage(n.id,page+1,owner),'ts-icon-button');next.disabled=owner.blocked||!!n.locked||!total||page>=total;
    button(footer,'右侧阅读 PDF','panel-right',open,'ts-icon-button');
    el.ondblclick=e=>{if((e.target as Element).closest('button'))return;e.stopPropagation();act(open);};
    preview.setAttribute('aria-busy','true');preview.createSpan({text:'正在加载页面…',cls:'ts-pdf-loading'});
    this.pdfPreviewQueue.add(()=>preview.isConnected,async()=>{
      try {
        const result=await renderPdfThumbnail({host:preview,src:this.app.vault.getResourcePath(file)+(this.app.vault.getResourcePath(file).includes('?')?'&':'?')+'ts_mtime='+stamp,page,load:loadPdfJs,onSize:size=>{const fitted=mediaDimensions(n.width,size.width,size.height);if(fitted)this.queueNodeFit(n,fitted);},pool:file.stat.size<=32*1024*1024?this.plugin.pdfDocuments:undefined,register:dispose=>scope.register(dispose),alive:()=>preview.isConnected&&this.session===owner&&file.stat.mtime===stamp});
        if(!result||!preview.isConnected)return;total=result.total;if(this.pdfTotals.size>128)this.pdfTotals.clear();this.pdfTotals.set(file.path,{stamp,total});indicator.setText(`${page} / ${total}`);indicator.setAttribute('aria-label',`选择页码，第 ${page} 页，共 ${total} 页`);next.disabled=owner.blocked||!!n.locked||page>=result.total;
      } catch(error) {
        if(!preview.isConnected)return;preview.empty();preview.createSpan({cls:'ts-pdf-error',text:error instanceof Error?error.message:'暂时无法预览 PDF，请在右侧阅读器打开'});
        button(preview,'重试','rotate-cw',()=>{this.nodeKeys.delete(n.id);this.scheduleRender();});
        if(page>1)button(preview,'回到第一页','rewind',()=>this.setPdfPage(n.id,1,owner)).disabled=owner.blocked||!!n.locked;
      } finally {preview.setAttribute('aria-busy','false');}
    });
  }
  private addPorts(el:HTMLElement,id:string){
    const topicPort=this.session?.board.mode==='mindmap'&&this.session.board.nodes.find(n=>n.id===id)?.kind!=='section';
    const labels={top:'上',right:'右',bottom:'下',left:'左'};
    for(const side of ['top','right','bottom','left'] as Side[]){const port=el.createEl('button',{cls:`ts-connect-port ts-port-${side}`,text:'+',attr:{'aria-label':topicPort?`${labels[side]}侧添加子主题或连线`:`${labels[side]}侧连线`,title:topicPort?'点击添加子主题 · 拖到空白处自动排版 · 拖到对象连线':'拖动到目标建立连线，也可依次点击两端','data-side':side}});port.disabled=!!this.session?.blocked;
      port.onpointerdown=e=>{if(e.button!==0||e.ctrlKey)return;e.stopPropagation();e.preventDefault();
        const board=this.session?.board,edge=board?.edges.find(edge=>edge.id===this.selectedEdge),a=edge&&board?.nodes.find(n=>n.id===edge.from),b=edge&&board?.nodes.find(n=>n.id===edge.to);
        if(this.mode!=='connect'&&edge&&a&&b){const sides=connectionSides(sectionDisplayNode(a),sectionDisplayNode(b),edge),end=edge.from===id&&sides.fromSide===side?'from':edge.to===id&&sides.toSide===side?'to':undefined;if(end){this.startLinkDrag(e,end==='from'?edge.to:edge.from,end==='from'?sides.toSide:sides.fromSide,{id:edge.id,end,expected:JSON.stringify(edge)});return;}}
        if(this.mode==='connect'&&this.connectFrom&&this.connectFrom!==id&&!this.linkDrag)this.connectNode(id,side);else this.startLinkDrag(e,id,side);};
      port.onclick=e=>{e.stopPropagation();if(e.detail===0){if(topicPort&&this.mode!=='connect')act(()=>this.addTopic(false,id));else this.connectNode(id,side);}};
    }
  }
  private cancelConnection(){
    const drag=this.linkDrag;this.linkDrag=undefined;this.connectionIndex=undefined;this.connectionGeometryKey='';
    if(drag&&this.stage?.hasPointerCapture(drag.id))this.stage.releasePointerCapture(drag.id);
    this.linkTargetEl?.removeClass('is-connection-target');this.linkTargetPort?.removeClass('is-target-port');this.linkTargetEl=undefined;this.linkTargetPort=undefined;
    this.linkTarget=undefined;this.linkPreview?.remove();this.linkPreview=undefined;this.flowHint?.removeClass('is-visible');this.stage?.removeClass('ts-connecting');this.connectFrom=undefined;this.connectSide=undefined;this.mode='select';this.connectButton?.removeClass('is-active');
  }
  private startLinkDrag(e:PointerEvent,from:string,side?:Side,edge?:{id:string;end:'from'|'to';expected:string}){
    const owner=this.session;if(!owner||owner.blocked||this.gesture||this.marquee)return;
    const topicClick=owner.board.mode==='mindmap'&&owner.board.nodes.find(n=>n.id===from)?.kind!=='section'&&this.mode!=='connect'&&!edge;
    this.cancelConnection();this.setSectionTool(false);this.selectionTool=false;this.syncSelectionTool();this.contextOpen=false;
    this.mode='connect';this.connectFrom=from;this.connectSide=side;this.linkDrag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,owner,edge,topicClick};
    this.connectButton?.addClass('is-active');this.stage.addClass('ts-connecting');this.stage.focus();this.stage.setPointerCapture(e.pointerId);this.previewConnection(e.clientX,e.clientY);e.preventDefault();e.stopPropagation();
  }
  private previewConnection(clientX:number,clientY:number){
    const owner=this.session,byId=owner?this.connectionNodes(owner):undefined,source=byId?.get(this.connectFrom||''),from=source&&sectionDisplayNode(source);if(!owner||!from||owner.blocked){this.cancelConnection();return;}
    const rect=this.stage.getBoundingClientRect(),v=owner.board.viewport,point={x:(clientX-rect.left-v.x)/v.zoom,y:(clientY-rect.top-v.y)/v.zoom};
    const inside=clientX>=rect.left&&clientX<=rect.right&&clientY>=rect.top&&clientY<=rect.bottom;
    const target=inside?connectionTarget(this.connectionCandidates,point,from.id,v.zoom,n=>this.positions.has(n.id)&&(!this.filterMatches||this.filterMatches.has(n.id))&&(!this.relatedFocus||this.relatedFocus.has(n.id)),true):undefined;
    const targetEl=target?this.positions.get(target.id):undefined,targetChanged=this.linkTargetEl!==targetEl||this.linkTarget?.side!==target?.side;
    const targetPort=targetChanged?targetEl?.querySelector(`[data-side="${target?.side}"]`)||undefined:this.linkTargetPort;
    if(this.linkTargetEl!==targetEl){this.linkTargetEl?.removeClass('is-connection-target');targetEl?.addClass('is-connection-target');this.linkTargetEl=targetEl;}
    if(this.linkTargetPort!==targetPort){this.linkTargetPort?.removeClass('is-target-port');targetPort?.addClass('is-target-port');this.linkTargetPort=targetPort;}
    this.linkTarget=target;
    const label=target?byId!.get(target.id):undefined,other=label?sectionDisplayNode(label):{...from,id:'preview',x:point.x,y:point.y,width:0,height:0};
    const edge=this.linkDrag?.edge&&owner.board.edges.find(e=>e.id===this.linkDrag!.edge!.id),style=edge?.style||owner.board.defaultEdgeStyle||this.plugin.settings.defaultEdgeStyle;
    const geometryKey=[from.id,from.x,from.y,from.width,from.height,other.id,other.x,other.y,other.width,other.height,style,this.connectSide,target?.side,this.linkDrag?.edge?.end].join('|');
    if(!this.linkPreview?.isConnected){this.linkPreview=this.svg.createSvg('path',{cls:'ts-connection-preview',attr:{'vector-effect':'non-scaling-stroke'}});this.connectionGeometryKey='';}
    if(geometryKey!==this.connectionGeometryKey){
      const geometry=this.linkDrag?.edge?.end==='from'?connectionPath(other,from,{style,fromSide:target?.side,toSide:this.connectSide}):connectionPath(from,other,{style,fromSide:this.connectSide,toSide:target?.side});
      if(this.linkPreview.getAttribute('d')!==geometry.path)this.linkPreview.setAttribute('d',geometry.path);this.connectionGeometryKey=geometryKey;
    }
    if(this.linkPreview.classList.contains('has-target')!==!!target)this.linkPreview.classList.toggle('has-target',!!target);if(this.flowHint&&!this.flowHint.hasClass('is-visible'))this.flowHint.addClass('is-visible');
    const blank=this.linkDrag?.topicClick?'空白处松手添加子主题':'空白处松手添加文本';
    const hint=target?`连接至 ${label?.title||label?.file?.split('/').pop()?.replace(/\.md$/,'')||label?.text?.split('\n')[0]?.slice(0,24)||'对象'} · 松手完成`:this.linkDrag?.edge?'拖到新目标重接 · Esc 取消':this.linkDrag?.moved?`拖到对象连接 · ${blank} · Esc 取消`:'选择目标建立连线 · Esc 取消';if(this.flowHint&&this.flowHint.textContent!==hint)this.flowHint.setText(hint);
  }
  private finishLinkDrag(e:PointerEvent,cancelled=false){
    const drag=this.linkDrag;if(!drag||drag.id!==e.pointerId)return;
    // A fast release may arrive without a dispatched move beyond the threshold.
    if(!cancelled){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)drag.moved=true;if(drag.moved)this.previewConnection(e.clientX,e.clientY);}
    if(drag.edge&&!drag.moved){this.cancelConnection();return;}
    const owner=drag.owner,from=this.connectFrom,side=this.connectSide,target=this.linkTarget;
    if(!cancelled&&!drag.moved&&drag.topicClick&&from){this.cancelConnection();if(this.session===owner&&!owner.blocked)act(()=>this.addTopic(false,from));return;}
    if(!cancelled&&!drag.moved&&!drag.edge){this.linkDrag=undefined;if(this.stage.hasPointerCapture(e.pointerId))this.stage.releasePointerCapture(e.pointerId);this.selected=new Set(from?[from]:[]);this.updateSelection();return;}
    const rect=this.stage.getBoundingClientRect(),inside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom,point=this.point(e.clientX,e.clientY);
    this.cancelConnection();if(cancelled||this.session!==owner||owner.blocked||!from)return;
    if(target){if(drag.edge){const next=clone(owner.board);if(reconnectEdge(next,drag.edge.id,drag.edge.end,target.id,target.side,drag.edge.expected)){owner.change(b=>{b.edges=next.edges;});this.selectedEdge=drag.edge.id;this.selected.clear();}}else this.createConnection(from,target.id,side,target.side);this.updateSelection();}
    else if(drag.moved&&!drag.edge&&inside){
      if(drag.topicClick&&owner.board.mode==='mindmap'){act(()=>this.addTopic(false,from));return;}
      act(async()=>{if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);if(!owner.board.nodes.some(n=>n.id===from))throw Error('起点已不存在');const node:Card={id:uid(),kind:'text',text:'',x:point.x,y:point.y,width:80,height:60,color:'sand',fontSize:this.plugin.settings.defaultTextSize,autoSize:true};fitTextNode(node,this.contentEl);owner.change(b=>{b.version=3;b.nodes.push(node);b.edges.push({id:uid(),from,to:node.id,label:'',fromSide:side,style:this.plugin.settings.defaultEdgeStyle,direction:this.plugin.settings.defaultEdgeDirection});});this.selected=new Set([node.id]);this.updateSelection();await this.startInlineEdit(node.id,false,true);});
    }
  }
  private createConnection(from:string,to:string,fromSide?:Side,toSide?:Side){
    const owner=this.session;if(!owner||owner.blocked||from===to||![from,to].every(id=>owner.board.nodes.some(n=>n.id===id)))return;
    const edge={id:uid(),from,to,label:'',fromSide,toSide,style:this.plugin.settings.defaultEdgeStyle,direction:this.plugin.settings.defaultEdgeDirection};if(duplicateConnection(owner.board,edge))return;
    owner.change(b=>{b.version=3;b.edges.push(edge);});this.selected.clear();this.selectedEdge=edge.id;
  }
  private connectNode(id:string,side?:Side){
    const owner=this.session;if(!owner||owner.blocked||!owner.board.nodes.some(n=>n.id===id))return;
    if(this.mode!=='connect'||!this.connectFrom){this.cancelConnection();this.setSectionTool(false);this.selectionTool=false;this.syncSelectionTool();this.mode='connect';this.connectFrom=id;this.connectSide=side;this.selected=new Set([id]);this.connectButton?.addClass('is-active');this.flowHint?.setText('选择目标建立连线 · Esc 取消');this.flowHint?.addClass('is-visible');}
    else if(id!==this.connectFrom){this.createConnection(this.connectFrom,id,this.connectSide,side);this.cancelConnection();}
    this.stage.toggleClass('ts-connecting',this.mode==='connect');this.updateSelection();this.scheduleRender();this.stage.focus();
  }
  sectionNavigator(){
    const owner=this.session;if(!owner)return;
    new SectionCatalogModal(this.app,{
      board:()=>{this.requireOwner(owner);return owner.board;},
      link:id=>{this.requireOwner(owner);if(!this.file||!owner.board.nodes.some(n=>n.id===id&&n.kind==='section'))throw Error('分组已变化，请刷新后重试');return boardLink(this.app.vault.getName(),this.file.path,id);},
      focus:async id=>{const editor=this.inline;if(editor&&!await editor.commit())throw Error('请先处理当前编辑冲突');this.requireOwner(owner);if(editor&&this.inline===editor)this.endInline();if(!owner.board.nodes.some(n=>n.id===id&&n.kind==='section'))throw Error('分组已删除，请刷新后重试');this.app.workspace.setActiveLeaf(this.leaf,{focus:true});this.selected=new Set([id]);this.focusSelection();this.updateSelection();}
    }).open();
  }
  private nodeMeasureKey(n:Card){return JSON.stringify([n.fontFamily,n.fontSize,n.borderWidth,n.topic,n.textMaxWidth]);}
  private nodeAppearanceKey(n:Card){return JSON.stringify([n.fontFamily,n.fontSize,n.textColor,n.textAlign,n.color,n.fillColor,n.transparent,n.customBorder,n.borderStyle,n.borderWidth,n.topic,n.textMaxWidth]);}
  private syncInlineAppearance(n:Card,el:HTMLElement){
    // Shared moves and undo may change position without changing appearance or draft dimensions.
    const left=`${n.x}px`,top=`${n.y}px`;if(el.style.left!==left)el.style.left=left;if(el.style.top!==top)el.style.top=top;
    const key=this.nodeAppearanceKey(n);if(key===this.inlineStyleKey)return;this.inlineStyleKey=key;const measureKey=this.nodeMeasureKey(n),remeasure=measureKey!==this.inlineMeasureKey;this.inlineMeasureKey=measureKey;
    // Preserve draft dimensions until they are remeasured with the current style.
    this.positionNode(n,el,true);
    el.dataset.ink=n.textColor||'default';el.toggleClass('ts-topic',!!n.topic);
    const body=el.querySelector<HTMLElement>('.ts-text-body,.ts-card-preview');
    if(body){body.style.fontFamily=textFontFamily(n.fontFamily);body.style.fontSize=`${n.fontSize||(n.kind==='card'?14:16)}px`;body.style.textAlign=n.textAlign||'left';}
    this.inline?.syncAppearance(remeasure);
  }
  private positionNode(n: Card, el: HTMLElement,preserveDraftSize=false) {
    n=sectionDisplayNode(n);
    // Camera and pointer updates often revisit unchanged presentation. Compare
    // against the live element rather than caching mutable node objects.
    const toggle=(name:string,on:boolean)=>{if(el.classList.contains(name)!==on)el.toggleClass(name,on);};
    if(!el.classList.contains(`ts-color-${n.color}`))for(const color of colors)toggle(`ts-color-${color}`,n.color===color);
    if(n.kind==='card'||n.kind==='text'){const ink=n.textColor||'default';if(el.dataset.ink!==ink)el.dataset.ink=ink;}
    toggle('has-custom-border',!!n.customBorder);
    if(n.kind==='card'){
      const size=`${n.fontSize||14}px`,font=textFontFamily(n.fontFamily);
      if(el.style.getPropertyValue('--ts-card-body-size')!==size)el.style.setProperty('--ts-card-body-size',size);
      if(el.style.getPropertyValue('--ts-card-body-font')!==font)el.style.setProperty('--ts-card-body-font',font);
    }
    toggle('is-transparent',(n.kind==='card'||n.kind==='text')&&!!n.transparent);
    const fill=(n.kind==='card'||n.kind==='text')&&n.fillColor&&n.fillColor!=='none'?n.fillColor:undefined;
    toggle('has-card-fill',!!fill);
    if(fill){const color=fill.startsWith('#')?fill:cardFillHex[fill as Card['color']];if(el.style.getPropertyValue('--ts-card-fill')!==color)el.style.setProperty('--ts-card-fill',color);}
    else if(el.style.getPropertyValue('--ts-card-fill'))el.style.removeProperty('--ts-card-fill');
    syncNodeGeometry(n,el,preserveDraftSize);
    const borderStyle=n.borderStyle||'',borderWidth=n.borderWidth!==undefined?`${n.borderWidth}px`:'';
    if(el.style.borderStyle!==borderStyle)el.style.borderStyle=borderStyle;
    if(el.style.borderWidth!==borderWidth)el.style.borderWidth=borderWidth;
  }
  private applyInlineSize(id:string,size:{width:number;height:number}){
    const el=this.positions.get(id);if(this.inlineTarget!==id||!el?.isConnected||!Number.isFinite(size.width)||!Number.isFinite(size.height)||size.width<=0||size.height<=0)return;
    const previous=this.inlineGeometry;if(previous?.id===id&&previous.width===size.width&&previous.height===size.height)return;this.inlineGeometry={id,width:size.width,height:size.height};
    el.style.width=`${size.width}px`;el.style.height=`${size.height}px`;
    const board=this.session?.board;if(board?.nodes.some(n=>n.mindmapRules?.automatic)){this.inlineLayout=inlineDisplayBoard(board,this.inlineGeometry);for(const n of this.inlineLayout.nodes){const element=this.positions.get(n.id);if(element)syncNodeGeometry(sectionDisplayNode(n),element,n.id===id);}}
    if((previous?.id!==id||previous.width!==size.width||previous.height!==size.height)&&this.session?.board.edges.some(e=>e.from===id||e.to===id))this.renderEdges();
  }
  private displayBoard(){return dragDisplayBoard(this.inlineLayout&&this.inlineTarget?{...this.inlineLayout,viewport:this.session!.board.viewport}:this.session!.board,this.gesture?.draft,!!this.gesture?.resize);}
  private renderEdges() {
    if(!this.session)return;if(!this.edgeLayer||this.edgeLayer.root!==this.svg)this.edgeLayer=new EdgeLayer(this.svg,this.markerId,id=>this.labelEdge(id));
    const display=inlineDisplayBoard(this.displayBoard(),this.inlineTarget===this.inlineGeometry?.id?this.inlineGeometry:undefined);
    this.edgeLayer.render(visibleBranchBoard(display),this.stage.clientWidth,this.stage.clientHeight,this.selectedEdge,this.relatedFocus,this.batchFormatTarget==='edges'&&this.selected.size>1?new Set(selectionEdges(display,this.selected,this.batchEdgeScope).map(e=>e.id)):undefined);
    const nextPorts=new Map<Element,string>();
    const edge=this.selectedEdge?display.edges.find(e=>e.id===this.selectedEdge):undefined,a=edge&&display.nodes.find(n=>n.id===edge.from),b=edge&&display.nodes.find(n=>n.id===edge.to);
    if(edge&&a&&b){const sides=connectionSides(sectionDisplayNode(a),sectionDisplayNode(b),edge);for(const[id,side,title]of [[a.id,sides.fromSide,'拖动重接起点'],[b.id,sides.toSide,'拖动重接终点']]){const port=this.positions.get(id)?.querySelector(`[data-side="${side}"]`);if(port)nextPorts.set(port,title);}}
    // Only the selected connection's two ports need tracking; never scan every card.
    for(const port of this.endpointPorts.keys())if(!nextPorts.has(port)){port.removeClass('ts-endpoint-port');port.setAttribute('title','拖动到目标建立连线，也可依次点击两端');}
    for(const[port,title]of nextPorts)if(this.endpointPorts.get(port)!==title){port.addClass('ts-endpoint-port');port.setAttribute('title',title);}
    this.endpointPorts=nextPorts;

  }
  private labelEdge(id: string) { const owner = this.session, e = owner?.board.edges.find(e => e.id === id); if (e) new Prompt(this.app, '关系说明', e.label, label => { if (this.session !== owner || owner?.blocked) throw new Error('白板已切换或暂停写入，请回到原白板重试'); this.mutate(b => { const edge = b.edges.find(e => e.id === id); if (edge) edge.label = label; }); }).open(); }
  fitCards(ids:ReadonlySet<string>,automatic:boolean){this.mutate(b=>b.nodes.filter(n=>ids.has(n.id)&&n.kind==='card'&&!n.locked).forEach(n=>n.autoFit=automatic));if(automatic)for(const n of this.session?.board.nodes||[]){const preview=this.positions.get(n.id)?.querySelector<HTMLElement>('.ts-card-preview');if(ids.has(n.id)&&preview)this.queueCardFit(n,preview);}}
  private queueTextFit(node:Card){if(this.previewMetricsReady===false||node.collapsed||node.locked||node.autoSize===false||this.inlineTarget===node.id)return;const body=this.positions.get(node.id)?.querySelector<HTMLElement>('.ts-text-body');if(body?.dataset.mathStatus==='pending')return;const draft={...node};fitTextNode(draft,this.contentEl,body||undefined);this.queueNodeFit(node,draft);}
  private queueNodeFit(node:Card,size:{width:number;height:number}){const owner=this.session;if(!owner||owner.blocked||node.collapsed||node.locked||this.inlineId===node.id||this.inlineTarget===node.id)return;
    if(!Number.isFinite(size.width)||!Number.isFinite(size.height)||size.width<=0||size.height<=0)return;
    if(Math.abs(size.width-node.width)<1&&Math.abs(size.height-node.height)<1){this.pendingFits.delete(node.id);return;}this.pendingFits.set(node.id,{width:size.width,height:size.height,key:this.nodeKeys.get(node.id)||''});if(!this.gesture)this.nodeFitQueue.schedule();
  }
  private refreshFontMetrics(){if(this.closed||!this.session)return;this.inline?.syncAppearance();for(const node of this.session.board.nodes){const el=this.positions.get(node.id);if(!el||node.locked||node.id===this.inlineTarget)continue;if(node.kind==='text'&&node.autoSize!==false){this.queueTextFit(node);}else if(node.kind==='card'){const preview=el.querySelector<HTMLElement>('.ts-card-preview');if(preview)this.queueCardFit(node,preview);}}}
  private queueCardFit(node:Card,preview:HTMLElement){if(this.previewMetricsReady===false||!node.autoFit||!preview.isConnected||this.inlineId===node.id||this.inlineTarget===node.id)return;this.queueNodeFit(node,measureNoteCard(preview,node.preferredWidth));}
  private flushNodeFits(){if(this.gesture)return;const owner=this.session,fits=new Map(this.pendingFits);this.pendingFits.clear();if(!owner||owner.blocked||this.gesture||this.closed||!fits.size)return;
    const editing=new Set([this.inlineId,this.inlineTarget].filter((id):id is string=>!!id));
    const changes=nodeFitChanges(owner.board.nodes,fits,this.nodeKeys,editing);if(!changes.size)return;
    owner.change(b=>{for(const n of b.nodes){const size=changes.get(n.id);if(size)Object.assign(n,size);}},clone(owner.board),false,false);
  }

  saveView(name:string){const owner=this.requireOwner();owner.change(b=>addSavedView(b,uid(),name));}
  restoreView(id:string){const owner=this.requireOwner(),view=owner.board.savedViews?.find(v=>v.id===id);if(!view)return;this.clearCanvasGesture();this.rememberViewport();owner.board.viewport=clone(view.viewport);this.transform();owner.persist();}
  private headerWorkspaceMenu(anchor:HTMLElement){const owner=this.requireOwner(),menu=new Menu().setUseNativeMenu(false);const add=(title:string,icon:string,run:()=>unknown)=>menu.addItem(i=>i.setTitle(title).setIcon(icon).onClick(()=>act(()=>{this.requireOwner(owner);return run();})));
    add('整理白板','layout-dashboard',()=>this.openLayoutPlanner());add('移入已有分组','folder-input',()=>this.openGroupOrganizer());add('分组预览','list-tree',()=>this.sectionNavigator());
    menu.addSeparator();add('白板写作模式','notebook-pen',()=>this.plugin.openWriting(this));add('打开阅读桌','book-open',()=>this.openReadingDesk());add('打开笔记摘录','notebook-pen',()=>this.openMaterials());add('打开知识空间','network',()=>this.plugin.openSpaceHub());add('日历与日记','calendar-days',()=>this.plugin.ensureJournal(true));
    menu.addSeparator();add(owner.board.mode==='mindmap'?'切换为自由白板':'切换为思维导图','git-fork',()=>this.toggleMindmap());add('导出 Canvas','download',()=>this.exportCanvas());add('快照与导出','history',()=>this.workspaceMenu());
    const box=anchor.getBoundingClientRect();menu.showAtPosition({x:box.right,y:box.bottom+6});
  }
  workspaceMenu(){const owner=this.session;if(!owner)return;const file=owner.file;
    const actions:{title:string;run:()=>unknown}[]=[{title:'保存当前视角…',run:()=>new Prompt(this.app,'保存视角','',name=>{this.requireOwner(owner);this.saveView(name);}).open()},
      {title:'保存布局快照',run:async()=>{await this.plugin.saveLayoutSnapshot(file);new Notice('布局快照已保存');}},
      {title:'恢复布局快照…',run:()=>this.plugin.showSnapshots(file)},
      {title:'复制整张白板',run:async()=>{const copy=await this.plugin.duplicateBoard(file);await this.plugin.openBoard(copy);}},
      {title:'导出 Markdown 大纲',run:()=>this.plugin.exportOutline(file)},
      {title:'导出原生链接索引',run:()=>this.plugin.exportNativeIndex(file)}];
    actions.unshift({title:'管理常用视角…',run:()=>this.openSavedViews()});
    new ActionPicker(this.app,'视角与快照',actions).open();
  }
  boardMenu(file:TFile,event:MouseEvent){const menu=new Menu().setUseNativeMenu(false);const add=(label:string,icon:string,run:()=>unknown)=>menu.addItem(i=>i.setTitle(label).setIcon(icon).onClick(()=>act(run)));
    add('打开白板','panels-top-left',()=>this.navigate(file));add('在新标签页打开','square-arrow-out-up-right',()=>this.app.workspace.getLeaf('tab').openFile(file));
    add('重命名白板','pencil',()=>new Prompt(this.app,'重命名白板',file.basename,async title=>{const path=normalizePath(`${file.parent?.path||''}/${safeName(title)}.${EXT}`);if(path===file.path)return;if(this.app.vault.getAbstractFileByPath(path))throw Error('同名白板已存在');await this.app.fileManager.renameFile(file,path);}).open());
    add(this.plugin.settings.favoriteBoards.includes(file.path)?'取消收藏':'收藏白板','star',()=>this.plugin.toggleFavorite(file));
    add('新建子白板','folder-plus',async()=>{await this.navigate(file);this.newChildBoard();});
    add('复制白板','copy',async()=>{const copy=await this.plugin.duplicateBoard(file);await this.plugin.openBoard(copy);});
    add('复制白板链接','link',()=>navigator.clipboard.writeText(boardLink(this.app.vault.getName(),file.path)));
    add('在文件列表中显示','folder-search',async()=>{const explorer=this.app.workspace.getLeavesOfType('file-explorer')[0];if(explorer){await this.app.workspace.revealLeaf(explorer);fileExplorer(explorer.view)?.revealInFolder(file);}});
    menu.addSeparator();add('保存布局快照','history',async()=>{await this.plugin.saveLayoutSnapshot(file);new Notice('布局快照已保存');});add('恢复布局快照…','rotate-ccw',()=>this.plugin.showSnapshots(file));
    add('导出 Markdown 大纲','file-down',()=>this.plugin.exportOutline(file));add('导出原生链接索引','network',()=>this.plugin.exportNativeIndex(file));
    if(this.file!==file)add('引用到当前白板','plus',()=>this.addBoard(file));menu.showAtMouseEvent(event);
  }
  private buildBatchEdgeTools(host:HTMLElement,owner:Session,nodeIds:ReadonlySet<string>,edges:Board['edges']){
    const scope=host.createEl('label',{cls:'ts-format-field'});scope.createSpan({text:'范围'});
    const scopeInput=scope.createEl('select',{attr:{'aria-label':'批量连线范围',title:'自动跳过锁定或隐藏节点的连线'}});
    scopeInput.createEl('option',{value:'internal',text:'选中对象之间'});scopeInput.createEl('option',{value:'connected',text:'所有相连'});scopeInput.value=this.batchEdgeScope;
    scopeInput.onchange=()=>{if(!scopeInput.isConnected||this.session!==owner||this.batchFormatTarget!=='edges'||this.selected.size!==nodeIds.size||[...nodeIds].some(id=>!this.selected.has(id))||!['internal','connected'].includes(scopeInput.value))return;this.batchEdgeScope=scopeInput.value as SelectionEdgeScope;this.renderSelectionTools();this.renderEdges();};
    const edgeIds=new Set(edges.map(e=>e.id)),scopeAtBuild=this.batchEdgeScope;
    const select=(label:string,options:Record<string,string>,values:string[],patch:(value:string)=>SelectionEdgePatch)=>{
      const field=host.createEl('label',{cls:'ts-format-field',attr:{'data-format':label}});field.createSpan({text:label});
      const input=field.createEl('select',{attr:{'aria-label':label}}),same=values.every(v=>v===values[0]);
      if(!same)input.createEl('option',{value:'',text:'混合'}).disabled=true;
      for(const[value,text]of Object.entries(options))input.createEl('option',{value,text});input.value=same?values[0]:'';input.disabled=owner.blocked||!edges.length;
      input.onchange=()=>act(()=>{
        if(!input.isConnected||input.disabled)return;this.requireOwner(owner);
        if(this.batchFormatTarget!=='edges'||this.batchEdgeScope!==scopeAtBuild||this.selected.size!==nodeIds.size||[...nodeIds].some(id=>!this.selected.has(id)))return;
        const change=patch(input.value);owner.change(b=>{const current=new Set(selectionEdges(b,nodeIds,scopeAtBuild).map(e=>e.id));patchSelectionEdges(b,new Set([...edgeIds].filter(id=>current.has(id))),change);});
      });
    };
    if(!edges.length){host.createSpan({cls:'ts-batch-format-empty',text:'此范围没有可修改的连线'});return;}
    select('连线路径',{curve:'曲线',straight:'直线',elbow:'圆角折线'},edges.map(e=>e.style||'curve'),value=>({style:value as Board['edges'][number]['style']}));
    select('连线方向',{forward:'单向',both:'双向',none:'无箭头'},edges.map(e=>e.direction||'forward'),value=>({direction:value as Board['edges'][number]['direction']}));
    select('连线线型',{solid:'实线',dashed:'虚线'},edges.map(e=>e.dashed?'dashed':'solid'),value=>({dashed:value==='dashed'}));
    select('连线颜色',{default:'默认',...colorNames},edges.map(e=>e.color||'default'),value=>({color:value==='default'?undefined:value as Board['edges'][number]['color']}));
  }
  refreshStyleControls(){this.renderSelectionTools();}
  inputCommandTarget():BoardInputCommandTarget|undefined{
    const owner=this.session;if(!owner||owner.blocked||this.closed||this.gesture||this.marquee||this.rightMarquee||this.linkDrag)return;
    const active=this.contentEl.ownerDocument.activeElement;
    const editing=!!this.inline||!!this.inlineTarget||!!active&&this.contentEl.contains(active)&&!!active.closest('input,textarea,select,[contenteditable=true]');
    const canRun=(action:BoardInputAction)=>{
      if(this.session!==owner||owner.blocked||this.closed)return false;
      const nodes=owner.board.nodes.filter(n=>this.selected.has(n.id));
      if(action==='edit')return nodes.length===1&&!nodes[0].locked&&['card','text'].includes(nodes[0].kind);
      if(action==='focus'||action==='duplicate')return nodes.length>0;
      if(action==='remove')return !!this.selectedEdge||nodes.some(n=>!n.locked);
      if(action==='childTopic'||action==='siblingTopic')return owner.board.mode==='mindmap'&&nodes.length===1&&!nodes[0].locked&&nodes[0].kind!=='section';
      if(action==='parentTopic')return owner.board.mode==='mindmap'&&nodes.length===1&&!!mindmapParent(owner.board,nodes[0].id);
      if(action==='fold'||action==='expand')return nodes.some(n=>!n.locked&&(n.kind==='section'||['card','board','pdf','text'].includes(n.kind)||branchState(owner.board).children.has(n.id)));
      return true;
    };
    return {editing,canRun,run:action=>act(()=>{
      if(!canRun(action)||this.inline||this.inlineTarget)return;
      const ids=new Set(this.selected);
      switch(action){
        case 'newCard':return this.newCard();case 'newText':return this.newText();case 'insertNote':return this.insertExistingNote();
        case 'selection':return this.toggleSelectionTool();case 'connect':return this.toggleConnectionTool();
        case 'fit':return this.fit();case 'focus':return this.focusSelection();case 'reset':this.rememberViewport();this.zoom(1/owner.board.viewport.zoom);return;
        case 'edit':return this.startInlineEdit([...ids][0]);
        case 'undo':return owner.undo();case 'redo':return owner.undo(true);
        case 'newSection':return this.sectionAction();case 'duplicate':return this.duplicateSelection();case 'remove':return this.deleteSelection();
        case 'find':return this.findOnBoard();case 'tidy':return this.openLayoutPlanner();case 'read':return this.openReadingDesk(ids.size?ids:undefined);
        case 'childTopic':return this.addTopic(false);case 'siblingTopic':return this.addTopic(true);
        case 'parentTopic':{const parent=mindmapParent(owner.board,[...ids][0]);if(parent)this.revealNode(parent);return;}

        case 'fold':case 'expand':{
          const folded=action==='fold';
          return this.setSelectionFold(ids,folded);
        }
      }
    })};
  }
  private setSelectionFold(ids:ReadonlySet<string>,folded:boolean,sectionsOnly=false){
    const owner=this.requireOwner(),draft={...owner.board,nodes:owner.board.nodes.map(n=>({...n}))};
    const unlocked=new Set(draft.nodes.filter(n=>ids.has(n.id)&&!n.locked).map(n=>n.id));
    foldSections(draft,unlocked,folded);
    if(!sectionsOnly){
      const branches=branchState(draft),roots=new Set([...unlocked].filter(id=>branches.children.has(id)));
      discloseBranches(draft,roots,folded?'collapse':'level');
      foldCards(draft,new Set([...unlocked].filter(id=>!roots.has(id))),folded);
    }
    if(!draft.nodes.some((n,i)=>n.sectionFolded!==owner.board.nodes[i].sectionFolded||n.branchFolded!==owner.board.nodes[i].branchFolded||n.collapsed!==owner.board.nodes[i].collapsed||n.height!==owner.board.nodes[i].height))return;
    const hidden=branchState(draft).hidden,editing=new Set([this.inlineId,this.inlineTarget].filter((id):id is string=>!!id));
    for(const[id,el]of this.positions)if(el.querySelector('.ts-card-title-input'))editing.add(id);
    if([...editing].some(id=>hidden.has(id)||(folded&&unlocked.has(id)))){new Notice('请先完成内容编辑，再折叠分组或卡片');return;}
    this.clearCanvasGesture();owner.change(b=>{b.nodes=draft.nodes;b.version=draft.version;});
    this.selected=new Set([...this.selected].filter(id=>!hidden.has(id)));
    const edge=owner.board.edges.find(e=>e.id===this.selectedEdge);if(edge&&(hidden.has(edge.from)||hidden.has(edge.to)))this.selectedEdge=undefined;
    this.contextOpen=false;this.renderBoard();
  }
  private copyObjectStyle(ids:ReadonlySet<string>,owner:Session){
    this.requireOwner(owner);if(this.inline?.snapshot().busy||ids.size!==1)return;
    const node=owner.board.nodes.find(n=>ids.has(n.id));if(!node)return;
    this.plugin.copiedNodeStyle=readNodeStyle(node);this.plugin.refreshStyleClipboard();new Notice('已复制外观，可选中其他对象粘贴');
  }
  private pasteObjectStyle(ids:ReadonlySet<string>,owner:Session){
    this.requireOwner(owner);const style=this.plugin.copiedNodeStyle;if(!style||this.inline?.snapshot().busy)return;
    const editable=new Set(owner.board.nodes.filter(n=>ids.has(n.id)&&!n.locked).map(n=>n.id));if(!editable.size)return;
    owner.change(b=>{applyNodeStyle(b,editable,style);for(const n of b.nodes)if(editable.has(n.id)&&n.kind==='text')fitTextNode(n,this.contentEl);});
  }
  private renderSelectionTools(){
    const host=this.selectionTools,owner=this.session;if(!host)return;
    const batch=owner&&!this.selectedEdge&&this.selected.size>1?{target:this.batchFormatTarget,scope:this.batchEdgeScope,edges:selectionEdges(owner.board,this.selected,this.batchEdgeScope)}:undefined;
    const editor=this.inline,key=selectionFormatKey(owner?.board,this.selected,this.selectedEdge,owner?.blocked,batch)+'|'+JSON.stringify([this.inlineId,!!this.inlineAppearance,!!this.plugin?.copiedNodeStyle]);
    const cached=this.selectionFormatCache;
    if(cached?.host===host&&cached.owner===owner&&cached.editor===editor&&cached.key===key)return;
    this.selectionFormatCache=undefined;
    this.buildSelectionTools(batch?.edges);
    this.selectionFormatCache={host,owner,editor,key};
  }
  private buildSelectionTools(batchEdges?:Board['edges']){
    const host=this.selectionTools,owner=this.session;if(!host)return;const editorBefore=this.inline,restoreFocus=preserveToolbarFocus(host);
    try{this.inline?.replaceToolbar();host.empty();
    if(owner&&this.selectedEdge){const edge=owner.board.edges.find(e=>e.id===this.selectedEdge);if(edge){host.addClass('is-visible');
      const select=(label:string,options:Record<string,string>,value:string,apply:(edge:Board['edges'][number],value:string)=>void)=>{const wrap=host.createEl('label',{cls:'ts-format-field',attr:{'data-format':label}});wrap.createSpan({text:label});const input=wrap.createEl('select',{attr:{'aria-label':label}});for(const[v,text]of Object.entries(options))input.createEl('option',{value:v,text});input.value=value;input.disabled=owner.blocked;input.onchange=()=>{this.requireOwner(owner);owner.change(b=>{b.version=3;const current=b.edges.find(e=>e.id===edge.id);if(current)apply(current,input.value);});};};
      select('连线路径',{curve:'曲线',straight:'直线',elbow:'圆角折线'},edge.style||'curve',(e,v)=>e.style=v as typeof e.style);
      select('连线方向',{forward:'单向',both:'双向',none:'无箭头'},edge.direction||'forward',(e,v)=>e.direction=v as typeof e.direction);
      select('连线线型',{solid:'实线',dashed:'虚线'},edge.dashed?'dashed':'solid',(e,v)=>e.dashed=v==='dashed');
      select('连线颜色',{default:'默认',...colorNames},edge.color||'default',(e,v)=>{if(v==='default')delete e.color;else e.color=v as typeof e.color;});
      button(host,'当前路径应用到全部连线','git-commit-horizontal',()=>this.unifyEdgeStyle(edge.style||'curve'),'ts-icon-button');
      button(host,'关系说明','text-cursor-input',()=>this.labelEdge(edge.id),'ts-icon-button');
      button(host,'跳转起点','arrow-left',()=>this.revealNode(edge.from),'ts-icon-button');button(host,'跳转终点','arrow-right',()=>this.revealNode(edge.to),'ts-icon-button');return;
    }}
    const nodes=owner?.board.nodes.filter(n=>this.selected.has(n.id)) || [];host.toggleClass('is-visible',nodes.length>0);if(!owner||!nodes.length)return;
    const ids=new Set(nodes.map(n=>n.id)),texts=nodes.filter(n=>n.kind==='text'||n.kind==='card');
    if(nodes.length>1){
      // Reuse only this synchronous render's scan; edit callbacks revalidate live edges.
      const edges=batchEdges??selectionEdges(owner.board,ids,this.batchEdgeScope);
      const switcher=host.createDiv({cls:'ts-batch-format-switch',attr:{role:'group','aria-label':'批量修改对象或连线'}});
      for(const [target,label,icon]of [['nodes',`对象 ${nodes.length}`,'layers'],['edges',`连线 ${edges.length}`,'git-commit-horizontal']] as const){
        const tab=button(switcher,label,icon,()=>{this.batchFormatTarget=target;this.renderSelectionTools();this.renderEdges();});
        tab.toggleClass('is-active',this.batchFormatTarget===target);tab.setAttribute('aria-pressed',String(this.batchFormatTarget===target));
      }
      if(this.batchFormatTarget==='edges'){
        this.buildBatchEdgeTools(host,owner,ids,edges);return;
      }
    }

    if(nodes.length===1&&(nodes[0].kind==='card'||nodes[0].kind==='text')){
      const node=nodes[0],editor=this.inlineId===node.id?this.inline:undefined;
      if(editor){
        const toggle=button(host,this.inlineAppearance?'Markdown':'外观',this.inlineAppearance?'square-pen':'sliders-horizontal',()=>{if(this.inline!==editor||!toggle.isConnected)return;this.inlineAppearance=!this.inlineAppearance;this.renderSelectionTools();editor.input.focus({preventScroll:true});},'ts-md-mode');
        toggle.onmousedown=e=>e.preventDefault();toggle.setAttribute('aria-pressed',String(this.inlineAppearance));toggle.title=this.inlineAppearance?'返回 Markdown 编辑工具':'调整字体、颜色与边框';
        if(!this.inlineAppearance){markdownToolbar(host,editor);return;}
      }else{const edit=button(host,'编辑 Markdown','square-pen',()=>this.startInlineEdit(node.id),'ts-md-mode');edit.disabled=owner.blocked||!!node.locked;}
    }
    const transfer=host.createDiv({cls:'ts-style-transfer',attr:{role:'group','aria-label':'复制与粘贴外观'}});
    const copy=button(transfer,'复制对象样式','pipette',()=>this.copyObjectStyle(ids,owner),'ts-icon-button');
    const paste=button(transfer,'粘贴对象样式','paintbrush',()=>this.pasteObjectStyle(ids,owner),'ts-icon-button');
    copy.disabled=owner.blocked||nodes.length!==1;paste.disabled=owner.blocked||!this.plugin.copiedNodeStyle||nodes.every(n=>n.locked);
    for(const control of [copy,paste])control.onmousedown=e=>e.preventDefault();
    const select=(label:string,options:Record<string,string>,values:string[],apply:(b:Board,value:string)=>void)=>{
      const wrap=host.createEl('label',{cls:'ts-format-field',attr:{'data-format':label}});
      const icon=({'卡片样式':'layers','卡片颜色':'paint-bucket','字体':'type','字号':'a-large-small','文字颜色':'baseline','文字对齐':'align-left','边框线型':'square-dashed','边框粗细':'equal','边框颜色':'pencil-line'} as Record<string,string>)[label];
      if(icon)setIcon(wrap.createSpan({cls:'ts-format-label-icon',attr:{'aria-hidden':'true'}}),icon);
      wrap.createSpan({cls:'ts-format-label',text:({'卡片样式':'卡片','卡片颜色':'底色','文字颜色':'字色','文字对齐':'对齐','边框线型':'边框','边框粗细':'线宽','边框颜色':'线色'} as Record<string,string>)[label]||label});
      const input=wrap.createEl('select',{attr:{'aria-label':label,title:label}});const same=values.every(v=>v===values[0]);
      if(!same)input.createEl('option',{value:'',text:'混合'}).disabled=true;
      for(const [value,text] of Object.entries(options))input.createEl('option',{value,text});input.value=same?values[0]:'';input.disabled=owner.blocked||nodes.some(n=>n.locked);
      input.onchange=()=>act(()=>{if(!input.isConnected||input.disabled||this.inline?.snapshot().busy)return;this.requireOwner(owner);const value=input.value;owner.change(b=>{b.version=3;apply(b,value);});});
    };
    const cards=nodes.filter(n=>(n.kind==='card'||n.kind==='text'));
    if(cards.length){const values=cards.map(n=>n.fillColor||'none'),custom=values.find(c=>c.startsWith('#'));
      select('卡片样式',{solid:'默认',transparent:'透明'},cards.map(n=>n.transparent?'transparent':'solid'),(b,value)=>b.nodes.filter(n=>ids.has(n.id)&&(n.kind==='card'||n.kind==='text')&&!n.locked).forEach(n=>{if(value==='transparent')n.transparent=true;else delete n.transparent;}));
      select('卡片颜色',{none:'默认底色',...colorNames,...(custom?{[custom]:'自定义 '+custom}:{})},values,(b,value)=>b.nodes.filter(n=>ids.has(n.id)&&(n.kind==='card'||n.kind==='text')&&!n.locked).forEach(n=>{delete n.transparent;n.fillColor=value as Card['fillColor'];}));
      const wrap=host.createEl('label',{cls:'ts-format-field ts-fill-custom'});wrap.createSpan({text:'自定'});const color=wrap.createEl('input',{type:'color',attr:{'aria-label':'自定义卡片颜色',title:'选择任意卡片背景色'}});color.value=custom||cardFillHex[(values[0]==='none'?'sand':values[0]) as Card['color']]||'#e8d8a8';color.disabled=owner.blocked||cards.some(n=>n.locked);color.onchange=()=>act(()=>{if(!color.isConnected||color.disabled||this.inline?.snapshot().busy)return;this.requireOwner(owner);const value=color.value;owner.change(b=>{b.version=3;for(const n of b.nodes)if(ids.has(n.id)&&(n.kind==='card'||n.kind==='text')&&!n.locked){delete n.transparent;n.fillColor=value as Card['fillColor'];}});});
    }
    const patchText=(patch:Partial<Card>)=>(b:Board)=>b.nodes.filter(n=>ids.has(n.id)&&(n.kind==='text'||n.kind==='card')).forEach(n=>{Object.assign(n,patch);if(n.kind==='text')fitTextNode(n,this.contentEl);});
    if(texts.length){
      select('字体',{default:'正文字体',serif:'衬线字体',mono:'等宽字体'},texts.map(n=>n.fontFamily||'default'),(b,value)=>patchText({fontFamily:value as Card['fontFamily']})(b));
      select('字号',Object.fromEntries([...new Set([12,14,16,18,20,24,32,48,...texts.map(n=>n.fontSize||(n.kind==='card'?14:16))])].sort((a,b)=>a-b).map(size=>[String(size),`${size} px`])),texts.map(n=>String(n.fontSize||(n.kind==='card'?14:16))),(b,value)=>patchText({fontSize:Number(value)})(b));
      select('文字颜色',inkLabels,texts.map(n=>n.textColor||'default'),(b,value)=>patchText({textColor:value as Card['textColor']})(b));
      select('文字对齐',{left:'左对齐',center:'居中',right:'右对齐'},texts.map(n=>n.textAlign||'left'),(b,value)=>patchText({textAlign:value as Card['textAlign']})(b));
    }
    select('边框线型',{solid:'实线',dashed:'虚线',dotted:'点线'},nodes.map(n=>n.borderStyle||'solid'),(b,value)=>b.nodes.filter(n=>ids.has(n.id)).forEach(n=>n.borderStyle=value as Card['borderStyle']));
    select('边框粗细',{'0':'无边框','1':'细 · 1','2':'标准 · 2','3':'粗 · 3','4':'加粗 · 4'},nodes.map(n=>String(n.borderWidth??1)),(b,value)=>b.nodes.filter(n=>ids.has(n.id)).forEach(n=>{n.borderWidth=Number(value);if(n.kind==='text')fitTextNode(n,this.contentEl);}));
    select('边框颜色',{default:'默认样式',...colorNames},nodes.map(n=>n.customBorder?n.color:'default'),(b,value)=>{if(value!=='default'&&!['sand','blue','green','rose','purple'].includes(value))b.version=3;b.nodes.filter(n=>ids.has(n.id)&&!n.locked).forEach(n=>{if(value==='default')delete n.customBorder;else{n.color=value as Card['color'];n.customBorder=true;}});});
    if(this.inline){
      const editor=this.inline,controls=Array.from(host.querySelectorAll<HTMLInputElement|HTMLSelectElement>('select,input'));
      const sync=()=>{const state=editor.snapshot(),disabled=!!state.busy||owner.blocked||owner.board.nodes.some(n=>ids.has(n.id)&&n.locked);for(const control of controls){if(control.disabled!==disabled)control.disabled=disabled;const title=state.busy?state.disabledReason||'编辑器忙碌中':control.ariaLabel||'';if(control.title!==title)control.title=title;}};
      editor.input.addEventListener('select',sync);editor.replaceToolbar(()=>editor.input.removeEventListener('select',sync));sync();
    }
    }finally{if(this.inline===editorBefore)restoreFocus();}
  }
  private renderInspector() {
    this.renderSelectionTools();
    if(!this.inspector)return;this.inspector.empty();
    if(!this.contextOpen){this.inspector.removeClass('is-visible');return;}
    const choice=this.inspectorChoiceState;
    if(choice && choice.owner===this.session && choice.key===JSON.stringify([[...this.selected],this.selectedEdge,this.contextPoint])){this.inspectorChoices(choice.title,choice.choices,choice.grid);return;}
    this.inspectorChoiceState=undefined;
    const owner=this.session,visible=!!owner && (this.selected.size>0 || !!this.selectedEdge || !!this.contextPoint || this.mode==='connect');
    this.inspector.toggleClass('is-visible',visible);if(!visible || !owner)return;
    const heading=this.inspector.createDiv('ts-inspector-heading');heading.createSpan({text:this.mode==='connect'?'建立连线':this.selectedEdge?'连线操作':this.selected.size?`已选 ${this.selected.size} 项`:'画布操作',cls:'ts-muted'});
    button(heading,'关闭操作面板','x',()=>{this.contextOpen=false;this.contextPoint=undefined;this.mode='select';this.connectFrom=undefined;this.connectButton?.removeClass('is-active');this.updateSelection();},'ts-inspector-close');
    if(this.mode==='connect'){this.inspector.createSpan({text:this.connectFrom?'再点击目标建立连线 · Esc 退出':'依次点击两个对象 · Esc 退出',cls:'ts-muted'});return;}
    // Object actions use the native pointer menu; this panel only hosts legacy choices.
  }
  private inspectorChoices(title:string,choices:{label:string;checked?:boolean;swatch?:string;run:()=>unknown}[],grid=false){
    this.inspectorChoiceState={title,choices,grid,owner:this.session,key:JSON.stringify([[...this.selected],this.selectedEdge,this.contextPoint])};
    this.inspector.empty();this.inspector.addClass('is-visible');const heading=this.inspector.createDiv('ts-inspector-heading');button(heading,'返回操作','arrow-left',()=>{this.inspectorChoiceState=undefined;this.renderInspector();},'ts-inspector-close');heading.createSpan({text:title});
    const body=this.inspector.createDiv(grid?'ts-choice-grid':'ts-choice-list');
    for(const choice of choices){const b=button(body,choice.label,'',()=>{this.inspectorChoiceState=undefined;return choice.run();},'ts-choice');b.setAttribute('aria-pressed',String(!!choice.checked));b.toggleClass('is-active',!!choice.checked);if(choice.swatch){b.addClass(`ts-color-${choice.swatch}`);b.createEl('i',{prepend:true});}}
  }
  private deleteSelection() { this.mutate(b => { if (this.selectedEdge) b.edges = b.edges.filter(e => e.id !== this.selectedEdge); else removeNodes(b,new Set(b.nodes.filter(n=>this.selected.has(n.id)&&!n.locked).map(n=>n.id))); }); this.selected.clear(); this.selectedEdge = undefined; this.renderBoard(); }
  canReuseSelection(){return this.selected.size>0;}
  private reuseModal?:BoardReuseModal;
  async openReuse(){
    const owner=this.requireOwner();if(this.reuseModal?.modalEl.isConnected)return this.reuseModal;if(!this.selected.size)throw Error('请先选择要复用的内容');
    if(this.inline&&!await this.inline.commit())throw Error('请先处理编辑保存冲突');this.requireOwner(owner);this.clearCanvasGesture();const ids=new Set(this.selected);
    const modal=new BoardReuseModal(this.app,{title:owner.file.basename,bundle:branches=>{this.requireOwner(owner);return reuseBundle(owner.board,ids,branches);},
      pick:done=>new BoardPicker(this.app,owner.file,async file=>{this.requireOwner(owner);done({path:file.path,title:file.basename,board:await this.plugin.readBoard(file)});}).open(),
      apply:(destination,name,options,expected)=>this.applyReuse(ids,destination,name,options,expected,owner,()=>{if(!modal.modalEl.isConnected)throw Error('复用窗口已关闭');})});this.reuseModal=modal;modal.open();return modal;
  }
  private reuseBusy=false;
  async applyReuse(ids:ReadonlySet<string>,destination:ReuseDestination|null,name:string,options:ReuseOptions,expected:ReuseBundle,owner=this.session,alive=()=>{}){
    if(this.reuseBusy)throw Error('正在添加，请稍候');this.requireOwner(owner);this.reuseBusy=true;
    const ensure=()=>{alive();this.requireOwner(owner);if(this.app.vault.getAbstractFileByPath(owner!.file.path)!==owner!.file)throw Error('来源白板已删除');if(JSON.stringify(reuseBundle(owner!.board,ids,options.branches))!==JSON.stringify(expected))throw Error('所选内容已变化，请关闭窗口后重新预览');};
    try{return await this.plugin.hierarchy(async()=>{
      ensure();if(destination?.path===owner!.file.path)throw Error('请选择另一张白板');
      const bundle=clone(expected),folder=owner!.file.parent?.path||'',targetPath=destination?.path||normalizePath(folder+'/新白板.thoughtspace');
      for(const n of bundle.nodes){if(n.file){const ref=this.app.vault.getAbstractFileByPath(n.file);if(!(ref instanceof TFile))throw Error(`引用文件已不存在：${n.file}`);}
        if(n.kind==='text'&&n.text)n.text=rebaseReuseSources(n.text,link=>{const parts=parseLinktext(sourceLinkTarget(link)),ref=this.app.metadataCache.getFirstLinkpathDest(parts.path,owner!.file.path);if(!(ref instanceof TFile))throw Error('摘录来源无法解析，请先修复来源链接');return this.app.fileManager.generateMarkdownLink(ref,targetPath,parts.subpath);});}
      let targetFile:TFile,session:Session|undefined,committed=false;let plan:ReturnType<typeof reusePlan>;
      try{
        if(destination){const file=this.app.vault.getAbstractFileByPath(destination.path);if(!(file instanceof TFile)||file.extension!==EXT)throw Error('目标白板已移动或删除，请重新选择');targetFile=file;
          session=await this.plugin.session(file);await session.flush();await session.externalUpdate();ensure();if(session.blocked)throw Error('目标白板写入暂停，请先解决保存冲突');
          for(const n of bundle.nodes.filter(n=>n.kind==='board')){const child=this.app.vault.getAbstractFileByPath(n.file!);if(!(child instanceof TFile))throw Error('引用白板已不存在');await this.plugin.assertCanNest(file,child);}
          ensure();if(this.app.vault.getAbstractFileByPath(destination.path)!==file||file.path!==destination.path)throw Error('目标白板已变化，请重新选择');if(reuseStamp(session.board)!==reuseStamp(destination.board))throw Error('目标布局已变化，请重新选择目标并预览');
          const editing=this.app.workspace.getLeavesOfType(VIEW).some(l=>l.view instanceof BoardView&&l.view.file===file&&l.view.inline);if(editing)throw Error('目标白板正在编辑，请先完成目标中的编辑再添加');
          ensure();if(session.blocked)throw Error('目标白板不可写入');plan=reusePlan(bundle,session.board,options,uid);session.change(b=>{b.version=3;b.nodes.push(...plan.nodes);b.edges.push(...plan.edges);});committed=true;
        }else{
          if(!name.trim()||name.trim().length>100)throw Error('请填写 1–100 个字符的新白板名称');
          const before={...emptyBoard(),version:3 as const};plan=reusePlan(bundle,before,options,uid);ensure();
          // Write the complete new board once, so failures cannot strand an empty destination.
          targetFile=await this.plugin.createUnique(folder,name,EXT,JSON.stringify({...before,nodes:plan.nodes,edges:plan.edges},null,2));committed=true;session=await this.plugin.session(targetFile);session.history.push(before);
        }
        await session.flush();if(session.blocked)throw Error('目标保存失败；原白板保留，请检查恢复草稿');
        await this.plugin.openBoard(targetFile);const target=this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).find(v=>v instanceof BoardView&&v.file===targetFile) as BoardView|undefined;
        if(target?.session){target.objectFilter={kind:'',color:'',query:''};target.relatedFocus=undefined;target.relationLens=undefined;target.selected=new Set(plan.nodes.map(n=>n.id));target.updateSelection();target.focusSelection();}
        new Notice(`已添加 ${bundle.nodes.length} 个对象与 ${bundle.edges.length} 条连线；原笔记共用，可在目标白板撤销`);return {file:targetFile,ids:plan.nodes.map(n=>n.id)};
      }catch(e){if(committed){const error=Error(`${String(e)}。本次已提交，请关闭窗口并检查目标或恢复草稿，勿重复添加`);Object.assign(error,{committed:true});throw error;}throw e;}
      finally{if(session&&!session.listeners.size)await this.plugin.release(session);}
    });}finally{this.reuseBusy=false;}
  }
  private duplicateSelection() {
    const owner = this.session; if (!owner || owner.blocked) return;
    const ids = expandedSelection(owner.board, this.selected), copies = owner.board.nodes.filter(n => ids.has(n.id));
    if (!copies.length) return;
    const replacements = new Map(copies.map(n => [n.id, uid()]));
    const nodes = copies.map(n => ({ ...clone(n), id: replacements.get(n.id)!, x: n.x + 36, y: n.y + 36 }));
    const edges = owner.board.edges.filter(e => ids.has(e.from) && ids.has(e.to)).map(e => ({ ...e, id: uid(), from: replacements.get(e.from)!, to: replacements.get(e.to)! }));
    this.selected = new Set(nodes.map(n => n.id)); this.selectedEdge = undefined;
    owner.change(b => { b.nodes.push(...nodes); b.edges.push(...edges); });
  }
  /** 菜单绑定打开时的会话和选择，避免异步选择器写到后来切换的白板。 */
  private contextMenu(e: MouseEvent) {
    // macOS can dispatch this before release; other platforms dispatch it afterwards.
    // Delay a blank-canvas right click until it is distinguishable from a marquee.
    if(e.button===2&&this.rightMarquee){e.preventDefault();e.stopPropagation();this.rightMarquee.menu=e;return;}
    if(e.button===2&&this.suppressBoardContext){e.preventDefault();e.stopPropagation();return;}
    this.showBoardContextMenu(e);
  }
  private showBoardContextMenu(e:MouseEvent){
    const owner = this.session; if (!owner) return;
    e.preventDefault(); e.stopPropagation();
    this.clearCanvasGesture();this.finishMarquee(true);
    const target = e.target as Element;
    const node = owner.board.nodes.find(n => n.id === target.closest('[data-id]')?.getAttribute('data-id'));
    const edge = !node && owner.board.edges.find(n => n.id === target.closest('[data-edge]')?.getAttribute('data-edge'));
    this.space = false; this.mode = 'select'; this.connectFrom = undefined;this.connectSide=undefined;this.stage?.removeClass('ts-connecting'); this.connectButton?.removeClass('is-active');
    if (node) { if (!this.selected.has(node.id)) this.selected = new Set([node.id]); this.selectedEdge = undefined; }
    else { this.selected.clear(); this.selectedEdge = edge ? edge.id : undefined; }
    this.inspectorChoiceState=undefined;
    this.contextOpen=false;this.contextPoint=undefined;
    this.objectMenu?.hide();this.updateSelection();
    const menu=new Menu();this.objectMenu=menu;
    menu.onHide(()=>{if(this.objectMenu===menu)this.objectMenu=undefined;});
    this.renderObjectActions(menu,node||undefined,edge||undefined,this.point(e.clientX,e.clientY));
    menu.showAtMouseEvent(e);
  }
  /** Compact native context menu; Obsidian handles pointer placement, edges and keyboard navigation. */
  private renderObjectActions(menu:Menu,node:Card|undefined,edge:Board['edges'][number]|undefined,position:{x:number;y:number}) {
    const owner=this.session;if(!owner)return;
    const ids=new Set(this.selected),edgeId=this.selectedEdge;
    const restore=()=>{
      this.requireOwner(owner);
      this.selected=new Set([...ids].filter(id=>owner.board.nodes.some(n=>n.id===id)));
      this.selectedEdge=owner.board.edges.some(e=>e.id===edgeId)?edgeId:undefined;
    };
    const add=(title:string,icon:string,run:()=>unknown,write=true,disabled=false)=>{
      menu.addItem(item=>item.setTitle(title).setIcon(icon).setDisabled(disabled||(write&&owner.blocked)).onClick(()=>{
        if(this.session!==owner||this.closed)return;
        act(()=>{if(write)restore();return run();});
      }));
    };
    if(edge){
      add('修改关系说明','pencil',()=>this.labelEdge(edge.id));
      add('连线样式…','sliders-horizontal',()=>this.styleEdge(edge.id));
      add(edge.kind==='branch'?'取消父子分支关系':'允许折叠（设为父子分支）','git-branch',()=>owner.change(b=>{if(edge.kind==='branch'){const current=b.edges.find(e=>e.id===edge.id);if(current)delete current.kind;}else makeChildConnection(b,edge.id);}));
      add('反转连线方向','arrow-left-right',()=>owner.change(b=>{const e=b.edges.find(n=>n.id===edge.id);if(e){[e.from,e.to]=[e.to,e.from];[e.fromSide,e.toSide]=[e.toSide,e.fromSide];delete e.kind;}}));
      menu.addSeparator();add('删除连线','unlink',()=>this.deleteSelection());return;
    }
    if(!node){
      add('在此新建卡片','plus',()=>this.newCard(position));
      add('在此插入笔记或 PDF…','file-input',()=>this.insertExistingNote(position));
      add('在此添加文本','type',()=>this.newText(position));add('在此添加表格','table-2',()=>this.newTable(position));
      add('在此添加图片','image-plus',()=>this.imageMenu(position));
      add('在此新建分组框','square-plus',()=>this.newSection(position));
      menu.addSeparator();
      add('全选','scan',()=>{this.selected=new Set(owner.board.nodes.map(n=>n.id));this.updateSelection();},false);
      add('整理整个白板…','layout-grid',()=>this.openLayoutPlanner());
      add('适应全部内容','maximize',()=>this.fit(),false);return;
    }
    if(ids.size===1){
      const file=node.file?this.app.vault.getAbstractFileByPath(node.file):null;
      const locked=!!node.locked;
      if(node.kind==='card'){
        add('修改卡片标题','pencil-line',()=>{
          this.positions.get(node.id)?.querySelector<HTMLElement>('.ts-card-note-title')?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
        },true,locked);
        add('编辑卡片','pencil',()=>this.startInlineEdit(node.id),true,locked||!(file instanceof TFile));
        add('编辑标签','tags',()=>{if(file instanceof TFile)this.plugin.editNativeTags(file);},true,locked||!(file instanceof TFile));
        add('右侧打开笔记','panel-right',()=>file instanceof TFile&&this.plugin.openNoteInSidebar(file),false,!(file instanceof TFile));
        add('自动适应笔记大小','scan-text',()=>this.fitCards(ids,true),true,locked);
      }else if(node.kind==='text'){
        add('编辑文本','pencil',()=>this.editText(node.id),true,locked);
        add(node.collapsed?'展开文本':'折叠文本',node.collapsed?'chevron-down':'chevron-up',()=>this.foldSelection(!node.collapsed),true,locked);
        add('转换为笔记','file-plus-2',()=>this.promptTextToNote(node.id),true,locked);
      }else if(node.kind==='image'){
        add('打开图片','external-link',()=>file instanceof TFile&&this.app.workspace.getLeaf('tab').openFile(file),false,!(file instanceof TFile));
        add('上传到极速图床','cloud-upload',()=>this.uploadExistingImage(node.id),true,locked);
      }else if(node.kind==='pdf'){
        add('右侧阅读 PDF','panel-right',()=>file instanceof TFile&&this.plugin.openNoteInSidebar(file,pdfSubpath(node.pdfPage)),false,!(file instanceof TFile));
        add(node.collapsed?'展开 PDF':'折叠 PDF',node.collapsed?'chevron-down':'chevron-up',()=>this.foldSelection(!node.collapsed),true,locked);
        add('选择 PDF 页码…','hash',()=>this.choosePdfPage(node.id),true,locked);
      }else if(node.kind==='board'){
        add('进入子白板','arrow-up-right',()=>file instanceof TFile&&this.enterBoard(file),false,!(file instanceof TFile));
        add(node.collapsed?'展开子白板':'折叠子白板',node.collapsed?'chevron-down':'chevron-up',()=>this.foldSelection(!node.collapsed),true,locked);
      }else{
        add('重命名分组框','pencil',()=>this.renameSection(node.id),true,locked);
        add('选择框内内容','scan',()=>{this.selected=new Set(owner.board.nodes.filter(n=>contained(node,n)).map(n=>n.id));this.updateSelection();},false);
        add('分组框贴合内容','group',()=>owner.change(b=>fitSections(b,ids)),true,locked);
      }
      if(branchState(owner.board).children.has(node.id)){add('折叠子节点','list-collapse',()=>this.foldBranches(ids,true,'collapse'));add('展开下一层','list-tree',()=>this.foldBranches(ids,false,'level'));add('展开所有子节点','unfold-vertical',()=>this.foldBranches(ids,false,'all'));}
      if(!branchState(owner.board).children.has(node.id)&&childConnectionCandidates(owner.board,ids).has(node.id))add('设为子节点并折叠','git-branch',()=>this.foldBranches(ids,true,'collapse',true),true,locked);
      {
        if(node.kind!=='section'&&owner.board.mode==='mindmap')add('添加子主题','corner-down-right',()=>this.addTopic(),true,locked);
        add('从此处开始连线','move-up-right',()=>{this.mode='connect';this.connectFrom=node.id;this.connectSide=undefined;this.connectButton?.addClass('is-active');this.stage.focus();},true,locked);
      }
      menu.addSeparator();
    }
    if(node.kind==='section'&&ids.size===1)add(node.sectionFolded?'展开分组':'折叠分组',node.sectionFolded?'chevron-down':'chevron-up',()=>this.setSelectionFold(ids,!node.sectionFolded,true),true,owner.blocked||!!node.locked);
    add(ids.size>1?'复制所选引用':node.kind==='section'?'复制分组及内容':'复制引用','copy',()=>this.duplicateSelection());
    add(owner.board.nodes.filter(n=>ids.has(n.id)).every(n=>n.locked)?'解锁所选':'锁定所选','lock',()=>owner.change(b=>{const nodes=b.nodes.filter(n=>ids.has(n.id)),unlock=nodes.every(n=>n.locked);nodes.forEach(n=>n.locked=!unlock);}));
    if(ids.size>1)add('建立命名分组框','group',()=>this.newSection(position));
    add('移入已有分组…','folder-input',()=>this.openGroupOrganizer());
    add(node.kind==='section'&&ids.size===1?'整理分组内容…':'整理布局…','layout-grid',()=>this.openLayoutPlanner());
    menu.addSeparator();
    add(node.kind==='section'&&ids.size===1?'移除分组框（保留内容）':ids.size>1?'移出所选内容（保留文件）':'移出白板（保留文件）','trash-2',()=>this.deleteSelection());
  }
  private clearCanvasGesture(){
    this.cancelRightMarquee();this.cancelConnection();this.flushPointer(false);
    this.finishMarquee(true);this.setSectionTool(false);
    if(this.gesture&&this.session)this.pointerUp(new PointerEvent('pointercancel',{pointerId:this.gesture.id}),true);
    this.previewGridLanding();this.drawAlignmentGuides([]);
  }
  private syncCanvasControls(){
    this.contentEl.classList.toggle('ts-has-edge',!!this.session?.board.edges.some(e=>e.id===this.selectedEdge));
    const enabled=!!this.session?.board.snapToGrid;
    this.contentEl.dataset.snap=String(enabled);if(!enabled)this.previewGridLanding();
    if(this.snapToggle){this.snapToggle.toggleClass('is-active',enabled);this.snapToggle.setAttribute('aria-pressed',String(enabled));this.snapToggle.title=enabled?'网格吸附已开启 · 拖动松手后对齐':'网格吸附已关闭 · 自由移动';this.snapToggle.querySelector('.ts-snap-state')?.setText(enabled?'开启':'关闭');this.snapToggle.disabled=!this.session||this.session.blocked;}
    if(this.gridSelect)this.gridSelect.value=String(this.plugin.settings.gridStep);
    const paperSettings=this.canvasControls?.querySelector<HTMLButtonElement>('.ts-paper-settings-entry');if(paperSettings)paperSettings.hidden=this.plugin.settings.canvasBackground!=='paper';
    this.canvasControls?.querySelectorAll<HTMLButtonElement>('[data-background-choice]').forEach(b=>{const active=b.dataset.backgroundChoice===this.plugin.settings.canvasBackground;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});
    const movable=this.session?.board.nodes.filter(n=>this.selected.has(n.id)&&!n.locked).length||0;
    this.canvasSummary?.setText(this.selected.size?`已选 ${this.selected.size} 项${movable!==this.selected.size?' · 含锁定对象':''}`:`${this.session?.board.nodes.length||0} 个对象`);
    this.contentEl.classList.toggle('ts-has-selection',this.selected.size>0);
  }
  private drawAlignmentGuides(guides:Guide[]){
    const v=this.session?.board.viewport;if(!v)return;
    for(let i=0;i<2;i++){const guide=guides[i];let el=this.alignmentLines[i];if(!guide){el?.remove();this.alignmentLines[i]=undefined!;continue;}if(!el?.isConnected){el=this.stage.createDiv({cls:'ts-alignment-guide',attr:{'aria-hidden':'true'}});this.alignmentLines[i]=el;}
      el.dataset.axis=guide.axis;const vertical=guide.axis==='x';Object.assign(el.style,{left:`${(vertical?guide.value:guide.start)*v.zoom+v.x}px`,top:`${(vertical?guide.start:guide.value)*v.zoom+v.y}px`,width:vertical?'1px':`${(guide.end-guide.start)*v.zoom}px`,height:vertical?`${(guide.end-guide.start)*v.zoom}px`:'1px'});
    }
  }
  private previewGridLanding(ids?:ReadonlySet<string>,excludeAxes?:ReadonlySet<'x'|'y'>){
    if(!this.snapTarget||!this.snapReadout)return;
    const board=ids&&this.session?.board.snapToGrid?this.displayBoard():undefined,point=ids&&board?gridLanding(board,ids,this.plugin.settings.gridStep,excludeAxes):undefined;
    this.snapTarget.classList.toggle('is-visible',!!point);this.snapReadout.classList.toggle('is-visible',!!point);if(!point||!board)return;
    const x=point.x*board.viewport.zoom+board.viewport.x,y=point.y*board.viewport.zoom+board.viewport.y;
    this.snapTarget.style.transform=`translate(${x}px,${y}px)`;
    this.snapReadout.style.left=`${Math.max(8,Math.min(this.stage.clientWidth-145,x+18))}px`;this.snapReadout.style.top=`${Math.max(8,Math.min(this.stage.clientHeight-80,y-34))}px`;this.snapReadout.setText(`吸附落点  ${point.x}, ${point.y}`);
  }
  private syncSelectionTool() { this.selectionButton?.toggleClass('is-active',this.selectionTool);this.selectionButton?.setAttribute('aria-pressed',String(this.selectionTool));this.stage?.toggleClass('ts-select-tool',this.selectionTool); }
  private toggleConnectionTool(){const active=this.mode!=='connect';this.clearCanvasGesture();this.selectionTool=false;this.syncSelectionTool();this.mode=active?'connect':'select';this.connectButton?.toggleClass('is-active',active);this.stage.focus();this.renderInspector();}
  toggleSelectionTool(){const active=!this.selectionTool;this.clearCanvasGesture();this.selectionTool=active;this.syncSelectionTool();this.stage.focus();}
  private finishMarqueeFromDocument(e:PointerEvent,cancelled=false){if(this.marquee?.id===e.pointerId||this.rightMarquee?.id===e.pointerId)this.pointerUp(e,cancelled);}
  private pointerCaptureLost(e:PointerEvent){if(this.rightMarquee?.id===e.pointerId){this.pointerUp(e,true);return;}if(this.linkDrag?.id===e.pointerId)this.finishLinkDrag(e,true);if(this.gesture?.id===e.pointerId)this.pointerUp(e,true);if(this.marquee?.id===e.pointerId)this.finishMarquee(true);}
  private cancelRightMarquee(){
    if(this.rightMarquee)this.pointerUp(this.rightMarquee.event,true);
  }
  private finishMarquee(cancelled=false){
    this.flushPointer(!cancelled);
    const m=this.marquee;if(!m)return;this.marquee=undefined;m.box.remove();
    if(this.stage.hasPointerCapture(m.id))this.stage.releasePointerCapture(m.id);
    if(cancelled){this.selected=m.base;this.selectedEdge=m.baseEdge;}
    if(m.section){this.setSectionTool(false);if(!cancelled&&m.rect&&validSectionRect(m.rect))this.newSection(undefined,m.rect);}
    this.updateSelection();
  }
  private foldText(id:string,fold:boolean){if(fold&&(this.inlineId===id||this.inlineTarget===id)){new Notice('请先完成文本编辑，再折叠');return;}this.mutate(b=>foldCards(b,new Set([id]),fold));}
  private foldSelection(fold:boolean){if(fold&&[this.inlineId,this.inlineTarget].some(id=>id&&this.selected.has(id))){new Notice('请先完成内容编辑，再折叠');return;}this.mutate(b=>foldCards(b,this.selected,fold));}
  private focusSelection(){if(!this.session||this.session.blocked||!this.selected.size)return;const ids=expandedSelection(this.session.board,this.selected),nodes=visibleBranchBoard(this.session.board).nodes.filter(n=>ids.has(n.id));this.rememberViewport();this.session.board.viewport=fitViewport(nodes,this.stage.clientWidth,Math.max(100,this.stage.clientHeight-110));this.transform();this.session.persist();}
  private alignmentMenu(_event?:MouseEvent){
    const owner=this.session,ids=new Set(this.selected);if(!owner||owner.blocked)return;
    this.inspectorChoices('对齐与分布',Object.entries(alignmentLabels).map(([action,label])=>({label,run:()=>{this.requireOwner(owner);owner.change(b=>alignSelection(b,ids,action as Alignment));}})));
  }
  private pointerDown(e: PointerEvent) {
    // A new physical click must never inherit suppression from a previous drag.
    if(e.button===2||(e.button===0&&e.ctrlKey)||e.pointerType==='touch')this.suppressBoardContext=false;
    if (!this.session || this.session.blocked || e.button > 2 || this.gesture || this.marquee || this.rightMarquee || this.linkDrag) return;
    // macOS Control + 单击也会触发右键菜单，不能先作为左键拖动或连线处理。
    if (e.button === 0 && e.ctrlKey) return;
    const target = e.target as Element;
    const dragAction=(button:number)=>{const value=this.plugin.settings[button===0?'leftDrag':button===1?'middleDrag':'rightDrag'];return value==='pan'||value==='select'||value==='none'?value:button===2?'select':'pan';};
    if(e.button===2){
      if(this.space||target.closest('a,input,textarea,select,button,[contenteditable=true],.ts-inline-editor')||target.closest('[data-id]')||target.closest('[data-edge]'))return;
      const action=dragAction(2);if(action==='none')return;
      this.rightMarquee={id:e.pointerId,x:e.clientX,y:e.clientY,start:this.point(e.clientX,e.clientY),event:e,owner:this.session,moved:false,additive:e.shiftKey,action,viewport:{...this.session.board.viewport}};
      this.stage.focus();e.preventDefault();return;
    }
    let selectionChanged=this.contextOpen||!!this.contextPoint||!!this.inspectorChoiceState;
    this.contextOpen=false;this.contextPoint=undefined;this.inspectorChoiceState=undefined;
    const handle=target.closest<SVGElement>('[data-edge-end]');if(handle&&e.button===0){const edge=this.session.board.edges.find(edge=>edge.id===handle.dataset.edge);if(edge){const end=handle.dataset.edgeEnd as 'from'|'to';this.startLinkDrag(e,end==='from'?edge.to:edge.from,end==='from'?edge.toSide:edge.fromSide,{id:edge.id,end,expected:JSON.stringify(edge)});}return;}
    if (target.closest('a,input,textarea,select,button,[contenteditable=true],.ts-inline-editor')) return;
    this.stage.focus();
    if(this.sectionTool&&!this.space&&e.button===0){
      const start=this.point(e.clientX,e.clientY),box=this.world.createDiv('ts-marquee ts-section-draft');
      Object.assign(box.style,{left:`${start.x}px`,top:`${start.y}px`,width:'0px',height:'0px'});
      this.marquee={id:e.pointerId,start,base:new Set(this.selected),box,section:true};this.stage.setPointerCapture(e.pointerId);e.preventDefault();return;
    }
    const edge = target.closest('[data-edge]')?.getAttribute('data-edge');
    if (edge && !this.space && e.button === 0) { this.cancelConnection();this.selected.clear(); this.selectedEdge = edge; this.updateSelection(); return; }
    const id = target.closest('[data-id]')?.getAttribute('data-id');
    if (this.mode === 'connect' && id && !this.space && e.button===0) {
      this.connectNode(id);
      this.renderBoard(); return;
    }
    const blank=!id&&!edge,forcedPan=this.space&&e.button===0;
    const action=forcedPan?'pan':blank&&e.button===0&&this.mode!=='connect'&&(e.shiftKey||this.selectionTool)?'select':dragAction(e.button);
    if((blank&&action==='none')||(e.button===1&&!blank&&action!=='pan'))return;
    if (blank && action==='select') {
      this.cancelConnection();
      const baseEdge=this.selectedEdge;this.selectedEdge = undefined;
      const base = new Set(this.selected);
      if (!e.shiftKey) this.selected.clear();
      const box = this.world.createDiv('ts-marquee');
      this.marquee = {id:e.pointerId,start:this.point(e.clientX,e.clientY),base,baseEdge,box};
      this.batchFormatTarget='nodes';this.batchEdgeScope='internal';
      // base 恢复取消前的选择；累加仅在按住 Shift 时启用。
      box.dataset.additive = String(e.shiftKey);this.updateSelection();this.stage.setPointerCapture(e.pointerId);e.preventDefault();return;
    }
    const pan = forcedPan || e.button === 1 || blank;
    if (!pan && id) { selectionChanged=selectionChanged||!!this.selectedEdge;this.selectedEdge=undefined;if (e.shiftKey) { if (this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);selectionChanged=true; } else if (!this.selected.has(id)) {this.selected = new Set([id]);selectionChanged=true;} }
    // Re-clicking an existing selection does not need to rebuild its inspector or node styles.
    if(selectionChanged)this.updateSelection();
    const board=this.session.board,ids=pan?new Set<string>():movableSelection(board,this.selected);
    // Panning only restores the viewport; do not clone note payloads or build target indexes.
    const before:Board=pan?{version:board.version,nodes:[],edges:[],viewport:{...board.viewport}}:dragStartSnapshot(board);
    const resize=target.closest('.ts-resize') ? id || undefined : undefined;
    this.gesture = { draft:new Map(before.nodes.filter(n=>!pan&&!n.locked&&(resize?n.id===resize:ids.has(n.id))).map(n=>[n.id,{...n}])), targets:pan?[]:dragTargets(this.session.board.nodes,ids,resize), originals:new Map(before.nodes.map(n=>[n.id,n])),idSet:ids, id: e.pointerId, x: e.clientX, y: e.clientY, before, ids: [...ids], pan, clearSelectionOnClick:pan&&!this.space&&e.button===0&&!id,resize };
    // 点击时不捕获指针，否则浏览器会把 dblclick 的目标改成画布。
    // 真正超过拖动阈值后再捕获，保留双击编辑与越界拖动两种行为。
    e.preventDefault();
  }
  private pointerMove(e:PointerEvent){
    if(!this.gesture&&!this.marquee&&!this.rightMarquee&&this.mode!=='connect')return;
    const owner=this.rightMarquee||this.linkDrag||this.marquee||this.gesture;if(owner&&owner.id!==e.pointerId)return;
    this.pendingPointer=e;if(!this.pointerFrame)this.pointerFrame=(this.stage.ownerDocument?.defaultView||window).requestAnimationFrame(()=>{this.pointerFrame=0;this.flushPointer();});
  }
  private flushPointer(apply=true){if(this.pointerFrame)(this.stage.ownerDocument?.defaultView||window).cancelAnimationFrame(this.pointerFrame);this.pointerFrame=0;const e=this.pendingPointer;this.pendingPointer=undefined;if(apply&&e)this.applyPointerMove(e);}
  private applyPointerMove(e: PointerEvent, crossedThreshold = false) {
    const right=this.rightMarquee;
    if(right){
      if(right.id!==e.pointerId||right.owner!==this.session)return;
      if(!right.moved){
        if(!crossedThreshold&&Math.hypot(e.clientX-right.x,e.clientY-right.y)<(this.plugin.settings.dragThreshold??4))return;
        right.moved=true;this.cancelConnection();this.setSectionTool(false);this.objectMenu?.hide();this.contextOpen=false;this.contextPoint=undefined;this.inspectorChoiceState=undefined;
        if(right.action==='select'){
          const base=new Set(this.selected),baseEdge=this.selectedEdge,box=this.world.createDiv('ts-marquee');
          if(!right.additive)this.selected.clear();this.selectedEdge=undefined;
          this.marquee={id:right.id,start:right.start,base,baseEdge,box};box.dataset.additive=String(right.additive);
          this.batchFormatTarget='nodes';this.batchEdgeScope='internal';this.stage.focus();this.updateSelection();
        }
        // A fast release can be the first event beyond the threshold; it needs no capture.
        if(e.buttons!==0)this.stage.setPointerCapture(e.pointerId);
      }
      if(right.action==='pan'){
        right.owner.board.viewport={...right.viewport,x:right.viewport.x+e.clientX-right.x,y:right.viewport.y+e.clientY-right.y};
        this.renderBoard(true);return;
      }
    }
    if(this.linkDrag){if(this.linkDrag.id!==e.pointerId)return;if(Math.hypot(e.clientX-this.linkDrag.x,e.clientY-this.linkDrag.y)>4)this.linkDrag.moved=true;this.previewConnection(e.clientX,e.clientY);return;}
    if(this.mode==='connect'&&this.connectFrom&&!this.gesture&&!this.marquee){this.previewConnection(e.clientX,e.clientY);return;}

    const m = this.marquee;
    if (m && m.id === e.pointerId && this.session) {
      const rect = selectionRect(m.start,this.point(e.clientX,e.clientY));Object.assign(m.box.style,{left:`${rect.x}px`,top:`${rect.y}px`,width:`${rect.width}px`,height:`${rect.height}px`});
      if(m.section){m.rect=rect;return;}
      const hits=marqueeSelection(visibleBranchBoard(this.session.board).nodes,rect),next=new Set(m.box.dataset.additive==='true'?m.base:[]);
      // Match the active object/relationship scope without discarding Shift's explicit base.
      for(const id of hits)if((!this.filterMatches||this.filterMatches.has(id))&&(!this.relatedFocus||this.relatedFocus.has(id)))next.add(id);
      // The rectangle still moves every frame; selection UI only changes with membership.
      if(next.size!==this.selected.size||Array.from(next).some(id=>!this.selected.has(id))){this.selected=next;this.updateSelection();}return;
    }
    const g = this.gesture; if (!g || !this.session || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y; if (!this.dragging && !crossedThreshold && Math.hypot(dx,dy) < (g.resize?3:(this.plugin.settings.dragThreshold??4))) return;
    if (!this.dragging) this.stage.setPointerCapture(e.pointerId);
    this.dragging = true;
    const b = this.session.board;
    if (g.pan) { b.viewport.x = g.before.viewport.x + dx; b.viewport.y = g.before.viewport.y + dy; this.renderBoard(true); return; }
    const originals=g.originals;let delta=constrainedDrag(dx/b.viewport.zoom,dy/b.viewport.zoom,e.shiftKey&&this.plugin.settings.axisLock);
    g.lockedAxis=!g.resize&&e.shiftKey&&this.plugin.settings.axisLock?(delta.dx===0?'x':'y'):undefined;
    g.guides=[];
    if(!g.resize&&this.plugin.settings.alignmentGuides&&!e.altKey){
      if(!g.alignmentReady){g.alignment=alignmentIndex(visibleBranchBoard(g.before).nodes,g.idSet,viewportRect(b.viewport,this.stage.clientWidth,this.stage.clientHeight,0));g.alignmentReady=true;}
      if(g.alignment){const aligned=alignDrag(g.alignment,delta.dx,delta.dy,b.viewport.zoom,g.lockedAxis);delta=aligned;g.guides=aligned.guides;}
    }
    this.drawAlignmentGuides(g.guides);
    for (const live of activeDragTargets(b.nodes,g.targets)) {
      const n=g.draft.get(live.id),original = originals.get(live.id); if (!n||!original) continue;
      if (g.resize === n.id) { Object.assign(n,resized(original,dx/b.viewport.zoom,dy/b.viewport.zoom,e.shiftKey&&this.plugin.settings.aspectLock)); if(n.kind==='card')n.autoFit=false;if(n.kind==='text'){n.autoSize=false;if(!(e.shiftKey&&this.plugin.settings.aspectLock))fitTextNode(n,this.contentEl);} }
      else if (!g.resize && g.idSet.has(n.id)) { n.x = original.x + delta.dx; n.y = original.y + delta.dy; }
      if(g.resize===n.id||(!g.resize&&g.idSet.has(n.id))){const el = this.positions.get(n.id); if (el) this.positionNode({...live,...dragGeometry(n,!!g.resize)}, el);}
    }
    this.previewGridLanding(g.resize||g.guides?.length||e.altKey?undefined:g.idSet,g.lockedAxis?new Set([g.lockedAxis]):undefined);this.renderEdges();
  }
  private pointerUp(e: PointerEvent, cancelled = false) {
    const active=this.rightMarquee||this.linkDrag||this.marquee||this.gesture;
    if(!active||active.id!==e.pointerId)return;
    // The release supersedes queued coordinates. Retain only their threshold
    // crossing, so a quick out-and-back drag cannot become a click or topic add.
    const pending=this.pendingPointer,start=this.rightMarquee||this.linkDrag||this.gesture;
    const distance=!cancelled&&pending?.pointerId===e.pointerId&&start?Math.hypot(pending.clientX-start.x,pending.clientY-start.y):0;
    const crossedThreshold=distance>0&&(this.linkDrag?distance>4:distance>=(this.gesture?.resize?3:(this.plugin.settings.dragThreshold??4)));
    this.flushPointer(false);
    const right=this.rightMarquee;
    if(right){
      if(right.id!==e.pointerId)return;cancelled=cancelled||right.owner!==this.session;
      if(!cancelled)this.applyPointerMove(e,crossedThreshold);
      this.rightMarquee=undefined;this.suppressBoardContext=true;
      if(right.moved&&right.action==='pan'){
        if(this.stage.hasPointerCapture(e.pointerId))this.stage.releasePointerCapture(e.pointerId);
        const viewport=right.owner.board.viewport,changed=viewport.x!==right.viewport.x||viewport.y!==right.viewport.y;
        if(cancelled){right.owner.board.viewport={...right.viewport};if(changed)right.owner.persist();}
        else if(changed){this.viewTrail.remember(right.viewport);right.owner.persist();}
        if(right.owner===this.session)this.renderBoard();
      }
      else if(right.moved)this.finishMarquee(cancelled);
      else if(!cancelled)this.showBoardContextMenu(right.menu||right.event);
      return;
    }
    if(this.linkDrag){if(crossedThreshold)this.linkDrag.moved=true;this.finishLinkDrag(e,cancelled);return;}
    if(!cancelled&&(this.marquee||(this.gesture&&Number.isFinite(this.gesture.x)&&Number.isFinite(this.gesture.y))))this.applyPointerMove(e,crossedThreshold);
    if (this.marquee?.id === e.pointerId) { this.finishMarquee(cancelled); return; }
    const g = this.gesture; if (!g || !this.session || e.pointerId !== g.id) return;
    this.previewGridLanding();this.drawAlignmentGuides([]);this.gesture = undefined; const moved = this.dragging; this.dragging = false;
    if (this.stage.hasPointerCapture(e.pointerId)) this.stage.releasePointerCapture(e.pointerId);
    if (cancelled) {
      if(g.pan&&moved){this.session.board.viewport={...g.before.viewport};this.session.persist();}
    } else if (moved) {
      if (g.pan) {
        if(this.session.board.viewport.x!==g.before.viewport.x||this.session.board.viewport.y!==g.before.viewport.y){this.viewTrail.remember(g.before.viewport);this.session.persist();}
      } else {
        try{
          let changes=dragCommitChanges(this.session.board,g.originals,g.draft,!!g.resize);
          if(changes.size&&this.session.board.snapToGrid&&!g.resize&&!e.altKey){
            const excluded=new Set(g.guides?.map(guide=>guide.axis));if(g.lockedAxis)excluded.add(g.lockedAxis);
            const landing=gridLanding(dragDisplayBoard(this.session.board,g.draft),g.idSet,this.plugin.settings.gridStep,excluded);
            if(landing)for(const n of g.draft.values()){n.x+=landing.dx;n.y+=landing.dy;}
            changes=dragCommitChanges(this.session.board,g.originals,g.draft);
          }
          if(changes.size)this.session.change(b=>{for(const n of b.nodes){const patch=changes.get(n.id);if(patch)Object.assign(n,patch);}});
        }catch(error){new Notice(String(error).replace(/^Error: /,''));}
      }
    } else if(g.clearSelectionOnClick){
      this.selected.clear();this.selectedEdge=undefined;this.updateSelection();
    }
    if (moved || cancelled) this.renderBoard();
    if(this.pendingFits.size)this.nodeFitQueue.schedule();
  }
  private updateSelection() {
    this.syncCanvasControls();
    // Read live DOM state so remounted nodes are refreshed without rewriting
    // every already-selected node and outline row during a growing marquee.
    const sync=(el:Element,on:boolean)=>{if(el.classList.contains('is-selected')!==on)el.classList.toggle('is-selected',on);};
    this.positions.forEach((el, id) => sync(el, this.selected.has(id)));
    const batch=!this.marquee&&this.session&&this.batchFormatTarget==='edges'&&this.selected.size>1?new Set(selectionEdges(this.session.board,this.selected,this.batchEdgeScope).map(e=>e.id)):undefined;
    this.svg.querySelectorAll('.ts-edge').forEach(el => {const id=el.getAttribute('data-edge');sync(el, id===this.selectedEdge||!!id&&!!batch?.has(id));});
    if(!this.marquee)this.renderInspector();this.sidebar?.querySelectorAll('[data-outline-id]').forEach(el=>sync(el,this.selected.has((el as HTMLElement).dataset.outlineId!)));if(!this.gesture&&!this.marquee)this.scheduleRender();
  }
  private key(e: KeyboardEvent) {
    if(e.isComposing||e.keyCode===229)return;
    if ((e.target as Element).closest('input,textarea,select,[contenteditable=true]')) return;
    if(this.rightMarquee){if(e.key==='Escape'){e.preventDefault();this.cancelRightMarquee();}return;}
    if(!this.gesture&&!this.marquee&&(e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='p'){e.preventDefault();e.stopPropagation();this.boardActions();return;}
    if(!this.gesture&&!this.marquee&&e.altKey&&!e.metaKey&&!e.ctrlKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.shiftKey){const direction=({ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'} as const)[e.key as 'ArrowLeft'],node=directionalNode(this.session?.board.nodes||[],[...this.selected][0],direction);if(node)this.revealNode(node.id);}else if(e.key==='ArrowLeft'||e.key==='ArrowRight')this.travelViewport(e.key==='ArrowRight');return;}
    if(this.linkDrag){if(e.key==='Escape'){e.preventDefault();this.cancelConnection();this.flushPointer(false);}return;}
    if (this.marquee || this.gesture) {
      if (e.key === 'Escape') { this.cancelConnection();this.flushPointer(false);this.contextOpen=false;this.relatedFocus=undefined;this.relationLens=undefined;this.contextPoint=undefined;this.inspectorChoiceState=undefined; e.preventDefault(); if (this.marquee) this.finishMarquee(true); else if (this.gesture) this.pointerUp(new PointerEvent('pointercancel',{pointerId:this.gesture.id}),true); }
      return;
    }
    if(this.session&&this.mode==='select'&&this.selected.size===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.shiftKey&&e.target===this.stage&&['PageUp','PageDown','Home','End'].includes(e.key)){
      const node=this.session.board.nodes.find(n=>this.selected.has(n.id));if(node?.kind==='pdf'&&!node.collapsed){e.preventDefault();e.stopPropagation();if(this.session.blocked||node.locked)return;
        const file=this.app.vault.getAbstractFileByPath(node.file!),cached=file instanceof TFile?this.pdfTotals.get(file.path):undefined,total=file instanceof TFile&&cached?.stamp===file.stat.mtime?cached.total:undefined;
        const page=pdfPageKey(e.key,node.pdfPage||1,total);if(page!==undefined)this.setPdfPage(node.id,page);return;
      }
    }
    if(this.plugin?.settings.boardQuickKeys!==false&&(e.key==='F2'||(e.key==='Enter'&&this.session?.board.mode!=='mindmap'))&&e.target===this.stage&&this.mode==='select'&&this.selected.size===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.shiftKey){
      const node=this.session?.board.nodes.find(n=>this.selected.has(n.id));
      if(node&&(node.kind==='card'||node.kind==='text')){e.preventDefault();e.stopPropagation();if(!e.repeat&&!this.session?.blocked&&!node.locked)act(()=>this.startInlineEdit(node.id,node.kind==='text'));}
      return;
    }
    if(this.mode==='select'&&this.session?.board.mode==='mindmap'&&e.target===this.stage&&this.selected.size===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
      const id=[...this.selected][0],eligible=(n:Card)=>(!this.filterMatches||this.filterMatches.has(n.id))&&(!this.relatedFocus||this.relatedFocus.has(n.id));
      const direction=({ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'} as const)[e.key as 'ArrowLeft'];
      const topic=this.session.board.nodes.find(n=>n.id===id)?.topic||this.session.board.edges.some(edge=>edge.kind==='branch'&&(edge.from===id||edge.to===id));
      if(topic&&((direction&&!e.shiftKey)||(e.key==='Tab'&&e.shiftKey))){
        e.preventDefault();const next=direction?mindmapNavigation(this.session.board,id,direction,eligible):mindmapParent(this.session.board,id,eligible);
        if(next){const node=this.session.board.nodes.find(n=>n.id===next)!,v=this.session.board.viewport;
          const x=node.x*v.zoom+v.x,y=node.y*v.zoom+v.y;
          // Keep the camera steady for neighbors already fully visible.
          if(x>=48&&y>=64&&x+node.width*v.zoom<=this.stage.clientWidth-32&&y+node.height*v.zoom<=this.stage.clientHeight-32){this.selected=new Set([next]);this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();}
          else this.revealNode(next);
        }return;
      }
    }
    if (!(e.target as Element).closest('button') && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && this.selected.size && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault(); if(this.plugin.settings.arrowNudge===false||!this.session||!movableSelection(this.session.board,this.selected).size)return;const step=e.shiftKey?this.plugin.settings.fastNudge:this.plugin.settings.nudgeStep;this.mutate(b=>moveSelection(b,this.selected,e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));return;
    }
    if(e.key==='Enter'&&e.shiftKey&&(e.metaKey||e.ctrlKey)&&e.target===this.stage&&this.session&&!this.session.blocked){e.preventDefault();e.stopPropagation();const n=this.session.board.nodes.find(n=>this.selected.has(n.id));if(n)this.foldBranches(this.selected,!n.branchFolded,n.branchFolded?'level':'collapse');return;}
    if(this.session?.board.mode==='mindmap'&&e.target===this.stage&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.shiftKey&&['Tab','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)act(()=>this.addTopic(e.key==='Enter'));return;}
    if (this.plugin?.settings.boardQuickKeys!==false && e.key.toLowerCase()==='f' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault();this.focusSelection();return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); e.stopPropagation(); this.findOnBoard(); return; }
    if (e.code === 'Space') { e.preventDefault(); this.space = true; }
    if (e.key === 'Escape') { this.cancelConnection();this.flushPointer(false);this.contextOpen=false;this.relatedFocus=undefined;this.relationLens=undefined;this.contextPoint=undefined;this.inspectorChoiceState=undefined; this.setSectionTool(false);this.selectionTool=false;this.syncSelectionTool(); this.mode = 'select'; this.connectFrom = undefined;this.connectSide=undefined;this.stage?.removeClass('ts-connecting'); this.connectButton?.removeClass('is-active'); this.selected.clear(); this.selectedEdge = undefined; this.renderBoard(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); this.session?.undo(e.shiftKey); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if(this.plugin?.settings.deleteKeys!==false)this.deleteSelection(); }
    if (this.plugin?.settings.boardQuickKeys!==false && e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) this.fit();
  }
  private matches(file: TFile) {
    const tags = getAllTags(this.app.metadataCache.getFileCache(file) || {}) || [];
    return (!this.tag || tags.includes(this.tag)) && `${file.path} ${tags.join(' ')}`.toLocaleLowerCase().includes(this.query);
  }
  private clearSidebarFilters() {
    this.query='';
    if(this.tab==='library'){this.tag='';this.libraryScope='vault';}
    if(this.tab==='outline')this.outlineKind='all';
    const search=this.sidebar.querySelector<HTMLInputElement>('.ts-search');if(search)search.value='';
    const clear=this.sidebar.querySelector<HTMLButtonElement>('.ts-search-clear');if(clear)clear.hidden=true;
    this.renderSidebar();search?.focus({preventScroll:true});
  }
  private renderSidebar() {
    this.sidebarRun++;
    if (this.sidebarTimer) window.clearTimeout(this.sidebarTimer);
    this.sidebarTimer = window.setTimeout(() => { this.sidebarTimer = undefined; act(() => this.populateSidebar()); }, 100);
  }
  private async populateSidebar() {
    if(!this.list||!this.session||this.closed)return;
    const target=this.list,owner=this.session,run=++this.sidebarRun;
    const key=JSON.stringify([this.file?.path,this.tab,this.query,this.tag,this.boardScope,this.boardSort,this.libraryScope,this.librarySort,this.taskScope,this.taskFilter,this.outlineKind]);
    const draft=target.ownerDocument.createDocumentFragment().createDiv();target.querySelector('.ts-sidebar-refresh-error')?.remove();target.setAttribute('aria-busy','true');
    try{
      await this.buildSidebar(draft,run);
      if(run!==this.sidebarRun||owner!==this.session||target!==this.list||this.closed)return;
      replaceSidebarContents(target,draft,key===this.sidebarContentKey);this.sidebarContentKey=key;
    }catch(e){
      if(run!==this.sidebarRun||owner!==this.session||this.closed)return;
      const notice=target.createDiv({cls:'ts-sidebar-refresh-error',attr:{role:'status'}});notice.createSpan({text:'列表更新失败，已保留原内容'});button(notice,'重试','rotate-cw',()=>this.populateSidebar(),'ts-icon-button');
      throw e;
    }finally{if(run===this.sidebarRun)target.removeAttribute('aria-busy');}
  }
  private async buildSidebar(list:HTMLElement,run:number) {
    if(!this.session)return;
    if(this.tab==='outline'){
      const controls=list.createDiv('ts-outline-controls');const filter=controls.createEl('select',{attr:{'aria-label':'大纲类型'}});
      for(const [value,text] of [['all','全部对象'],['card','卡片'],['section','分组'],['board','子白板'],['text','文本'],['image','图片'],['pdf','PDF']])filter.createEl('option',{value,text});filter.value=this.outlineKind;filter.onchange=()=>{this.outlineKind=filter.value as OutlineKind;this.renderSidebar();};
      button(controls,'适应全部','scan',()=>this.fit(),'ts-icon-button');
      const filtered=!!this.query||this.outlineKind!=='all';
      if(filtered)button(controls,'清除大纲筛选','rotate-ccw',()=>this.clearSidebarFilters(),'ts-icon-button ts-sidebar-filter-reset');
      const name=(n:Card)=>{const f=n.file&&this.app.vault.getAbstractFileByPath(n.file);return f instanceof TFile?f.basename:readingTitle(n)||'未命名';};
      const owner=this.session;
      button(controls,'展开大纲分组','chevrons-down',()=>{this.outlineCollapsed.clear();this.renderSidebar();},'ts-icon-button');
      button(controls,'收起大纲分组','chevrons-up',()=>{this.outlineCollapsed=new Set(owner.board.nodes.filter(n=>n.kind==='section').map(n=>n.id));this.renderSidebar();},'ts-icon-button');
      const rows=outlineTree(owner.board,{query:this.query,kind:this.outlineKind,collapsed:this.outlineCollapsed,name}),nodes=rows.map(r=>r.node);
      list.createDiv({text:`${nodes.length} 个对象 · 按分组层级排列`,cls:'ts-list-heading'});
      const tree=list.createDiv({cls:'ts-outline-tree',attr:{role:'tree','aria-label':'白板分组大纲'}});
      for(const entry of rows){const n=entry.node,row=tree.createDiv({cls:'ts-outline-row',attr:{'data-outline-id':n.id,role:'treeitem','aria-level':String(entry.depth+1)}});row.style.setProperty('--outline-depth',String(entry.depth));row.toggleClass('is-selected',this.selected.has(n.id));
        if(entry.childCount){row.setAttribute('aria-expanded',String(entry.expanded));const disclosure=button(row,`${entry.expanded?'收起':'展开'}大纲 · ${name(n)}`,entry.expanded?'chevron-down':'chevron-right',()=>{if(this.outlineCollapsed.has(n.id))this.outlineCollapsed.delete(n.id);else this.outlineCollapsed.add(n.id);this.renderSidebar();},'ts-icon-button ts-outline-toggle');disclosure.setAttribute('aria-expanded',String(entry.expanded));}else row.createSpan({cls:'ts-outline-toggle-spacer'});
        const target=button(row,name(n),n.kind==='section'?'folder':n.kind==='board'?'panels-top-left':n.kind==='text'?'type':n.kind==='image'?'image':'file-text',()=>this.revealNode(n.id),'ts-outline-title');target.title=n.file||n.title||'';
        if(n.kind==='section')row.createSpan({text:String(entry.descendantCount),cls:'ts-outline-children-count',attr:{'aria-label':`${entry.descendantCount} 个组内对象`}});
        if(['card','text','image'].includes(n.kind))button(row,'阅读 '+name(n),'book-open',()=>this.openReadingDesk(new Set([n.id])),'ts-icon-button ts-outline-read');
        if(n.kind==='card'||n.kind==='pdf'||n.kind==='board'||n.kind==='text'){const label=n.kind==='board'?'子白板':n.kind==='pdf'?'PDF':n.kind==='text'?'文本':'卡片';const fold=button(row,`${n.collapsed?'展开':'折叠'}${label}`,n.collapsed?'chevron-down':'chevron-up',()=>n.kind==='text'?this.foldText(n.id,!n.collapsed):this.mutate(b=>foldCards(b,new Set([n.id]),!n.collapsed)),'ts-icon-button');fold.disabled=owner.blocked||!!n.locked;fold.setAttribute('aria-expanded',String(!n.collapsed));}
        if(n.kind==='section'){const fold=button(row,n.sectionFolded?'展开白板分组':'折叠白板分组',n.sectionFolded?'unfold-vertical':'fold-vertical',()=>this.setSelectionFold(new Set([n.id]),!n.sectionFolded,true),'ts-icon-button');fold.disabled=owner.blocked||!!n.locked;fold.setAttribute('aria-expanded',String(!n.sectionFolded));}
      }
      if(!nodes.length){const empty=list.createDiv('ts-sidebar-empty ts-sidebar-empty-actions');empty.createSpan({text:'没有匹配的对象。试试其他关键词或类型。'});if(filtered)button(empty,'清除筛选','rotate-ccw',()=>this.clearSidebarFilters());}return;
    }
    if (this.tab === 'boards') {
      const browserHead=list.createDiv('ts-board-browser-head');
      const switcher=browserHead.createDiv({cls:'ts-board-switch',attr:{role:'group','aria-label':'白板列表范围'}});
      for(const [id,label,icon] of [['favorites','白板收藏','star'],['spaces','白板空间','panels-top-left']] as const){const b=button(switcher,label,icon,()=>{this.boardScope=id;this.renderSidebar();});b.toggleClass('is-active',this.boardScope===id);b.setAttribute('aria-pressed',String(this.boardScope===id));}
      const controls=browserHead.createDiv('ts-board-list-controls');const sort=controls.createEl('select',{attr:{'aria-label':'白板排序'}});sort.createEl('option',{value:'title',text:'名称排序'});sort.createEl('option',{value:'updated',text:'最近修改'});sort.value=this.boardSort;sort.onchange=()=>{this.boardSort=sort.value as 'title'|'updated';this.renderSidebar();};
      const compare=(a:TFile,b:TFile)=>this.boardSort==='updated'?b.stat.mtime-a.stat.mtime||a.basename.localeCompare(b.basename):a.basename.localeCompare(b.basename);
      if(this.boardScope==='favorites'){
        const favorites=this.plugin.settings.favoriteBoards.map(path=>this.app.vault.getAbstractFileByPath(path)).filter((f):f is TFile=>f instanceof TFile&&f.path.toLocaleLowerCase().includes(this.query)).sort(compare);
        const pinned=list.createDiv('ts-favorites');pinned.createDiv({text:`${favorites.length} 个收藏`,cls:'ts-list-heading'});
        for(const file of favorites){const row=pinned.createDiv('ts-favorite-row');row.oncontextmenu=e=>{e.preventDefault();this.boardMenu(file,e);};button(row,file.basename,'star',()=>this.navigate(file),'ts-tree-title');button(row,'取消收藏 '+file.basename,'x',()=>this.plugin.toggleFavorite(file),'ts-icon-button');}
        if(!favorites.length)pinned.createDiv({text:this.query?'没有匹配的收藏。':'点击白板标题旁的星标，把常用空间放在这里。',cls:'ts-favorite-hint'});return;
      }
      button(controls,'展开全部','chevrons-down',()=>{this.collapsedBoards.clear();this.renderSidebar();},'ts-icon-button');
      button(controls,'折叠全部','chevrons-up',()=>{this.collapsedBoards=new Set(this.app.vault.getFiles().filter(f=>f.extension===EXT).map(f=>f.path));this.renderSidebar();},'ts-icon-button');
      button(controls,'定位当前白板','locate-fixed',async()=>{this.query='';const input=this.sidebar.querySelector<HTMLInputElement>('.ts-search');if(input)input.value='';const clear=this.sidebar.querySelector<HTMLButtonElement>('.ts-search-clear');if(clear)clear.hidden=true;this.collapsedBoards.clear();await this.populateSidebar();const row=Array.from(this.sidebar.querySelectorAll<HTMLElement>('[data-board-path]')).find(e=>e.dataset.boardPath===this.file?.path);row?.scrollIntoView({block:'nearest'});row?.querySelector<HTMLButtonElement>('.ts-tree-title')?.focus();},'ts-icon-button');
      const owner=this.session,current=()=>run===this.sidebarRun&&owner===this.session&&!this.closed&&this.tab==='boards';
      // Superseded searches discard the entire graph; nesting validation still
      // calls boardGraph without a cancellation predicate and checks every file.
      const result=await this.plugin.boardGraph(current);if(!result||!current())return;
      const {graph,errors}=result;
      const files = this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => f.extension === EXT).sort(compare);
      const byPath = new Map(files.map(f => [f.path, f]));
      const tree = list.createDiv({ cls: 'ts-board-tree', attr: { role: 'tree', 'aria-label': '嵌套白板树' } });
      // Arrow navigation stays within the visible tree and never moves canvas objects.
      tree.onkeydown=e=>{
        if(e.isComposing||e.keyCode===229||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
        if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key)||!(e.target instanceof HTMLElement))return;
        // Primary rows share search/list navigation; keep Home/End and auxiliary controls local.
        if(e.target.matches('.ts-tree-title')&&(e.key==='ArrowUp'||e.key==='ArrowDown'))return;
        const row=e.target.closest('.ts-tree-row'),rows=Array.from(tree.querySelectorAll<HTMLElement>('.ts-tree-row')),i=rows.indexOf(row as HTMLElement);if(i<0)return;
        e.preventDefault();e.stopPropagation();const next=e.key==='Home'?0:e.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,i+(e.key==='ArrowDown'?1:-1)));
        rows[next]?.querySelector<HTMLButtonElement>('.ts-tree-title')?.focus();
      };
      let rendered = 0;
      const draw = (file: TFile, trail: TFile[]) => {
        if (++rendered > 300 || trail.length > 32) return;
        const circular = trail.includes(file), children = [...new Set(graph.get(file.path) || [])].map(p => byPath.get(p)).filter((f): f is TFile => !!f).sort(compare);
        const row = tree.createDiv({ cls: 'ts-tree-row', attr: { role: 'treeitem', 'aria-level': trail.length + 1, 'data-board-path': file.path } });
        row.style.paddingLeft = `${Math.min(trail.length, 8) * 14}px`; row.toggleClass('is-current', file === this.file);
        if (children.length && !circular && !this.query) {
          const collapsed = this.collapsedBoards.has(file.path); row.setAttribute('aria-expanded', String(!collapsed));
          button(row, collapsed ? `展开 ${file.basename}` : `折叠 ${file.basename}`, collapsed ? 'chevron-right' : 'chevron-down', () => { if (collapsed) this.collapsedBoards.delete(file.path); else this.collapsedBoards.add(file.path); this.renderSidebar(); }, 'ts-tree-toggle');
        } else row.createSpan('ts-tree-spacer');
        if(file===this.file)row.setAttribute('aria-current','page');
        row.style.setProperty('--ts-tree-depth',String(Math.min(trail.length,8)));
        const title = button(row, file.basename, children.length?(this.collapsedBoards.has(file.path)?'folder':'folder-open'):'panels-top-left', () => this.navigate(file, circular ? [] : trail), 'ts-tree-title');
        title.title=file.path;
        if(children.length)row.createSpan({cls:'ts-tree-count',text:String(children.length),attr:{'aria-label':`${children.length} 个子白板`,title:`${children.length} 个直接子白板`}});
        row.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();this.boardMenu(file,e);};
        title.draggable = true; title.ondragstart = e => e.dataTransfer?.setData('text/x-thoughtspace-board', file.path);
        if (file !== this.file && !errors.has(file.path)) button(row, `引用 ${file.basename}`, 'plus', () => this.addBoard(file), 'ts-tree-add');
        if (errors.has(file.path) || circular) row.createSpan({ cls: 'ts-tree-warning', text: circular ? '循环' : '!', attr: { title: '请检查白板引用或格式' } });
        if (!circular && !this.query && !this.collapsedBoards.has(file.path)) children.forEach(child => draw(child, [...trail, file]));
      };
      if (this.query) files.filter(f => f.path.toLocaleLowerCase().includes(this.query)).forEach(f => draw(f, []));
      else {
        const referenced = new Set([...graph.values()].flat()), roots = files.filter(f => !referenced.has(f.path));
        roots.forEach(f => draw(f, []));
        const reachable = new Set<string>(), pending = roots.map(f => f.path);
        while (pending.length) { const path = pending.pop()!; if (reachable.has(path)) continue; reachable.add(path); pending.push(...(graph.get(path) || [])); }
        for (const f of files.filter(f => !reachable.has(f.path))) { draw(f, []); const next = [f.path]; while (next.length) { const path = next.pop()!; if (reachable.has(path)) continue; reachable.add(path); next.push(...(graph.get(path) || [])); } }
      }
      if (!tree.childElementCount) list.createDiv({ cls: 'ts-sidebar-empty', text: '没有找到白板。可以新建一个研究主题。' });
      if (rendered > 300) list.createDiv({ cls: 'ts-muted', text: '当前显示前 300 项，可用搜索定位白板。' });
      list.createDiv({ cls: 'ts-tree-help', text: '拖入画布建立引用 · 右键管理白板' });
      return;
    }
    if (this.tab === 'tasks') {
      const scope = list.createEl('select', { cls: 'ts-tag-select', attr: { 'aria-label': '任务范围' } });
      scope.createEl('option', { text: '当前白板的任务', value: 'board' }); scope.createEl('option', { text: '全仓库任务（包含日记）', value: 'vault' }); scope.value = this.taskScope;
      scope.onchange = () => { this.taskScope = scope.value as 'board' | 'vault'; this.renderSidebar(); };
      list.createDiv({ text: this.taskScope === 'board' ? '当前白板引用笔记的任务' : '全仓库任务 · 按笔记修改时间排序', cls: 'ts-list-heading' });
      const paths = this.taskScope === 'board' ? [...new Set(this.session.board.nodes.filter(n => n.kind === 'card').map(n => n.file!))] : this.app.vault.getMarkdownFiles().filter(isWorkspaceFile).sort((a, b) => b.stat.mtime - a.stat.mtime).map(f => f.path);
      const filters=list.createDiv('ts-task-filters');
      for(const [id,label] of [['all','全部'],['todo','未完成'],['done','已完成']] as const){const b=button(filters,label,'',()=>{this.taskFilter=id;this.renderSidebar();});b.toggleClass('is-active',this.taskFilter===id);}
      const progress=list.createDiv('ts-task-progress');const totals:{checked:boolean}[]=[];
      let count = 0;
      for (const path of paths) {

        const file = this.app.vault.getAbstractFileByPath(path); if (!(file instanceof TFile)) continue;
        const content = await this.app.vault.cachedRead(file); if (run !== this.sidebarRun) return;
        const matching=extractTasks(content).filter(t => `${t.text} ${file.basename}`.toLocaleLowerCase().includes(this.query));totals.push(...matching);
        const tasks = visibleTasks(matching,this.taskFilter).slice(0, Math.max(0,200-count));
        if (!tasks.length) continue;
        const group = list.createDiv('ts-task-group'); button(group, file.basename, 'file-text', () => this.app.workspace.getLeaf('tab').openFile(file));
        for (const task of tasks) {
          count++; const row = group.createEl('label', { cls: 'ts-task' });
          const checkbox = row.createEl('input', { type: 'checkbox' }); checkbox.checked = task.checked;
          row.createSpan({ text: task.text || '未命名任务', cls: task.checked ? 'is-done' : '' });
          checkbox.onchange = () => act(async () => { checkbox.disabled = true; try { await this.app.vault.process(file, text => toggleTask(text, task)); } finally { this.renderSidebar(); } });
        }
      }
      const summary=taskSummary(totals);progress.createSpan({text:`已完成 ${summary.done} / ${summary.total}`,cls:'ts-task-progress-label'});progress.createSpan({text:`${summary.percent}%`,cls:'ts-task-percent'});const bar=progress.createEl('progress',{attr:{max:'100',value:String(summary.percent),'aria-label':'任务完成度'}});bar.value=summary.percent;
      if(visibleTasks(totals,this.taskFilter).length>200)list.createDiv({cls:'ts-muted',text:'显示前 200 条匹配任务，请搜索缩小范围。'});
      if (!count) list.createDiv({ cls: 'ts-sidebar-empty', text: summary.total?'当前筛选下没有任务。':'还没有任务。在卡片中写入 - [ ] 待办事项，即可在这里管理。' });
      return;
    }
    const owner = this.session;
    const noteReferences=firstNoteReferences(owner.board.nodes),boardPaths = new Set(noteReferences.keys());
    const controls = list.createDiv('ts-library-controls');
    const scope = controls.createEl('select', { attr: { 'aria-label': '卡片库范围' } });
    for (const [value, text] of [['vault', '整个仓库'], ['cards', '卡片目录'], ['board', '当前白板']]) scope.createEl('option', { value, text });
    scope.value = this.libraryScope; scope.onchange = () => { this.libraryScope = scope.value as LibraryScope; this.tag = ''; this.renderSidebar(); };
    const sort = controls.createEl('select', { attr: { 'aria-label': '卡片排序' } });
    sort.createEl('option', { value: 'updated', text: '最近修改' }); sort.createEl('option', { value: 'title', text: '标题排序' });
    sort.value = this.librarySort; sort.onchange = () => { this.librarySort = sort.value as LibrarySort; this.renderSidebar(); };
    const all = libraryFiles(this.app.vault.getMarkdownFiles().filter(isWorkspaceFile), this.libraryScope, this.librarySort, this.plugin.settings.cardFolder, boardPaths);
    const tags = new Map<string, number>(); all.forEach(f => (getAllTags(this.app.metadataCache.getFileCache(f) || {}) || []).forEach(t => tags.set(t, (tags.get(t) || 0) + 1)));
    const select = list.createEl('select', { cls: 'ts-tag-select', attr: { 'aria-label': '按标签筛选' } }); select.createEl('option', { value: '', text: '所有标签' });
    [...tags].sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => select.createEl('option', { value: tag, text: `${tag} · ${count}` }));
    select.value = this.tag; select.onchange = () => { this.tag = select.value; this.renderSidebar(); };
    const files = all.filter(f => this.matches(f));
    const filtered=!!this.query||!!this.tag||this.libraryScope!=='vault';
    const heading = list.createDiv('ts-list-heading'); heading.createSpan({ text: `${files.length} 篇笔记` });
    const actions=heading.createDiv('ts-list-heading-actions');
    button(actions, '按标签整理', 'folder-input', () => this.plugin.fileAllCards(), 'ts-library-organize');
    if(filtered)button(actions,'清除卡片筛选','rotate-ccw',()=>this.clearSidebarFilters(),'ts-icon-button ts-sidebar-filter-reset');
    for (const file of files.slice(0, 100)) {
      const text = await this.app.vault.cachedRead(file); if (run !== this.sidebarRun) return;
      const currentNode = noteReferences.get(file.path);
      const item = list.createDiv({ cls: 'ts-library-card', attr: { draggable: 'true', tabindex: '0', role: 'group', 'aria-label': `${currentNode ? '定位' : '添加'} ${file.basename}`, 'data-note-path': file.path } });
      item.toggleClass('is-on-board', !!currentNode);
      const header = item.createDiv('ts-library-card-head');
      setIcon(header.createSpan('ts-library-note-icon'), 'file-text'); header.createDiv({ cls: 'ts-library-title', text: file.basename,attr:{'data-ts-note-path':file.path} });
      const preview = button(header, '预览笔记', 'eye', () => new NotePreview(this.app, file, this.plugin).open(), 'ts-icon-button ts-library-preview');
      preview.addEventListener('click', e => e.stopPropagation());
      const open=button(header,'在右侧打开笔记','panel-right',()=>this.plugin.openNoteInSidebar(file),'ts-icon-button ts-library-open');
      open.addEventListener('click',e=>e.stopPropagation());
      item.createDiv({ cls: 'ts-library-excerpt', text: noteExcerpt(text) || '这张笔记还没有正文' });
      const meta = item.createDiv('ts-library-card-meta');
      meta.createSpan({ cls: 'ts-library-path', text: file.parent?.path || '/' });
      if (currentNode) meta.createSpan({ cls: 'ts-on-board', text: '已在白板' });
      const tags = getAllTags(this.app.metadataCache.getFileCache(file) || {}) || []; if (tags.length) item.createDiv({ cls: 'ts-library-tags', text: tags.slice(0, 3).join('  ') });
      item.ondragstart = e => { e.dataTransfer?.setData('text/x-thoughtspace-note', file.path); };
      const activate = () => { if (this.session !== owner) return; const n = owner.board.nodes.find(n => n.kind === 'card' && n.file === file.path); if (n) this.revealNode(n.id); else this.addFile(file); };
      item.onclick = activate; item.onkeydown = e => { if (e.key === 'Enter' && e.target === item) activate(); };
      item.oncontextmenu = e => {
        e.preventDefault(); e.stopPropagation(); const menu = new Menu().setUseNativeMenu(false);
        menu.addItem(i => i.setTitle('预览笔记').setIcon('eye').onClick(() => new NotePreview(this.app, file, this.plugin).open()));
        menu.addItem(i=>i.setTitle('重命名笔记').setIcon('pencil-line').onClick(()=>this.plugin.promptRenameNote(file)));
        menu.addItem(i=>i.setTitle('编辑标签').setIcon('tags').onClick(()=>this.plugin.editNativeTags(file)));
        menu.addItem(i=>i.setTitle('右侧打开笔记').setIcon('panel-right').onClick(()=>act(()=>this.plugin.openNoteInSidebar(file))));
        menu.addItem(i => i.setTitle('编辑笔记').setIcon('pencil').onClick(() => act(()=>this.plugin.editNote(file))));
        menu.addItem(i => i.setTitle('添加引用到白板').setIcon('plus').setDisabled(owner.blocked).onClick(() => { if (this.session === owner) this.addFile(file); }));
        if (currentNode) menu.addItem(i => i.setTitle('定位到白板').setIcon('locate').onClick(() => { if (this.session === owner) this.revealNode(currentNode.id); }));
        menu.addSeparator(); menu.addItem(i => i.setTitle('按标签归档…').setIcon('folder-input').onClick(() => this.plugin.pickFilingTag(file)));
        menu.showAtMouseEvent(e);
      };
    }
    if (!files.length){const empty=list.createDiv('ts-sidebar-empty ts-sidebar-empty-actions');empty.createSpan({text:'没有匹配笔记，换个关键词试试。'});if(filtered)button(empty,'清除筛选','rotate-ccw',()=>this.clearSidebarFilters());}
    if (files.length > 100) list.createDiv({ cls: 'ts-muted', text: '显示当前排序的前 100 篇，请搜索或筛选标签缩小范围。' });
  }
  private async exportCanvas() {
    if (!this.session) return;
    const f = await this.plugin.createUnique(this.file?.parent?.path || ROOT, `${this.file?.basename || '白板'}-导出`, 'canvas', JSON.stringify(canvasExport(this.session.board), null, 2));
    new Notice(`已导出原生 Canvas：${f.path}`); await this.app.workspace.getLeaf('tab').openFile(f);
  }
}

class WorkspaceSettingsModal extends Modal {
  constructor(app:App,private plugin:ThoughtSpace){super(app);}
  onOpen(){this.modalEl.addClass('ts-workspace-settings-modal');themeSurface(this.modalEl);this.titleEl.setText('工作台设置');const tab=new ThoughtSpaceSettings(this.app,this.plugin);tab.containerEl=this.contentEl;tab.display();}
  onClose(){this.contentEl.empty();}
}

class ThoughtSpaceSettings extends PluginSettingTab {
  private page: 'appearance' | 'filing' | 'board' | 'input' | 'images' = 'appearance';
  constructor(app: App, private plugin: ThoughtSpace) { super(app, plugin); }
  display() {
    const { containerEl } = this; containerEl.empty(); containerEl.addClass('ts-settings');containerEl.dataset.accent=this.plugin.settings.accent;
    const hero = containerEl.createDiv('ts-settings-hero'); setIcon(hero.createDiv('ts-settings-logo'), 'network');
    const intro = hero.createDiv(); new Setting(intro).setName('ThoughtSpace').setHeading(); intro.createEl('p', { text: '知识空间 · 让阅读、思考与整理保持顺手。' });
    const tabs = containerEl.createDiv('ts-settings-tabs');
    for (const [id, label, icon] of [['appearance', '界面与阅读', 'palette'], ['board','白板体验','sliders-horizontal'], ['input','鼠标与键盘','mouse'], ['filing', '文件与归档', 'folders'],['images','图片与图床','image']] as const) {
      const tab = button(tabs, label, icon, () => { this.page = id; this.display(); }); tab.toggleClass('is-active', this.page === id);
    }
    const persist = () => this.plugin.savePreferences();
    if(this.page==='images'){
      const api=imageHostApi(this.app);
      new Setting(containerEl).setName('极速图床').setDesc(api?(api.status().ready?'已连接 · COS 上传可用':'已连接 · 请在极速图床中选择并配置 COS'):'需要在同一笔记库安装并启用极速图床 0.9.0 或更新版本。').addButton(b=>b.setButtonText('图床设置').onClick(()=>{const settings=hostSettings(this.app);if(!settings){new Notice('当前 Obsidian 版本无法直接打开插件设置');return;}settings.open();settings.openTabById('fast-image-bed');}));
      new Setting(containerEl).setName('新图片使用极速图床').setDesc('导入、粘贴或拖入白板时，使用极速图床的 COS、压缩和隐私设置上传。始终保留本地附件，失败或链接失效时回退本地。密钥由极速图床管理。').addToggle(t=>t.setValue(this.plugin.settings.imageHostEnabled===true).onChange(value=>{this.plugin.settings.imageHostEnabled=value;act(persist);}));
      containerEl.createEl('p',{text:'已有图片可通过右键“上传到极速图床”上传。移出白板与白板撤销只改变引用，不删除云端图片。',cls:'ts-muted'});return;
    }
    if(this.page==='board'){boardPreferenceControls(containerEl.createDiv('ts-board-preferences'),this.plugin.settings,persist,{includeMouse:false});return;}
    if(this.page==='input'){mousePreferenceControls(containerEl.createDiv('ts-board-preferences'),this.plugin.settings,persist,()=>{const settings=hostSettings(this.app);if(!settings){new Notice('请打开 Obsidian 设置中的快捷键，搜索 ThoughtSpace');return;}settings.open();settings.openTabById('hotkeys');});return;}
    if (this.page === 'appearance') {
      new Setting(containerEl).setName('白板原生搜索').setDesc('自动更新 ThoughtSpace/白板搜索 中的 Markdown 索引；支持原生搜索并定位节点。关闭后停止更新，已有索引保留。').addToggle(t=>t.setValue(this.plugin.settings.boardSearchEnabled!==false).onChange(value=>{this.plugin.settings.boardSearchEnabled=value;this.plugin.rebuildBoardSearch();act(persist);}));
      new Setting(containerEl).setName('笔记 Markdown 工具栏').setDesc('在普通笔记和侧栏笔记的编辑模式显示格式工具；使用原生撤销与自动保存。').addToggle(t=>t.setValue(this.plugin.settings.noteMarkdownToolbar!==false).onChange(value=>{this.plugin.settings.noteMarkdownToolbar=value;this.plugin.noteToolbar?.refresh();act(persist);}));
      new Setting(containerEl).setName('画布外观').setHeading().setClass('ts-settings-section');
      new Setting(containerEl).setName('界面材质').setDesc('柔光保留轻盈层次，纸感使用实色面板和更清晰的边界。').addDropdown(d=>d.addOptions({soft:'柔光',paper:'纸感'}).setValue(this.plugin.settings.surfaceStyle).onChange(value=>{this.plugin.settings.surfaceStyle=value as 'soft'|'paper';act(persist);}));
      new Setting(containerEl).setName('阅读桌字号').setDesc('仅影响独立阅读桌，保留白板对象字号；重新打开阅读桌生效。').addDropdown(d=>d.addOptions({'14':'14 px','16':'16 px','18':'18 px','20':'20 px'}).setValue(String(this.plugin.settings.readingSize)).onChange(value=>{this.plugin.settings.readingSize=Number(value);act(persist);}));
      new Setting(containerEl).setName('阅读桌行宽').setDesc('标准行宽适合长文，宽版适合表格。重新打开阅读桌生效。').addDropdown(d=>d.addOptions({standard:'标准 · 680 px',wide:'宽版 · 920 px'}).setValue(this.plugin.settings.readingWidth).onChange(value=>{this.plugin.settings.readingWidth=value as 'standard'|'wide';act(persist);}));
      new Setting(containerEl).setName('强调色').setDesc('改变按钮、选中状态与导航的颜色；卡片自己的配色保留。').addDropdown(drop => drop.addOptions({forest:'森林绿',blue:'湖水蓝',amber:'暖琥珀',rose:'玫瑰色'}).setValue(this.plugin.settings.accent).onChange(value => { this.plugin.settings.accent = value as AppearanceSettings['accent'];containerEl.dataset.accent=value;act(persist); }));
      new Setting(containerEl).setName('画布背景').setDesc('选择位置参照、纯色或细腻纸张纹理。').addDropdown(drop => drop.addOptions({dots:'点阵',grid:'网格',plain:'纯色',paper:'纸张纹理',image:'自定义图片'}).setValue(this.plugin.settings.canvasBackground).onChange(value => { if(value==='image'&&!this.plugin.settings.backgroundImagePath){drop.setValue(this.plugin.settings.canvasBackground);this.plugin.openBackgroundImageSettings();return;}this.plugin.settings.canvasBackground = value as AppearanceSettings['canvasBackground']; act(persist); }));
      new Setting(containerEl).setName('纸张外观').setDesc('米黄、白色、暖白、牛皮纸、再生纸；可自定义纸色和纹理强度。').addButton(b=>b.setButtonText('自定义纸张').onClick(()=>{this.plugin.openPaperSettings();}));
      new Setting(containerEl).setName('自定义背景图片').setDesc('选择本地图片，设置填满、完整显示或平铺，以及透明度。图片保存在本库插件目录中。').addButton(b=>b.setButtonText('设置背景图片').onClick(()=>{this.plugin.openBackgroundImageSettings();}));
      new Setting(containerEl).setName('液态玻璃效果').setDesc('半透明磨砂、柔和高光和圆角层次；关闭后使用实色界面。').addToggle(toggle=>toggle.setValue(this.plugin.settings.glassEffects!==false).onChange(value=>{this.plugin.settings.glassEffects=value;act(persist);}));
      new Setting(containerEl).setName('显示小地图').setDesc('显示当前位置和白板全貌；窄窗格会自动收起。').addToggle(toggle => toggle.setValue(this.plugin.settings.showMinimap).onChange(value => { this.plugin.settings.showMinimap = value; act(persist); }));
      new Setting(containerEl).setName('阅读与空间').setHeading().setClass('ts-settings-section');
      new Setting(containerEl).setName('界面密度').setDesc('舒适布局展示卡片摘要；紧凑布局节省侧栏空间。').addDropdown(drop => drop.addOptions({comfortable:'舒适',compact:'紧凑'}).setValue(this.plugin.settings.density).onChange(value => { this.plugin.settings.density = value as AppearanceSettings['density']; act(persist); }));
      containerEl.createDiv({ cls: 'ts-settings-tip', text: '在左侧切换卡片、白板、任务与大纲。选中内容后，在顶部调整文字和边框；右键打开更多操作。⌘ / Ctrl + F 查找白板内容，右键白板名称可重命名。外观选项实时应用。' });
      return;
    }
    containerEl.createEl('p', { cls: 'ts-muted', text: '多标签默认使用 Obsidian 返回的第一个标签（属性标签优先）；单张卡片可通过右键选择归档标签。' });
    new Setting(containerEl).setName('自动整理').setHeading().setClass('ts-settings-section');
    new Setting(containerEl).setName('自动按标签归档').setDesc('仅自动管理卡片目录内的笔记。在原生编辑器或属性区修改标签后移动文件；删除最后一个标签时放入“未分类”。').addToggle(toggle => toggle.setValue(this.plugin.settings.autoFileCards).onChange(value => { this.plugin.settings.autoFileCards = value; act(persist); }));
    new Setting(containerEl).setName('清理空标签文件夹').setDesc('归档后，原标签文件夹为空时放入回收站。含笔记、附件或其他文件的文件夹始终保留。').addToggle(toggle => toggle.setValue(this.plugin.settings.cleanupEmptyFolders).onChange(value => { this.plugin.settings.cleanupEmptyFolders = value; act(persist); }));
    new Setting(containerEl).setName('保存位置').setHeading().setClass('ts-settings-section');
    let cards = this.plugin.settings.cardFolder;const journals = this.plugin.journalRoot;
    new Setting(containerEl).setName('卡片根目录').setDesc('标签 #研究/阅读 → 此目录/研究/阅读。没有标签 → 此目录/未分类。').addText(input => input.setValue(cards).onChange(value => { cards = value; }));
    new Setting(containerEl).setName('日历与日记').setDesc('已独立为 ThoughtSpace 日历与日记。日记目录、任务和外观请在新插件的设置中管理。');
    new Setting(containerEl).setName('保存目录设置').setDesc('修改目录只影响之后的新建和归档；不会批量移动旧根目录。').addButton(btn => btn.setButtonText('保存目录').setCta().onClick(() => act(async () => { Object.assign(this.plugin.settings, validateFolders(cards, journals)); await persist(); new Notice('目录设置已保存'); })));
    new Setting(containerEl).setName('整理已有文件').setHeading().setClass('ts-settings-section');
    new Setting(containerEl).setName('整理已有卡片').setDesc('仅整理卡片根目录内的 Markdown；每次移动前备份，同名文件自动加序号。').addButton(btn => btn.setButtonText('按标签整理').onClick(() => act(async () => { btn.setDisabled(true); try { await this.plugin.fileAllCards(); } finally { btn.setDisabled(false); } })));
    new Setting(containerEl).setName('整理旧日记').setDesc('将日记根目录下的 YYYY-MM-DD.md 移到年/月目录。同日目标已存在时保留两个版本，不覆盖。').addButton(btn => btn.setButtonText('整理为年/月').onClick(() => act(async () => { btn.setDisabled(true); try { await this.plugin.fileOldJournals(); } finally { btn.setDisabled(false); } })));
    containerEl.createEl('p', { cls: 'ts-muted', text: `归档前的笔记、白板引用备份和移动记录保存在 ${this.app.vault.configDir}/plugins/thoughtspace/filing-backups/。文件移动不属于白板布局撤销。Obsidian 原生文件列表与搜索保持可用。` });
  }
}
