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