"""Package the current build only; never include vaults, settings, or local backups."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
manifest = json.loads((root / 'manifest.json').read_text())
version = manifest['version']
assert version == json.loads((root / 'package.json').read_text())['version']
assert '/' not in version and '\\' not in version
runtime = ['main.js', 'manifest.json', 'styles.css']
files = runtime + ['README.md', 'README.zh-CN.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']
for name in files:
    assert (root / name).is_file(), f'Missing {name}; run npm run build first'
dist.mkdir(exist_ok=True)
archive = dist / f'thoughtspace-{version}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in files:
        z.write(root / name, 'thoughtspace/' + name)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert set(z.namelist()) == {'thoughtspace/' + n for n in files}
    for name in files:
        assert z.read('thoughtspace/' + name) == (root / name).read_bytes()
for name in runtime:
    shutil.copy2(root / name, dist / name)
assets = [archive] + [dist / n for n in runtime]
(dist / 'SHA256SUMS.txt').write_text(''.join(
    f'{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.name}\n' for f in assets
))
print(json.dumps({'version': version, 'assets': [f.name for f in assets] + ['SHA256SUMS.txt']}, indent=2))
