import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyBoard, parseBoard, removeNodes, canvasExport, History, contained, fitViewport, extractTasks, toggleTask, safeName, clone } from '../src/model';
const fixture = () => {
  const b = emptyBoard();
  b.nodes = [{ id: 's', kind: 'section', title: '研究', x: -50, y: -50, width: 800, height: 600, color: 'blue' },
    { id: 'a', kind: 'card', file: '笔记/来源.md', x: 10, y: 20, width: 300, height: 270, color: 'sand' },
    { id: 'b', kind: 'card', file: '笔记/观点.md', x: 400, y: 20, width: 300, height: 270, color: 'green' }];
  b.edges = [{ id: 'e', from: 'a', to: 'b', label: '支持' }]; return b;
};
test('Unicode notes and negative coordinates survive round-trip', () => { const b = fixture(); assert.deepEqual(parseBoard(JSON.stringify(b)), b); });
test('Reject malformed or future-version data without treating it as an empty board', () => {
  for (const raw of ['', '{}', 'null', '{"version":2,"nodes":[],"edges":[]}']) assert.throws(() => parseBoard(raw));
  const b = fixture(); b.nodes[1].width = NaN; assert.throws(() => parseBoard(JSON.stringify(b)));
});
test('Reject duplicate IDs, unsafe paths, dangling edges and invalid zoom', () => {
  for (const mutate of [(b: ReturnType<typeof fixture>) => { b.nodes[1].id = 's'; }, (b: ReturnType<typeof fixture>) => { b.nodes[1].file = '../secret.md'; }, (b: ReturnType<typeof fixture>) => { b.edges[0].to = 'missing'; }, (b: ReturnType<typeof fixture>) => { b.viewport.zoom = 0; }]) { const b = fixture(); mutate(b); assert.throws(() => parseBoard(JSON.stringify(b))); }
});
test('Remove reference cascades only to incident edges, retaining other card references', () => { const b = fixture(); removeNodes(b, new Set(['a'])); assert.deepEqual(b.nodes.map(n => n.id), ['s', 'b']); assert.equal(b.edges.length, 0); assert.equal(b.nodes[1].file, '笔记/观点.md'); });
test('Removing a section preserves contained cards', () => { const b = fixture(); removeNodes(b, new Set(['s'])); assert.equal(b.nodes.length, 2); assert.equal(b.edges.length, 1); });
test('History snapshots are isolated and new changes invalidate redo', () => {
  const h = new History(), b = fixture(); h.push(b); b.nodes[1].x = 999;
  const undone = h.undo(b)!; assert.equal(undone.nodes[1].x, 10); assert.equal(h.redo(undone)!.nodes[1].x, 999);
  h.undo(b); h.push(b); assert.equal(h.redo(b), undefined);
});
test('Section movement membership requires complete containment', () => { const b = fixture(); assert.equal(contained(b.nodes[0], b.nodes[1]), true); b.nodes[1].x = 700; assert.equal(contained(b.nodes[0], b.nodes[1]), false); assert.equal(contained(b.nodes[0], b.nodes[0]), false); });
test('Fit viewport includes all nodes within padded bounds', () => { const b = fixture(), v = fitViewport(b.nodes, 1200, 800); for (const n of b.nodes) { assert.ok(n.x * v.zoom + v.x >= 49); assert.ok(n.y * v.zoom + v.y >= 49); assert.ok((n.x + n.width) * v.zoom + v.x <= 1151); assert.ok((n.y + n.height) * v.zoom + v.y <= 751); } });
test('Canvas export maps cards, sections, colors, arrows and Unicode paths', () => { const c = canvasExport(fixture()); assert.equal(c.nodes[0].type, 'group'); assert.equal(c.nodes[1].type, 'file'); assert.ok('file' in c.nodes[1]); assert.equal(c.nodes[1].file, '笔记/来源.md'); assert.equal(c.edges[0].fromNode, 'a'); assert.equal(c.edges[0].toEnd, 'arrow'); });
test('Tasks ignore YAML and fenced examples, preserving original line numbers', () => {
  const source = '---\nexample: text\n- [ ] metadata\n---\n# 任务\n- [ ] 阅读文献\n```md\n- [ ] 示例\n```\n  - [x] 已完成\n~~~\n- [ ] 示例2\n~~~\n1. [ ] 写作';
  assert.deepEqual(extractTasks(source).map(t => [t.line, t.text, t.checked]), [[5, '阅读文献', false], [9, '已完成', true], [13, '写作', false]]);
});
test('Task update preserves CRLF and rejects stale source before mutation', () => { const source = '# 文献\r\n- [ ] 阅读\r\n'; const t = extractTasks(source)[0]; assert.equal(toggleTask(source, t), '# 文献\r\n- [x] 阅读\r\n'); assert.throws(() => toggleTask(source.replace('阅读', '写作'), t)); });
test('Filenames cannot escape the target directory', () => { assert.equal(safeName('../危险/名称:#'), '-危险-名称--'); assert.equal(safeName('...'), '未命名'); });
test('fit viewport ignores invalid node geometry instead of hiding every other node',()=>{const good={id:'ok',kind:'text' as const,text:'ok',color:'sand' as const,x:10,y:20,width:200,height:100},bad={...good,id:'bad',height:NaN};const v=fitViewport([good,bad],1000,700);assert.ok(Object.values(v).every(Number.isFinite));assert.ok(good.x*v.zoom+v.x>=0);assert.ok(good.y*v.zoom+v.y>=0);for(const size of [NaN,Infinity,0])assert.ok(Object.values(fitViewport([good],size,700)).every(Number.isFinite));});
