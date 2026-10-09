import {NativeBoardEditorPicker} from './board-save-feedback-native';
import {renderBoardSaveFeedback,type BoardSaveFeedback,type BoardSaveFeedbackAction} from './board-save-feedback';
import {appendPendingBoardReference,removePendingBoardReference,type PendingBoardReference} from './pending-board-references';
import {brainIdeaNode,brainIdeaToNote,brainNoteFolder} from './brain-board-idea';
import {readBoardDocument,replaceBoardDocumentLayout,createMarkdownBoardDocument,isMarkdownBoardFrontmatter,type BoardDocument} from './board-document';
import {isBoardPath} from './board-path';
import {hasNativeBoardEditor,assertBoardEditorOwnership,settleNativeBoardEditor,subscribeNativeBoardEditorDrains,clearNativeBoardEditorTracking,nativeBoardEditorStatus,nativeBoardEditorLeaves} from './board-editor-ownership';
import {boardBackground,cleanBoardBackground} from './board-background';
import {brainColorsStamp,cleanBrainColors,type BrainColors} from './brain-colors';
import {BrainColorsModal} from './brain-colors-view';
import {supportsLocalRelations,localRelationNode} from './local-relations';
import {createBoardMindmapState,validBoardMindmapState,remapBoardMindmapState,updateBoardMindmapState,type BoardMindmapState} from './board-mindmap';
import {BoardMindmapView,type BoardMindmapHost} from './board-mindmap-view';
import {BrainBoardView,type BrainBoardHost} from './brain-board-view';
import {planBrainNoteRelation,type BrainRelationSide} from './brain-board-create';
import {BrainRelationCreateModal,type BrainNoteTarget} from './brain-board-create-view';
import {createBrainBoard,isBrainBoard} from './brain-board';
import {nativeLocalRelations,type NativeLocalEvidence} from './local-relations-native';
import {localHeadingTree,validateLocalHeadingTarget,localHeadingTextMatches,type LocalHeadingTarget} from './local-relations-headings';
import {captureLocalRelationEdit,planLocalRelationEdit,LocalRelationEditSaveError,type LocalRelationMutation,type LocalRelationEditResult} from './local-relations-edit';
import {cleanLocalRelationsState,rememberLocalRelationsState,remapLocalRelationsPreferences,type LocalRelationsSavedState} from './local-relations-state';
import {LocalRelationsView,LOCAL_RELATIONS_VIEW,type LocalRelationsHost} from './local-relations-view';
import {expandLocalRelationPane,LocalRelationsEditorReturn} from './local-relations-editor';
import {relationGeometryShape,relationGeometryTextStamp,canPersistRelationGeometry,validRelationGeometryCheckpoint,type RelationGeometryEntry} from './relation-geometry-checkpoint';
import {locateParagraph,type ParagraphOrigin} from './paragraph-card';
import {PdfQuoteModal} from './pdf-quote-view';
import {planPdfQuote,resolvePdfQuotePath,pdfQuoteFragment,samePdfQuote,type PdfQuotePlan} from './pdf-quote';
import {MinimapAvoidance,minimapInsets,overlapsMinimap,type ScreenBox} from './minimap-avoidance';
import {applyWorkspaceDensity} from './workspace-density';
import {mediaTimestampNode} from './media-timestamp-target';
import {webUrl,webCard,updateWebCard,renderWebCard} from './web-card';
import {OnlinePlatform,parseOnlineSource,resolveOnlineSource,type OnlineState} from './online-platform';
import {OnlineWorkspaceView,ONLINE_WORKSPACE,type OnlineWorkspaceHost} from './online-workspace-view';
import {OnlineMediaService} from './online-media-service';
import {onlineNoteSource,onlinePlayerUrl,parseOnlinePlayerUrl} from './online-media-notes';
import {mountOnlineBoardPlayer,type OnlineBoardMoment,type OnlineBoardPlayerHandle} from './online-board-player';
import {ExternalMediaPicker} from './external-media-picker';
import {createExternalMediaReference,isExternalMediaReference} from './external-media';
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
import {renderCardPreview} from './card-preview';
import {mountCardQuickActions} from './card-quick-actions';
import {mountCardReadingAffordance} from './card-reading-affordance';
import {mountCardControlHover} from './card-control-hover';
import {foldControlObstacles} from './fold-control-obstacles';
import {resizedSection,sectionAtPoint,type SectionResizeEdge} from './section-resize';
import {cardControlLayout} from './card-control-layout';
import {whenBoardStylesReady} from './stylesheet-ready';
import {BlankDoubleClick} from './blank-double-click';
import {createHash} from 'crypto';
import {resolve as resolvePath} from 'path';
import {cleanPluginSettings,type ThoughtSpacePreferences} from './plugin-settings';
import {cleanBoardCreationPreferences,TemplateCreationIncompleteError,type BoardCreationPreferences,type BoardCreationFormat} from './board-creation';
import {BoardCreationModal} from './board-creation-view';
import {ThoughtSpaceSettings,settingsLanguage} from './settings-view';
import {hostPlugin,fileExplorer,hostSettings,workspaceLeafId,hostCommands} from './host-capabilities';
import {parseLayoutSnapshot} from './layout-snapshot-data';
import {isRecord,isUnknownArray} from './value-guards';
import {mediaDimensions} from './media-geometry';
import {measureDroppedImages} from './native-media-size';
import {setBoardEdgeStyle,inheritNewEdgeStyle} from './model';
import {BoardSearchSync,isSearchIndexPath,searchBoardPath,searchIndexTarget} from './native-search';
import {PdfDocumentPool} from './pdf-document-pool';
import {discloseBranches,makeChildConnection,makeChildConnections,childConnectionCandidates,type BranchDisclosure} from './branch-disclosure';
import {renderBranchControls} from './branch-controls';
import {isVaultMediaPath,mediaCard,mediaKind,mediaClock,mediaTime,mediaSourceMarkdown,parseMediaSourceUrl,type MediaSource} from './media-source';
import {mountMediaCard,type MediaCardState,type MediaCardHandle} from './media-card-player';
import {IndexedMediaDraftStorage,MediaDraftStore,type MediaDraft} from './media-draft-store';
import {MediaDraftRecoveryModal} from './media-draft-recovery';
import {MEDIA_WORKSPACE,MediaWorkspaceView,type MediaPlacement,type MediaWorkspaceHost} from './media-workspace-view';
import {MediaWorkspaceService} from './media-workspace-service';
import {imageMarkup,mediaPlayerUrl,parseMediaPlayerUrl,mediaNoteSource,type MediaMoment} from './media-notes';
import {pdfCard,pdfSubpath,pdfPage,renderPdfThumbnail,isPdfFile,pdfDropReference,pdfPageKey} from './pdf-card';
import {selectionFormatKey} from './selection-format';
import {applyCardStyle,applyDefaultCardStyle,cardStyleChoice,cardStyleChoices,effectiveCardStyle,supportsCardStyle,type CardStyleChoice} from './card-style';
import {cardHeadingColors} from './card-style-color';
import {selectionEdges,patchSelectionEdges,type SelectionEdgeScope} from './selection-edges';
import {renderEdgeFormatControls} from './edge-format-controls';
import {cardDisplayTitle,setCardTitle} from './card-title-model';
import {syncCardTitlePresentation} from './compact-card-title';
import {bindCardTitle} from './card-title-edit';
import {noteRenamePath} from './note-rename';
import {BrainNodeRenameModal} from './brain-board-rename-view';
import {createBoardReferenceRenamer,captureBoardReferenceRename} from './board-reference-rename';
import {SharedOpen} from './view-opening';
import type {BoardOpenNavigation} from './board-opening-navigation';
import {replaceSidebarContents,firstNoteReferences} from './sidebar-content';
import {boardUsages} from './board-usage';
import {sidebarSearchNavigation} from './sidebar-navigation';
import {toolbarNavigation} from './toolbar-navigation';
import type {SessionUpdate} from './session-events';
import {nodeRenderKey,syncNodeGeometry} from './node-render-key';
import {editTopic} from './mindmap-editor';
import {mindmapNavigation,mindmapParent} from './mindmap-navigation';
import {MindmapPresetsModal} from './mindmap-presets-view';
import {MindmapStudioModal} from './mindmap-studio-view';
import {mindmapSignature} from './mindmap-studio';
import {uploadHostedImage,remoteImageUrl} from './image-host';
import {videoCaptureRequest,addVideoCaptureCard,addVideoCaptureObjects,videoCaptureContent} from './video-capture';
import {yingjianNotePath,parseYingjianLink,isYingjianCaptureNote} from './yingjian';
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
import {centerViewportInSafeArea,fitViewportInSafeArea} from './viewport-fit';
import {preserveToolbarFocus} from './toolbar-focus';
import {installToolbarOverflow} from './toolbar-overflow';
import {installToolbarWheel} from './toolbar-scroll';
import {installRailToolSearch} from './rail-tool-search';
import {installToolPalettes} from './tool-palette';
import {boardWheelIntent} from './board-wheel';
import {boardInputCommands,type BoardInputAction,type BoardInputCommandTarget} from './board-input-commands';
import {brainRelationCommands,type BrainRelationCommandTarget} from './brain-relation-commands';
import {resumeRecentBoard} from './recent-board';
import {assertNativeNoteUnchanged,writeNativeNoteDraft,readCurrentNativeNote} from './native-note-state';
import {NoteMarkdownToolbars} from './note-markdown-toolbar';
import {InlineCardFit} from './inline-card-fit';
import {InlineNodeEditor} from './inline-node-editor';
import {markdownToolbar} from './markdown-toolbar';
import {LayoutRefreshQueue} from './layout-refresh-queue';
import {branchOutline,branchMarkdown,reparentBranch} from './mindmap-flow';
import {relationSelection,shortestRelationPath,unfoldRelationAncestors,insertBetween,insertionPosition,disconnectInternal,RelationDirection} from './graph-navigation';
import {excerptPresentation,textExcerptPresentation,ExcerptSource,sourceLinkTarget,resolveSourceLink,conceptDocument} from './excerpt-sources';
import {MaterialsModal,MaterialsWorkbench,MaterialAdapter} from './materials-view';
import {Fragment,OutlineTopic,outlineBoard,rebaseFragment,createFragmentRebaser,selectionFragment,pdfLiteralText,pdfExcerptDocument,excerptNoteMarkdown,MaterialImportOptions,MaterialImportResult,excerptDocuments} from './materials';
import {EdgeLayer} from './edge-layer';
import {connectionTarget,connectionSourceHit,duplicateConnection,reconnectEdge} from './connection-flow';
import {sectionBounds,validSectionRect,SectionRect,foldSections,sectionDisplayNode,sectionContains} from './sections';
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
import {BoardAction,BoardActionModal} from './board-experience-view';
import { boardOutline, measureNoteCard } from './workspace-tools';
import { designTokens, themeSurface } from './ui-tokens';
import { fitTextNode, inkLabels, textFontFamily } from './text-tools';
import {textFitsContent,textBlockPadding,nodeHasBorder} from './text-sizing';
import {resolveNativeNoteDrop,type NativeNoteReference} from './native-note-drop';
import { boardLink, parseBoardLink } from './deeplinks';
import { nativeBookmarks, NativeBookmarks, bookmarkedBoards } from './bookmarks';
import { normalizeNativeTags, suggestedNoteName } from './native-tags';
import { viewportRect, visibleNodes, intersects, RenderQueue } from './rendering';
import { connectionPath, connectionSides, Side } from './connections';
import { branchDescendants, branchState, branchTopology, visibleBranchBoard, unfoldAncestors, layoutMindmap, validateBranches } from './mindmap';
import {reflowReadingContent} from './expansion-reading-state';
import {branchRenderSnapshot,type BranchRenderSnapshot} from './branch-render';
import { TextModal, EdgeModal, ImagePicker, isImage } from './content-tools';
import {calendarService,requireCalendar} from './calendar-integration';
import { boardTemplates, cleanFavorites, remapFavorites,  OutlineKind, taskSummary, TaskFilter, visibleTasks } from './navigation';
import { Alignment, alignmentLabels, alignSelection, foldCards, visibleMarqueeSelection, moveSelection, selectionRect } from './board-tools';
import { isOverdue, readProperties, statuses } from './database';
import { DatabaseModal, PropertyStore } from './database-view';
import { App, type CachedMetadata, Component, FileSystemAdapter, FileView, ItemView, Keymap, FuzzySuggestModal, MarkdownView, MarkdownRenderer, Menu, Modal, Notice, Plugin, Scope, Setting, TAbstractFile, TFile, TFolder, View, WorkspaceLeaf, ViewStateResult, getAllTags, getFrontMatterInfo, loadPdfJs, normalizePath, parseLinktext, parseYaml, setIcon } from 'obsidian';
import { assertBoardGeometry, Board, Card, cardFillHex, validCardFill, History, boardLinks, wouldCycle, expandedSelection, movableSelection, extractSubboard, tidyBoard, canvasExport, clone, colors, colorNames, contained, emptyBoard, extractTasks, parseBoard, removeNodes, safeName, toggleTask, uid } from './model';
import { localDay, tagFolder } from './filing';
import { LibraryScope, LibrarySort, libraryFiles, noteExcerpt, isWorkspaceFile } from './workspace';

const DOCK = 'thoughtspace-navigator',MATERIALS='thoughtspace-materials',MATERIAL_DRAG='text/x-thoughtspace-fragment';
const VIEW = 'thoughtspace-board', EXT = 'thoughtspace', ROOT = 'ThoughtSpace';
/** Cache classification is for discovery only; opening always validates the full document. */
function isBoardFile(app:App,file:TFile):boolean {return isWorkspaceFile(file)&&(file.extension===EXT||file.extension.toLowerCase()==='md'&&isMarkdownBoardFrontmatter(app.metadataCache.getFileCache(file)?.frontmatter));}
const report = (e: unknown) => { console.error('[ThoughtSpace]', e); new Notice(`思维白板：${e instanceof Error ? e.message : String(e)}`, 8000); };
const act = (f: () => unknown) => { try { Promise.resolve(f()).catch(report); } catch (e) { report(e); } };
function button(parent: HTMLElement, label: string, icon: string, callback: () => unknown, cls = '') {
  const b = parent.createEl('button', { cls: `ts-button ${cls}`, attr: { 'aria-label': label, title: label } });
  if (icon) setIcon(b.createSpan(), icon);
  b.createSpan({ text: label }); b.onclick = () => act(callback); return b;
}
class Prompt extends Modal {
  constructor(app: App, private title: string, private initial: string, private submit: (text: string, choice?: string) => Promise<void> | void, private choice?: {label:string;value:string;items:{value:string;text:string}[]}) { super(app); }
  onOpen() {
    this.modalEl.addClass('ts-prompt-modal');themeSurface(this.modalEl);
    this.contentEl.createEl('h2', { text: this.title });
    let select:HTMLSelectElement|undefined;
    if(this.choice){const label=this.contentEl.createEl('label',{text:this.choice.label});select=label.createEl('select',{cls:'dropdown ts-wide ts-prompt-choice',attr:{'aria-label':this.choice.label}});for(const item of this.choice.items)select.createEl('option',{value:item.value,text:item.text});select.value=this.choice.value;}
    const input = this.contentEl.createEl('input', { type: 'text', value: this.initial, cls: 'ts-wide' });
    const save = button(this.contentEl, '确定', 'check', async () => { if (!input.value.trim()) return; save.disabled = true; if(select)select.disabled=true; try { await this.submit(input.value.trim(),select?.value); const target=this.app?.workspace?.getActiveViewOfType(View);this.close();if(target instanceof View&&target.containerEl.isConnected&&target.leaf?.view===target)this.app.workspace.setActiveLeaf(target.leaf,{focus:true}); } finally { save.disabled = false; if(select)select.disabled=false; } }, 'mod-cta');
    input.onkeydown = e => { if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return; if (e.key === 'Enter') { e.preventDefault(); save.click(); } }; input.focus(); input.select();
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
  getItems() { return this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => isBoardFile(this.app,f) && f !== this.current); }
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
        for(const file of this.app.vault.getFiles().filter(isWorkspaceFile).filter(f=>isBoardFile(this.app,f))) {
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
type BrainCreationSaveRetry={stamp:string;note?:{file:TFile;path:string;body?:string};conversion?:{idea:Card;node:Card}};
class Session {
  readonly convertingTexts=new Set<string>();
  private relationGeometry=new Map<string,{shape:string;text?:string;file:TAbstractFile|null|undefined;mtime?:number;size?:number;ctime?:number}>();
  brainGraphRevision=0;
  board: Board; history = new History(); listeners = new Set<(kind:SessionUpdate) => void>(); baseline: string;
  saving = false; private writeBlocked=false;private nativeReadonly=false;private document?:BoardDocument;private layoutBaseline='';status = '已保存'; private persistQueued=false;private externalRead=0; private queue: Promise<void> = Promise.resolve();
  private nativePageCount:number|undefined;private nativeReason='';private writeError='';private recoveryError='';private savedRecovery?:TFile;
  get recoveryFile(){return this.savedRecovery;}
  get saveFeedback():BoardSaveFeedback {
    if(this.writeBlocked){
      const recovery=this.savedRecovery,valid=!!recovery&&this.plugin.app.vault.getAbstractFileByPath?.(recovery.path)===recovery;
      const detail=[this.writeError,this.recoveryError&&`恢复草稿保存失败：${this.recoveryError}`,recovery&&!valid?'恢复草稿已移除或替换；当前布局仍在本页，请导出保留。':''].filter(Boolean).join(' · ');
      return{state:'error',text:recovery&&!valid?'恢复草稿不可用 · 请导出保留布局':this.status,detail,recoveryPath:valid?recovery.path:undefined,action:valid?{kind:'open-recovery',label:'打开恢复草稿'}:undefined};
    }
    if(this.nativeReadonly){
      const ownership=this.nativePageCount===undefined?undefined:{open:this.nativePageCount},transition=this.plugin.nativeBoardTransitions?.has(this.file);
      if(transition)return{state:'paused',text:'原生页面正在交接 · 白板仅查看',detail:'正在确认原生最新内容已保存。完成后重新读取原文件；不会覆盖原生草稿。'};
      if(this.nativeReason==='native-reload')return{state:'paused',text:'原生保存已完成 · 正在重新读取白板',detail:'读取并核实最新原生属性、正文与布局后恢复编辑；当前布局仍受保护。'};
      if(ownership&&ownership.open===0)return{state:'paused',text:'旧原生页保存尚未确认 · 等待保存完成',detail:'原生页已关闭，仍有保存缓冲未完成或无法核实。完成确认并重新读取后恢复白板编辑。'};
      return{state:'paused',text:'原生 Markdown 已打开 · 白板仅查看',detail:ownership&&ownership.open>1?`此文件在 ${ownership.open} 个原生页打开。请保存并关闭其他原生页，再从保留页返回白板。`:'请在原生页保存属性与正文，再使用“返回白板”；当前布局保留。',action:{kind:'locate-native',label:'定位原生页'}};
    }
    return{state:this.status==='保存中…'?'saving':'saved',text:this.status};
  }
  get nativeEditingPaused(){return this.nativeReadonly;}
  get blocked(){return this.writeBlocked||this.nativeReadonly;}
  set blocked(value:boolean){this.writeBlocked=value;if(!value){this.writeError='';this.recoveryError='';this.savedRecovery=undefined;}}
  constructor(private plugin: ThoughtSpace, public file: TFile, raw: string) { if(file.extension?.toLowerCase()==='md'){this.document=readBoardDocument(raw,'md',parseYaml);this.board=this.document.board;this.layoutBaseline=JSON.stringify(this.board,null,2);}else this.board = parseBoard(raw); this.baseline = raw;this.restoreRelationGeometry();this.refreshNativeEditing(); }
  refreshNativeEditing(){
    if(!this.document||this.writeBlocked)return;
    const transition=!!this.plugin.nativeBoardTransitions?.has(this.file),ownership=this.plugin.nativeBoardEditorStatus?.(this.file),paused=transition||(ownership?ownership.open>0||ownership.pending>0:hasNativeBoardEditor(this.plugin.app,this.file));
    if(!paused&&!this.nativeReadonly)return;
    const reason=transition?'handoff':!paused?'native-reload':ownership&&ownership.open===0?'native-saving':'native-open',already=this.nativeReadonly;
    if(already&&reason===this.nativeReason&&this.nativePageCount===ownership?.open)return;this.nativeReason=reason;this.nativePageCount=ownership?.open;this.nativeReadonly=true;
    this.status=reason==='handoff'?'原生页面正在交接 · 白板仅查看':reason==='native-reload'?'原生保存已完成 · 正在重新读取白板':reason==='native-saving'?'旧原生页保存尚未确认 · 等待保存完成':'原生 Markdown 已打开 · 白板仅查看';this.emit(already?'status':'board');
  }
  emit(kind:SessionUpdate='board') { this.listeners.forEach(fn => {try{fn(kind);}catch(e){report(e);}}); }
  /** Only these whole-field replacements can share graph references with before.
   * change still validates and saves; History.push immediately serializes before.
   * Node/edge mutators must continue using change's full-board clone. */
  changeBrainState(next:BoardMindmapState){
    if(this.blocked||!isBrainBoard(this.board))return;
    if(!validBoardMindmapState(next))throw Error('脑图状态无效，未写入白板');
    const value=clone(next);this.change(board=>{board.brain=value;},{...this.board},false,true,false,true);
  }
  changeBrainViewport(next:{x:number;y:number;zoom:number}){
    if(this.blocked||!isBrainBoard(this.board)||![next.x,next.y,next.zoom].every(Number.isFinite)||next.zoom<.15||next.zoom>2.5)return;
    const value={...next};this.change(board=>{board.brainViewport=value;},{...this.board},false,false,false,true);
  }
  change(fn: (b: Board) => void, before?: Board, allowLocked=false, recordHistory=true, measurement=false, geometryOnly=false, preserveRelationGeometry=false) {
    this.refreshNativeEditing();if (this.blocked) { new Notice(this.nativeReadonly?'原生 Markdown 已打开，请切回白板后编辑布局。':'白板已暂停写入，请关闭所有该白板标签页后重新打开。'); return; }
    if(before===undefined)before=clone(this.board);
    const geometryBefore=this.relationGeometry.size?new Map(this.relationGeometry):undefined;
    try { fn(this.board); inheritNewEdgeStyle(this.board,before); if(!allowLocked){let nodeIndex:Map<string,Card>|undefined;for(const old of before.nodes){if(!old.locked)continue;nodeIndex??=new Map(this.board.nodes.map(n=>[n.id,n]));const current=nodeIndex.get(old.id);if(!current)throw Error('请先解锁对象再移出或转换');if(current.locked)Object.assign(current,{x:old.x,y:old.y,width:old.width,height:old.height,collapsed:old.collapsed,expandedHeight:old.expandedHeight});}}assertBoardGeometry(this.board);validateBranches(this.board);if(!geometryOnly)reflowReadingContent(this.board,before,{measurement});assertBoardGeometry(this.board); } catch(e) { this.board=before;if(geometryBefore)this.relationGeometry=geometryBefore;else this.relationGeometry.clear(); throw e; } if (this.board.version < 2 && this.board.nodes.some(n => n.kind === 'board')) this.board.version = 2;
    // No-op commands must not clear redo, retain duplicate snapshots or repaint all views.
    if(Session.sameState(this.board,before))return;
    if(preserveRelationGeometry)this.holdRelationGeometry(before,this.board);this.pruneRelationGeometry();
    if(before.nodes!==this.board.nodes||before.edges!==this.board.edges)this.brainGraphRevision++;
    if(recordHistory)this.history.push(before); this.persist(); this.emit();
  }
  private static sameState(a:unknown,b:unknown):boolean {
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
    if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>Session.sameState(value,b[i]));
    const left=a as Record<string,unknown>,right=b as Record<string,unknown>;
    const keys=Object.keys(left).filter(key=>left[key]!==undefined),other=Object.keys(right).filter(key=>right[key]!==undefined);
    return keys.length===other.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(right,key)&&Session.sameState(left[key],right[key]));
  }
  undo(redo = false) { this.refreshNativeEditing();if (this.blocked) return; const b = redo ? this.history.redo(this.board) : this.history.undo(this.board); if (b) { const previous=this.board;this.board = b;this.brainGraphRevision++;this.restoreRelationGeometry();this.holdRelationGeometry(previous,b,false);this.pruneRelationGeometry(); this.persist(); this.emit(); } }
  private relationGeometryIdentity(node:Card){
    const path=node.paragraphQuote?.path||node.file,file=path?this.plugin.app?.vault.getAbstractFileByPath?.(path):undefined,stat=file&&'stat'in file?file.stat as {mtime:number;size:number;ctime?:number}:undefined;
    return{shape:relationGeometryShape(node),text:node.text,file,mtime:stat?.mtime,size:stat?.size,ctime:stat?.ctime};
  }
  /** A relation can remount previews without requesting new saved dimensions.
   * The optional board checkpoint protects only affected automatic nodes across
   * reopening; source or sizing changes and explicit fit still release them. */
  private holdRelationGeometry(before:Board,after:Board,record=true){
    if(Session.sameState(before.edges,after.edges))return;
    const affected=new Set<string>(),oldEdges=new Map(before.edges.map(edge=>[edge.id,edge])),newEdges=new Map(after.edges.map(edge=>[edge.id,edge]));
    for(const edge of before.edges)if(!Session.sameState(edge,newEdges.get(edge.id))){affected.add(edge.from);affected.add(edge.to);}
    for(const edge of after.edges)if(!Session.sameState(edge,oldEdges.get(edge.id))){affected.add(edge.from);affected.add(edge.to);}
    const oldHidden=branchState(before).hidden,newHidden=branchState(after).hidden;for(const id of oldHidden)if(!newHidden.has(id))affected.add(id);for(const id of newHidden)if(!oldHidden.has(id))affected.add(id);
    // History must retain the source stamp from the original transaction. Undo
    // cannot bind old geometry to a source that has since changed.
    if(record){
      const entries=new Map(before.relationGeometry?.entries.map(entry=>[entry.id,entry]));
      for(const node of before.nodes)if(affected.has(node.id)&&canPersistRelationGeometry(node)){const entry=this.relationGeometryEntry(node);if(entry)entries.set(node.id,entry);}
      if(entries.size)before.relationGeometry={version:1,entries:[...entries.values()]};
    }
    for(const node of after.nodes)if(affected.has(node.id)&&['card','text','image','pdf'].includes(node.kind)&&(record||!canPersistRelationGeometry(node)))this.relationGeometry.set(node.id,this.relationGeometryIdentity(node));
  }
  private relationGeometryEntry(node:Card):RelationGeometryEntry|undefined{
    const identity=this.relationGeometryIdentity(node);
    const source=identity.file&&identity.mtime!==undefined&&identity.size!==undefined?{path:identity.file.path,mtime:identity.mtime,size:identity.size,...(identity.ctime===undefined?{}:{ctime:identity.ctime})}:undefined;
    const entry={id:node.id,shape:identity.shape,textStamp:relationGeometryTextStamp(identity.text),source};
    return validRelationGeometryCheckpoint({version:1,entries:[entry]},[node])?entry:undefined;
  }
  private restoreRelationGeometry(){
    this.relationGeometry.clear();const entries=this.board.relationGeometry?.entries;if(!entries?.length)return;
    const nodes=new Map(this.board.nodes.map(node=>[node.id,node]));
    for(const entry of entries){const node=nodes.get(entry.id);if(!node||!canPersistRelationGeometry(node))continue;const current=this.relationGeometryEntry(node);if(Session.sameState(entry,current))this.relationGeometry.set(node.id,this.relationGeometryIdentity(node));}
  }
  private syncRelationGeometry(){
    const entries:RelationGeometryEntry[]=[];
    for(const node of this.board.nodes){const held=this.relationGeometry.get(node.id);if(!held)continue;const current=this.relationGeometryIdentity(node);
      if(held.shape!==current.shape||held.text!==current.text||held.file!==current.file||held.mtime!==current.mtime||held.size!==current.size||held.ctime!==current.ctime){this.relationGeometry.delete(node.id);continue;}
      if(canPersistRelationGeometry(node)){const entry=this.relationGeometryEntry(node);if(entry)entries.push(entry);}
    }
    if(entries.length)this.board.relationGeometry={version:1,entries};else delete this.board.relationGeometry;
  }
  private pruneRelationGeometry(){
    if(!this.relationGeometry.size&&!this.board.relationGeometry)return;
    const nodes=new Map(this.board.nodes.map(node=>[node.id,node]));
    for(const[id,held]of this.relationGeometry){const node=nodes.get(id),current=node&&this.relationGeometryIdentity(node);if(!current||held.shape!==current.shape||held.text!==current.text||held.file!==current.file||held.mtime!==current.mtime||held.size!==current.size||held.ctime!==current.ctime)this.relationGeometry.delete(id);}
    this.syncRelationGeometry();
  }
  relationGeometryHeld(node:Card){const held=this.relationGeometry.get(node.id);if(!held)return false;const live=this.board.nodes.find(current=>current.id===node.id),current=live&&this.relationGeometryIdentity(live);if(current&&held.shape===current.shape&&held.text===current.text&&held.file===current.file&&held.mtime===current.mtime&&held.size===current.size&&held.ctime===current.ctime)return true;this.relationGeometry.delete(node.id);this.syncRelationGeometry();return false;}
  releaseRelationGeometry(ids:ReadonlySet<string>){if(!ids.size)return;for(const id of ids)this.relationGeometry.delete(id);this.syncRelationGeometry();}
  persist() {
    this.refreshNativeEditing();if(this.blocked)return;
    if(this.status!=='保存中…'){this.status = '保存中…';this.emit('status');}
    if(this.persistQueued)return;this.persistQueued=true;
    this.queue = this.queue.then(async () => {
      this.persistQueued=false;
      if (this.blocked&&(!this.document||!this.nativeReadonly||this.writeBlocked)) return;
      try{assertBoardGeometry(this.board);}catch(e){this.blocked=true;this.writeError=e instanceof Error?e.message:String(e);this.status='布局数据无效 · 原文件未覆盖';this.emit('board');report(e);return;}
      const next = JSON.stringify(this.board, null, 2); if (next === (this.document?this.layoutBaseline:this.baseline)) { if(!this.nativeReadonly)this.status = '已保存'; this.emit('status'); return; }
      const snapshot=this.document?JSON.parse(next) as Board:undefined,document=this.document;
      this.saving = true;
      try {
        let saved:BoardDocument|undefined;
        await this.plugin.app.vault.process(this.file, disk => {
          if(this.plugin.app.vault.getAbstractFileByPath&&this.plugin.app.vault.getAbstractFileByPath(this.file.path)!==this.file)throw Error('白板已删除或被替换，原目标未修改');
          if(document&&this.file.extension.toLowerCase()!=='md')throw Error('白板格式在保存期间已变化，原目标未修改');
          if(document&&snapshot){if(this.plugin.nativeBoardTransitions?.has(this.file))throw Error('原生视图正在交接，布局未写入');assertBoardEditorOwnership(this.plugin.app,this.file);saved=replaceBoardDocumentLayout(disk,document,snapshot,parseYaml);return saved.source;}
          if (disk !== this.baseline) throw new Error('检测到其他窗口或同步工具修改了白板'); return next;
        });
        if(saved){this.document=saved;this.baseline=saved.source;this.layoutBaseline=next;}else this.baseline = next;
        this.status = this.persistQueued?'保存中…':'已保存';
      } catch (e) {
        this.blocked = true;this.writeError=e instanceof Error?e.message:String(e); this.status = '保存失败 · 本地草稿保留中';
        try {
          const body=this.document?replaceBoardDocumentLayout(this.document.source,this.document,this.board,parseYaml).source:JSON.stringify(this.board,null,2);
          const recovered = await this.plugin.createUnique(this.file.parent?.path || '', `${this.file.basename}-恢复草稿`, this.document?'md':EXT, body);
          this.savedRecovery=recovered;this.recoveryError='';this.status = '写入暂停 · 已另存恢复草稿'; new Notice(`原白板未被覆盖。当前布局已另存：${recovered.path}`, 12000);
        } catch (backupError) {this.recoveryError=backupError instanceof Error?backupError.message:String(backupError); report(backupError); this.status = '保存失败 · 请用导出保留布局'; }
        report(e);
      } finally { this.saving = false; this.emit(this.blocked?'board':'status'); }
    });
  }
  async flush() { let pending:Promise<void>;do{pending=this.queue;await pending;}while(pending!==this.queue); }
  async externalUpdate() {
    // Read while the native lock remains held. Only a completed fresh read can
    // release it; repainting a stale Session must never precede the handoff.
    this.refreshNativeEditing();
    const unavailable=()=>this.writeBlocked||!!this.document&&(!!this.plugin.nativeBoardTransitions?.has(this.file)||hasNativeBoardEditor(this.plugin.app,this.file));
    if(unavailable())return;
    const resumeNative=this.nativeReadonly,readId=++this.externalRead;let applied=false,readBaseline:string|undefined,readBoard:Board|undefined,readQueue:Promise<void>|undefined,externalPhase:'read'|'parse'='read';
    try{
      await this.flush();if(readId!==this.externalRead||this.saving||unavailable())return;
      const baseline=this.baseline,board=this.board,pending=this.queue,viewport={...board.viewport};readBaseline=baseline;readBoard=board;readQueue=pending;
      const raw=await this.plugin.app.vault.read(this.file);
      if(this.plugin.app.vault.getAbstractFileByPath&&this.plugin.app.vault.getAbstractFileByPath(this.file.path)!==this.file){this.blocked=true;this.writeError='原文件已删除或被其他文件替换；当前布局仍在本页，请导出保留。';this.status='白板已删除或被替换 · 已暂停写入';this.emit();return;}
      if(readId!==this.externalRead||unavailable()||this.saving||pending!==this.queue||baseline!==this.baseline||board!==this.board)return;
      if(raw===this.baseline){applied=true;return;}
      externalPhase='parse';const incoming=this.document?readBoardDocument(raw,'md',parseYaml):undefined,incomingBaseline=incoming?JSON.stringify(incoming.board,null,2):undefined;
      if(incoming&&this.document&&incoming.layoutSource===this.document.layoutSource){this.document=incoming;this.baseline=raw;this.status='已同步原生属性与正文';applied=true;this.emit('status');return;}
      const b=incoming?.board||parseBoard(raw),savedBoard=this.document?parseBoard(this.layoutBaseline):parseBoard(baseline),savedViewport=savedBoard.viewport;
      if(incoming&&!Session.sameState({...board,viewport:savedViewport},savedBoard)){
        this.blocked=true;this.writeError='外部布局与当前本地修改冲突；原文件未覆盖，当前布局仍在本页。';this.status='布局冲突 · 本地草稿保留中';
        try{
          const recovered=await this.plugin.createUnique(this.file.parent?.path||'',`${this.file.basename}-恢复草稿`,'md',replaceBoardDocumentLayout(this.document!.source,this.document!,board,parseYaml).source);
          this.savedRecovery=recovered;this.recoveryError='';this.status='写入暂停 · 已另存恢复草稿';new Notice(`外部布局未被覆盖。当前布局已另存：${recovered.path}`,12000);
        }catch(backupError){this.recoveryError=backupError instanceof Error?backupError.message:String(backupError);this.status='布局冲突 · 恢复草稿未保存，请导出保留布局';report(backupError);}
        this.emit();return;
      }
      if([viewport,savedViewport].some(camera=>board.viewport.x!==camera.x||board.viewport.y!==camera.y||board.viewport.zoom!==camera.zoom))b.viewport={...board.viewport};
      this.board=b;this.baseline=raw;if(incoming){this.document=incoming;this.layoutBaseline=incomingBaseline!;}this.history=new History();this.restoreRelationGeometry();this.status='已同步外部修改';applied=true;this.emit();
    }catch(e){if(readId!==this.externalRead||readBaseline!==undefined&&(readBaseline!==this.baseline||readBoard!==this.board||readQueue!==this.queue))return;this.blocked=true;this.writeError=e instanceof Error?e.message:String(e);this.status=externalPhase==='read'?'外部文件读取失败 · 已暂停写入':'外部文件格式错误 · 已暂停写入';this.emit();report(e);}
    finally{
      if(resumeNative&&applied&&readId===this.externalRead&&!unavailable()){this.nativeReadonly=false;if(this.nativeReason&&['原生 Markdown 已打开 · 白板仅查看','原生页面正在交接 · 白板仅查看','旧原生页保存尚未确认 · 等待保存完成','原生保存已完成 · 正在重新读取白板'].includes(this.status))this.status='已恢复白板编辑';this.nativeReason='';this.emit();}
    }
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
  mediaWorkspace!:MediaWorkspaceService;
  private mediaWorkspaceHost!:MediaWorkspaceHost;
  private mediaDrafts?:MediaDraftStore;
  private mediaRecovery?:MediaDraftRecoveryModal;
  private mediaOpening:Promise<unknown>=Promise.resolve();
  private mediaClosed=false;
  private onlinePlatform!:OnlinePlatform;
  private onlineMedia!:OnlineMediaService;
  private onlineWorkspaceHost!:OnlineWorkspaceHost;
  private onlineState?:OnlineState;
  private onlineListeners=new Set<(state:OnlineState)=>void>();
  private onlineBoardPlayers=new Set<OnlineBoardPlayerHandle>();
  private spaceHub?:SpaceHubModal;
  private boardCreationModal?:BoardCreationModal;private boardCreationStopped=false;
  private boardCreationPreferenceQueue:Promise<void>=Promise.resolve();
  private paperSettingsModal?:PaperSettingsModal;
  private backgroundImageModal?:BackgroundImageModal;
  private backgroundImagesClosed=false;
  private nativeBridge?:NativeBridgeModal;
  private nativeFilePopup?:Menu;
  private dockOpening?: Promise<WorkspaceLeaf>;private materialsOpening?:Promise<WorkspaceLeaf>;private materialFeedback?:()=>void;private materialDrag?:{token:string;text?:string;label?:string;run:(view:BoardView,point:{x:number;y:number})=>Promise<void>};
  readonly pdfDocuments=new PdfDocumentPool(loadPdfJs,{set:(fn,ms)=>window.setTimeout(fn,ms),clear:id=>window.clearTimeout(id)});
  private searchSync?:BoardSearchSync;private searchTimer?:number;
  private searchNavigationSequence=0;private searchNavigationStopped=false;
  private recentBoardOpening?:Promise<void>;private recentBoardNavigationStopped=false;
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
    this.register(()=>{this.boardCreationStopped=true;this.boardCreationModal?.close();this.boardCreationModal=undefined;});
    this.register(subscribeNativeBoardEditorDrains(this.app,()=>this.refreshMarkdownBoardOwnership()));
    this.register(()=>{this.nativeMarkdownOpeningStopped=true;this.nativeMarkdownOpening=undefined;clearNativeBoardEditorTracking(this.app);});
    this.register(()=>{if(this.localRelationsSaveTimer)window.clearTimeout(this.localRelationsSaveTimer);this.localRelationsSaveTimer=undefined;void this.flushLocalRelationsSettings();});
    this.mediaWorkspace=new MediaWorkspaceService(this.app,normalizePath(`${this.manifest.dir||this.app.vault.configDir+'/plugins/'+this.manifest.id}/media-playback.json`),{
      createNote:(title,body)=>this.createUnique(normalizePath(this.settings.cardFolder+'/媒体笔记'),title,'md',body),
      onPlay:()=>this.pauseOnlineBoardPlayers(),
      openFile:file=>isExternalMediaReference(file.path)?this.openMediaWorkspace(file,'tab'):this.app.workspace.getLeaf('tab').openFile(file)
    });
    await this.mediaWorkspace.load();
    this.onlinePlatform=new OnlinePlatform(state=>{const started=state.available&&!state.paused&&(!this.onlineState?.available||this.onlineState.paused||this.onlineState.sourcePath!==state.sourcePath);this.onlineState=state;if(started)this.pauseOnlineBoardPlayers();for(const notify of this.onlineListeners)notify(state);});
    this.onlineMedia=new OnlineMediaService(this.app,(title,body)=>this.createUnique(normalizePath(this.settings.cardFolder+'/媒体笔记'),title,'md',body),()=>this.yingjianVaultId());
    this.onlineWorkspaceHost={accent:()=>this.settings.accent,density:()=>this.settings.density,mount:(host,source)=>this.onlinePlatform.mount(host,source),pick:placement=>this.pickOnlineVideo(placement),open:(source,placement,time,note)=>this.openOnlineWorkspace(source,placement,time,note),state:()=>this.onlineState,subscribe:fn=>{this.onlineListeners.add(fn);return()=>this.onlineListeners.delete(fn);},command:(source,action,value)=>this.onlinePlatform.command(source,action,value),adopt:async(source,placement)=>{
      for(const leaf of this.app.workspace.getLeavesOfType(ONLINE_WORKSPACE))if(leaf.view instanceof OnlineWorkspaceView&&!leaf.view.canMove())return;
      const adopted=await this.onlinePlatform.adopt(source);await this.openOnlineWorkspace(adopted.path,placement,adopted.initialTime,undefined,true);
    },capture:async source=>{const frame=await this.onlinePlatform.capture(source);if(this.mediaClosed)throw Error('播放器已关闭，截图未保存');return {blob:new Blob([Uint8Array.from(frame.bytes)],{type:'image/png'}),time:frame.time};},notes:(source,note)=>this.onlineMedia.notes(source,note),save:(source,data,note)=>this.onlineMedia.save(source,data,note),send:(source,time,text,image)=>this.sendOnlineToBoard(source,time,text,image),openNote:file=>this.openNoteInSidebar(file)};
    this.registerView(ONLINE_WORKSPACE,leaf=>new OnlineWorkspaceView(leaf,this.onlineWorkspaceHost));
    this.register(()=>{for(const player of this.onlineBoardPlayers)player.dispose();this.onlineBoardPlayers.clear();this.onlinePlatform.dispose();this.onlineMedia.dispose();this.onlineListeners.clear();});
    this.addCommand({id:'open-online-video',name:'打开 B 站 / YouTube 在线视频',callback:()=>this.pickOnlineVideo('tab')});
    this.registerObsidianProtocolHandler('thoughtspace-online-player',params=>act(async()=>{const link=parseOnlinePlayerUrl(params);if(!link||link.vault!==this.app.vault.getName())throw Error('在线视频链接无效或属于其他仓库');await this.openOnlineWorkspace(link.source,'tab',link.time,link.note);}));
    try{
      this.mediaDrafts=new MediaDraftStore(new IndexedMediaDraftStorage(window.indexedDB,`thoughtspace-media-drafts-v1:${this.yingjianVaultId()}`),()=>new Notice('本机媒体草稿暂存失败或记录无法读取，原始暂存未删除；请及时保存或复制文字。',10000));
      await this.mediaDrafts.load();
    }catch{new Notice('无法读取本机媒体草稿暂存，请勿依赖跨重启恢复；已有暂存未删除。',10000);}
    const recover=()=>{this.mediaRecovery?.close();if(this.mediaDrafts){this.mediaRecovery=new MediaDraftRecoveryModal(this.app,this.mediaDrafts,draft=>this.restoreMediaDraft(draft));this.mediaRecovery.open();}};
    this.addCommand({id:'recover-media-drafts',name:'恢复暂存的媒体摘录',callback:recover});
    let recoveryNotice:Notice|undefined,recoveryTimer:number|undefined;
    const showRecovery=()=>{
      // Wait for startup layout changes to settle before offering the review.
      if(!this.mediaDrafts?.pending().length)return;
      const content=createFragment(),body=content.createDiv({cls:'ts-media-draft-startup'});
      body.createDiv({text:`发现 ${this.mediaDrafts.pending().length} 条未保存的媒体摘录。请查看并选择恢复或丢弃，暂存不会自动写入笔记。`});
      const button=body.createEl('button',{text:'查看暂存草稿',attr:{type:'button','aria-label':'查看未保存的媒体摘录'}});
      button.onclick=()=>{recoveryNotice?.hide();recover();};recoveryNotice=new Notice(content,0);
    };
    const scheduleRecovery=()=>{if(recoveryNotice)return;if(recoveryTimer!==undefined)window.clearTimeout(recoveryTimer);recoveryTimer=window.setTimeout(()=>{recoveryTimer=undefined;showRecovery();},750);};
    this.app.workspace.onLayoutReady(scheduleRecovery);this.registerEvent(this.app.workspace.on('layout-change',scheduleRecovery));
    const unsubscribeRecovery=this.mediaDrafts?.subscribe(()=>{if(!this.mediaDrafts?.pending().length)recoveryNotice?.hide();});
    this.register(()=>{if(recoveryTimer!==undefined)window.clearTimeout(recoveryTimer);recoveryNotice?.hide();unsubscribeRecovery?.();});
    this.register(()=>{this.mediaRecovery?.close();void this.mediaDrafts?.dispose().catch(()=>new Notice('媒体草稿暂存失败，请勿关闭仍含草稿的窗口。',10000));});
    this.mediaWorkspaceHost={accent:()=>this.settings.accent,density:()=>this.settings.density,drafts:this.mediaDrafts,recoverDrafts:recover,open:(file,placement,time)=>this.openMediaWorkspace(file,placement,time),pick:done=>this.pickMediaFile(done),pickExternal:done=>this.pickExternalMedia(done),pickOnline:placement=>this.pickOnlineVideo(placement),mount:(host,file,hooks)=>this.mediaWorkspace.mount(host,file,hooks),moments:file=>this.mediaWorkspace.moments(file),saveMoment:(file,data)=>this.mediaWorkspace.saveMoment(file,data),openNote:file=>this.openNoteInSidebar(file),sendToBoard:(file,moment)=>this.sendMediaToBoard(file,moment)};
    this.registerView(MEDIA_WORKSPACE,leaf=>new MediaWorkspaceView(leaf,this.mediaWorkspaceHost));
    this.register(()=>{this.mediaClosed=true;void this.mediaWorkspace.dispose().catch(report);});
    this.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{if(file instanceof TFile)this.mediaWorkspace.playback.rename(oldPath,file.path);}));
    this.registerEvent(this.app.vault.on('delete',file=>this.mediaWorkspace.playback.remove(file.path)));
    this.registerObsidianProtocolHandler('thoughtspace-player',params=>act(()=>this.openMediaPlayerSource(params)));
    for(const [placement,name]of [['tab','在主页面打开媒体播放器'],['sidebar','在右侧栏打开媒体播放器'],['window','在独立窗口打开媒体播放器']]as const)this.addCommand({id:'media-player-'+placement,name,callback:()=>act(()=>this.openMediaWorkspace(undefined,placement))});
    this.addCommand({id:'link-external-media',name:'链接仓库外的视频或音频',callback:()=>this.pickExternalMedia(file=>this.openMediaWorkspace(file,'tab'))});
    this.setupBoardSearch();this.register(()=>this.pdfDocuments.clear());
    this.noteToolbar=new NoteMarkdownToolbars(this.app,()=>this.settings.noteMarkdownToolbar!==false,(name,source)=>this.createConceptLinkNote(name,source));this.addChild(this.noteToolbar);this.registerEditorExtension(this.noteToolbar.extension());
    this.addSettingTab(new ThoughtSpaceSettings(this.app, this));
    this.registerView(WRITING,leaf=>new WritingView(leaf,this));this.addCommand({id:'board-writing',name:'白板写作模式',callback:()=>act(()=>this.openWriting())});
    this.registerView(LOCAL_RELATIONS_VIEW,leaf=>new LocalRelationsView(leaf,this.localRelationsHost(leaf)));
    this.addCommand({id:'add-board-mindmap',name:'在白板添加脑图',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView);if(!view?.session||view.closed||view.session.blocked)return false;if(!checking)act(()=>view.addMindmap());return true;}});
    this.addCommand({id:'local-relations',name:'打开独立关系浏览（兼容入口）',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView);if(!view?.session||view.closed||!view.session.board.nodes.some(supportsLocalRelations))return false;if(!checking)act(()=>this.openLocalRelations(view,view.localRelationSelectedId));return true;}});
    this.registerView(MATERIALS,leaf=>new MaterialsView(leaf,this));this.register(()=>{this.materialDrag=undefined;});
    this.addRibbonIcon('clapperboard','ThoughtSpace 音视频笔记',()=>this.openMediaLibrary());this.addCommand({id:'yingjian-video-notes',name:'打开音视频笔记',callback:()=>this.openMediaLibrary()});this.register(()=>{this.videoBridgeDisposed=true;});
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
    this.registerObsidianProtocolHandler('thoughtspace-media',params=>act(()=>this.openMediaSource(params)));
    this.addCommand({id:'insert-audio-video',name:'插入音频或视频卡片',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView);if(!view?.session||view.session.blocked)return false;if(!checking)act(()=>view.insertMediaCard());return true;}});
    this.registerObsidianProtocolHandler('thoughtspace-yingjian', params => act(()=>this.openYingjianLink(params)));
    this.registerObsidianProtocolHandler('thoughtspace', params => act(() => this.openDeepLink(params)));
    this.addRibbonIcon('network', 'ThoughtSpace 侧边栏', () => act(() => this.ensureDock(true)));
    this.addCommand({id:'section-catalog',name:'打开分组总览',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard;if(!view?.session||view.closed)return false;if(!checking)act(()=>view.sectionNavigator());return true;}});
    this.addRibbonIcon('layout-dashboard','ThoughtSpace 整理白板',()=>act(()=>this.openBoardOrganizer()));
    this.addRibbonIcon('table-2', 'ThoughtSpace 资料库', () => act(() => this.openDatabase(this.currentBoard)));
    this.registerEvent(this.app.workspace.on('file-menu',(menu,file,source,leaf)=>this.nativeFileMenu(menu,[file],!source.startsWith('file-explorer')&&leaf?.view instanceof MarkdownView?leaf.view:undefined)));
    this.registerEvent(this.app.workspace.on('files-menu',(menu,files)=>this.nativeFileMenu(menu,files)));
    this.registerEvent(this.app.workspace.on('editor-menu',(menu,editor,info)=>{
      if(info.file){const active=this.app.workspace.getActiveViewOfType(MarkdownView);this.nativeFileMenu(menu,[info.file],info instanceof MarkdownView?info:active?.file===info.file&&active.editor===editor?active:undefined);}
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
    this.addCommand({id:'resume-recent-board',name:'继续上次白板',callback:()=>act(()=>this.openRecentBoard())});
    this.register(()=>{this.recentBoardNavigationStopped=true;});
    this.addCommand({id:'open-navigator',name:'打开 ThoughtSpace 侧边栏',callback:()=>act(()=>this.ensureDock(true))});
    this.addCommand({id:'board-templates',name:'从模板创建白板',callback:()=>new TemplatePicker(this.app,this).open()});
    this.addCommand({id:'quick-capture',name:'快速收集一条笔记',callback:()=>this.quickCapture()});
    this.registerEvent(this.app.workspace.on('active-leaf-change',leaf=>{if(leaf?.view instanceof BoardView&&leaf.view.session){this.currentBoard=leaf.view;this.refreshDock();for(const l of this.app.workspace.getLeavesOfType(MATERIALS))if(l.view instanceof MaterialsView)l.view.workbench?.refreshTarget();const file=leaf.view.file;if(file)act(()=>this.recordBoardVisit(file));}}));
    this.app.workspace.onLayoutReady(()=>act(()=>this.ensureDock(false)));
    this.app.workspace.onLayoutReady(()=>act(()=>this.setupBookmarks()));
    this.app.workspace.onLayoutReady(()=>this.refreshMarkdownBoardOwnership());
    this.register(()=>{this.nativeReferenceNotices.clear();});
    this.registerEvent(this.app.workspace.on('layout-change',()=>act(()=>this.setupBookmarks())));
    this.addCommand({ id: 'open-workspace', name: '打开研究工作台', callback: () => act(() => this.openHome()) });
    this.addCommand({id:'new-mindmap',name:'新建思维导图',callback:()=>this.promptMindmap()});
    this.addCommand({id:'mindmap-studio',name:'思维导图工作台（布局、配色与层级）',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard;if(!view?.session||view.closed)return false;if(!checking)act(()=>view.openMindmapStudio());return true;}});
    this.addCommand({id:'new-board-dialog',name:'新建白板或脑图…',callback:()=>this.promptNewBoard()});
    this.addCommand({ id: 'new-board', name: '新建旧格式白板', callback: () => this.promptBoard() });
    this.addCommand({id:'new-brain-board',name:'新建旧格式脑图白板',callback:()=>this.promptBrainBoard()});
    this.addCommand({id:'new-markdown-board',name:'新建 Markdown 白板',callback:()=>this.promptMarkdownBoard()});
    this.addCommand({id:'new-markdown-brain-board',name:'新建 Markdown 脑图白板',callback:()=>this.promptMarkdownBoard('brain')});
    this.addCommand({id:'open-markdown-board',name:'以白板打开当前 Markdown',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(MarkdownView);if(!view?.file||!isBoardFile(this.app,view.file))return false;if(!checking)act(()=>this.openCurrentMarkdownBoard());return true;}});
    this.addCommand({id:'board-native-properties',name:'打开白板原生属性与 Markdown',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView);if(!view?.file||view.file.extension.toLowerCase()!=='md')return false;if(!checking)act(()=>this.openBoardNativeMarkdown(view.file!,view.leaf));return true;}});
    this.addCommand({id:'toggle-board-native',name:'切换白板与原生属性',checkCallback:checking=>{const native=this.app.workspace.getActiveViewOfType(MarkdownView),view=this.app.workspace.getActiveViewOfType(BoardView),available=!!native?.file&&isBoardFile(this.app,native.file)||!!view?.file&&view.file.extension.toLowerCase()==='md'&&!view.closed&&!!view.session&&!view.session.blocked;if(!available)return false;if(!checking)act(()=>this.toggleBoardNative());return true;}});
    for(const [format,id,name]of [['markdown','save-as-markdown-board','另存为 Markdown 白板'],['legacy','save-as-legacy-board','另存为旧格式白板']]as const)this.addCommand({id,name,checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView);if(!view?.session||view.closed||view.session.blocked)return false;if(!checking)act(()=>this.promptSaveBoardAs(format,view));return true;}});
    this.registerEvent(this.app.workspace.on('layout-change',()=>this.refreshMarkdownBoardOwnership()));
    this.registerEvent(this.app.workspace.on('file-open',()=>this.refreshMarkdownBoardOwnership()));

    this.addCommand({id:'show-board-as-brain',name:'将当前白板切换为脑图白板',checkCallback:checking=>{const view=this.app.workspace.getActiveViewOfType(BoardView);if(!view?.session||view.closed||view.session.blocked||isBrainBoard(view.session.board))return false;if(!checking)act(()=>view.showAsBrainBoard());return true;}});
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
    for(const command of brainRelationCommands(checking=>this.app.workspace.getActiveViewOfType(BoardView)?.brainRelationCommandTarget(checking)))this.addCommand(command);
    this.registerEvent(this.app.vault.on('modify', f => { if (f instanceof TFile) { if(f.extension.toLowerCase()==='md'){this.localRelationsHeadingPending.add(f);for(const [leaf,target]of this.localRelationsTargets)if(target.owner.board.nodes.some(node=>supportsLocalRelations(node)&&(node.file===f.path||node.paragraphQuote?.path===f.path)))this.localRelationsSubscribers.get(leaf)?.();}const s = this.sessions.get(f); if (s) act(async () => (await s).externalUpdate()); } }));
    this.app.workspace.onLayoutReady(() => { for (const f of this.app.vault.getMarkdownFiles().filter(isWorkspaceFile)) { const cache = this.app.metadataCache.getFileCache(f); if (cache) this.knownTags.set(f, JSON.stringify(getAllTags(cache) || [])); } });
    this.registerEvent(this.app.metadataCache.on('resolved',()=>this.refreshLocalRelations()));
    this.registerEvent(this.app.metadataCache.on('changed', (file, _data, cache) => {
      this.localRelationsHeadingPending.delete(file);
      for(const [leaf,target]of this.localRelationsTargets)if(target.owner.board.nodes.some(node=>supportsLocalRelations(node)&&(node.file===file.path||node.paragraphQuote?.path===file.path)))this.localRelationsSubscribers.get(leaf)?.();
      const tags = getAllTags(cache) || [], signature = JSON.stringify(tags), previous = this.knownTags.get(file);
      this.knownTags.set(file, signature);
      if (isBoardFile(this.app,file)||previous === undefined || previous === signature || !this.settings.autoFileCards || !file.path.startsWith(this.settings.cardFolder + '/')) return;
      act(() => this.serializeFiling(async () => {
        if (isBoardFile(this.app,file)||this.knownTags.get(file) !== signature || !this.settings.autoFileCards || !file.path.startsWith(this.settings.cardFolder + '/')) return;
        await this.moveFiled(file, tags.length ? tagFolder(tags[0], this.settings.cardFolder) : this.settings.cardFolder + '/未分类');
      }));
    }));
    this.registerEvent(this.app.vault.on('delete', file => { this.settings.localRelations=remapLocalRelationsPreferences(this.settings.localRelations,file.path);this.settings.hub=remapHubPaths(this.settings.hub,file.path);act(()=>this.saveData(this.settings)); if (file instanceof TFile) this.knownTags.delete(file);const next=remapFavorites(this.settings.favoriteBoards,file.path);if(next.length!==this.settings.favoriteBoards.length){this.settings.favoriteBoards=next;act(()=>this.savePreferences());} }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      const snapshot=captureBoardReferenceRename(file.path,this.app.vault.getFiles());
      this.settings.localRelations=remapLocalRelationsPreferences(this.settings.localRelations,oldPath,snapshot.newPath);this.settings.hub=remapHubPaths(this.settings.hub,oldPath,snapshot.newPath);act(()=>this.saveData(this.settings));
      this.referenceQueue = this.referenceQueue.catch(() => {}).then(async () => { if(this.settings.pendingBoardReferences?.length||this.nativeReferenceRuns?.size)try{await this.editReferenceJournal(operations=>{const moved=(path:string)=>path===oldPath||path.startsWith(oldPath+'/')?snapshot.newPath+path.slice(oldPath.length):path;return operations.map(operation=>({...operation,board:moved(operation.board)}));},true);}catch(error){report(error);}const next=remapFavorites(this.settings.favoriteBoards,oldPath,snapshot.newPath);if(JSON.stringify(next)!==JSON.stringify(this.settings.favoriteBoards)){this.settings.favoriteBoards=next;await this.savePreferences();} await this.renameReferences(file, oldPath,snapshot); });
      act(() => this.referenceQueue);
    }));
  }
  showNativeFileMenu(file:TFile){
    if(this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('文件已删除，请刷新白板');
    this.nativeFilePopup?.hide();const menu=this.nativeFilePopup=new Menu().setUseNativeMenu(false);
    this.app.workspace.trigger('file-menu',menu,file,'thoughtspace');
    menu.showAtPosition({x:Math.max(16,Math.min(window.innerWidth-280,window.innerWidth/2)),y:120});return menu;
  }
  private nativeFileMenu(menu:Menu,files:TAbstractFile[],nativeView?:MarkdownView){
    if(files.length===1&&files[0] instanceof TFile&&isWorkspaceFile(files[0])&&mediaKind(files[0].path)){const file=files[0];
      for(const[placement,label,icon]of [['tab','主页面播放与记录','clapperboard'],['sidebar','侧边栏播放','panel-right'],['window','独立窗口播放','picture-in-picture-2']]as const)menu.addItem(i=>i.setTitle('ThoughtSpace · '+label).setIcon(icon).onClick(()=>act(()=>this.openMediaWorkspace(file,placement))));
      menu.addItem(i=>i.setTitle('ThoughtSpace · 加入白板').setIcon('panels-top-left').onClick(()=>act(()=>this.sendMediaToBoard(file))));
    }

    if(files.length===1&&files[0] instanceof TFile&&['md','pdf'].includes(files[0].extension)){const file=files[0];menu.addItem(i=>i.setTitle('ThoughtSpace · 右侧阅读与拖放摘录').setIcon('book-open').onClick(()=>act(()=>this.openExcerptNote(file))));}
    if(files.length===1&&files[0] instanceof TFile&&isPdfFile(files[0].path)){const file=files[0],view=this.currentBoard;if(view?.session&&!view.closed)menu.addItem(i=>i.setTitle('ThoughtSpace · 插入 PDF 卡片到当前白板').setIcon('file-plus').setDisabled(view.session!.blocked).onClick(()=>act(()=>view.insertPdfCard(undefined,file))));}
    const notes=files.filter((f):f is TFile=>f instanceof TFile&&f.extension==='md'&&isWorkspaceFile(f));
    if(notes.length){
      menu.addSeparator();menu.addItem(i=>i.setTitle(`ThoughtSpace · 加入白板${notes.length>1?'（'+notes.length+' 篇）':''}…`).setIcon('panels-top-left').setDisabled(notes.length>100).onClick(()=>this.pickNativeDestination(notes)));
      if(notes.length===1)menu.addItem(i=>i.setTitle('ThoughtSpace · Obsidian 关联').setIcon('network').onClick(()=>this.openNativeRelations(notes[0])));
    }
    if(files.length===1&&files[0] instanceof TFile&&isBoardFile(this.app,files[0])){
      const file=files[0],path=file.path,active=this.app.workspace.getMostRecentLeaf(),view=nativeView?.file===file&&this.app.workspace.getActiveViewOfType(MarkdownView)===nativeView?nativeView:undefined,leaf=view?.leaf,doc=view?.containerEl.ownerDocument,win=doc?.defaultView;
      const current=()=>file.path===path&&this.app.vault.getAbstractFileByPath(path)===file&&this.app.workspace.getMostRecentLeaf()===active&&(!view||this.app.workspace.getActiveViewOfType(MarkdownView)===view&&view.file===file&&leaf?.view===view&&view.containerEl.ownerDocument===doc&&!win?.closed);
      if(file.extension.toLowerCase()==='md')menu.addItem(i=>i.setTitle(view?'返回白板':'以白板打开').setIcon('panels-top-left').onClick(()=>act(()=>{if(!current())throw Error('菜单页面或文件已变化，已取消打开白板');return view?this.openCurrentMarkdownBoard():this.openBoard(file,false,current);})));menu.addItem(i=>i.setTitle('ThoughtSpace · 导出原生链接索引').setIcon('file-output').onClick(()=>act(()=>this.exportNativeIndex(file))));
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
    if(!isBoardFile(this.app,board)||files.some(f=>f.extension!=='md'||isBoardFile(this.app,f)))throw Error('请选择白板和 Markdown 笔记');
    await this.openBoard(board);
    const view=this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).find(v=>v instanceof BoardView&&v.file===board) as BoardView|undefined;
    if(!view?.session)throw Error('白板尚未就绪，请稍后重试');
    return view.addNotesFromHub(files.map(f=>f.path),view.session);
  }
  openNativeRelations(file:TFile){
    this.nativeBridge?.close();this.nativeBridge=new NativeBridgeModal(this.app,file,{
      open:f=>{this.nativeBridge?.close();return this.openNoteInSidebar(f);},add:files=>this.pickNativeDestination(files),openBoard:f=>{this.nativeBridge?.close();return this.openBoard(f);},
      usages:async (note,active)=>{const files:TFile[]=[];let errors=0;for(const f of this.app.vault.getFiles().filter(isWorkspaceFile).filter(f=>isBoardFile(this.app,f))){
        if(!active())break;
        if(f.stat.size>8*1024*1024){errors++;continue;}try{const b=await this.readBoard(f);if(b.nodes.some(n=>n.kind==='card'&&n.file===note.path))files.push(f);}catch{errors++;}
      }return {files,errors};}
    });this.nativeBridge.open();return this.nativeBridge;
  }
  async exportNativeIndex(file:TFile){
    if(this.app.vault.getAbstractFileByPath(file.path)!==file||!isBoardFile(this.app,file))throw Error('白板已变化，请重新打开');
    const board=await this.readBoard(file),source=`${ROOT}/导出/白板索引.md`,links:string[]=[],missing:string[]=[];
    for(const path of boardNotePaths(board)){const note=this.app.vault.getAbstractFileByPath(path);if(note instanceof TFile&&note.extension==='md'&&isWorkspaceFile(note))links.push(this.app.fileManager.generateMarkdownLink(note,source));else missing.push(path);}
    const content=nativeIndex(file.basename,this.app.fileManager.generateMarkdownLink(file,source),links,missing);
    const out=await this.createUnique(`${ROOT}/导出`,`${file.basename}-链接索引`,'md',content);await this.openNoteInSidebar(out);new Notice('已创建 Markdown 索引，可在原生反向链接和关系图中查看');return out;
  }
  private setupBoardSearch(){
    const vault=this.app.vault,errors=new Set<string>();
    this.searchSync=new BoardSearchSync({
      board:async path=>{const file=vault.getAbstractFileByPath(path);return file instanceof TFile&&isBoardFile(this.app,file)?readBoardDocument(await vault.cachedRead(file),file.extension,parseYaml).board:undefined;},
      read:async path=>{const file=vault.getAbstractFileByPath(path);if(file&&! (file instanceof TFile))throw Error('搜索索引路径被文件夹占用');return file instanceof TFile?vault.read(file):undefined;},
      write:async(path,content,expected)=>{if(this.settings.boardSearchEnabled===false)return;await this.folder(path.slice(0,path.lastIndexOf('/')));const file=vault.getAbstractFileByPath(path);
        if(file instanceof TFile)await vault.process(file,disk=>{if(disk!==expected)throw Error('索引文件同时发生修改，已保留原内容');return content;});
        else if(!file&&expected===undefined)await vault.create(path,content);else throw Error('索引路径已变化');},
      remove:async(path,expected)=>{const file=vault.getAbstractFileByPath(path);if(file instanceof TFile&&await vault.read(file)===expected&&this.settings.boardSearchEnabled!==false)await this.app.fileManager.trashFile(file);}
    },vault.getName(),(path,error)=>{if(!errors.has(path)){errors.add(path);console.warn('ThoughtSpace search index:',path,error);new Notice(`白板搜索索引暂未更新：${path}。原白板未修改。`);}});
    const enqueue=(path:string)=>{if(this.settings.boardSearchEnabled===false||!isBoardPath(path)||!isWorkspaceFile({path}))return;this.searchSync?.enqueue(path);if(this.searchTimer!==undefined)window.clearTimeout(this.searchTimer);this.searchTimer=window.setTimeout(()=>{this.searchTimer=undefined;void this.searchSync?.flush();},1200);};
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
    if(this.searchNavigationStopped||this.settings.boardSearchEnabled===false||!file||!isSearchIndexPath(file.path))return;
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
    if(!searchBoardPath(path,content))return;const target=searchIndexTarget(path,content,this.app.vault.getName(),line);if(!target)return;
    const board=this.app.vault.getAbstractFileByPath(target.file);
    if(!(board instanceof TFile)||!isWorkspaceFile(board)){new Notice('搜索结果对应的白板已移动或删除，请重建白板搜索索引');return;}
    // Reuse the result tab, including Cmd/Ctrl-click tabs, instead of leaving an index tab behind.
    readBoardDocument(await this.app.vault.cachedRead(board),board.extension,parseYaml);if(!alive()||this.app.vault.getAbstractFileByPath(target.file)!==board)return;const leaf=view.leaf;await leaf.setViewState({type:VIEW,state:{file:board.path,tsSearchRedirect:true}});
    await new Promise<void>(resolve=>(view.containerEl?.ownerDocument?.defaultView||window).requestAnimationFrame(()=>resolve()));
    const opened=workspace.getActiveViewOfType(BoardView);
    if(!this.searchNavigationStopped&&opened&&leaf.view===opened&&opened.file===board&&!opened.closed&&target.node&&opened.session?.board.nodes.some(n=>n.id===target.node))opened.revealNode(target.node);
  }
  rebuildBoardSearch(){if(this.settings.boardSearchEnabled===false)return;for(const file of this.app.vault.getFiles()){
    if(isBoardFile(this.app,file))this.searchSync?.enqueue(file.path);
    else if(isSearchIndexPath(file.path))act(async()=>{const path=searchBoardPath(file.path,await this.app.vault.cachedRead(file));if(path){this.searchSync?.enqueue(path);await this.searchSync?.flush();}});
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
  async createFromTemplate(id:string,name:string,format:BoardCreationFormat='legacy',current:()=>boolean=()=>true,open=true){
    const template=boardTemplates.find(t=>t.id===id);if(!template)throw new Error('未知白板模板');
    const board=emptyBoard(),createdPaths:string[]=[];
    try{
      for(let i=0;i<template.titles.length;i++){
        const title=template.titles[i], file=await this.createUnique(`${this.settings.cardFolder}/${safeName(name)}`,title,'md',`---\nthoughtspace_status: inbox\n---\n# ${title}\n\n${template.bodies[i]}\n`,current);createdPaths.push(file.path);
        board.nodes.push(applyDefaultCardStyle({id:uid(),kind:'card',transparent:true,file:file.path,x:80+(i%2)*440,y:80+Math.floor(i/2)*370,width:360,height:290,color:colors[i]},this.settings.defaultCardStyle));
      }
      board.edges=[{id:uid(),from:board.nodes[0].id,to:board.nodes[1].id,label:'展开'},{id:uid(),from:board.nodes[1].id,to:board.nodes[3].id,label:'形成判断'}];
      const file=await this.createUnique(`${ROOT}/白板`,name,format==='markdown'?'md':EXT,format==='markdown'?createMarkdownBoardDocument(board,name):JSON.stringify(board,null,2),current);createdPaths.push(file.path);if(open&&current())await this.openBoard(file,true,current);return file;
    }catch(error){if(createdPaths.length)throw new TemplateCreationIncompleteError(error,createdPaths);throw error;}
  }
  async duplicateBoard(file:TFile){const document=readBoardDocument(await this.app.vault.read(file),file.extension,parseYaml),board=clone(await this.readBoard(file));board.spaceId=uid();return this.createUnique(file.parent?.path||ROOT,`${file.basename} 副本`,file.extension,replaceBoardDocumentLayout(document.source,document,board,parseYaml).source);}
  async saveLayoutSnapshot(file:TFile,label='手动快照'){
    const session=await this.session(file);try{
      return await this.writeLayoutSnapshot(session,label);
    }finally{if(!session.listeners.size)await this.release(session);}
  }
  private async writeLayoutSnapshot(session:Session,label:string){
    if(session.blocked)throw Error('白板暂停写入，不能创建快照');
    if(!session.board.spaceId)session.change(b=>{b.version=3;b.spaceId=uid();});await session.flush();
    if(session.blocked)throw Error('白板保存失败，快照未创建');
    const folder=`${this.app.vault.configDir}/plugins/${this.manifest.id}/layout-snapshots/${session.board.spaceId}`;await this.app.vault.adapter.mkdir(folder);
    const path=`${folder}/${Date.now()}-${uid()}.json`;await this.app.vault.adapter.write(path,JSON.stringify({label,createdAt:new Date().toISOString(),board:clone(session.board)},null,2));return path;
  }
  async layoutSnapshots(file:TFile){const board=await this.readBoard(file);if(!board.spaceId)return [];const folder=`${this.app.vault.configDir}/plugins/${this.manifest.id}/layout-snapshots/${board.spaceId}`;
    if(!await this.app.vault.adapter.exists(folder))return [];const list=await this.app.vault.adapter.list(folder);const items=[];
    for(const path of list.files.filter(f=>f.endsWith('.json')).sort().reverse()){try{const value=parseLayoutSnapshot(await this.app.vault.adapter.read(path));items.push({path,label:value.label,createdAt:value.createdAt,nodes:value.board.nodes.length});}catch{/* Corrupt snapshots do not block valid ones. */}}
    return items;
  }
  async restoreLayoutSnapshot(file:TFile,path:string){return this.hierarchy(async()=>{const session=await this.session(file);try{
    const allowed=(await this.layoutSnapshots(file)).some(item=>item.path===path);if(!allowed||session.blocked)throw Error('快照不属于当前白板或白板暂停写入');
    const restored=parseLayoutSnapshot(await this.app.vault.adapter.read(path)).board,before=JSON.stringify(session.board);
    const currentNodes=new Map(session.board.nodes.map(n=>[n.id,n]));for(const n of restored.nodes){const current=currentNodes.get(n.id);if(n.file&&!this.app.vault.getAbstractFileByPath(n.file)&&current?.kind===n.kind&&current.file&&this.app.vault.getAbstractFileByPath(current.file))n.file=current.file;}
    const validateLinks=async()=>{const children=new Set(boardLinks(restored));if(!children.size)return;const graph=await this.boardGraph();for(const childPath of children){const child=this.app.vault.getAbstractFileByPath(childPath);if(!(child instanceof TFile))throw Error('快照中的子白板已移动或删除');this.assertCanNestGraph(file,child,graph);}};
    await validateLinks();parseBoard(JSON.stringify(restored));
    // The restore owns the session until commit; an inner snapshot must not release it.
    await this.writeLayoutSnapshot(session,'恢复前自动备份');await validateLinks();if(session.blocked||JSON.stringify(session.board)!==before)throw Error('白板已变化，请重新选择快照');
    restored.spaceId=session.board.spaceId;session.change(()=>{session.board=restored;},clone(session.board),true);await session.flush();if(session.blocked)throw Error('恢复布局保存失败，请检查保存冲突与恢复草稿');new Notice('已恢复布局；原始笔记内容保持不变');
    }finally{if(!session.listeners.size)await this.release(session);}
  });}
  async showSnapshots(file:TFile){const items=await this.layoutSnapshots(file);if(!items.length){new Notice('还没有布局快照，请先保存一个');return;}
    new ActionPicker(this.app,'恢复布局（自动备份当前布局；不回滚笔记正文）',items.map(item=>({title:`${new Date(item.createdAt).toLocaleString()} · ${item.label} · ${item.nodes} 个对象`,run:()=>this.restoreLayoutSnapshot(file,item.path)}))).open();
  }
  async exportOutline(file:TFile){const board=await this.readBoard(file),out=await this.createUnique(`${ROOT}/导出`,`${file.basename}-大纲`,'md',boardOutline(board,file.basename,this.app.vault.getName()));new Notice(`已导出 ${out.path}`);return out;}
  openDatabase(view?: BoardView) {
    const modal=new DatabaseModal(this.app, { preferences:this.settings.database,savePreferences:()=>this.saveData(this.settings),boardPath:view?.file?.path,cardFolder: this.settings.cardFolder, boardPaths: view?.session ? new Set(view.session.board.nodes.filter(n => n.kind === 'card' && n.file).map(n => n.file!)) : undefined, boardTitle: view?.file?.basename, preview: file => new NotePreview(this.app, file, this).open() }, this.propertyStore);modal.open();return modal;
  }
  private writingOpening=new SharedOpen<TFile,WorkspaceLeaf>();
  private writingPreparation=new SharedOpen<BoardView,void>();
  private boardOpening=new SharedOpen<TFile,WorkspaceLeaf>();
  readonly provisionalBoardGeometry=new WeakMap<WorkspaceLeaf,TFile>();
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
  openRecentBoard():Promise<void>{
    if(this.recentBoardOpening)return this.recentBoardOpening;
    const workspace=this.app.workspace,origin=workspace.getActiveViewOfType(View),originFile=origin instanceof FileView?origin.file:undefined,originSession=origin instanceof BoardView?origin.session:undefined,doc=origin?.containerEl.ownerDocument||workspace.containerEl.ownerDocument;
    let target:TFile|undefined;
    const current=()=>!this.recentBoardNavigationStopped&&!doc.defaultView?.closed&&doc.hasFocus()&&(workspace.getActiveViewOfType(View)===origin&&(!(origin instanceof FileView)||origin.file===originFile)&&(!(origin instanceof BoardView)||origin.session===originSession)||!!target&&workspace.getActiveViewOfType(BoardView)?.file===target);
    const work=resumeRecentBoard([...this.settings.hub.recent],{
      current,resolve:path=>{const file=this.app.vault.getAbstractFileByPath(path);return file instanceof TFile?file:undefined;},valid:file=>isBoardFile(this.app,file),
      open:async(file,ready)=>{target=file;await this.openBoard(file,false,ready);if(!ready())return false;const view=workspace.getActiveViewOfType(BoardView);if(!view||view.closed||view.file!==file||!view.session)throw Error('白板尚未就绪');return true;},
      visited:file=>this.recordBoardVisit(file)
    }).then(result=>{
      if(result.status==='cancelled'||!current())return;
      if(result.status==='empty'){new Notice(result.skipped?'最近记录中的白板已失效或无法打开，已打开空间总览':'尚无最近白板，已打开空间总览');this.openSpaceHub();}
      else if(result.skipped)new Notice(`已跳过 ${result.skipped} 个已失效或无法打开的最近白板`);
    }).finally(()=>{if(this.recentBoardOpening===work)this.recentBoardOpening=undefined;});
    this.recentBoardOpening=work;return work;
  }
  openSpaceHub(){
    if(this.spaceHub?.modalEl.isConnected){this.spaceHub.modalEl.querySelector<HTMLInputElement>('input[type=search]')?.focus();return this.spaceHub;}
    const view=this.currentBoard,owner=view?.session;
    const modal=new SpaceHubModal(this.app,{
      preferences:()=>this.settings.hub,save:async prefs=>{this.settings.hub=prefs;await this.saveData(this.settings);},favorites:()=>this.settings.favoriteBoards,
      journalFolder:this.journalRoot,isBoardFile:file=>isBoardFile(this.app,file),readBoard:file=>this.readBoard(file),
      openBoard:async file=>{await this.openBoard(file);await this.recordBoardVisit(file);},openNote:file=>this.openNoteInSidebar(file),favorite:file=>this.toggleFavorite(file),
      capture:()=>this.quickCapture(),createBoard:()=>this.promptNewBoard(),calendar:()=>this.ensureCalendar(true),
      target:view&&owner?{title:owner.file.basename,add:paths=>view.addNotesFromHub(paths,owner)}:undefined
    });this.spaceHub=modal;modal.open();return modal;
  }
  refreshStyleClipboard(){
    for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof BoardView)leaf.view.refreshStyleControls();
  }
  backgroundImageResource(path:string){const clean=cleanBackgroundImagePreferences({backgroundImagePath:path}).backgroundImagePath;return clean?this.app.vault.adapter.getResourcePath(clean):'';}
  openBackgroundImageSettings(){
    if(this.backgroundImageModal?.modalEl.isConnected){this.backgroundImageModal.modalEl.querySelector<HTMLButtonElement>('button')?.focus();return this.backgroundImageModal;}
    const message=(zh:string,en:string)=>settingsLanguage(this.settings)==='en'?en:zh;
    const modal=new BackgroundImageModal(this.app,{language:settingsLanguage(this.settings),preferences:()=>cleanBackgroundImagePreferences(this.settings),resource:path=>this.backgroundImageResource(path),save:async(preferences,file)=>{
      if(this.backgroundImagesClosed)throw Error(message('插件已关闭，请重新打开设置。','The plugin is closed. Reopen settings.'));
      const previous={...cleanBackgroundImagePreferences(this.settings),canvasBackground:this.settings.canvasBackground},baseline=backgroundImageStamp(previous),next=cleanBackgroundImagePreferences(preferences);
      if(file)next.backgroundImagePath=await this.storeBackgroundImageFile(file);
      if(this.backgroundImagesClosed)throw Error(message('插件已关闭，请重新打开设置。','The plugin is closed. Reopen settings.'));
      if(backgroundImageStamp(this.settings)!==baseline||this.settings.canvasBackground!==previous.canvasBackground)throw Error(message('背景已在其他窗口改变，请重新打开设置后应用。','The background changed in another window. Reopen settings before applying.'));
      if(next.backgroundImagePath&&!await this.app.vault.adapter.exists(next.backgroundImagePath))throw Error(message('背景图片已不存在，请重新选择图片。','The background image no longer exists. Choose another image.'));
      if(this.backgroundImagesClosed||backgroundImageStamp(this.settings)!==baseline||this.settings.canvasBackground!==previous.canvasBackground)throw Error(message('背景已改变，请重新打开设置后应用。','The background changed. Reopen settings before applying.'));
      const mode=next.backgroundImagePath?'image':'plain';Object.assign(this.settings,next,{canvasBackground:mode});
      try{await this.savePreferences();}catch(error){if(backgroundImageStamp(this.settings)===backgroundImageStamp(next)&&this.settings.canvasBackground===mode){Object.assign(this.settings,previous);for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof BoardView)leaf.view.applyPreferences();}throw error;}
    }});this.backgroundImageModal=modal;modal.open();return modal;
  }
  async storeBackgroundImageFile(file:File,current:()=>boolean=()=>!this.backgroundImagesClosed){
    const message=(zh:string,en:string)=>settingsLanguage(this.settings)==='en'?en:zh;
    if(!current())throw Error(this.backgroundImagesClosed?'插件已关闭，请重新打开设置。':'背景已改变，请重新打开设置');
    if(file.size>MAX_BACKGROUND_IMAGE_BYTES)throw Error(message('请选择不超过 20 MB 的图片。','Choose an image no larger than 20 MB.'));
    const bytes=await file.arrayBuffer();let extension:string;
    try{extension=validateBackgroundImageBytes(new Uint8Array(bytes));}catch(error){if(settingsLanguage(this.settings)==='en')throw Error('Unsupported or invalid image data. Choose a PNG, JPEG, WebP or GIF image.');throw error;}
    const folder=normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}/backgrounds`),digest=createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),path=`${folder}/${digest}.${extension}`;
    if(!current())throw Error(this.backgroundImagesClosed?'插件已关闭，请重新打开设置。':'背景已改变，请重新打开设置');
    if(!await this.app.vault.adapter.exists(folder))await this.app.vault.adapter.mkdir(folder);
    if(await this.app.vault.adapter.exists(path)){
      const cached=await this.app.vault.adapter.readBinary(path);
      if(createHash('sha256').update(new Uint8Array(cached)).digest('hex')!==digest)throw Error(message('已保存的背景图片内容发生变化，请先检查插件 backgrounds 文件夹。为保护原文件，本次未覆盖。','The stored image has changed. Check the plugin backgrounds folder. The original file was not overwritten.'));
    }else {if(!current())throw Error(this.backgroundImagesClosed?'插件已关闭，请重新打开设置。':'背景已改变，请重新打开设置');await this.app.vault.adapter.writeBinary(path,bytes);}
    return path;
  }
  openPaperSettings(){
    if(this.paperSettingsModal?.modalEl.isConnected){this.paperSettingsModal.modalEl.querySelector<HTMLButtonElement>('button[aria-pressed=true]')?.focus();return this.paperSettingsModal;}
    const modal=new PaperSettingsModal(this.app,{language:settingsLanguage(this.settings),preferences:()=>cleanPaperPreferences(this.settings),save:async preferences=>{
      const previous={...cleanPaperPreferences(this.settings),canvasBackground:this.settings.canvasBackground},next=cleanPaperPreferences(preferences);
      Object.assign(this.settings,next,{canvasBackground:'paper'});
      try{await this.savePreferences();}catch(error){if(paperAppearanceStamp(this.settings)===paperAppearanceStamp(next)&&this.settings.canvasBackground==='paper'){Object.assign(this.settings,previous);for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view instanceof BoardView)leaf.view.applyPreferences();}throw error;}
    }});this.paperSettingsModal=modal;modal.open();return modal;
  }
  async savePreferences() {
    await this.saveData(this.settings);
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) if (leaf.view instanceof BoardView) leaf.view.applyPreferences();
    for(const type of [WRITING,MEDIA_WORKSPACE,ONLINE_WORKSPACE,MATERIALS])for(const leaf of this.app.workspace.getLeavesOfType(type)){const view=leaf.view;if(view instanceof WritingView||view instanceof MediaWorkspaceView||view instanceof OnlineWorkspaceView||view instanceof MaterialsView)view.applyPreferences();}
    this.refreshDock();
  }
  async session(file: TFile) {
    let result = this.sessions.get(file);
    if (!result) { result = this.app.vault.read(file).then(raw => new Session(this, file, raw)); this.sessions.set(file, result); }
    // Acquiring the same session renews its cache identity before a new view can
    // attach its listener, so an earlier asynchronous release cannot retire it.
    else { result = result.then(session => session); this.sessions.set(file, result); }
    try { return await result; } catch (e) { if(this.sessions.get(file)===result)this.sessions.delete(file); throw e; }
  }
  async release(s: Session) {
    const cached=this.sessions.get(s.file);await s.flush();
    if(s.listeners.size||!cached||this.sessions.get(s.file)!==cached)return;
    // A late close belongs to its original session, never a replacement for the same file.
    const current=await cached.catch(()=>undefined);
    if(current===s&&!s.listeners.size&&this.sessions.get(s.file)===cached)this.sessions.delete(s.file);
  }
  async readBoard(file: TFile): Promise<Board> { if(!isWorkspaceFile(file)||!isBoardPath(file.path))throw Error('请选择工作目录中的白板');const loaded = this.sessions.get(file); return loaded ? clone((await loaded).board) : readBoardDocument(await this.app.vault.cachedRead(file),file.extension,parseYaml).board; }
  async boardGraph():Promise<BoardGraph>;
  async boardGraph(current:()=>boolean):Promise<BoardGraph|undefined>;
  async boardGraph(current?:()=>boolean):Promise<BoardGraph|undefined> {
    if(current&&!current())return;
    const graph = new Map<string, string[]>(), errors = new Set<string>();
    for (const f of this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => isBoardFile(this.app,f))) {
      if(current&&!current())return;
      // Link extraction is synchronous and read-only; open sessions need no deep copy
      // of note bodies or writing drafts. readBoard still isolates mutable callers.
      try { const loaded=this.sessions.get(f),board=loaded?(await loaded).board:await this.readBoard(f);if(current&&!current())return;graph.set(f.path,boardLinks(board)); }
      catch { if(current&&!current())return;errors.add(f.path); }
    }
    return { graph, errors };
  }
  /** 所有由本插件创建的嵌套关系串行校验，避免两个窗口同时加入相反关系。 */
  hierarchy<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.hierarchyQueue.then(operation); this.hierarchyQueue = next.catch(() => {}); return next;
  }
  async assertCanNest(parent: TFile, child: TFile) {
    this.assertCanNestGraph(parent,child,await this.boardGraph());
  }
  /** Explicit insertion only reads the selected child's reachable descendants. */
  async assertCanNestReachable(parent:TFile,child:TFile,current:()=>boolean){
    const pending=[child.path],seen=new Set<string>(),snapshots:{file:TFile;path:string;mtime:number;size:number}[]=[];
    while(pending.length){
      if(!current())throw Error('子白板引用操作已取消');
      const path=pending.pop()!;if(path===parent.path)throw Error('不能把白板放入自身或后代中，这会形成循环嵌套');if(seen.has(path))continue;
      seen.add(path);if(seen.size>1000)throw Error('子白板层级过大，请先缩小引用范围');
      const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile)||!isBoardFile(this.app,file))throw Error('目标白板或其子白板无法读取，请先修复引用');
      const snapshot={file,path,mtime:file.stat.mtime,size:file.stat.size};snapshots.push(snapshot);
      const board=await this.readBoard(file);if(!current())throw Error('子白板引用操作已取消');pending.push(...boardLinks(board));
    }
    if(this.app.vault.getAbstractFileByPath(child.path)!==child||snapshots.some(s=>s.file.path!==s.path||this.app.vault.getAbstractFileByPath(s.path)!==s.file||s.file.stat.mtime!==s.mtime||s.file.stat.size!==s.size))throw Error('子白板在检查期间已变化，请重新选择');
  }
  private assertCanNestGraph(parent:TFile,child:TFile,{graph,errors}:BoardGraph){
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
  async createUnique(folder: string, title: string, ext: string, body: string,current:()=>boolean=()=>true): Promise<TFile> {
    if(!current())throw Error('创建已取消');await this.folder(folder);if(!current())throw Error('创建已取消');
    const name = safeName(title);
    for (let n = 0; n < 10000; n++) {
      if(!current())throw Error('创建已取消');const path = normalizePath(`${folder}/${name}${n ? ` ${n + 1}` : ''}.${ext}`);
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
  async renameBrainSource(file:TFile,value:string,original=file.path){
    if(file.path!==original||this.app.vault.getAbstractFileByPath(original)!==file)throw Error('来源已移动或删除，请重新打开菜单');
    const extension=file.extension;if(extension!=='md'&&extension!==EXT)throw Error('此来源不支持重命名');
    const path=noteRenamePath(original,value).slice(0,-3)+'.'+extension;if(path===original)return;
    if(this.app.vault.getAbstractFileByPath(path))throw Error('已有同名文件，请换一个名称');
    await this.app.fileManager.renameFile(file,path);await this.referenceQueue;
  }
  promptRenameNote(file:TFile){const original=file.path;new Prompt(this.app,'重命名笔记',file.basename,value=>this.renameNote(file,value,original)).open();}
  async openBoard(file:TFile,fit?:boolean,current?:()=>boolean,provisional?:false,navigation?:BoardOpenNavigation):Promise<void>;
  async openBoard(file:TFile,fit:boolean,current:()=>boolean,provisional:true,navigation?:BoardOpenNavigation):Promise<WorkspaceLeaf|undefined>;
  async openBoard(file: TFile, fit = false, current:()=>boolean=()=>true, provisional=false,navigation?:BoardOpenNavigation):Promise<void|WorkspaceLeaf> {
    if(!current())return;
    if(!isBoardPath(file.path)||!isWorkspaceFile(file)||this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('请选择工作目录中的白板');
    const path=file.path;
    readBoardDocument(await this.app.vault.read(file),file.extension,parseYaml);if(!current())return;
    if(file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file)throw Error('白板已移动或删除');
    const leaf=await this.boardOpening.run(file,async()=>{
      const existing=this.app.workspace.getLeavesOfType(VIEW).find(l=>(l.view as BoardView).file===file||l.getViewState().state?.file===file.path);
      if(existing){navigation?.target(existing);if(provisional&&!(existing.view instanceof BoardView&&existing.view.session))this.provisionalBoardGeometry.set(existing,file);try{await existing.loadIfDeferred();return existing;}catch(error){this.provisionalBoardGeometry.delete(existing);throw error;}}
      const create=()=>this.app.workspace.getLeaf('tab'),created=navigation?navigation.acquire(create):create();navigation?.target(created);if(provisional)this.provisionalBoardGeometry.set(created,file);
      const discard=()=>{this.provisionalBoardGeometry.delete(created);if(created.getViewState().type==='empty'&&(!(created.view instanceof FileView)||!created.view.file))created.detach();};
      try{if(file.extension.toLowerCase()==='md'){await this.readBoard(file);if(!current()){discard();return created;}await created.setViewState({type:VIEW,active:false,state:{file:file.path}});}else{await this.readBoard(file);if(!current()){discard();return created;}await created.openFile(file,{active:false});}return created;}catch(error){discard();throw error;}
    });
    if(!current())return;if(provisional)return leaf;
    await this.app.workspace.revealLeaf(leaf);if(!current()||(leaf.view instanceof BoardView&&leaf.view.file!==file))return;this.provisionalBoardGeometry.delete(leaf);
    if(leaf.view instanceof BoardView)leaf.view.resumeAutomaticGeometry();this.app.workspace.setActiveLeaf(leaf,{focus:true});if(leaf.view instanceof BoardView)this.currentBoard=leaf.view;
    if(fit&&leaf.view instanceof BoardView){await new Promise<void>(resolve=>(leaf.view.containerEl?.ownerDocument?.defaultView||window).requestAnimationFrame(()=>resolve()));if(current())leaf.view.fit();}
  }

  openBoardOrganizer(view:BoardView|null=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard||null){
    if(view?.session&&!view.closed){act(()=>view.openLayoutPlanner());return;}
    const picker=new BoardPicker(this.app,null,async file=>{
      await this.openBoard(file);const target=this.currentBoard;
      if(!target?.session||target.closed||target.file!==file)throw Error('白板尚未就绪，请重新打开后再整理');
      await target.openLayoutPlanner();
    });
    picker.setPlaceholder('选择要整理的白板…');picker.open();
  }
  openSectionCatalog(view:BoardView|null=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard||null){
    if(view?.session&&!view.closed){view.sectionNavigator();return;}
    const picker=new BoardPicker(this.app,null,async file=>{
      await this.openBoard(file);const target=this.currentBoard;
      if(!target?.session||target.closed||target.file!==file)throw Error('白板尚未就绪，请重新打开后再预览');
      target.sectionNavigator();
    });
    picker.setPlaceholder('选择要预览分组的白板…');picker.open();
  }
  async openHome() {
    const files = this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => isBoardFile(this.app,f)).sort((a, b) => b.stat.mtime - a.stat.mtime);
    if (files[0]) await this.openBoard(files[0]); else await this.demo();
  }
  async openBoardInNewTab(file:TFile){if(!isBoardPath(file.path)||!isWorkspaceFile(file)||this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('白板已移动或删除');readBoardDocument(await this.app.vault.read(file),file.extension,parseYaml);const leaf=this.app.workspace.getLeaf('tab');try{await leaf.setViewState({type:VIEW,active:true,state:{file:file.path}});this.app.workspace.setActiveLeaf(leaf,{focus:true});}catch(error){leaf.detach();throw error;}return leaf;}
  readonly nativeBoardTransitions=new Set<TFile>();
  private nativeMarkdownOpening?:WeakMap<WorkspaceLeaf,{file:TFile;view:View;work:Promise<void>}>;private nativeMarkdownOpeningStopped=false;
  async locateNativeBoardEditor(file:TFile,leaf:WorkspaceLeaf,current:()=>boolean){
    const path=file.path,previous=leaf.view,deferred=!!leaf.isDeferred,container=leaf.getContainer(),doc=container.doc,win=container.win;
    const valid=()=>current()&&file.path===path&&this.app.vault.getAbstractFileByPath(path)===file&&!win.closed&&leaf.getContainer().doc===doc&&leaf.getContainer().win===win&&nativeBoardEditorLeaves(this.app,file).includes(leaf);
    if(!valid())return;await leaf.loadIfDeferred();
    if(!valid()||!deferred&&leaf.view!==previous||!(leaf.view instanceof MarkdownView)||leaf.view.file!==file)return;
    const view=leaf.view;await this.app.workspace.revealLeaf(leaf);
    if(!valid()||leaf.view!==view||view.file!==file)return;this.app.workspace.setActiveLeaf(leaf,{focus:true});
  }
  nativeBoardEditorStatus(file:TFile){return nativeBoardEditorStatus(this.app,file);}
  private refreshMarkdownBoardOwnership(){
    // Observe native pages synchronously, including files with no Board Session
    // or rename journal yet. Their last save can outlive the closing leaf.
    const observed=new Set<TFile>();
    for(const leaf of this.app.workspace.getLeavesOfType('markdown')){
      if(leaf.isDeferred||!(leaf.view instanceof MarkdownView))continue;
      const file=leaf.view.file;if(!file||file.extension.toLowerCase()!=='md'||!isWorkspaceFile(file)||observed.has(file))continue;
      observed.add(file);hasNativeBoardEditor(this.app,file);
    }
    act(()=>this.retryPendingBoardReferences());for(const [file,pending]of this.sessions)if(file.extension.toLowerCase()==='md')act(async()=>{const session=await pending,wasBlocked=session.blocked;session.refreshNativeEditing();if(wasBlocked){await this.referenceQueue.catch(()=>{});await this.flushPendingBoardReferences(file);await session.externalUpdate();}});
  }
  promptMarkdownBoard(presentation:'board'|'brain'='board'){
    new Prompt(this.app,presentation==='brain'?'新建 Markdown 脑图白板':'新建 Markdown 白板',presentation==='brain'?'新的脑图':'新的研究主题',async(name,type)=>{
      const board=type==='brain'?createBrainBoard():emptyBoard(),file=await this.createUnique(`${ROOT}/白板`,name,'md',createMarkdownBoardDocument(board,name));await this.openBoard(file);
    },{label:'白板类型',value:presentation,items:[{value:'board',text:'普通白板'},{value:'brain',text:'脑图白板'}]}).open();
  }
  async openBoardNativeMarkdown(file:TFile,leaf?:WorkspaceLeaf){
    if(file.extension.toLowerCase()!=='md'||!isWorkspaceFile(file)||this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('请选择仓库内的 Markdown 白板');
    if(this.nativeMarkdownOpeningStopped)throw Error('插件已停止，原生页未打开');
    const original=file.path,target=leaf||this.app.workspace.getLeaf('tab'),view=target.view,owner=view instanceof BoardView&&view.file===file?view.session:undefined,active=this.app.workspace.getMostRecentLeaf(),doc=view.containerEl?.ownerDocument,win=doc?.defaultView;
    if(leaf&&(view instanceof BoardView||view instanceof MarkdownView)&&view.file!==file)throw Error('当前页面不是该白板，原生页未打开');
    const pending=this.nativeMarkdownOpening??=new WeakMap(),existing=pending.get(target);if(existing?.file===file&&existing.view===view)return existing.work;
    let cancelled=false,delivering=false;const navigation=this.app.workspace.on('active-leaf-change',next=>{if(next!==active&&!(delivering&&next===target))cancelled=true;});
    const current=()=>!cancelled&&!this.nativeMarkdownOpeningStopped&&target.view===view&&view.containerEl?.isConnected!==false&&view.containerEl?.ownerDocument===doc&&doc?.defaultView===win&&!win?.closed&&this.app.workspace.getMostRecentLeaf()===active&&(!(view instanceof BoardView)||view.file===file&&view.session===owner&&!view.closed);
    const work=Promise.resolve().then(async()=>{
      if(!current())throw Error('当前页面已变化，已取消打开原生页');
      if(view instanceof MarkdownView&&view.file===file)return;
      if(owner)await owner.flush();
      if(file.path!==original||this.app.vault.getAbstractFileByPath(original)!==file)throw Error('白板在保存期间已移动或删除，原生页未打开');
      if(!current())throw Error('当前页面或文件已变化，已取消打开原生页');
      if(owner?.blocked)throw Error('布局尚未安全保存，请先保留恢复草稿，再打开原生页');
      // Obsidian owns Properties and Markdown editing after the saved board handoff.
      delivering=true;await target.setViewState({type:'markdown',active:true,state:{file:original,mode:'preview'}});
      this.refreshMarkdownBoardOwnership();
      if(cancelled||this.nativeMarkdownOpeningStopped||!(target.view instanceof MarkdownView)||target.view.file!==file||file.path!==original||this.app.vault.getAbstractFileByPath(original)!==file||(this.app.workspace.getMostRecentLeaf()!==active&&this.app.workspace.getMostRecentLeaf()!==target))throw Error('页面已变化，原生页打开未抢回焦点');
      this.app.workspace.setActiveLeaf(target,{focus:true});
    }).finally(()=>{this.app.workspace.offref(navigation);if(pending.get(target)?.work===work)pending.delete(target);});pending.set(target,{file,view,work});return work;
  }
  toggleBoardNative(){
    const view=this.app.workspace.getActiveViewOfType(BoardView);
    if(view?.file?.extension.toLowerCase()==='md'&&!view.closed&&view.session&&!view.session.blocked)return this.openBoardNativeMarkdown(view.file,view.leaf);
    return this.openCurrentMarkdownBoard();
  }
  async openCurrentMarkdownBoard(){
    const view=this.app.workspace.getActiveViewOfType(MarkdownView),file=view?.file,leaf=view?.leaf;
    if(!view||!file||!leaf||!isBoardFile(this.app,file))throw Error('请先打开声明 thoughtspace: board 的 Markdown 白板');
    if(this.nativeBoardTransitions.has(file))throw Error('此 Markdown 白板正在返回白板，请等待当前切换完成');
    const path=file.path,text=view.getViewData();this.nativeBoardTransitions.add(file);this.refreshMarkdownBoardOwnership();
    try{
      await settleNativeBoardEditor(this.app,file,leaf);
      if(leaf.view!==view||view.file!==file||view.getViewData()!==text||file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file)throw Error('原生内容或页面已变化，已取消返回白板');
      // The transition lock remains held throughout native onUnloadFile and the
      // fresh read. Automatic card measurements cannot write during this handoff.
      await leaf.setViewState({type:VIEW,active:true,state:{file:path}});
      const clock=this.app.workspace.containerEl.ownerDocument.defaultView||window,start=Date.now();
      for(;;){const saving:unknown=Object.getOwnPropertyDescriptor(view,'saving')?.value;if(typeof saving!=='boolean')throw Error('无法确认原生卸载保存状态，白板保持仅查看');if(!saving)break;if(Date.now()-start>1000)throw Error('原生卸载仍在保存，白板保持仅查看');await new Promise<void>(resolve=>clock.setTimeout(resolve,25));}
      if(file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file)throw Error('交接期间文件已移动，请回到原生页检查');
      const raw=await this.app.vault.read(file);readBoardDocument(raw,'md',parseYaml);
      if(raw!==text)throw Error('交接期间原生属性或正文发生变化，原文件保留，请重新打开后重试');
      if(!(leaf.view instanceof BoardView)||leaf.view.file!==file||!leaf.view.session)throw Error('白板页面已切换，请重新打开');
      assertBoardEditorOwnership(this.app,file);
      const opened=leaf.view,owner=opened.session!;this.nativeBoardTransitions.delete(file);await this.referenceQueue.catch(()=>{});await this.flushPendingBoardReferences(file);await owner.externalUpdate();if(leaf.view!==opened||opened.file!==file||opened.session!==owner||owner.blocked)throw Error('白板交接已取消或保存仍受保护，请重新打开');this.app.workspace.setActiveLeaf(leaf,{focus:true});
    }catch(error){
      if(leaf.view instanceof BoardView&&leaf.view.file===file&&file.extension.toLowerCase()==='md'&&isWorkspaceFile(file)&&this.app.vault.getAbstractFileByPath(file.path)===file)await leaf.setViewState({type:'markdown',active:true,state:{file:file.path,mode:'source'}});
      throw error;
    }finally{this.nativeBoardTransitions.delete(file);this.refreshMarkdownBoardOwnership();}
  }
  promptSaveBoardAs(format:'markdown'|'legacy',view=this.app.workspace.getActiveViewOfType(BoardView)){
    const file=view?.file,owner=view?.session;if(!file||!owner||view.closed||owner.blocked)throw Error('请先打开可编辑白板');
    new Prompt(this.app,format==='markdown'?'另存为 Markdown 白板':'另存为旧格式白板',file.basename,async title=>{if(view.closed||view.file!==file||view.session!==owner)throw Error('白板已切换，另存已取消');const saved=await this.saveBoardAs(file,title,format);await this.openBoard(saved);new Notice('已创建独立副本；原文件与已有链接保留');}).open();
  }
  async saveBoardAs(file:TFile,title:string,format:'markdown'|'legacy'):Promise<TFile>{
    const path=file.path,pending=this.sessions.get(file);if(pending){const session=await pending;session.refreshNativeEditing();if(session.blocked)throw Error('原白板暂停写入，请先保存并关闭原生页或处理冲突');await session.flush();if(session.blocked)throw Error('原白板尚未保存，另存已取消');}
    if(this.app.vault.getAbstractFileByPath(path)!==file||file.path!==path||!isWorkspaceFile(file))throw Error('原白板已移动或删除，另存已取消');
    if(file.extension.toLowerCase()==='md')assertBoardEditorOwnership(this.app,file);
    const document=readBoardDocument(await this.app.vault.read(file),file.extension,parseYaml),board=clone(document.board);board.spaceId=uid();
    const content=format==='legacy'?JSON.stringify(board,null,2):document.format==='markdown'?replaceBoardDocumentLayout(document.source,document,board,parseYaml).source:createMarkdownBoardDocument(board,title);
    if(file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file)throw Error('原白板已移动，另存已取消');
    return this.createUnique(file.parent?.path||`${ROOT}/白板`,title,format==='markdown'?'md':EXT,content);
  }
  promptMindmap(){new MindmapPresetsModal(this.app,async b=>{const title=b.nodes[0].text||'我的思维导图',file=await this.createUnique(`${ROOT}/白板`,title,EXT,JSON.stringify(b,null,2));await this.openBoard(file,true);const v=this.app.workspace.getLeavesOfType(VIEW).map(l=>l.view).find(v=>v instanceof BoardView&&v.file===file) as BoardView|undefined;v?.fit();}).open();}
  promptNewBoard(){
    if(this.boardCreationStopped)return;this.boardCreationModal?.close();
    const modal=new BoardCreationModal(this.app,{initial:cleanBoardCreationPreferences(this.settings.boardCreation),current:()=>!this.boardCreationStopped,decorate:themeSurface,
      submit:async(name,choice,current,expectDestination)=>{
        const board=choice.presentation==='brain'?createBrainBoard():emptyBoard();
        const file=await this.createUnique(`${ROOT}/白板`,name,choice.format==='markdown'?'md':EXT,choice.format==='markdown'?createMarkdownBoardDocument(board,name):JSON.stringify(board,null,2),current);
        expectDestination(file);await this.finishBoardCreation(file,choice,current);
      }});this.boardCreationModal=modal;modal.open();return modal;
  }
  promptTemplateBoard(id:string,name:string,created?:()=>void){
    if(this.boardCreationStopped)return;this.boardCreationModal?.close();
    const modal=new BoardCreationModal(this.app,{initial:{...cleanBoardCreationPreferences(this.settings.boardCreation),presentation:'board'},name,title:'从模板新建',template:true,current:()=>!this.boardCreationStopped,decorate:themeSurface,
      submit:async(title,choice,current,expectDestination)=>{const file=await this.createFromTemplate(id,title,choice.format,current,false);if(!current())return;expectDestination(file);try{created?.();}catch(error){new Notice(`模板白板已创建；模板窗口暂未关闭。${error instanceof Error?error.message:String(error)}`,8000);}await this.finishBoardCreation(file,choice,current,true,true);}
    });this.boardCreationModal=modal;modal.open();return modal;
  }
  private async finishBoardCreation(file:TFile,choice:BoardCreationPreferences,current:()=>boolean,fit=false,formatOnly=false){
    if(!current())return;
    try{await this.openBoard(file,fit,current);}catch(error){new Notice(`白板已创建：${file.path}；暂未打开，请从文件列表重开。${error instanceof Error?error.message:String(error)}`,10000);return;}
    if(!current())return;
    try{await this.rememberBoardCreation(choice,current,formatOnly);}catch(error){new Notice(`白板已创建；类型与格式偏好未保存，下次仍使用原选择。${error instanceof Error?error.message:String(error)}`,10000);}
  }
  private rememberBoardCreation(choice:BoardCreationPreferences,current:()=>boolean,formatOnly=false){
    const next=this.boardCreationPreferenceQueue.catch(()=>{}).then(async()=>{
      if(!current())return;const previous=this.settings.boardCreation,selection=cleanBoardCreationPreferences({...choice,...(formatOnly?{presentation:cleanBoardCreationPreferences(previous).presentation}:{})});this.settings.boardCreation=selection;
      try{await this.saveData(this.settings);}catch(error){if(this.settings.boardCreation===selection)this.settings.boardCreation=previous;throw error;}
    });this.boardCreationPreferenceQueue=next;return next;
  }
  promptBoard(presentation:'board'|'brain'='board') { new Prompt(this.app, '新建白板', presentation==='brain'?'新的脑图':'新的研究主题', async (name,type) => this.openBoard(await this.createUnique(`${ROOT}/白板`, name, EXT, JSON.stringify(type==='brain'?createBrainBoard():emptyBoard(), null, 2))),{label:'白板类型',value:presentation,items:[{value:'board',text:'普通白板'},{value:'brain',text:'脑图白板'}]}).open(); }
  promptBrainBoard(){this.promptBoard('brain');}
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
    if(isBoardFile(this.app,file))throw Error('白板文件不参与卡片按标签归档，请使用原生文件管理器移动');
    if (file.parent?.path === folder) return false;
    const oldPath = file.path;
    await this.referenceQueue;
    for (const pending of this.sessions.values()) { const s = await pending; await s.flush(); }
    const affected: Array<{file: TFile; raw: string}> = [];
    for (const board of this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => isBoardFile(this.app,f))) {
      const raw = await this.app.vault.read(board);
      let data: Board;
      try { data = readBoardDocument(raw,board.extension,parseYaml).board; } catch { if (raw.includes(oldPath)) throw new Error(`引用白板无法读取：${board.path}`); else continue; }
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
    for (const [i, entry] of affected.entries()) await this.app.vault.adapter.write(`${backup}/board-${i}.${entry.file.extension}`, entry.raw);
    await this.app.vault.adapter.write(`${backup}/record.json`, JSON.stringify({ from: oldPath, to: target, boards: affected.map((entry, i) => ({ path: entry.file.path, backup: `board-${i}.${entry.file.extension}` })), status: 'prepared' }, null, 2));
    await this.folder(folder);
    await this.app.fileManager.renameFile(file, target);
    await this.referenceQueue;
    for (const entry of affected) {
      const current = readBoardDocument(await this.app.vault.read(entry.file),entry.file.extension,parseYaml).board;
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
    return {docked:true,target:()=>{const v=this.currentBoard;return v?.file&&!v.closed?{name:v.file.basename,path:v.file.path}:undefined;},pickTarget:()=>new ActionPicker(this.app,'选择目标白板',this.app.vault.getFiles().filter(f=>isBoardFile(this.app,f)).map(file=>({title:file.basename,run:()=>this.openBoard(file)})).concat([{title:'＋ 新建白板',run:async()=>{this.promptNewBoard();}}])).open(),
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
  private videoBridgeDisposed=false;
  private async receiveVideoCapture(raw:unknown){
    if(this.videoBridgeDisposed)throw Error('ThoughtSpace 已关闭');
    const request=videoCaptureRequest(raw);if(request.vaultId!==this.yingjianVaultId())throw Error('记录与白板不属于同一仓库');
    const board=this.app.vault.getAbstractFileByPath(request.board),note=this.app.vault.getAbstractFileByPath(request.note);
    if(!(board instanceof TFile)||!(note instanceof TFile)||!isWorkspaceFile(board)||!isWorkspaceFile(note))throw Error('记录或目标白板已移除');
    const text=await this.app.vault.read(note),header=/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
    if(!isYingjianCaptureNote(header?parseYaml(header[1]):undefined,request.id))throw Error('笔记不是此条视频记录');
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
  async openBoardMediaTimestamp(href:string,origin:BoardView,excerpt?:string){
    const local=parseMediaSourceUrl(href)||parseMediaPlayerUrl(href),online=local?undefined:parseOnlinePlayerUrl(href),source=local||online;
    if(!source||source.vault!==this.app.vault.getName())throw Error('媒体链接无效或属于其他仓库');
    const legacy=parseMediaSourceUrl(href),views=[origin];
    if(legacy)for(const leaf of this.app.workspace.getLeavesOfType(VIEW)){const view=leaf.view;if(view instanceof BoardView&&view!==origin&&view.file?.path===legacy.board)views.push(view);}
    for(const view of views){
      if(view.closed||!view.session||view.session.blocked)continue;
      const node=mediaTimestampNode(view.session.board,local?{file:local.file}:{source:online!.source},view===origin?excerpt:undefined,legacy&&view.file?.path===legacy.board?legacy.node:undefined);if(!node)continue;
      if(local)view.seekMediaSource({vault:source.vault,board:view.session.file.path,node:node.id,file:local.file,time:source.time});
      else await view.seekOnlineSource(online!.source,online!.time,view===origin?excerpt:undefined,node.id);
      return;
    }
    if(local){const file=this.app.vault.getAbstractFileByPath(local.file);if(!(file instanceof TFile)||!isWorkspaceFile(file))throw Error('来源媒体已移动或删除');await this.openMediaWorkspace(file,'tab',local.time);}
    else await this.openOnlineWorkspace(online!.source,'tab',online!.time,online!.note);
  }
  async openMediaSource(input:string|Record<string,string>){
    const source=parseMediaSourceUrl(input);if(!source||source.vault!==this.app.vault.getName())throw Error('媒体链接无效或属于其他仓库');
    const file=this.app.vault.getAbstractFileByPath(source.board);if(!(file instanceof TFile)||!isWorkspaceFile(file))throw Error('找不到来源白板');
    await this.openBoard(file);const view=this.currentBoard;
    if(!view||view.file!==file||view.closed)throw Error('来源白板尚未就绪');
    view.seekMediaSource(source);
  }
  async openMediaPlayerSource(input:string|Record<string,string>){
    const source=parseMediaPlayerUrl(input);if(!source||source.vault!==this.app.vault.getName())throw Error('媒体链接无效或属于其他仓库');
    const file=this.app.vault.getAbstractFileByPath(source.file);if(!(file instanceof TFile)||!isWorkspaceFile(file))throw Error('来源媒体已移动或删除');
    await this.openMediaWorkspace(file,'tab',source.time);
  }
  pickOnlineVideo(placement:MediaPlacement='tab',accept?:(url:string)=>unknown){
    new Prompt(this.app,'B 站 / YouTube 视频链接','',async input=>{
      const source=await resolveOnlineSource(input);if(this.mediaClosed)return;
      if(accept){const url=new URL(source.path);if(source.initialTime)url.searchParams.set('t',String(source.initialTime));await accept(url.href);}
      else await this.openOnlineWorkspace(source.path,placement,source.initialTime);
    }).open();
  }
  openOnlineWorkspace(input:string,placement:MediaPlacement='tab',time?:number,note?:string,adopted=false):Promise<void>{
    const source=parseOnlineSource(input);if(!source)return Promise.reject(Error('在线视频链接无效'));
    const job=this.mediaOpening.catch(()=>undefined).then(async()=>{
      if(this.mediaClosed)return;
      const workspace=this.app.workspace;
      for(const leaf of [...workspace.getLeavesOfType(MEDIA_WORKSPACE),...workspace.getLeavesOfType(ONLINE_WORKSPACE)])await leaf.loadIfDeferred();
      if(this.mediaClosed)return;
      const views=workspace.getLeavesOfType(ONLINE_WORKSPACE).map(l=>l.view).filter((v):v is OnlineWorkspaceView=>v instanceof OnlineWorkspaceView);
      const previous=workspace.getActiveViewOfType(OnlineWorkspaceView)||views.find(v=>v.currentSource()?.path===source.path)||views[0];
      const same=previous?.currentSource()?.path===source.path&&(!note||note===previous.currentNote());
      if(previous&&(!same||previous.getState().placement!==placement)&&!previous.canMove())return;
      const canLeave=()=>{
        if(previous&&(!same||previous.getState().placement!==placement)&&!previous.canMove())return false;
        return workspace.getLeavesOfType(MEDIA_WORKSPACE).every(leaf=>!(leaf.view instanceof MediaWorkspaceView)||leaf.view.canMove());
      };
      if(!canLeave())return;
      if(note)await this.onlineMedia.notes(source.path,note);
      if(this.mediaClosed)return;
      const target=time??(source.initialTime||undefined);
      if(target!==undefined&&(!Number.isFinite(target)||target<0||target>864000))throw Error('在线视频时间无效');
      const ensure=()=>{if(this.mediaClosed)throw Error('播放器已关闭');};
      const launch=async()=>{
        ensure();this.mediaWorkspace.playback.pauseAll();
        if(adopted){if(this.onlineState?.sourcePath!==source.path||this.onlineState.closed)throw Error('平台当前视频已变化，请重新确认');await this.onlinePlatform.command(source.path,'focus');return;}
        if(this.onlineState?.sourcePath===source.path&&!this.onlineState.closed){if(target!==undefined)await this.onlinePlatform.command(source.path,'seek',target);ensure();await this.onlinePlatform.command(source.path,'focus');}
        else this.onlinePlatform.open(source.path,target??0);
      };
      if(same&&previous?.getState().placement===placement){
        if(!canLeave())return;await launch();ensure();if(placement==='sidebar')workspace.rightSplit.expand();await workspace.revealLeaf(previous.leaf);workspace.setActiveLeaf(previous.leaf,{focus:true});return;
      }
      let leaf:WorkspaceLeaf|undefined;
      try{
        leaf=placement==='sidebar'?workspace.getRightLeaf(true)||undefined:workspace.getLeaf(placement==='window'?'window':'tab');
        if(!leaf)throw Error('无法打开在线视频笔记');
        await leaf.setViewState({type:ONLINE_WORKSPACE,active:true,state:{source:source.path,placement,note:note||(same?previous?.currentNote():undefined),...(target!==undefined?{time:target}:{})}});
        ensure();
        if(!canLeave()){leaf.detach();return;}
        if(placement==='sidebar')workspace.rightSplit.expand();await workspace.revealLeaf(leaf);
        ensure();if(!canLeave()){leaf.detach();return;}
        await launch();ensure();
        if(previous&&previous.leaf!==leaf){if(!previous.canMove()){leaf.detach();return;}previous.leaf.detach();}
      }catch(error){leaf?.detach();throw error;}
    });this.mediaOpening=job;return job;
  }
  registerOnlineBoardPlayer(player:OnlineBoardPlayerHandle){this.onlineBoardPlayers.add(player);return()=>this.onlineBoardPlayers.delete(player);}
  pauseOnlineBoardPlayers(except?:OnlineBoardPlayerHandle){for(const player of this.onlineBoardPlayers)if(player!==except)player.pause();}
  activateOnlineBoardPlayer(player:OnlineBoardPlayerHandle){
    this.mediaWorkspace.playback.pauseAll();this.pauseOnlineBoardPlayers(player);
    const state=this.onlineState;if(state?.available&&!state.paused)void this.onlinePlatform.command(state.sourcePath,'pause').catch(report);
  }
  async saveOnlineBoardMoment(source:string,data:OnlineBoardMoment){
    const {note}=await this.onlineMedia.save(source,data);
    const {entries}=await this.onlineMedia.notes(source,note.path),moment=entries.find(entry=>entry.id===data.id);
    if(!moment)throw Error(`摘录已保存至 ${note.path}，暂时无法读取，请重试`);
    return{note,moment};
  }
  async sendOnlineToBoard(input:string,time?:number,text?:string,image?:string){
    const source=parseOnlineSource(input);if(!source)throw Error('在线视频来源无效');if(image!==undefined&&!imageMarkup(image))throw Error('截图引用无效');
    const add=async(view:BoardView)=>{
      if(time===undefined&&text===undefined&&image===undefined){await view.addWebCard(source.path);return;}
      const value=time??0,url=onlinePlayerUrl(this.app.vault.getName(),source.path,value);
      view.pasteTexts([image,text,`[${mediaClock(value)} · 回看视频](${url})`].filter(Boolean).join('\n\n'),false);
    };
    const view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard;
    if(view?.session&&!view.closed){await add(view);return;}
    const picker=new BoardPicker(this.app,null,async board=>{await this.openBoard(board);const target=this.currentBoard;if(!target||target.closed||target.file!==board)throw Error('白板已变化，请重新选择');await add(target);});picker.setPlaceholder('选择接收视频或摘录的白板…');picker.open();
  }
  openMediaLibrary(){act(()=>this.openMediaWorkspace(undefined,'tab'));}
  async linkExternalMedia(input:string,kind?:'audio'|'video'):Promise<TFile>{
    const reference=await createExternalMediaReference(input);
    if(kind&&reference.kind!==kind)throw Error(kind==='video'?'请选择本地视频文件':'请选择本地音频文件');
    if(this.mediaClosed)throw Error('插件已关闭，请重新打开');
    const folder=normalizePath(this.settings.cardFolder+'/媒体引用/'+createHash('sha256').update(reference.content).digest('hex').slice(0,12));
    const title=reference.basename;
    const path=normalizePath(folder+'/'+safeName(title)+'.'+reference.extension),existing=this.app.vault.getAbstractFileByPath(path);
    const verify=async(file:TFile)=>{
      const path=file.path,stamp=file.stat.mtime,size=file.stat.size;
      const ensure=()=>{if(this.mediaClosed||this.app.vault.getAbstractFileByPath(path)!==file||file.path!==path||file.stat.mtime!==stamp||file.stat.size!==size)throw Error('媒体引用已变化，请重新选择');};
      ensure();const content=await this.app.vault.read(file);ensure();
      if(content!==reference.content)throw Error('媒体引用的来源已变化，请重新选择');
      await this.mediaWorkspace.validateResource(file);ensure();return file;
    };
    if(existing instanceof TFile&&await this.app.vault.read(existing)===reference.content)return verify(existing);
    return verify(await this.createUnique(folder,title,reference.extension,reference.content));
  }
  pickExternalMedia(done:(file:TFile)=>unknown,kind?:'audio'|'video'){
    new ExternalMediaPicker(this.app,input=>this.linkExternalMedia(input,kind),done,kind).open();
  }
  pickMediaFile(done:(file:TFile)=>unknown,kind?:'audio'|'video',online?:(url:string)=>unknown){
    const app=this.app,recent=this.mediaWorkspace.playback.recent(),external={external:true},network={online:true},linkOutside=()=>this.pickExternalMedia(done,kind),linkOnline=()=>this.pickOnlineVideo('tab',online);
    class Picker extends FuzzySuggestModal<TFile|typeof external|typeof network>{
      getItems(){return [...app.vault.getFiles().filter(f=>isWorkspaceFile(f)&&!!mediaKind(f.path)&&(!kind||mediaKind(f.path)===kind)).sort((a,b)=>{const ai=recent.indexOf(a.path),bi=recent.indexOf(b.path);return(ai<0?Infinity:ai)-(bi<0?Infinity:bi)||a.path.localeCompare(b.path);}),external,...(kind==='audio'?[]:[network])];}
      getItemText(file:TFile|typeof external|typeof network){return file instanceof TFile?file.path:file===network?'＋ B 站 / YouTube 在线视频…':'＋ 链接仓库外的'+(kind==='audio'?'音频':'视频或音频')+'…';}
      onChooseItem(file:TFile|typeof external|typeof network){if(file instanceof TFile)act(()=>done(file));else if(file===network)linkOnline();else linkOutside();}
    }
    const picker=new Picker(app);picker.setPlaceholder('搜索音视频，或打开本地文件 / 在线视频');picker.open();
  }
  private async restoreMediaDraft(draft:MediaDraft){
    if(this.mediaClosed||!this.mediaDrafts)throw Error('插件已关闭');
    const file=this.app.vault.getAbstractFileByPath(draft.source.path);if(!(file instanceof TFile)||!isVaultMediaPath(file.path))throw Error('找不到原媒体');
    const existing=this.app.workspace.getLeavesOfType(MEDIA_WORKSPACE).find(leaf=>leaf.view instanceof MediaWorkspaceView&&leaf.view.currentFile()===file);
    const leaf=existing||this.app.workspace.getLeaf('tab');
    await leaf.setViewState({type:MEDIA_WORKSPACE,active:true,state:{file:file.path,placement:'tab',time:draft.time}});
    if(!(leaf.view instanceof MediaWorkspaceView)||leaf.view.currentFile()!==file||file.path!==draft.source.path||this.app.vault.getAbstractFileByPath(draft.source.path)!==file)throw Error('媒体工作区或来源已变化，请重试');
    this.mediaDrafts.activate(draft.id);
    await this.app.workspace.revealLeaf(leaf);
  }
  openMediaWorkspace(file?:TFile,placement:MediaPlacement='tab',time?:number):Promise<void>{
    const requestedPath=file?.path;
    const job=this.mediaOpening.catch(()=>undefined).then(async()=>{
      if(this.mediaClosed)return;
      const workspace=this.app.workspace;
      for(const leaf of [...workspace.getLeavesOfType(MEDIA_WORKSPACE),...workspace.getLeavesOfType(ONLINE_WORKSPACE)])if(!(leaf.view instanceof MediaWorkspaceView)&&!(leaf.view instanceof OnlineWorkspaceView))await leaf.loadIfDeferred();
      if(this.mediaClosed)return;
      const views=workspace.getLeavesOfType(MEDIA_WORKSPACE).map(l=>l.view).filter((v):v is MediaWorkspaceView=>v instanceof MediaWorkspaceView);
      const active=workspace.getActiveViewOfType(MediaWorkspaceView),previous=active||views.find(v=>v.currentFile()===file)||views[0];
      const current=workspace.getActiveFile(),target=file||previous?.currentFile()||(current&&mediaKind(current.path)?current:undefined);
      if(target&&(!isWorkspaceFile(target)||!mediaKind(target.path)||this.app.vault.getAbstractFileByPath(requestedPath||target.path)!==target||requestedPath&&target.path!==requestedPath))throw Error('媒体文件已移动或删除，请重新选择');
      if(time!==undefined)mediaTime(time);
      const canLeaveOnline=()=>workspace.getLeavesOfType(ONLINE_WORKSPACE).every(leaf=>!(leaf.view instanceof OnlineWorkspaceView)||leaf.view.canMove());
      if(!canLeaveOnline())return;
      if(previous&&previous.currentFile()===target&&previous.getState().placement===placement){
        const live=()=>!this.mediaClosed&&previous.leaf.view===previous&&workspace.getLeavesOfType(MEDIA_WORKSPACE).includes(previous.leaf);
        if(time!==undefined)await previous.setState({...previous.getState(),time});
        if(!live())return;if(placement==='sidebar')workspace.rightSplit.expand();
        await workspace.revealLeaf(previous.leaf);
        // Revealing a pane does not select an already-open tab.
        if(live()&&canLeaveOnline()){this.onlinePlatform.stop();workspace.setActiveLeaf(previous.leaf,{focus:true});}return;
      }
      if(previous&&!previous.canMove())return;

      const playing=previous?.containerEl.querySelector<HTMLMediaElement>('audio,video')?.paused===false;
      const sameSource=previous?.currentFile()===target,previousLayout=sameSource?previous?.getState():undefined;
      const layout=previousLayout?{focusPlayer:previousLayout.focusPlayer,recordPanel:previousLayout.recordPanel,compactPlayer:previousLayout.compactPlayer,viewerRatio:previousLayout.viewerRatio,recordDensity:previousLayout.recordDensity,composerRatio:previousLayout.composerRatio}:{};
      let leaf:WorkspaceLeaf|undefined;
      try{
        leaf=placement==='sidebar'?workspace.getRightLeaf(true)||undefined:workspace.getLeaf(placement==='window'?'window':'tab');
        if(!leaf)throw Error('无法打开播放器窗口');
        // Release the decoder first so its final time is available to the new view.
        this.mediaWorkspace.playback.pauseAll();
        await leaf.setViewState({type:MEDIA_WORKSPACE,active:true,state:{file:target?.path,placement,...layout,...(time!==undefined?{time}:{})}});
        if(this.mediaClosed){leaf.detach();return;}
        if(placement==='sidebar')workspace.rightSplit.expand();await workspace.revealLeaf(leaf);
        if(this.mediaClosed){leaf.detach();return;}
        if(!canLeaveOnline()){leaf.detach();return;}
        this.onlinePlatform.stop();
        if(previous&&previous.leaf!==leaf){if(!previous.canMove()){leaf.detach();return;}previous.leaf.detach();}
        if(playing&&sameSource&&leaf.view instanceof MediaWorkspaceView)leaf.view.resumePlayback();
      }catch(error){leaf?.detach();if(playing&&!this.mediaClosed)previous?.resumePlayback();throw error;}
    });this.mediaOpening=job;return job;
  }
  async sendMediaToBoard(file:TFile,moment?:MediaMoment&{notePath?:string}){
    const path=file.path;const add=async(view:BoardView)=>{if(file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file)throw Error('媒体已移动或删除');const owner=view.session,target=view.file;const reference=moment?await this.mediaWorkspace.referenceMoment(file,moment):undefined;if(view.session!==owner||view.file!==target||view.closed)throw Error('目标白板已变化，请重新选择');const link=reference?this.app.fileManager.generateMarkdownLink(reference.note,view.file!.path,reference.subpath):undefined;await view.addWorkspaceMedia(file,reference?.moment,link?'!'+link:undefined);new Notice(moment?'已引用原笔记摘录，可点击时间回看':'媒体已加入白板');};
    const view=this.app.workspace.getActiveViewOfType(BoardView)||this.currentBoard;
    if(view?.session&&!view.closed){await add(view);return;}
    const picker=new BoardPicker(this.app,null,async board=>{await this.openBoard(board);const target=this.currentBoard;if(!target||target.closed||target.file!==board)throw Error('白板已变化，请重新选择');await add(target);});picker.setPlaceholder('选择接收媒体或摘录的白板…');picker.open();
  }
  private yingjianVaultId(){const adapter=this.app.vault.adapter;if(!(adapter instanceof FileSystemAdapter))throw Error('影笺联动需要桌面版 Obsidian');return createHash('sha256').update(resolvePath(adapter.getBasePath())).digest('hex').slice(0,20);}
  private resolveLegacyMedia(source:string):TFile {
    const adapter=this.app.vault.adapter;
    const file=isVaultMediaPath(source)?this.app.vault.getAbstractFileByPath(source):adapter instanceof FileSystemAdapter?this.app.vault.getFiles().find(f=>mediaKind(f.path)&&source===resolvePath(adapter.getBasePath(),f.path)):undefined;
    if(!(file instanceof TFile)||!isWorkspaceFile(file)||!mediaKind(file.path))throw Error('来源音视频不在当前仓库中，请先将它放入仓库');return file;
  }
  async playYingjianTimestamp(href:string,contextPath?:string){
    const parsed=parseYingjianLink(href);if(!parsed)throw Error('视频时间链接无效');
    const url=new URL(href),vaultId=this.yingjianVaultId();
    if(url.hash||[...url.searchParams.keys()].some(key=>!['video','t','note','vault'].includes(key)||url.searchParams.getAll(key).length!==1))throw Error('视频时间链接无效');
    if(url.searchParams.has('vault')&&url.searchParams.get('vault')!==vaultId)throw Error('视频时间点属于其他仓库');
    const named=url.searchParams.get('note');if(named!==null&&!yingjianNotePath(named))throw Error('视频来源笔记路径无效');
    let path=yingjianNotePath(named||contextPath),file=path&&this.app.vault.getAbstractFileByPath(path);
    // External player URLs are not rewritten by Obsidian's Markdown rename.
    // A current card/excerpt provenance may recover a missing old path; its
    // video source is still checked below before sending anything to the player.
    if(!file&&contextPath){path=yingjianNotePath(contextPath);file=path&&this.app.vault.getAbstractFileByPath(path);}
    if(!(file instanceof TFile)||!isWorkspaceFile(file))throw Error('找不到此时间点的来源笔记，请从影笺视频笔记入口回看');
    const stamp=file.stat.mtime,size=file.stat.size;if(file.extension!=='md'||size>2*1024*1024)throw Error('来源笔记无效或过大');
    const raw=await this.app.vault.read(file),header=/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(raw),meta:unknown=header?parseYaml(header[1]):undefined;
    if(file.path!==path||file.stat.mtime!==stamp||file.stat.size!==size||this.app.vault.getAbstractFileByPath(path)!==file||!isRecord(meta)||meta.source!==parsed.video)throw Error('视频来源已变化，请刷新摘录后重试');
    if(parseOnlineSource(parsed.video)){await this.openOnlineWorkspace(parsed.video,'tab',parsed.time,file.path);return;}
    await this.openMediaWorkspace(this.resolveLegacyMedia(parsed.video),'tab',parsed.time);
  }
  async openYingjianLink(params:Record<string,string>){const path=yingjianNotePath(params.note);if(params.vault!==undefined&&params.vault!==this.app.vault.getName()||!path||params.vaultId!==undefined&&params.vaultId!==this.yingjianVaultId())throw Error('影笺入口的仓库或笔记路径无效');let file=this.app.vault.getAbstractFileByPath(path);for(let attempt=0;!file&&attempt<12;attempt++){await new Promise(resolve=>window.setTimeout(resolve,150));file=this.app.vault.getAbstractFileByPath(path);}if(!(file instanceof TFile)||!isWorkspaceFile(file))throw Error('影笺笔记尚未同步到当前仓库，请同步后重试');await this.openYingjian(file);}
  async openYingjian(initial?:TFile){
    if(this.mediaClosed)return;
    if(!initial){await this.openMediaWorkspace();return;}
    const path=initial.path,stamp=initial.stat.mtime,size=initial.stat.size;if(initial.extension!=='md'||this.app.vault.getAbstractFileByPath(path)!==initial||!isWorkspaceFile(initial)||size>2*1024*1024)throw Error('来源笔记已变化或过大，请重新选择');
    const raw=await this.app.vault.read(initial),source=mediaNoteSource(raw)||onlineNoteSource(raw);
    if(this.app.vault.getAbstractFileByPath(path)!==initial||initial.path!==path||initial.stat.mtime!==stamp||initial.stat.size!==size||!source)throw Error('媒体来源笔记已变化，请刷新后重试');
    if(parseOnlineSource(source)){await this.openOnlineWorkspace(source,'tab',undefined,initial.path);return;}
    await this.openMediaWorkspace(this.resolveLegacyMedia(source),'tab');
  }
  async openExcerptNote(initial?:TFile){
    const active=this.app.workspace.getActiveFile(),source=initial||this.currentBoard?.materialSource()||(active&&['md','pdf'].includes(active.extension)?active:undefined);
    if(source){const leaf=await this.openNoteInSidebar(source);new Notice('选中文字后，从选区内按住拖到白板，即可创建摘录文本');return leaf;}
    new ReadingSourcePicker(this.app,file=>this.openExcerptNote(file)).open();
  }
  clearMaterialDrag(){for(const cancel of this.nativeDragCancels)cancel();this.materialDrag=undefined;this.materialFeedback?.();this.materialFeedback=undefined;for(const l of this.app.workspace.getLeavesOfType(VIEW))if(l.view instanceof BoardView)l.view.clearMaterialLanding();}
  async receiveMaterial(event:DragEvent,view:BoardView,position:{x:number;y:number}){const pending=this.materialDrag;const token=event.dataTransfer?.getData(MATERIAL_DRAG);this.clearMaterialDrag();if(!pending||pending.token!==token)return;await pending.run(view,position);}
  private localRelationsTargets=new Map<WorkspaceLeaf,{view:BoardView;owner:Session}>();
  private localRelationsSubscribers=new Map<WorkspaceLeaf,()=>void>();
  private localRelationsOpening=new WeakMap<Document,Promise<WorkspaceLeaf>>();
  private localRelationsRequests=new WeakMap<Document,number>();
  private localRelationsCompanions=new WeakMap<WorkspaceLeaf,{enabled:boolean;leaf?:WorkspaceLeaf;view?:ItemView;path?:string;sequence:number;queue:Promise<void>}>();
  private localRelationsHeadingPending=new WeakSet<TFile>();
  private localRelationsEdits=new WeakSet<Session>();
  private localRelationsEditor?:LocalRelationsEditorReturn;
  localRelationHeadingCache(file:TFile){return this.localRelationsHeadingPending.has(file)?null:this.app.metadataCache.getFileCache(file);}
  private localRelationsSaveTimer?:number;private localRelationsDirty=false;private localRelationsSaveQueue:Promise<void>=Promise.resolve();
  refreshLocalRelations(view?:BoardView){this.localRelationsEditor?.prune();for(const [leaf,notify]of this.localRelationsSubscribers)if(!view||this.localRelationsTargets.get(leaf)?.view===view)notify();}
  private flushLocalRelationsSettings(){
    if(!this.localRelationsDirty)return this.localRelationsSaveQueue;this.localRelationsDirty=false;
    const work=this.localRelationsSaveQueue.catch(()=>{}).then(()=>this.saveData(this.settings));this.localRelationsSaveQueue=work;void work.catch(error=>{this.localRelationsDirty=true;report(error);});return work;
  }
  private rememberLocalRelations(path:string,state:LocalRelationsSavedState){
    const next=rememberLocalRelationsState(this.settings.localRelations,path,state);if(JSON.stringify(next)===JSON.stringify(this.settings.localRelations))return;
    this.settings.localRelations=next;this.localRelationsDirty=true;
    if(this.localRelationsSaveTimer)window.clearTimeout(this.localRelationsSaveTimer);
    this.localRelationsSaveTimer=window.setTimeout(()=>{this.localRelationsSaveTimer=undefined;void this.flushLocalRelationsSettings();},180);
  }
  private localRelationsHost(leaf:WorkspaceLeaf):LocalRelationsHost {
    let headingSnapshot:{file?:TFile;path?:string;kind:Card['kind'];mtime?:number;cache:CachedMetadata|null;tree:ReturnType<typeof localHeadingTree>}|undefined;
    const context=()=>{const target=this.localRelationsTargets.get(leaf);return target&&!target.view.closed&&target.view.leaf.view===target.view&&target.view.session===target.owner&&target.view.file===target.owner.file&&this.app.vault.getAbstractFileByPath(target.owner.file.path)===target.owner.file?target:undefined;};
    const node=(id:string)=>{const target=context();return target&&{...target,node:target.owner.board.nodes.find(n=>n.id===id&&supportsLocalRelations(n))};};
    const editReason=(target:ReturnType<typeof context>,includeBusy=true)=>{
      if(!target)return '原白板已关闭或切换，请重新打开关系编辑';
      if(target.owner.blocked)return '白板写入已暂停，请先处理保存冲突或恢复草稿';
      if(includeBusy&&this.localRelationsEdits.has(target.owner))return '正在提交本板关系，请稍候';
      if(target.owner.convertingTexts.size||this.app.workspace.getLeavesOfType(VIEW).some(other=>other.view instanceof BoardView&&other.view.session===target.owner&&other.view.localRelationEditBusy))return '请先完成或取消本白板中的内容编辑、拖动或连线；草稿已保留';
    };
    const editing=(current:()=>boolean)=>{
      const target=context(),reason=editReason(target);if(reason||!target)throw Error(reason||'原白板不可编辑');
      const owner=target.owner,file=owner.file,path=file.path,graphView=leaf.view,doc=graphView.containerEl.ownerDocument,win=doc.defaultView,originDoc=target.view.containerEl.ownerDocument,originWindow=originDoc.defaultView;
      const validate=()=>{if(!current()||context()?.owner!==owner||context()?.view!==target.view||leaf.view!==graphView||!graphView.containerEl.isConnected||!graphView.containerEl.getClientRects().length||graphView.containerEl.ownerDocument!==doc||!win||win.closed||doc.defaultView!==win||!target.view.containerEl.isConnected||target.view.containerEl.ownerDocument!==originDoc||!originWindow||originWindow.closed||originDoc.defaultView!==originWindow||file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file)throw Error('关系编辑已取消或白板、窗口已变化；本次未提交');const unavailable=editReason(target,false);if(unavailable)throw Error(unavailable);};
      validate();return{owner,validate};
    };
    const companion=()=>{let value=this.localRelationsCompanions.get(leaf);if(!value){value={enabled:false,sequence:0,queue:Promise.resolve()};this.localRelationsCompanions.set(leaf,value);}return value;};
    return {
      snapshot:()=>{const target=context();return target?{board:target.owner.board,path:target.owner.file.path,name:target.owner.file.basename,key:target.owner.file,selectedId:target.view.localRelationSelectedId,originLeafId:workspaceLeafId(target.view.leaf)}:undefined;},
      loadState:path=>{const saved=this.settings.localRelations?.[path];return saved?cleanLocalRelationsState(saved):undefined;},
      saveState:(path,state)=>{const target=context();if(target?.owner.file.path===path)this.rememberLocalRelations(path,state);},
      relationEditing:()=>{const target=context(),reason=editReason(target);return{available:!reason,reason,canUndo:!reason&&!!target?.owner.history.undoStack.length,canRedo:!reason&&!!target?.owner.history.redoStack.length};},
      editRelation:async(command:LocalRelationMutation,current:()=>boolean):Promise<LocalRelationEditResult>=>{
        const {owner,validate}=editing(current),request=clone(command),newEdgeId=request.action==='create'?uid():undefined;this.localRelationsEdits.add(owner);this.refreshLocalRelations();
        try{
          await owner.flush();validate();const plan=planLocalRelationEdit(owner.board,request,newEdgeId);if(!plan.changed)return{changed:false,edgeId:plan.edgeId};
          // Only edge data changes. The existing Session owns validation, undo,
          // conflict detection and recovery; skip its optional reading reflow.
          validate();owner.change(board=>{const latest=planLocalRelationEdit(board,request,newEdgeId);board.edges=latest.board.edges;board.version=latest.board.version;},undefined,false,true,false,true,true);
          try{await owner.flush();}catch(error){throw new LocalRelationEditSaveError('本板关系已提交到内存，但保存失败；请保留恢复草稿。'+String(error));}
          if(owner.blocked)throw new LocalRelationEditSaveError('本板关系已进入白板撤销历史，但保存失败；白板已暂停写入，本地草稿保留。');
          return{changed:true,edgeId:plan.edgeId};
        }finally{this.localRelationsEdits.delete(owner);this.refreshLocalRelations();}
      },
      historyRelation:async(redo:boolean,current:()=>boolean):Promise<LocalRelationEditResult>=>{
        const {owner,validate}=editing(current),history=owner.history,stack=redo?history.redoStack:history.undoStack,count=stack.length,expected=stack.at(-1);if(expected===undefined)return{changed:false};
        this.localRelationsEdits.add(owner);this.refreshLocalRelations();
        try{
          await owner.flush();validate();const latest=redo?owner.history.redoStack:owner.history.undoStack;if(owner.history!==history||latest.length!==count||latest.at(-1)!==expected)throw Error('白板撤销历史已变化，请确认当前上一步后重试');
          owner.undo(redo);try{await owner.flush();}catch(error){throw new LocalRelationEditSaveError('白板历史操作已应用到内存，但保存失败；请保留恢复草稿。'+String(error));}
          if(owner.blocked)throw new LocalRelationEditSaveError('白板历史操作已应用，但保存失败；白板已暂停写入，本地草稿保留。');return{changed:true};
        }finally{this.localRelationsEdits.delete(owner);this.refreshLocalRelations();}
      },
      restoreContext:async(path,originLeafId,current)=>{
        if(!current())return false;const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile)||!isBoardFile(this.app,file))return false;
        const doc=leaf.view.containerEl.ownerDocument,candidates=this.app.workspace.getLeavesOfType(VIEW).filter(candidate=>candidate.view instanceof BoardView&&!candidate.view.closed&&candidate.view.file===file&&candidate.view.session?.file===file);
        const exact=originLeafId?candidates.find(candidate=>workspaceLeafId(candidate)===originLeafId):undefined,local=candidates.filter(candidate=>candidate.view.containerEl.ownerDocument===doc),match=exact||(local.length===1?local[0]:undefined);
        if(!current()||!match||!(match.view instanceof BoardView)||!match.view.session)return false;this.localRelationsTargets.set(leaf,{view:match.view,owner:match.view.session});return true;
      },
      subscribe:notify=>{const invalidate=()=>{headingSnapshot=undefined;notify();};this.localRelationsSubscribers.set(leaf,invalidate);const rename=this.app.vault.on('rename',invalidate),remove=this.app.vault.on('delete',invalidate);return()=>{headingSnapshot=undefined;const partner=this.localRelationsCompanions.get(leaf);if(partner){partner.enabled=false;partner.sequence++;}this.localRelationsCompanions.delete(leaf);this.localRelationsSubscribers.delete(leaf);this.localRelationsTargets.delete(leaf);this.app.vault.offref(rename);this.app.vault.offref(remove);};},
      source:id=>{const target=node(id),source=target?.node&&target.view.localRelationSource(target.node),canEdit=target?.node?.kind==='card'&&source?.file?.extension.toLowerCase()==='md'&&!target.node.locked;return source?{label:source.file?'来源':'来源缺失',path:source.path,available:!!source.file,canExplain:source.file?.extension==='md',canEdit,editReason:target?.node?.locked?'请先解锁卡片，再进入原生编辑模式':canEdit?'在原生笔记页编辑，自动保存；返回脑图不撤销修改':'仅有 Markdown 来源的笔记卡片支持编辑模式',reason:source.file?undefined:'来源文件已移动或删除，卡片内容仍保留'}:{label:'独立内容',available:false,canExplain:false,canEdit:false,reason:'此对象没有笔记来源'};},
      headings:id=>{const target=node(id),source=target?.node&&target.view.localRelationSource(target.node),file=source?.file,path=source?.path,kind=target?.node?.kind||'text',mtime=file?.stat.mtime,cache=file&&kind==='card'?this.localRelationHeadingCache(file):null;if(headingSnapshot&&headingSnapshot.file===file&&headingSnapshot.path===path&&headingSnapshot.kind===kind&&headingSnapshot.mtime===mtime&&headingSnapshot.cache===cache)return headingSnapshot.tree;const tree=localHeadingTree({kind,path,available:!!file,mtime,metadata:cache});headingSnapshot={file,path,kind,mtime,cache,tree};return tree;},
      native:id=>{const target=node(id);if(!target?.node)return {relations:[],tagsByNode:new Map(),pendingPaths:[]};return nativeLocalRelations(target.owner.board,id,{
        exists:path=>this.app.vault.getAbstractFileByPath(path) instanceof TFile,
        resolved:path=>this.app.metadataCache.resolvedLinks[path],
        cache:path=>{const file=this.app.vault.getAbstractFileByPath(path);return file instanceof TFile?this.app.metadataCache.getFileCache(file):null;},
        tags:path=>{const file=this.app.vault.getAbstractFileByPath(path);return file instanceof TFile?getAllTags(this.app.metadataCache.getFileCache(file)||{})||[]:[];},
        resolve:(link,sourcePath)=>{const parsed=parseLinktext(link),file=parsed.path?this.app.metadataCache.getFirstLinkpathDest(parsed.path,sourcePath):this.app.vault.getAbstractFileByPath(sourcePath);return file instanceof TFile?{path:file.path,subpath:parsed.subpath}:undefined;}
      });},
      activeSource:()=>{const target=context(),active=this.app.workspace.getActiveViewOfType(View)?.leaf;if(!target||!active||!(active.view instanceof MarkdownView)||active.view.containerEl.ownerDocument!==leaf.view.containerEl.ownerDocument)return {};const file=active.view.file;if(!file)return {};const ids=target.owner.board.nodes.filter(n=>supportsLocalRelations(n)&&target.view.localRelationSource(n)?.file===file).map(n=>n.id);return{ids,id:ids.length===1?ids[0]:undefined,ambiguous:ids.length>1};},
      companion:()=>{const value=companion(),available=!!value.leaf&&value.leaf.view===value.view&&value.leaf.view.containerEl.isConnected&&value.leaf.view.containerEl.ownerDocument===leaf.view.containerEl.ownerDocument&&value.leaf.getViewState().state?.file===value.path&&!value.leaf.getViewState().pinned;return{enabled:value.enabled,available};},
      setCompanion:enabled=>{const value=companion();value.enabled=enabled;value.sequence++;if(!enabled){value.leaf=undefined;value.view=undefined;value.path=undefined;}},
      syncSource:async(id,current)=>{const target=node(id),partner=companion();if(!current()||!target?.node||!partner.enabled)return;const source=target.view.localRelationSource(target.node);if(!source?.file||source.file.extension!=='md')return;
        const sequence=++partner.sequence,doc=leaf.view.containerEl.ownerDocument,path=source.file.path,valid=()=>current()&&context()?.owner===target.owner&&partner.enabled&&partner.sequence===sequence&&leaf.view.containerEl.ownerDocument===doc;
        const work=partner.queue.catch(()=>{}).then(async()=>{
          if(!valid())return;
          if(partner.leaf&&(partner.leaf.view!==partner.view||!partner.leaf.view.containerEl.isConnected||partner.leaf.view.containerEl.ownerDocument!==doc||partner.leaf.getViewState().state?.file!==partner.path||partner.leaf.getViewState().pinned)){partner.enabled=false;partner.leaf=undefined;throw Error('伙伴笔记页已关闭、移动、固定或被接管，联动已停止。');}
          if(partner.path===path)return;
          if(partner.leaf&&this.app.workspace.getActiveViewOfType(View)?.leaf===partner.leaf){partner.enabled=false;throw Error('正在使用伙伴笔记页，自动换文档已暂停。内容已保留，可回到脑图重新开启联动。');}
          target.view.assertLocalRelationSourceReady(id);
          const owned=partner.leaf||target.view.createLocalRelationLeaf(leaf,()=>valid()&&source.file?.path===path&&this.app.vault.getAbstractFileByPath(path)===source.file&&target.owner.board.nodes.some(n=>n.id===id&&supportsLocalRelations(n)&&target.view.localRelationSource(n)?.file===source.file),false);if(!partner.leaf){partner.leaf=owned;partner.view=owned.view as ItemView;partner.path=owned.getViewState().state?.file as string|undefined;}
          try{await target.view.openLocalRelationSource(id,valid,leaf,{activate:false,companion:owned,dedicated:true});}
          finally{if(partner.leaf===owned){if(owned.view.containerEl.isConnected&&owned.view.containerEl.ownerDocument===doc&&leaf.view.containerEl.ownerDocument===doc&&owned.getViewState().state?.file===path&&!owned.getViewState().pinned&&context()?.owner===target.owner&&this.app.vault.getAbstractFileByPath(path)===source.file){partner.view=owned.view as ItemView;partner.path=path;}else{partner.enabled=false;partner.leaf=undefined;}}}
        });partner.queue=work;await work;
      },
      returnToBoard:async current=>{const target=context();if(!current()||!target)return;await this.app.workspace.revealLeaf(target.view.leaf);if(current()&&context()?.owner===target.owner&&!target.view.closed&&target.view.leaf.view===target.view)this.app.workspace.setActiveLeaf(target.view.leaf,{focus:true});},
      locate:async(id,current)=>{const target=node(id);if(!current()||!target?.node)return;if(target.view.localRelationEditing)throw Error('请先结束当前卡片编辑，再定位关系对象');if(branchState(target.owner.board).hidden.has(id))throw Error('此对象在折叠分支内，请先展开分支');await this.app.workspace.revealLeaf(target.view.leaf);if(!current()||context()?.owner!==target.owner||target.view.leaf.view!==target.view)return;if(!target.owner.board.nodes.some(n=>n.id===id&&supportsLocalRelations(n))||target.view.localRelationEditing||branchState(target.owner.board).hidden.has(id))throw Error('对象或编辑状态已变化，请先在白板中确认');target.view.revealNode(id);},
      openSource:async(id,current)=>{const target=node(id);if(!current()||!target?.node)return;await target.view.openLocalRelationSource(id,(allowHidden=false)=>current(allowHidden)&&context()?.owner===target.owner,leaf);},
      editSource:async(id,current)=>{const target=node(id);if(!current()||!target?.node)return;await target.view.openLocalRelationSource(id,(allowHidden=false)=>current(allowHidden)&&context()?.owner===target.owner,leaf,{edit:true});},
      editCenter:async(id,current)=>{
        const target=node(id),graph=leaf.view,doc=graph.containerEl.ownerDocument,win=doc.defaultView;
        if(!current()||!target?.node)return;
        const source=target.view.localRelationSource(target.node),file=source?.file,path=file?.path;
        if(target.node.kind!=='card'||!file||file.extension.toLowerCase()!=='md')throw Error('编辑模式仅支持有 Markdown 来源的笔记卡片');
        if(target.node.locked)throw Error('请先解锁卡片，再进入原生编辑模式');
        const stamp=(value:ReturnType<BoardView['localRelationSource']>)=>value&&JSON.stringify([value.path,value.subpath,value.line,value.paragraph]),signature=stamp(source);
        const origin=()=>{const latest=node(id),resolved=latest?.node&&latest.view.localRelationSource(latest.node);return leaf.view===graph&&graph.containerEl.isConnected&&graph.containerEl.ownerDocument===doc&&doc.defaultView===win&&!!win&&!win.closed&&latest?.owner===target.owner&&latest.view===target.view&&latest.node?.kind==='card'&&!latest.node.locked&&resolved?.file===file&&file.path===path&&this.app.vault.getAbstractFileByPath(file.path)===file&&stamp(resolved)===signature;};
        const partner=companion(),sequence=partner.sequence+1;
        const valid=(allowHidden=false)=>current(allowHidden)&&origin()&&!partner.enabled&&partner.sequence===sequence;
        const active=this.app.workspace.getActiveViewOfType(View);if(active&&active!==graph)return;
        target.view.assertLocalRelationSourceReady(id);
        // Stop automatic document replacement before handing this file to its
        // native editor. Drain an already-started companion open before reuse.
        partner.enabled=false;partner.sequence=sequence;this.refreshLocalRelations();
        let focusLeft=false;const focusWatch=this.app.workspace.on('active-leaf-change',()=>{const selected=this.app.workspace.getActiveViewOfType(View);if(selected&&selected!==graph)focusLeft=true;});
        try{await partner.queue.catch(()=>{});}finally{this.app.workspace.offref(focusWatch);}
        const afterDrain=this.app.workspace.getActiveViewOfType(View);if(focusLeft||afterDrain&&afterDrain!==graph||!valid())return;target.view.assertLocalRelationSourceReady(id);
        // Release this native page from future companion ownership. Explicitly
        // enabling following again must create a new partner, not retarget it.
        partner.leaf=undefined;partner.view=undefined;partner.path=undefined;
        const opened=await target.view.openLocalRelationSource(id,valid,leaf,{edit:true});
        if(!opened||!valid(true)||!(opened.view instanceof MarkdownView)||opened.view.file!==file)return;
        const controls=this.localRelationsEditor??=this.addChild(new LocalRelationsEditorReturn(this.app));
        controls.attach(graph,opened,file,origin);
      },
      openHeading:async(id,heading,current)=>{const target=node(id);if(!current()||target?.node?.kind!=='card')return;await target.view.openLocalRelationSource(id,(allowHidden=false)=>current(allowHidden)&&context()?.owner===target.owner,leaf,{heading});},
      openEvidence:async(evidence,current)=>{const target=context();if(!target||!current())return;await target.view.openLocalRelationEvidence(evidence,(allowHidden=false)=>current(allowHidden)&&context()?.owner===target.owner,leaf);},
      explain:(id,current)=>{const target=node(id),source=target?.node&&target.view.localRelationSource(target.node);if(current()&&source?.file?.extension==='md')this.openNativeRelations(source.file);}
    };
  }
  async openLocalRelations(view:BoardView,id?:string){
    const owner=view.session,doc=view.contentEl.ownerDocument;if(!owner||view.closed||!view.file)throw Error('白板已关闭，请重新打开');
    const center=id?owner.board.nodes.find(n=>n.id===id&&supportsLocalRelations(n)):owner.board.nodes.find(n=>n.id===view.localRelationSelectedId&&supportsLocalRelations(n))||owner.board.nodes.find(supportsLocalRelations);if(!center)throw Error('独立关系浏览支持笔记卡片、子白板和分组；独立文本不参与');
    const request=(this.localRelationsRequests.get(doc)||0)+1;this.localRelationsRequests.set(doc,request);
    const current=()=>this.localRelationsRequests.get(doc)===request&&this.app.vault.getAbstractFileByPath(owner.file.path)===owner.file&&view.contentEl.ownerDocument===doc&&!view.closed&&view.leaf.view===view&&view.session===owner&&view.file===owner.file;
    let leaf=this.app.workspace.getLeavesOfType(LOCAL_RELATIONS_VIEW).find(l=>l.view.containerEl.ownerDocument===doc);
    if(!leaf){let opening=this.localRelationsOpening.get(doc);if(!opening){opening=(async()=>{this.app.workspace.setActiveLeaf(view.leaf,{focus:false});const created=this.app.workspace.getLeaf('tab');if(created.view.containerEl.ownerDocument!==doc){created.detach();throw Error('无法在当前窗口打开独立关系浏览');}await created.setViewState({type:LOCAL_RELATIONS_VIEW,active:false});return created;})();this.localRelationsOpening.set(doc,opening);}try{leaf=await opening;}finally{if(this.localRelationsOpening.get(doc)===opening)this.localRelationsOpening.delete(doc);}}
    if(!current())return;await leaf.loadIfDeferred();if(!current()||leaf.view.containerEl.ownerDocument!==doc||!(leaf.view instanceof LocalRelationsView))return;
    const brain=leaf.view;this.localRelationsTargets.set(leaf,{view,owner});brain.setContext(id);
    await this.app.workspace.revealLeaf(leaf);if(current()&&leaf.view===brain&&brain.containerEl.ownerDocument===doc){this.app.workspace.setActiveLeaf(leaf,{focus:true});brain.refresh();return brain;}
  }
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
  openNoteInSidebar(file:TFile,subpath?:string,editing=false,reading=false):Promise<WorkspaceLeaf>{
    const work=this.noteQueue.catch(()=>{}).then(async()=>{
      if(this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('笔记已移动或删除，请刷新后重试');
      // Finish an inline draft before another view starts editing the same file.
      for(const board of this.app.workspace.getLeavesOfType(VIEW))if(board.view instanceof BoardView)await board.view.prepareNoteOpen(file);
      const right=(l:WorkspaceLeaf)=>!!l.view.containerEl.closest('.mod-right-split');
      let leaf=this.app.workspace.getLeavesOfType(isPdfFile(file.path)?'pdf':'markdown').find(l=>right(l)&&l.getViewState().state?.file===file.path);
      if(!leaf&&this.settings.notePaneLeafId){const existing=this.app.workspace.getLeafById(this.settings.notePaneLeafId);if(existing&&right(existing)&&['markdown','pdf'].includes(existing.getViewState().type)&&!existing.getViewState().pinned)leaf=existing;}
      if(!leaf){const created=this.app.workspace.getRightLeaf(false);if(!created)throw new Error('无法创建右侧笔记面板');leaf=created;}
      const same=leaf.getViewState().state?.file===file.path,mode=editing?'source':reading?'preview':undefined;
      if(!same)await leaf.openFile(file,{state:mode?{mode}:undefined,eState:subpath?{subpath}:undefined});
      else {
        if(leaf.isDeferred)await leaf.loadIfDeferred();
        if(mode&&leaf.view instanceof MarkdownView&&leaf.view.getMode()!==mode)await leaf.setViewState({...leaf.getViewState(),state:{...leaf.view.getState(),mode}});
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

  private referenceJournalQueue:Promise<void>=Promise.resolve();
  private referenceJournalDirty=false;
  private editReferenceJournal(edit:(operations:readonly PendingBoardReference[])=>PendingBoardReference[],retainOnFailure=false):Promise<void>{
    const next=this.referenceJournalQueue.catch(()=>{}).then(async()=>{const previous=this.settings.pendingBoardReferences,previousDirty=this.referenceJournalDirty,value=edit(previous||[]);if(!previousDirty&&JSON.stringify(value)===JSON.stringify(previous||[]))return;this.settings.pendingBoardReferences=value;try{await this.saveData(this.settings);this.referenceJournalDirty=false;}catch(error){if(!retainOnFailure&&this.settings.pendingBoardReferences===value){this.settings.pendingBoardReferences=previous;this.referenceJournalDirty=previousDirty;}else this.referenceJournalDirty=true;throw error;}});
    this.referenceJournalQueue=next.catch(()=>{});return next;
  }
  private nativeReferenceRuns=new Map<TFile,Promise<void>>();
  private nativeReferenceNotices=new Set<TFile>();
  private async deferBoardReference(file:TFile,oldPath:string,snapshot:ReturnType<typeof captureBoardReferenceRename<TFile>>,boardPath:string){
    try{await this.editReferenceJournal(operations=>appendPendingBoardReference(operations,{id:uid(),board:file.path,oldPath,newPath:snapshot.newPath,boardPath,paths:snapshot.files.map(entry=>entry.path)}),true);}catch(error){throw Error(`来源改名等待记录保存失败：${file.path}。原布局保留；当前内存可重试，但重启恢复尚未确认。${error instanceof Error?error.message:String(error)}`);}
    if(!this.nativeReferenceNotices.has(file)){this.nativeReferenceNotices.add(file);new Notice(`来源已改名；${file.path} 的布局引用将在保存并关闭原生 Markdown 页后更新。等待记录已保存，原关系保留。`,10000);}
  }
  private async flushPendingBoardReferences(file:TFile){
    const running=this.nativeReferenceRuns.get(file);if(running)return running;
    if(this.nativeBoardTransitions.has(file)||hasNativeBoardEditor(this.app,file))return;
    const operations=(this.settings.pendingBoardReferences||[]).filter(operation=>operation.board===file.path);if(!operations.length)return;
    this.nativeBoardTransitions.add(file);
    const work=(async()=>{
      try{
        let count=0;for(;;){const operation=(this.settings.pendingBoardReferences||[]).find(entry=>entry.board===file.path);if(!operation)break;if(++count>1000)throw Error('来源连续改名过多，等待记录保留，请稍后重试');
          if(this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('待更新引用的白板已删除或替换，记录保留');
          await this.app.vault.process(file,raw=>{
            if(this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('待更新引用的白板已变化，原文件保留');assertBoardEditorOwnership(this.app,file);
            const document=readBoardDocument(raw,file.extension,parseYaml),draft=createBoardReferenceRenamer(operation.oldPath,operation.newPath,operation.paths)(document.board,operation.boardPath);
            return draft?replaceBoardDocumentLayout(raw,document,draft,parseYaml).source:raw;
          });
          await this.editReferenceJournal(current=>removePendingBoardReference(current,operation.id));
        }
        this.nativeReferenceNotices.delete(file);
      }finally{this.nativeBoardTransitions.delete(file);}
    })();this.nativeReferenceRuns.set(file,work);
    try{await work;}finally{if(this.nativeReferenceRuns.get(file)===work)this.nativeReferenceRuns.delete(file);const loaded=this.sessions.get(file);if(loaded)await(await loaded).externalUpdate();}
  }
  private async retryPendingBoardReferences(){
    await this.referenceQueue.catch(()=>{});
    for(const path of new Set((this.settings.pendingBoardReferences||[]).map(operation=>operation.board))){const file=this.app.vault.getAbstractFileByPath(path);if(file instanceof TFile&&isWorkspaceFile(file)&&isBoardPath(file.path))try{await this.flushPendingBoardReferences(file);}catch(error){report(error);}}
  }
  async renameReferences(file: TAbstractFile, oldPath: string,snapshot=captureBoardReferenceRename(file.path,this.app.vault.getFiles())) {
    // 自定义扩展名不会被 Obsidian 的双链重命名机制自动更新，因此显式迁移引用。
    const rename=createBoardReferenceRenamer(oldPath,snapshot.newPath,snapshot.files.map(entry=>entry.path));
    for (const entry of snapshot.files.filter(entry=>isWorkspaceFile(entry)&&isBoardPath(entry.path))) {
      const f=entry.file,active=()=>isBoardFile(this.app,f)&&this.app.vault.getAbstractFileByPath(f.path)===f;
      if(!active())continue;
      const loaded = this.sessions.get(f);
      try {
        if(f.extension.toLowerCase()==='md'&&(this.nativeBoardTransitions.has(f)||hasNativeBoardEditor(this.app,f)||loaded&&(await loaded).nativeEditingPaused||(this.settings.pendingBoardReferences||[]).some(operation=>operation.board===f.path)||this.nativeReferenceRuns.has(f))){await this.deferBoardReference(f,oldPath,snapshot,entry.path);continue;}
        if (loaded) { const s = await loaded;if(!active())continue;const draft=rename(s.board,entry.path); if (draft) { if (s.blocked) throw new Error(`引用白板已暂停写入：${f.path}`); s.change(b=>Object.assign(b,draft)); s.history = new History(); await s.flush(); } }
        else await this.app.vault.process(f, raw => { if(!active())throw Error('引用白板已移动或删除，未修改');const document=readBoardDocument(raw,f.extension,parseYaml),draft=rename(document.board,entry.path);if(!draft)return raw;if(document.format==='markdown')assertBoardEditorOwnership(this.app,f);return replaceBoardDocumentLayout(raw,document,draft,parseYaml).source; });
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
      b.nodes.push(applyDefaultCardStyle({id:uid(),kind:'card',transparent:true,file:f.path,x:88+cols.indexOf(status)*370,y:105+(i%2)*300,width:310,height:245,color:status==='done'?'green':status==='active'?'blue':'sand'},this.settings.defaultCardStyle));
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
    for (const [title, content, color, x, y] of specs) { const f = await this.createUnique(this.settings.cardFolder, title, 'md', content); b.nodes.push(applyDefaultCardStyle({ id: uid(), kind:'card',transparent:true, file: f.path, x, y, width: 300, height: 270, color },this.settings.defaultCardStyle)); }
    const cards = b.nodes.filter(n => n.kind === 'card');
    b.edges = [[0, 1, '寻找证据'], [1, 2, '提炼观点'], [2, 3, '形成解释']].map(([a, z, label]) => ({ id: uid(), from: cards[Number(a)].id, to: cards[Number(z)].id, label: String(label) }));
    b.viewport = { x: 20, y: 15, zoom: .75 };
    await this.openBoard(await this.createUnique(`${ROOT}/白板`, '开始你的思维地图', EXT, JSON.stringify(b, null, 2)), true);
  }
  async nestedDemo() {
    const note = async (title: string, text: string, x: number, color: Card['color'] = 'sand'): Promise<Card> => {
      const f = await this.createUnique(this.settings.cardFolder, title, 'md', `# ${title}\n\n${text}`);
      return applyDefaultCardStyle({ id: uid(), kind:'card',transparent:true, file: f.path, x, y: 45, width: 315, height: 265, color },this.settings.defaultCardStyle);
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
      button(card,'使用 '+t.name,'arrow-up-right',()=>this.plugin.promptTemplateBoard(t.id,t.name,()=>this.close()),'ts-template-use');
    }
  }
  onClose(){this.contentEl.empty();}
}
/** 原生侧栏只承载当前白板自己的导航 DOM，避免多个白板的操作目标混淆。 */
class NavigatorView extends ItemView {
  private host!:HTMLElement;private bound?:BoardView;private createMenu?:Menu;
  constructor(leaf:WorkspaceLeaf,private plugin:ThoughtSpace){super(leaf);}
  getViewType(){return DOCK;}getDisplayText(){return 'ThoughtSpace';}getIcon(){return 'network';}
  async onOpen(){
    this.contentEl.empty();this.contentEl.addClass('ts-root','ts-dock');
    const body=this.contentEl.createDiv('ts-dock-body'),launchpad=body.createEl('header',{cls:'ts-dock-launchpad',attr:{'aria-label':'知识空间入口'}}),quick=launchpad.createDiv('ts-dock-quick');button(quick,'收集笔记','plus',()=>this.plugin.quickCapture(),'ts-primary');
    const create=button(quick,'新建','chevron-down',()=>{this.createMenu?.hide();const menu=this.createMenu=new Menu().setUseNativeMenu(false);menu.addItem(i=>i.setTitle('新建白板或脑图…').setIcon('panels-top-left').onClick(()=>this.plugin.promptNewBoard()));menu.addItem(i=>i.setTitle('从模板新建').setIcon('layout-template').onClick(()=>new TemplatePicker(this.app,this.plugin).open()));create.setAttribute('aria-expanded','true');menu.onHide(()=>{if(this.createMenu===menu){this.createMenu=undefined;create.setAttribute('aria-expanded','false');}});const rect=create.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom+4});},'ts-dock-create');create.setAttribute('aria-label','新建白板或使用模板');create.setAttribute('aria-haspopup','menu');create.setAttribute('aria-expanded','false');
    const entry=launchpad.createDiv({cls:'ts-dock-shortcuts',attr:{role:'navigation','aria-label':'知识空间快捷入口'}});button(entry,'空间总览','compass',()=>this.plugin.openSpaceHub());const excerpt=button(entry,'笔记摘录','notebook-pen',()=>this.plugin.openExcerptNote());excerpt.setAttribute('aria-label','打开笔记摘录');excerpt.title='打开笔记摘录';
    this.host=body.createDiv('ts-dock-host');
    const tools=this.contentEl.createDiv({cls:'ts-dock-workspace-tools',attr:{role:'group','aria-label':'当前白板工具'}});
    const tidy=button(tools,'整理白板','layout-dashboard',()=>this.plugin.openBoardOrganizer(this.bound&&!this.bound.closed?this.bound:null),'ts-dock-organize-button');tidy.title='整理当前白板 · 选择布局，预览后应用';
    const preview=button(tools,'分组预览','panels-top-left',()=>this.plugin.openSectionCatalog(this.bound&&!this.bound.closed?this.bound:null),'ts-dock-organize-button ts-dock-section-preview');preview.title='分组预览 · 搜索、查看缩略图并定位分组';
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
    const empty=this.host.createDiv('ts-dock-welcome');empty.createEl('h3',{text:'最近的白板'});empty.createEl('p',{text:'选择白板，查看其中的卡片、任务与大纲。'});
    const boards=this.plugin.app.vault.getFiles().filter(isWorkspaceFile).filter(f=>isBoardFile(this.app,f)).sort((a,b)=>Number(this.plugin.settings.favoriteBoards.includes(b.path))-Number(this.plugin.settings.favoriteBoards.includes(a.path))||b.stat.mtime-a.stat.mtime);
    for(const file of boards.slice(0,30))button(empty,file.basename,this.plugin.settings.favoriteBoards.includes(file.path)?'star':'panels-top-left',()=>this.plugin.openBoard(file),'ts-dock-board-link');
    if(!boards.length)button(empty,'选择入门模板','layout-template',()=>new TemplatePicker(this.app,this.plugin).open(),'ts-primary');
  }
  async onClose(){this.createMenu?.hide();this.createMenu=undefined;this.bound=undefined;this.host?.empty();}
}

class MaterialsView extends ItemView {
 workbench?:MaterialsWorkbench;
 constructor(leaf:WorkspaceLeaf,private plugin:ThoughtSpace){super(leaf);}
 getViewType(){return MATERIALS;}getDisplayText(){return '材料工作台';}getIcon(){return 'notebook-pen';}
 applyPreferences(){applyWorkspaceDensity(this.contentEl,this.plugin.settings.density);}
 async onOpen(){this.applyPreferences();this.contentEl.empty();const title=this.contentEl.createEl('h2',{cls:'ts-materials-panel-title'}),body=this.contentEl.createDiv('ts-materials-panel-content');this.workbench=new MaterialsWorkbench(this.app,this.plugin.materialAdapter(),this.contentEl,body,title,()=>this.leaf.detach());this.workbench.onOpen();this.applyPreferences();}
 async onClose(){this.plugin.clearMaterialDrag();this.workbench?.onClose();this.workbench=undefined;this.contentEl.empty();}
}

class BoardView extends FileView {
  session?: Session; private unsubscribe?: () => void;private nativePropertiesAction?:HTMLElement;
  private snapToggle?:HTMLButtonElement;private gridSelect?:HTMLSelectElement;private canvasControls?:HTMLElement;private canvasSummary?:HTMLElement;private focusSelectedButton?:HTMLButtonElement;private overviewToggle?:HTMLButtonElement;private snapTarget?:HTMLElement;private snapReadout?:HTMLElement;
  private stage!: HTMLElement; private world!: HTMLElement; private svg!: SVGSVGElement;
  sidebar!: HTMLElement; closed=false; private closing=false; private dockContext?:HTMLElement; private list!: HTMLElement; private status!: HTMLElement; private inspector!: HTMLElement; private zoomLabel!: HTMLElement;
  private mediaStates=new Map<string,MediaCardState>();
  private mediaIdentities=new Map<string,string>();
  private mediaPlayers=new Map<string,MediaCardHandle>();
  private onlineBoardPlayers=new Map<string,OnlineBoardPlayerHandle>();
  private onlineBoardStates=new Map<string,{source:string;time:number}>();
  private boardMindmaps=new Map<string,BoardMindmapView>();
  private brainBoardView?:BrainBoardView;
  private brainNativeRevision=0;
  private brainBoardOwner?:Session;
  private brainBoardEl?:HTMLElement;
  private brainBoardDialog?:Modal;
  private canvasBackgroundDialog?:Modal;
  private brainObjectEpoch=0;
  private brainRelationCreating=false;
  private mindmapFileIds=new WeakMap<TFile,number>();private mindmapFileSequence=0;
  private nodeScopes=new Map<string,Component>(); private nodeKeys=new Map<string,string>(); private previewQueue=new RenderQueue(); private pdfPreviewQueue=new RenderQueue(2); private renderFrame=0; private viewportOnlyRender=true; private mapKey=''; private mapViewport?:()=>void; private mapRefresh?:(board:Board)=>boolean; private connectSide?:Side; private selected = new Set<string>(); private selectedEdge?: string;
  private batchFormatTarget:'nodes'|'edges'='nodes';private batchEdgeScope:SelectionEdgeScope='internal';
  private mode: 'select' | 'connect' = 'select'; private connectFrom?: string; private connectButton?: HTMLButtonElement;
  private tab: 'library' | 'boards' | 'tasks' | 'outline' = 'boards'; private query = '';private sidebarQueries=new Map<string,string>(); private tag = ''; private sidebarRun = 0;private sidebarContentKey='';
  private boardScope:'spaces'|'favorites'='spaces';private boardSort:'title'|'updated'='title';
  private taskFilter:TaskFilter='all';private outlineKind:OutlineKind='all';private outlineCollapsed=new Set<string>();private startScreen?:HTMLElement;private savedViewsModal?:SavedViewsModal;private dialogEpoch=0;private groupOrganizer?:GroupOrganizerModal;private layoutPlannerModal?:LayoutPlannerModal;
  private favoriteButton?:HTMLElement;private mindmapButton?:HTMLElement;private mindmapTools?:HTMLElement;private inlineAppearance=false;private appearanceExpanded=false;private appearanceTab:'card'|'text'|'fill'|'border'='card';private canvasMenu?:Menu;
  private taskScope: 'board' | 'vault' = 'board'; private sidebarTimer?: number;
  private libraryScope: LibraryScope = 'vault'; private librarySort: LibrarySort = 'updated';
  private selectionTool = false; private selectionButton?: HTMLButtonElement;
  private sectionTool=false; private sectionButton?:HTMLButtonElement; private sectionHint?:HTMLElement;
  private marquee?: {id:number;start:{x:number;y:number};base:Set<string>;baseEdge?:string;box:HTMLElement;section?:boolean;rect?:SectionRect;};
  private rightMarquee?:{id:number;x:number;y:number;start:{x:number;y:number};event:PointerEvent;menu?:MouseEvent;owner:Session;moved:boolean;crossedThreshold?:boolean;additive:boolean;action:'pan'|'select';viewport:Board['viewport']};
  private suppressBoardContext=false;
  private suppressMiddlePaste=false;
  private focusMode = false; private focusButton?: HTMLElement;
  private trail: TFile[] = []; private crumbs!: HTMLElement; private boardStats!: HTMLElement;
  private minimapAvoidance=new MinimapAvoidance();private minimapObstacle?:ScreenBox;
  private minimap!: HTMLElement; private collapsedBoards = new Set<string>();
  private navigationQueue: Promise<void> = Promise.resolve();
  private controlStageSize?:{width:number;height:number};
  private cardToolbarReserve=60;
  private cardToolbarObstacles:{x:number;y:number;width:number;height:number}[]=[];
  private positions = new Map<string, HTMLElement>(); private space = false; private dragging = false;
  private endpointPorts=new Map<Element,string>();private edgeLayer?:EdgeLayer;private pointerFrame=0;private pendingPointer?:PointerEvent;
  private linkDrag?:{id:number;x:number;y:number;moved:boolean;owner:Session;topicClick?:boolean;edge?:{id:string;end:'from'|'to';expected:string;index?:number}};
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
  private gesture?: { draft:Map<string,Card>;targets:DragTarget[];alignmentReady?:boolean;lockedAxis?:'x'|'y';alignment?:AlignmentIndex;guides?:Guide[];originals:Map<string,Card>;idSet:Set<string>; id: number; x: number; y: number; before: Board; ids: string[]; pan: boolean; clearSelectionOnClick?:boolean;deselectOnClick?:string;crossedThreshold?:boolean;resize?: string;resizeEdge?:SectionResizeEdge };
  private inspectorChoiceState?:{title:string;choices:{label:string;checked?:boolean;swatch?:string;run:()=>unknown}[];grid:boolean;owner:Session|undefined;key:string};
  private selectionTools?:HTMLElement;
  private selectionHeading?:HTMLElement;
  private selectionFormatCache?:{host:HTMLElement;owner:Session|undefined;editor:InlineNodeEditor|undefined;key:string};
  private topicAdding=false;
  private inlineLayout?:Board;private inlineGeometry?:InlineGeometry;private inline?:InlineNodeEditor;private inlineId?:string;private inlineTarget?:string;private inlineStart=0;private inlineExit?:Promise<void>;private inlineStyleKey='';private inlineMeasureKey='';private nodeFitQueue=new LayoutRefreshQueue(()=>act(()=>this.flushNodeFits()));
  private previewMetricsReady=false;
  private deferredCardFits=new Set<string>();
  private automaticGeometryDeferred=false;
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
    const kind=controls.createEl('select',{attr:{'aria-label':'对象类型'}});for(const [value,text]of Object.entries({'':'全部类型',card:'笔记卡片',text:'文本',image:'图片',pdf:'PDF',audio:'音频',video:'视频',board:'子白板',section:'分组'}))kind.createEl('option',{value,text});kind.value=draft.kind;kind.onchange=()=>draft.kind=kind.value;
    const color=controls.createEl('select',{attr:{'aria-label':'对象颜色'}});color.createEl('option',{value:'',text:'全部颜色'});for(const value of colors)color.createEl('option',{value,text:colorNames[value]});color.value=draft.color;color.onchange=()=>draft.color=color.value;
    button(m.contentEl,'应用筛选','filter',()=>{this.requireOwner(owner);this.objectFilter=draft;this.renderBoard();m.close();});button(m.contentEl,'清除筛选','x',()=>{this.requireOwner(owner);this.objectFilter={kind:'',color:'',query:''};this.renderBoard();m.close();});m.open();}
  private updateObjectFilter(){if(!this.session)return;const active=Object.values(this.objectFilter).some(Boolean);this.filterMatches=active?filterObjects(this.session.board.nodes,this.objectFilter):undefined;this.filterBadge?.toggleClass('is-visible',active);if(this.filterBadge){this.filterBadge.empty();if(active){this.filterBadge.createSpan({text:`匹配 ${this.filterMatches!.size} / ${this.session.board.nodes.length}`});button(this.filterBadge,'选择匹配','check-check',()=>{this.selected=new Set(this.filterMatches);this.contextOpen=false;this.updateSelection();});button(this.filterBadge,'清除对象筛选','x',()=>{this.objectFilter={kind:'',color:'',query:''};this.renderBoard();});}}for(const[id,el]of this.positions)el.toggleClass('is-filtered-out',!!this.filterMatches&&!this.filterMatches.has(id));}
  pasteTexts(text:string,split=true){const owner=this.requireOwner(),position=this.point(),lines=split?textBatch(text):[text];if(!text.trim())return;if(text.length>100000)throw Error('一次最多粘贴 100,000 个字符');const nodes=lines.map((text,i)=>{const n:Card={id:uid(),kind:'text',text,x:position.x,y:position.y,width:240,height:60,color:'sand',fontSize:this.plugin.settings.defaultTextSize};fitTextNode(n,this.contentEl);return n;});let y=position.y;for(const n of nodes){n.y=y;y+=n.height+24;}owner.change(b=>{b.version=3;b.nodes.push(...nodes);});this.selected=new Set(nodes.map(n=>n.id));this.updateSelection();}
  private pdfQuotePrompt(initial=''){
    const owner=this.requireOwner();
    const plan=(text:string,source:string)=>{this.requireOwner(owner);if(source&&!(this.app.vault.getAbstractFileByPath(source) instanceof TFile&&/\.md$/i.test(source)))throw Error('来源笔记不存在，请填写完整的仓库内 Markdown 路径');const files=this.app.vault.getFiles().map(file=>file.path);return planPdfQuote(text,source,(path,context)=>resolvePdfQuotePath(path,context,files,(value,from)=>this.app.metadataCache.getFirstLinkpathDest(value,from)?.path));};
    new PdfQuoteModal(this.app,initial,plan,value=>{this.requireOwner(owner);this.importPdfQuote(value);}).open();
  }
  private importPdfQuote(plan:PdfQuotePlan){
    const owner=this.requireOwner(),existing=owner.board.nodes.find(node=>node.kind==='text'&&samePdfQuote(node,plan));
    if(existing){this.selected=new Set([existing.id]);this.updateSelection();this.focusSelection();new Notice('这条摘录已在白板中，已定位到原卡片');return;}
    const position=this.point(),node:Card={id:uid(),kind:'text',text:plan.text,pdfQuote:plan.origin,textAutoHeight:true,x:position.x,y:position.y,width:320,height:180,color:'sand',fontSize:this.plugin.settings.defaultTextSize};fitTextNode(node,this.contentEl);
    owner.change(board=>{board.version=3;board.nodes.push(node);});this.selected=new Set([node.id]);this.updateSelection();
  }
  private textBatchPrompt(){const owner=this.session;new TextModal(this.app,'逐行创建文本框','',text=>{this.requireOwner(owner);this.pasteTexts(text);}).open();}
  private async linkedText(){const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);const parent=owner.board.nodes.find(n=>this.selected.has(n.id)&&n.kind!=='section');if(!parent)return;const id=uid();owner.change(b=>{b.version=3;const n:Card={id,kind:'text',text:'',x:parent.x+parent.width+90,y:parent.y,width:280,height:140,color:parent.color,fontSize:this.plugin.settings.defaultTextSize};b.nodes.push(n);b.edges.push({id:uid(),from:parent.id,to:id,label:'',style:this.plugin.settings.defaultEdgeStyle,direction:this.plugin.settings.defaultEdgeDirection});});await this.startInlineEdit(id,false,true);}
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
  async appendCardEvidence(id:string,evidence:string,owner=this.requireOwner(),validateSource=()=>{}):Promise<MaterialImportResult>{
    const node=owner.board.nodes.find(n=>n.id===id),path=node?.file,file=path&&this.app.vault.getAbstractFileByPath(path);
    if(!node||node.kind!=='card'||node.locked||!(file instanceof TFile))throw Error('目标卡片已锁定、移除或来源不存在');
    const validate=()=>{this.requireOwner(owner);validateSource();const current=owner.board.nodes.find(n=>n.id===id);if(!current||current.kind!=='card'||current.locked||current.file!==path||file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file)throw Error('目标卡片已变化，未追加证据');};
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
    ensure();if(position.targetId)return this.appendCardEvidence(position.targetId,pdfLiteralText(text.trim())+'\n\n'+citation,owner,ensure);return this.placeExcerptTexts([text.trim()+'\n\n> '+citation],position,owner,'purple');
  }
  private async placeExcerptTexts(texts:string[],position:{x:number;y:number},owner:Session,color:Card['color']='sand'):Promise<MaterialImportResult>{
    this.requireOwner(owner);let y=position.y;const nodes=texts.map(text=>{const n:Card={id:uid(),kind:'text',text,x:position.x,y,width:240,height:60,color,fontSize:this.plugin.settings.defaultTextSize,autoSize:true,review:'later'};fitTextNode(n,this.contentEl);y+=n.height+24;return n;});
    owner.change(b=>{b.version=3;b.nodes.push(...nodes);});this.selected=new Set(nodes.map(n=>n.id));this.contextOpen=false;this.updateSelection();this.renderBoard();await owner.flush();return{ids:nodes.map(n=>n.id),files:[],boardPath:owner.file.path};
  }
  async importExcerpts(source:TFile,raw:string,fragments:Fragment[],group=true,link=true,owner=this.session,options:MaterialImportOptions={}):Promise<MaterialImportResult>{
    this.requireOwner(owner);if(!fragments.length||fragments.length>200)throw Error('请选择 1–200 个片段');
    const sourcePath=source.path,sourceStamp={mtime:source.stat.mtime,size:source.stat.size},validateSource=()=>{this.requireOwner(owner);if(source.path!==sourcePath||this.app.vault.getAbstractFileByPath(sourcePath)!==source||source.stat.mtime!==sourceStamp.mtime||source.stat.size!==sourceStamp.size)throw Error('原文已变化或移动，请刷新材料后重新选择');};
    validateSource();const currentRaw=await this.app.vault.read(source);validateSource();if(currentRaw.replace(/\r\n?/g,'\n')!==raw.replace(/\r\n?/g,'\n'))throw Error('原文已变化，请刷新材料后重新选择');
    this.requireOwner(owner);const existingGroup=group&&options.groupId?owner!.board.nodes.find(n=>n.kind==='section'&&n.id===options.groupId):undefined;if(existingGroup?.locked)throw Error('摘录分组已锁定，请解锁或取消汇入分组');
    const point=options.position?{...options.position}:this.materialPoint(),created:TFile[]=[],nodes:Card[]=[];const width=this.plugin.settings.defaultCardWidth;if(link&&!options.position&&!existingGroup&&!owner!.board.nodes.some(n=>n.kind==='card'&&n.file===source.path))point.x+=width+96;if(existingGroup&&!options.position){const members=owner!.board.nodes.filter(n=>contained(existingGroup,n));point.x=existingGroup.x+30;point.y=Math.max(existingGroup.y+60,...members.map(n=>n.y+n.height+40));}
    const targetNode=options.position?.targetId?owner!.board.nodes.find(n=>n.id===options.position!.targetId):undefined;const destination=targetNode?.file||`${this.plugin.settings.cardFolder}/摘录.md`;
    const cache=this.app.metadataCache.getFileCache(source);if(!cache)throw Error('笔记索引尚未就绪，请稍后刷新材料');
    const references=[...(cache.links||[]),...(cache.embeds||[])].flatMap(ref=>{const parts=parseLinktext(ref.link),target=parts.path?this.app.metadataCache.getFirstLinkpathDest(parts.path,source.path):source;if(!(target instanceof TFile))return [];let replacement=this.app.fileManager.generateMarkdownLink(target,destination,parts.subpath,ref.displayText);if(ref.original.startsWith('!')&&!replacement.startsWith('!'))replacement='!'+replacement;return [{original:ref.original,replacement,start:ref.position.start,end:ref.position.end}];});
    const rebase=createFragmentRebaser(raw,references),prepared=fragments.map(f=>({...f,body:rebase(f)}));
    if(options.position?.targetId){const sourceLink=this.app.fileManager.generateMarkdownLink(source,destination);const documents=excerptDocuments(prepared,sourceLink,options);return this.appendCardEvidence(options.position.targetId,documents.map(d=>d.body.replace(/^# [^\n]*\n\n/,'')).join('\n\n'),this.requireOwner(owner),validateSource);}
    if(options.asText){const documents=excerptDocuments(prepared,`[[${source.path}]]`,options);return this.placeExcerptTexts(documents.map(d=>d.body.replace(/^# [^\n]*\n\n/,'')),point,this.requireOwner(owner));}
    const sourceLink=this.app.fileManager.generateMarkdownLink(source,`${this.plugin.settings.cardFolder}/摘录.md`),documents=excerptDocuments(prepared,sourceLink,options);let groupId:string|undefined;
    try{
      for(const [i,f]of documents.entries()){
        validateSource();
        const file=await this.plugin.createUnique(this.plugin.settings.cardFolder,`${source.basename} · ${f.title}`, 'md',f.body);created.push(file);
        nodes.push(applyDefaultCardStyle({id:uid(),kind:'card',transparent:true,file:file.path,x:point.x+(i%3)*(width+32),y:point.y+Math.floor(i/3)*310,width,height:270,color:f.kind==='quote'?'purple':f.kind==='task'?'sand':'green',review:'later'},this.plugin.settings.defaultCardStyle));
      }
      validateSource();if((await this.app.vault.read(source)).replace(/\r\n?/g,'\n')!==raw.replace(/\r\n?/g,'\n'))throw Error('原文在导入期间发生变化');validateSource();
      owner!.change(b=>{b.version=3;if(group){const previous=existingGroup&&b.nodes.find(n=>n.id===existingGroup.id);if(existingGroup&&(!previous||previous.locked))throw Error('分组已变化，请刷新后继续');const frame=sectionBounds([...(previous?b.nodes.filter(n=>contained(previous,n)):[]),...nodes])!;if(previous){Object.assign(previous,frame);groupId=previous.id;}else{groupId=uid();b.nodes.push({id:groupId,kind:'section',title:`${source.basename} · 摘录`,color:'green',...frame});}}b.nodes.push(...nodes);
        if(link){let sourceNode=b.nodes.find(n=>n.kind==='card'&&n.file===source.path);if(!sourceNode){sourceNode=applyDefaultCardStyle({id:uid(),kind:'card',transparent:true,file:source.path,x:point.x-width-96,y:point.y,width,height:270,color:'slate'},this.plugin.settings.defaultCardStyle);b.nodes.push(sourceNode);}unfoldAncestors(b,sourceNode.id);for(const n of nodes)b.edges.push({id:uid(),from:sourceNode.id,to:n.id,label:'摘录',style:'curve',direction:'forward',color:'slate'});}
      });if(options.focus!==false)this.revealNode(nodes[0].id);else{if(!options.position)this.revealNode(nodes[0].id,false);this.selected=new Set(nodes.map(n=>n.id));this.updateSelection();this.renderBoard();}await owner!.flush();if(options.focus!==false)new Notice(`已创建 ${created.length} 篇摘录笔记；撤销白板操作时笔记文件仍会保留`);return {ids:nodes.map(n=>n.id),files:created.map(f=>f.path),boardPath:owner!.file.path,groupId};
    }catch(e){throw Error(`${e instanceof Error?e.message:String(e)}${created.length?`。已创建的 ${created.length} 篇笔记保留在 ${created[0].parent?.path}，可从资料库引用到白板。`:''}`);}
  }
  private branchDisclosureMenu(id:string,anchor:HTMLElement){
    const owner=this.requireOwner(),node=owner.board.nodes.find(n=>n.id===id);if(!node||!anchor.isConnected)return;
    this.objectMenu?.hide();const menu=new Menu();this.objectMenu=menu;
    const ids=new Set([id]),disabled=owner.blocked||!!node.locked;
    const add=(label:string,icon:string,mode:BranchDisclosure,convert=false)=>menu.addItem(item=>item.setTitle(label).setIcon(icon).setDisabled(disabled).onClick(()=>act(()=>{this.requireOwner(owner);this.foldBranches(ids,mode==='collapse',mode,convert);})));
    add('折叠连线子节点','list-collapse','collapse');add('展开下一层','list-tree','level');add('展开全部子节点','unfold-vertical','all');
    const pending=childConnectionCandidates(owner.board,ids).get(id)?.length||0;if(pending){menu.addSeparator();add(`将其他 ${pending} 条连线设为子节点并折叠`,'git-branch','collapse',true);}
    menu.onHide(()=>{if(this.objectMenu===menu)this.objectMenu=undefined;});const rect=anchor.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:rect.bottom+4},anchor.ownerDocument);
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
  openReadingDesk(ids:ReadonlySet<string>=this.selected){const owner=this.requireOwner();new ReadingDesk(this.app,{board:()=>this.requireOwner(owner).board,sourcePath:()=>owner.file.path,ids:new Set(ids),title:owner.file.basename,settings:this.plugin.settings,commit:edit=>{this.requireOwner(owner);const draft=studioDraft(owner.board,edit);if(draft)owner.change(()=>{owner.board=draft;});},reveal:id=>{this.requireOwner(owner);this.revealNode(id);},open:async file=>{this.requireOwner(owner);return this.plugin.openNoteInSidebar(file);}}).open();}
  private tourBar?:HTMLElement;
  openStudio(){const owner=this.requireOwner();const ensure=()=>this.requireOwner(owner);new BoardStudioModal(this.app,{
    layout:()=>{ensure();act(()=>this.openLayoutPlanner());},read:()=>{ensure();this.openReadingDesk();},board:()=>ensure().board,ids:()=>new Set(this.selected),
    commit:edit=>{const session=ensure(),draft=studioDraft(session.board,b=>{edit(b);const before=new Map(session.board.nodes.map(n=>[n.id,n.text]));for(const n of b.nodes)if(textFitsContent(n)&&before.get(n.id)!==n.text)fitTextNode(n,this.contentEl);});if(draft)session.change(()=>{session.board=draft;});},
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
    ...(ids.size===1&&owner.board.nodes.some(n=>ids.has(n.id)&&supportsLocalRelations(n))?[{label:'在白板添加脑图',icon:'network',group:'关系',hint:'以所选对象为中心，在白板中添加可折叠脑图',run:()=>this.addMindmap(undefined,[...ids][0])}]:[]),
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
    add('添加脑图','内容','network',()=>this.addMindmap());
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
    add('筛选对象','查找与选择','filter',()=>this.chooseObjects());add('白板检查','查找与选择','scan-search',()=>this.checkBoard());add('粘贴 PDF / PDF++ 引用','内容','quote',()=>this.pdfQuotePrompt());add('逐行创建文本框','内容','list-plus',()=>this.textBatchPrompt());add('向右添加关联文本','内容','corner-down-right',()=>this.linkedText(),!has||one?.kind==='section');
    add('复制对象样式','样式与排列','pipette',()=>this.copyObjectStyle(ids,owner),ids.size!==1);add('粘贴对象样式','样式与排列','paintbrush',()=>this.pasteObjectStyle(ids,owner),!has||!this.plugin.copiedNodeStyle);
    add('上移一层','样式与排列','bring-to-front',()=>owner.change(b=>stepLayers(b,ids,true)),!has);add('下移一层','样式与排列','send-to-back',()=>owner.change(b=>stepLayers(b,ids,false)),!has);add('分组贴合内容','样式与排列','group',()=>owner.change(b=>fitSections(b,ids)),!section);
    add('返回上一视角','视角','arrow-left',()=>this.travelViewport(),false,'Alt + ←');add('前进到下一视角','视角','arrow-right',()=>this.travelViewport(true),false,'Alt + →');add('适应全部内容','视角','maximize',()=>this.fit(),false,'F');add('聚焦所选','视角','focus',()=>this.focusSelection(),!has,'Shift + F');add('搜索白板','查找与选择','search',()=>this.findOnBoard(),false,'⌘ / Ctrl + F');
    new BoardActionModal(this.app,actions).open();}

  // Edits and write failures emit board updates; save-status notifications do not invalidate the graph.
  private paint = (kind:SessionUpdate='board') => { if(kind!=='status')this.plugin.refreshLocalRelations?.(this);if(kind==='status'){this.renderSaveStatus();return;}this.connectionIndex=undefined;this.renderBoard(); this.renderSidebar(); };
  private renderSaveStatus(){if(!this.session)return;if(this.status)renderBoardSaveFeedback(this.status,this.session.saveFeedback,action=>act(()=>this.runSaveFeedbackAction(action)));this.brainBoardView?.refreshSaveFeedback();}
  private saveFeedbackSequence=0;private saveFeedbackPending=false;private saveFeedbackPicker?:NativeBoardEditorPicker;private stopSaveFeedbackNavigation?:()=>void;
  private cancelSaveFeedbackNavigation(){this.saveFeedbackSequence++;this.stopSaveFeedbackNavigation?.();this.stopSaveFeedbackNavigation=undefined;this.saveFeedbackPicker?.close();this.saveFeedbackPicker=undefined;this.saveFeedbackPending=false;}
  async runSaveFeedbackAction(action:BoardSaveFeedbackAction){
    const owner=this.session,source=this.leaf,doc=this.contentEl.ownerDocument,win=doc.defaultView;
    if(this.saveFeedbackPending||!owner||this.closed||this.closing||source.view!==this||!win||win.closed||this.app.workspace.getActiveViewOfType(View)!==this||owner.saveFeedback.action?.kind!==action)return;
    this.saveFeedbackPending=true;const sequence=++this.saveFeedbackSequence;let stopped=false,allocating=false,target:WorkspaceLeaf|undefined;
    const active=this.app.workspace.getActiveViewOfType(View)?.leaf,sourcePath=owner.file.path,sourceIdentity=this.app.vault.getAbstractFileByPath(sourcePath);
    const valid=()=>!stopped&&sequence===this.saveFeedbackSequence&&!this.closed&&!this.closing&&this.session===owner&&source.view===this&&this.contentEl.ownerDocument===doc&&doc.defaultView===win&&!win.closed&&owner.file.path===sourcePath&&this.app.vault.getAbstractFileByPath(sourcePath)===sourceIdentity;
    const ref=this.app.workspace.on('active-leaf-change',leaf=>{if(!allocating&&leaf!==active&&leaf!==target){stopped=true;this.saveFeedbackPicker?.close();}});
    const stop=()=>{stopped=true;this.app.workspace.offref(ref);};this.stopSaveFeedbackNavigation=stop;
    try{
      if(action==='locate-native'){
        const leaves=nativeBoardEditorLeaves(this.app,owner.file);if(!leaves.length){owner.refreshNativeEditing();this.renderSaveStatus();return;}
        let chosen=leaves[0];if(leaves.length>1){
          const picked=await new Promise<WorkspaceLeaf|undefined>(resolve=>{const picker=new NativeBoardEditorPicker(this.app,leaves,doc,resolve,valid,report);this.saveFeedbackPicker=picker;picker.open();});
          this.saveFeedbackPicker=undefined;if(!picked||!valid())return;chosen=picked;
        }
        target=chosen;await this.plugin.locateNativeBoardEditor(owner.file,chosen,valid);return;
      }
      const file=owner.recoveryFile,path=file?.path;
      if(!file||!path||this.app.vault.getAbstractFileByPath(path)!==file){this.renderSaveStatus();throw Error('恢复草稿已移除或替换；当前布局仍在本页，请导出保留。');}
      const current=()=>valid()&&file.path===path&&this.app.vault.getAbstractFileByPath(path)===file;
      const navigation:BoardOpenNavigation={acquire:create=>{allocating=true;try{const leaf=create();target=leaf;const now=this.app.workspace.getActiveViewOfType(View)?.leaf;if(now&&now!==active&&now!==leaf)stopped=true;return leaf;}finally{allocating=false;}},target:leaf=>{target=leaf;}};
      target=await this.plugin.openBoard(file,false,current,true,navigation);if(!target||!current())return;
      const opened=target.view;if(!(opened instanceof BoardView)||opened.file!==file||!opened.session||opened.closed||opened.closing||!opened.containerEl.isConnected||target.getContainer().win.closed)return;
      await this.app.workspace.revealLeaf(target);if(!current()||target.view!==opened||opened.file!==file||opened.closed||opened.closing||!opened.containerEl.isConnected||target.getContainer().win.closed)return;
      opened.resumeAutomaticGeometry();this.app.workspace.setActiveLeaf(target,{focus:true});this.plugin.currentBoard=opened;
    }finally{this.app.workspace.offref(ref);if(this.stopSaveFeedbackNavigation===stop)this.stopSaveFeedbackNavigation=undefined;if(sequence===this.saveFeedbackSequence){this.saveFeedbackPending=false;this.saveFeedbackPicker=undefined;}}
  }
  private scheduleRender(viewportOnly=false){
    if(this.closed)return;
    // A content update upgrades an already queued camera refresh; later wheel events
    // must not downgrade it and leave changed notes or controls stale.
    this.viewportOnlyRender=this.renderFrame?this.viewportOnlyRender&&viewportOnly:viewportOnly;
    if(this.renderFrame)return;
    this.renderFrame=(this.contentEl?.ownerDocument?.defaultView||window).requestAnimationFrame(()=>{this.renderFrame=0;const only=this.viewportOnlyRender;this.viewportOnlyRender=true;this.renderBoard(only);});
  }
  private clearNodes(){this.linkedContentMenu?.hide();this.linkedContentMenu=undefined;this.connectionCandidates=[];this.connectionIndex=undefined;this.connectionGeometryKey='';(this.contentEl?.ownerDocument?.defaultView||window).cancelAnimationFrame(this.renderFrame);this.renderFrame=0;this.viewportOnlyRender=true;this.relationBar?.remove();this.relationBar=undefined;this.nodeFitQueue.cancel();this.pendingFits.clear();this.deferredCardFits.clear();this.previewQueue.clear();this.pdfPreviewQueue.clear();this.nodeScopes.forEach(s=>s.unload());this.nodeScopes.clear();this.mediaPlayers.clear();this.mediaStates.clear();this.mediaIdentities.clear();this.onlineBoardPlayers.clear();this.onlineBoardStates.clear();this.nodeKeys.clear();this.positions.forEach(e=>e.remove());this.positions.clear();this.endpointPorts.clear();this.mapKey='';this.mapRefresh=undefined;this.mapViewport=undefined;this.edgeLayer?.clear();}
  constructor(leaf: WorkspaceLeaf, private plugin: ThoughtSpace) {
    super(leaf);this.scope=new Scope(this.app.scope);
    const search=(event:KeyboardEvent)=>{
      const doc=this.contentEl.ownerDocument,active=doc.activeElement;
      if(this.closed||this.closing||!isBrainBoard(this.session?.board)||!this.brainBoardView||!this.contentEl.getClientRects().length||event.isComposing||event.defaultPrevented||this.app.workspace.getActiveViewOfType(BoardView)!==this)return;
      if(active&&!this.contentEl.contains(active)&&active!==doc.body||event.target&&event.target!==doc.body&&!this.contentEl.contains(event.target as Node))return;
      if(active?.closest('textarea,select,.cm-editor,[contenteditable=true],input:not(.ts-brain-query)'))return;
      event.preventDefault();this.brainBoardView.focusSearch();return false;
    };
    this.scope.register(['Mod'],'k',search);this.scope.register(['Ctrl'],'k',search);
  }
  getViewType() { return VIEW; } getIcon() { return 'network'; }
  getState() { return { ...super.getState(), tsTrail: this.trail.map(f => f.path) }; }
  async setState(state: Record<string, unknown>, result: ViewStateResult) {
    const paths = Array.isArray(state.tsTrail) ? state.tsTrail : [];
    this.trail = [...new Set(paths)].filter((p): p is string => typeof p === 'string' && p !== state.file).slice(0, 64)
      .map(p => this.app.vault.getAbstractFileByPath(p)).filter((f): f is TFile => f instanceof TFile && isBoardFile(this.app,f));
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
    root.dataset.accent = this.plugin.settings.accent;if(this.nativeHeader)this.nativeHeader.dataset.accent=root.dataset.accent;
    root.dataset.density = this.plugin.settings.density;
    this.applyBoardBackground();
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
    if(isBrainBoard(this.session?.board)){this.brainBoardView?.focusSearch();return;}
    if(this.searchModal?.modalEl.isConnected){this.searchModal.modalEl.querySelector<HTMLInputElement>('input[type="search"]')?.focus();return this.searchModal;}
    const owner = this.session; if (!owner) return;
    const modal=new BoardSearchModal(this.app,{title:owner.file.basename,context:owner,board:()=>this.requireOwner(owner).board,
      commit:async edit=>{this.requireOwner(owner);const draft=studioDraft(owner.board,edit);if(draft)owner.change(()=>{owner.board=draft;});await owner.flush();if(owner.blocked)throw Error('清单或阅读状态保存失败，当前修改仍在恢复草稿中；请处理白板保存冲突后重试');this.requireOwner(owner);},
      locate:async id=>{this.requireOwner(owner);if(this.inline&&!await this.inline.commit())throw Error('编辑内容尚未保存，请先处理保存冲突');this.requireOwner(owner);if(!owner.board.nodes.some(n=>n.id===id))throw Error('内容已移除，请刷新搜索');this.objectFilter={kind:'',color:'',query:''};this.relatedFocus=undefined;this.relationLens=undefined;this.revealNode(id);},
      open:async id=>{this.requireOwner(owner);if(this.inline&&!await this.inline.commit())throw Error('编辑内容尚未保存，请先处理保存冲突');this.requireOwner(owner);const node=owner.board.nodes.find(n=>n.id===id),file=node?.file?this.app.vault.getAbstractFileByPath(node.file):undefined;if(!(file instanceof TFile))throw Error('原笔记已移动或移除，请刷新搜索');await this.plugin.openNoteInSidebar(file);},
      link:id=>{this.requireOwner(owner);if(!owner.board.nodes.some(n=>n.id===id))throw Error('内容已移除，请刷新搜索');return boardLink(this.app.vault.getName(),owner.file.path,id);}});this.searchModal=modal;modal.open();return modal;
  }
  locateFile(path: string) { const node = this.session?.board.nodes.find(n => n.kind === 'card' && n.file === path); if (node) this.revealNode(node.id); }
  revealNode(id: string, focus=true) {
    const node = this.session?.board.nodes.find(n => n.id === id); if (!node || !this.session || this.session.blocked) return;
    if(isBrainBoard(this.session.board)){if(!supportsLocalRelations(node))return;this.session.change(b=>{if(isBrainBoard(b))b.brain=updateBoardMindmapState(b.brain,{type:'center',id},b.nodes);},undefined,false,true,false,true);if(focus){this.app.workspace.setActiveLeaf(this.leaf,{focus:true});this.brainBoardView?.focusNode(id);}return;}
    this.clearCanvasGesture();
    if(branchState(this.session.board).hidden.has(id))this.session.change(b=>unfoldAncestors(b,id));
    if(focus)this.app.workspace.setActiveLeaf(this.leaf,{focus:true});
    this.rememberViewport();const v = this.session.board.viewport;
    this.selected = new Set([id]); this.selectedEdge = undefined; this.mode = 'select'; this.connectFrom = undefined;this.connectSide=undefined;this.stage?.removeClass('ts-connecting'); this.connectButton?.removeClass('is-active');
    // Selection may reveal or resize the format bar. Measure its final surface
    // before locating the object; explicit locate keeps the current zoom.
    this.updateSelection();
    Object.assign(v,centerViewportInSafeArea(node,this.stage.clientWidth,this.stage.clientHeight,v.zoom,this.viewportInsets()));
    this.transform(); this.session.persist(); if(focus)this.stage.focus();
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
    if(this.file?.extension.toLowerCase()==='md')menu.addItem(i=>i.setTitle('原生属性与 Markdown').setIcon('file-pen-line').onClick(()=>act(()=>this.plugin.openBoardNativeMarkdown(this.file!,this.leaf))));
    if(owner&&!owner.blocked)for(const [format,title]of [['markdown','另存为 Markdown 白板'],['legacy','另存为旧格式白板']]as const)menu.addItem(i=>i.setTitle(title).setIcon('copy').onClick(()=>act(()=>this.plugin.promptSaveBoardAs(format,this))));
    menu.showAtMouseEvent(e);
  }
  private renameBoard() {
    const file = this.file,owner=this.session,original=file?.path; if (!file || !owner || owner.blocked) return;
    new Prompt(this.app, '重命名白板', file.basename, async value => {
      this.requireOwner(owner);if(file.path!==original)throw new Error('白板已移动，请重新打开菜单');
      const path = `${file.parent?.path ? file.parent.path + '/' : ''}${safeName(value)}.${file.extension}`;
      if (path === file.path) return;
      if (this.app.vault.getAbstractFileByPath(path)) throw new Error('已有同名白板，请换一个名称');
      await owner.flush();this.requireOwner(owner);if(file.path!==original||this.app.vault.getAbstractFileByPath(original)!==file)throw Error('白板在保存期间已移动或删除，请重新打开菜单');await this.app.fileManager.renameFile(file, path);
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
    this.nativePropertiesAction=this.addAction('file-pen-line','原生属性与 Markdown',()=>act(()=>{if(this.file)return this.plugin.openBoardNativeMarkdown(this.file,this.leaf);}));this.nativePropertiesAction.style.display=this.file?.extension.toLowerCase()==='md'?'':'none';
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
    const brain=headerAction('在白板添加脑图','network',()=>this.addMindmap());brain.addClass('ts-brain-mode-entry');
    const commands=top.createDiv({cls:'ts-commandbar',attr:{role:'toolbar','aria-label':'白板工具栏'}});
    this.registerDomEvent(commands,'focusout',()=>this.inline?.checkFocus());
    this.register(toolbarNavigation(commands));
    this.register(installToolbarWheel(commands));
    this.register(()=>{extras.forEach(el=>el.remove());nativeHeader?.removeClass('ts-native-header');if(nativeHeader){delete nativeHeader.dataset.glass;delete nativeHeader.dataset.accent;}nativeTitle?.removeClass('ts-board-title');});
    const body = root.createDiv('ts-body'); this.sidebar = this.contentEl.ownerDocument.createDocumentFragment().createDiv();this.sidebar.className='ts-sidebar';

    const nav = this.sidebar.createDiv({cls:'ts-tabs',attr:{role:'tablist','aria-label':'空间导航'}});
    const tabs = ['library','boards','tasks','outline'] as const;
    for (const [id, title, icon] of [['library', '卡片', 'layers'], ['boards', '白板', 'layout-dashboard'], ['tasks', '任务', 'list-checks'], ['outline','大纲','list-tree']] as const) {
      const btn = button(nav, title, icon, () => this.selectTab(id));
      btn.setAttribute('role','tab');btn.setAttribute('aria-selected',String(id===this.tab));btn.tabIndex=id===this.tab?0:-1;
      btn.toggleClass('is-active',id===this.tab);
    }
    nav.setAttribute('aria-orientation','horizontal');
    const navOrientationObserver=new ResizeObserver(()=>{
      if(!nav.isConnected)return;
      const columns=nav.win.getComputedStyle(nav).gridTemplateColumns.trim().split(/\s+/).length;
      const orientation=columns===1?'vertical':'horizontal';
      if(nav.getAttribute('aria-orientation')!==orientation)nav.setAttribute('aria-orientation',orientation);
    });
    navOrientationObserver.observe(nav);this.register(()=>navOrientationObserver.disconnect());
    nav.onkeydown=e=>{if(e.isComposing||e.keyCode===229||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;const buttons=Array.from(nav.querySelectorAll<HTMLButtonElement>('button')),i=buttons.indexOf(e.target as HTMLButtonElement);if(i<0)return;const columns=Math.max(1,nav.win.getComputedStyle(nav).gridTemplateColumns.split(' ').length),vertical=e.key==='ArrowUp'||e.key==='ArrowDown';if(vertical&&columns>=tabs.length)return;e.preventDefault();e.stopPropagation();const delta=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:e.key==='ArrowUp'?-columns:columns,next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+delta+tabs.length)%tabs.length;this.selectTab(tabs[next]);buttons[next]?.focus();};
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
    const heading=formatbar.createDiv({cls:'ts-format-heading',attr:{role:'toolbar','aria-label':'对象与编辑模式'}});this.selectionHeading=heading;
    this.register(toolbarNavigation(heading));this.register(installToolbarWheel(heading));
    const formatRow=formatbar.createDiv('ts-format-row');
    const previous=button(formatRow,'前面的格式工具','chevron-left',()=>{},'ts-icon-button ts-format-scroll ts-format-scroll-prev');previous.hidden=true;
    formatRow.append(commands);
    const next=button(formatRow,'后面的格式工具','chevron-right',()=>{},'ts-icon-button ts-format-scroll ts-format-scroll-next');next.hidden=true;
    for(const arrow of [previous,next])arrow.onmousedown=e=>e.preventDefault();
    this.registerDomEvent(formatbar,'focusout',()=>this.inline?.checkFocus());
    this.registerDomEvent(formatbar,'keydown',e=>{
      if(e.key!=='Escape'||e.isComposing)return;
      if(this.inline&&!this.inline.saving){e.preventDefault();e.stopPropagation();this.inline.input.focus({preventScroll:true});}
      else if(this.appearanceExpanded){e.preventDefault();e.stopPropagation();this.appearanceExpanded=false;this.renderSelectionTools();this.selectionHeading?.querySelector<HTMLButtonElement>(`[data-mode="${this.appearanceTab}"]`)?.focus({preventScroll:true});}
    });
    this.register(installToolbarOverflow(formatRow,commands,previous,next));
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
    this.selectionTools=commands.createDiv({cls:'ts-selection-tools',attr:{id:`ts-format-${this.markerId}`,'aria-label':'选中对象格式'}});
    this.stage = main.createDiv({ cls: 'ts-stage', attr: { tabindex: '0', 'aria-label': '思维白板', 'aria-description': '鼠标与快捷键可在插件设置中自定义。Shift 加左键框选，空格加左键平移，右键单击打开菜单，双击空白新建文本，双击已有节点编辑。思维导图：Tab 子主题，Enter 同级，Shift+Tab 父主题' } });
    this.world = this.stage.createDiv('ts-world'); this.svg = this.world.createSvg('svg', { cls: 'ts-edges' });this.edgeLayer=new EdgeLayer(this.svg,this.markerId,id=>this.labelEdge(id));
    this.startScreen=this.stage.createDiv({cls:'ts-start-screen',attr:{'aria-label':'开始使用白板'}});this.startScreen.hidden=true;
    this.startScreen.createEl('h2',{cls:'ts-start-heading',text:'从一个想法开始'});
    this.startScreen.createEl('p',{cls:'ts-start-copy',text:'把文字、笔记和材料放在一起，让思路慢慢清晰。'});
    const startActions=this.startScreen.createDiv('ts-start-actions');
    button(startActions,'写下想法','type',()=>this.newText(),'ts-primary');button(startActions,'插入已有笔记','file-input',()=>this.insertExistingNote());button(startActions,'思维导图模板','git-fork',()=>this.plugin.promptMindmap());
    this.startScreen.createDiv({cls:'ts-start-tip',text:'双击空白处写文本，或从文件列表和搜索中拖入笔记、PDF、图片。'});
    this.registerDomEvent(this.startScreen,'wheel',e=>e.stopPropagation(),{passive:true});this.registerDomEvent(this.startScreen,'pointerdown',e=>e.stopPropagation());this.registerDomEvent(this.startScreen,'dblclick',e=>e.stopPropagation());
    const rail=main.createDiv({cls:'ts-board-rail',attr:{role:'toolbar','aria-label':'白板创作工具','aria-orientation':'vertical'}});
    const railTools=rail.createDiv('ts-rail-tools');
    const railGroup=(label:string)=>railTools.createDiv({cls:'ts-rail-group',attr:{role:'group','aria-label':label}});
    const interactionRail=railGroup('选择与连接'),createRail=railGroup('创建内容'),organizeRail=railGroup('组织与工具');
    const panel=main.createDiv({cls:'ts-rail-popover ts-tools-palette',attr:{role:'dialog','aria-label':'更多白板工具'}});panel.hidden=true;
    const toolsHead=panel.createDiv('ts-palette-heading');const toolsTitle=toolsHead.createDiv('ts-palette-title');toolsTitle.createEl('strong',{text:'白板工具'});
    const toolbar=panel.createDiv('ts-rail-actions');
    const cluster=(parent:HTMLElement,label:string)=>parent.createDiv({cls:'ts-tool-cluster',attr:{role:'group','aria-label':label}});
    const organize=cluster(toolbar,'组织与整理'),workspace=cluster(toolbar,'阅读与工作区');
    this.selectionButton=button(interactionRail,'框选','scan',()=>this.toggleSelectionTool());this.selectionButton.title='开启后左键框选 · Shift 累加 · 空格加左键平移 · 鼠标操作可在设置中修改';
    this.connectButton=button(interactionRail,'连线','move-up-right',()=>this.toggleConnectionTool());
    button(createRail,'新建卡片','plus',()=>this.newCard(),'ts-primary');
    button(createRail,'文本','type',()=>this.newText());
    const insertPanel=main.createDiv({cls:'ts-rail-popover ts-insert-palette',attr:{role:'dialog','aria-label':'插入内容'}});insertPanel.hidden=true;
    const insertHead=insertPanel.createDiv('ts-palette-heading');
    const insertTitle=insertHead.createDiv('ts-palette-title');insertTitle.createEl('strong',{text:'插入内容'});
    const insertTools=insertPanel.createDiv('ts-rail-actions');
    const tile=(parent:HTMLElement,label:string,icon:string,caption:string,run:()=>unknown)=>{
      const item=button(parent,label,icon,run,'ts-insert-tile');item.createSpan({cls:'ts-tool-description',text:caption});item.title=`${label} · ${caption}`;return item;
    };
    const materials=cluster(insertTools,'笔记与材料'),structure=cluster(insertTools,'结构与关系');
    tile(materials,'已有笔记','file-input','引用库中的笔记',()=>this.insertExistingNote()).addClass('ts-insert-note-entry');
    tile(materials,'图片','image-plus','本地图片或链接',()=>this.imageMenu());
    tile(materials,'PDF 卡片','file-text','阅读与拖拽摘录',()=>this.insertPdfCard());
    tile(materials,'视频卡片','clapperboard','直接播放并记录时间点',()=>this.insertMediaCard(this.point(),'video'));
    tile(materials,'音频卡片','audio-lines','听音频并记录时间点',()=>this.insertMediaCard(this.point(),'audio'));
    tile(materials,'网页卡片','globe','链接、预览与网页参考',()=>this.newWebCard());
    tile(materials,'表格','table-2','在白板整理数据',()=>this.newTable());
    tile(structure,'脑图','network','在白板内浏览、展开与连接笔记',()=>this.addMindmap()).addClass('ts-insert-mindmap-entry');
    tile(structure,'子白板','panels-top-left','创建下一级白板',()=>this.newChildBoard());
    tile(structure,'引用白板','folder-input','连接已有白板',()=>new BoardPicker(this.app,this.file,f=>this.addBoard(f)).open());
    tile(structure,'思维导图模板','git-fork','从预设结构开始',()=>this.plugin.promptMindmap());
    tile(structure,'中心主题','circle-dot','在当前白板展开思路',()=>this.newText(this.point(),true));
    const insert=button(createRail,'插入内容','file-plus-2',()=>{},'ts-insert-content-entry');
    this.sectionButton=button(organizeRail,'分组框','group',()=>this.sectionAction(),'ts-section-tool');this.sectionButton.title='框住所选内容，或拖动画出分组框';
    button(organizeRail,'整理白板','layout-dashboard',()=>this.openLayoutPlanner(),'ts-arrange-entry');
    button(organize,'分组总览','list-tree',()=>this.sectionNavigator());
    button(organize,'移入已有分组','folder-input',()=>this.openGroupOrganizer());
    button(organize,'复用到其他白板','copy-plus',()=>this.openReuse());
    button(organize,'连线统一为直线','move-up-right',()=>this.unifyEdgeStyle('straight'));
    button(workspace,'白板写作模式','notebook-pen',()=>this.plugin.openWriting(this));
    button(workspace,'打开笔记摘录','notebook-pen',()=>this.openMaterials());
    button(workspace,'音视频笔记','clapperboard',()=>this.insertMediaCard());
    button(workspace,'阅读 PDF','file-text',()=>new ReadingSourcePicker(this.app,file=>this.plugin.openExcerptNote(file),true).open());
    button(workspace,'搜索白板','search',()=>this.findOnBoard());
    button(workspace,'白板工作台','sliders-horizontal',()=>this.openStudio());
    button(workspace,'常用视角','scan',()=>this.openSavedViews());
    button(workspace,'视角与快照','bookmark-plus',()=>this.workspaceMenu());
    button(workspace,'白板操作','command',()=>this.boardActions());
    this.mindmapTools=cluster(toolbar,'思维导图工具');this.mindmapTools.addClass('ts-more-mindmap-tools');toolbar.insertBefore(this.mindmapTools,workspace);
    button(this.mindmapTools,'导图布局与配色','settings-2',()=>this.openMindmapStudio(),'ts-mindmap-studio-entry');
    button(this.mindmapTools,'中心主题','circle-dot',()=>this.newText(this.point(),true));
    button(this.mindmapTools,'子主题 · Tab','corner-down-right',()=>this.addTopic());
    button(this.mindmapTools,'同级主题 · Enter','list-plus',()=>this.addTopic(true));
    button(this.mindmapTools,'向右整理','align-start-vertical',()=>this.layoutTopics('right'));
    button(this.mindmapTools,'向下整理','align-start-horizontal',()=>this.layoutTopics('down'));
    button(this.mindmapTools,'向上整理','arrow-up-from-line',()=>this.layoutTopics('up'));
    const categoryButtons:{button:HTMLButtonElement;section?:HTMLElement}[]=[];
    const toolSearch=installRailToolSearch(panel,toolbar,{onCategoryChange:(section,searching)=>{
      for(const item of categoryButtons){const active=searching?!item.section:item.section===section;item.button.setAttribute('aria-pressed',String(active));}
    }});this.register(toolSearch.dispose);
    const sectionShortcuts=panel.createDiv({cls:'ts-palette-sections',attr:{role:'group','aria-label':'工具分类'}});panel.insertBefore(sectionShortcuts,toolbar);
    for(const [label,icon,section] of [['全部','layout-grid',undefined],['整理','layout-dashboard',organize],['思维导图','git-fork',this.mindmapTools],['工作区','panels-top-left',workspace]] as const){
      const control=button(sectionShortcuts,label,icon,()=>toolSearch.setCategory(section));control.setAttribute('aria-pressed',String(!section));categoryButtons.push({button:control,section});
    }
    const more=button(organizeRail,'更多白板工具','ellipsis',()=>{});
    const palettes=installToolPalettes(main,rail,[
      {panel:insertPanel,trigger:insert,actions:insertTools},
      {panel,trigger:more,actions:toolbar,onOpen:toolSearch.open}
    ]);this.register(()=>palettes.dispose());
    button(toolsHead,'关闭白板工具','x',()=>palettes.close(true),'ts-icon-button ts-palette-close');
    button(insertHead,'关闭插入面板','x',()=>palettes.close(true),'ts-icon-button ts-palette-close');
    const footer=main.createDiv('ts-footer');
    this.canvasSummary=footer.createDiv({cls:'ts-canvas-summary',attr:{role:'status','aria-live':'polite'}});
    const viewDock=footer.createDiv({cls:'ts-view-dock',attr:{role:'toolbar','aria-label':'画布与视图'}});
    this.register(toolbarNavigation(viewDock));this.register(installToolbarWheel(viewDock));
    this.canvasControls=viewDock.createDiv({cls:'ts-canvas-controls',attr:{role:'group','aria-label':'画布设置'}});
    this.snapToggle=button(this.canvasControls,'网格吸附','magnet',()=>this.mutate(b=>{b.version=3;b.snapToGrid=!b.snapToGrid;}),'ts-snap-toggle');
    this.snapToggle.createSpan({cls:'ts-snap-state',text:'关闭'});
    const spacing=this.canvasControls.createEl('label',{cls:'ts-grid-spacing',attr:{title:'吸附间距 · 缩小时只显示主要网格线，吸附精度保持不变'}});setIcon(spacing.createSpan(),'ruler');
    this.gridSelect=spacing.createEl('select',{attr:{'aria-label':'网格间距'}});for(const step of gridSteps)this.gridSelect.createEl('option',{value:String(step),text:`${step} px`});
    this.gridSelect.onchange=()=>act(async()=>{const value=Number(this.gridSelect!.value);if(!gridSteps.some(step=>step===value))return;this.plugin.settings.gridStep=value;await this.plugin.savePreferences();});
    const background=button(this.canvasControls,'白板背景','palette',()=>this.showCanvasBackgroundMenu(background),'ts-background-entry');
    background.setAttribute('aria-haspopup','menu');background.setAttribute('aria-expanded','false');background.lastElementChild?.addClass('ts-background-caption');
    this.register(()=>{this.canvasMenu?.hide();this.canvasMenu=undefined;});
    viewDock.append(this.canvasSummary);
    const camera=viewDock.createDiv({cls:'ts-camera-controls',attr:{role:'group','aria-label':'视图导航'}});
    const zoom=camera.createDiv({cls:'ts-zoom',attr:{role:'group','aria-label':'视图缩放'}});this.focusSelectedButton=button(zoom,'聚焦所选','focus',()=>this.focusSelection(),'ts-focus-selected ts-icon-button');this.focusSelectedButton.hidden=true;this.focusSelectedButton.onmousedown=e=>e.preventDefault();button(zoom,'−','minus',()=>this.zoom(.85));this.zoomLabel=zoom.createSpan({attr:{role:'button',tabindex:'0','aria-label':'缩放比例与视图定位',title:'缩放比例 · 聚焦所选 · 适应全部'}});this.zoomLabel.onclick=()=>this.zoomPresets();this.zoomLabel.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.zoomPresets();}};button(zoom,'+','plus',()=>this.zoom(1.18));button(zoom,'适应','scan',()=>this.fit());
    this.overviewToggle=button(camera,'白板总览','map',async()=>{if(this.minimapAvoidance.hidden){this.minimapAvoidance.reveal();this.syncMinimapAvoidance();return;}this.plugin.settings.showMinimap=!this.plugin.settings.showMinimap;await this.plugin.savePreferences();},'ts-overview-toggle ts-icon-button');this.overviewToggle.onmousedown=e=>e.preventDefault();
    this.snapTarget=this.stage.createDiv({cls:'ts-snap-target',attr:{'aria-hidden':'true'}});this.snapReadout=this.stage.createDiv({cls:'ts-snap-readout',attr:{'aria-hidden':'true'}});
    this.flowHint=this.stage.createDiv({cls:'ts-flow-hint',attr:{role:'status','aria-live':'polite'}});
    this.backToContent=button(this.stage,'返回内容','scan',()=>this.fit(),'ts-back-content');
    this.sectionHint=this.stage.createDiv({cls:'ts-section-hint',text:'拖动画出分组框 · 松手后命名 · Esc 取消',attr:{role:'status'}});
    this.syncCanvasControls();
    this.filterBadge=main.createDiv({cls:'ts-object-filter-status',attr:{'aria-live':'polite'}});this.inspector = main.createDiv('ts-inspector');
    this.minimap = main.createDiv({ cls: 'ts-minimap', attr: { 'aria-label': '白板缩略图' } });
    const chromeWindow=root.ownerDocument.defaultView||window;let resizeFrame=0,chromeFrame=0,railFrame=0;
    const resizeObserver=new ResizeObserver(()=>{if(resizeFrame)return;resizeFrame=chromeWindow.requestAnimationFrame(()=>{resizeFrame=0;this.stage.parentElement?.toggleClass('ts-short-canvas',this.stage.clientHeight<360);this.retryDeferredCardFits();this.scheduleRender();});});resizeObserver.observe(this.stage);this.register(()=>{resizeObserver.disconnect();chromeWindow.cancelAnimationFrame(resizeFrame);});
    // View controls can grow with font scaling or a narrow split. Reserve their
    // actual screen height for the overview and editor actions, not a fixed row.
    const refreshRailObstacle=()=>{
      const mainBounds=main.getBoundingClientRect(),railBounds=rail.getClientRects().length?rail.getBoundingClientRect():undefined;
      const obstacle=railBounds?{x:railBounds.left-mainBounds.left-6,y:railBounds.top-mainBounds.top-6,width:railBounds.width+12,height:railBounds.height+12}:undefined;
      const previous=this.cardToolbarObstacles[0];
      if(previous?.x!==obstacle?.x||previous?.y!==obstacle?.y||previous?.width!==obstacle?.width||previous?.height!==obstacle?.height){this.cardToolbarObstacles=obstacle?[obstacle]:[];this.scheduleRender(true);}
    };
    const refreshChrome=()=>{
      chromeFrame=0;
      this.measureMinimap();
      const mainBounds=main.getBoundingClientRect(),mainTop=mainBounds.top;
      const railBounds=rail.getClientRects().length?rail.getBoundingClientRect():undefined;
      refreshRailObstacle();
      const toolsEnd=railBounds&&rail.getAttribute('aria-orientation')==='horizontal'?railBounds.bottom-mainTop+12:12;
      const toolsReserve=`${Math.ceil(toolsEnd)}px`;if(main.style.getPropertyValue('--ts-workbench-tools-end')!==toolsReserve)main.style.setProperty('--ts-workbench-tools-end',toolsReserve);
      const formatEnd=formatbar.getClientRects().length?formatbar.getBoundingClientRect().bottom-mainTop+12:toolsEnd;
      for(const [name,size] of [['--ts-footer-reserve',footer.getBoundingClientRect().height+28],['--ts-format-reserve',formatEnd]] as const){
        const reserve=`${Math.ceil(size)}px`;if(main.style.getPropertyValue(name)!==reserve)main.style.setProperty(name,reserve);
        if(name==='--ts-format-reserve'){const inset=Math.max(60,Math.ceil(size));if(this.cardToolbarReserve!==inset){this.cardToolbarReserve=inset;this.scheduleRender(true);}}
      }
      // Changing the reserved bands re-centers the rail without necessarily
      // resizing it. Measure that settled position before placing card actions.
      chromeWindow.cancelAnimationFrame(railFrame);railFrame=chromeWindow.requestAnimationFrame(()=>{railFrame=0;refreshRailObstacle();});
    };
    // Writes that change observed sizes belong to the next frame, not inside
    // ResizeObserver delivery; this also coalesces split/theme changes.
    const chromeObserver=new ResizeObserver(()=>{if(!chromeFrame)chromeFrame=chromeWindow.requestAnimationFrame(refreshChrome);});chromeObserver.observe(footer);chromeObserver.observe(formatbar);chromeObserver.observe(rail);chromeObserver.observe(this.minimap);chromeObserver.observe(this.stage);this.register(()=>{chromeObserver.disconnect();chromeWindow.cancelAnimationFrame(chromeFrame);chromeWindow.cancelAnimationFrame(railFrame);});
    this.registerDomEvent(this.stage,'pointerdown',e=>{
      // Editors may stop bubbling; a new middle press still owns its default.
      if(e.button===1)this.suppressMiddlePaste=false;
      if(this.blankClickOwner!==this.session){this.blankClicks.cancel();this.blankClickOwner=this.session;}
      this.blankClicks.down(e,this.canCreateBlankText(e),this.plugin.settings.dragThreshold??4);
    },{capture:true});
    this.registerDomEvent(this.contentEl.ownerDocument,'pointermove',e=>this.blankClicks.move(e),{capture:true,passive:true});
    this.registerDomEvent(this.contentEl.ownerDocument,'pointerup',e=>this.blankClicks.up(e),{capture:true});
    this.registerDomEvent(this.contentEl.ownerDocument,'pointercancel',e=>this.blankClicks.up(e,true),{capture:true});
    this.registerDomEvent(this.stage,'click',e=>this.blankClicks.click(e),{capture:true});
    this.registerDomEvent(this.stage,'dblclick',e=>act(()=>this.blankDoubleClick(e)));
    this.registerDomEvent(this.contentEl.ownerDocument.defaultView!,'blur',()=>this.blankClicks.cancel());
    this.registerDomEvent(this.stage, 'pointerdown', e => {if(e.isTrusted)this.resumeAutomaticGeometry();this.pointerDown(e);});
    this.registerDomEvent(this.stage, 'contextmenu', e => this.contextMenu(e));
    this.registerDomEvent(this.stage, 'pointermove', e => this.pointerMove(e));
    this.registerDomEvent(this.stage, 'pointerup', e => this.pointerUp(e));
    this.registerDomEvent(this.stage, 'pointercancel', e => this.pointerUp(e, true));
    // Also finish a pending card gesture if it leaves the stage before capture.
    // Floating panels can receive the release or stop its bubbling.
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
    this.registerDomEvent(this.stage,'click',e=>{
      if(e.defaultPrevented||e.button!==0)return;
      const link=(e.target as Element).closest('a'),href=link?.getAttribute('href');
      if(!link||!href?.startsWith('yingjian://')||link.closest('.ts-inline-editor,.cm-editor,.is-editing-title'))return;
      e.preventDefault();e.stopPropagation();
      const id=link.closest('[data-id]')?.getAttribute('data-id'),node=this.session?.board.nodes.find(n=>n.id===id);
      let source=node?.videoCapture?.note||node?.file;
      if(!source&&node?.text){const citation=textExcerptPresentation(node.text).sources[0];if(citation)source=resolveSourceLink(citation.link,path=>this.app.metadataCache.getFirstLinkpathDest(path,this.file?.path||'')).file?.path;}
      act(async()=>{await this.prepareVideoBridge();await this.plugin.playYingjianTimestamp(href,source);});
    },{capture:true});
    const openLocalMediaBoardLink=(e:MouseEvent)=>{
      if(e.defaultPrevented||e.button!==0||Keymap.isModEvent(e))return;
      const link=(e.target as Element).closest('a');
      if(!link||link.closest('.ts-inline-editor,.cm-editor,.is-editing-title'))return;
      // Read legacy form-encoded links before native callbacks lose space/plus identity.
      const href=link.getAttribute('href')||'',board=parseMediaSourceUrl(href),player=board?undefined:parseMediaPlayerUrl(href),source=board||player;
      if(!source||source.vault!==this.app.vault.getName())return;
      e.preventDefault();e.stopPropagation();act(()=>this.plugin.openBoardMediaTimestamp(href,this,link.closest('[data-id]')?.getAttribute('data-id')||undefined));
    };
    this.registerDomEvent(this.stage,'click',openLocalMediaBoardLink,{capture:true});
    const openOnlineBoardLink=(e:MouseEvent)=>{
      if(e.defaultPrevented||e.button!==0||Keymap.isModEvent(e))return;
      const link=(e.target as Element).closest('a');
      if(!link||link.closest('.ts-inline-editor,.cm-editor,.is-editing-title'))return;
      const online=parseOnlinePlayerUrl(link.getAttribute('href')||'');
      if(!online||online.vault!==this.app.vault.getName())return;
      e.preventDefault();e.stopPropagation();act(()=>this.plugin.openBoardMediaTimestamp(link.getAttribute('href')||'',this,link.closest('[data-id]')?.getAttribute('data-id')||undefined));
    };
    this.registerDomEvent(this.stage,'click',openOnlineBoardLink,{capture:true});
    const openStageLink=(e:MouseEvent)=>{
      if(e.defaultPrevented)return;
      const link = (e.target as Element).closest('a'); if (!link) return;
      // Native editors and embeds own their links, relative source paths and pane modifiers.
      if(link.closest('.ts-inline-editor,.cm-editor,.is-editing-title,.markdown-embed,.internal-embed'))return;
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
    this.registerDomEvent(this.stage,'auxclick',e=>{
      if(e.button!==1)return;
      // Chromium on Linux dispatches PRIMARY paste after a middle auxclick,
      // even when the pan's pointerdown already prevented its default action.
      if(this.suppressMiddlePaste){this.suppressMiddlePaste=false;e.preventDefault();return;}
      if((e.target as Element).closest('a.internal-link'))openStageLink(e);
    });
    this.registerDomEvent(root,'mouseover',e=>{
      const target=(e.target as Element).closest<HTMLElement>('a.internal-link,[data-ts-note-path]');
      if(!target||target.closest('.ts-inline-editor,.is-editing-title,.markdown-embed,.internal-embed')||(e.relatedTarget instanceof Node&&target.contains(e.relatedTarget)))return;
      const id=target.closest('[data-id]')?.getAttribute('data-id'),sourcePath=this.session?.board.nodes.find(n=>n.id===id)?.file||this.file?.path||'';
      const linktext=target.dataset.tsNotePath||target.getAttribute('data-href')||target.getAttribute('href');if(!linktext)return;
      this.app.workspace.trigger('hover-link',{event:e,source:'thoughtspace',hoverParent:this.leaf,targetEl:target,linktext,sourcePath});
    });
    this.registerDomEvent(root, 'keydown', e => {if(isBrainBoard(this.session?.board))return;if(e.isTrusted)this.resumeAutomaticGeometry();this.key(e);});
    this.registerDomEvent(root, 'keyup', e => { if (e.code === 'Space') this.space = false; });
    this.registerDomEvent(root, 'focusout', () => { this.space = false; });
    this.registerDomEvent(this.stage, 'dragover', e => {
      if(e.defaultPrevented)return;
      const native=(this.app as App&{dragManager?:{draggable?:{type?:string}}}).dragManager?.draggable;
      if(['file','files','link'].includes(native?.type||'')||['Files','text/plain','text/uri-list','text/x-thoughtspace-note','text/x-thoughtspace-board',MATERIAL_DRAG].some(t=>e.dataTransfer?.types.includes(t))){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';}
    });
    this.registerDomEvent(this.stage,'paste',e=>this.handleBoardPaste(e));
    this.registerDomEvent(this.stage,'dragleave',e=>{if(!this.stage.contains(e.relatedTarget as Node|null))this.clearMaterialLanding();});
    this.registerDomEvent(this.stage,'drop',e=>this.handleBoardDrop(e));
    this.registerEvent(this.app.vault.on('modify', f => { if (f instanceof TFile && ['md','pdf'].includes(f.extension.toLowerCase())) { if (this.session?.board.nodes.some(n => n.file === f.path)){this.brainNativeRevision++;this.scheduleRender();} if(this.tab==='library'||this.tab==='tasks')this.renderSidebar(); } }));
    this.registerEvent(this.app.vault.on('create', () => {this.brainNativeRevision++;this.scheduleRender();this.renderSidebar();}));
    this.registerEvent(this.app.vault.on('delete', () => {this.brainNativeRevision++;this.scheduleRender();this.renderSidebar();}));
    this.registerEvent(this.app.vault.on('rename', () => {this.brainNativeRevision++;this.scheduleRender();this.renderSidebar();}));
    this.registerEvent(this.app.metadataCache.on('changed', file => { this.refreshMediaReferences(file);if(this.tab==='library'||this.tab==='tasks')this.renderSidebar(); if (this.session?.board.nodes.some(n => n.file === file.path)){this.brainNativeRevision++;if(!this.gesture&&!this.marquee)this.scheduleRender();} }));
    this.registerEvent(this.app.metadataCache.on('resolved',()=>{this.brainNativeRevision++;if(this.boardMindmaps.size||this.brainBoardView)this.scheduleRender();}));
    this.registerEvent(this.app.vault.on('modify', f => { if(f instanceof TFile&&mediaKind(f.path)&&this.session?.board.nodes.some(n=>n.file===f.path))this.scheduleRender();if (f instanceof TFile && isBoardFile(this.app,f) && f !== this.file) { if (this.session?.board.nodes.some(n => n.kind === 'board' && n.file === f.path)) this.scheduleRender(); this.renderSidebar(); } }));
  }
  async onLoadFile(file: TFile) {
    if(this.closed||this.closing)return;
    if(this.nativePropertiesAction)this.nativePropertiesAction.style.display=file.extension.toLowerCase()==='md'?'':'none';
    this.automaticGeometryDeferred=this.plugin.provisionalBoardGeometry.get(this.leaf)===file;this.plugin.provisionalBoardGeometry.delete(this.leaf);
    this.cancelSaveFeedbackNavigation();const epoch=++this.dialogEpoch,active=()=>epoch===this.dialogEpoch&&!this.closed&&!this.closing;this.blankClicks.cancel();this.blankClickOwner=undefined;
    this.clearBrainBoard();this.tourBar?.remove();this.tourBar=undefined;this.searchModal?.close();this.searchModal=undefined;this.reuseModal?.close();this.reuseModal=undefined;this.savedViewsModal?.close();this.savedViewsModal=undefined;this.groupOrganizer?.close();this.groupOrganizer=undefined;this.layoutPlannerModal?.close();this.layoutPlannerModal=undefined;
    this.finishMarquee(true); this.setSectionTool(false); this.selectionTool = false; this.syncSelectionTool();
    this.viewTrail.clear();this.outlineCollapsed.clear();this.objectFilter={kind:'',color:'',query:''};this.contextOpen=false;this.relatedFocus=undefined;this.relationLens=undefined;this.clearNodes();this.unsubscribe?.();this.unsubscribe=undefined; this.selected.clear(); this.selectedEdge = undefined; this.connectFrom = undefined;this.connectSide=undefined;this.stage?.removeClass('ts-connecting'); this.mode = 'select'; this.connectButton?.removeClass('is-active');
    try {
      const s = await this.plugin.session(file);if(!active()){await this.plugin.release(s);return;}this.session = s;this.contentEl.querySelectorAll<HTMLElement>('.ts-board-rail,.ts-floating-formatbar,.ts-footer').forEach(el=>el.inert=false); s.listeners.add(this.paint);
      let subscribed=true;this.unsubscribe = () => {if(!subscribed)return;subscribed=false; s.listeners.delete(this.paint); act(() => this.plugin.release(s)); };
      if (!this.svg.isConnected) { this.world.empty(); this.svg = this.world.createSvg('svg', { cls: 'ts-edges' });this.edgeLayer=new EdgeLayer(this.svg,this.markerId,id=>this.labelEdge(id)); }
      this.fitLegacyGeometry();
      this.paint();await this.plugin.ensureDock(false);if(!active())return;if(this.app.workspace.getActiveViewOfType(BoardView)===this)this.plugin.currentBoard=this;this.plugin.refreshDock();
    } catch (e) {if(!active())return;this.unsubscribe?.();this.unsubscribe=undefined; this.session = undefined;this.contentEl.querySelectorAll<HTMLElement>('.ts-board-rail,.ts-floating-formatbar,.ts-footer').forEach(el=>el.inert=true);this.minimap?.empty();this.inspector?.removeClass('is-visible');this.selectionTools?.empty();this.selectionHeading?.empty();this.world.style.removeProperty('transform'); this.world.empty(); this.status.setText('文件无法读取 · 原文件保持不变'); const error=this.world.createDiv({ cls: 'ts-error', text: `无法打开白板：${String(e)}。原文件保留，请检查布局区或恢复备份。` });if(file.extension.toLowerCase()==='md')button(error,'打开 Markdown 修复','file-pen-line',()=>this.plugin.openBoardNativeMarkdown(file,this.leaf));report(e); }
  }
  private fitLegacyGeometry(){
    const owner=this.session;if(!owner||owner.blocked||this.automaticGeometryDeferred||isBrainBoard(owner.board))return;
    const legacy=(n:Card)=>textFitsContent(n)&&n.topic&&n.autoSize===undefined&&!owner.relationGeometryHeld?.(n);
    if(owner.board.nodes.some(legacy))owner.change(b=>b.nodes.filter(legacy).forEach(n=>fitTextNode(n,this.contentEl)));
  }
  // A provisional usage lookup may load a native tab, but cannot write measured
  // geometry until navigation commits or the user explicitly opens/interacts with it.
  resumeAutomaticGeometry(){
    if(!this.automaticGeometryDeferred||!this.session||this.session.file!==this.file||this.closed||this.closing)return;
    this.automaticGeometryDeferred=false;this.pendingFits.clear();this.deferredCardFits.clear();
    this.fitLegacyGeometry();this.paint();this.refreshFontMetrics();
  }
  async onUnloadFile() {this.cancelSaveFeedbackNavigation(); const epoch=++this.dialogEpoch,owner=this.session;this.clearBrainBoard();this.blankClicks.cancel();this.blankClickOwner=undefined;this.searchModal?.close();this.searchModal=undefined;this.reuseModal?.close();this.reuseModal=undefined;this.savedViewsModal?.close();this.savedViewsModal=undefined;this.groupOrganizer?.close();this.groupOrganizer=undefined;this.layoutPlannerModal?.close();this.layoutPlannerModal=undefined;await this.finishInlineForNavigation();if(epoch!==this.dialogEpoch||this.closed||this.closing)return; if(this.plugin.currentBoard===this)this.plugin.clearMaterialDrag();this.clearCanvasGesture();this.clearNodes();this.finishMarquee(true); this.sidebarRun++; this.unsubscribe?.(); this.unsubscribe = undefined; if (owner) await owner.flush();if(epoch!==this.dialogEpoch||this.closed||this.closing||this.session!==owner)return; this.session = undefined;this.plugin.refreshLocalRelations?.(this);this.plugin.refreshDock(); }
  async onClose() {
    this.canvasBackgroundDialog?.close();this.canvasBackgroundDialog=undefined;
    if(this.closed)return;this.cancelSaveFeedbackNavigation();const owner=this.session;this.closing=true;
    try{this.clearBrainBoard();++this.dialogEpoch;this.blankClicks.cancel();this.blankClickOwner=undefined;this.objectMenu?.hide();this.searchModal?.close();this.searchModal=undefined;this.reuseModal?.close();this.reuseModal=undefined;this.savedViewsModal?.close();this.savedViewsModal=undefined;this.groupOrganizer?.close();this.groupOrganizer=undefined;this.layoutPlannerModal?.close();this.layoutPlannerModal=undefined;
      await this.finishInlineForNavigation();if(this.closed)return;if(this.plugin.currentBoard===this)this.plugin.clearMaterialDrag();this.clearCanvasGesture();if(owner)await owner.flush();if(this.closed)return;this.closed=true;this.plugin.refreshLocalRelations?.(this);this.plugin.refreshDock();this.sidebar?.remove(); this.finishMarquee(true); this.sidebarRun++; if (this.sidebarTimer) window.clearTimeout(this.sidebarTimer); this.unsubscribe?.();this.unsubscribe=undefined;this.session=undefined; (this.contentEl?.ownerDocument?.defaultView||window).cancelAnimationFrame(this.renderFrame);this.clearNodes();
    }catch(error){if(!this.closed)this.closing=false;throw error;}
  }
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
      const board=emptyBoard(),markdown=owner.file.extension.toLowerCase()==='md';const file = await this.plugin.createUnique(`${ROOT}/白板`, title, markdown?'md':EXT,markdown?createMarkdownBoardDocument(board,title):JSON.stringify(board,null,2));
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
      const markdown=owner.file.extension.toLowerCase()==='md';const file = await this.plugin.createUnique(`${ROOT}/白板`, title, markdown?'md':EXT,markdown?createMarkdownBoardDocument(result.child,title):JSON.stringify(result.child,null,2));
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
    const counts:Record<Card['kind'],number>={card:0,board:0,text:0,image:0,pdf:0,audio:0,video:0,section:0,mindmap:0};for(const node of b.nodes)counts[node.kind]++;
    this.boardStats.setText(`${counts.card} 张卡片  ·  ${counts.mindmap?`${counts.mindmap} 个脑图  ·  `:''}${counts.board} 个子白板  ·  ${counts.text} 文本  ·  ${counts.image} 图片  ·  ${counts.pdf} PDF  ·  ${b.edges.length} 条关系`);
    if (this.trail.length) button(this.crumbs, '返回上级', 'corner-left-up', () => this.navigate(this.trail[this.trail.length - 1], this.trail.slice(0, -1)), 'ts-back-parent');
  }
  private mapPreview(parent: HTMLElement, board: Board, interactive = false) {
    const width = 300, height = 136, visible = board.nodes;
    const map = parent.createSvg('svg', { cls: 'ts-map-svg', attr: { viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' } });
    if (!visible.length) { parent.createSpan({ cls: 'ts-map-empty', text: '一个新的思考空间' }); return; }
    // fitViewport 用于主白板时限制最小缩放，缩略图需要允许更小比例。
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    const byId=new Map<string,Card>(),sections:Card[]=[],objects:Card[]=[];
    // Bounds, endpoints and stable section-first stacking share one traversal.
    for(const node of visible){left=Math.min(left,node.x);top=Math.min(top,node.y);right=Math.max(right,node.x+node.width);bottom=Math.max(bottom,node.y+node.height);byId.set(node.id,node);(node.kind==='section'?sections:objects).push(node);}
    const w=right-left,h=bottom-top;
    let z = Math.min((width - 24) / w, (height - 24) / h), ox = (width - w * z) / 2 - left * z, oy = (height - h * z) / 2 - top * z;
    const rects=new Map<string,SVGRectElement>(),lines=new Map<string,SVGLineElement>(),geometry=new Map<string,number[]>();
    for (const edge of board.edges) {
      const a = byId.get(edge.from), b = byId.get(edge.to); if (!a || !b) continue;
      const line=map.createSvg('line', { cls: 'ts-map-edge', attr: { x1: (a.x + a.width / 2) * z + ox, y1: (a.y + a.height / 2) * z + oy, x2: (b.x + b.width / 2) * z + ox, y2: (b.y + b.height / 2) * z + oy } });lines.set(edge.id,line);
    }
    for (const bucket of [sections,objects]) for (const n of bucket) {
      const rect = map.createSvg('rect', { cls: 'ts-map-node', attr: { x: n.x * z + ox, y: n.y * z + oy, width: n.width * z, height: n.height * z, rx: 3 } });
      if(interactive){rects.set(n.id,rect);geometry.set(n.id,[n.x,n.y,n.width,n.height]);}
      rect.classList.add(`ts-color-${n.color}`);if((n.kind==='card'||n.kind==='text'||n.kind==='section')&&n.transparent)rect.classList.add('is-transparent');else if((n.kind==='card'||n.kind==='text'||n.kind==='section')&&n.fillColor&&n.fillColor!=='none')rect.style.fill=n.fillColor.startsWith('#')?n.fillColor:cardFillHex[n.fillColor as Card['color']]; if (n.kind === 'section') rect.classList.add('ts-map-section');
      if (!interactive && n.kind !== 'section' && n.width * z > 58 && n.height * z > 28) {
        const label = map.createSvg('text', { cls: 'ts-map-title', attr: { x: n.x * z + ox + 5, y: n.y * z + oy + 13 } });
        const title = n.title || n.file?.split('/').pop()?.replace(/\.(md|thoughtspace)$/, '') || n.text?.slice(0,10).split('\n')[0] || '';
        label.textContent = title.length > 9 ? title.slice(0, 8) + '…' : title;
      }
    }
    if (interactive) {
      const structure=(b:Board)=>{const parts:string[]=[];for(const n of b.nodes)parts.push(JSON.stringify([n.id,n.kind,n.color,n.fillColor,n.transparent]));for(const e of b.edges)parts.push(JSON.stringify([e.id,e.from,e.to]));return parts.join('\n');},stamp=structure(board);
      this.mapRefresh=next=>{
        if(!next.nodes.length||structure(next)!==stamp)return false;
        let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;const index=new Map<string,Card>();
        for(const n of next.nodes){left=Math.min(left,n.x);top=Math.min(top,n.y);right=Math.max(right,n.x+n.width);bottom=Math.max(bottom,n.y+n.height);index.set(n.id,n);}
        const w=right-left,h=bottom-top,nz=Math.min((width-24)/w,(height-24)/h),nx=(width-w*nz)/2-left*nz,ny=(height-h*nz)/2-top*nz,transformChanged=nz!==z||nx!==ox||ny!==oy;z=nz;ox=nx;oy=ny;
        const update=(el:SVGElement,attrs:Record<string,number>)=>{for(const [key,value]of Object.entries(attrs)){const text=String(value);if(el.getAttribute(key)!==text)el.setAttribute(key,text);}};
        for(const n of next.nodes){const old=geometry.get(n.id)!;if(!transformChanged&&old[0]===n.x&&old[1]===n.y&&old[2]===n.width&&old[3]===n.height)continue;update(rects.get(n.id)!,{x:n.x*z+ox,y:n.y*z+oy,width:n.width*z,height:n.height*z});geometry.set(n.id,[n.x,n.y,n.width,n.height]);}
        for(const e of next.edges){const a=index.get(e.from),b=index.get(e.to),line=lines.get(e.id);if(a&&b&&line)update(line,{x1:(a.x+a.width/2)*z+ox,y1:(a.y+a.height/2)*z+oy,x2:(b.x+b.width/2)*z+ox,y2:(b.y+b.height/2)*z+oy});}
        return true;
      };
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
  private renderMinimap(branches?:BranchRenderSnapshot) {
    if (!this.minimap || !this.session) return;
    if(!this.plugin.settings.showMinimap){if(this.mapKey)this.minimap.empty();this.mapKey='';this.mapViewport=undefined;this.mapRefresh=undefined;return;} const display=branches?branches.visible(this.session.board):visibleBranchBoard(this.session.board);const key=JSON.stringify([display.nodes.map(n=>[n.id,n.kind,n.x,n.y,n.width,n.height,n.color,n.fillColor,n.transparent]),display.edges.map(e=>[e.from,e.to])]);if(key===this.mapKey){this.mapViewport?.();return;}if(this.mapRefresh?.(display)){this.mapKey=key;this.mapViewport?.();return;}this.mapKey=key;this.mapViewport=undefined;this.mapRefresh=undefined;this.minimap.empty();
    this.minimap.createSpan({ text: '总览', cls: 'ts-map-label' }); this.mapPreview(this.minimap, display, true);
    this.minimap.toggleClass('is-empty', !this.session.board.nodes.length);
  }
  private handleBoardPaste(e:ClipboardEvent){
    // Native note/text editors own their clipboard. A selected object or canvas
    // child still counts as board focus, so pasting a URL is not stage-only.
    const target=e.target as HTMLElement|null;
    if(e.defaultPrevented||target?.closest?.('input,textarea,[contenteditable]:not([contenteditable="false"]),.cm-editor'))return;
    const files=Array.from(e.clipboardData?.files||[]).filter(f=>isImage(f.name));
    if(files.length){e.preventDefault();act(()=>this.importImages(files));return;}
    const text=e.clipboardData?.getData('text/plain')||e.clipboardData?.getData('text/uri-list');
    if(!text?.trim())return;e.preventDefault();act(()=>webUrl(text)?this.addWebCard(text):this.pasteTexts(text,false));
  }
  private handleBoardDrop(e:DragEvent){
    if(e.defaultPrevented)return;const transfer=e.dataTransfer;if(!transfer)return;
    // Snapshot native files while the drag is alive. Window-level drop cleanup
    // clears dragManager immediately, before an inline editor may finish saving.
    const owner=this.session,position=()=>this.point(e.clientX,e.clientY);
    if(transfer.types.includes(MATERIAL_DRAG)){e.preventDefault();e.stopPropagation();act(()=>this.plugin.receiveMaterial(e,this,this.materialDropPoint(e.clientX,e.clientY)));return;}
    const customPath=transfer.getData('text/x-thoughtspace-note')||transfer.getData('text/x-thoughtspace-board');
    if(customPath){
      e.preventDefault();const file=this.app.vault.getAbstractFileByPath(customPath);
      act(async()=>{this.requireOwner(owner);const point=position();if(!(file instanceof TFile))throw Error('文件已移动或删除，请重新拖入');
        if(isBoardFile(this.app,file)){if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);if(this.app.vault.getAbstractFileByPath(customPath)!==file)throw Error('白板已移动或删除，请重新拖入');await this.addBoard(file,point,owner);}
        else await this.insertDroppedNotes([{file,path:customPath,page:1}],point,owner);
      });return;
    }
    const native=(this.app as App&{dragManager?:{draggable?:unknown}}).dragManager?.draggable;
    const result=resolveNativeNoteDrop<TFile>({vaultName:this.app.vault.getName(),
      isFile:(value):value is TFile=>value instanceof TFile,
      getFile:path=>{const file=this.app.vault.getAbstractFileByPath(path);return file instanceof TFile?file:undefined;},
      resolve:(link,path)=>this.app.metadataCache.getFirstLinkpathDest(parseLinktext(link).path,path)||undefined,
    },transfer,native,this.file?.path||'');
    if(result.handled){
      // Obsidian's parent drop handler checks defaultPrevented. Keep bubbling so
      // its window handler can clear the native draggable and remove the ghost.
      e.preventDefault();act(()=>this.insertDroppedNotes(result.references,position(),owner));return;
    }
    if(transfer.files.length){e.preventDefault();const files=Array.from(transfer.files);act(()=>this.importBoardAttachments(files,position()));return;}
    if(native===undefined||native===null){const candidate=(transfer.getData('text/uri-list')||transfer.getData('text/plain')).trim();if(webUrl(candidate)){e.preventDefault();act(async()=>{this.requireOwner(owner);await this.addWebCard(candidate,position());});return;}}
    // A rejected native/URI payload must not be rescued by an unrelated PDF display label.
    if((native!==undefined&&native!==null)||transfer.getData('text/uri-list').trim())return;
    const ref=pdfDropReference(transfer.getData('text/plain'));
    if(ref){const file=this.app.metadataCache.getFirstLinkpathDest(ref.path,this.file?.path||'');if(file instanceof TFile&&isPdfFile(file.path)){e.preventDefault();act(()=>this.insertDroppedNotes([{file,path:file.path,page:ref.page}],position(),owner));}}
  }
  private async insertDroppedNotes(references:NativeNoteReference<TFile>[],position:{x:number;y:number},owner=this.session){
    this.requireOwner(owner);const entries=references.map(ref=>({...ref}));
    if(!entries.length)throw Error('拖入的文件中有不支持、已移动或已删除的项目，整批未插入，请重新拖入');
    if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    const valid=()=>entries.every(({file,path})=>file instanceof TFile&&file.path===path&&this.app.vault.getAbstractFileByPath(path)===file&&isWorkspaceFile(file)&&(file.extension.toLowerCase()==='md'||isPdfFile(path)||isImage(path)||!!mediaKind(path)));
    if(!valid())throw Error('拖入的文件有变化或不受支持，整批未插入，请重新拖入');
    const width=this.plugin.settings.defaultCardWidth;
    const sizes=await measureDroppedImages(entries,width,this.stage.ownerDocument,file=>this.app.vault.getResourcePath(file),()=>!this.closed&&this.session===owner&&!owner!.blocked&&valid());
    this.requireOwner(owner);if(!valid())throw Error('文件在拖入时发生变化，整批未插入，请重试');
    const used=new Set([...owner!.board.nodes,...owner!.board.edges].map(n=>n.id)),nodes:Card[]=[];
    let rowY=position.y-70,rowHeight=0,columnX=position.x-width/2;
    for(let i=0;i<entries.length;i++){
      const {path,page,start}=entries[i];
      if(i&&i%3===0){rowY+=rowHeight+32;rowHeight=0;columnX=position.x-width/2;}
      const id=uid();if(!id||used.has(id))throw Error('对象标识冲突，请重试');used.add(id);
      const size=sizes.get(path)||{width,height:width*.75};
      const node:Card=mediaKind(path)?mediaCard(id,path,columnX+width/2,rowY+70,width,start):isPdfFile(path)?{...pdfCard(id,path,columnX+width/2,rowY+70,width),pdfPage:pdfPage(page)}:isImage(path)?{id,kind:'image',file:path,x:columnX,y:rowY,...size,color:'blue'}:{id,kind:'card',transparent:true,file:path,x:columnX,y:rowY,width,height:270,color:'sand',autoFit:true,preferredWidth:width};
      applyDefaultCardStyle(node,this.plugin.settings.defaultCardStyle);
      columnX+=node.width+32;rowHeight=Math.max(rowHeight,node.height);nodes.push(node);
    }
    // One insertion transaction: undo removes the whole batch, without creating
    // or rewriting notes and without moving the user's camera.
    owner!.change(b=>{b.version=3;for(const node of nodes)b.nodes.push(node);});
    this.selected=new Set(nodes.map(n=>n.id));this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();this.stage.focus({preventScroll:true});
  }
  private async importBoardAttachments(files:File[],position=this.point()) {
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    let offset=0;
    if(files.some(f=>!!mediaKind(f.name)&&f.size>128*1024*1024))throw Error('大于 128 MB 的音视频请先放入仓库，再从文件列表拖入白板，避免整段媒体占用内存');
    for(const input of files.filter(f=>isPdfFile(f.name)||!!mediaKind(f.name))) {
      this.requireOwner(owner);const bytes=await input.arrayBuffer();this.requireOwner(owner);
      const path=await this.app.fileManager.getAvailablePathForAttachment(input.name,owner.file.path);this.requireOwner(owner);
      const file=await this.app.vault.createBinary(path,bytes);
      if(this.session!==owner||this.closed||owner.blocked){new Notice(`附件已保存：${file.path}；白板已切换，未添加卡片`);return;}
      this.addFile(file,{x:position.x+offset,y:position.y+offset});offset+=32;
    }
    const images=files.filter(f=>isImage(f.name));if(images.length){this.requireOwner(owner);await this.importImages(images,{x:position.x+offset,y:position.y+offset});}
  }
  private refreshMediaReferences(file:TFile){
    if(!this.session||this.closed)return;let changed=false;
    for(const node of this.session.board.nodes){
      if(node.kind!=='text'||!node.text?.startsWith('!'))continue;
      const source=resolveSourceLink(node.text.slice(1),path=>this.app.metadataCache.getFirstLinkpathDest(path,this.file!.path));
      if(source.file!==file||!/^#\^thoughtspace-media-[-a-z0-9]+$/i.test(source.subpath))continue;
      this.nodeKeys.delete(node.id);changed=true;
    }
    if(changed&&!this.gesture&&!this.marquee)this.scheduleRender();
  }
  async addWorkspaceMedia(file:TFile,moment?:MediaMoment,reference?:string){
    const owner=this.requireOwner(),path=file.path,stamp=file.stat.mtime,size=file.stat.size;
    const ensure=()=>{this.requireOwner(owner);if(file.path!==path||file.stat.mtime!==stamp||file.stat.size!==size||this.app.vault.getAbstractFileByPath(path)!==file||!isWorkspaceFile(file)||!mediaKind(path))throw Error('来源媒体已变化，请重试');};
    if(this.inline&&!await this.inline.commit())return;ensure();
    const point=this.point(),saved=this.plugin.mediaWorkspace.playback.get(this.plugin.mediaWorkspace.identity(file));
    const time=mediaTime(moment?.time??saved?.time??0),existing=owner.board.nodes.find(n=>(n.kind==='audio'||n.kind==='video')&&n.file===path);
    if(!moment&&existing){this.selected=new Set([existing.id]);this.selectedEdge=undefined;this.updateSelection();return;}
    const media=existing||mediaCard(uid(),path,point.x,point.y,this.plugin.settings.defaultCardWidth,time),next=uid();
    const text=reference||(moment?[moment.image,moment.text,`[${mediaClock(time)} · 回到媒体](${mediaPlayerUrl({vault:this.app.vault.getName(),file:path},time)})`].filter(Boolean).join('\n\n'):undefined);
    const linked=reference&&owner.board.nodes.find(n=>n.kind==='text'&&n.text===reference);if(linked){this.selected=new Set([linked.id]);this.selectedEdge=undefined;this.updateSelection();return;}
    let y=media.y;const x=media.x+media.width+48,width=reference?360:300,height=reference?(moment?.image?400:240):180;
    if(moment)for(const other of owner.board.nodes)if(other.x<x+width&&other.x+other.width>x&&other.y<y+height&&other.y+other.height>y)y=other.y+other.height+24;
    owner.change(board=>{board.version=3;if(!existing)board.nodes.push(media);if(text){board.nodes.push({id:next,kind:'text',text,x,y,width,height,color:'slate',fontSize:this.plugin.settings.defaultTextSize,autoSize:false});board.edges.push({id:uid(),from:media.id,to:next,label:mediaClock(time),style:this.plugin.settings.defaultEdgeStyle,direction:'forward'});}});
    this.selected=new Set([text?next:media.id]);this.selectedEdge=undefined;this.updateSelection();
  }
  async insertMediaCard(position=this.point(),kind?:'audio'|'video'){
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    const app=this.app,accept=(file:TFile)=>{this.requireOwner(owner);if(app.vault.getAbstractFileByPath(file.path)!==file||!mediaKind(file.path)||!isWorkspaceFile(file))throw Error('媒体已移动或删除，请重新选择');this.addFile(file,position);this.contextOpen=false;this.updateSelection();this.stage.focus({preventScroll:true});};
    this.plugin.pickMediaFile(accept,kind,url=>{this.requireOwner(owner);return this.addWebCard(url,position);});
  }
  async insertPdfCard(position=this.point(),initial?:TFile,page=1) {
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    const accept=(file:TFile)=>{this.requireOwner(owner);if(this.app.vault.getAbstractFileByPath(file.path)!==file||!isPdfFile(file.path)||!isWorkspaceFile(file))throw Error('PDF 已移动或删除，请重新选择');this.addFile(file,position,page);this.contextOpen=false;this.updateSelection();this.stage.focus();};
    if(initial){accept(initial);return;}new ReadingSourcePicker(this.app,accept,true).open();
  }
  async insertExistingNote(position=this.point()) {
    if(isBrainBoard(this.session?.board)){this.addBrainObject('note');return;}
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
    if(mediaKind(file.path)){const id=uid();this.selected=new Set([id]);this.selectedEdge=undefined;this.mutate(b=>{b.version=3;b.nodes.push(mediaCard(id,file.path,position.x,position.y,this.plugin.settings.defaultCardWidth));});return;}
    if(file.extension!=='md')throw Error('仅支持 Markdown、PDF、音频或视频卡片');
    const id = uid(); this.selected = new Set([id]); this.selectedEdge = undefined;
    this.mutate(b => b.nodes.push(applyDefaultCardStyle({ id, kind:'card',transparent:true, file: file.path, x: position.x - this.plugin.settings.defaultCardWidth/2, y: position.y - 70, width: this.plugin.settings.defaultCardWidth, height: 270, color: 'sand', autoFit:true,preferredWidth:this.plugin.settings.defaultCardWidth },this.plugin.settings.defaultCardStyle)));
  }
  private async newCard(position = this.point()) {
    if(isBrainBoard(this.session?.board)){this.addBrainObject('new-note');return;}
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
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
    const added=new Set(ids);for(const n of draft.nodes)if(added.has(n.id))applyDefaultCardStyle(n,this.plugin.settings.defaultCardStyle);
    owner!.change(()=>{owner!.board=draft;});this.selected=new Set(ids);this.contextOpen=false;this.updateSelection();this.revealNode(ids[0]);await owner!.flush();return ids.length;
  }
  private requireOwner(owner=this.session){owner?.refreshNativeEditing();if(!owner||this.closed||this.session!==owner||owner.blocked)throw new Error('白板已切换或暂停写入，请回到原白板重试');return owner;}
  private canCreateBlankText(e:MouseEvent){return !!this.session&&!this.closed&&!this.session.blocked&&!this.blankTextCreating&&!this.inlineExit&&!this.space&&!this.sectionTool&&this.mode!=='connect'&&e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&(e.target===this.stage||e.target===this.world||e.target===this.svg);}
  private async blankDoubleClick(e:MouseEvent){
    const clean=this.blankClicks.consume();
    if(!clean||this.blankClickOwner!==this.session||!this.canCreateBlankText(e)||this.gesture||this.marquee||this.rightMarquee||this.linkDrag)return;
    e.preventDefault();e.stopPropagation();this.blankTextCreating=true;
    try{
      const owner=this.requireOwner(),point=this.point(e.clientX,e.clientY),section=sectionAtPoint(visibleBranchBoard(owner.board).nodes,point);
      if(section){
        if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
        const current=owner.board.nodes.find(n=>n.id===section.id);if(!current||current.kind!=='section')return;
        this.selected=new Set([current.id]);this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();
        if(current.locked)new Notice('分组已锁定，解锁后可调整边框');
        return;
      }
      await this.newText(point);
    }finally{this.blankTextCreating=false;}
  }
  async newText(position=this.point(),topic=false){const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    const id=uid();owner.change(b=>{b.version=3;if(topic)b.mode='mindmap';const node:Card={id,kind:'text',text:topic?'中心主题':'',topic,...(topic?{mindmapRules:{layout:b.mindmapLayout||'right',density:b.mindmapDensity||'standard',automatic:true} as NonNullable<Card['mindmapRules']>}:{}),x:position.x-40,y:position.y-30,width:topic?80:280,height:topic?60:140,color:topic?'green':'sand',fontSize:this.plugin.settings.defaultTextSize,autoSize:true};if(topic)fitTextNode(node,this.contentEl);b.nodes.push(node);});this.selected=new Set([id]);this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();await this.startInlineEdit(id,topic,true);
  }
  async newTable(position=this.point()){
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    const template=markdownEdit('',0,0,'table'),id=uid();
    owner.change(b=>{b.version=3;b.nodes.push({id,kind:'text',text:template.text,transparent:true,x:position.x-40,y:position.y-30,width:520,height:180,textMaxWidth:720,color:'sand',fontSize:this.plugin.settings.defaultTextSize,autoSize:true});});
    this.selected=new Set([id]);this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();await this.startInlineEdit(id,false,true);
    if(this.session===owner&&this.inlineId===id)this.inline?.input.setSelectionRange(template.start,template.end);
  }
  newWebCard(position=this.point()){
    const owner=this.requireOwner();new Prompt(this.app,'网页链接','https://',value=>{this.requireOwner(owner);return this.addWebCard(value,position);}).open();
  }
  async addWebCard(input:string,position=this.point()){
    const owner=this.requireOwner();if(/^https:\/\/b23\.tv\//.test(input.trim())){const resolved=await resolveOnlineSource(input);this.requireOwner(owner);input=resolved.path+(resolved.path.includes('?')?'&':'?')+'t='+resolved.initialTime;}const node=webCard(input,uid(),position);if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    owner.change(b=>{b.version=3;b.nodes.push(node);});this.selected=new Set([node.id]);this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();
  }
  private editWebCard(id:string){
    const owner=this.requireOwner(),node=owner.board.nodes.find(n=>n.id===id);if(!node?.webUrl||node.locked)return;const previous=node.webUrl;
    new Prompt(this.app,'修改网页链接',previous,value=>{this.requireOwner(owner);const current=owner.board.nodes.find(n=>n.id===id);if(!current||current.webUrl!==previous||current.locked)throw Error('网页已变化，请重新编辑');owner.change(b=>updateWebCard(b.nodes.find(n=>n.id===id)!,value));}).open();
  }
  private openWebCard(id:string){const node=this.session?.board.nodes.find(n=>n.id===id),url=webUrl(node?.webUrl);if(url)this.contentEl.ownerDocument.defaultView?.open(url,'_blank','noopener,noreferrer');}
  private copyWebCard(id:string){const url=webUrl(this.session?.board.nodes.find(n=>n.id===id)?.webUrl);if(url)act(async()=>{await navigator.clipboard.writeText(url);new Notice('已复制网页链接');});}
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
    if(node.webUrl){this.editWebCard(id);return;}
    const kind=node.kind,file=kind==='card'?this.app.vault.getAbstractFileByPath(node.file!):undefined;if(kind==='card'&&!(file instanceof TFile))throw Error('原笔记不存在，请先重新关联');
    let original:string;
    try{original=file instanceof TFile?await readCurrentNativeNote(this.app,file):node.text||'';}
    catch(error){if(request!==this.inlineStart||this.closed)return;throw error;}
    if(request!==this.inlineStart)return;this.requireOwner(owner);const latest=owner.board.nodes.find(n=>n.id===id);if(!latest||latest.locked||latest.kind!==kind)throw Error('对象已变化，请重新打开编辑');
    if(file instanceof TFile&&(latest.file!==file.path||this.app.vault.getAbstractFileByPath(file.path)!==file))throw Error('关联笔记已改变，请重新打开卡片编辑');
    node=latest;
    this.inlineTarget=id;this.selected=new Set([id]);this.selectedEdge=undefined;this.contextOpen=false;
    if(node.collapsed||node.branchFolded)owner.change(b=>{foldCards(b,new Set([id]),false);const current=b.nodes.find(n=>n.id===id);if(current)delete current.branchFolded;});
    if(preserveViewport){
      // Creation owns selection and focus, but must not pan or zoom the canvas.
      // Keep a new object visible after its temporary editing pin is released.
      if(branchState(owner.board).hidden.has(id))owner.change(b=>unfoldAncestors(b,id));
      this.clearCanvasGesture();this.app.workspace.setActiveLeaf(this.leaf,{focus:true});
      this.mode='select';this.connectFrom=undefined;this.connectSide=undefined;this.stage.removeClass('ts-connecting');this.connectButton?.removeClass('is-active');this.updateSelection();
    }else{if(owner.board.viewport.zoom<.75)owner.board.viewport.zoom=.9;this.revealNode(id);}
    this.renderBoard();const el=this.positions.get(id);if(!el){this.inlineTarget=undefined;return;}
    this.pendingFits.delete(id);this.inlineStyleKey=this.nodeAppearanceKey(node);this.inlineMeasureKey=this.nodeMeasureKey(node);let editor:InlineNodeEditor;let draftSize:{width:number;height:number}|undefined;let draftMeasureKey:string|undefined;let lastDraftValue=original;
    const cardFit=node.kind==='card'&&node.autoFit?new InlineCardFit(this.app,el.querySelector<HTMLElement>('.ts-card-preview')!,file!.path,node.preferredWidth,size=>{draftSize=size;if(this.session===owner)this.applyInlineSize(id,size);editor?.syncGeometry();}):undefined;
    let editHeight=0;
    const applyTextSize=()=>{const current=owner.board.nodes.find(n=>n.id===id);if(this.session!==owner||this.closed||owner.blocked||this.inlineTarget!==id||current?.kind!=='text'||current.locked)return;const size=draftSize&&textFitsContent(current)&&draftMeasureKey===this.nodeMeasureKey(current)?draftSize:current;this.applyInlineSize(id,{width:size.width,height:Math.max(size.height,editHeight)});editor?.syncGeometry();};
    const textFit=node.kind==='text'?new InlineTextFit(this.app,el.querySelector<HTMLElement>('.ts-text-body')!,owner.file.path,()=>owner.board.nodes.find(n=>n.id===id),size=>{draftSize=size;const current=owner.board.nodes.find(n=>n.id===id);draftMeasureKey=current?this.nodeMeasureKey(current):undefined;applyTextSize();}):undefined;
    const end=()=>{if(this.inline===editor){const doc=this.contentEl.ownerDocument,restore=editor.ownsFocus(doc.activeElement)||doc.activeElement===doc.body;this.endInline();if(restore)this.stage.focus();}};
    editor=new InlineNodeEditor(el,{createLinkedNote:(name,source)=>this.plugin.createConceptLinkNote(name,source),app:this.app,file:file instanceof TFile?file:undefined,contextFile:owner.file,nodeKind:kind==='text'?'text':'card',value:original,label:node.kind==='text'?'编辑白板 Markdown':'编辑卡片 Markdown',selectAll,continueTopic:node.kind==='text'&&owner.board.mode==='mindmap'?sibling=>this.addTopic(sibling,id):undefined,placeholder:'写下内容，支持 Markdown、公式和表格…',markdown:true,focusWithin:active=>!!active&&!!this.selectionTools?.closest('.ts-floating-formatbar')?.contains(active),
      temporaryHeight:kind==='text'?height=>{if(Number.isFinite(height)&&height>=40&&height<=1200&&height!==editHeight){editHeight=height;applyTextSize();}}:undefined,
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
          else{if(current.text!==original)throw Error('原文本已变化，未覆盖。请复制草稿后重新编辑');owner.change(b=>{const n=b.nodes.find(n=>n.id===id)!;n.text=value;if(textFitsContent(n)){if(draftSize&&draftMeasureKey===this.nodeMeasureKey(n))Object.assign(n,draftSize);else fitTextNode(n,this.contentEl);}});}}
        // Content is committed. A changed/removed card must not receive an old draft size.
        const latest=owner.board.nodes.find(n=>n.id===id);
        if(draftSize&&Number.isFinite(draftSize.width)&&Number.isFinite(draftSize.height)&&draftSize.width>=80&&draftSize.height>=60&&value!==original&&this.session===owner&&!this.closed&&!owner.blocked&&latest?.kind===kind&&!latest.locked&&latest.autoFit&&latest.file===file?.path&&latest.width===sizeBefore.width&&latest.height===sizeBefore.height&&this.nodeAppearanceKey(latest)===sizeBefore.appearance){
          const size=draftSize;
          if(latest.width!==size.width||latest.height!==size.height)owner.change(b=>Object.assign(b.nodes.find(n=>n.id===id)!,size),clone(owner.board),false,false,true);
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
      owner!.change(b=>{const n=b.nodes.find(n=>n.id===id)!;n.kind='card';n.transparent=true;n.file=file.path;delete n.text;delete n.webUrl;delete n.textColor;delete n.fontSize;delete n.fontFamily;delete n.textAlign;delete n.autoSize;delete n.textAutoHeight;delete n.textMaxWidth;delete n.videoCapture;applyDefaultCardStyle(n,this.plugin.settings.defaultCardStyle);n.width=Math.max(280,n.width);
        // Keep the user's folded state; the expanded note owns the larger size.
        if(n.collapsed){n.expandedHeight=Math.max(220,n.expandedHeight!);n.height=72;}else n.height=Math.max(220,n.height);
      });await owner!.flush();
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
    const originalPath=file.path,originalUrl=node.imageUrl,originalStamp={mtime:file.stat.mtime,size:file.stat.size},boardPath=this.file!.path;this.hostedUploads.add(nodeId);
    const validateSource=()=>{this.requireOwner(owner);if(file.path!==originalPath||this.app.vault.getAbstractFileByPath(originalPath)!==file||file.stat.mtime!==originalStamp.mtime||file.stat.size!==originalStamp.size)throw Error('图片来源已变化，云端结果未覆盖当前引用');};
    try{const bytes=await this.app.vault.readBinary(file);validateSource();
      const url=await uploadHostedImage(this.app,bytes,file.name,boardPath);
      validateSource();const current=owner.board.nodes.find(n=>n.id===nodeId);
      if(!current||current.locked||current.kind!=='image'||current.file!==originalPath||current.imageUrl!==originalUrl)throw Error('图片引用已变化，本地图片保留，云端结果未覆盖当前内容');
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
  private measureMinimap(){
    const map=this.minimap,stage=this.stage;if(!map||!stage)return;const r=map.getBoundingClientRect(),s=stage.getBoundingClientRect();
    this.minimapObstacle=this.plugin.settings.showMinimap&&r.width>0&&r.height>0?{x:r.left-s.left,y:r.top-s.top,width:r.width,height:r.height}:undefined;this.syncMinimapAvoidance();
  }
  private syncMinimapAvoidance(){
    if(!this.minimap||!this.session)return;const g=this.dragging&&!this.gesture?.pan?this.gesture:undefined,focused=this.contentEl.ownerDocument.activeElement,title=focused&&this.contentEl.contains(focused)?focused.closest<HTMLElement>('.is-editing-title'):undefined;
    const interaction=g||this.inline||this.inlineTarget||title||undefined,board=this.inlineLayout||this.session.board,viewport=this.session.board.viewport;
    const targets=!interaction?[]:g?[...g.draft.values()].filter(n=>g.idSet.has(n.id)||g.resize===n.id):board.nodes.filter(n=>n.id===this.inlineId||n.id===this.inlineTarget||title?.dataset.id===n.id);
    const overlap=!!this.minimapObstacle&&targets.some(n=>overlapsMinimap({x:n.x*viewport.zoom+viewport.x,y:n.y*viewport.zoom+viewport.y,width:n.width*viewport.zoom,height:n.height*viewport.zoom},this.minimapObstacle!));
    const hidden=this.minimapAvoidance.update(this.plugin.settings.showMinimap?interaction:undefined,overlap);
    if(this.minimap.classList.contains('is-avoiding')!==hidden){this.minimap.toggleClass('is-avoiding',hidden);this.minimap.setAttribute('aria-hidden',String(hidden));}
    if(this.overviewToggle){const label=hidden?'总览暂时避让 · 点击临时展开':this.plugin.settings.showMinimap?'收起白板总览':'显示白板总览';if(this.overviewToggle.title!==label){this.overviewToggle.title=label;this.overviewToggle.setAttribute('aria-label',label);}const expanded=String(!!this.minimapObstacle&&!hidden);if(this.overviewToggle.getAttribute('aria-expanded')!==expanded)this.overviewToggle.setAttribute('aria-expanded',expanded);}
  }
  private fitContent(nodes:Card[]){
    return fitViewportInSafeArea(nodes,this.stage.clientWidth,this.stage.clientHeight,this.viewportInsets());
  }
  private viewportInsets(){
    // Read chrome only for explicit camera commands, never on pointer movement.
    const stage=this.stage,bounds=stage.getBoundingClientRect(),main=stage.parentElement;
    const rect=(selector:string)=>{const el=main?.querySelector<HTMLElement>(selector);return el?.getClientRects().length?el.getBoundingClientRect():undefined;};
    const format=rect('.ts-floating-formatbar'),rail=rect('.ts-board-rail'),footer=rect('.ts-footer');
    const railDirection=main?.querySelector<HTMLElement>('.ts-board-rail')?.getAttribute('aria-orientation');
    const horizontalRail=!!rail&&(railDirection?railDirection==='horizontal':rail.width>rail.height);
    this.measureMinimap();return minimapInsets(bounds.width,bounds.height,{
      left:rail&&!horizontalRail?Math.max(0,rail.right-bounds.left)+12:0,right:0,
      top:Math.max(0,format?format.bottom-bounds.top+12:0,horizontalRail&&rail?rail.bottom-bounds.top+12:0),
      bottom:footer?Math.max(0,bounds.bottom-footer.top)+12:0,
    },this.minimapObstacle);
  }
  fit() { if (!this.session || this.session.blocked || !this.stage.clientWidth || !this.stage.clientHeight) return; this.rememberViewport();this.session.board.viewport = this.fitContent(visibleBranchBoard(this.session.board).nodes); this.transform(); this.session.persist(); }
  private updateBackToContent(branches?:BranchRenderSnapshot){
    const original=this.session?.board,control=this.backToContent;if(!original||!control)return;
    const b=branches?branches.visible(original):visibleBranchBoard(original);
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
  /** A board object, not a workspace mode. Referenced cards keep their own geometry. */
  showAsBrainBoard(){
    const owner=this.requireOwner();if(isBrainBoard(owner.board))return;
    if(this.localRelationEditBusy||owner.convertingTexts.size||this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&leaf.view.localRelationEditBusy))throw Error('请先完成此白板在所有窗口中的编辑或拖动，再切换白板；草稿已保留');
    const center=this.localRelationSelectedId||owner.board.nodes.find(supportsLocalRelations)?.id;
    this.clearCanvasGesture();owner.change(board=>{board.version=3;board.presentation='brain';board.brain=createBoardMindmapState(center);},undefined,false,true,false,true);
  }
  private clearBrainBoard(){
    this.brainObjectEpoch++;
    this.canvasBackgroundDialog?.close();this.canvasBackgroundDialog=undefined;
    this.brainBoardDialog?.close();this.brainBoardDialog=undefined;
    if(this.brainBoardView)this.removeChild(this.brainBoardView);
    this.brainBoardView=undefined;this.brainBoardOwner=undefined;this.brainBoardEl?.remove();this.brainBoardEl=undefined;
    this.contentEl.removeClass('ts-brain-board');this.nativeHeader?.removeClass('ts-brain-native-header');
  }
  private renderBrainBoard(){
    const owner=this.session;if(!owner||!isBrainBoard(owner.board))return;
    if(this.brainBoardOwner!==owner){
      this.clearBrainBoard();this.clearCanvasGesture();this.clearNodes();
      const el=this.brainBoardEl=this.contentEl.createDiv('ts-brain-host');this.brainBoardOwner=owner;
      const current=()=>!this.closed&&!this.closing&&this.session===owner&&this.leaf.view===this&&this.brainBoardEl===el&&el.isConnected&&isBrainBoard(owner.board);
      const host:BrainBoardHost={
        snapshot:()=>current()?{board:owner.board,path:owner.file.path,key:owner,readOnly:owner.blocked,saveFeedback:owner.saveFeedback,graphRevision:owner.brainGraphRevision,nativeRevision:this.brainNativeRevision,native:id=>this.mindmapNative(owner,id)}:undefined,
        saveFeedbackAction:action=>{if(current())act(()=>this.runSaveFeedbackAction(action));},
        isActive:()=>current()&&this.app.workspace.getActiveViewOfType(View)===this,
        activate:()=>{if(current()&&this.app.workspace.getActiveViewOfType(View)!==this)this.app.workspace.setActiveLeaf(this.leaf,{focus:false});},
        change:next=>{if(current())owner.changeBrainState(next);},
        viewport:next=>{if(current())owner.changeBrainViewport(next);},
        source:id=>this.mindmapSource(owner,id),
        finalizeViewport:intent=>{if(this.closed||this.session!==owner||this.brainBoardOwner!==owner||this.brainBoardEl!==el||intent.key!==owner||intent.path!==owner.file.path||intent.board!==owner.board||owner.blocked||!isBrainBoard(owner.board))return;owner.changeBrainViewport(intent.value);},
        organizeIdea:(id,request)=>this.openBrainSeed(id,request),
        associateExisting:(id,request)=>this.openBrainExistingRelation(owner,id,()=>current()&&request()),
        renameNode:(id,request)=>this.renameBrainNode(id,request),
        addObject:kind=>this.addBrainObject(kind),
        open:async(id,request,edit=false)=>{if(!current()||!request())return;const node=owner.board.nodes.find(n=>n.id===id&&supportsLocalRelations(n));if(node?.brainIdea){if(edit)this.openBrainSeed(id,request);else owner.changeBrainState(updateBoardMindmapState(owner.board.brain!,{type:'expand',id,expanded:true},owner.board.nodes));return;}if(node?.kind==='section'){const state=updateBoardMindmapState(owner.board.brain!,{type:'center',id},owner.board.nodes);owner.changeBrainState(updateBoardMindmapState(state,{type:'expand',id,expanded:true},owner.board.nodes));this.brainBoardView?.focusNode(id);return;}const doc=el.ownerDocument,win=doc.defaultView;return this.openLocalRelationSource(id,()=>current()&&request()&&el.ownerDocument===doc&&doc.defaultView===win&&!win?.closed,this.leaf,{edit});},
        preview:(id,body,scope,request)=>this.previewBoardMindmap(owner,id,body,scope,()=>current()&&request()),
        relate:(id,kind,request)=>{if(!current()||!request())return;this.brainBoardDialog?.close();this.brainBoardDialog=this.boardMindmapRelation(owner,undefined,id,kind,()=>current()&&request());},
        shortcut:event=>{if(!current()||event.isComposing||event.altKey||!(event.metaKey||event.ctrlKey)||!['z','y'].includes(event.key.toLowerCase())||(event.target as Element).closest('input,textarea,select,[contenteditable]:not([contenteditable=false])'))return false;if(owner.blocked)return true;if(owner.convertingTexts.size||this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&leaf.view.localRelationEditBusy)){new Notice('请先完成当前编辑或拖动，再撤销脑图操作；草稿已保留');return true;}owner.undo(event.shiftKey||event.key.toLowerCase()==='y');return true;},
        fileMenu:(menu,id)=>{if(!current())return;const node=owner.board.nodes.find(n=>n.id===id&&supportsLocalRelations(n)),file=node?.file?this.app.vault.getAbstractFileByPath(node.file):undefined;if(file instanceof TFile)this.app.workspace.trigger('file-menu',menu,file,'thoughtspace',this.leaf);},
        add:()=>this.addBrainObject(),rename:()=>this.renameBoard(),
        nativeProperties:/\.md$/i.test(owner.file.path)?()=>{if(current()&&!owner.blocked)act(()=>this.plugin.openBoardNativeMarkdown(owner.file,this.leaf));}:undefined,
        background:anchor=>{if(current())this.showCanvasBackgroundMenu(anchor);},
        colors:()=>{if(current())this.openBrainColors();},
        createRelation:(id,side,request,initial)=>this.addBrainRelation(owner,id,side,()=>current()&&request(),initial),
        settings:()=>{if(!current())return;this.brainBoardDialog?.close();const modal=new ActionPicker(this.app,'脑图白板',[{title:'关系显示层级（1–5 层）',run:()=>{if(current())this.brainBoardView?.showDepthMenu();}},{title:'背景与配色',run:()=>{if(current())this.showCanvasBackgroundMenu(this.brainBoardEl!.querySelector<HTMLElement>('[data-brain-action=more]')!);}},{title:'重命名脑图白板',run:()=>{if(current())this.renameBoard();}},{title:'复制白板链接',run:()=>{if(current())return this.copyDeepLink();}},{title:'切换为自由白板（保留所有对象与关系）',run:()=>{if(current())owner.change(board=>{delete board.presentation;delete board.brain;delete board.brainViewport;},undefined,false,true,false,true);}}]);this.brainBoardDialog=modal;modal.open();}
      };
      this.contentEl.addClass('ts-brain-board');this.nativeHeader?.addClass('ts-brain-native-header');
      this.brainBoardView=this.addChild(new BrainBoardView(this.app,el,host));
    }else this.brainBoardView?.refresh();
    this.renderSaveStatus();this.fileTitle?.setText(owner.file.basename);
  }
  private openBrainExistingRelation(owner:Session,id:string,request:()=>boolean){
    this.requireOwner(owner);const node=owner.board.nodes.find(value=>value.id===id&&supportsLocalRelations(value));
    if(!node||node.locked||!request()||!isBrainBoard(owner.board))return;
    if(this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&(leaf.view.brainRelationCreating||leaf.view.localRelationEditBusy)))throw Error('请先完成此白板正在进行的编辑或创建');
    this.brainBoardDialog?.close();const epoch=++this.brainObjectEpoch,path=owner.file.path,doc=this.contentEl.ownerDocument,center=owner.board.brain.centerId,stamp=JSON.stringify(node);
    let chosen=false,cancelled=false;
    const valid=()=>!cancelled&&request()&&this.brainObjectEpoch===epoch&&this.session===owner&&!owner.blocked&&owner.file.path===path&&!this.closed&&!this.closing&&this.leaf.view===this&&this.contentEl.ownerDocument===doc&&!doc.defaultView?.closed&&isBrainBoard(owner.board)&&owner.board.brain.centerId===center&&JSON.stringify(owner.board.nodes.find(value=>value.id===id))===stamp;
    const picker=new NotePicker(this.app,file=>{
      if(!valid())throw Error('节点或白板已变化，关联已取消');
      if(file.extension.toLowerCase()!=='md'||this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('来源已变化，请重新选择笔记');
      chosen=true;this.addBrainRelation(owner,id,'right',request,undefined,{file,path:file.path});
    }),open=picker.onOpen.bind(picker),choose=picker.onChooseItem.bind(picker),close=picker.onClose.bind(picker);
    // Native suggestions may close before delivering onChooseItem. Delay only
    // cancellation marking to the next microtask; the selection itself still
    // needs the original node, window and navigation scope before handoff.
    picker.onChooseItem=file=>{chosen=true;choose(file);};
    picker.onOpen=()=>{if(!valid()){picker.close();return;}if(picker.containerEl.ownerDocument!==doc)doc.body.appendChild(picker.containerEl);return open();};
    picker.onClose=()=>{close();queueMicrotask(()=>{if(!chosen)cancelled=true;});if(this.brainBoardDialog===picker)this.brainBoardDialog=undefined;};
    this.brainBoardDialog=picker;picker.open();
  }
  private addBrainRelation(owner:Session,id:string,side:BrainRelationSide,current:()=>boolean,initial?:'board',existing?:{file:TFile;path:string}){
    this.requireOwner(owner);if(!isBrainBoard(owner.board)||!current()||owner.blocked)return;
    const othersBusy=()=>this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&(leaf.view.brainRelationCreating||leaf.view.localRelationEditBusy));
    if(othersBusy())throw Error('请先完成此白板正在进行的编辑或创建');
    const path=owner.file.path,board=owner.board,center=board.brain.centerId,doc=this.contentEl.ownerDocument,win=doc.defaultView,expected=captureLocalRelationEdit(board,[id]),folder=this.plugin.settings.cardFolder;
    this.brainBoardDialog?.close();const epoch=++this.brainObjectEpoch;
    let saveRetry:BrainCreationSaveRetry|undefined;
    const scopeValid=()=>current()&&this.session===owner&&owner.board===board&&owner.file.path===path&&this.leaf.view===this&&this.contentEl.ownerDocument===doc&&!win?.closed&&!this.closed&&!this.closing&&this.brainObjectEpoch===epoch&&isBrainBoard(owner.board)&&owner.board.brain.centerId===center;
    const valid=()=>scopeValid()&&!owner.blocked;
    const modal=new BrainRelationCreateModal(this.app,{document:doc,side,center:localRelationNode(board.nodes.find(node=>node.id===id)!).title,folder,boardFolder:`${ROOT}/白板`,initial,initialExisting:existing,chooseAssociationSide:!!existing,current:valid,decorate:themeSurface,
      canRetry:()=>!!saveRetry&&scopeValid()&&owner.blocked&&JSON.stringify(owner.board)===saveRetry.stamp,
      retry:async live=>{if(!saveRetry)throw Error('没有待重试的保存');await this.retryBrainCreationSave(owner,saveRetry,scopeValid,live);saveRetry=undefined;},
      pick:choose=>{const picker=new NotePicker(this.app,choose),open=picker.onOpen.bind(picker);picker.onOpen=()=>{if(!valid()){picker.close();return;}if(picker.containerEl.ownerDocument!==doc)doc.body.appendChild(picker.containerEl);return open();};return picker;},
      commit:async(target:BrainNoteTarget,request)=>{
        const relationSide=existing&&target.kind==='existing'?target.side==='left'?'left':'right':side;
        if(this.brainRelationCreating)return;const ready=()=>valid()&&request()&&!this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&(leaf.view!==this&&leaf.view.brainRelationCreating||leaf.view.localRelationEditBusy));
        if(!ready())throw Error('目标白板已变化，请重新添加关系');
        this.brainRelationCreating=true;let created:TFile|undefined,createdPath='',createdStamp=0,committed=false,body='';
        try{
          await owner.flush();if(!ready())throw Error('关系创建已取消');
          const nodeId=uid(),edgeId=uid();
          if(target.kind==='idea'){const next=planBrainNoteRelation(owner.board,id,'',relationSide,nodeId,edgeId,expected,target.name);owner.change(draft=>{if(!ready())throw Error('已取消');draft.nodes=next.board.nodes;draft.edges=next.board.edges;},undefined,false,true,false,true,true);committed=true;this.brainBoardView?.revealRelation(next.nodeId);await owner.flush();if(owner.blocked){saveRetry={stamp:JSON.stringify(owner.board)};throw new LocalRelationEditSaveError('想法已添加但保存失败，恢复草稿已保留；可重试保存或取消');}return;}
          // Validate branch/lock/center constraints before any note is created.
          const kind=target.kind==='board'?'board':'card';
          planBrainNoteRelation(owner.board,id,target.kind==='existing'?target.path:`__new_brain_${nodeId}.${kind==='board'?EXT:'md'}`,relationSide,nodeId,edgeId,expected,undefined,kind);
          let file:TFile;
          if(target.kind==='existing'){
            file=target.file;if(file.path!==target.path||this.app.vault.getAbstractFileByPath(target.path)!==file||file.extension.toLowerCase()!=='md')throw Error('来源已变化，请重新选择笔记');
          }else{
            body=target.kind==='board'?JSON.stringify(target.presentation==='brain'?createBrainBoard():emptyBoard(),null,2):'';
            file=created=await this.plugin.createUnique(brainNoteFolder(target.folder??(target.kind==='board'?`${ROOT}/白板`:folder)),target.name,target.kind==='board'?EXT:'md',body);createdPath=file.path;createdStamp=file.stat.mtime;
          }
          if(!ready())throw Error('关系创建已取消');
          if(target.kind==='board'){await this.plugin.assertCanNest(owner.file,file);if(!ready())throw Error('白板创建已取消');}
          const next=planBrainNoteRelation(owner.board,id,file.path,relationSide,nodeId,edgeId,expected,undefined,kind);
          owner.change(draft=>{if(!ready())throw Error('目标白板已变化');const latest=planBrainNoteRelation(draft,id,file.path,relationSide,nodeId,edgeId,expected,undefined,kind);draft.nodes=latest.board.nodes;draft.edges=latest.board.edges;draft.version=latest.board.version;},undefined,false,true,false,true,true);
          committed=true;this.brainBoardView?.revealRelation(next.nodeId);
          await owner.flush();if(owner.blocked){saveRetry={stamp:JSON.stringify(owner.board),note:{file,path:target.kind==='existing'?target.path:createdPath,...(created?{body}:{})}};throw new LocalRelationEditSaveError('关系已添加但白板保存失败；请保留恢复草稿，可重试保存或取消');}
        }finally{
          try{if(created&&!committed){
            const file=created,unclaimed=()=>this.app.vault.getAbstractFileByPath(createdPath)===file&&file.path===createdPath&&file.stat.mtime===createdStamp&&!this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session?.board.nodes.some(node=>node.file===createdPath))&&!this.app.workspace.getLeavesOfType('markdown').some(leaf=>leaf.view instanceof MarkdownView&&leaf.view.file===file);
            if(unclaimed()&&await this.app.vault.read(file)===body&&unclaimed()){
              await this.app.fileManager.trashFile(file);
            }else new Notice(`创建已取消，笔记已被修改或引用，保留：${createdPath}`);
          }}finally{this.brainRelationCreating=false;}
        }
      }});
    const close=modal.onClose.bind(modal);modal.onClose=()=>{close();if(this.brainBoardDialog===modal)this.brainBoardDialog=undefined;};
    this.brainBoardDialog=modal;modal.open();
  }
  private renameBrainNode(id:string,request:()=>boolean){
    const owner=this.requireOwner(),node=owner.board.nodes.find(value=>value.id===id&&supportsLocalRelations(value));if(!node||node.locked||!request()||!isBrainBoard(owner.board))return;
    const file=node.file?this.app.vault.getAbstractFileByPath(node.file):undefined,doc=this.contentEl.ownerDocument,path=owner.file.path;
    if(node.file&&!(file instanceof TFile))throw Error('来源文件已移除');
    const stamp=(value:Card|undefined)=>JSON.stringify(value&&[value.id,value.kind,value.file,value.title,value.locked]);let expected=stamp(node),committed=false;
    const valid=()=>request()&&this.session===owner&&owner.file.path===path&&!this.closed&&!this.closing&&this.contentEl.ownerDocument===doc&&!doc.defaultView?.closed&&isBrainBoard(owner.board)&&stamp(owner.board.nodes.find(value=>value.id===id))===expected;
    this.brainBoardDialog?.close();const modal=new BrainNodeRenameModal(this.app,{document:doc,title:node.brainIdea?'重命名想法':node.kind==='section'?'重命名分组':node.kind==='board'?'重命名来源白板':'重命名来源笔记',name:file instanceof TFile?file.basename:node.title||'',description:file instanceof TFile?'重命名来源文件，保留节点、关系与已有显示标题。':'只修改此节点的名称，保留正文与关系。',current:()=>valid()&&(!owner.blocked||committed),retrying:()=>committed&&owner.blocked,decorate:themeSurface,
      commit:async(name,live)=>{
        if(!valid()||!live())throw Error('节点已变化或重命名已取消');
        if(this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&(leaf.view.brainRelationCreating||leaf.view.localRelationEditBusy)))throw Error('请先完成正在进行的编辑或创建');
        this.brainRelationCreating=true;
        try{
          if(file instanceof TFile){await owner.flush();if(!valid()||!live()||owner.blocked)throw Error('白板已变化或无法保存');await this.plugin.renameBrainSource(file,name,node.file);return;}
          if(!name.trim()||name.trim().length>160)throw Error('节点名称须为 1–160 字');
          if(committed){if(!owner.blocked)throw Error('名称已保存，请关闭窗口');owner.blocked=false;owner.persist();}
          else{owner.change(board=>{if(!valid()||!live())throw Error('节点已变化');const target=board.nodes.find(value=>value.id===id)!;target.title=name.trim();},undefined,false,true,false,true);expected=stamp(owner.board.nodes.find(value=>value.id===id));committed=true;}
          await owner.flush();if(owner.blocked)throw Error('重命名保存失败，名称与恢复草稿保留；可重试保存或取消');
        }finally{this.brainRelationCreating=false;}
      }});
    const close=modal.onClose.bind(modal);modal.onClose=()=>{close();if(this.brainBoardDialog===modal)this.brainBoardDialog=undefined;};this.brainBoardDialog=modal;modal.open();
  }
  private async retryBrainCreationSave(owner:Session,retry:BrainCreationSaveRetry,current:()=>boolean,live:()=>boolean){
    if(this.brainRelationCreating)throw Error('保存正在重试，请稍候');
    const ready=()=>current()&&live()&&this.session===owner&&owner.blocked&&this.app.vault.getAbstractFileByPath(owner.file.path)===owner.file&&JSON.stringify(owner.board)===retry.stamp&&!this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&(leaf.view!==this&&leaf.view.brainRelationCreating||leaf.view.localRelationEditBusy));
    if(!ready())throw Error('白板已变化或重试已取消；内容与恢复草稿保留');
    this.brainRelationCreating=true;
    try{
      await owner.flush();if(!ready())throw Error('重试已取消或白板已变化');
      const baseline=owner.baseline,disk=await this.app.vault.read(owner.file);
      if(!ready()||owner.baseline!==baseline)throw Error('重试已取消或白板已变化');
      if(disk!==baseline)throw Error('原白板已被外部修改，未覆盖；请取消并重新打开处理恢复草稿');
      const note=retry.note;
      if(note){
        const sameNote=()=>note.file.path===note.path&&this.app.vault.getAbstractFileByPath(note.path)===note.file;
        if(!sameNote())throw Error('已生成或引用的笔记已变化，内容保留；请取消后检查来源');
        if(note.body!==undefined){const body=await this.app.vault.read(note.file);if(!ready()||!sameNote())throw Error('重试已取消或笔记已变化');if(body!==note.body)throw Error('已生成笔记正文已被修改，未覆盖；请取消后检查笔记与恢复草稿');}
      }
      if(!ready())throw Error('重试已取消或白板已变化');
      const before=JSON.stringify(owner.board),conversion=retry.conversion;owner.blocked=false;
      try{if(conversion)owner.change(board=>{board.nodes=board.nodes.map(node=>node.id===conversion.idea.id?clone(conversion.node):node);},undefined,false,true,false,true);else owner.persist();}
      catch(error){owner.blocked=true;owner.emit();throw error;}
      await owner.flush();
      if(owner.blocked){
        if(conversion){owner.board={...owner.board,nodes:owner.board.nodes.map(node=>node.id===conversion.idea.id?clone(conversion.idea):node)};const at=owner.history.undoStack.lastIndexOf(before);if(at>=0)owner.history.undoStack.splice(at,1);owner.brainGraphRevision++;owner.emit();}
        retry.stamp=JSON.stringify(owner.board);throw new LocalRelationEditSaveError('重试保存失败，内容、已生成笔记与恢复草稿保留；可再次重试或取消');
      }
    }finally{this.brainRelationCreating=false;}
  }
  private openBrainSeed(ideaId?:string,request:()=>boolean=()=>true){
    const owner=this.requireOwner();if(!isBrainBoard(owner.board)||!request())return;
    if(this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&(leaf.view.brainRelationCreating||leaf.view.localRelationEditBusy)))throw Error('请先完成正在进行的创建或编辑');
    if(!ideaId&&this.brainBoardDialog?.containerEl.isConnected){this.brainBoardDialog.containerEl.querySelector<HTMLInputElement>('input')?.focus();return;}
    const idea=ideaId?owner.board.nodes.find(node=>node.id===ideaId&&node.brainIdea&&!node.locked):undefined;if(ideaId&&!idea)throw Error('想法已变化或锁定');
    this.brainBoardDialog?.close();const epoch=++this.brainObjectEpoch,doc=this.contentEl.ownerDocument,path=owner.file.path,dialogEpoch=this.dialogEpoch,stamp=idea?JSON.stringify(idea):undefined;
    let saveRetry:BrainCreationSaveRetry|undefined;
    const scopeValid=()=>request()&&this.brainObjectEpoch===epoch&&this.dialogEpoch===dialogEpoch&&this.session===owner&&owner.file.path===path&&!this.closed&&!this.closing&&this.leaf.view===this&&this.contentEl.ownerDocument===doc&&!doc.defaultView?.closed&&isBrainBoard(owner.board)&&(!ideaId||JSON.stringify(owner.board.nodes.find(node=>node.id===ideaId))===stamp);
    const valid=()=>scopeValid()&&!owner.blocked;
    const modal=new BrainRelationCreateModal(this.app,{document:doc,center:idea?.title||'',folder:this.plugin.settings.cardFolder,boardFolder:`${ROOT}/白板`,convert:!!idea,current:valid,decorate:themeSurface,
      canRetry:()=>!!saveRetry&&scopeValid()&&owner.blocked&&JSON.stringify(owner.board)===saveRetry.stamp,
      retry:async live=>{if(!saveRetry)throw Error('没有待重试的保存');await this.retryBrainCreationSave(owner,saveRetry,scopeValid,live);saveRetry=undefined;},
      pick:choose=>{const picker=new NotePicker(this.app,choose),open=picker.onOpen.bind(picker);picker.onOpen=()=>{if(!valid()){picker.close();return;}if(picker.containerEl.ownerDocument!==doc)doc.body.appendChild(picker.containerEl);return open();};return picker;},
      commit:async(target,live)=>{
        const ready=()=>valid()&&live()&&!this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&(leaf.view!==this&&leaf.view.brainRelationCreating||leaf.view.localRelationEditBusy));
        if(this.brainRelationCreating||!ready())throw Error('白板已变化或正在创建，请重试');
        if(idea&&target.kind!=='new'&&target.kind!=='existing')throw Error('请选择新建笔记或保留想法并关联已有笔记');
        this.brainRelationCreating=true;let created:TFile|undefined,createdPath='',createdStamp=0,committed=false,historyBefore:string|undefined;
        let body=idea?`# ${idea.title||''}\n\n${idea.text||''}`:'';
        if(target.kind==='board')body=JSON.stringify(target.presentation==='brain'?createBrainBoard():emptyBoard(),null,2);
        try{
          await owner.flush();if(!ready())throw Error('创建已取消');
          if(idea&&target.kind==='existing'){
            const file=target.file;if(file.path!==target.path||this.app.vault.getAbstractFileByPath(target.path)!==file||file.extension.toLowerCase()!=='md')throw Error('来源已变化，请重新选择');
            const expected=captureLocalRelationEdit(owner.board,[idea.id]),nodeId=uid(),edgeId=uid(),next=planBrainNoteRelation(owner.board,idea.id,target.path,'right',nodeId,edgeId,expected);
            // Existing notes are reference-only. Keep the complete idea object,
            // its body and every old edge; one transaction adds the association.
            owner.change(board=>{if(!ready()||file.path!==target.path||this.app.vault.getAbstractFileByPath(target.path)!==file)throw Error('白板或来源已变化');const latest=planBrainNoteRelation(board,idea.id,target.path,'right',nodeId,edgeId,expected);board.nodes=latest.board.nodes;board.edges=latest.board.edges;board.version=latest.board.version;},undefined,false,true,false,true);
            committed=true;this.brainBoardView?.revealRelation(next.nodeId);await owner.flush();
            if(owner.blocked){saveRetry={stamp:JSON.stringify(owner.board),note:{file,path:target.path}};throw new LocalRelationEditSaveError('脑图保存失败，想法正文与关联已保留，目标笔记正文不变；请保留恢复草稿，可重试保存或取消');}
            return;
          }
          let node:Card;
          if(target.kind==='idea')node=brainIdeaNode(uid(),target.name,owner.board.nodes.length*400);
          else{
            let file:TFile;
            if(target.kind==='existing'){file=target.file;if(file.path!==target.path||this.app.vault.getAbstractFileByPath(file.path)!==file||file.extension!=='md')throw Error('来源已变化，请重新选择');}
            else{file=created=await this.plugin.createUnique(brainNoteFolder(target.folder??(target.kind==='board'?`${ROOT}/白板`:this.plugin.settings.cardFolder)),target.name,target.kind==='board'?EXT:'md',body);createdPath=file.path;createdStamp=file.stat.mtime;if(await this.app.vault.read(file)!==body)throw Error('新文件内容发生变化，想法仍保留');}
            if(target.kind==='board'){await this.plugin.assertCanNest(owner.file,file);if(!ready())throw Error('白板创建已取消');}
            if(!ready())throw Error('创建已取消');
            node=idea?brainIdeaToNote(idea,file.path):{id:uid(),kind:target.kind==='board'?'board':'card',file:file.path,x:owner.board.nodes.length*400,y:0,width:320,height:240,color:'slate'};
          }
          if(!ready())throw Error('创建已取消');historyBefore=JSON.stringify(owner.board);
          owner.change(board=>{if(!ready())throw Error('白板已变化');if(ideaId)board.nodes=board.nodes.map(old=>old.id===ideaId?node:old);else{board.nodes.push(node);board.brain=updateBoardMindmapState(board.brain!,{type:'center',id:node.id},board.nodes);}},undefined,false,true,false,true);
          committed=true;await owner.flush();
          if(owner.blocked){
            // Failed conversion must keep the idea available. Keep the generated
            // native file, since another editor may already have claimed it.
            if(idea){owner.board={...owner.board,nodes:owner.board.nodes.map(old=>old.id===ideaId?idea:old)};const at=owner.history.undoStack.lastIndexOf(historyBefore);if(at>=0)owner.history.undoStack.splice(at,1);owner.brainGraphRevision++;owner.emit();}
            saveRetry={stamp:JSON.stringify(owner.board),...(created?{note:{file:created,path:createdPath,body}}:target.kind==='existing'?{note:{file:target.file,path:target.path}}:{}),...(idea?{conversion:{idea:clone(idea),node:clone(node)}}:{})};
            throw new LocalRelationEditSaveError(idea?'脑图保存失败，想法与关系已保留；已生成笔记保留，请保留恢复草稿，可重试保存或取消':'保存失败，请保留恢复草稿，可重试保存或取消');
          }
          this.brainBoardView?.focusNode(node.id);
        }finally{
          try{if(created&&!committed){const file=created,unclaimed=()=>this.app.vault.getAbstractFileByPath(createdPath)===file&&file.path===createdPath&&file.stat.mtime===createdStamp&&!this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session?.board.nodes.some(node=>node.file===createdPath))&&!this.app.workspace.getLeavesOfType('markdown').some(leaf=>leaf.view instanceof MarkdownView&&leaf.view.file===file);if(unclaimed()&&await this.app.vault.read(file)===body&&unclaimed())await this.app.fileManager.trashFile(file);else new Notice(`创建已取消，笔记已被修改或引用，保留：${createdPath}`);}}finally{this.brainRelationCreating=false;}
        }
      }});
    const close=modal.onClose.bind(modal);modal.onClose=()=>{close();if(this.brainBoardDialog===modal)this.brainBoardDialog=undefined;};this.brainBoardDialog=modal;modal.open();
  }
  private addBrainObject(kind?:'note'|'new-note'|'section'|'board'){
    const owner=this.requireOwner();if(!isBrainBoard(owner.board))return;
    if(kind===undefined){this.openBrainSeed();return;}
    const epoch=this.dialogEpoch,request=++this.brainObjectEpoch,current=()=>this.brainObjectEpoch===request&&this.session===owner&&!this.closed&&!this.closing&&!owner.blocked&&this.dialogEpoch===epoch&&isBrainBoard(owner.board);
    const add=(node:Card)=>{if(!current())throw Error('脑图已切换，请回到原白板重试');owner.change(board=>{board.nodes.push(node);if(isBrainBoard(board))board.brain=updateBoardMindmapState(board.brain,{type:'center',id:node.id},board.nodes);},undefined,false,true,false,true);};
    const fileNode=(file:TFile,type:'card'|'board'):Card=>({id:uid(),kind:type,file:file.path,x:owner.board.nodes.length*400,y:0,width:320,height:240,color:'slate'});
    this.brainBoardDialog?.close();
    if(kind==='note')this.brainBoardDialog=new NotePicker(this.app,file=>{if(!current()||this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('来源或白板已变化，请重试');add(fileNode(file,'card'));});
    else if(kind==='new-note')this.brainBoardDialog=new Prompt(this.app,'新建脑图笔记','新的笔记',async title=>{if(!current())return;const file=await this.plugin.createUnique(this.plugin.settings.cardFolder,title,'md','');if(!current()){new Notice(`笔记已创建：${file.path}；白板已切换，未添加引用`);return;}const node=fileNode(file,'card');add(node);await this.openLocalRelationSource(node.id,current,this.leaf,{edit:true});});
    else if(kind==='section')this.brainBoardDialog=new Prompt(this.app,'新建分组节点','新的分组',title=>add({id:uid(),kind:'section',title,x:owner.board.nodes.length*400,y:0,width:360,height:280,color:'slate'}));
    else if(kind==='board')this.brainBoardDialog=new BoardPicker(this.app,owner.file,async file=>{if(!current())return;await this.plugin.hierarchy(async()=>{await this.plugin.assertCanNestReachable(owner.file,file,current);if(!current()||this.app.vault.getAbstractFileByPath(file.path)!==file)return;add(fileNode(file,'board'));});});
    else this.brainBoardDialog=new ActionPicker(this.app,'添加脑图节点',[{title:'引用已有笔记',run:()=>{if(current())this.addBrainObject('note');}},{title:'新建笔记',run:()=>{if(current())this.addBrainObject('new-note');}},{title:'新建分组',run:()=>{if(current())this.addBrainObject('section');}},{title:'引用子白板',run:()=>{if(current())this.addBrainObject('board');}}]);
    const modal=this.brainBoardDialog;if(modal instanceof Prompt){const close=modal.onClose.bind(modal);modal.onClose=()=>{if(this.brainBoardDialog===modal&&this.brainObjectEpoch===request)this.brainObjectEpoch++;close();};}modal.open();
  }
  addMindmap(position?:{x:number;y:number},centerId=this.localRelationSelectedId){
    const owner=this.requireOwner();if(this.localRelationEditBusy)throw Error('请先完成当前编辑或拖动，再添加脑图');
    if(!position){const center=this.point();position={x:center.x-390,y:center.y-150};}
    const center=owner.board.nodes.find(n=>n.id===centerId&&supportsLocalRelations(n))||owner.board.nodes.find(supportsLocalRelations),id=uid();
    const node:Card={id,kind:'mindmap',title:'脑图',x:position.x,y:position.y,width:780,height:300,color:'slate',mindmap:createBoardMindmapState(center?.id)};
    owner.change(b=>{b.version=3;b.nodes.push(node);},undefined,false,true,false,true);
    this.selected=new Set([id]);this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();return id;
  }
  private foldBoardMindmap(id:string){
    const owner=this.requireOwner(),node=owner.board.nodes.find(n=>n.id===id&&n.kind==='mindmap');if(!node||node.locked)return;
    owner.change(b=>foldCards(b,new Set([id]),!node.collapsed),undefined,false,true,false,true);
  }
  private syncMindmapResize(node:Card,el:HTMLElement){
    const handle=el.querySelector<HTMLElement>(':scope > .ts-resize');
    if(node.collapsed||node.locked)handle?.remove();else if(!handle)el.createDiv({cls:'ts-resize',attr:{'aria-label':'拖动调整脑图大小'}});
  }
  private mindmapSource(owner:Session,targetId:string){
      const target=owner.board.nodes.find(n=>n.id===targetId&&supportsLocalRelations(n));if(!target)return{label:'对象不可用',available:false,reason:'原对象已从本板移除，请重新选择中心'};
      if(target.brainIdea)return{label:'查看想法',available:true,canEdit:false,editReason:'通过节点菜单整理成笔记',stamp:JSON.stringify([target.title,target.text])};
      if(target.kind==='section')return{label:'定位分组',available:true,canEdit:false,editReason:'分组没有独立笔记正文',stamp:JSON.stringify(owner.board.nodes.filter(n=>n.id!==target.id&&supportsLocalRelations(n)&&sectionContains(target,n)).map(n=>[n.id,n.kind,n.title,n.file,n.x,n.y,n.width,n.height]))};
      const file=target.file?this.app.vault.getAbstractFileByPath(target.file):undefined;
      let identity=0;if(file instanceof TFile){identity=this.mindmapFileIds.get(file)||++this.mindmapFileSequence;this.mindmapFileIds.set(file,identity);}
      return{label:target.kind==='board'?'打开子白板':'打开笔记',path:target.file,available:file instanceof TFile,reason:file instanceof TFile?undefined:'来源文件缺失，原引用保留',canEdit:target.kind==='card'&&file instanceof TFile&&file.extension.toLowerCase()==='md',editReason:target.kind==='board'?'请在子白板中编辑内容':'来源不存在，无法进入编辑',stamp:JSON.stringify([target.kind,target.file,identity,file instanceof TFile?[file.stat.mtime,file.stat.size,file.stat.ctime]:null])};
  }
  private mindmapNative(owner:Session,centerId:string){return nativeLocalRelations(owner.board,centerId,{exists:path=>this.app.vault.getAbstractFileByPath(path) instanceof TFile,resolved:path=>this.app.metadataCache.resolvedLinks[path],cache:path=>{const file=this.app.vault.getAbstractFileByPath(path);return file instanceof TFile?this.app.metadataCache.getFileCache(file):null;},resolve:(link,from)=>{const parsed=parseLinktext(link),file=parsed.path?this.app.metadataCache.getFirstLinkpathDest(parsed.path,from):this.app.vault.getAbstractFileByPath(from);return file instanceof TFile?{path:file.path,subpath:parsed.subpath}:undefined;},tags:path=>{const file=this.app.vault.getAbstractFileByPath(path);return file instanceof TFile?getAllTags(this.app.metadataCache.getFileCache(file)||{})||[]:[];}});}
  private mountBoardMindmap(node:Card,el:HTMLElement,scope:Component){
    el.addClass('ts-mindmap-node');
    const owner=this.requireOwner(),id=node.id;let dialog:Modal|undefined;
    const current=()=>!this.closed&&this.session===owner&&this.leaf.view===this&&el.isConnected&&this.positions.get(id)===el&&owner.board.nodes.some(n=>n.id===id&&n.kind==='mindmap');
    const container=()=>current()?owner.board.nodes.find(n=>n.id===id&&n.kind==='mindmap'):undefined;
    const source=(targetId:string)=>this.mindmapSource(owner,targetId);
    const native=(centerId:string)=>this.mindmapNative(owner,centerId);
    const host:BoardMindmapHost={
      snapshot:()=>{const live=container();return live?{board:owner.board,container:live,path:owner.file.path,key:owner,readOnly:owner.blocked||!!live.locked,native}:undefined;},
      change:(next:BoardMindmapState)=>{const live=container();if(!live||owner.blocked||live.locked)return;if(!validBoardMindmapState(next))throw Error('脑图状态无效，未写入白板');owner.change(b=>{const target=b.nodes.find(n=>n.id===id&&n.kind==='mindmap');if(target&&!target.locked)target.mindmap=clone(next);},undefined,false,true,false,true);},
      select:()=>{if(current()&&(!this.selected.has(id)||this.selected.size!==1)){this.selected=new Set([id]);this.selectedEdge=undefined;this.updateSelection();}},
      canvasGesture:event=>this.space&&event.button===0,
      shortcut:event=>{if(!current()||event.isComposing||event.altKey||!(event.metaKey||event.ctrlKey)||!['z','y'].includes(event.key.toLowerCase())||(event.target as Element).closest('input,textarea,select,[contenteditable]:not([contenteditable=false])'))return false;if(owner.blocked)return true;const busy=owner.convertingTexts.size>0||this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&leaf.view.localRelationEditBusy);if(busy){new Notice('请先完成当前内容编辑或拖动，再撤销脑图操作；草稿已保留');return true;}owner.undo(event.shiftKey||event.key.toLowerCase()==='y');return true;},
      fold:()=>{if(current())this.foldBoardMindmap(id);},source,
      open:async(targetId,request,edit=false)=>{if(!current()||!request())return;const target=owner.board.nodes.find(n=>n.id===targetId&&supportsLocalRelations(n));if(!target)return;if(target.kind==='section'){if(current()&&request())this.revealNode(targetId);return;}const doc=el.ownerDocument,win=doc.defaultView;await this.openLocalRelationSource(targetId,()=>current()&&request()&&el.ownerDocument===doc&&doc.defaultView===win&&!win?.closed,this.leaf,{edit});},
      preview:(targetId,body,child,request)=>this.previewBoardMindmap(owner,targetId,body,child,()=>current()&&request()),
      fileMenu:(menu,targetId)=>{if(!current())return;const target=owner.board.nodes.find(n=>n.id===targetId&&supportsLocalRelations(n)),file=target?.file?this.app.vault.getAbstractFileByPath(target.file):undefined;if(file instanceof TFile)this.app.workspace.trigger('file-menu',menu,file,'thoughtspace',this.leaf);},
      relate:(targetId,kind,request)=>{if(!current()||!request())return;dialog?.close();dialog=this.boardMindmapRelation(owner,id,targetId,kind,()=>current()&&request());}
    };
    const view=new BoardMindmapView(this.app,el,host);this.boardMindmaps.set(id,view);scope.addChild(view);
    scope.register(()=>{dialog?.close();dialog=undefined;if(this.boardMindmaps.get(id)===view)this.boardMindmaps.delete(id);});
  }
  private previewBoardMindmap(owner:Session,id:string,body:HTMLElement,scope:Component,current:()=>boolean){
    const node=owner.board.nodes.find(n=>n.id===id&&supportsLocalRelations(n)),doc=body.ownerDocument,win=doc.defaultView;
    let stopped=false;scope.register(()=>{stopped=true;});
    const alive=()=>!stopped&&current()&&!this.closed&&this.session===owner&&body.isConnected&&body.ownerDocument===doc&&doc.defaultView===win&&!win?.closed;
    if(!node||!alive())return;body.empty();
    if(node.brainIdea){body.createEl('p',{text:node.text||node.title||'未命名想法'});body.createEl('small',{text:'此想法保存在脑图中；节点菜单可整理成笔记。'});return;}
    if(node.kind==='section'){
      const members=owner.board.nodes.filter(n=>n.id!==node.id&&supportsLocalRelations(n)&&sectionContains(node,n));
      body.createEl('p',{cls:'ts-mindmap-preview-caption',text:`分组内 ${members.length} 个笔记、分组或子白板`});
      for(const member of members.slice(0,24)){const item=button(body,localRelationNode(member).title,member.kind==='section'?'folder':'file-text',()=>{if(alive())this.revealNode(member.id);},'ts-mindmap-member');item.title=member.file||'定位本板分组';}
      if(!members.length)body.createEl('p',{text:'分组中暂无支持的对象；可以打开原分组添加内容。'});
      else if(members.length>24)body.createEl('small',{text:'显示前 24 项，定位分组可查看全部。'});return;
    }
    const path=node.file,file=path?this.app.vault.getAbstractFileByPath(path):undefined;
    if(!(file instanceof TFile)){body.createEl('p',{text:'找不到来源文件，原引用仍保留。'});return;}
    const mtime=file.stat.mtime,size=file.stat.size,valid=()=>alive()&&file.path===path&&this.app.vault.getAbstractFileByPath(path)===file&&file.stat.mtime===mtime&&file.stat.size===size&&owner.board.nodes.some(n=>n.id===id&&n.kind===node.kind&&n.file===path);
    if(node.kind==='board'){
      body.createEl('p',{text:'正在读取子白板…'});
      void this.plugin.readBoard(file).then(child=>{if(!valid())return;body.empty();const items=child.nodes.filter(supportsLocalRelations),shown=items.slice(0,24),ids=new Set(shown.map(n=>n.id));body.createEl('p',{cls:'ts-mindmap-preview-caption',text:`子白板 · ${items.length} 个笔记、分组或子白板`});this.mapPreview(body,{...child,nodes:shown,edges:child.edges.filter(e=>ids.has(e.from)&&ids.has(e.to))});for(const item of shown.slice(0,8))body.createDiv({cls:'ts-mindmap-member-label',text:localRelationNode(item).title});if(items.length>24)body.createEl('small',{text:'概览显示前 24 项，打开子白板可查看全部。'});}).catch(error=>{if(valid()){body.empty();body.createEl('p',{text:'无法读取子白板：'+String(error)});}});return;
    }
    scope.registerDomEvent(body,'click',event=>{
      if(event.defaultPrevented||!valid())return;const link=(event.target as Element).closest('a');if(!link||link.closest('.markdown-embed,.internal-embed'))return;
      if(link.classList.contains('internal-link')){const href=link.getAttribute('data-href')||link.getAttribute('href');if(href){event.preventDefault();event.stopPropagation();act(()=>{if(valid())return this.app.workspace.openLinkText(href,file.path,Keymap.isModEvent(event)||'tab');});}}
      else if(link.classList.contains('tag')){event.preventDefault();event.stopPropagation();const tag=link.textContent?.trim()||'';if(isBrainBoard(owner.board))act(()=>this.openBrainTagSearch(tag,valid));else{this.tag=tag;this.selectTab('library','');}}
    });
    body.addClass('ts-preview-pending');body.setAttribute('aria-busy','true');body.setAttribute('aria-label','正在加载笔记正文');
    let citations:ExcerptSource[]=[];
    renderCardPreview({app:this.app,file,preview:body,scope,enqueue:(ready,run)=>this.previewQueue.add(()=>valid()&&ready(),async()=>{if(valid())await run();}),sources:values=>{if(valid())citations=values;},ready:empty=>{if(!valid())return;if(empty)body.createEl('p',{cls:'ts-mindmap-preview-caption',text:'笔记暂无正文，可打开原笔记编辑。'});if(citations.length)this.addSourceBadge(body.createDiv('ts-mindmap-preview-sources'),file,citations,scope);},error:()=>{if(valid()){body.empty();body.createEl('p',{text:'正文暂时无法显示，请打开原笔记。'});}}});
  }
  private async openBrainTagSearch(tag:string,current:()=>boolean){
    if(!/^#[^\s#]+$/.test(tag)||!current())return;
    const doc=this.contentEl.ownerDocument,win=doc.defaultView,owner=this.session,navigationLeaf=this.leaf;
    const valid=()=>current()&&!this.closed&&!this.closing&&this.session===owner&&navigationLeaf.view===this&&this.contentEl.ownerDocument===doc&&doc.defaultView===win&&!win?.closed;
    const previous=this.app.workspace.getActiveViewOfType(View)?.leaf;
    const existing=this.app.workspace.getLeavesOfType('search').find(leaf=>leaf.getContainer().doc===doc&&!leaf.getViewState().pinned);
    const leaf=existing||this.createLocalRelationLeaf(navigationLeaf,valid,false);
    await leaf.setViewState({type:'search',state:{query:`tag:${JSON.stringify(tag)}`},active:false});
    if(!valid()||leaf.getContainer().doc!==doc||leaf.view.getViewType()!=='search')return;
    const active=this.app.workspace.getActiveViewOfType(View)?.leaf;if(active&&active!==previous&&active!==leaf)return;
    expandLocalRelationPane(this.app,leaf);if(valid())this.app.workspace.setActiveLeaf(leaf,{focus:true});
  }
  private boardMindmapRelation(owner:Session,containerId:string|undefined,id:string,kind:'child'|'parent'|'associate'|'remove',current:()=>boolean):Modal|undefined{
    this.requireOwner(owner);const editable=()=>containerId?owner.board.nodes.some(n=>n.id===containerId&&n.kind==='mindmap'&&!n.locked):isBrainBoard(owner.board);if(!editable()||owner.blocked||!current())return;
    const busy=()=>owner.convertingTexts.size>0||this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&leaf.view.localRelationEditBusy);
    if(busy())throw Error('请先完成当前内容编辑或拖动；草稿已保留');
    const baseline=clone(owner.board),app=this.app;
    const commit=async(request:LocalRelationMutation)=>{
      const valid=()=>current()&&this.session===owner&&!this.closed&&!owner.blocked&&!busy()&&editable();
      if(!valid())return;await owner.flush();if(!valid())return;const edgeId=request.action==='create'?uid():undefined;
      const plan=planLocalRelationEdit(owner.board,request,edgeId);if(!plan.changed)return;
      owner.change(board=>{if(!valid())throw Error('脑图关系操作已取消');const next=planLocalRelationEdit(board,request,edgeId);board.edges=next.board.edges;board.version=next.board.version;},undefined,false,true,false,true,true);
      await owner.flush();if(owner.blocked)throw Error('关系已应用，但保存失败；请保留恢复草稿。');
    };
    if(kind==='remove'){
      const edges=baseline.edges.filter(e=>(e.from===id||e.to===id)&&[e.from,e.to].every(key=>baseline.nodes.some(n=>n.id===key&&supportsLocalRelations(n))));
      if(!edges.length){new Notice('没有可移除的本板连线；原生笔记链接请在来源中编辑');return;}
      class EdgePicker extends FuzzySuggestModal<Board['edges'][number]>{getItems(){return edges;}getItemText(edge:Board['edges'][number]){const other=baseline.nodes.find(n=>n.id===(edge.from===id?edge.to:edge.from))!;return `${edge.kind==='branch'?'父子分支':'本板关联'} · ${localRelationNode(other).title}${edge.label?' · '+edge.label:''}`;}onChooseItem(edge:Board['edges'][number]){act(()=>commit({action:'remove',centerId:id,edgeId:edge.id,expected:captureLocalRelationEdit(baseline,[id],edge.id)}));}}
      const picker=new EdgePicker(app);picker.setPlaceholder('选择要移除的本板关系');picker.open();return picker;
    }
    const targets=baseline.nodes.filter(n=>n.id!==id&&supportsLocalRelations(n)&&!n.locked);
    class TargetPicker extends FuzzySuggestModal<Card>{getItems(){return targets;}getItemText(node:Card){return `${localRelationNode(node).title} · ${node.file||'本板分组'}`;}onChooseItem(node:Card){const from=kind==='parent'?node.id:id,to=kind==='parent'?id:node.id;act(()=>commit({action:'create',centerId:id,value:{from,to,kind:kind==='associate'?'ordinary':'branch',direction:kind==='associate'?'both':'forward',label:''},expected:captureLocalRelationEdit(baseline,[id,node.id])}));}}
    const picker=new TargetPicker(app);picker.setPlaceholder(kind==='child'?'选择子节点；不移动原对象':kind==='parent'?'选择父节点；不移动原对象':'选择关联对象；Esc 取消');picker.open();return picker;
  }
  get localRelationSelectedId(){const node=this.selected.size===1?this.session?.board.nodes.find(n=>this.selected.has(n.id)):undefined;return node&&supportsLocalRelations(node)?node.id:undefined;}
  get localRelationEditing(){return !!this.inline||!!this.inlineTarget;}
  get localRelationEditBusy(){return this.closing||this.localRelationEditing||!!this.gesture||!!this.marquee||!!this.rightMarquee||!!this.linkDrag||!!this.contentEl.querySelector('.ts-card-title-input');}
  localRelationSource(node:Card):{path:string;file?:TFile;subpath?:string;line?:number;paragraph?:ParagraphOrigin}|undefined {
    const origin=node.paragraphQuote;
    const path=origin?.path||node.file||node.videoCapture?.note;
    if(path){const file=this.app.vault.getAbstractFileByPath(path);return {path,file:file instanceof TFile?file:undefined,subpath:origin?.subpath||(node.kind==='pdf'?pdfSubpath(node.pdfPage||1):undefined),paragraph:origin};}
    const source=node.kind==='text'?textExcerptPresentation(node.text||'').sources[0]:undefined;
    if(source&&this.file){const target=this.sourceFile(this.file,source);return{path:target.file?.path||source.link,file:target.file instanceof TFile?target.file:undefined,subpath:target.subpath,line:source.line};}
    if(this.session&&this.file){const usage=boardUsages({...this.session.board,nodes:[node],edges:[]},this.file.path,(path,context)=>this.app.metadataCache.getFirstLinkpathDest(path,context)?.path)[0];if(usage){const file=this.app.vault.getAbstractFileByPath(usage.path);return {path:usage.path,file:file instanceof TFile?file:undefined,subpath:usage.subpath};}}
  }
  private assertLocalRelationDraftSafe(file:TFile){
    for(const leaf of this.app.workspace.getLeavesOfType(VIEW)){const view=leaf.view;if(!(view instanceof BoardView)||!view.session)continue;const id=view.inlineId||view.inlineTarget,node=view.session.board.nodes.find(node=>node.id===id);
      if((view.inline||view.inlineTarget)&&node?.kind==='card'&&node.file===file.path)throw Error('此来源仍在白板中编辑。请先保存或取消卡片编辑，再打开原生笔记；草稿已保留。');}
  }
  assertLocalRelationSourceReady(id:string){const node=this.session?.board.nodes.find(node=>node.id===id),source=node&&this.localRelationSource(node);if(source?.file)this.assertLocalRelationDraftSafe(source.file);}
  createLocalRelationLeaf(navigationLeaf:WorkspaceLeaf,current:()=>boolean,activate=true){
    const workspace=this.app.workspace,previous=!activate&&current()?workspace.getActiveViewOfType(View):null,previousLeaf=previous?.leaf,previousDoc=previous?.containerEl.ownerDocument,previousWindow=previousDoc?.defaultView;
    const leaf=workspace.createLeafBySplit(navigationLeaf,'vertical');
    // Creating a native split activates its empty leaf synchronously. Undo only
    // that replacement; the editor's DOM focus has not moved and needs no reset.
    if(previous&&previousLeaf&&previousDoc&&previousWindow&&current()&&workspace.getActiveViewOfType(View)?.leaf===leaf&&previousLeaf.view===previous&&previous.containerEl.isConnected&&previous.containerEl.ownerDocument===previousDoc&&previousDoc.defaultView===previousWindow&&!previousWindow.closed)workspace.setActiveLeaf(previousLeaf,{focus:false});
    return leaf;
  }
  async openLocalRelationSource(id:string,current:(allowHidden?:boolean)=>boolean,navigationLeaf:WorkspaceLeaf=this.leaf,options:{activate?:boolean;edit?:boolean;companion?:WorkspaceLeaf;dedicated?:boolean;heading?:LocalHeadingTarget}={}){
    const navigationView=navigationLeaf.view,sourceDoc=navigationView.containerEl.ownerDocument,owner=this.session,node=owner?.board.nodes.find(n=>n.id===id),source=node&&this.localRelationSource(node);if(!current()||!owner||!source)return;
    const file=source.file;if(!file)throw Error('来源文件缺失，卡片内容仍保留');this.assertLocalRelationDraftSafe(file);if(options.edit&&file.extension.toLowerCase()!=='md')throw Error('只有 Markdown 来源支持原生笔记编辑');
    const heading=options.heading,headingCurrent=()=>!heading||(node?.kind==='card'&&file.extension.toLowerCase()==='md'&&validateLocalHeadingTarget(this.plugin.localRelationHeadingCache(file),file.path,file.stat.mtime,heading));if(!headingCurrent())throw Error('标题或来源索引已变化，请刷新后重试');
    const path=file.path,stamp=(value:ReturnType<BoardView['localRelationSource']>)=>value&&JSON.stringify([value.path,value.subpath,value.line,value.paragraph]),signature=stamp(source),valid=(allowHidden=false)=>{const latest=owner.board.nodes.find(n=>n.id===id),resolved=latest&&this.localRelationSource(latest);return current(allowHidden)&&headingCurrent()&&navigationLeaf.view===navigationView&&navigationView.containerEl.ownerDocument===sourceDoc&&!this.closed&&this.session===owner&&file.path===path&&this.app.vault.getAbstractFileByPath(path)===file&&resolved?.file===file&&stamp(resolved)===signature;};
    let location:Awaited<ReturnType<BoardView['paragraphLocation']>>|undefined;
    if(source.paragraph&&!heading){location=await this.paragraphLocation(source.paragraph);if(!valid())return;}
    if(!valid())return;this.assertLocalRelationDraftSafe(file);
    const boardSource=node?.kind==='board'&&!options.edit&&!heading;const type=boardSource?VIEW:heading||file.extension.toLowerCase()==='md'?'markdown':file.extension==='pdf'?'pdf':file.extension===EXT?VIEW:undefined,activate=options.activate!==false;
    const existing=options.companion||(!options.dedicated&&type?this.app.workspace.getLeavesOfType(type).find(l=>l.view.containerEl.ownerDocument===sourceDoc&&l.getViewState().state?.file===path):undefined);
    // A fresh popout split's EmptyView can still own a detached main-window DOM.
    // Its public workspace container identifies the destination before loading.
    if(options.companion){const container=options.companion.getContainer();if(container.doc!==sourceDoc||container.win!==sourceDoc.defaultView||container.win.closed||options.companion.getViewState().pinned)throw Error('伙伴页已移动或固定，未替换其内容');}
    const leaf=existing||this.createLocalRelationLeaf(navigationLeaf,valid,activate),previousView=existing?.view,wasDeferred=!!existing?.isDeferred,sameFile=existing?.getViewState().state?.file===path;
    const sameSource=()=>leaf.view.containerEl.ownerDocument===sourceDoc&&leaf.view.getState().file===path;
    if(existing&&sameFile){if(file.extension===EXT&&wasDeferred)this.plugin.provisionalBoardGeometry.set(leaf,file);try{await leaf.loadIfDeferred();}catch(error){if(this.plugin.provisionalBoardGeometry.get(leaf)===file)this.plugin.provisionalBoardGeometry.delete(leaf);throw error;}if(!valid()||!sameSource()||!wasDeferred&&leaf.view!==previousView)return;if(activate&&source.subpath&&!heading)leaf.setEphemeralState({subpath:source.subpath});}
    else {if(type===VIEW)this.plugin.provisionalBoardGeometry.set(leaf,file);try{if(type===VIEW){await this.plugin.readBoard(file);await leaf.setViewState({type:VIEW,active:false,state:{file:path}});}else await leaf.openFile(file,{active:false,eState:activate&&source.subpath&&!heading?{subpath:source.subpath}:undefined});}catch(error){if(this.plugin.provisionalBoardGeometry.get(leaf)===file)this.plugin.provisionalBoardGeometry.delete(leaf);throw error;}}
    if(!valid()||!sameSource())return;this.assertLocalRelationDraftSafe(file);
    if(options.edit&&leaf.view instanceof MarkdownView){const editingView=leaf.view;await leaf.setViewState({...leaf.getViewState(),state:{...leaf.view.getState(),mode:'source'},active:false});if(!valid()||!sameSource()||leaf.view!==editingView)return;this.assertLocalRelationDraftSafe(file);}
    const openedView=leaf.view;
    if(activate&&openedView instanceof MarkdownView){const editor=openedView.editor;
      if(heading){if(!localHeadingTextMatches(editor.getValue(),heading))throw Error('无法安全核实当前标题位置。请打开来源查看，或等待原生索引更新后重试。');leaf.setEphemeralState({line:heading.line});if(!valid()||leaf.view!==openedView||!sameSource())return;this.assertLocalRelationDraftSafe(file);const pos={line:heading.line,ch:heading.col};editor.setCursor(pos);editor.scrollIntoView({from:pos,to:pos},true);}
      else if(location?.from!==undefined){if(editor.getValue()!==location.raw)throw Error('来源在打开时已变化，未设置选区');const from=editor.offsetToPos(location.from),to=editor.offsetToPos(location.to);editor.setSelection(from,to);editor.scrollIntoView({from,to},true);}
      else if(source.line){const pos={line:Math.min(editor.lineCount()-1,source.line-1),ch:0};editor.setCursor(pos);editor.scrollIntoView({from:pos,to:pos},true);}
    }
    if(!valid())return;if(!activate)return leaf;
    const active=this.app.workspace.getActiveViewOfType(View)?.leaf;if(active&&active!==leaf&&active!==navigationLeaf)return;
    if(!valid(true))return;
    // The editor is already loaded. Native revealLeaf can itself activate after
    // an await, so a guard after it cannot undo a late focus steal during editing.
    if(options.edit&&openedView instanceof MarkdownView){
      expandLocalRelationPane(this.app,leaf);
      if(!valid(true)||leaf.view!==openedView||!sameSource())return;
      const expandedActive=this.app.workspace.getActiveViewOfType(View)?.leaf;if(expandedActive&&expandedActive!==leaf&&expandedActive!==navigationLeaf)return;
      this.assertLocalRelationDraftSafe(file);this.app.workspace.setActiveLeaf(leaf,{focus:true});openedView.editor.focus();if(location?.from===undefined&&location)new Notice(location.status+'；已打开原文件');return leaf;
    }
    await this.app.workspace.revealLeaf(leaf);if(!valid(true)||leaf.view!==openedView||!sameSource())return;if(heading&&openedView instanceof MarkdownView&&!localHeadingTextMatches(openedView.editor.getValue(),heading))return;this.assertLocalRelationDraftSafe(file);if(this.app.workspace.getActiveViewOfType(View)?.leaf&&this.app.workspace.getActiveViewOfType(View)?.leaf!==leaf&&this.app.workspace.getActiveViewOfType(View)?.leaf!==navigationLeaf)return;if(openedView instanceof BoardView&&openedView.file===file)openedView.resumeAutomaticGeometry();this.app.workspace.setActiveLeaf(leaf,{focus:true});if(location?.from===undefined&&location)new Notice(location.status+'；已打开原文件');return leaf;
  }
  async openLocalRelationEvidence(evidence:NativeLocalEvidence,current:(allowHidden?:boolean)=>boolean,navigationLeaf:WorkspaceLeaf){
    const file=this.app.vault.getAbstractFileByPath(evidence.sourcePath),owner=this.session,anchor=navigationLeaf.view,doc=anchor.containerEl.ownerDocument;if(!current()||!owner||!(file instanceof TFile)||file.extension!=='md')return;
    const path=file.path,cache=this.app.metadataCache.getFileCache(file),stamp=file.stat.mtime;
    const reference=()=>{if(evidence.kind==='indexed')return this.app.vault.getAbstractFileByPath(evidence.targetPath) instanceof TFile&&(this.app.metadataCache.resolvedLinks[path]?.[evidence.targetPath]||0)>0;const latest=this.app.metadataCache.getFileCache(file),refs=evidence.kind==='property'?latest?.frontmatterLinks:evidence.kind==='embed'?latest?.embeds:latest?.links;return refs?.some(ref=>{const parsed=parseLinktext(ref.link),target=parsed.path?this.app.metadataCache.getFirstLinkpathDest(parsed.path,path):file;return target?.path===evidence.targetPath&&parsed.subpath===(evidence.subpath||'')&&(evidence.kind!=='property'||('key' in ref&&ref.key===evidence.property))&&(evidence.line===undefined||('position' in ref&&ref.position.start.line===evidence.line));})===true;};
    const valid=(allowHidden=false)=>current(allowHidden)&&!this.closed&&this.session===owner&&navigationLeaf.view===anchor&&anchor.containerEl.ownerDocument===doc&&file.path===path&&file.stat.mtime===stamp&&this.app.vault.getAbstractFileByPath(path)===file&&reference();
    if(!cache||!valid())throw Error('关系来源已变化或索引尚未就绪，请刷新后重试');this.assertLocalRelationDraftSafe(file);
    const existing=this.app.workspace.getLeavesOfType('markdown').find(l=>l.view.containerEl.ownerDocument===doc&&l.getViewState().state?.file===path),leaf=existing||this.app.workspace.createLeafBySplit(navigationLeaf,'vertical'),previous=existing?.view,deferred=!!existing?.isDeferred;
    if(existing)await leaf.loadIfDeferred();else await leaf.openFile(file,{active:false});
    if(!valid()||leaf.view.containerEl.ownerDocument!==doc||leaf.getViewState().state?.file!==path||existing&&!deferred&&leaf.view!==previous)return;this.assertLocalRelationDraftSafe(file);const opened=leaf.view;
    if(evidence.line!==undefined&&opened instanceof MarkdownView){const pos={line:Math.min(evidence.line,opened.editor.lineCount()-1),ch:0};opened.editor.setCursor(pos);opened.editor.scrollIntoView({from:pos,to:pos},true);}
    if(!valid(true))return;await this.app.workspace.revealLeaf(leaf);if(!valid(true)||leaf.view!==opened||leaf.view.containerEl.ownerDocument!==doc||leaf.getViewState().state?.file!==path)return;this.assertLocalRelationDraftSafe(file);if(this.app.workspace.getActiveViewOfType(View)?.leaf&&this.app.workspace.getActiveViewOfType(View)?.leaf!==leaf&&this.app.workspace.getActiveViewOfType(View)?.leaf!==navigationLeaf)return;this.app.workspace.setActiveLeaf(leaf,{focus:true});
  }
  private sourcePopover?:HTMLElement;private sourcePopoverClose?:()=>void;
  private sourceFile(note:TFile,source:ExcerptSource){return resolveSourceLink(source.link,path=>this.app.metadataCache.getFirstLinkpathDest(path,note.path));}
  async openExcerptSource(note:TFile,source:ExcerptSource,pageOnly=false,pdfBridge=false){
    const target=this.sourceFile(note,source);if(!(target.file instanceof TFile))throw Error('找不到来源文件，原始引用仍保留在摘录笔记中');
    if(isPdfFile(target.file.path)&&(pageOnly||pdfBridge)){await this.app.workspace.openLinkText(target.file.path+(pageOnly?pdfSubpath(source.page||1):(pdfQuoteFragment(source.link)??target.subpath)),note.path,'tab');return;}
    const leaf=await this.plugin.openNoteInSidebar(target.file,target.subpath);
    if(source.line&&leaf.view instanceof MarkdownView){const editor=leaf.view.editor,pos={line:Math.min(editor.lineCount()-1,source.line-1),ch:0};editor.setCursor(pos);editor.scrollIntoView({from:pos,to:pos},true);}
  }
  private async paragraphLocation(origin:ParagraphOrigin){
    const file=this.app.vault.getAbstractFileByPath(origin.path);if(!(file instanceof TFile))throw Error('来源文件缺失，卡片内容仍保留');
    const raw=await this.app.vault.read(file);if(file.path!==origin.path)throw Error('来源已移动，请重开来源菜单');assertNativeNoteUnchanged(this.app,file,raw);
    return {file,raw,...locateParagraph(origin,raw,this.app.metadataCache.getFileCache(file))};
  }
  private addSourceBadge(footer:HTMLElement,note:TFile,sources:ExcerptSource[],scope:Component,original?:string){
    const trigger=button(footer,`摘录来源（${sources.length}）`,'link',()=>{if(popover?.isConnected)close();else show();},'ts-source-trigger');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.title=sources.map(s=>`${this.sourceFile(note,s).file?.basename||sourceLinkTarget(s.link)} · ${s.location}`).join('\n');
    let popover:HTMLElement|undefined,timer:number|undefined;const cancel=()=>{if(timer!==undefined)(footer.ownerDocument.defaultView||window).clearTimeout(timer);timer=undefined;};
    const close=()=>{cancel();footer.ownerDocument.removeEventListener('keydown',onEscape,true);footer.ownerDocument.removeEventListener('pointerdown',onOutside,true);popover?.remove();if(this.sourcePopover===popover){this.sourcePopover=undefined;this.sourcePopoverClose=undefined;}popover=undefined;trigger.setAttribute('aria-expanded','false');};
    const later=()=>{cancel();timer=(footer.ownerDocument.defaultView||window).setTimeout(close,180);};
    const show=()=>{cancel();if(popover?.isConnected)return;this.sourcePopoverClose?.();const doc=footer.ownerDocument,win=doc.defaultView!;popover=doc.body.createDiv({cls:'ts-source-popover',attr:{role:'dialog','aria-label':'摘录来源'}});this.sourcePopover=popover;this.sourcePopoverClose=close;themeSurface(popover);trigger.setAttribute('aria-expanded','true');doc.addEventListener('keydown',onEscape,true);doc.addEventListener('pointerdown',onOutside,true);
      const header=popover.createDiv('ts-source-popover-title');header.createSpan({text:`${sources.length} 条摘录来源`});button(header,'关闭来源','x',close,'ts-icon-button');
      if(original)button(header,'复制原始 PDF 引用','copy',()=>win.navigator.clipboard.writeText(original),'ts-icon-button');
      const list=popover.createDiv('ts-source-list');for(const source of sources){const target=this.sourceFile(note,source),row=list.createDiv('ts-source-row');button(row,`${target.file?.basename||sourceLinkTarget(source.link)} · ${source.location}`,'arrow-up-right',()=>this.openExcerptSource(note,source,false,!!original),'ts-source-open');
        const actions=row.createDiv('ts-source-actions');if(target.file&&isPdfFile(target.file.path))button(actions,'仅打开 PDF 页','file',()=>this.openExcerptSource(note,source,true));button(actions,'同源摘录','layers',()=>{close();return this.selectSourceExcerpts(note,source);});button(actions,'复制来源','copy',async()=>{await win.navigator.clipboard.writeText(source.citation);new Notice('已复制来源引用');});}
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
    try{await ensure();const p=this.materialPoint(),id=uid();owner.change(b=>{b.version=3;b.nodes.push(applyDefaultCardStyle({id,kind:'card',transparent:true,file:file.path,...p,width:this.plugin.settings.defaultCardWidth,height:320,color:nodes[0].color,fillColor:nodes[0].fillColor},this.plugin.settings.defaultCardStyle));for(const source of nodes)b.edges.push({id:uid(),from:source.id,to:id,label:'综合',style:'curve',direction:'forward',color:source.color});});this.revealNode(id);await owner.flush();new Notice('已生成概念笔记，原卡片和原笔记均保留');return file;
    }catch(e){throw Error(`${String(e)}。已生成的概念笔记保留在 ${file.path}`);}
  }
  private applyBoardBackground(){
    const root=this.contentEl;if(!root?.style)return;
    const preferences=boardBackground(this.session?.board,this.plugin.settings);root.dataset.background=preferences.canvasBackground;
    root.style.setProperty('--ts-paper-color',paperBaseColor(preferences));root.style.setProperty('--ts-paper-texture',String(preferences.paperTexture/100));
    const resource=this.plugin.backgroundImageResource(preferences.backgroundImagePath);
    root.style.setProperty('--ts-background-image',resource?`url(${JSON.stringify(resource)})`:'none');root.style.setProperty('--ts-background-image-fit',preferences.backgroundImageFit==='tile'?'auto':preferences.backgroundImageFit);root.style.setProperty('--ts-background-image-repeat',preferences.backgroundImageFit==='tile'?'repeat':'no-repeat');root.style.setProperty('--ts-background-image-opacity',String(preferences.backgroundImageOpacity/100));
  }
  private renderBoard(viewportOnly=false) {
    if (this.closed || !this.session || !this.world || (this.dragging&&!this.gesture?.pan)) return;
    this.applyBoardBackground?.();
    if(isBrainBoard(this.session.board)){this.renderBrainBoard();return;}
    if(this.brainBoardView)this.clearBrainBoard();
    // Read stage dimensions once before node style writes; drag frames reuse this snapshot.
    this.controlStageSize={width:this.stage.clientWidth,height:this.stage.clientHeight};
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
    const branchRender=branchRenderSnapshot();this.updateBackToContent(branchRender);const b = this.displayBoard();if(!viewportOnly){this.syncCanvasControls();this.contentEl.toggleClass('ts-mindmap-mode',b.mode==='mindmap');this.mindmapButton?.toggleClass('is-active',b.mode==='mindmap');this.mindmapButton?.setAttribute('aria-pressed',String(b.mode==='mindmap'));}
    if(this.startScreen)this.startScreen.hidden=!!b.nodes.length;
    if(!viewportOnly){this.updateObjectFilter();this.renderSaveStatus(); this.fileTitle?.setText(this.file?.basename || '研究工作台'); this.renderNavigation();}
    const v=b.viewport;this.world.style.setProperty('--ts-port-scale',String(1/Math.min(1,Math.max(.05,v.zoom))));this.world.style.transform=`translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;this.stage.style.backgroundSize=`${visibleGridSize(this.plugin.settings.gridStep,v.zoom)}px ${visibleGridSize(this.plugin.settings.gridStep,v.zoom)}px`;this.stage.style.backgroundPosition=`${v.x}px ${v.y}px`;this.zoomLabel.setText(`${Math.round(v.zoom*100)}%`);
    const visible=visibleNodes(branchRender.visible(b).nodes,viewportRect(v,this.controlStageSize.width,this.controlStageSize.height));
    for(const id of new Set([this.inlineId,this.inlineTarget])){if(id===undefined)continue;const editing=b.nodes.find(n=>n.id===id);if(editing&&!visible.some(n=>n.id===editing.id))visible.push(editing);}
    // Only mounted nodes can contain a title editor. Share this synchronous
    // render's DOM checks while preserving board order for offscreen drafts.
    const editingTitles=new Set<string>();for(const[id,el]of this.positions)if(el.querySelector('.ts-card-title-input'))editingTitles.add(id);
    if(editingTitles.size)for(const node of b.nodes)if(editingTitles.has(node.id)&&!visible.some(n=>n.id===node.id))visible.push(node);
    const live=new Set(visible.map(n=>n.id));let childCandidates:ReturnType<typeof childConnectionCandidates>|undefined;
    for(const [id,el] of this.positions){if(!live.has(id)){this.mediaPlayers.get(id)?.pause();el.remove();this.positions.delete(id);this.nodeScopes.get(id)?.unload();this.nodeScopes.delete(id);this.nodeKeys.delete(id);}}
    // File metadata is shared only inside this synchronous render. Even a missing
    // cache is read once; the next content refresh always starts from current data.
    const fileMetadata=new Map<TFile,{cache:CachedMetadata|null;tags:string[]|null}>();
    // Stable buckets preserve preview priority and stacking order without sorting
    // the same visible nodes for detail allocation, mounting and DOM placement.
    const preferred:string[]=[],remaining:string[]=[],sections:Card[]=[],objects:Card[]=[];
    for(const n of visible){(this.selected.has(n.id)?preferred:remaining).push(n.id);(n.kind==='section'?sections:objects).push(n);}
    if(!viewportOnly){const mediaIds=new Set(b.nodes.filter(n=>n.kind==='audio'||n.kind==='video').map(n=>n.id));for(const id of this.mediaStates.keys())if(!mediaIds.has(id)){this.mediaStates.delete(id);this.mediaIdentities.delete(id);}const onlineIds=new Set(b.nodes.filter(n=>n.webUrl).map(n=>n.id));for(const id of this.onlineBoardStates.keys())if(!onlineIds.has(id))this.onlineBoardStates.delete(id);}
    const detailIds=new Set(preferred.concat(remaining).slice(0,this.plugin.settings.previewLimit)),ordered=sections.concat(objects);
    this.connectionCandidates=ordered;
    let pendingFoldFocus:HTMLButtonElement|undefined;
    for (const n of ordered) {
      const editingTitle=this.positions.get(n.id);if(editingTitle&&editingTitles.has(n.id)){this.positionNode(n,editingTitle);continue;}
      if(this.inlineId===n.id&&this.inline&&this.positions.get(n.id)?.contains(this.inline.el)){this.syncInlineAppearance(n,this.positions.get(n.id)!);continue;}
      const detail=n.id===this.inlineTarget||(v.zoom>=this.plugin.settings.detailZoom && detailIds.has(n.id));
      // Camera-only frames can reuse unchanged card DOM without serializing note
      // content or consulting metadata. Crossing the detail threshold still rebuilds.
      const mounted=this.positions.get(n.id),mindmap=n.kind==='mindmap'?this.boardMindmaps.get(n.id):undefined;
      if(n.kind==='mindmap'&&mounted&&mindmap){mounted.toggleClass('is-selected',this.selected.has(n.id));mounted.toggleClass('is-locked',!!n.locked);mounted.toggleClass('is-filtered-out',!!this.filterMatches&&!this.filterMatches.has(n.id));mounted.toggleClass('is-unrelated',!!this.relatedFocus&&!this.relatedFocus.has(n.id));this.positionNode(n,mounted);this.syncMindmapResize(n,mounted);if(!viewportOnly)mindmap.refresh();continue;}
      if(viewportOnly&&mounted&&((n.collapsed||n.branchFolded||n.sectionFolded)||n.kind==='section'||mounted.classList.contains('ts-node-summary')===!detail)){this.positionNode(n,mounted);continue;}
      // Mounted camera-only previews need no child-relation index. Build it once
      // per render only when a node must be checked or created, never across edits.
      const branches=branchRender.state(b);childCandidates??=childConnectionCandidates(b,live);
      const fileInfo=n.file?this.app.vault.getAbstractFileByPath(n.file):undefined;
      let metadata=fileInfo instanceof TFile?fileMetadata.get(fileInfo):undefined;
      if(fileInfo instanceof TFile&&!metadata){const cache=this.app.metadataCache.getFileCache(fileInfo);metadata={cache,tags:getAllTags(cache||{})};fileMetadata.set(fileInfo,metadata);}
      const childCount=branches.children.get(n.id)?.length||0,branchOptions={count:childCount,candidates:childCandidates.get(n.id)?.length||0,folded:!!n.branchFolded,disabled:!!this.session.blocked||!!n.locked,group:n.kind==='section',onToggle:()=>act(()=>this.foldBranches(new Set([n.id]),childCount?!n.branchFolded:true,childCount&&n.branchFolded?'level':'collapse',!childCount)),onMenu:(anchor:HTMLElement)=>this.branchDisclosureMenu(n.id,anchor)};
      const isMedia=n.kind==='audio'||n.kind==='video'||!!n.webUrl&&!!parseOnlineSource(n.webUrl),mediaBranchKey=isMedia?JSON.stringify([childCount,branchOptions.candidates,branchOptions.folded,branchOptions.disabled]):'';
      const key=nodeRenderKey(n,[isMedia?0:childCount,isMedia?0:branchOptions.candidates,detail,this.session.blocked,fileInfo instanceof TFile?[fileInfo.stat.mtime,fileInfo.stat.size,metadata?.cache?.frontmatter,metadata?.tags]:null,n.kind==='card'&&this.plugin.settings.compactDuplicateCardTitles]);
      const old=this.positions.get(n.id);if(old&&this.nodeKeys.get(n.id)===key){if(isMedia&&old.dataset.mediaBranches!==mediaBranchKey){old.querySelector(':scope > .ts-branch-controls')?.remove();renderBranchControls(old,branchOptions);old.dataset.mediaBranches=mediaBranchKey;old.classList.toggle('has-folded-branches',!!childCount&&!!n.branchFolded);}old.toggleClass('is-selected',this.selected.has(n.id));this.positionNode(n,old);old.toggleClass('is-filtered-out',!!this.filterMatches&&!this.filterMatches.has(n.id));old.toggleClass('is-unrelated',!!this.relatedFocus&&!this.relatedFocus.has(n.id));continue;}
      const foldFocus=old?.ownerDocument.activeElement?.closest('.ts-content-fold,.ts-card-quick-fold,.ts-compact-unfold,button[aria-label="折叠图片"]');
      const restoreFoldFocus=!!foldFocus&&!!old?.contains(foldFocus);
      this.mediaPlayers.get(n.id)?.pause();old?.remove();this.nodeScopes.get(n.id)?.unload();const scope=new Component();scope.load();this.nodeScopes.set(n.id,scope);this.nodeKeys.set(n.id,key);
      const el = this.world.createDiv({ cls: `ts-node ts-${n.kind} ts-color-${n.color}`, attr: { 'data-id': n.id } });
      const compactControls=!!(n.collapsed||n.branchFolded||n.sectionFolded);
      el.dataset.controlCount=String(compactControls?1:n.kind==='card'?(fileInfo instanceof TFile?5:1):n.kind==='text'?3:2);
      const primaryCount=compactControls?0:n.kind==='card'&&fileInfo instanceof TFile?2:n.kind==='text'&&!n.webUrl?1:0;
      el.dataset.controlWidth=String(32*Number(el.dataset.controlCount)+4+36*primaryCount);
      // A labelled edit action occupies 64 px plus its 4 px gap. Single-object
      // editing is also offered by the top toolbar; hover/batch docks keep it.
      el.dataset.controlEditWidth=String(primaryCount?68:0);
      el.toggleClass('is-filtered-out',!!this.filterMatches&&!this.filterMatches.has(n.id));el.toggleClass('is-locked',!!n.locked);el.toggleClass('is-unrelated',!!this.relatedFocus&&!this.relatedFocus.has(n.id));el.toggleClass('ts-topic',!!n.topic);this.positions.set(n.id, el); el.toggleClass('is-selected', this.selected.has(n.id)); this.positionNode(n, el);
      el.toggleClass('is-fixed-reading',n.kind==='card'?!n.autoFit:n.kind==='text'&&!textFitsContent(n));
      if(isMedia)el.dataset.mediaBranches=mediaBranchKey;
      if(n.kind!=='section'&&n.kind!=='mindmap')renderBranchControls(el,branchOptions);el.classList.toggle('has-folded-branches',!!childCount&&!!n.branchFolded);
      if(n.review&&n.review!=='later')el.createDiv({cls:'ts-review-badge',text:reviewLabels[n.review],attr:{'aria-label':`阅读状态：${reviewLabels[n.review]}`}});
      // Resize is an interaction affordance, independent of expensive preview detail.
      if (!(n.collapsed||n.branchFolded||n.sectionFolded)&&!n.locked){
        el.createDiv({ cls: 'ts-resize', attr: { 'aria-label': '拖动调整大小' } });
        if(n.kind==='section')for(const [edge,label] of [['top','上边'],['right','右边'],['bottom','下边'],['left','左边']] as const){
          for(const part of ['start','end'])el.createDiv({cls:'ts-resize ts-section-resize-edge',attr:{'data-resize-edge':edge,'data-edge-part':part,'aria-label':`拖动分组${label}调整范围`,title:`拖动${label}调整范围 · 组内内容保持位置`}});
        }
      }
      if(n.kind==='mindmap'){this.mountBoardMindmap(n,el,scope);continue;}
      const focusFold=(target:HTMLButtonElement|null)=>{
        if(!restoreFoldFocus||!target||target.disabled)return;
        pendingFoldFocus=target;
      };
      const trackControls=()=>{
        scope.register(mountCardControlHover(el));
        const place=()=>{if(this.session&&el.isConnected)this.positionNode(this.connectionCandidates.find(item=>item.id===n.id)||n,el,this.inlineTarget===n.id||this.inlineId===n.id);};
        const focus=()=>{el.classList.add('is-control-focus');place();};
        const blur=()=>{el.classList.remove('is-control-focus');place();};
        el.addEventListener('pointerenter',place);el.addEventListener('focusin',focus);el.addEventListener('focusout',blur);
        scope.register(()=>{el.removeEventListener('pointerenter',place);el.removeEventListener('focusin',focus);el.removeEventListener('focusout',blur);});
      };
      if((n.collapsed||n.branchFolded||n.sectionFolded)){
        const owner=this.session;
        el.addClass('is-compact-fold');
        const title=n.kind==='card'?cardDisplayTitle(n,fileInfo instanceof TFile?fileInfo:undefined):n.title||(n.kind==='text'?textExcerptPresentation(n.text||'').body.split(/\r?\n/).find(line=>line.trim())?.trim():fileInfo instanceof TFile?fileInfo.basename:undefined)||'未命名';
        const row=el.createDiv('ts-compact-fold-row');
        setIcon(row.createSpan('ts-compact-fold-icon'),n.kind==='section'?'folder':n.kind==='board'?'panels-top-left':n.kind==='image'?'image':n.kind==='pdf'?'file-text':n.kind==='video'?'film':n.kind==='audio'?'music':n.kind==='text'?'type':'file-text');
        row.createSpan({cls:'ts-compact-fold-title',text:title,attr:{title}});
        const expand=()=>{this.requireOwner(owner);const current=owner.board.nodes.find(node=>node.id===n.id);if(!current||current.locked||owner.blocked)return;if(current.sectionFolded)this.setSelectionFold(new Set([n.id]),false,true);else if(current.collapsed)this.foldText(n.id,false);else if(current.branchFolded)this.foldBranches(new Set([n.id]),false,'level');};
        const label=n.sectionFolded?'展开分组':n.collapsed?'展开内容':'展开下一层';
        const actions=row.createDiv({cls:'ts-compact-actions',attr:{role:'group','aria-label':'折叠对象操作'}});
        actions.onpointerdown=e=>e.stopPropagation();actions.ondblclick=e=>e.stopPropagation();
        if(n.kind==='card'&&fileInfo instanceof TFile&&fileInfo.extension==='md'){
          const read=button(actions,'在右侧阅读笔记','panel-right-open',async()=>{this.requireOwner(owner);const current=owner.board.nodes.find(node=>node.id===n.id);if(!current||current.kind!=='card'||current.file!==fileInfo.path)throw Error('卡片已变化，请重新打开');await this.plugin.openNoteInSidebar(fileInfo,undefined,false,true);},'ts-icon-button ts-compact-read');
          read.onpointerdown=e=>e.stopPropagation();read.ondblclick=e=>e.stopPropagation();
        }
        const documentCompact=(n.kind==='card'||n.kind==='text')&&!n.webUrl;el.toggleClass('ts-document-compact',documentCompact);
        const inlineUnfold=documentCompact||!!n.collapsed||!!n.sectionFolded;
        el.toggleClass('ts-content-compact',inlineUnfold);
        const unfold=button(inlineUnfold?row:actions,label,'chevron-down',expand,'ts-icon-button ts-compact-unfold'+(inlineUnfold?' ts-compact-inline-unfold':''));unfold.disabled=owner.blocked||!!n.locked;unfold.setAttribute('aria-expanded','false');unfold.onpointerdown=e=>e.stopPropagation();unfold.ondblclick=e=>e.stopPropagation();
        if(n.kind==='section')renderBranchControls(el,{...branchOptions,group:false});
        this.addPorts(el,n.id);
        el.ondblclick=e=>{if((e.target as Element).closest('button'))return;e.stopPropagation();act(expand);};
        trackControls();
        focusFold(unfold);
        continue;
      }
      if(!detail&&n.kind!=='section'){el.addClass('ts-node-summary');if(['card','text','image','pdf','audio','video'].includes(n.kind))this.addPorts(el,n.id);el.createDiv({cls:'ts-summary-title',text:n.kind==='card'?cardDisplayTitle(n,fileInfo instanceof TFile?fileInfo:undefined):fileInfo instanceof TFile?fileInfo.basename:n.title||n.text?.split('\n')[0]||'笔记'});el.ondblclick=e=>{if((e.target as Element).closest('button'))return;e.stopPropagation();if(n.kind==='card'||n.kind==='text')act(()=>this.startInlineEdit(n.id));else if(n.kind==='pdf'&&fileInfo instanceof TFile)act(()=>this.plugin.openNoteInSidebar(fileInfo,pdfSubpath(n.pdfPage)));else{this.revealNode(n.id);this.session!.board.viewport.zoom=1;this.revealNode(n.id);}};continue;}
      const header = el.createDiv('ts-node-header'); el.toggleClass('is-folded', !!n.collapsed);
      if (n.kind === 'section') {
        el.toggleClass('is-section-folded',!!n.sectionFolded);setIcon(header.createSpan(),n.sectionFolded?'folder':'folder-open');header.createSpan({text:n.title,cls:'ts-section-title'});
        const fold=button(header,n.sectionFolded?'展开分组':'折叠分组',n.sectionFolded?'chevron-down':'chevron-up',()=>this.setSelectionFold(new Set([n.id]),!n.sectionFolded,true),'ts-icon-button ts-content-fold ts-section-fold ts-section-content-fold');
        fold.lastElementChild?.setText('内容');fold.title=n.sectionFolded?'展开框内内容 · 连线子节点单独控制':'折叠框内内容 · 连线子节点单独控制';renderBranchControls(header,branchOptions);
        fold.disabled=this.session.blocked||!!n.locked;fold.setAttribute('aria-expanded',String(!n.sectionFolded));fold.onpointerdown=e=>e.stopPropagation();fold.ondblclick=e=>e.stopPropagation();
        header.title='双击标题重命名 · 拖动标题移动内容 · 双击组内空白调整四边';header.ondblclick=e=>{if((e.target as Element).closest('button'))return;e.stopPropagation();this.renameSection(n.id);};
      } else if (n.kind === 'board') {
        const owner=this.session;
        const file = this.app.vault.getAbstractFileByPath(n.file!);
        el.addClass('ts-board-portal'); setIcon(header.createSpan('ts-portal-icon'), 'panels-top-left');
        header.createSpan({ cls:'ts-portal-title',text: file instanceof TFile ? file.basename : n.title || '白板不存在' });
        const fold=button(header,n.collapsed?'展开子白板':'折叠子白板',n.collapsed?'chevron-down':'chevron-up',()=>{
          this.requireOwner(owner);this.mutate(b=>foldCards(b,new Set([n.id]),!n.collapsed));
        },'ts-icon-button ts-content-fold ts-portal-fold');
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
      } else if(n.webUrl){
        const owner=this.session!;header.remove();renderWebCard(el,n,{open:()=>{this.requireOwner(owner);this.openWebCard(n.id);},edit:()=>{this.requireOwner(owner);this.editWebCard(n.id);},fold:()=>{this.requireOwner(owner);this.foldText(n.id,true);},copy:()=>{this.requireOwner(owner);this.copyWebCard(n.id);},disabled:owner.blocked||!!n.locked,register:dispose=>scope.register(dispose),online:parseOnlineSource(n.webUrl)?{open:()=>{this.requireOwner(owner);const state=this.onlineBoardStates.get(n.id);act(()=>this.plugin.openOnlineWorkspace(n.webUrl!,'sidebar',state&&state.source===parseOnlineSource(n.webUrl!)?.path?state.time:undefined));},mount:host=>this.mountOnlineBoardCard(n,host,owner)}:undefined});
      } else if(n.kind==='text'){
        header.remove();el.dataset.ink=n.textColor || 'default';
        el.toggleClass('is-media-reference',/^!\[\[.*#\^thoughtspace-media-[A-Za-z0-9_-]+\]\]$|^!\[[^\]]*\]\([^\n]*#\^thoughtspace-media-[A-Za-z0-9_-]+\)$/.test((n.text||'').trim()));
        const presentation=textExcerptPresentation(n.text||'');el.toggleClass('has-excerpt-source',!!presentation.sources.length);
        const owner=this.session,actions=el.createDiv('ts-card-actions ts-text-actions');
        const current=()=>{this.requireOwner(owner);const node=owner.board.nodes.find(item=>item.id===n.id);if(!node||node.kind!=='text'||node.webUrl||node.locked)throw Error('文本已变化或锁定，请重新选择');return node;};
        mountCardQuickActions(actions,{kind:'text',add:(label,icon,run,cls)=>button(actions,label,icon,run,cls),
          edit:()=>{current();return this.startInlineEdit(n.id);},
          toggleAutoFit:()=>{current();return this.setTextAutoHeight(n.id);},
          fold:()=>{current();this.foldText(n.id,true);},autoFit:textFitsContent(n),locked:n.locked,readOnly:owner.blocked});
        const textBody=el.createDiv({cls:'ts-text-body'});textBody.style.fontFamily=textFontFamily(n.fontFamily);textBody.style.fontSize=`${n.collapsed?Math.min(n.fontSize||16,24):n.fontSize||16}px`;textBody.style.textAlign=n.textAlign || 'left';
        if(n.collapsed){textBody.setText(presentation.body.split(/\r?\n/).find(line=>line.trim())?.trim()||'空文本');}
        else{
          renderTextPreview(textBody,presentation.sources.length?presentation.body.trimEnd():presentation.body,scope,()=>{if(textBody.isConnected)this.queueTextFit(n);},(alive,run)=>this.previewQueue.add(alive,run),{app:this.app,sourcePath:this.session.file.path});
          if(presentation.sources.length){textBody.appendText('\u2060');this.addSourceBadge(textBody,this.session.file,presentation.sources,scope,n.pdfQuote?.original);}
          this.queueTextFit(n);
        }
        el.ondblclick=e=>{if((e.target as Element).closest('button,a'))return;e.stopPropagation();this.editText(n.id);};
      } else if(n.kind==='audio'||n.kind==='video'){
        this.renderMediaCard(n,el,header,scope);
      } else if(n.kind==='pdf'){
        this.renderPdfCard(n,el,header,scope);
      } else if(n.kind==='image'){
        const owner=this.session!,file=this.app.vault.getAbstractFileByPath(n.file!),remote=remoteImageUrl(n.imageUrl);header.remove();el.setAttribute('aria-label',n.title||(file instanceof TFile?file.basename:'图片'));el.addClass('ts-media-card');
        const actions=el.createDiv('ts-card-actions ts-image-actions');
        const fold=button(actions,'折叠图片','chevron-up',()=>this.foldText(n.id,true),'ts-icon-button');fold.disabled=owner.blocked||!!n.locked;fold.setAttribute('aria-expanded','true');fold.onpointerdown=e=>e.stopPropagation();fold.ondblclick=e=>e.stopPropagation();
        const hosting=button(actions,n.imageUrl?'已上传图床 · 复制图片链接':'上传到极速图床',n.imageUrl?'cloud-check':'cloud-upload',()=>{this.requireOwner(owner);const current=owner.board.nodes.find(node=>node.id===n.id);if(current?.imageUrl){act(async()=>{await navigator.clipboard.writeText(current.imageUrl!);new Notice('已复制图床图片链接');});}else act(async()=>{hosting.disabled=true;hosting.setAttribute('aria-busy','true');try{await this.uploadExistingImage(n.id);}finally{if(hosting.isConnected){hosting.removeAttribute('aria-busy');hosting.disabled=owner.blocked||!!owner.board.nodes.find(node=>node.id===n.id)?.locked;}}});},'ts-icon-button');hosting.disabled=!n.imageUrl&&(owner.blocked||!!n.locked||this.hostedUploads.has(n.id));hosting.onpointerdown=e=>e.stopPropagation();
        if(file instanceof TFile||remote){const local=file instanceof TFile?this.app.vault.getResourcePath(file):undefined;let fallback=false;const img=el.createEl('img',{cls:'ts-image-body',attr:{src:remote||local!,alt:n.title||(file instanceof TFile?file.basename:'图床图片'),draggable:'false',referrerpolicy:'no-referrer'}});const fit=()=>{if(!img.isConnected||this.session!==owner)return;const size=mediaDimensions(n.width,img.naturalWidth,img.naturalHeight);if(size)this.queueNodeFit(n,size);};img.onload=fit;scope.register(()=>{img.onload=null;img.onerror=null;});if(img.complete)fit();img.onerror=()=>{if(remote&&local&&!fallback){fallback=true;img.src=local;img.title='图床暂不可用，显示本地备份';return;}img.replaceWith(el.createDiv({cls:'ts-missing',text:'图片无法显示，请检查图床或本地备份'}));};el.ondblclick=e=>{e.stopPropagation();if(remote)el.ownerDocument.defaultView?.open(remote,'_blank','noopener,noreferrer');else if(file instanceof TFile)act(()=>this.app.workspace.getLeaf('tab').openFile(file));};}
        else el.createDiv({cls:'ts-missing',text:'找不到图片文件，请右键重新关联。'});
      } else {
        const file = fileInfo;
        setIcon(header.createSpan(), 'file-text');const noteTitle=header.createSpan({ text:cardDisplayTitle(n,file instanceof TFile?file:undefined) });if(file instanceof TFile)noteTitle.dataset.tsNotePath=file.path;
        {const owner=this.session!;let previous=n.title;scope.register(bindCardTitle(noteTitle,{
          getTitle:()=>cardDisplayTitle(owner.board.nodes.find(node=>node.id===n.id)||n,file instanceof TFile?file:undefined),
          started:()=>{previous=owner.board.nodes.find(node=>node.id===n.id)?.title;},
          canEdit:()=>{this.requireOwner(owner);const current=owner.board.nodes.find(node=>node.id===n.id);if(!current||current.kind!=='card')throw Error('卡片已变化，请重新编辑');if(current.locked||owner.blocked)throw Error('卡片已锁定或白板暂不可编辑');},
          save:async value=>{this.requireOwner(owner);owner.change(board=>setCardTitle(board,n.id,value,previous));previous=owner.board.nodes.find(node=>node.id===n.id)?.title;await owner.flush();},
          finished:()=>{if(preview)syncCardTitlePresentation(el,noteTitle,preview,this.plugin.settings.compactDuplicateCardTitles);this.renderBoard();}
        }));}

        const owner=this.session,actions=el.createDiv('ts-card-actions');
        const current=(write=true)=>{
          if(this.closed||this.session!==owner)throw Error('白板已切换，请重新选择卡片');
          if(write)this.requireOwner(owner);
          const node=owner.board.nodes.find(item=>item.id===n.id);
          if(!node||node.kind!=='card'||node.file!==n.file||file instanceof TFile&&(file.path!==node.file||this.app.vault.getAbstractFileByPath(file.path)!==file))throw Error('卡片已变化，请重新选择');
          if(write&&node.locked)throw Error('请先解锁卡片');return node;
        };
        mountCardQuickActions(actions,{kind:'card',add:(label,icon,run,cls)=>button(actions,label,icon,run,cls),
          edit:file instanceof TFile?()=>{current();return this.startInlineEdit(n.id);}:undefined,
          read:file instanceof TFile?()=>{current(false);return this.plugin.openNoteInSidebar(file,undefined,false,true);}:undefined,
          preview:file instanceof TFile?()=>{current(false);new NotePreview(this.app,file,this.plugin).open();}:undefined,
          toggleAutoFit:file instanceof TFile?()=>{const node=current();this.fitCards(new Set([node.id]),!node.autoFit);}:undefined,
          fold:()=>{current();this.foldText(n.id,true);},autoFit:!!n.autoFit,locked:n.locked,readOnly:owner.blocked});
        const preview = n.collapsed ? undefined : el.createDiv('ts-card-preview markdown-rendered');
        if(preview){el.dataset.ink=n.textColor||'default';preview.style.fontFamily=textFontFamily(n.fontFamily);preview.style.fontSize=`${n.fontSize||14}px`;preview.style.textAlign=n.textAlign||'left';}
        if (file instanceof TFile) {
          if (preview) {preview.addClass('ts-preview-pending');preview.setAttribute('aria-busy','true');preview.setAttribute('aria-label','正在加载笔记');renderCardPreview({app:this.app,file,preview,scope,enqueue:(alive,run)=>this.previewQueue.add(alive,run),
            sources:sources=>{const footer=el.querySelector<HTMLElement>('.ts-card-meta');if(footer){footer.querySelector('.ts-card-meta-placeholder')?.remove();this.addSourceBadge(footer,file,sources,scope);}},
            ready:bodyEmpty=>{syncCardTitlePresentation(el,noteTitle,preview,this.plugin.settings.compactDuplicateCardTitles);scope.register(mountCardReadingAffordance(preview,el));
              if(bodyEmpty){
                preview.addClass('is-empty-document');
                const prompt=button(preview,'写下第一行想法','square-pen',()=>{current();return this.startInlineEdit(n.id);},'ts-card-empty-prompt');prompt.disabled=owner.blocked||!!n.locked;prompt.onpointerdown=e=>e.stopPropagation();prompt.ondblclick=e=>e.stopPropagation();
              }
              if(n.autoFit&&!n.locked){this.queueCardFit(n,preview);for(const img of Array.from(preview.querySelectorAll('img'))){const ready=()=>{if(preview.isConnected)this.queueCardFit(n,preview);};img.addEventListener('load',ready,{once:true});scope.register(()=>img.removeEventListener('load',ready));}}},
            error:()=>{preview.empty();const error=preview.createDiv({cls:'ts-preview-error',attr:{role:'status'}});error.createSpan({text:'暂时无法加载笔记'});button(error,'重试','rotate-cw',()=>{if(preview.isConnected){this.nodeKeys.delete(n.id);this.scheduleRender();}},'ts-icon-button');}
          });}
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
      const contentFold=el.querySelector<HTMLButtonElement>('.ts-content-fold');
      if(contentFold){
        if(n.webUrl)setIcon(contentFold,'chevron-up');
        const dock=el.createDiv({cls:'ts-card-actions ts-fold-actions',attr:{role:'group','aria-label':'内容折叠操作'}});
        dock.append(contentFold);dock.onpointerdown=e=>e.stopPropagation();dock.ondblclick=e=>e.stopPropagation();
        el.dataset.controlCount='1';el.dataset.controlWidth='36';this.positionNode(n,el);
      }
      if(['card','text','image','pdf','audio','video','section'].includes(n.kind))this.addPorts(el,n.id);
      trackControls();
      focusFold(el.querySelector<HTMLButtonElement>('.ts-content-fold,.ts-card-quick-fold,button[aria-label="折叠图片"]'));
    }
    let previous:Element=this.svg;for(const n of ordered){const el=this.positions.get(n.id);if(el){if(previous.nextElementSibling!==el)this.world.insertBefore(el,previous.nextSibling);previous=el;}}
    // Moving a mounted element during the stable ordering pass blurs focus.
    // Restore only after that pass, and reveal hidden docks before focusing.
    if(pendingFoldFocus){pendingFoldFocus.closest('.ts-node')?.classList.add('is-control-focus');pendingFoldFocus.focus({preventScroll:true});}
    this.renderEdges(branchRender,b);if(!viewportOnly)this.renderInspector();if(!viewportOnly||!this.mapKey)this.renderMinimap(branchRender);else this.mapViewport?.();this.syncMinimapAvoidance();
  }
  private mountOnlineBoardCard(node:Card,host:HTMLElement,owner=this.session){
    const source=parseOnlineSource(node.webUrl!);if(!source)throw Error('在线视频来源无效');
    const current=()=>!this.closed&&this.session===owner&&!!owner?.board.nodes.some(item=>item.id===node.id&&item.webUrl&&parseOnlineSource(item.webUrl)?.path===source.path);
    const remembered=this.onlineBoardStates.get(node.id);
    const handle=mountOnlineBoardPlayer(host,source.path,{
      alive:()=>current()&&host.isConnected,disabled:owner!.blocked||!!node.locked,
      initialTime:remembered?.source===source.path?remembered.time:source.initialTime,
      onState:state=>{if(current()&&state.available&&state.sourcePath===source.path)this.onlineBoardStates.set(node.id,{source:source.path,time:state.time});},
      onPlay:()=>this.plugin.activateOnlineBoardPlayer(handle),
      onCapture:moment=>this.captureOnlineBoardMoment(node.id,source.path,moment,owner)
    });
    this.onlineBoardPlayers.set(node.id,handle);const unregister=this.plugin.registerOnlineBoardPlayer(handle);
    return()=>{handle.dispose();unregister();if(this.onlineBoardPlayers.get(node.id)===handle)this.onlineBoardPlayers.delete(node.id);};
  }
  private async captureOnlineBoardMoment(id:string,input:string,data:OnlineBoardMoment,owner=this.session){
    const source=parseOnlineSource(input);if(!source)throw Error('在线视频来源无效');mediaTime(data.time);
    const ensure=()=>{this.requireOwner(owner);const node=owner!.board.nodes.find(item=>item.id===id);if(node?.kind!=='text'||!node.webUrl||parseOnlineSource(node.webUrl)?.path!==source.path||node.locked)throw Error('视频卡片已变化或锁定，请回到原卡片重试');return node;};
    ensure();if(this.inline&&!await this.inline.commit())throw Error('请先完成当前卡片的编辑');ensure();
    const {note,moment}=await this.plugin.saveOnlineBoardMoment(source.path,data);
    let node:Card;try{node=ensure();}catch{new Notice(`摘录已保留：${note.path}；白板或视频卡片已变化，未插入卡片`);return;}
    const next='online-'+data.id;if(owner!.board.nodes.some(item=>item.id===next))return;
    const link=onlinePlayerUrl(this.app.vault.getName(),source.path,moment.time,note.path);
    const text=[moment.image,moment.text,`[${mediaClock(moment.time)} · 回看视频](${link})`].filter(Boolean).join('\n\n');
    const width=320,height=moment.image?280:120,x=node.x+node.width+56;let y=node.y;
    // Scan in vertical order so each overlapping card moves the new one below it.
    const obstacles=owner!.board.nodes.filter(item=>item.kind!=='section'&&item.x<x+width&&item.x+item.width>x).sort((a,b)=>a.y-b.y);
    for(const other of obstacles)if(other.y<y+height+24&&other.y+other.height+24>y)y=other.y+other.height+24;
    owner!.change(board=>{board.version=3;board.nodes.push({id:next,kind:'text',text,x,y,width,height,color:node.color,fontSize:this.plugin.settings.defaultTextSize,autoSize:false});board.edges.push({id:uid(),from:id,to:next,label:mediaClock(moment.time),style:this.plugin.settings.defaultEdgeStyle,direction:'forward'});});
    // Keep the player prioritized when the board has more cards than previewLimit.
    this.selected=new Set([id]);this.selectedEdge=undefined;this.updateSelection();new Notice(moment.image?'截图与时间戳已保存并加入白板':'时间戳已保存并加入白板');
  }
  async seekOnlineSource(input:string,time:number,excerptId?:string,preferred?:string){
    const owner=this.requireOwner(),source=parseOnlineSource(input);mediaTime(time);if(!source)throw Error('在线视频来源无效');
    const linked=new Set(owner.board.edges.filter(edge=>edge.to===excerptId).map(edge=>edge.from));
    const matches=owner.board.nodes.filter(node=>node.webUrl&&parseOnlineSource(node.webUrl)?.path===source.path),node=matches.find(node=>node.id===preferred)||matches.find(node=>linked.has(node.id))||matches[0];
    if(!node)throw Error('来源视频已从白板移除');
    if(node.collapsed||node.branchFolded){if(node.locked)throw Error('请先解锁并展开视频卡片');owner.change(board=>{foldCards(board,new Set([node.id]),false);const current=board.nodes.find(item=>item.id===node.id);if(current)delete current.branchFolded;});}
    this.onlineBoardStates.set(node.id,{source:source.path,time});this.revealNode(node.id);
    if(owner.board.viewport.zoom<this.plugin.settings.detailZoom){owner.board.viewport.zoom=1;this.revealNode(node.id);}
    if(!this.onlineBoardPlayers.has(node.id))this.nodeKeys.delete(node.id);this.renderBoard();
    const player=this.onlineBoardPlayers.get(node.id);if(!player)throw Error('请先展开来源视频卡片');await player.seek(time);
  }
  private pdfTotals=new Map<string,{stamp:number;total:number}>();
  seekMediaSource(source:MediaSource){
    const owner=this.requireOwner();if(owner.file.path!==source.board)throw Error('来源白板已切换');
    const node=owner.board.nodes.find(n=>n.id===source.node);
    if(!node||!mediaKind(node.file||'')||(node.kind!=='audio'&&node.kind!=='video')||node.file!==source.file)throw Error('来源媒体已移动或从白板移除');
    if(!(this.app.vault.getAbstractFileByPath(source.file) instanceof TFile))throw Error('来源媒体已移动或删除');
    mediaTime(source.time);
    if(node.collapsed||node.branchFolded){if(node.locked)throw Error('请先解锁并展开媒体卡片');owner.change(b=>{foldCards(b,new Set([node.id]),false);const current=b.nodes.find(n=>n.id===node.id);if(current)delete current.branchFolded;});}
    this.revealNode(node.id);if(owner.board.viewport.zoom<this.plugin.settings.detailZoom){owner.board.viewport.zoom=1;this.revealNode(node.id);}this.renderBoard();
    const previous=this.mediaStates.get(node.id);this.mediaStates.set(node.id,{time:source.time,rate:previous?.rate||1,volume:previous?.volume??1});this.mediaPlayers.get(node.id)?.pause();this.mediaPlayers.get(node.id)?.seek(source.time);
    new Notice(`已定位到 ${mediaClock(source.time)}，点击播放继续`);
  }
  private async captureMedia(id:string,time:number,owner=this.session){
    this.requireOwner(owner);mediaTime(time);
    const original=owner!.board.nodes.find(n=>n.id===id),path=original?.file,kind=original?.kind,file=path?this.app.vault.getAbstractFileByPath(path):undefined;
    if(!original||!path||(kind!=='audio'&&kind!=='video')||!(file instanceof TFile))throw Error('来源媒体已移动或删除');
    const stamp=file.stat.mtime,size=file.stat.size;
    await this.plugin.mediaWorkspace.validateResource(file);this.requireOwner(owner);
    if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    await this.plugin.mediaWorkspace.validateResource(file);this.requireOwner(owner);
    const media=owner!.board.nodes.find(n=>n.id===id);
    if(!media||media.file!==path||media.kind!==kind||file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file||file.stat.mtime!==stamp||file.stat.size!==size)throw Error('来源媒体已变化，请重新摘录');
    this.mediaPlayers.get(id)?.pause();
    const source:MediaSource={vault:this.app.vault.getName(),board:owner!.file.path,node:id,file:media.file,time};
    const text=mediaSourceMarkdown(source),next=uid(),x=media.x+media.width+56;
    let y=media.y;for(const other of owner!.board.nodes)if(other.x<x+280&&other.x+other.width>x&&other.y<y+100&&other.y+other.height>y)y=other.y+other.height+24;
    owner!.change(b=>{b.version=3;b.nodes.push({id:next,kind:'text',text:'\n\n'+text,x,y,width:280,height:100,color:media.color,fontSize:this.plugin.settings.defaultTextSize,autoSize:false});b.edges.push({id:uid(),from:id,to:next,label:mediaClock(time),style:this.plugin.settings.defaultEdgeStyle,direction:'forward'});});
    this.selected=new Set([next]);this.selectedEdge=undefined;this.contextOpen=false;this.updateSelection();await this.startInlineEdit(next,false,true);
  }
  private async captureMediaFrame(id:string,blob:Blob,time:number,owner=this.session){
    this.requireOwner(owner);mediaTime(time);const node=owner!.board.nodes.find(n=>n.id===id),path=node?.file,file=path?this.app.vault.getAbstractFileByPath(path):undefined;
    if(node?.kind!=='video'||!path||!(file instanceof TFile)||blob.type!=='image/png'||blob.size>20*1024*1024)throw Error('无法保存此视频截图');
    const stamp=file.stat.mtime,size=file.stat.size;
    const ensure=()=>{this.requireOwner(owner);const current=owner!.board.nodes.find(n=>n.id===id);if(current?.kind!=='video'||current.file!==path||file.path!==path||this.app.vault.getAbstractFileByPath(path)!==file||file.stat.mtime!==stamp||file.stat.size!==size)throw Error('来源视频已变化，请重新截图');return current;};
    await this.plugin.mediaWorkspace.validateResource(file);ensure();
    if(this.inline&&!await this.inline.commit())return;ensure();
    const bytes=await blob.arrayBuffer();ensure();await this.plugin.mediaWorkspace.validateResource(file);ensure();
    const imagePath=await this.app.fileManager.getAvailablePathForAttachment(`视频截图-${Date.now()}.png`,owner!.file.path);ensure();
    const image=await this.app.vault.createBinary(imagePath,bytes);
    try{await this.plugin.mediaWorkspace.validateResource(file);ensure();}catch{new Notice(`截图已保留：${image.path}；白板或来源已变化，未插入卡片`);return;}
    const source=mediaSourceMarkdown({vault:this.app.vault.getName(),board:owner!.file.path,node:id,file:path,time});
    const attachment=this.app.fileManager.generateMarkdownLink(image,owner!.file.path),body=`!${attachment}\n\n${source}\n`;
    const note=await this.plugin.createUnique(owner!.file.parent?.path||'',`${file.basename} ${mediaClock(time).replace(/:/g,'-')}`,'md',body);
    let current:Card;try{await this.plugin.mediaWorkspace.validateResource(file);current=ensure();}catch{new Notice(`截图笔记已保留：${note.path}；白板或来源已变化，未插入卡片`);return;}
    const next=uid();owner!.change(b=>{b.version=3;b.nodes.push(applyDefaultCardStyle({id:next,kind:'card',file:note.path,x:current.x+current.width+56,y:current.y+current.height+24,width:320,height:260,color:current.color,transparent:true,autoFit:true,preferredWidth:320},this.plugin.settings.defaultCardStyle));b.edges.push({id:uid(),from:id,to:next,label:mediaClock(time),style:this.plugin.settings.defaultEdgeStyle,direction:'forward'});});
    this.selected=new Set([next]);this.selectedEdge=undefined;this.updateSelection();new Notice('视频截图已保存为 Markdown 笔记，可点击时间回到视频');
  }
  private renderMediaCard(n:Card,el:HTMLElement,header:HTMLElement,scope:Component){
    const owner=this.session!,path=n.file!,file=this.app.vault.getAbstractFileByPath(path),kind=n.kind==='audio'?'audio':'video';
    el.addClass('ts-av-node');setIcon(header.createSpan(),kind==='audio'?'audio-lines':'clapperboard');
    header.createSpan({cls:'ts-av-title',text:file instanceof TFile?file.basename:n.title||'媒体文件'});
    if(file instanceof TFile)button(header,'侧边栏播放与记录','panel-right',()=>this.plugin.openMediaWorkspace(file,'sidebar',this.mediaPlayers.get(n.id)?.getState().time??n.mediaStart??0),'ts-icon-button');
    const fold=button(header,n.collapsed?'展开媒体':'折叠媒体',n.collapsed?'chevron-down':'chevron-up',()=>{this.requireOwner(owner);const current=owner.board.nodes.find(node=>node.id===n.id);if(current)owner.change(b=>foldCards(b,new Set([n.id]),!current.collapsed));},'ts-icon-button ts-content-fold');
    fold.disabled=owner.blocked||!!n.locked;fold.setAttribute('aria-expanded',String(!n.collapsed));
    if(n.collapsed)return;
    const body=el.createDiv('ts-av-body');if(!(file instanceof TFile)){body.createSpan({cls:'ts-missing',text:'找不到媒体文件，卡片仍保留。'});return;}
    const stamp=file.stat.mtime,size=file.stat.size,alive=()=>!this.closed&&this.session===owner&&el.isConnected&&this.app.vault.getAbstractFileByPath(path)===file&&file.path===path&&file.stat.mtime===stamp&&file.stat.size===size&&owner.board.nodes.some(node=>node.id===n.id&&node.file===path&&node.kind===kind&&!node.collapsed);
    const identity=JSON.stringify([path,stamp,file.stat.size,n.mediaStart||0]);if(this.mediaIdentities.get(n.id)!==identity){this.mediaStates.delete(n.id);this.mediaIdentities.set(n.id,identity);}
    const shared=this.plugin.mediaWorkspace.playback,mediaIdentity=this.plugin.mediaWorkspace.identity(file);
    const handle=mountMediaCard(body,{kind,controls:'board',title:file.basename,src:()=>this.plugin.mediaWorkspace.resolveResource(file),initialTime:n.mediaStart||0,state:shared.get(mediaIdentity)||this.mediaStates.get(n.id),captureEnabled:!owner.blocked,onPlay:()=>{shared.activate(handle);this.plugin.pauseOnlineBoardPlayers();},
      requestTime:(current,submit)=>{const prompt=new Prompt(this.app,'跳转到时间 · 秒数或时:分:秒',current,value=>{if(alive())submit(value);});prompt.open();return()=>prompt.close();},
      onState:state=>{if(!this.closed&&this.session===owner&&file.path===path&&file.stat.mtime===stamp&&file.stat.size===size&&this.app.vault.getAbstractFileByPath(path)===file&&owner.board.nodes.some(node=>node.id===n.id&&node.file===path&&node.kind===kind)){this.mediaStates.set(n.id,state);shared.remember(mediaIdentity,state,handle);}},
      onCapture:time=>this.captureMedia(n.id,time,owner),onOpen:()=>this.plugin.openMediaWorkspace(file,'tab',handle.getState().time),
      onCaptureFrame:(blob,time)=>this.captureMediaFrame(n.id,blob,time,owner),alive});
    const unregister=shared.register(mediaIdentity,handle);this.mediaPlayers.set(n.id,handle);scope.register(()=>{handle.dispose();unregister();if(this.mediaPlayers.get(n.id)===handle)this.mediaPlayers.delete(n.id);});
  }
  private choosePdfPage(id:string,total?:number) {
    const owner=this.requireOwner(),node=owner.board.nodes.find(n=>n.id===id);if(node?.kind!=='pdf')return;
    const path=node.file,file=path?this.app.vault.getAbstractFileByPath(path):undefined,stamp=file instanceof TFile?file.stat.mtime:undefined;
    const cached=path?this.pdfTotals.get(path):undefined;
    const limit=total??(stamp!==undefined&&cached?.stamp===stamp?cached.total:undefined);
    new Prompt(this.app,limit?`PDF 页码 · 共 ${limit} 页`:'PDF 页码',String(node.pdfPage||1),value=>{
      this.requireOwner(owner);const current=owner.board.nodes.find(n=>n.id===id);
      const currentFile=path?this.app.vault.getAbstractFileByPath(path):undefined;
      if(current?.kind!=='pdf'||current.file!==path||currentFile!==file||(file instanceof TFile&&file.stat.mtime!==stamp))throw Error('PDF 卡片或文件已变化，请重新选择页码');
      const page=pdfPage(Number(value));if(limit&&page>limit)throw Error(`最多 ${limit} 页`);
      this.setPdfPage(id,page,owner);
    }).open();
  }
  private setPdfPage(id:string,page:number,owner=this.session) {
    this.requireOwner(owner);pdfPage(page);const current=owner!.board.nodes.find(n=>n.id===id);if(current?.pdfPage===page||current?.pdfPage===undefined&&page===1)return;owner!.change(b=>{const node=b.nodes.find(n=>n.id===id);if(node?.kind!=='pdf')throw Error('PDF 卡片已变化');if(node.locked)throw Error('请先解锁卡片');node.pdfPage=page;});
  }
  private renderPdfCard(n:Card,el:HTMLElement,header:HTMLElement,scope:Component) {
    const owner=this.session!,file=this.app.vault.getAbstractFileByPath(n.file!);el.addClass('ts-media-card');el.setAttribute('aria-label',`${file instanceof TFile?file.basename:n.title||'PDF 文件'} · 第 ${n.pdfPage||1} 页`);
    if(n.collapsed){setIcon(header.createSpan(),'file-text');header.createSpan({text:file instanceof TFile?file.basename:n.title||'PDF 文件',cls:'ts-pdf-title'});}
    const fold=button(header,n.collapsed?'展开 PDF':'折叠 PDF',n.collapsed?'chevron-down':'chevron-up',()=>this.mutate(b=>foldCards(b,new Set([n.id]),!n.collapsed)),'ts-icon-button ts-content-fold');fold.disabled=owner.blocked||!!n.locked;fold.setAttribute('aria-expanded',String(!n.collapsed));
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
    for(const side of ['top','right','bottom','left'] as Side[]){const port=el.createEl('button',{cls:`ts-connect-port ts-port-${side}`,text:'+',attr:{'aria-label':topicPort?`${labels[side]}侧添加子主题或连线`:`${labels[side]}侧连线`,title:topicPort?'点击添加子主题 · 拖到空白处自动排版 · 拖到对象连线':'拖动到目标连线；空白处松手添加文本，按住 alt 松手选择类型','data-side':side}});port.disabled=!!this.session?.blocked;
      port.onpointerdown=e=>{if(e.button!==0||e.ctrlKey)return;e.stopPropagation();e.preventDefault();
        const board=this.session?.board,edge=board?.edges.find(edge=>edge.id===this.selectedEdge),a=edge&&board?.nodes.find(n=>n.id===edge.from),b=edge&&board?.nodes.find(n=>n.id===edge.to);
        if(this.mode!=='connect'&&edge&&a&&b){const sides=connectionSides(sectionDisplayNode(a),sectionDisplayNode(b),edge),end=edge.from===id&&sides.fromSide===side?'from':edge.to===id&&sides.toSide===side?'to':undefined;if(end){this.startLinkDrag(e,end==='from'?edge.to:edge.from,end==='from'?sides.toSide:sides.fromSide,{id:edge.id,end,expected:JSON.stringify(edge)});return;}}
        if(this.mode==='connect'&&this.connectFrom&&this.connectFrom!==id&&!this.linkDrag)this.connectNode(id,side);else this.startLinkDrag(e,id,side);};
      port.onkeydown=e=>{if(e.key!=='ContextMenu'&&!(e.shiftKey&&e.key==='F10'))return;e.preventDefault();e.stopPropagation();act(()=>{const owner=this.requireOwner(),node=owner.board.nodes.find(n=>n.id===id);if(!node)return;const rect=port.getBoundingClientRect();this.chooseLinkedContent(owner,id,side,{x:node.x+node.width+56,y:node.y},{x:rect.right,y:rect.bottom});});};
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
    // Keep only a verified array position; replacement objects and styles stay live.
    const reconnect=this.linkDrag?.edge;if(reconnect&&owner.board.edges[reconnect.index??-1]?.id!==reconnect.id)reconnect.index=owner.board.edges.findIndex(e=>e.id===reconnect.id);
    const edge=reconnect?owner.board.edges[reconnect.index??-1]:undefined,style=edge?.style||owner.board.defaultEdgeStyle||this.plugin.settings.defaultEdgeStyle;
    const geometryKey=[from.id,from.x,from.y,from.width,from.height,other.id,other.x,other.y,other.width,other.height,style,this.connectSide,target?.side,this.linkDrag?.edge?.end].join('|');
    if(!this.linkPreview?.isConnected){this.linkPreview=this.svg.createSvg('path',{cls:'ts-connection-preview',attr:{'vector-effect':'non-scaling-stroke'}});this.connectionGeometryKey='';}
    if(geometryKey!==this.connectionGeometryKey){
      const geometry=this.linkDrag?.edge?.end==='from'?connectionPath(other,from,{style,fromSide:target?.side,toSide:this.connectSide}):connectionPath(from,other,{style,fromSide:this.connectSide,toSide:target?.side});
      if(this.linkPreview.getAttribute('d')!==geometry.path)this.linkPreview.setAttribute('d',geometry.path);this.connectionGeometryKey=geometryKey;
    }
    if(this.linkPreview.classList.contains('has-target')!==!!target)this.linkPreview.classList.toggle('has-target',!!target);if(this.flowHint&&!this.flowHint.hasClass('is-visible'))this.flowHint.addClass('is-visible');
    const blank=this.linkDrag?.topicClick?'空白处松手添加子主题':'空白处松手添加文本 · Alt 松手选择类型';
    const hint=target?`连接至 ${label?.title||label?.file?.split('/').pop()?.replace(/\.md$/,'')||label?.text?.slice(0,24).split('\n')[0]||'对象'} · 松手完成`:this.linkDrag?.edge?'拖到新目标重接 · Esc 取消':this.linkDrag?.moved?`拖到对象连接 · ${blank} · Esc 取消`:'选择目标建立连线 · Esc 取消';if(this.flowHint&&this.flowHint.textContent!==hint)this.flowHint.setText(hint);
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
    if(target){if(drag.edge){const next=clone(owner.board);if(reconnectEdge(next,drag.edge.id,drag.edge.end,target.id,target.side,drag.edge.expected)){owner.change(b=>{b.version=next.version;b.edges=next.edges;});this.selectedEdge=drag.edge.id;this.selected.clear();}}else this.createConnection(from,target.id,side,target.side);this.updateSelection();}
    else if(drag.moved&&!drag.edge&&inside){
      // The source is excluded from targets to prevent self-loops, but returning
      // to its body or port is a cancelled connection, not a blank-canvas drop.
      const source=owner.board.nodes.find(n=>n.id===from);
      if(!source||connectionSourceHit(source,point,owner.board.viewport.zoom))return;
      if(drag.topicClick&&owner.board.mode==='mindmap'){act(()=>this.addTopic(false,from));return;}
      if(e.altKey)this.chooseLinkedContent(owner,from,side,point,{x:e.clientX,y:e.clientY});else act(()=>this.createLinkedContent(owner,from,side,point));
    }
  }
  private async createLinkedContent(owner:Session,from:string,side:Side|undefined,point:{x:number;y:number},text='',file?:TFile){
    if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    if(!owner.board.nodes.some(n=>n.id===from))throw Error('起点已不存在');
    if(file&&this.app.vault.getAbstractFileByPath(file.path)!==file)throw Error('来源文件已改变，请重新选择');
    const node:Card={id:uid(),kind:file?(isPdfFile(file.path)?'pdf':'card'):'text',...(file?{file:file.path,...(isPdfFile(file.path)?{pdfPage:1}:{})}:{text}),x:point.x,y:point.y,width:file?320:280,height:file?260:140,color:'sand',fontSize:this.plugin.settings.defaultTextSize,autoSize:false};
    owner.change(b=>{b.version=3;b.nodes.push(node);b.edges.push({id:uid(),from,to:node.id,label:'',fromSide:side,style:this.plugin.settings.defaultEdgeStyle,direction:this.plugin.settings.defaultEdgeDirection});});
    this.selected=new Set([node.id]);this.updateSelection();if(!file)await this.startInlineEdit(node.id,false,true);
  }
  private linkedContentMenu?:Menu;
  private chooseLinkedContent(owner:Session,from:string,side:Side|undefined,point:{x:number;y:number},screen:{x:number;y:number}){
    this.linkedContentMenu?.hide();const menu=this.linkedContentMenu=new Menu().setUseNativeMenu(false);menu.onHide(()=>{if(this.linkedContentMenu===menu)this.linkedContentMenu=undefined;});let chosen=false;
    const add=(title:string,icon:string,run:()=>unknown)=>menu.addItem(item=>item.setTitle(title).setIcon(icon).onClick(()=>{if(chosen)return;chosen=true;act(()=>{this.requireOwner(owner);return run();});}));
    add('添加文本','type',()=>this.createLinkedContent(owner,from,side,point));
    add('添加表格','table-2',()=>this.createLinkedContent(owner,from,side,point,'| 项目 | 内容 |\n| --- | --- |\n|  |  |'));
    add('关联已有笔记或 PDF…','file-input',()=>{let picked=false;new NotePicker(this.app,file=>{if(picked)return;picked=true;return this.createLinkedContent(owner,from,side,point,'',file);},'选择要连线的 Markdown 笔记或 PDF…',true).open();});
    menu.showAtPosition(screen);
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
  private nodeMeasureKey(n:Card){return JSON.stringify([n.cardStyle,n.fontFamily,n.fontSize,n.borderWidth,n.textAlign,n.topic,n.textMaxWidth,n.textAutoHeight,n.autoSize,n.kind==='text'?n.width:undefined]);}
  private nodeAppearanceKey(n:Card){return JSON.stringify([n.cardStyle,n.fontFamily,n.fontSize,n.textColor,n.textAlign,n.color,n.fillColor,n.transparent,n.customBorder,n.borderStyle,n.borderWidth,n.topic,n.textMaxWidth,n.textAutoHeight,n.autoSize,n.kind==='text'?n.width:undefined]);}
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
    toggle('is-table-card',n.kind==='text'&&!n.webUrl&&!nodeHasBorder(n));
    toggle('has-custom-border',nodeHasBorder(n)&&!!n.customBorder);
    if(n.kind==='card'||n.kind==='text'){
      const size=`${n.fontSize||(n.kind==='card'?14:16)}px`,font=textFontFamily(n.fontFamily);
      if(el.style.getPropertyValue('--ts-card-body-size')!==size)el.style.setProperty('--ts-card-body-size',size);
      if(el.style.getPropertyValue('--ts-card-body-font')!==font)el.style.setProperty('--ts-card-body-font',font);
    }
    const cardStyle=effectiveCardStyle(n);
    if((el.dataset.cardStyle||'')!==(cardStyle||'')){
      if(cardStyle)el.dataset.cardStyle=cardStyle;else delete el.dataset.cardStyle;
      el.querySelector(':scope > .ts-card-paperclip')?.remove();
      if(cardStyle==='paper')setIcon(el.createSpan({cls:'ts-card-paperclip',attr:{'aria-hidden':'true'}}),'paperclip');
    }
    if(cardStyle){
      const heading=cardHeadingColors(n);
      for(const [name,value] of [['--ts-card-heading-color',heading.color],['--ts-card-heading-ink',heading.ink]])if(el.style.getPropertyValue(name)!==value)el.style.setProperty(name,value);
    }else if(el.style.getPropertyValue('--ts-card-heading-color')){
      el.style.removeProperty('--ts-card-heading-color');el.style.removeProperty('--ts-card-heading-ink');
    }
    toggle('is-transparent',(n.kind==='card'||n.kind==='text'||n.kind==='section')&&!!n.transparent);
    const fill=(n.kind==='card'||n.kind==='text'||n.kind==='section')&&n.fillColor&&n.fillColor!=='none'?n.fillColor:undefined;
    toggle('has-card-fill',!!fill);
    if(fill){const color=fill.startsWith('#')?fill:cardFillHex[fill as Card['color']];if(el.style.getPropertyValue('--ts-card-fill')!==color)el.style.setProperty('--ts-card-fill',color);}
    else if(el.style.getPropertyValue('--ts-card-fill'))el.style.removeProperty('--ts-card-fill');
    if(n.kind==='section'){
      const scale=Math.max(.4,Math.min(2,1/(this.session?.board.viewport.zoom||1))),hit=`${12*scale}px`;
      if(el.style.getPropertyValue('--ts-section-edge-hit')!==hit)el.style.setProperty('--ts-section-edge-hit',hit);
      const divider=n.sectionDivider||'none',width=`${Math.max(1,n.borderWidth??1)}px`;
      if(el.dataset.sectionDivider!==divider)el.dataset.sectionDivider=divider;
      if(el.style.getPropertyValue('--ts-section-divider-width')!==width)el.style.setProperty('--ts-section-divider-width',width);
    }
    syncNodeGeometry(n,el,preserveDraftSize);
    if(this.controlStageSize&&this.session){
      const compact=!!(n.collapsed||n.branchFolded||n.sectionFolded),count=Number(el.dataset.controlCount)||(compact?(n.kind==='card'?2:1):n.kind==='card'?5:n.kind==='text'?3:2);
      const focused=el.ownerDocument?.activeElement,editWidth=Number(el.dataset.controlEditWidth)||0;
      const hideEdit=!compact&&editWidth>0&&this.selected?.size===1&&this.selected.has(n.id)&&!(focused?.classList.contains('ts-card-quick-edit')&&el.contains(focused));
      if(el.dataset.quickEditHidden!==String(hideEdit))el.dataset.quickEditHidden=String(hideEdit);
      // Batch docks are hidden until hovered/focused. Only controls that can be
      // used now need neighbour avoidance; pointer/focus handlers place them
      // before use, without adding an all-board scan to each camera frame.
      const active=compact||(this.selected?.size===1&&el.classList.contains('is-selected'))||el.classList.contains('is-control-hover')||el.classList.contains('is-control-focus');
      const nearby=active?foldControlObstacles(n,this.connectionCandidates||[],this.session.board.viewport):[];
      const control=cardControlLayout(n,this.session.board.viewport,this.controlStageSize.width,this.controlStageSize.height,count-(hideEdit?1:0),{width:(Number(el.dataset.controlWidth)||32*count+4)-(hideEdit?editWidth:0),height:36,screenGap:24,topReserve:this.cardToolbarReserve||60,avoid:[...this.cardToolbarObstacles,...nearby]});
      for(const [name,value] of [['scale',String(control.scale)],['top',`${control.top}px`],['right',`${control.right}px`]]){
        const key=`--ts-control-${name}`;if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value);
      }
    }
    if(n.kind==='text'){
      const padding=`${textBlockPadding(n,parseFloat(el.style.height)||n.height)}px`;
      if(el.style.getPropertyValue('--ts-text-block-padding')!==padding)el.style.setProperty('--ts-text-block-padding',padding);
    }
    const editableBorder=nodeHasBorder(n),borderStyle=editableBorder?n.borderStyle||'':'',borderWidth=editableBorder?(n.borderWidth!==undefined?`${n.borderWidth}px`:''):'0px';
    if(el.style.borderStyle!==borderStyle)el.style.borderStyle=borderStyle;
    if(el.style.borderWidth!==borderWidth)el.style.borderWidth=borderWidth;
  }
  private applyInlineSize(id:string,size:{width:number;height:number}){
    const el=this.positions.get(id);if(this.inlineTarget!==id||!el?.isConnected||!Number.isFinite(size.width)||!Number.isFinite(size.height)||size.width<=0||size.height<=0)return;
    const previous=this.inlineGeometry;if(previous?.id===id&&previous.width===size.width&&previous.height===size.height)return;this.inlineGeometry={id,width:size.width,height:size.height};
    el.style.width=`${size.width}px`;el.style.height=`${size.height}px`;
    const text=this.session?.board.nodes.find(n=>n.id===id&&n.kind==='text');
    if(text)el.style.setProperty('--ts-text-block-padding',`${textBlockPadding(text,size.height)}px`);
    const board=this.session?.board;if(board?.nodes.some(n=>n.mindmapRules?.automatic)){this.inlineLayout=inlineDisplayBoard(board,this.inlineGeometry);for(const n of this.inlineLayout.nodes){const element=this.positions.get(n.id);if(element)syncNodeGeometry(sectionDisplayNode(n),element,n.id===id);}}
    if((previous?.id!==id||previous.width!==size.width||previous.height!==size.height)&&this.session?.board.edges.some(e=>e.from===id||e.to===id))this.renderEdges();
  }
  private displayBoard(){return dragDisplayBoard(this.inlineLayout&&this.inlineTarget?{...this.inlineLayout,viewport:this.session!.board.viewport}:this.session!.board,this.gesture?.draft,!!this.gesture?.resize);}
  private renderEdges(branches?:BranchRenderSnapshot,board?:Board) {
    if(!this.session)return;if(!this.edgeLayer||this.edgeLayer.root!==this.svg)this.edgeLayer=new EdgeLayer(this.svg,this.markerId,id=>this.labelEdge(id));
    const display=inlineDisplayBoard(board||this.displayBoard(),this.inlineTarget===this.inlineGeometry?.id?this.inlineGeometry:undefined);
    this.edgeLayer.render(branches?branches.visible(display):visibleBranchBoard(display),this.stage.clientWidth,this.stage.clientHeight,this.selectedEdge,this.relatedFocus,this.batchFormatTarget==='edges'&&this.selected.size>1?new Set(selectionEdges(display,this.selected,this.batchEdgeScope).map(e=>e.id)):undefined);
    const nextPorts=new Map<Element,string>();
    const edge=this.selectedEdge?display.edges.find(e=>e.id===this.selectedEdge):undefined,a=edge&&display.nodes.find(n=>n.id===edge.from),b=edge&&display.nodes.find(n=>n.id===edge.to);
    if(edge&&a&&b){const sides=connectionSides(sectionDisplayNode(a),sectionDisplayNode(b),edge);for(const[id,side,title]of [[a.id,sides.fromSide,'拖动重接起点'],[b.id,sides.toSide,'拖动重接终点']]){const port=this.positions.get(id)?.querySelector(`[data-side="${side}"]`);if(port)nextPorts.set(port,title);}}
    // Only the selected connection's two ports need tracking; never scan every card.
    for(const port of this.endpointPorts.keys())if(!nextPorts.has(port)){port.removeClass('ts-endpoint-port');port.setAttribute('title','拖动到目标连线；空白处松手添加文本，按住 alt 松手选择类型');}
    for(const[port,title]of nextPorts)if(this.endpointPorts.get(port)!==title){port.addClass('ts-endpoint-port');port.setAttribute('title',title);}
    this.endpointPorts=nextPorts;

  }
  private labelEdge(id: string) {
    const owner=this.session,edge=owner?.board.edges.find(e=>e.id===id);if(!owner||!edge)return;
    const previous={label:edge.label,from:edge.from,to:edge.to};
    new Prompt(this.app,'关系说明',edge.label,label=>{
      this.requireOwner(owner);const current=owner.board.edges.find(e=>e.id===id);
      if(!current||current.label!==previous.label||current.from!==previous.from||current.to!==previous.to)throw Error('连线已变化，请重新打开关系说明');
      if(label===current.label)return;owner.change(()=>{current.label=label;});
    }).open();
  }
  async setTextAutoHeight(id:string,enabled?:boolean){
    const owner=this.requireOwner();if(this.inline&&!await this.inline.commit())return;this.requireOwner(owner);
    const node=owner.board.nodes.find(n=>n.id===id);if(!node||node.kind!=='text'||node.locked)return;
    // Clicks may reuse the old control until the next frame or await an editor
    // save. Resolve a toggle from the live node only after that boundary.
    const next=enabled??!textFitsContent(node);
    if(node.textAutoHeight===next)return;this.pendingFits.delete(id);
    const body=this.positions.get(id)?.querySelector<HTMLElement>('.ts-text-body');
    owner.change(b=>{const n=b.nodes.find(n=>n.id===id)!;n.textAutoHeight=next;
      if(next&&this.previewMetricsReady!==false&&!n.collapsed&&body?.dataset.markdownStatus==='ready')fitTextNode(n,this.contentEl,body);
    });
    const current=owner.board.nodes.find(n=>n.id===id);if(next&&current)this.queueTextFit(current);
  }
  fitCards(ids:ReadonlySet<string>,automatic:boolean){this.mutate(b=>{const nodes=b.nodes.filter(n=>ids.has(n.id)&&n.kind==='card'&&!n.locked);this.session?.releaseRelationGeometry?.(new Set(nodes.map(n=>n.id)));nodes.forEach(n=>n.autoFit=automatic);});if(automatic)for(const n of this.session?.board.nodes||[]){const preview=this.positions.get(n.id)?.querySelector<HTMLElement>('.ts-card-preview');if(ids.has(n.id)&&preview)this.queueCardFit(n,preview);}}
  private queueTextFit(node:Card){if(this.automaticGeometryDeferred)return;if(this.previewMetricsReady===false||node.collapsed||node.locked||!textFitsContent(node)||this.inlineTarget===node.id)return;const body=this.positions.get(node.id)?.querySelector<HTMLElement>('.ts-text-body');if(body?.dataset.mathStatus==='pending')return;const draft={...node};fitTextNode(draft,this.contentEl,body||undefined);this.queueNodeFit(node,draft);}
  private queueNodeFit(node:Card,size:{width:number;height:number}){if(this.automaticGeometryDeferred)return;const owner=this.session;if(!owner||owner.blocked||node.collapsed||node.locked||this.inlineId===node.id||this.inlineTarget===node.id)return;
    if(owner.relationGeometryHeld?.(node)){this.pendingFits.delete(node.id);return;}
    if(!Number.isFinite(size.width)||!Number.isFinite(size.height)||size.width<80||size.height<(node.kind==='text'?40:60))return;
    if(Math.abs(size.width-node.width)<1&&Math.abs(size.height-node.height)<1){this.pendingFits.delete(node.id);return;}this.pendingFits.set(node.id,{width:size.width,height:size.height,key:this.nodeKeys.get(node.id)||''});if(!this.gesture)this.nodeFitQueue.schedule();
  }
  private refreshFontMetrics(){if(this.closed||!this.session)return;this.inline?.syncAppearance();for(const node of this.session.board.nodes){const el=this.positions.get(node.id);if(!el||node.locked||node.id===this.inlineTarget)continue;if(textFitsContent(node)){this.queueTextFit(node);}else if(node.kind==='card'){const preview=el.querySelector<HTMLElement>('.ts-card-preview');if(preview)this.queueCardFit(node,preview);}}}
  private queueCardFit(node:Card,preview:HTMLElement){
    if(this.automaticGeometryDeferred)return;
    if(this.previewMetricsReady===false||!node.autoFit||node.locked||node.collapsed||!preview.isConnected||preview.getAttribute('aria-busy')==='true'||this.inlineId===node.id||this.inlineTarget===node.id)return;
    // A background tab remains connected but has no layout. Never turn its zero
    // content width plus borders into a saved size; retry when the stage is shown.
    if(preview.offsetWidth===0){this.deferredCardFits.add(node.id);return;}
    this.deferredCardFits.delete(node.id);this.queueNodeFit(node,measureNoteCard(preview,node.preferredWidth));
  }
  private retryDeferredCardFits(){
    if(!this.deferredCardFits.size||this.closed||!this.session||this.session.blocked||!this.stage.clientWidth||!this.stage.clientHeight)return;
    const pending=new Set(this.deferredCardFits);this.deferredCardFits.clear();
    for(const node of this.session.board.nodes){if(!pending.has(node.id))continue;const preview=this.positions.get(node.id)?.querySelector<HTMLElement>('.ts-card-preview');if(preview)this.queueCardFit(node,preview);}
  }
  private flushNodeFits(){if(this.automaticGeometryDeferred){this.pendingFits.clear();return;}if(this.gesture)return;const owner=this.session,fits=new Map(this.pendingFits);this.pendingFits.clear();if(!owner||owner.blocked||this.gesture||this.closed||!fits.size)return;
    const editing=new Set([this.inlineId,this.inlineTarget].filter((id):id is string=>!!id));for(const node of owner.board.nodes)if(fits.has(node.id)&&owner.relationGeometryHeld?.(node))fits.delete(node.id);
    const changes=nodeFitChanges(owner.board.nodes,fits,this.nodeKeys,editing);if(!changes.size)return;
    owner.change(b=>{for(const n of b.nodes){const size=changes.get(n.id);if(size)Object.assign(n,size);}},clone(owner.board),false,false,true);
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
    add('打开白板','panels-top-left',()=>this.navigate(file));add('在新标签页打开','square-arrow-out-up-right',()=>this.plugin.openBoardInNewTab(file));
    add('重命名白板','pencil',()=>new Prompt(this.app,'重命名白板',file.basename,async title=>{const path=normalizePath(`${file.parent?.path||''}/${safeName(title)}.${file.extension}`);if(path===file.path)return;if(this.app.vault.getAbstractFileByPath(path))throw Error('同名白板已存在');await this.app.fileManager.renameFile(file,path);}).open());
    add(this.plugin.settings.favoriteBoards.includes(file.path)?'取消收藏':'收藏白板','star',()=>this.plugin.toggleFavorite(file));
    add('新建子白板','folder-plus',async()=>{await this.navigate(file);this.newChildBoard();});
    add('复制白板','copy',async()=>{const copy=await this.plugin.duplicateBoard(file);await this.plugin.openBoard(copy);});
    add('复制白板链接','link',()=>navigator.clipboard.writeText(boardLink(this.app.vault.getName(),file.path)));
    add('在文件列表中显示','folder-search',async()=>{const explorer=this.app.workspace.getLeavesOfType('file-explorer')[0];if(explorer){await this.app.workspace.revealLeaf(explorer);fileExplorer(explorer.view)?.revealInFolder(file);}});
    menu.addSeparator();add('保存布局快照','history',async()=>{await this.plugin.saveLayoutSnapshot(file);new Notice('布局快照已保存');});add('恢复布局快照…','rotate-ccw',()=>this.plugin.showSnapshots(file));
    add('导出 Markdown 大纲','file-down',()=>this.plugin.exportOutline(file));add('导出原生链接索引','network',()=>this.plugin.exportNativeIndex(file));
    if(this.file!==file)add('引用到当前白板','plus',()=>this.addBoard(file));menu.showAtMouseEvent(event);
  }
  private buildSingleEdgeTools(host:HTMLElement,owner:Session,edge:Board['edges'][number]){
    const current=()=>!this.closed&&this.session===owner&&!owner.blocked&&this.selectedEdge===edge.id&&owner.board.edges.some(e=>e.id===edge.id);
    const editable=()=>current()&&selectionEdges(owner.board,new Set([edge.from,edge.to]),'internal').some(e=>e.id===edge.id);
    const canEdit=editable(),isCurrent=current();
    renderEdgeFormatControls(host,[edge],!canEdit,patch=>act(()=>{
      if(!editable())return;
      owner.change(b=>patchSelectionEdges(b,new Set([edge.id]),patch));
    }));
    const actions=host.createDiv({cls:'ts-edge-format-actions',attr:{role:'group','aria-label':'连线操作'}});
    const action=(label:string,icon:string,run:()=>unknown,editing=false)=>{
      const control=button(actions,label,icon,()=>{if(control.isConnected&&current()&&(!editing||editable()))return run();},'ts-icon-button');
      control.disabled=!isCurrent||(editing&&!canEdit);return control;
    };
    action('关系说明','text-cursor-input',()=>this.labelEdge(edge.id),true);
    action('跳转起点','arrow-left',()=>this.revealNode(edge.from));action('跳转终点','arrow-right',()=>this.revealNode(edge.to));
    const all=action('当前路径应用到全部连线','git-commit-horizontal',()=>this.unifyEdgeStyle(owner.board.edges.find(e=>e.id===edge.id)?.style||'curve'),true);
    all.addClass('ts-edge-apply-all');all.title='将当前路径应用到整张白板的连线 · 可撤销';
  }
  private buildBatchEdgeTools(host:HTMLElement,owner:Session,nodeIds:ReadonlySet<string>,edges:Board['edges']){
    const scope=host.createEl('label',{cls:'ts-format-field ts-edge-scope',attr:{'data-format':'范围'}});scope.createSpan({text:'范围'});
    const scopeInput=scope.createEl('select',{attr:{'aria-label':'批量连线范围',title:'自动跳过锁定或隐藏节点的连线'}});
    scopeInput.createEl('option',{value:'internal',text:'选中对象之间'});scopeInput.createEl('option',{value:'connected',text:'所有相连'});scopeInput.value=this.batchEdgeScope;
    scopeInput.onchange=()=>{if(!scopeInput.isConnected||this.session!==owner||this.batchFormatTarget!=='edges'||this.selected.size!==nodeIds.size||[...nodeIds].some(id=>!this.selected.has(id))||!['internal','connected'].includes(scopeInput.value))return;this.batchEdgeScope=scopeInput.value as SelectionEdgeScope;this.renderSelectionTools();this.renderEdges();};
    const edgeIds=new Set(edges.map(e=>e.id)),scopeAtBuild=this.batchEdgeScope;
    if(!edges.length){host.createSpan({cls:'ts-batch-format-empty',text:'此范围没有可修改的连线'});return;}
    renderEdgeFormatControls(host,edges,owner.blocked,patch=>act(()=>{
      this.requireOwner(owner);
      if(this.batchFormatTarget!=='edges'||this.batchEdgeScope!==scopeAtBuild||this.selected.size!==nodeIds.size||[...nodeIds].some(id=>!this.selected.has(id)))return;
      const current=new Set(selectionEdges(owner.board,nodeIds,scopeAtBuild).map(e=>e.id));
      const eligible=new Set([...edgeIds].filter(id=>current.has(id)));if(!eligible.size)return;
      owner.change(b=>patchSelectionEdges(b,eligible,patch));
    }));
  }
  refreshStyleControls(){this.renderSelectionTools();}
  brainRelationCommandTarget(checking=false):BrainRelationCommandTarget|undefined{
    const owner=this.session,view=this.brainBoardView,doc=this.contentEl.ownerDocument;
    if(!owner||!view||!isBrainBoard(owner.board))return;
    const target=view.relationCommandTarget(checking);if(!target)return;
    const current=()=>this.session===owner&&this.brainBoardView===view&&!owner.blocked&&!this.closed&&!this.closing&&this.leaf.view===this&&this.contentEl.ownerDocument===doc&&this.app.workspace.getActiveViewOfType(BoardView)===this&&!this.inline&&!this.inlineTarget&&!this.gesture&&!this.marquee&&!this.rightMarquee&&!this.linkDrag&&!this.brainBoardDialog?.containerEl.isConnected&&!this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&(leaf.view.brainRelationCreating||leaf.view.localRelationEditBusy||leaf.view.localRelationEditing));
    return{editing:target.editing,canRun:side=>current()&&target.canRun(side),run:side=>{if(current()&&target.canRun(side))target.run(side);}};
  }
  inputCommandTarget():BoardInputCommandTarget|undefined{
    const owner=this.session;if(!owner||owner.blocked||this.closed||this.gesture||this.marquee||this.rightMarquee||this.linkDrag)return;
    const active=this.contentEl.ownerDocument.activeElement;
    const editing=!!this.inline||!!this.inlineTarget||!!active&&this.contentEl.contains(active)&&!!active.closest('input,textarea,select,[contenteditable=true]');
    const canRun=(action:BoardInputAction)=>{
      if(this.session!==owner||owner.blocked||this.closed)return false;
      if(isBrainBoard(owner.board))return ['newCard','insertNote','newSection','find','fit','reset','undo','redo'].includes(action);
      // Global commands do not depend on selected content. Eligibility is still
      // resolved against the current owner on every invocation.
      switch(action){case 'edit':case 'focus':case 'duplicate':case 'remove':case 'childTopic':case 'siblingTopic':case 'parentTopic':case 'fold':case 'expand':break;default:return true;}
      const nodes=this.selected.size?owner.board.nodes.filter(n=>this.selected.has(n.id)):[];
      if(action==='edit')return nodes.length===1&&!nodes[0].locked&&['card','text'].includes(nodes[0].kind);
      if(action==='focus'||action==='duplicate')return nodes.length>0;
      if(action==='remove')return !!this.selectedEdge||nodes.some(n=>!n.locked);
      if(action==='childTopic'||action==='siblingTopic')return owner.board.mode==='mindmap'&&nodes.length===1&&!nodes[0].locked&&nodes[0].kind!=='section';
      if(action==='parentTopic')return owner.board.mode==='mindmap'&&nodes.length===1&&!!mindmapParent(owner.board,nodes[0].id);
      if(action==='fold'||action==='expand'){
        let children:ReturnType<typeof branchTopology>['children']|undefined;
        return nodes.some(n=>!n.locked&&(n.kind==='section'||['card','board','mindmap','pdf','text','audio','video'].includes(n.kind)||(children??=branchTopology(owner.board).children).has(n.id)));
      }
      return true;
    };
    return {editing,canRun,run:action=>act(()=>{
      if(!canRun(action)||this.inline||this.inlineTarget)return;
      if(isBrainBoard(owner.board)){
        if(action==='newCard')return this.addBrainObject('new-note');if(action==='insertNote')return this.addBrainObject('note');if(action==='newSection')return this.addBrainObject('section');
        if(action==='find')return this.brainBoardView?.focusSearch();if(action==='fit')return this.brainBoardView?.fitToCanvas();if(action==='reset')return this.brainBoardView?.resetZoom();
        if((action==='undo'||action==='redo')&&!owner.convertingTexts.size&&!this.app.workspace.getLeavesOfType(VIEW).some(leaf=>leaf.view instanceof BoardView&&leaf.view.session===owner&&leaf.view.localRelationEditBusy))owner.undo(action==='redo');return;
      }
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
    this.clearCanvasGesture();owner.change(b=>{b.nodes=draft.nodes;b.version=draft.version;},undefined,false,true,false,owner.board.nodes.filter(n=>unlocked.has(n.id)).every(n=>n.kind==='mindmap'));
    this.selected=new Set([...this.selected,...(!folded?unlocked:[])].filter(id=>!hidden.has(id)));
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
    owner.change(b=>{applyNodeStyle(b,editable,style);for(const n of b.nodes)if(editable.has(n.id)&&textFitsContent(n))fitTextNode(n,this.contentEl);});
  }
  private renderSelectionTools(){
    this.plugin.refreshLocalRelations?.(this);
    const host=this.selectionTools,owner=this.session;if(!host)return;
    const batch=owner&&!this.selectedEdge&&this.selected.size>1?{target:this.batchFormatTarget,scope:this.batchEdgeScope,edges:selectionEdges(owner.board,this.selected,this.batchEdgeScope)}:undefined;
    const editor=this.inline,key=selectionFormatKey(owner?.board,this.selected,this.selectedEdge,owner?.blocked,batch)+'|'+JSON.stringify([this.inlineId,!!this.inlineAppearance,!!this.appearanceExpanded,this.appearanceTab,!!this.plugin?.copiedNodeStyle]);
    const cached=this.selectionFormatCache;
    if(cached?.host===host&&cached.owner===owner&&cached.editor===editor&&cached.key===key)return;
    this.selectionFormatCache=undefined;
    this.buildSelectionTools(batch?.edges);
    this.selectionFormatCache={host,owner,editor,key};
  }
  private buildSelectionTools(batchEdges?:Board['edges']){
    const host=this.selectionTools,owner=this.session;if(!host)return;const heading=this.selectionHeading||host,editorBefore=this.inline,restoreFocus=preserveToolbarFocus(host),restoreHeadingFocus=preserveToolbarFocus(heading);
    try{this.inline?.replaceToolbar();host.empty();host.toggleClass('is-appearance-collapsed',false);if(heading!==host)heading.empty();
    if(owner&&this.selectedEdge){const edge=owner.board.edges.find(e=>e.id===this.selectedEdge);if(edge){host.addClass('is-visible');this.buildSingleEdgeTools(host,owner,edge);return;}}
    const nodes=owner?.board.nodes.filter(n=>this.selected.has(n.id)) || [];host.toggleClass('is-visible',nodes.length>0);if(!owner||!nodes.length)return;
    const ids=new Set(nodes.map(n=>n.id)),texts=nodes.filter(n=>(n.kind==='text'||n.kind==='card')&&!n.webUrl),borderNodes=nodes.filter(nodeHasBorder);
    if(nodes.length>1){
      // Reuse only this synchronous render's scan; edit callbacks revalidate live edges.
      const edges=batchEdges??selectionEdges(owner.board,ids,this.batchEdgeScope);
      const switcher=heading.createDiv({cls:'ts-batch-format-switch',attr:{role:'group','aria-label':'批量修改对象或连线'}});
      for(const [target,label,icon]of [['nodes',`对象 ${nodes.length}`,'layers'],['edges',`连线 ${edges.length}`,'git-commit-horizontal']] as const){
        const tab=button(switcher,label,icon,()=>{this.batchFormatTarget=target;this.renderSelectionTools();this.renderEdges();});
        tab.toggleClass('is-active',this.batchFormatTarget===target);tab.setAttribute('aria-pressed',String(this.batchFormatTarget===target));
      }
      if(this.batchFormatTarget==='edges'){
        this.buildBatchEdgeTools(host,owner,ids,edges);return;
      }
    }

    if(!nodes.some(n=>!n.webUrl&&(n.kind==='card'||n.kind==='text'||n.kind==='section'))){host.toggleClass('is-visible',nodes.length>1);return;}
    const context=heading.createDiv({cls:'ts-format-context',attr:{'aria-label':`已选 ${nodes.length} 个对象`}});
    const kind=nodes.length===1?(nodes[0].kind==='text'&&!nodeHasBorder(nodes[0])?'table':nodes[0].kind):'mixed';context.dataset.kind=kind;
    setIcon(context.createSpan({attr:{'aria-hidden':'true'}}),({table:'table-2',card:'sticky-note',text:'type',section:'group',image:'image',pdf:'file-text',audio:'audio-lines',video:'clapperboard',board:'panels-top-left',mindmap:'network',mixed:'layers'})[kind]);
    context.createSpan({cls:'ts-format-context-label',text:({table:'表格',card:'卡片',text:'文本',section:'分组',image:'图片',pdf:'PDF',audio:'音频',video:'视频',board:'子白板',mindmap:'脑图',mixed:'对象'})[kind]});
    if(nodes.length>1)context.remove();
    const categories=heading.createDiv({cls:'ts-format-mode',attr:{role:'group','aria-label':'编辑工具'}});
    const node=nodes.length===1?nodes[0]:undefined,editor=node&&this.inlineId===node.id?this.inline:undefined;
    const styledCards=nodes.filter(supportsCardStyle);
    const allowed:('card'|'text'|'fill'|'border')[]=[];
    if(styledCards.length)allowed.push('card');
    if(node&&supportsCardStyle(node))context.remove();
    if(texts.length)allowed.push('text');if(nodes.some(n=>!n.webUrl&&['card','text','section'].includes(n.kind)))allowed.push('fill');if(borderNodes.length)allowed.push('border');
    const active=allowed.includes(this.appearanceTab)?this.appearanceTab:allowed[0];
    const current=()=>!this.closed&&this.session===owner&&categories.isConnected&&this.selected.size===ids.size&&[...ids].every(id=>this.selected.has(id));
    const expanded=!!this.appearanceExpanded||!!editor;
    host.toggleClass('is-appearance-collapsed',!expanded);
    const selectedMode=editor&&!this.inlineAppearance?'markdown':expanded?active:undefined;
    const modes:('markdown'|'card'|'text'|'fill'|'border')[]=node&&(node.kind==='card'||node.kind==='text')?['markdown',...allowed]:allowed;
    // Mode navigation is separate from formatting. Inspecting a locked object's
    // appearance stays possible; every actual edit still validates the live owner.
    const chooseMode=(value:typeof modes[number])=>{
      if(!current()||this.inline?.snapshot().busy)return;
      if(value===selectedMode){if(value!=='markdown'&&!editor){this.appearanceExpanded=false;this.renderSelectionTools();}return;}
      if(value==='markdown'){
        if(!node||!['card','text'].includes(node.kind)||owner.blocked||owner.board.nodes.find(n=>n.id===node.id)?.locked)return;
        if(editor){if(this.inline!==editor)return;this.inlineAppearance=false;this.renderSelectionTools();editor.input.focus({preventScroll:true});}
        else return this.startInlineEdit(node.id);
      }else if(allowed.includes(value)){
        this.appearanceExpanded=true;this.appearanceTab=value;this.inlineAppearance=!!editor;this.renderSelectionTools();
      }
    };
    const modeButtons=modes.map(value=>{
      const label={markdown:'编辑 Markdown',card:'卡片样式',text:'文字样式',fill:'背景样式',border:'边框样式'}[value];
      const control=categories.createEl('button',{cls:'ts-button ts-format-mode-button',attr:{type:'button','aria-label':label,title:label,'data-mode':value,'aria-pressed':String(value===selectedMode)}});
      setIcon(control.createSpan({attr:{'aria-hidden':'true'}}),{markdown:'square-pen',card:'panels-top-left',text:'type',fill:'paint-bucket',border:'square-dashed'}[value]);
      control.createSpan({cls:'ts-format-mode-label',text:{markdown:'编辑',card:'卡片',text:'文字',fill:'背景',border:'边框'}[value]});
      if(value!=='markdown'){control.setAttribute('aria-expanded',String(value===selectedMode));if(host.id)control.setAttribute('aria-controls',host.id);}
      control.toggleClass('is-active',value===selectedMode);control.disabled=value==='markdown'&&(owner.blocked||!!node?.locked);
      control.onmousedown=e=>e.preventDefault();
      control.onclick=()=>act(()=>{if(!control.disabled)return chooseMode(value);});return control;
    });
    const syncModes=()=>{
      const busy=!!editor?.snapshot().busy;
      for(const control of modeButtons)control.disabled=busy||(control.getAttribute('data-mode')==='markdown'&&(owner.blocked||!!owner.board.nodes.find(n=>n.id===node?.id)?.locked));
    };
    if(editor){editor.input.addEventListener('select',syncModes);syncModes();}
    if(editor&&!this.inlineAppearance){markdownToolbar(host,editor,()=>editor.input.removeEventListener('select',syncModes));return;}
    const transfer=heading.createDiv({cls:'ts-style-transfer',attr:{role:'group','aria-label':'复制与粘贴外观'}});
    const copy=button(transfer,'复制对象样式','pipette',()=>this.copyObjectStyle(ids,owner),'ts-icon-button');
    const paste=button(transfer,'粘贴对象样式','paintbrush',()=>this.pasteObjectStyle(ids,owner),'ts-icon-button');
    copy.disabled=owner.blocked||nodes.length!==1;paste.disabled=owner.blocked||!this.plugin.copiedNodeStyle||nodes.every(n=>n.locked);
    for(const control of [copy,paste])control.onmousedown=e=>e.preventDefault();
    let fieldHost=host;
    const fieldGroup=(label:string)=>{
      const panel=label==='卡片版式'?'card':label==='文字外观'?'text':label==='边框外观'?'border':'fill';
      fieldHost=host.createDiv({cls:'ts-appearance-group',attr:{role:'group','aria-label':label,'data-appearance-panel':panel}});fieldHost.hidden=active!==panel;
    };
    const select=(label:string,options:Record<string,string>,values:string[],apply:(b:Board,value:string)=>void)=>{
      const wrap=fieldHost.createEl('label',{cls:'ts-format-field',attr:{'data-format':label}});
      const icon=({'分组样式':'layers','分组背景':'paint-bucket','标题分割线':'separator-horizontal','卡片样式':'layers','卡片颜色':'paint-bucket','字体':'type','字号':'a-large-small','文字颜色':'baseline','文字对齐':'align-left','边框线型':'square-dashed','边框粗细':'equal','边框颜色':'pencil-line'} as Record<string,string>)[label];
      if(icon)setIcon(wrap.createSpan({cls:'ts-format-label-icon',attr:{'aria-hidden':'true'}}),icon);
      wrap.createSpan({cls:'ts-format-label',text:({'分组样式':'分组','分组背景':'底色','标题分割线':'分割线','卡片样式':'卡片','卡片颜色':'底色','文字颜色':'字色','文字对齐':'对齐','边框线型':'边框','边框粗细':'线宽','边框颜色':'线色'} as Record<string,string>)[label]||label});
      const input=wrap.createEl('select',{attr:{'aria-label':label,title:label}});const same=values.every(v=>v===values[0]);
      if(!same)input.createEl('option',{value:'',text:'混合'}).disabled=true;
      for(const [value,text] of Object.entries(options))input.createEl('option',{value,text});input.value=same?values[0]:'';input.disabled=owner.blocked||nodes.some(n=>n.locked);
      input.onchange=()=>act(()=>{if(!input.isConnected||input.disabled||this.inline?.snapshot().busy)return;this.requireOwner(owner);const value=input.value;if(!Object.hasOwn(options,value)||this.selected.size!==ids.size||[...ids].some(id=>!this.selected.has(id))||owner.board.nodes.some(n=>ids.has(n.id)&&n.locked))return;owner.change(b=>{b.version=3;apply(b,value);});});
    };
    if(styledCards.length){
      fieldGroup('卡片版式');
      const picker=fieldHost.createDiv({cls:'ts-card-style-picker',attr:{role:'group','aria-label':'卡片样式'}});
      const previewTone=cardHeadingColors(styledCards[0]).color;
      if(styledCards.every(n=>cardHeadingColors(n).color===previewTone))picker.style.setProperty('--ts-card-heading-color',previewTone);
      for(const [value,sharedLabel] of Object.entries(cardStyleChoices)){
        const label=value==='band'&&styledCards.every(n=>n.kind==='text')?'彩色顶栏':sharedLabel;
        const chosen=styledCards.every(n=>cardStyleChoice(n)===value);
        const option=picker.createEl('button',{cls:'ts-card-style-option',attr:{type:'button','data-style':value,'aria-pressed':String(chosen),'aria-label':label,title:label}});
        const swatch=option.createSpan({cls:'ts-card-style-swatch',attr:{'aria-hidden':'true'}});swatch.createEl('i');swatch.createEl('i');
        option.createSpan({cls:'ts-card-style-name',text:label});option.disabled=owner.blocked||styledCards.some(n=>n.locked);
        option.onmousedown=e=>e.preventDefault();
        option.onclick=()=>act(()=>{
          if(option.disabled||!option.isConnected||!current()||this.inline?.snapshot().busy)return;
          this.requireOwner(owner);if(owner.board.nodes.some(n=>ids.has(n.id)&&supportsCardStyle(n)&&n.locked))return;
          owner.change(b=>{b.version=3;for(const n of b.nodes)if(ids.has(n.id))applyCardStyle(n,value as CardStyleChoice);});
        });
      }
    }
    const cards=nodes.filter(n=>(n.kind==='card'||n.kind==='text')&&!n.webUrl);
    if(cards.length){fieldGroup('卡片外观');const values=cards.map(n=>n.fillColor||'none'),custom=values.find(c=>c.startsWith('#'));
      if(cards.some(n=>!supportsCardStyle(n)))select('卡片样式',{solid:'默认',transparent:'透明'},cards.map(n=>n.transparent?'transparent':'solid'),(b,value)=>b.nodes.filter(n=>ids.has(n.id)&&(n.kind==='card'||n.kind==='text')&&!n.locked).forEach(n=>{if(supportsCardStyle(n))applyCardStyle(n,value as CardStyleChoice);else if(value==='transparent')n.transparent=true;else delete n.transparent;}));
      select('卡片颜色',{none:'默认底色',...colorNames,...Object.fromEntries(values.filter(value=>value.startsWith('#')).map(value=>[value,'自定义 '+value]))},values,(b,value)=>b.nodes.filter(n=>ids.has(n.id)&&(n.kind==='card'||n.kind==='text')&&!n.locked).forEach(n=>{delete n.transparent;n.fillColor=value as Card['fillColor'];}));
      const wrap=fieldHost.createEl('label',{cls:'ts-format-field ts-fill-custom',attr:{title:'自定义卡片颜色'}});wrap.createSpan({text:'自定'});const color=wrap.createEl('input',{type:'color',attr:{'aria-label':'自定义卡片颜色',title:'选择任意卡片背景色'}});color.value=custom||cardFillHex[(values[0]==='none'?'sand':values[0]) as Card['color']]||'#e8d8a8';color.disabled=owner.blocked||nodes.some(n=>n.locked);color.onchange=()=>act(()=>{if(!color.isConnected||color.disabled||this.inline?.snapshot().busy)return;this.requireOwner(owner);const value=color.value;if(!validCardFill(value)||!value.startsWith('#')||!current()||owner.board.nodes.some(n=>ids.has(n.id)&&n.locked))return;owner.change(b=>{b.version=3;for(const n of b.nodes)if(ids.has(n.id)&&(n.kind==='card'||n.kind==='text')&&!n.locked){delete n.transparent;n.fillColor=value;}});});
    }
    const sections=nodes.filter(n=>n.kind==='section');
    if(sections.length){
      fieldGroup('分组外观');const values=sections.map(n=>n.fillColor||'none'),custom=values.find(value=>value.startsWith('#'));
      const patchSections=(b:Board,apply:(n:Card)=>void)=>b.nodes.filter(n=>ids.has(n.id)&&n.kind==='section'&&!n.locked).forEach(apply);
      select('分组样式',{solid:'默认',transparent:'透明'},sections.map(n=>n.transparent?'transparent':'solid'),(b,value)=>patchSections(b,n=>{if(value==='transparent')n.transparent=true;else delete n.transparent;}));
      select('分组背景',{none:'默认底色',...colorNames,...Object.fromEntries(values.filter(value=>value.startsWith('#')).map(value=>[value,'自定义 '+value]))},values,(b,value)=>patchSections(b,n=>{delete n.transparent;n.fillColor=value as Card['fillColor'];}));
      const wrap=fieldHost.createEl('label',{cls:'ts-format-field ts-fill-custom',attr:{title:'自定义分组背景'}});wrap.createSpan({text:'自定'});
      const color=wrap.createEl('input',{type:'color',attr:{'aria-label':'自定义分组背景',title:'选择任意分组背景色'}});color.value=custom||cardFillHex[(values[0]==='none'?'blue':values[0]) as Card['color']]||'#bbd5e7';color.disabled=owner.blocked||nodes.some(n=>n.locked);
      color.onchange=()=>act(()=>{if(!color.isConnected||color.disabled||this.inline?.snapshot().busy)return;this.requireOwner(owner);const value=color.value;
        if(!validCardFill(value)||!value.startsWith('#')||this.selected.size!==ids.size||[...ids].some(id=>!this.selected.has(id))||owner.board.nodes.some(n=>ids.has(n.id)&&n.locked))return;
        owner.change(b=>{b.version=3;patchSections(b,n=>{delete n.transparent;n.fillColor=value;});});
      });
      select('标题分割线',{none:'无分割线',solid:'实线分割',dashed:'虚线分割',dotted:'点线分割'},sections.map(n=>n.sectionDivider||'none'),(b,value)=>patchSections(b,n=>{if(value==='none')delete n.sectionDivider;else n.sectionDivider=value as Card['sectionDivider'];}));
    }
    const patchText=(patch:Partial<Card>)=>(b:Board)=>b.nodes.filter(n=>ids.has(n.id)&&(n.kind==='text'||n.kind==='card')&&!n.webUrl).forEach(n=>{Object.assign(n,patch);if(textFitsContent(n))fitTextNode(n,this.contentEl);});
    if(texts.length){
      fieldGroup('文字外观');select('字体',{default:'正文字体',serif:'衬线字体',mono:'等宽字体'},texts.map(n=>n.fontFamily||'default'),(b,value)=>patchText({fontFamily:value as Card['fontFamily']})(b));
      select('字号',Object.fromEntries([...new Set([12,14,16,18,20,24,32,48,...texts.map(n=>n.fontSize||(n.kind==='card'?14:16))])].sort((a,b)=>a-b).map(size=>[String(size),`${size} px`])),texts.map(n=>String(n.fontSize||(n.kind==='card'?14:16))),(b,value)=>patchText({fontSize:Number(value)})(b));
      select('文字颜色',inkLabels,texts.map(n=>n.textColor||'default'),(b,value)=>patchText({textColor:value as Card['textColor']})(b));
      select('文字对齐',{left:'左对齐',center:'居中',right:'右对齐'},texts.map(n=>n.textAlign||'left'),(b,value)=>patchText({textAlign:value as Card['textAlign']})(b));
    }
    if(borderNodes.length){fieldGroup('边框外观');if(borderNodes.length<nodes.length)fieldHost.createSpan({cls:'ts-format-label',text:'仅有外框的对象'});select('边框线型',{solid:'实线',dashed:'虚线',dotted:'点线'},borderNodes.map(n=>n.borderStyle||'solid'),(b,value)=>b.nodes.filter(n=>ids.has(n.id)&&nodeHasBorder(n)&&!n.locked).forEach(n=>n.borderStyle=value as Card['borderStyle']));
    select('边框粗细',{'0':'无边框','1':'细 · 1','2':'标准 · 2','3':'粗 · 3','4':'加粗 · 4'},borderNodes.map(n=>String(n.borderWidth??1)),(b,value)=>b.nodes.filter(n=>ids.has(n.id)&&nodeHasBorder(n)&&!n.locked).forEach(n=>{n.borderWidth=Number(value);if(textFitsContent(n))fitTextNode(n,this.contentEl);}));
    select('边框颜色',{default:'默认样式',...colorNames},borderNodes.map(n=>n.customBorder?n.color:'default'),(b,value)=>{if(value!=='default'&&!['sand','blue','green','rose','purple'].includes(value))b.version=3;b.nodes.filter(n=>ids.has(n.id)&&nodeHasBorder(n)&&!n.locked).forEach(n=>{if(value==='default')delete n.customBorder;else{n.color=value as Card['color'];n.customBorder=true;}});});
    }
    heading.append(transfer);
    if(this.inline){
      const editor=this.inline,controls=Array.from(host.querySelectorAll<HTMLInputElement|HTMLSelectElement>('select,input')),styleOptions=Array.from(host.querySelectorAll<HTMLButtonElement>('.ts-card-style-option'));
      const sync=()=>{const state=editor.snapshot(),disabled=!!state.busy||owner.blocked||owner.board.nodes.some(n=>ids.has(n.id)&&n.locked);for(const control of controls){if(control.disabled!==disabled)control.disabled=disabled;const title=state.busy?state.disabledReason||'编辑器忙碌中':control.ariaLabel||'';if(control.title!==title)control.title=title;}const styleDisabled=!!state.busy||owner.blocked||owner.board.nodes.some(n=>ids.has(n.id)&&supportsCardStyle(n)&&n.locked);for(const option of styleOptions)option.disabled=styleDisabled;};
      editor.input.addEventListener('select',sync);editor.replaceToolbar(()=>{editor.input.removeEventListener('select',sync);editor.input.removeEventListener('select',syncModes);});sync();
    }
    }finally{if(this.inline===editorBefore){restoreHeadingFocus();restoreFocus();}}
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
        if(n.kind==='text'&&n.text)n.text=rebaseReuseSources(n.text,link=>{const parts=resolveSourceLink(link,path=>this.app.metadataCache.getFirstLinkpathDest(path,owner!.file.path)),ref=parts.file;if(!(ref instanceof TFile))throw Error('摘录来源无法解析，请先修复来源链接');return this.app.fileManager.generateMarkdownLink(ref,targetPath,parts.subpath);});}
      let targetFile:TFile,session:Session|undefined,committed=false;let plan:ReturnType<typeof reusePlan>;
      try{
        if(destination){const file=this.app.vault.getAbstractFileByPath(destination.path);if(!(file instanceof TFile)||!isBoardFile(this.app,file))throw Error('目标白板已移动或删除，请重新选择');targetFile=file;
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
    const nodes = copies.map(n => ({ ...clone(n), id: replacements.get(n.id)!, x: n.x + 36, y: n.y + 36,...(n.kind==='mindmap'&&n.mindmap?{mindmap:remapBoardMindmapState(n.mindmap,replacements)}:{}) }));
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
      add('在此添加脑图','network',()=>this.addMindmap(position));
      add('在此新建卡片','plus',()=>this.newCard(position));
      add('在此插入笔记或 PDF…','file-input',()=>this.insertExistingNote(position));
      add('在此添加文本','type',()=>this.newText(position));add('在此添加表格','table-2',()=>this.newTable(position));
      add('在此添加网页','globe',()=>this.newWebCard(position));
      add('在此添加图片','image-plus',()=>this.imageMenu(position));
      add('在此插入音频或视频…','clapperboard',()=>this.insertMediaCard(position));
      add('在此新建分组框','square-plus',()=>this.newSection(position));
      menu.addSeparator();
      add('全选','scan',()=>{this.selected=new Set(owner.board.nodes.map(n=>n.id));this.updateSelection();},false);
      add('整理整个白板…','layout-grid',()=>this.openLayoutPlanner());
      add('适应全部内容','maximize',()=>this.fit(),false);return;
    }
    if(ids.size===1){
      if(supportsLocalRelations(node))add('在白板添加脑图','network',()=>this.addMindmap({x:node.x+node.width+60,y:node.y},node.id));
      if(node.kind==='mindmap'){add(node.collapsed?'展开脑图':'折叠脑图',node.collapsed?'chevron-down':'chevron-up',()=>this.foldBoardMindmap(node.id),true,!!node.locked);add('重命名脑图','pencil',()=>new Prompt(this.app,'脑图名称',node.title||'脑图',title=>{this.requireOwner(owner);owner.change(b=>{const current=b.nodes.find(n=>n.id===node.id&&n.kind==='mindmap');if(current&&!current.locked)current.title=title.trim().slice(0,160)||'脑图';},undefined,false,true,false,true);}).open(),true,!!node.locked);}
      const file=node.file?this.app.vault.getAbstractFileByPath(node.file):null;
      const locked=!!node.locked;
      if(node.kind==='card'){
        add('修改卡片标题','pencil-line',()=>{
          if(node.collapsed||node.branchFolded){this.mutate(b=>{foldCards(b,new Set([node.id]),false);const current=b.nodes.find(n=>n.id===node.id);if(current)delete current.branchFolded;});this.renderBoard();}
          this.positions.get(node.id)?.querySelector<HTMLElement>('.ts-card-note-title')?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
        },true,locked);
        add('编辑卡片','pencil',()=>this.startInlineEdit(node.id),true,locked||!(file instanceof TFile));
        add('编辑标签','tags',()=>{if(file instanceof TFile)this.plugin.editNativeTags(file);},true,locked||!(file instanceof TFile));
        add('右侧打开笔记','panel-right',()=>file instanceof TFile&&this.plugin.openNoteInSidebar(file),false,!(file instanceof TFile));
        add('自动适应笔记大小','scan-text',()=>this.fitCards(ids,true),true,locked);
      }else if(node.webUrl){
        add('打开原网页','external-link',()=>this.openWebCard(node.id),false);add('复制网页链接','copy',()=>this.copyWebCard(node.id),false);add('修改网页链接','link',()=>this.editWebCard(node.id),true,locked);
        add(node.collapsed?'展开网页':'折叠网页',node.collapsed?'chevron-down':'chevron-up',()=>this.foldSelection(!node.collapsed),true,locked);
      }else if(node.kind==='text'){
        add('编辑文本','pencil',()=>this.editText(node.id),true,locked);
        add(node.collapsed?'展开文本':'折叠文本',node.collapsed?'chevron-down':'chevron-up',()=>this.foldSelection(!node.collapsed),true,locked);
        add(textFitsContent(node)?'关闭自动适应高度':'自动适应文本高度','move-vertical',()=>this.setTextAutoHeight(node.id),true,locked);
        add('转换为笔记','file-plus-2',()=>this.promptTextToNote(node.id),true,locked);
      }else if(node.kind==='image'){
        add(node.collapsed?'展开图片':'折叠图片',node.collapsed?'chevron-down':'chevron-up',()=>this.foldSelection(!node.collapsed),true,locked);
        add('打开图片','external-link',()=>file instanceof TFile&&this.app.workspace.getLeaf('tab').openFile(file),false,!(file instanceof TFile));
        add('上传到极速图床','cloud-upload',()=>this.uploadExistingImage(node.id),true,locked);
      }else if(node.kind==='audio'||node.kind==='video'){
        add('打开媒体原文件','external-link',()=>file instanceof TFile&&this.plugin.openNoteInSidebar(file),false,!(file instanceof TFile));
        add(node.collapsed?'展开媒体':'折叠媒体',node.collapsed?'chevron-down':'chevron-up',()=>this.foldSelection(!node.collapsed),true,locked);
      }else if(node.kind==='pdf'){
        add('右侧阅读 PDF','panel-right',()=>file instanceof TFile&&this.plugin.openNoteInSidebar(file,pdfSubpath(node.pdfPage)),false,!(file instanceof TFile));
        add(node.collapsed?'展开 PDF':'折叠 PDF',node.collapsed?'chevron-down':'chevron-up',()=>this.foldSelection(!node.collapsed),true,locked);
        add('选择 PDF 页码…','hash',()=>this.choosePdfPage(node.id),true,locked);
      }else if(node.kind==='board'){
        add('进入子白板','arrow-up-right',()=>file instanceof TFile&&this.enterBoard(file),false,!(file instanceof TFile));
        add(node.collapsed?'展开子白板':'折叠子白板',node.collapsed?'chevron-down':'chevron-up',()=>this.foldSelection(!node.collapsed),true,locked);
      }else if(node.kind==='section'){
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
  private showCanvasBackgroundMenu(anchor:HTMLElement){
    if(this.closed||!anchor?.isConnected||!this.session||this.session.blocked)return;this.canvasMenu?.hide();const owner=this.session,doc=anchor.ownerDocument,path=owner.file.path;
    const menu=new Menu().setUseNativeMenu(false);this.canvasMenu=menu;anchor.setAttribute('aria-expanded','true');
    const available=()=>!this.closed&&!this.closing&&anchor.isConnected&&anchor.ownerDocument===doc&&this.session===owner&&owner.file.path===path&&!owner.blocked;
    for(const [value,label,icon] of [['dots','点阵','circle-dot'],['grid','网格','grid'],['plain','纯色','square'],['paper','纸张纹理','file-text'],['image','背景图片','image']] as const){
      menu.addItem(item=>item.setTitle(label).setIcon(icon).setChecked(boardBackground(owner.board,this.plugin.settings).canvasBackground===value).onClick(()=>act(async()=>{
        if(!available())return;const current=boardBackground(owner.board,this.plugin.settings);
        if(value==='image'&&!current.backgroundImagePath){this.openBoardBackgroundSettings('image');return;}
        if(current.canvasBackground===value)return;
        owner.change(board=>{board.background={...current,canvasBackground:value};},undefined,false,true,false,true);await owner.flush();
      })));
    }
    if(isBrainBoard(owner.board))menu.addItem(item=>item.setTitle('脑图配色…').setIcon('palette').onClick(()=>{if(available())this.openBrainColors();}));
    menu.addSeparator();menu.addItem(item=>item.setTitle('自定义纸张…').setIcon('palette').onClick(()=>{if(available())this.openBoardBackgroundSettings('paper');}));
    menu.addItem(item=>item.setTitle('设置背景图片…').setIcon('image-plus').onClick(()=>{if(available())this.openBoardBackgroundSettings('image');}));
    if(owner.board.background)menu.addItem(item=>item.setTitle('跟随默认背景').setIcon('rotate-ccw').onClick(()=>act(async()=>{if(!available())return;owner.change(board=>{delete board.background;},undefined,false,true,false,true);await owner.flush();})));
    menu.onHide(()=>{if(this.canvasMenu===menu){this.canvasMenu=undefined;anchor.setAttribute('aria-expanded','false');}});
    const rect=anchor.getBoundingClientRect();menu.showAtPosition({x:rect.left,y:Math.max(12,rect.top-288)},doc);
  }
  private openBrainColors(){
    const owner=this.requireOwner(),view=this.brainBoardView,doc=this.contentEl.ownerDocument,path=owner.file.path;
    if(!view||!isBrainBoard(owner.board)||owner.blocked)return;
    this.canvasBackgroundDialog?.close();
    const stamp=brainColorsStamp(owner.board.brainColors);
    const current=()=>!this.closed&&!this.closing&&this.session===owner&&this.brainBoardView===view&&this.leaf.view===this&&this.contentEl.ownerDocument===doc&&!doc.defaultView?.closed&&owner.file.path===path&&isBrainBoard(owner.board)&&!owner.blocked&&brainColorsStamp(owner.board.brainColors)===stamp;
    const modal=new BrainColorsModal(this.app,{document:doc,name:owner.file.basename,colors:cleanBrainColors(owner.board.brainColors),current,
      preview:value=>{if(value===null||current())view.previewColors(value);},samples:()=>view.colorSamples(),
      save:async(value:BrainColors)=>{
        if(!current())throw Error('脑图或配色已变化，请重新打开配色设置');
        const colors=cleanBrainColors(value);
        // Whole-field replacement shares graph references, preserving the index.
        owner.change(board=>{if(Object.keys(colors).length)board.brainColors=colors;else delete board.brainColors;},{...owner.board},false,true,false,true);
        await owner.flush();if(owner.blocked)throw Error('配色保存失败，草稿已保留。请检查白板保存提示与恢复草稿。');
      }});
    const close=modal.onClose.bind(modal);modal.onClose=()=>{close();if(this.canvasBackgroundDialog===modal)this.canvasBackgroundDialog=undefined;};
    this.canvasBackgroundDialog=modal;modal.open();return modal;
  }
  private openBoardBackgroundSettings(kind:'paper'|'image'){
    const owner=this.requireOwner(),doc=this.contentEl.ownerDocument,path=owner.file.path;
    this.canvasBackgroundDialog?.close();
    const current=()=>!this.closed&&!this.closing&&this.session===owner&&owner.file.path===path&&this.leaf.view===this&&this.contentEl.ownerDocument===doc&&!doc.defaultView?.closed&&!owner.blocked;
    const preferences=()=>{if(!current())throw Error('白板已变化，请重新打开背景设置');return boardBackground(owner.board,this.plugin.settings);};
    const save=async(value:ReturnType<typeof cleanPaperPreferences>|ReturnType<typeof cleanBackgroundImagePreferences>,file?:File)=>{
      const previous=preferences(),stamp=JSON.stringify(previous),next=cleanBoardBackground({...previous,...value,canvasBackground:kind});
      const ready=()=>current()&&JSON.stringify(boardBackground(owner.board,this.plugin.settings))===stamp;
      if(file)next.backgroundImagePath=await this.plugin.storeBackgroundImageFile(file,ready);
      if(next.canvasBackground==='image'){
        if(next.backgroundImagePath&&!await this.app.vault.adapter.exists(next.backgroundImagePath))throw Error('背景图片已不存在，请重新选择图片');
        if(!next.backgroundImagePath)next.canvasBackground='plain';
      }
      if(!ready())throw Error('背景已在其他窗口改变，请重新打开设置');
      owner.change(board=>{board.background=next;},undefined,false,true,false,true);await owner.flush();
      if(owner.blocked)throw Error('背景保存失败，请检查白板的保存提示与恢复草稿');
    };
    const stamp=()=>JSON.stringify(preferences());
    const modal=kind==='paper'?new PaperSettingsModal(this.app,{stamp,language:settingsLanguage(this.plugin.settings),preferences:()=>cleanPaperPreferences(preferences()),save}):new BackgroundImageModal(this.app,{stamp,language:settingsLanguage(this.plugin.settings),preferences:()=>cleanBackgroundImagePreferences(preferences()),resource:path=>this.plugin.backgroundImageResource(path),save});
    const open=modal.onOpen.bind(modal),close=modal.onClose.bind(modal);
    modal.onOpen=()=>{if(!current()){modal.close();return;}if(modal.containerEl.ownerDocument!==doc)doc.body.appendChild(modal.containerEl);open();};
    modal.onClose=()=>{close();if(this.canvasBackgroundDialog===modal)this.canvasBackgroundDialog=undefined;};
    this.canvasBackgroundDialog=modal;modal.open();return modal;
  }
  private syncCanvasControls(){
    const count=String(this.selected.size);if(this.contentEl.dataset.selectionCount!==count)this.contentEl.dataset.selectionCount=count;
    // Read the live controls instead of caching UI state across remounts or edits.
    const toggle=(el:Element,name:string,on:boolean)=>{if(el.classList.contains(name)!==on)el.classList.toggle(name,on);};
    const attr=(el:Element,name:string,value:string)=>{if(el.getAttribute(name)!==value)el.setAttribute(name,value);};
    toggle(this.contentEl,'ts-has-edge',this.selectedEdge!==undefined&&!!this.session?.board.edges.some(e=>e.id===this.selectedEdge));
    const enabled=!!this.session?.board.snapToGrid;
    if(this.contentEl.dataset.snap!==String(enabled))this.contentEl.dataset.snap=String(enabled);if(!enabled)this.previewGridLanding();
    const disabled=!this.session||this.session.blocked;
    if(this.snapToggle){const title=enabled?'网格吸附已开启 · 拖动松手后对齐':'网格吸附已关闭 · 自由移动',label=enabled?'开启':'关闭',state=this.snapToggle.querySelector('.ts-snap-state');toggle(this.snapToggle,'is-active',enabled);attr(this.snapToggle,'aria-pressed',String(enabled));if(this.snapToggle.title!==title)this.snapToggle.title=title;if(state&&state.textContent!==label)state.setText(label);if(this.snapToggle.disabled!==disabled)this.snapToggle.disabled=disabled;}
    if(this.gridSelect&&this.gridSelect.value!==String(this.plugin.settings.gridStep))this.gridSelect.value=String(this.plugin.settings.gridStep);
    const background=this.canvasControls?.querySelector<HTMLButtonElement>('.ts-background-entry'),kind=this.session?.board.background?.canvasBackground??this.plugin.settings.canvasBackground;
    if(background){const label=({dots:'点阵',grid:'网格',plain:'纯色',paper:'纸张',image:'图片'})[kind]||'点阵',caption=background.querySelector('.ts-background-caption');if(caption&&caption.textContent!==label)caption.setText(label);const title=`白板背景 · ${label}`;if(background.title!==title)background.title=title;attr(background,'aria-label',`白板背景：${label}`);}
    if(this.overviewToggle){const shown=this.plugin.settings.showMinimap;attr(this.overviewToggle,'aria-pressed',String(shown));attr(this.overviewToggle,'aria-label',shown?'收起白板总览':'显示白板总览');const title=shown?'收起白板总览':'显示白板总览';if(this.overviewToggle.title!==title)this.overviewToggle.title=title;}
    let movable=0;if(this.selected.size&&this.session)for(const node of this.session.board.nodes)if(this.selected.has(node.id)&&!node.locked)movable++;
    const summary=this.selected.size?`已选 ${this.selected.size} 项${movable!==this.selected.size?' · 含锁定对象':''}`:`${this.session?.board.nodes.length||0} 个对象`;
    if(this.canvasSummary&&this.canvasSummary.textContent!==summary)this.canvasSummary.setText(summary);
    if(this.focusSelectedButton){const hidden=!this.selected.size,title=`聚焦所选 ${this.selected.size} 项 · Shift+F`;if(this.focusSelectedButton.hidden!==hidden)this.focusSelectedButton.hidden=hidden;if(this.focusSelectedButton.disabled!==disabled)this.focusSelectedButton.disabled=disabled;if(this.focusSelectedButton.title!==title)this.focusSelectedButton.title=title;}
    toggle(this.contentEl,'ts-has-selection',this.selected.size>0);
  }
  private drawAlignmentGuides(guides:Guide[]){
    const v=this.session?.board.viewport;if(!v)return;
    for(let i=0;i<Math.max(guides.length,this.alignmentLines.length);i++){const guide=guides[i];let el=this.alignmentLines[i];if(!guide){el?.remove();this.alignmentLines[i]=undefined!;continue;}if(!el?.isConnected){el=this.stage.createDiv({cls:'ts-alignment-guide',attr:{'aria-hidden':'true'}});this.alignmentLines[i]=el;}
      el.dataset.axis=guide.axis;el.dataset.spacing=guide.spacing===undefined?'':`${Math.round(guide.spacing*10)/10}`;const vertical=guide.spacing===undefined?guide.axis==='x':guide.axis==='y';Object.assign(el.style,{left:`${(vertical?guide.value:guide.start)*v.zoom+v.x}px`,top:`${(vertical?guide.start:guide.value)*v.zoom+v.y}px`,width:vertical?'1px':`${(guide.end-guide.start)*v.zoom}px`,height:vertical?`${(guide.end-guide.start)*v.zoom}px`:'1px'});
    }
  }
  private previewGridLanding(ids?:ReadonlySet<string>,excludeAxes?:ReadonlySet<'x'|'y'>,display?:Board){
    if(!this.snapTarget||!this.snapReadout)return;
    const board=ids&&this.session?.board.snapToGrid?display||this.displayBoard():undefined,point=ids&&board?gridLanding(board,ids,this.plugin.settings.gridStep,excludeAxes):undefined;
    for(const el of [this.snapTarget,this.snapReadout])if(el.classList.contains('is-visible')!==!!point)el.classList.toggle('is-visible',!!point);if(!point||!board)return;
    const x=point.x*board.viewport.zoom+board.viewport.x,y=point.y*board.viewport.zoom+board.viewport.y;
    const transform=`translate(${x}px, ${y}px)`,left=`${Math.max(8,Math.min(this.stage.clientWidth-145,x+18))}px`,top=`${Math.max(8,Math.min(this.stage.clientHeight-80,y-34))}px`,text=`吸附落点  ${point.x}, ${point.y}`;
    if(this.snapTarget.style.transform!==transform)this.snapTarget.style.transform=transform;
    if(this.snapReadout.style.left!==left)this.snapReadout.style.left=left;if(this.snapReadout.style.top!==top)this.snapReadout.style.top=top;if(this.snapReadout.textContent!==text)this.snapReadout.setText(text);
  }
  private syncSelectionTool() { this.selectionButton?.toggleClass('is-active',this.selectionTool);this.selectionButton?.setAttribute('aria-pressed',String(this.selectionTool));this.stage?.toggleClass('ts-select-tool',this.selectionTool); }
  private toggleConnectionTool(){const active=this.mode!=='connect';this.clearCanvasGesture();this.selectionTool=false;this.syncSelectionTool();this.mode=active?'connect':'select';this.connectButton?.toggleClass('is-active',active);this.stage.focus();this.renderInspector();}
  toggleSelectionTool(){const active=!this.selectionTool;this.clearCanvasGesture();this.selectionTool=active;this.syncSelectionTool();this.stage.focus();}
  private finishMarqueeFromDocument(e:PointerEvent,cancelled=false){const active=this.rightMarquee||this.linkDrag||this.marquee||this.gesture;if(active?.id===e.pointerId)this.pointerUp(e,cancelled);}
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
  private foldText(id:string,fold:boolean){if(fold&&(this.inlineId===id||this.inlineTarget===id||this.positions.get(id)?.querySelector('.ts-card-title-input'))){new Notice('请先完成内容编辑，再折叠');return;}if(this.session?.board.nodes.some(n=>n.id===id&&n.kind==='mindmap')){this.session.change(b=>foldCards(b,new Set([id]),fold),undefined,false,true,false,true);return;}this.mutate(b=>foldCards(b,new Set([id]),fold));}
  private foldSelection(fold:boolean){if(fold&&[this.inlineId,this.inlineTarget].some(id=>id&&this.selected.has(id))){new Notice('请先完成内容编辑，再折叠');return;}this.mutate(b=>foldCards(b,this.selected,fold));}
  private focusSelection(){if(!this.session||this.session.blocked||!this.selected.size)return;const ids=expandedSelection(this.session.board,this.selected),nodes=visibleBranchBoard(this.session.board).nodes.filter(n=>ids.has(n.id));this.rememberViewport();this.session.board.viewport=this.fitContent(nodes);this.transform();this.session.persist();}
  private alignmentMenu(_event?:MouseEvent){
    const owner=this.session,ids=new Set(this.selected);if(!owner||owner.blocked)return;
    this.inspectorChoices('对齐与分布',Object.entries(alignmentLabels).map(([action,label])=>({label,run:()=>{this.requireOwner(owner);owner.change(b=>alignSelection(b,ids,action as Alignment));}})));
  }
  private pointerDown(e: PointerEvent) {
    if(e.button===1)this.suppressMiddlePaste=false;
    // A new physical click must never inherit suppression from a previous drag.
    if(e.button===2||(e.button===0&&e.ctrlKey)||e.pointerType==='touch')this.suppressBoardContext=false;
    if (!this.session || this.session.blocked || e.button > 2 || this.gesture || this.marquee || this.rightMarquee || this.linkDrag) return;
    // macOS Control + 单击也会触发右键菜单，不能先作为左键拖动或连线处理。
    if (e.button === 0 && e.ctrlKey) return;
    const target = e.target as Element;
    if(target.closest('[data-mindmap-interactive]')&&!this.space&&e.button!==1)return;
    const dragAction=(button:number)=>{const value=this.plugin.settings[button===0?'leftDrag':button===1?'middleDrag':'rightDrag'];return value==='pan'||value==='select'||value==='none'?value:button===2?'select':'pan';};
    if(e.button===2){
      if(this.space||target.closest('a,input,textarea,select,button,video,audio,.ts-av-player,[contenteditable=true],.ts-inline-editor')||target.closest('[data-id]')||target.closest('[data-edge]'))return;
      const action=dragAction(2);if(action==='none')return;
      this.rightMarquee={id:e.pointerId,x:e.clientX,y:e.clientY,start:this.point(e.clientX,e.clientY),event:e,owner:this.session,moved:false,additive:e.shiftKey,action,viewport:{...this.session.board.viewport}};
      this.stage.focus();e.preventDefault();return;
    }
    let selectionChanged=this.contextOpen||!!this.contextPoint||!!this.inspectorChoiceState;
    this.contextOpen=false;this.contextPoint=undefined;this.inspectorChoiceState=undefined;
    const handle=target.closest<SVGElement>('[data-edge-end]');if(handle&&e.button===0){const edge=this.session.board.edges.find(edge=>edge.id===handle.dataset.edge);if(edge){const end=handle.dataset.edgeEnd as 'from'|'to';this.startLinkDrag(e,end==='from'?edge.to:edge.from,end==='from'?edge.toSide:edge.fromSide,{id:edge.id,end,expected:JSON.stringify(edge)});}return;}
    if (target.closest('a,input,textarea,select,button,video,audio,.ts-av-player,[contenteditable=true],.ts-inline-editor')) return;
    this.stage.focus();
    if(this.sectionTool&&!this.space&&e.button===0){
      const start=this.point(e.clientX,e.clientY),box=this.world.createDiv('ts-marquee ts-section-draft');
      Object.assign(box.style,{left:`${start.x}px`,top:`${start.y}px`,width:'0px',height:'0px'});
      this.marquee={id:e.pointerId,start,base:new Set(this.selected),baseEdge:this.selectedEdge,box,section:true};this.stage.setPointerCapture(e.pointerId);e.preventDefault();return;
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
    if(e.button===1)this.suppressMiddlePaste=true;
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
    const resizeHandle=!pan?target.closest<HTMLElement>('.ts-resize'):null,resize=resizeHandle?id||undefined:undefined;
    let deselectOnClick:string|undefined;
    if (!pan && id) {
      selectionChanged=selectionChanged||!!this.selectedEdge;this.selectedEdge=undefined;
      if(resize){
        // Handles change one object's size without dropping the current selection.
        if(!this.selected.has(id)){this.selected.add(id);selectionChanged=true;}
      }else if(e.shiftKey){
        // Shift also constrains a drag. Remove a selected card only after a click.
        if(this.selected.has(id))deselectOnClick=id;
        else{this.selected.add(id);selectionChanged=true;}
      }else if(!this.selected.has(id)){this.selected=new Set([id]);selectionChanged=true;}
    }
    // Re-clicking an existing selection does not need to rebuild its inspector or node styles.
    if(selectionChanged)this.updateSelection();
    const board=this.session.board,ids=pan?new Set<string>():movableSelection(board,this.selected);
    // Panning only restores the viewport; do not clone note payloads or build target indexes.
    const before:Board=pan?{version:board.version,nodes:[],edges:[],viewport:{...board.viewport}}:dragStartSnapshot(board);
    const requestedEdge=resizeHandle?.dataset.resizeEdge;
    const resizeEdge=resize&&board.nodes.find(node=>node.id===resize)?.kind==='section'&&['top','right','bottom','left'].includes(requestedEdge||'')?requestedEdge as SectionResizeEdge:undefined;
    this.gesture = { draft:new Map(before.nodes.filter(n=>!pan&&!n.locked&&(resize?n.id===resize:ids.has(n.id))).map(n=>[n.id,{...n}])), targets:pan?[]:dragTargets(this.session.board.nodes,ids,resize), originals:new Map(before.nodes.map(n=>[n.id,n])),idSet:ids, id: e.pointerId, x: e.clientX, y: e.clientY, before, ids: [...ids], pan, clearSelectionOnClick:pan&&!this.space&&e.button===0&&!id,deselectOnClick,resize,resizeEdge };
    // 点击时不捕获指针，否则浏览器会把 dblclick 的目标改成画布。
    // 真正超过拖动阈值后再捕获，保留双击编辑与越界拖动两种行为。
    e.preventDefault();
  }
  private pointerMove(e:PointerEvent){
    if(!this.gesture&&!this.marquee&&!this.rightMarquee&&this.mode!=='connect')return;
    const owner=this.rightMarquee||this.linkDrag||this.marquee||this.gesture;if(owner&&owner.id!==e.pointerId)return;
    // Keep the gesture intent when a burst moves out and back before the frame.
    const g=this.gesture;if(g&&!g.crossedThreshold&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>=(g.resize?3:(this.plugin.settings.dragThreshold??4)))g.crossedThreshold=true;
    const right=this.rightMarquee;if(right&&!right.crossedThreshold&&Math.hypot(e.clientX-right.x,e.clientY-right.y)>=(this.plugin.settings.dragThreshold??4))right.crossedThreshold=true;
    const link=this.linkDrag;if(link&&!link.moved&&Math.hypot(e.clientX-link.x,e.clientY-link.y)>4)link.moved=true;
    this.pendingPointer=e;if(!this.pointerFrame)this.pointerFrame=(this.stage.ownerDocument?.defaultView||window).requestAnimationFrame(()=>{this.pointerFrame=0;this.flushPointer();});
  }
  private flushPointer(apply=true){if(this.pointerFrame)(this.stage.ownerDocument?.defaultView||window).cancelAnimationFrame(this.pointerFrame);this.pointerFrame=0;const e=this.pendingPointer;this.pendingPointer=undefined;if(apply&&e)this.applyPointerMove(e);}
  private applyPointerMove(e: PointerEvent, crossedThreshold = false) {
    const right=this.rightMarquee;
    if(right){
      if(right.id!==e.pointerId||right.owner!==this.session)return;
      if(!right.moved){
        if(!crossedThreshold&&!right.crossedThreshold&&Math.hypot(e.clientX-right.x,e.clientY-right.y)<(this.plugin.settings.dragThreshold??4))return;
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
      const hits=visibleMarqueeSelection(this.session.board,rect),next=new Set(m.box.dataset.additive==='true'?m.base:[]);
      // Match the active object/relationship scope without discarding Shift's explicit base.
      for(const id of hits)if((!this.filterMatches||this.filterMatches.has(id))&&(!this.relatedFocus||this.relatedFocus.has(id)))next.add(id);
      // The rectangle still moves every frame; selection UI only changes with membership.
      if(next.size!==this.selected.size||Array.from(next).some(id=>!this.selected.has(id))){this.selected=next;this.updateSelection();}return;
    }
    const g = this.gesture; if (!g || !this.session || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y; if (!this.dragging && !crossedThreshold && !g.crossedThreshold && Math.hypot(dx,dy) < (g.resize?3:(this.plugin.settings.dragThreshold??4))) return;
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
      if (g.resize === n.id) { Object.assign(n,g.resizeEdge&&original.kind==='section'?resizedSection(original,dx/b.viewport.zoom,dy/b.viewport.zoom,g.resizeEdge):resized(original,dx/b.viewport.zoom,dy/b.viewport.zoom,e.shiftKey&&this.plugin.settings.aspectLock)); if(n.kind==='card')n.autoFit=false;if(n.kind==='text'){n.autoSize=false;n.textAutoHeight=false;} }
      else if (!g.resize && g.idSet.has(n.id)) { n.x = original.x + delta.dx; n.y = original.y + delta.dy; }
      if(g.resize===n.id||(!g.resize&&g.idSet.has(n.id))){const el = this.positions.get(n.id); if (el) this.positionNode({...live,...dragGeometry(n,!!g.resize)}, el);}
    }
    this.syncMinimapAvoidance();
    // Only connections and a visible grid landing consume projected drag geometry.
    // Keep edge rendering active even without an overlay so stale rows/ports clear.
    const base=this.inlineLayout&&this.inlineTarget?{...this.inlineLayout,viewport:b.viewport}:b,landingIds=g.resize||g.guides?.length||e.altKey?undefined:g.idSet;
    const display=base.edges.length||landingIds&&b.snapToGrid?this.displayBoard():base;this.previewGridLanding(landingIds,g.lockedAxis?new Set([g.lockedAxis]):undefined,display);this.renderEdges(undefined,display);
  }
  private pointerUp(e: PointerEvent, cancelled = false) {
    // Linux PRIMARY paste follows pointerup even if auxclick is cancelled.
    if(e.button===1&&this.suppressMiddlePaste)e.preventDefault();
    const active=this.rightMarquee||this.linkDrag||this.marquee||this.gesture;
    if(!active||active.id!==e.pointerId)return;
    // The release supersedes queued coordinates. Retain only their threshold
    // crossing, so a quick out-and-back drag cannot become a click or topic add.
    const pending=this.pendingPointer,start=this.rightMarquee||this.linkDrag||this.gesture;
    const distance=!cancelled&&pending?.pointerId===e.pointerId&&start?Math.hypot(pending.clientX-start.x,pending.clientY-start.y):0;
    const crossedThreshold=!!this.gesture?.crossedThreshold||!!this.rightMarquee?.crossedThreshold||distance>0&&(this.linkDrag?distance>4:distance>=(this.gesture?.resize?3:(this.plugin.settings.dragThreshold??4)));
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
    } else if(g.deselectOnClick){
      if(this.selected.delete(g.deselectOnClick))this.updateSelection();
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
    if(e.defaultPrevented||e.isComposing||e.keyCode===229)return;
    if ((e.target as Element).closest('input,textarea,select,button,a[href],summary,[role=button],[role=menuitem],[contenteditable]:not([contenteditable=false])')) return;
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
  private matches(file: TFile, tags = getAllTags(this.app.metadataCache.getFileCache(file) || {}) || []) {
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
      const name=(n:Card)=>{const f=n.file&&this.app.vault.getAbstractFileByPath(n.file);return n.kind==='card'?cardDisplayTitle(n,f instanceof TFile?f:undefined):readingTitle(n)||'未命名';};
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
        if(n.kind==='card'||n.kind==='pdf'||n.kind==='board'||n.kind==='text'||n.kind==='audio'||n.kind==='video'||n.kind==='image'||n.kind==='mindmap'){const label=n.kind==='mindmap'?'脑图':n.kind==='board'?'子白板':n.kind==='pdf'?'PDF':n.kind==='text'?'文本':'卡片';const fold=button(row,`${n.collapsed?'展开':'折叠'}${label}`,n.collapsed?'chevron-down':'chevron-up',()=>{this.requireOwner(owner);const current=owner.board.nodes.find(node=>node.id===n.id);if(current)this.foldText(current.id,!current.collapsed);},'ts-icon-button');fold.disabled=owner.blocked||!!n.locked;fold.setAttribute('aria-expanded',String(!n.collapsed));}
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
      button(controls,'折叠全部','chevrons-up',()=>{this.collapsedBoards=new Set(this.app.vault.getFiles().filter(f=>isBoardFile(this.app,f)).map(f=>f.path));this.renderSidebar();},'ts-icon-button');
      button(controls,'定位当前白板','locate-fixed',async()=>{this.query='';const input=this.sidebar.querySelector<HTMLInputElement>('.ts-search');if(input)input.value='';const clear=this.sidebar.querySelector<HTMLButtonElement>('.ts-search-clear');if(clear)clear.hidden=true;this.collapsedBoards.clear();await this.populateSidebar();const row=Array.from(this.sidebar.querySelectorAll<HTMLElement>('[data-board-path]')).find(e=>e.dataset.boardPath===this.file?.path);row?.scrollIntoView({block:'nearest'});row?.querySelector<HTMLButtonElement>('.ts-tree-title')?.focus();},'ts-icon-button');
      const owner=this.session,current=()=>run===this.sidebarRun&&owner===this.session&&!this.closed&&this.tab==='boards';
      // Superseded searches discard the entire graph; nesting validation still
      // calls boardGraph without a cancellation predicate and checks every file.
      const result=await this.plugin.boardGraph(current);if(!result||!current())return;
      const {graph,errors}=result;
      const files = this.app.vault.getFiles().filter(isWorkspaceFile).filter(f => isBoardFile(this.app,f)).sort(compare);
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
    // Tag totals and filtering share this synchronous read. Row metadata below
    // is deliberately read again after awaiting note content.
    const tags = new Map<string, number>();
    const files = all.filter(file => {const current=getAllTags(this.app.metadataCache.getFileCache(file) || {}) || [];for(const tag of current)tags.set(tag,(tags.get(tag)||0)+1);return this.matches(file,current);});
    const select = list.createEl('select', { cls: 'ts-tag-select', attr: { 'aria-label': '按标签筛选' } }); select.createEl('option', { value: '', text: '所有标签' });
    [...tags].sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => select.createEl('option', { value: tag, text: `${tag} · ${count}` }));
    select.value = this.tag; select.onchange = () => { this.tag = select.value; this.renderSidebar(); };
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
    const f = await this.plugin.createUnique(this.file?.parent?.path || ROOT, `${this.file?.basename || '白板'}-导出`, 'canvas', JSON.stringify(canvasExport(this.session.board,this.app.vault.getName()), null, 2));
    new Notice(`已导出原生 Canvas：${f.path}`); await this.app.workspace.getLeaf('tab').openFile(f);
  }
}

class WorkspaceSettingsModal extends Modal {
  constructor(app:App,private plugin:ThoughtSpace){super(app);}
  onOpen(){this.modalEl.addClass('ts-workspace-settings-modal');themeSurface(this.modalEl);this.titleEl.setText(settingsLanguage(this.plugin.settings)==='en'?'Workspace settings':'工作台设置');const tab=new ThoughtSpaceSettings(this.app,this.plugin);tab.containerEl=this.contentEl;tab.display();}
  onClose(){this.contentEl.empty();}
}
