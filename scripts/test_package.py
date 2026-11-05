"""Exercise the actual packager only in temporary synthetic repositories."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


SOURCE = Path(__file__).resolve().parent.parent
RUNTIME = ('main.js', 'manifest.json', 'styles.css')
INSTALL_FILES = (*RUNTIME, 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README-INSTALL.txt')


class InstallPackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / 'scripts').mkdir()
        shutil.copyfile(SOURCE / 'scripts/package.py', self.root / 'scripts/package.py')
        self.set_version('1.2.3-beta.1')
        (self.root / 'main.js').write_bytes(b'// synthetic runtime\r\nconst value = "exact";\n')
        (self.root / 'styles.css').write_bytes('/* 自制 */\r\n.x { color: #123456; }\n'.encode())
        (self.root / 'LICENSE').write_bytes(b'Synthetic project license\n')
        (self.root / 'THIRD_PARTY_NOTICES.md').write_bytes(b'Synthetic complete notices\n')
        shutil.copyfile(SOURCE / 'README-INSTALL.txt', self.root / 'README-INSTALL.txt')

    def set_version(self, version, package_version=None):
        (self.root / 'manifest.json').write_text(json.dumps({'id': 'thoughtspace', 'version': version}) + '\n')
        (self.root / 'package.json').write_text(json.dumps({'name': 'synthetic', 'version': package_version or version}) + '\n')

    def package(self, success=True):
        result = subprocess.run([sys.executable, str(self.root / 'scripts/package.py')],
                                cwd=self.root, capture_output=True, text=True, timeout=10)
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        return result

    def assert_package(self, version, result):
        dist = self.root / 'dist'
        archive = dist / f'thoughtspace-{version}.zip'
        expected = ['thoughtspace/' + name for name in INSTALL_FILES]
        with zipfile.ZipFile(archive) as package:
            self.assertIsNone(package.testzip())
            self.assertEqual(package.namelist(), expected)
            self.assertEqual(len(package.namelist()), len(set(package.namelist())))
            for name in INSTALL_FILES:
                self.assertEqual(package.read('thoughtspace/' + name), (self.root / name).read_bytes())
            self.assertEqual(json.loads(package.read('thoughtspace/manifest.json'))['version'], version)
        for name in RUNTIME:
            self.assertEqual((dist / name).read_bytes(), (self.root / name).read_bytes())
        assets = [archive.name, *RUNTIME]
        self.assertEqual((dist / 'SHA256SUMS.txt').read_text(), ''.join(
            f'{hashlib.sha256((dist / name).read_bytes()).hexdigest()}  {name}\n' for name in assets))
        self.assertEqual(result, {'version': version, 'assets': [*assets, 'SHA256SUMS.txt']})

    def test_exact_install_allowlist_excludes_screenshots_data_and_full_docs(self):
        extras = ['data.json', '.obsidian/workspace.json', 'vault/private.md',
                  'collection-drafts/unfinished.json', 'README.md', 'README.zh-CN.md',
                  'docs/USER-GUIDE.md', 'qa/RELEASE-1.2.3-beta.1.md',
                  *[f'qa/assets/mobile-beta2/{name}-SIMULATION.png' for name in
                    ('brain-short-reopen', 'media-short-save', 'writing-fallback',
                     'recovery-copy', 'ipad-brain-500', 'ipad-handwriting-reopen')]]
        for name in extras:
            file = self.root / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(b'PRIVATE-SYNTHETIC-SENTINEL\x00')
        before = {name: (self.root / name).read_bytes() for name in extras}
        self.assert_package('1.2.3-beta.1', self.package())
        self.assertEqual(before, {name: (self.root / name).read_bytes() for name in extras})
        readme = (self.root / 'README-INSTALL.txt').read_text()
        self.assertNotIn(str(self.root), readme)
        self.assertNotIn('/Users/', readme)
        for language in ('', '.zh-CN'):
            self.assertIn('https://github.com/YuguangLi-lab/obsidian-thoughtspace/blob/main/docs/USER-GUIDE' + language + '.md', readme)

    def test_minimal_fixture_needs_no_repository_docs_and_preserves_versions(self):
        for version in ('1.2.3', '1.2.3-beta.1', '1.2.3-beta.1+build.00'):
            with self.subTest(version=version):
                self.set_version(version)
                self.assert_package(version, self.package())

    def test_repack_replaces_archive_members_and_checksums_not_unrelated_dist_files(self):
        dist = self.root / 'dist'
        dist.mkdir()
        extra = dist / 'old-local-screenshot.png'
        extra.write_bytes(b'preserve local-only file')
        with zipfile.ZipFile(dist / 'thoughtspace-1.2.3-beta.1.zip', 'w') as old:
            old.writestr('thoughtspace/old-private-note.md', b'not an installation file')
        (dist / 'SHA256SUMS.txt').write_text('old and invalid\n')
        self.assert_package('1.2.3-beta.1', self.package())
        self.assertEqual(extra.read_bytes(), b'preserve local-only file')

    def test_missing_each_install_file_fails_before_dist_is_created(self):
        for name in INSTALL_FILES:
            with self.subTest(name=name):
                file = self.root / name
                data = file.read_bytes()
                file.unlink()
                try:
                    self.package(success=False)
                    self.assertFalse((self.root / 'dist').exists())
                finally:
                    file.write_bytes(data)

    def test_version_mismatch_fails_before_outputs(self):
        self.set_version('1.2.3-beta.1', '1.2.3')
        self.package(success=False)
        self.assertFalse((self.root / 'dist').exists())

    def test_version_path_separators_fail_before_outputs(self):
        for version in ('../1.2.3', 'bad\\1.2.3'):
            with self.subTest(version=version):
                self.set_version(version)
                self.package(success=False)
                self.assertFalse((self.root / 'dist').exists())


if __name__ == '__main__':
    unittest.main()
