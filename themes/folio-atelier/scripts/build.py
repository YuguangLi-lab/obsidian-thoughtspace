"""Inline Folio's local CSS modules into the single installable theme."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
source = (root / 'src/folio.css').read_text()
modules = []
EXPECTED_MODULES = ['palette.css', 'thoughtspace-current.css',
                    'atelier-foundation.css', 'atelier-native-ui.css',
                    'atelier-thoughtspace-ui.css', 'atelier-surface-modes.css']
def inline(match):
    name = match.group(1)
    assert name in EXPECTED_MODULES, name
    modules.append(name)
    return (root / 'src' / name).read_text()
source = re.sub(r'/\* @folio-source ([\w-]+\.css) \*/', inline, source)
assert modules == EXPECTED_MODULES, modules
assert '@folio-source' not in source
for forbidden in ('baseline-style', 'layout-baseline', 'vendor/', '@font-face', '@import'):
    assert forbidden not in source, f'Unexpected external dependency: {forbidden}'
assert not re.search(r'url\(["\x27]?https?://', source)
(root / 'theme.css').write_text(source)
print(f'Built Folio theme: {len(source.encode())} bytes; local modules: {", ".join(modules)}')
