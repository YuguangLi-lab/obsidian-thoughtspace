"""Check tag/manifest consistency and prepare release notes from the changelog."""
import json
import os
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
tag = os.environ['RELEASE_TAG']
if not re.fullmatch(r'\d+\.\d+\.\d+', tag):
    raise SystemExit('Release tag must be an exact stable version, without a v prefix')
manifest = json.loads((root / 'manifest.json').read_text())
package = json.loads((root / 'package.json').read_text())
lock = json.loads((root / 'package-lock.json').read_text())
versions = json.loads((root / 'versions.json').read_text())
if not (manifest['version'] == package['version'] == lock['version'] == lock['packages']['']['version'] == tag):
    raise SystemExit('Tag, manifest, package and lockfile versions must match')
if versions.get(tag) != manifest['minAppVersion']:
    raise SystemExit('versions.json must map this version to its minimum Obsidian version')
changelog = (root / 'CHANGELOG.md').read_text()
entry = re.search(r'^## ' + re.escape(tag) + r'\s*\n(.*?)(?=^## |\Z)', changelog, re.M | re.S)
if not entry or not entry.group(1).strip():
    raise SystemExit('Missing release changelog entry')
notes = entry.group(1).strip() + '\n\n'
notes += 'Install or update with `main.js`, `manifest.json`, and `styles.css`; keep your existing `data.json`.\n'
notes += '安装或升级时替换这三个运行文件，保留已有 `data.json`。本次发布附带 GitHub 构建来源证明。\n'
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'release-notes.md').write_text(notes)
print('Release metadata verified:', tag)
