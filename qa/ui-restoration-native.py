"""Read-only native layout checks against an already open board; restore UI state.
Usage: python3 qa/ui-restoration-native.py --vault VAULT --output dist/ui-native
No notes, cards or settings are saved or edited. Theme classes and viewport-sized
DOM surfaces are temporarily changed; all such state is restored in finally.
"""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--vault', required=True)
parser.add_argument('--output', default='dist/ui-native')
args = parser.parse_args()
output = Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
cli = ['/usr/local/bin/obsidian', 'vault=' + args.vault]

def evaluate(code):
    raw = subprocess.check_output(cli + ['eval', 'code=JSON.stringify(' + code + ')'], text=True)
    return json.loads(raw.split('=> ', 1)[1])

def check(name, actual, expected=True):
    checks.append(dict(name=name, passed=actual == expected, actual=actual, expected=expected))

checks = []
evaluate('''(()=>{
 const view=app.workspace.getLeavesOfType('thoughtspace-board')[0]?.view;
 if(!view||view.inline)throw Error('Open a board with no active card editor first');
 const root=view.contentEl,main=root.querySelector('.ts-main'),errors=[];const onError=e=>errors.push(e.message);window.addEventListener('error',onError);
 window.__thoughtspaceUiRestoration={view,root,main,errors,onError,rootStyle:root.getAttribute('style'),mainStyle:main.getAttribute('style'),
 dark:document.body.classList.contains('theme-dark'),light:document.body.classList.contains('theme-light'),
 selected:[...view.selected],edge:view.selectedEdge,appearance:view.appearanceTab,board:JSON.stringify(view.session.board)};
 return true;
})()''')
try:
    for theme in ('light', 'dark'):
        for label, width, height in [('desktop', None, None), ('narrow', 420, 620), ('short', 640, 230)]:
            code = '''(async()=>{
 const s=window.__thoughtspaceUiRestoration,{view,root,main}=s;
 for(const [el,style]of [[root,s.rootStyle],[main,s.mainStyle]]){if(style===null)el.removeAttribute('style');else el.setAttribute('style',style);}
 document.body.classList.toggle('theme-dark',THEME==='dark');document.body.classList.toggle('theme-light',THEME==='light');
 if(WIDTH!==null){root.style.setProperty('width',WIDTH+'px','important');root.style.setProperty('height',HEIGHT+'px','important');root.style.setProperty('flex','none','important');}
 const card=view.session.board.nodes.find(n=>n.kind==='card');view.selected=new Set(card?[card.id]:[]);view.selectedEdge=undefined;view.appearanceTab='card';view.updateSelection();
 await new Promise(resolve=>setTimeout(resolve,300));
 const host=getComputedStyle(document.body),roots=[root,...document.querySelectorAll('.ts-root.ts-dock')];
 const names=['--background-primary','--background-secondary','--text-normal','--text-muted','--font-text'];
 const inherited=roots.flatMap((r,i)=>names.map(name=>({root:i,name,host:host.getPropertyValue(name).trim(),value:getComputedStyle(r).getPropertyValue(name).trim()})));
 const bounds=sel=>{const el=main.querySelector(sel);return el?.getClientRects().length?el.getBoundingClientRect().toJSON():null;};
 const rail=bounds('.ts-board-rail'),stage=bounds('.ts-stage'),format=bounds('.ts-floating-formatbar'),footer=bounds('.ts-footer');
 const obstacle=view.cardToolbarObstacles[0],m=main.getBoundingClientRect();
 const buttons=[...root.querySelectorAll('.ts-format-mode-button')].map(el=>({label:el.getAttribute('aria-label'),visible:el.getClientRects().length>0}));
 return{inherited,rail,stage,format,footer,buttons,settled:!!obstacle&&Math.abs(obstacle.y-(rail.top-m.top-6))<1,cardStyles:[...root.querySelectorAll('.ts-card[data-card-style]')].map(el=>el.dataset.cardStyle)};
})()'''.replace('THEME', json.dumps(theme)).replace('WIDTH', json.dumps(width)).replace('HEIGHT', json.dumps(height))
            # CLI awaits a top-level promise, so stringify its result after it resolves.
            raw = subprocess.check_output(cli + ['eval', 'code=' + code + '.then(JSON.stringify)'], text=True)
            data = json.loads(raw.split('=> ', 1)[1])
            prefix = theme + '/' + label
            for item in data['inherited']:
                check(prefix + ': theme/font inheritance ' + str(item['root']) + '/' + item['name'], item['value'], item['host'])
            stage = data['stage']
            for name in ('rail', 'format', 'footer'):
                box = data[name]
                check(prefix + ': ' + name + ' within canvas', bool(box) and box['left'] >= stage['left'] - 1 and box['right'] <= stage['right'] + 1 and box['top'] >= stage['top'] - 1 and box['bottom'] <= stage['bottom'] + 1)
            check(prefix + ': settled toolbar avoidance position', data['settled'])
            check(prefix + ': selected card formatting visible', any(item['visible'] for item in data['buttons']))
            check(prefix + ': card styles retained', 'paper' in data['cardStyles'] and 'sticky' in data['cardStyles'])
            subprocess.run(cli + ['dev:screenshot', 'path=' + str(output / (prefix.replace('/', '-') + '.png'))], check=True, capture_output=True)
    sidebar = evaluate('''(()=>{
 const el=document.querySelector('.ts-root.ts-dock .ts-sidebar'),nav=el.querySelector('[role=tablist]'),tabs=[...nav.querySelectorAll('[role=tab]')].map(e=>e.getBoundingClientRect()),list=el.querySelector('.ts-library').getBoundingClientRect(),box=el.getBoundingClientRect();
 return{horizontal:tabs.length===4&&tabs.every((b,i)=>Math.abs(b.top-tabs[0].top)<1&&(!i||b.left>=tabs[i-1].right)),width:Math.abs(list.width-box.width)<1,orientation:nav.getAttribute('aria-orientation')};
})()''')
    check('Native sidebar tabs share one horizontal row', sidebar['horizontal'])
    check('Native sidebar content uses full width', sidebar['width'])
    check('Native sidebar keyboard orientation is horizontal', sidebar['orientation'], 'horizontal')
    check('No new native runtime or resize errors', evaluate('window.__thoughtspaceUiRestoration.errors'), [])
    unchanged = evaluate('JSON.stringify(window.__thoughtspaceUiRestoration.view.session.board)===window.__thoughtspaceUiRestoration.board')
    check('Board data unchanged by native layout inspection', unchanged)
finally:
    evaluate('''(()=>{
 const s=window.__thoughtspaceUiRestoration;if(!s)return false;window.removeEventListener('error',s.onError);
 for(const [el,style]of [[s.root,s.rootStyle],[s.main,s.mainStyle]]){if(style===null)el.removeAttribute('style');else el.setAttribute('style',style);}
 document.body.classList.toggle('theme-dark',s.dark);document.body.classList.toggle('theme-light',s.light);
 s.view.selected=new Set(s.selected);s.view.selectedEdge=s.edge;s.view.appearanceTab=s.appearance;s.view.updateSelection();
 delete window.__thoughtspaceUiRestoration;return true;
})()''')
    report=dict(scope='Native Obsidian DOM theme and layout checks; no note edits or persistence operations', checks=checks)
    (output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
failed = [c for c in checks if not c['passed']]
print(json.dumps(dict(passed=len(checks)-len(failed),failed=len(failed),failures=failed),ensure_ascii=False))
raise SystemExit(bool(failed))
