#!/usr/bin/env python3
"""Install the protected local ThoughtSpace 1.3.35-folio.8 integration offline.

Close Obsidian or disable ThoughtSpace first. Importing this module performs no
vault I/O. Only three runtime files are replaced; settings and registry remain.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import shutil

from install import atomic_write, json_object

ARTIFACT = Path(__file__).resolve().parents[1] / 'integrations' / 'thoughtspace-folio'
FILES = ('main.js', 'styles.css', 'manifest.json')
VERSION = '1.3.35-folio.8'
PREDECESSOR_VERSION = '1.3.35-folio.7'
PREDECESSOR_ORIGIN_SHA256 = '288c6fd62a16cc501453420ce3681a0aae80485f3d6ffec69f0714052bb581c6'
PREDECESSOR_SHA256 = {'main.js': '96f2c44121fa6fb91867e8a02ab63af22b62248e3f9541e25ec3615e35b6f961',
 'styles.css': '856137bc3dd1bcd0241545078dddf338bb4d6ac05b54f9971b9092d3adbb5051',
 'manifest.json': '0f975263ec1d9500f183be3b51a64b1e390d52d4903b513b5921c08c6de4a3c9'}
COMPATIBLE_PREDECESSORS = [{'version': '1.3.35-folio.1',
  'originSHA256': '9dfdfd831015c6aac0e353d89def89fdf22667a6793d9d0f31c2d00676a276e0',
  'sha256': {'main.js': '49268861d049f18a11251ebbb93d8f59078aeb9496ff209df039e4ccf7f62421',
             'styles.css': '680f330cc19f42320f7100eb3c1b59aa4c166a8f143765a23e170f8de7deadb8',
             'manifest.json': '8c6395b11b2b557a7d146db79d8d786105bc90319fb4a5d6bec4c05d0d89ddd7'}},
 {'version': '1.3.35-folio.2',
  'originSHA256': 'cec0681e063d75a152e38f14c30a32386ad9e1e0ed29995c90fa456ef46b635e',
  'sha256': {'main.js': 'b1c1c9e5d5bc4e9f2b979473a7feb55045c898911f60e5af43eaaa71534f0887',
             'styles.css': '680f330cc19f42320f7100eb3c1b59aa4c166a8f143765a23e170f8de7deadb8',
             'manifest.json': 'c037622fcbe6ff4a9fb5ba4ccef91219680dba2d891bb9f269313f5005f6a77f'}},
 {'version': '1.3.35-folio.3',
  'originSHA256': '0aa68d4d5d7373bd5bb257fd1cbf2d6986448ac5465aaabe25f232edaaa8aed4',
  'sha256': {'main.js': 'd15e574dce42449435d28167279887e6ac9f67750e0f45654c8acb7368ec3c58',
             'styles.css': '680f330cc19f42320f7100eb3c1b59aa4c166a8f143765a23e170f8de7deadb8',
             'manifest.json': '1e9be89a1e0b8a30dfc725d807869500c1c475136c834a321b5ad1423b7dda98'}},
 {'version': '1.3.35-folio.4',
  'originSHA256': 'd37bc137ad7d1870314326caff85d4d5715e256fc125f44e343a01aa740f838d',
  'sha256': {'main.js': '2b83531c172e5e290b8f068a79043dcd7b1b779a902d20e61377294ba8d38e76',
             'styles.css': '0dd015a971e0d8e42206567626f822279bc5b7cfa85a50cb3f78a53d7e491735',
             'manifest.json': '8a1404383a486d3a4a42cc41f542be3f8a12df6651fd50b574101e282052db1d'}},
 {'version': '1.3.35-folio.5',
  'originSHA256': 'eda582605bd010c201e4174e59a7f21ab505af64b9071dbc3b512186482a27d0',
  'sha256': {'main.js': '8ee2bddf04014aa6329b6c096f4a1dd53a3bfae280add2097a7c9117951d90d5',
             'styles.css': 'd83ecfff9581a0851e74b664c2949e200eef83c462406f5a5c80f691441629dc',
             'manifest.json': 'a97fbd9e447890e4a36ec6e4da6b7ecf9715d4d06668b8350fa41e95c99fa329'}},
 {'version': '1.3.35-folio.6',
  'originSHA256': '0f4026549c4148c3d031b6e484e2a853ba8661ec6cc50ed4658fd76dd7588a7a',
  'sha256': {'main.js': 'eea430aaf7fe7d0f1d63b9dfd05d00980541c29b9b39b7e4ff05e89cf898f407',
             'styles.css': 'd915b9052f4aca627bb0d7524f0b7082fd89c2bda496df8e0db5d3f6048a42e0',
             'manifest.json': '5964270d56fbae71bd67886ff4ddbb7054a6c7567f570b235b0b10df0dea949d'}}]
# Exact final build. Offline synthetic tests override these only in their own
# temporary process, never in a shipped artifact or an actual vault.
INTEGRATED_SHA256 = {'main.js': '705c7bc93ce4db6d9c9fed08c0dc309e4694d2f275c5c01e28a787ccf2b9a9b7',
 'styles.css': '51c6b4794a088a4f7afb4582b135fceb7750afbaf05b74cacca3bccf4e82e821',
 'manifest.json': '3611c119ba15c4d07a24be41470fff53b9d3cb16a4706fa8335984fd14775baf'}
INTEGRATED_ORIGIN_SHA256 = '5a3057e7b9262c10aec50fdaffa060150822eb366efda6ffbb5c6f33ecc80474'
BASE_COMMIT = '9f6b4b8e6bf66409ef320796462a74a0f4931fe8'
BASE_MAIN_SHA256 = (
    'c24a7c77a7222ffa596b6a2aed4130a11828911d40f455980e7ec96674e2f837',
    '016a9ec167088b0fc46647e98f7dd63be4d00f7bb9adfeebb5ba9aecf919d40a',
)
BASE_SHA256 = {
    'main.js': BASE_MAIN_SHA256[0],
    'styles.css': '680f330cc19f42320f7100eb3c1b59aa4c166a8f143765a23e170f8de7deadb8',
    'manifest.json': 'a3e545ca0ef928a231ccc84b1a2ef3b95ad8f505992c3759f79fa08f68c06ca4',
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def validate_origin(origin, data):
    """Bind the predecessor to constants, never an arbitrary supplied allowlist."""
    if (origin.get('baseTag') != '1.3.35'
            or origin.get('baseCommit') != BASE_COMMIT
            or origin.get('baseSHA256') != BASE_SHA256
            or origin.get('baseMainSHA256') != list(BASE_MAIN_SHA256)
            or origin.get('predecessorVersion') != PREDECESSOR_VERSION
            or origin.get('predecessorOriginSHA256') != PREDECESSOR_ORIGIN_SHA256
            or origin.get('predecessorSHA256') != PREDECESSOR_SHA256
            or origin.get('compatiblePredecessors') != COMPATIBLE_PREDECESSORS):
        raise ValueError('Integration origin does not identify the protected base and supported folio predecessors')
    actual = {name: digest(data[name]) for name in FILES}
    if not INTEGRATED_SHA256 or actual != INTEGRATED_SHA256:
        raise ValueError('Integration assets differ from the fixed folio.8 build')
    if origin.get('integratedSHA256') != actual:
        raise ValueError('Integration asset checksums do not match origin.json')


def prepare(vault, source=ARTIFACT):
    """Read and validate everything before permitting a replacement."""
    vault, source = Path(vault).expanduser().resolve(), Path(source).resolve()
    if not (vault / '.obsidian').is_dir():
        raise ValueError('An existing Obsidian vault is required')
    data = {name: (source / name).read_bytes() for name in FILES}
    manifest = json_object(data['manifest.json'], 'integration manifest')
    origin_bytes = (source / 'origin.json').read_bytes()
    if not INTEGRATED_ORIGIN_SHA256 or digest(origin_bytes) != INTEGRATED_ORIGIN_SHA256:
        raise ValueError('Integration origin differs from the fixed folio.8 origin')
    origin = json_object(origin_bytes, 'integration origin')
    if (manifest.get('id') != 'thoughtspace' or manifest.get('version') != VERSION
            or manifest.get('minAppVersion') != '1.13.7'):
        raise ValueError('Unexpected integration identity/version; no plugin was replaced')
    validate_origin(origin, data)
    target = vault / '.obsidian' / 'plugins' / 'thoughtspace'
    old = {name: (target / name).read_bytes() for name in FILES}
    old_manifest = json_object(old['manifest.json'], 'installed ThoughtSpace manifest')
    old_version = old_manifest.get('version')
    if old_manifest.get('id') != 'thoughtspace':
        raise ValueError('Installed assets belong to a different plugin')
    if old_version == PREDECESSOR_VERSION:
        valid = all(digest(old[name]) == PREDECESSOR_SHA256[name] for name in FILES)
    elif old_version in {item['version'] for item in COMPATIBLE_PREDECESSORS}:
        pins = next(item['sha256'] for item in COMPATIBLE_PREDECESSORS if item['version'] == old_version)
        valid = all(digest(old[name]) == pins[name] for name in FILES)
    elif old_version == VERSION:
        valid = old == data
    else:
        raise ValueError('Unsupported installed ThoughtSpace version; no downgrade or overwrite was attempted')
    if not valid:
        raise ValueError('Installed plugin differs from its protected identity; custom changes were preserved')
    return {'target': target, 'source': source, 'assets': data, 'before': old,
            'oldVersion': old_version, 'version': VERSION, 'origin': origin}


def install_plugin(vault, source=ARTIFACT, dry_run=False):
    plan = prepare(vault, source)
    result = {'installed': str(plan['target']), 'oldVersion': plan['oldVersion'],
              'version': VERSION, 'dryRun': dry_run,
              'unchanged': plan['before'] == plan['assets'],
              'sha256': {name: digest(data) for name, data in plan['assets'].items()}}
    if dry_run or result['unchanged']:
        return result
    target = plan['target']
    for name, data in plan['before'].items():
        if (target / name).read_bytes() != data:
            raise ValueError('Plugin changed after planning; retry with a fresh plan')
    backup = target.parents[1] / 'atelier-backups' / (
        'thoughtspace-folio-8-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    saved = backup / 'thoughtspace'
    saved.mkdir(parents=True)
    for name in (*FILES, 'data.json', 'folio-project-colors.json'):
        path = target / name
        if path.exists():
            shutil.copy2(path, saved / name)
    atomic_write(backup / 'SHA256.json', (json.dumps(
        {str(p.relative_to(backup)): digest(p.read_bytes()) for p in saved.iterdir()}, indent=2) + '\n').encode())
    for name, data in plan['before'].items():
        if (target / name).read_bytes() != data:
            raise ValueError('Plugin changed during backup; plugin was not replaced')
    changed = []
    try:
        for name in FILES:
            changed.append(name)
            atomic_write(target / name, plan['assets'][name])
    except Exception as error:
        rollback_errors = []
        for name in changed:
            try:
                atomic_write(target / name, plan['before'][name])
            except Exception as rollback_error:
                rollback_errors.append(f'{name}: {rollback_error}')
        if rollback_errors:
            raise OSError(f'Plugin installation failed: {error}; rollback errors: '
                          + '; '.join(rollback_errors) + f'; original assets remain in backup: {backup}') from error
        raise
    result['backup'] = str(backup)
    result['reloadRequired'] = True
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('vault', type=Path)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args(argv)
    try:
        result = install_plugin(args.vault, dry_run=args.dry_run)
    except (OSError, ValueError, KeyError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
