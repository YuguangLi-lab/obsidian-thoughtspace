#!/usr/bin/env python3
"""Install Folio assets and retain explicit Style Settings choices.

Use with Obsidian closed or Style Settings disabled: the plugin caches data.json
in memory. Importing this module does not read or change a vault. prepare_install
is read-only; execute_install is the mutation boundary for integration callers.
"""
import argparse
from dataclasses import dataclass
import datetime
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile

SOURCE = Path(__file__).resolve().parents[1]
SECTION_ID = 'folio-atelier'
NEW_INSTALL_DEFAULTS = {
    'atelier-task-labels': True,
    'atelier-colored-folders': True,
}


def json_object(data, label):
    """Reject invalid data rather than replacing a user's settings."""
    try:
        value = json.loads(data.decode('utf-8-sig'))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f'Invalid {label}: {error}') from error
    if not isinstance(value, dict):
        raise ValueError(f'{label} must contain a JSON object')
    return value


def folio_defaults(css):
    """Read our two boolean controls from Folio's installed metadata.

    This uses the theme's own simple YAML subset without a runtime dependency.
    A recognised old theme without a control has an effective default of false.
    A malformed existing default is an error.
    """
    for match in re.finditer(r'/\*\s*@settings\b(.*?)\*/', css, re.S):
        block = match.group(1)
        if not re.search(r'(?m)^id:\s*folio-atelier\s*$', block):
            continue
        items = list(re.finditer(r'(?m)^([ \t]+)-\s+id:\s*([\w-]+)\s*$', block))
        defaults = {}
        for index, item in enumerate(items):
            setting_id = item.group(2)
            if setting_id not in NEW_INSTALL_DEFAULTS:
                continue
            end = items[index + 1].start() if index + 1 < len(items) else len(block)
            fields = block[item.end():end]
            kind = re.search(r'(?m)^[ \t]+type:\s*class-toggle\s*$', fields)
            default = re.search(r'(?m)^[ \t]+default:\s*(true|false)\s*(?:#.*)?$', fields)
            if not kind or not default or setting_id in defaults:
                raise ValueError(f'Invalid or duplicate old Folio setting: {setting_id}')
            defaults[setting_id] = default.group(1) == 'true'
        return defaults
    return None


def migrate_settings(existing, old_defaults):
    """Preserve every explicit value, including false and unrelated namespaces."""
    merged = dict(existing)
    additions = {}
    for setting_id, new_default in NEW_INSTALL_DEFAULTS.items():
        key = f'{SECTION_ID}@@{setting_id}'
        if key in merged:
            continue
        value = new_default if old_defaults is None else old_defaults.get(setting_id, False)
        merged[key] = value
        additions[key] = value
    return merged, additions


def read_optional(path):
    return path.read_bytes() if path.exists() else None


@dataclass
class InstallPlan:
    source: Path
    vault: Path
    name: str
    target: Path
    old_version: str | None
    old_defaults: dict | None
    old_theme_assets: dict
    settings_path: Path
    settings_before: bytes | None
    settings_after: dict
    settings_additions: dict
    theme_assets: dict
    presets: dict

    def summary(self):
        return {
            'vault': str(self.vault),
            'installed': str(self.target),
            'isUpgrade': self.old_defaults is not None,
            'oldVersion': self.old_version,
            'styleSettings': {
                'path': str(self.settings_path),
                'addedValues': self.settings_additions,
                'existingValuesPreserved': True,
                'oldDefaults': self.old_defaults,
                'runtimeReloadRequired': bool(self.settings_additions),
            },
            'presetsInstalledNotEnabled': [Path(name).stem for name in self.presets],
            'sha256': {name: hashlib.sha256(data).hexdigest()
                       for name, data in self.theme_assets.items()},
        }


def prepare_install(vault, source=SOURCE):
    """Read and validate a proposed install without creating files."""
    vault, source = Path(vault).expanduser().resolve(), Path(source).resolve()
    config = vault / '.obsidian'
    if not config.is_dir():
        raise ValueError(f'Not an existing Obsidian vault: {vault}')
    assets = {name: (source / name).read_bytes() for name in ('manifest.json', 'theme.css')}
    manifest = json_object(assets['manifest.json'], 'source theme manifest')
    name = manifest.get('name')
    if name != 'Folio Atelier' or folio_defaults(assets['theme.css'].decode('utf-8')) is None:
        raise ValueError('Source assets are not a recognised Folio Atelier theme')
    target = config / 'themes' / name
    old_assets = {filename: read_optional(target / filename) for filename in assets}
    old_defaults, old_version = None, None
    if any(value is not None for value in old_assets.values()):
        if any(value is None for value in old_assets.values()):
            raise ValueError(f'Incomplete existing Folio theme; refusing to infer defaults: {target}')
        old_manifest = json_object(old_assets['manifest.json'], 'installed theme manifest')
        old_defaults = folio_defaults(old_assets['theme.css'].decode('utf-8'))
        if old_manifest.get('name') != name or old_defaults is None:
            raise ValueError(f'Existing target is not a recognised Folio theme: {target}')
        old_version = old_manifest.get('version')
    elif target.exists() and any(target.iterdir()):
        raise ValueError(f'Unrecognised existing theme directory: {target}')
    settings_path = config / 'plugins' / 'obsidian-style-settings' / 'data.json'
    settings_before = read_optional(settings_path)
    existing = {} if settings_before is None else json_object(settings_before, 'Style Settings data')
    merged, additions = migrate_settings(existing, old_defaults)
    presets = {p.name: p.read_bytes() for p in sorted((source / 'presets').glob('folio-*.css'))}
    return InstallPlan(source, vault, name, target, old_version, old_defaults,
                       old_assets, settings_path, settings_before, merged, additions,
                       assets, presets)


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temp:
            staged = Path(temp.name)
            temp.write(data)
            temp.flush()
        staged.replace(path)
        assert path.read_bytes() == data
    finally:
        if staged is not None and staged.exists():
            staged.unlink()


def execute_install(plan):
    """Apply a prepared plan; callers can add plugin installation after this.

    The snapshot check catches a settings save between planning and installation.
    It cannot stop a running Style Settings instance saving stale cached values
    afterward, hence the offline requirement documented above and in --help.
    """
    if read_optional(plan.settings_path) != plan.settings_before:
        raise ValueError('Style Settings changed after planning; prepare a fresh install')
    for name, old_data in plan.old_theme_assets.items():
        if read_optional(plan.target / name) != old_data:
            raise ValueError('Installed theme changed after planning; prepare a fresh install')
    config = plan.vault / '.obsidian'
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup = config / 'atelier-backups' / stamp
    backup.mkdir(parents=True)
    if plan.target.exists():
        shutil.copytree(plan.target, backup / 'theme')
    if (config / 'appearance.json').exists():
        shutil.copy2(config / 'appearance.json', backup / 'appearance.json')
    if plan.settings_before is not None:
        path = backup / 'plugins' / 'obsidian-style-settings' / 'data.json'
        path.parent.mkdir(parents=True)
        path.write_bytes(plan.settings_before)
    for name in plan.presets:
        existing = config / 'snippets' / name
        if existing.exists():
            (backup / 'snippets').mkdir(exist_ok=True)
            shutil.copy2(existing, backup / 'snippets' / name)
    migration = {'isUpgrade': plan.old_defaults is not None, 'oldVersion': plan.old_version,
                 'styleSettingsOriginallyExisted': plan.settings_before is not None,
                 'oldDefaults': plan.old_defaults, 'addedValues': plan.settings_additions}
    atomic_write(backup / 'migration.json', (json.dumps(migration, ensure_ascii=False, indent=2) + '\n').encode())
    hashes = {str(p.relative_to(backup)): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in backup.rglob('*') if p.is_file()}
    atomic_write(backup / 'SHA256.json', (json.dumps(hashes, indent=2) + '\n').encode())
    # Materialise the old effective defaults before installing new metadata.
    if plan.settings_additions:
        if read_optional(plan.settings_path) != plan.settings_before:
            raise ValueError(f'Style Settings changed during backup; theme not replaced; backup: {backup}')
        data = (json.dumps(plan.settings_after, ensure_ascii=False, indent=2) + '\n').encode()
        atomic_write(plan.settings_path, data)
    for name, data in plan.theme_assets.items():
        atomic_write(plan.target / name, data)
    for name, data in plan.presets.items():
        atomic_write(config / 'snippets' / name, data)
    result = plan.summary()
    result['backup'] = str(backup)
    result['dryRun'] = False
    return result


def install_theme(vault, source=SOURCE, dry_run=False):
    plan = prepare_install(vault, source)
    if dry_run:
        return dict(plan.summary(), dryRun=True, backup=None)
    return execute_install(plan)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('vault', type=Path, help='Existing Obsidian vault directory')
    parser.add_argument('--dry-run', action='store_true', help='Show the plan without changing any files')
    args = parser.parse_args(argv)
    try:
        result = install_theme(args.vault, dry_run=args.dry_run)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
