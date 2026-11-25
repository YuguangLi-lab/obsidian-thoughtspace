import type {SettingsLanguage,SettingsLanguagePreference} from './settings-preferences';
import {resolveSettingsLanguage} from './settings-preferences';
import type {LibraryCardType} from './card-library-model';

export function resolveUiLanguage(preference?:SettingsLanguagePreference,hostLocale='zh-CN'):SettingsLanguage {
  if(!preference)return 'zh-CN';
  return resolveSettingsLanguage(preference,hostLocale);
}

export interface RibbonLabels {
  cardLibrary:string;
  mediaNotes:string;
  excerptNote:string;
  sidebar:string;
  organizeBoard:string;
  database:string;
  collection:string;
}

export function ribbonLabels(lang:SettingsLanguage):RibbonLabels {
  if(lang==='en'){
    return {
      cardLibrary:'Card Library',
      mediaNotes:'Media Notes',
      excerptNote:'Excerpt Reader',
      sidebar:'Sidebar',
      organizeBoard:'Organize Board',
      database:'Database',
      collection:'Capture',
    };
  }
  return {
    cardLibrary:'卡片库',
    mediaNotes:'音视频笔记',
    excerptNote:'笔记摘录',
    sidebar:'侧边栏',
    organizeBoard:'整理白板',
    database:'资料库',
    collection:'收集',
  };
}

export interface CardLibraryLabels {
  modalTitle:string;
  views:{list:string;table:string;kanban:string};
  searchAria:string;
  searchPlaceholder:string;
  viewsGroupAria:string;
  filterSummary:(count:number)=>string;
  filters:{type:string;tag:string;board:string;status:string;choice:string};
  allTypes:string;
  allTags:string;
  allBoards:string;
  allStatuses:string;
  allChoices:string;
  uncategorized:string;
  typeNames:Record<LibraryCardType,string>;
  statusNames:Record<string,string>;
  clearFilterAria:(field:string,value:string)=>string;
  searchChip:(q:string)=>string;
  clearSearchAria:string;
  clearAll:string;
  clearFilters:string;
  cardCount:(count:number,selected:number)=>string;
  indexingStatus:string;
  resultsAria:string;
  actionsDialogAria:string;
  cardActionsAria:(title:string)=>string;
  collapseActions:string;
  placeOnBoard:string;
  openInBoard:string;
  boardPickerAria:(title:string)=>string;
  chooseBoard:string;
  searchRemainingBoards:string;
  statusPickerAria:(title:string)=>string;
  choicePickerAria:(title:string)=>string;
  unlinkFromBoard:string;
  moreActionsTitle:string;
  moreActionsAria:(title:string)=>string;
  emptyUncategorized:string;
  emptyFiltered:string;
  emptyLibrary:string;
  selectCardAria:(title:string)=>string;
  openSourceAria:(title:string)=>string;
  actionColumn:string;
  unplaced:string;
  indexIncomplete:string;
  restUnindexed:string;
  quickStatusAria:(title:string)=>string;
  quickChoiceAria:(title:string)=>string;
  laneToggleAria:(label:string,expanded:boolean)=>string;
}

export function cardLibraryLabels(lang:SettingsLanguage='zh-CN'):CardLibraryLabels {
  if(lang==='en'){
    return {
      modalTitle:'Card Library',
      views:{list:'List',table:'Table',kanban:'Kanban'},
      searchAria:'Search Card Library',
      searchPlaceholder:'Search titles, tags, properties, or boards…',
      viewsGroupAria:'Card Library views',
      filterSummary:n=>n?`Filters · ${n}`:'Filters',
      filters:{type:'Type',tag:'Tag',board:'Board',status:'Status',choice:'Category'},
      allTypes:'All types',
      allTags:'All tags',
      allBoards:'All boards',
      allStatuses:'All statuses',
      allChoices:'All categories',
      uncategorized:'Uncategorized',
      typeNames:{note:'Note',pdf:'PDF',image:'Image',audio:'Audio',video:'Video'},
      statusNames:{inbox:'Inbox',active:'In progress',done:'Done'},
      clearFilterAria:(f,v)=>`Clear ${f}: ${v}`,
      searchChip:q=>`Search: ${q} ×`,
      clearSearchAria:'Clear search',
      clearAll:'Clear all',
      clearFilters:'Clear filters',
      cardCount:(n,s)=>`${n} card${n===1?'':'s'}${s?` · ${s} selected`:''}`,
      indexingStatus:'Indexing board references…',
      resultsAria:'Card Library results',
      actionsDialogAria:'Card actions',
      cardActionsAria:t=>`Card actions: ${t}`,
      collapseActions:'Hide actions',
      placeOnBoard:'Place on current board',
      openInBoard:'Open on board',
      boardPickerAria:t=>`Boards containing ${t}`,
      chooseBoard:'Select board',
      searchRemainingBoards:'Search remaining boards',
      statusPickerAria:t=>`Status ${t}`,
      choicePickerAria:t=>`Category ${t}`,
      unlinkFromBoard:'Remove reference from board',
      moreActionsTitle:'More actions',
      moreActionsAria:t=>`More actions: ${t}`,
      emptyUncategorized:'No matching uncategorized cards.',
      emptyFiltered:'No matching cards.',
      emptyLibrary:'No cards yet.',
      selectCardAria:t=>`Select card: ${t}`,
      openSourceAria:t=>`Open source card: ${t}`,
      actionColumn:'Actions',
      unplaced:'Not on any board',
      indexIncomplete:'Board index incomplete',
      restUnindexed:'remaining boards unindexed',
      quickStatusAria:t=>`Change status: ${t}`,
      quickChoiceAria:t=>`Change category: ${t}`,
      laneToggleAria:(l,open)=>`${open?'Collapse':'Expand'} ${l}`,
    };
  }
  return {
    modalTitle:'卡片库',
    views:{list:'列表',table:'表格',kanban:'看板'},
    searchAria:'搜索卡片库',
    searchPlaceholder:'搜索标题、标签、属性或白板…',
    viewsGroupAria:'卡片库视图',
    filterSummary:n=>n?'筛选 · '+n:'筛选',
    filters:{type:'卡片类型',tag:'标签',board:'白板',status:'状态',choice:'分类'},
    allTypes:'全部类型',
    allTags:'全部标签',
    allBoards:'全部白板',
    allStatuses:'全部状态',
    allChoices:'全部分类',
    uncategorized:'未分类',
    typeNames:{note:'笔记',pdf:'PDF',image:'图片',audio:'音频',video:'视频'},
    statusNames:{inbox:'待整理',active:'进行中',done:'已完成'},
    clearFilterAria:(f,v)=>'清除'+f+'：'+v,
    searchChip:q=>'搜索：'+q+' ×',
    clearSearchAria:'清除搜索',
    clearAll:'清除全部',
    clearFilters:'清除筛选',
    cardCount:(n,s)=>n+' 张卡片'+(s?' · 已选 '+s:''),
    indexingStatus:'正在索引白板引用…',
    resultsAria:'卡片库结果',
    actionsDialogAria:'卡片操作',
    cardActionsAria:t=>'卡片操作：'+t,
    collapseActions:'收起操作',
    placeOnBoard:'放置到当前白板',
    openInBoard:'在白板中打开',
    boardPickerAria:t=>'所在白板 '+t,
    chooseBoard:'选择白板',
    searchRemainingBoards:'查找其余白板',
    statusPickerAria:t=>'状态 '+t,
    choicePickerAria:t=>'分类 '+t,
    unlinkFromBoard:'从白板移除引用',
    moreActionsTitle:'更多操作',
    moreActionsAria:t=>'更多操作：'+t,
    emptyUncategorized:'没有符合条件的未分类卡片。',
    emptyFiltered:'没有匹配的卡片。',
    emptyLibrary:'还没有卡片。',
    selectCardAria:t=>'选择卡片：'+t,
    openSourceAria:t=>'打开源卡片：'+t,
    actionColumn:'操作',
    unplaced:'未放置在白板',
    indexIncomplete:'引用位置未索引完',
    restUnindexed:'其余白板未索引',
    quickStatusAria:t=>'切换状态：'+t,
    quickChoiceAria:t=>'切换分类：'+t,
    laneToggleAria:(l,open)=>(open?'折叠':'展开')+l,
  };
}
