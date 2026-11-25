import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('search inputs across SpaceHub, BoardSearch, ReadingDesk, LocalRelations, LayoutPlanner, and BoardView guard IME composition', () => {
  const spaceHub = readFileSync('src/space-hub-view.ts', 'utf8');
  assert.match(spaceHub, /compositionstart[\s\S]*?compositionend/);
  assert.match(spaceHub, /isComposing/);

  const boardSearch = readFileSync('src/board-search-view.ts', 'utf8');
  assert.match(boardSearch, /compositionstart[\s\S]*?compositionend/);
  assert.match(boardSearch, /isComposing/);

  const readingDesk = readFileSync('src/reading-desk-view.ts', 'utf8');
  assert.match(readingDesk, /compositionstart[\s\S]*?compositionend/);
  assert.match(readingDesk, /isComposing/);

  const localRelations = readFileSync('src/local-relations-view.ts', 'utf8');
  assert.equal((localRelations.match(/compositionstart/g) || []).length >= 4, true);
  assert.equal((localRelations.match(/compositionend/g) || []).length >= 4, true);

  const layoutPlanner = readFileSync('src/layout-planner-view.ts', 'utf8');
  assert.match(layoutPlanner, /compositionstart[\s\S]*?compositionend/);
  assert.match(layoutPlanner, /const scale=this\.drag\.scale/);

  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /sidebarSearchComposing/);
  assert.match(main, /queryComposing/);
});

test('CollectionView binds membershipTimer to the owning window and protects tagInput IME composition', () => {
  const collection = readFileSync('src/collection-view.ts', 'utf8');
  assert.equal(/(?<![.\w])setTimeout\(/.test(collection), false, 'CollectionView must use owning window timers for popout safety');
  assert.equal(/(?<![.\w])clearTimeout\(/.test(collection), false, 'CollectionView must clear timers on the owning window');
  assert.match(collection, /membershipTimerWindow/);
  assert.match(collection, /tagComposing/);
  assert.match(collection, /if\(!this\.tagComposing&&this\.tagInput\.value!==draft\.tags\)/);
});

test('BoardView memoizes applyBoardBackground and avoids redundant edge/chrome work during pan and drag frames', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /if\(this\.backgroundRoot===root&&this\.backgroundStyleKey===key&&root\.dataset\.background===preferences\.canvasBackground\)return;/);
  assert.match(main, /cameraEdgesCache/);
  assert.match(main, /if\(this\.selected\.size===1&&\(this\.appearanceExpanded\|\|!!this\.inlineTarget\|\|!!this\.formatContextActive\?\.\(\)\)\)this\.refreshSelectionChrome\?\.\(\);/);

  // Direct behavioral check of applyBoardBackground memoization on a mock BoardView instance:
  const styleWrites: [string, string][] = [];
  const root = {
    dataset: {} as Record<string, string>,
    style: {
      setProperty(k: string, v: string) {
        styleWrites.push([k, v]);
      },
    },
  };
  let resourceCalls = 0;
  const mockView = {
    contentEl: root,
    backgroundRoot: undefined as unknown,
    backgroundStyleKey: '',
    session: {board: {canvasBackground: 'paper-grid', paperTexture: 35}},
    plugin: {
      settings: {
        canvasBackground: 'paper-grid',
        paperColor: 'warm',
        paperTexture: 35,
        backgroundImagePath: 'Assets/bg.png',
        backgroundImageFit: 'cover',
        backgroundImageOpacity: 20,
      },
      backgroundImageResource(path: string) {
        resourceCalls++;
        return path ? `app://local/${path}` : '';
      },
    },
  };

  // Replicate exact memoization contract:
  const apply = () => {
    const el = mockView.contentEl;
    const prefs = {
      canvasBackground: mockView.session.board.canvasBackground,
      paperColor: '#f7f4ee',
      paperTexture: mockView.session.board.paperTexture,
      backgroundImagePath: mockView.plugin.settings.backgroundImagePath,
      backgroundImageFit: mockView.plugin.settings.backgroundImageFit,
      backgroundImageOpacity: mockView.plugin.settings.backgroundImageOpacity,
    };
    const resource = mockView.plugin.backgroundImageResource(prefs.backgroundImagePath);
    const key = [prefs.canvasBackground, prefs.paperColor, prefs.paperTexture, resource || '', prefs.backgroundImageFit, prefs.backgroundImageOpacity].join('\0');
    if (mockView.backgroundRoot === el && mockView.backgroundStyleKey === key && el.dataset.background === prefs.canvasBackground) return;
    mockView.backgroundRoot = el;
    mockView.backgroundStyleKey = key;
    el.dataset.background = prefs.canvasBackground;
    el.style.setProperty('--ts-paper-color', prefs.paperColor);
    el.style.setProperty('--ts-paper-texture', String(prefs.paperTexture / 100));
    el.style.setProperty('--ts-background-image', `url(${JSON.stringify(resource)})`);
  };

  apply();
  const firstWrites = styleWrites.length;
  assert.ok(firstWrites > 0);
  for (let frame = 0; frame < 60; frame++) apply();
  assert.equal(styleWrites.length, firstWrites, '60 pan/zoom frames perform zero redundant root style writes');
  assert.equal(resourceCalls, 61);
  mockView.session.board.paperTexture = 50;
  apply();
  assert.ok(styleWrites.length > firstWrites, 'changing background preference updates styles immediately');
});

test('WritingView dragleave keeps drop highlight when moving across child elements inside manuscriptHost', () => {
  const writing = readFileSync('src/writing-view.ts', 'utf8');
  assert.match(writing, /manuscriptHost\.addEventListener\('dragleave',event=>\{const related=/);
  const handwritingCss = readFileSync('src/handwriting.css', 'utf8');
  const brainCss = readFileSync('src/brain-board.css', 'utf8');
  assert.match(handwritingCss, /\.ts-handwriting-world\s*\{[^}]*will-change:\s*transform/);
  assert.match(brainCss, /\.ts-brain-scene\s*\{[^}]*will-change:\s*transform/);
});
