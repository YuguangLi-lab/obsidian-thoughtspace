import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { appendJournalTask, dateOf, journalPaths, monthDays, monthGrid, reviewContent, shiftDay, shiftMonth, weekDays } from '../src/calendar-tools';
test('Calendar months cover leap years and year boundaries',()=>{assert.equal(monthDays('2024-02').length,29);assert.equal(monthDays('2025-02').length,28);assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2026-01',-1),'2025-12');});
test('Month grid is Monday-first with 42 unique real dates',()=>{const grid=monthGrid('2026-03');assert.equal(grid.length,42);assert.equal(new Set(grid).size,42);assert.equal(dateOf(grid[0]).getDay(),1);assert.equal(grid[0],'2026-02-23');assert.ok(grid.includes('2026-03-31'));});
test('Week crosses calendar year without dropping days',()=>{assert.deepEqual(weekDays('2026-01-01'),['2025-12-29','2025-12-30','2025-12-31','2026-01-01','2026-01-02','2026-01-03','2026-01-04']);});
test('Local date shifts remain correct over DST and leap day',()=>{assert.equal(shiftDay('2024-02-28',1),'2024-02-29');assert.equal(shiftDay('2026-03-08',1),'2026-03-09');assert.equal(shiftDay('2026-11-01',-1),'2026-10-31');});
test('Calendar rejects impossible or path-shaped dates',()=>{for(const day of ['2026-02-29','2026-13-01','../2026-09-07','2026-00-01'])assert.throws(()=>dateOf(day));assert.throws(()=>monthGrid('2026-99'));});
test('Journal candidates prefer year/month but retain legacy path',()=>{assert.deepEqual(journalPaths('2026-09-07','日记'),['日记/2026/09/2026-09-07.md','日记/2026-09-07.md']);});
test('Review links target existing sources; does not include fictitious days',()=>{const s=reviewContent('月回顾',[{day:'2026-09-07',path:'日记/2026/09/2026-09-07.md'}]);assert.ok(s.includes('[[日记/2026/09/2026-09-07.md|2026-09-07]]'));assert.ok(!s.includes('2026-09-08'));assert.ok(s.includes('## 下一步'));});
test('Quick task appends without changing prior Markdown and rejects empty/multiline',()=>{const original='# 想法\n\n**保留**\n- [x] 完成';assert.equal(appendJournalTask(original,' 待办 '),original+'\n\n## 今日任务\n\n- [ ] 待办\n');assert.throws(()=>appendJournalTask(original,' '));assert.throws(()=>appendJournalTask(original,'一\n二'));});

test('ISO weeks use the Thursday year, including week 53',async()=>{const {isoWeek}=await import('../src/calendar-tools');assert.deepEqual(isoWeek('2021-01-01'),{year:2020,week:53});assert.deepEqual(isoWeek('2025-12-29'),{year:2026,week:1});assert.deepEqual(isoWeek('2026-09-07'),{year:2026,week:37});});
test('Period specifications cover the clicked week, month and full year',async()=>{const {periodSpec}=await import('../src/calendar-tools');const week=periodSpec('week','2025-12-29');assert.equal(week.title,'2026-W01 周记');assert.equal(week.year,'2026');assert.equal(week.legacyTitle,'2025-12-29 周回顾');assert.equal(periodSpec('year','2024-06-01').days.length,366);assert.equal(periodSpec('year','2025-06-01').days.length,365);assert.equal(periodSpec('month','2026-09-21').title,'2026-09 月记');});

test('Journal previews hide managed comments and full link paths while retaining labels',async()=>{const {journalExcerpt}=await import('../src/calendar-tools');const text='# 2026-09-08\n\n<!-- thoughtspace:created-notes:start -->\n## 当日新建笔记\n- [[长目录/笔记.md|阅读摘录]]\n<!-- thoughtspace:created-notes:end -->';const excerpt=journalExcerpt(text);assert.ok(excerpt.includes('阅读摘录'));assert.ok(!excerpt.includes('thoughtspace:'));assert.ok(!excerpt.includes('长目录'));assert.ok(!excerpt.includes('2026-09-08'));});

test('Keyboard month and year movement clamps leap days and month ends',async()=>{const {calendarKeyDay:k}=await import('../src/calendar-tools');assert.equal(k('2024-01-31','PageDown'),'2024-02-29');assert.equal(k('2024-02-29','PageDown',true),'2025-02-28');assert.equal(k('2026-01-31','PageUp'),'2025-12-31');});
test('Keyboard week edges and arrows cross ISO year without selecting a note',async()=>{const {calendarKeyDay:k}=await import('../src/calendar-tools');assert.equal(k('2026-01-01','Home'),'2025-12-29');assert.equal(k('2026-01-01','End'),'2026-01-04');assert.equal(k('2026-01-01','ArrowLeft'),'2025-12-31');assert.equal(k('2026-01-01','Enter'),undefined);});
test('Record navigation skips missing days, invalid dates and duplicates',async()=>{const {adjacentJournalDay:a}=await import('../src/calendar-tools');const days=['2026-09-03','2026-09-01','2026-09-03','2026-02-30','bad','2026-08-01'];assert.equal(a(days,'2026-09-01',1),'2026-09-03');assert.equal(a(days,'2026-09-01',-1),'2026-08-01');assert.equal(a(days,'2026-09-03',1),undefined);assert.equal(a(days,'2026-08-01',-1),undefined);});

test('Displayed calendar uses four, five or six complete weeks without losing month dates',async()=>{
 const {monthDisplayGrid,monthDays,dateOf}=await import('../src/calendar-tools');
 for(const [month,count] of [['2021-02',28],['2026-09',35],['2026-08',42],['2024-02',35]] as const){
  const dates=monthDisplayGrid(month);assert.equal(dates.length,count);assert.equal(dateOf(dates[0]).getDay(),1);assert.equal(dateOf(dates.at(-1)!).getDay(),0);assert.deepEqual(dates.filter(d=>d.startsWith(month)),monthDays(month));
 }
});
