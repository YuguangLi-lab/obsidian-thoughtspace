"""Exercise release metadata in disposable repositories, without publication."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from release_version import is_prerelease

SCRIPTS = Path(__file__).resolve().parent


class ReleaseVersionTests(unittest.TestCase):
    def test_valid_stable_and_prerelease_semver(self):
        for tag, prerelease in (
            ('0.0.0', False), ('1.3.35', False), ('1.3.36-beta.1', True),
            ('1.0.0-0.3.7', True), ('1.0.0-x-y-z.--', True),
            ('1.0.0-01a', True), ('1.0.0-beta+001', True),
            ('1.0.0+001', False), ('1.0.0+build-with-hyphen', False),
        ):
            with self.subTest(tag=tag):
                self.assertIs(is_prerelease(tag), prerelease)

    def test_invalid_tags_are_rejected(self):
        for tag in (
            'v1.3.36-beta.1', 'v1.3.35', '01.3.35', '1.03.35', '1.3.035',
            '1.3.36-', '1.3.36-beta.', '1.3.36-beta..1', '1.3.36-beta.01',
            '1.3.36-00', '1.3.36-beta_1', '1.3.36-beta.１',
            '1.3.36+', '1.3.36+build..1', '1.3.36-beta+build.',
            ' 1.3.36', '1.3.36\n', '1.3', '',
        ):
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                is_prerelease(tag)


class CheckReleaseTests(unittest.TestCase):
    def run_check(self, tag, *, metadata_version=None, changelog_tag=None):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'scripts').mkdir()
            for name in ('check-release.py', 'release_version.py'):
                (root / 'scripts' / name).write_text((SCRIPTS / name).read_text())
            version = metadata_version or tag
            manifest = {'version': version, 'minAppVersion': '1.5.0'}
            (root / 'manifest.json').write_text(json.dumps(manifest))
            (root / 'package.json').write_text(json.dumps({'version': version}))
            (root / 'package-lock.json').write_text(json.dumps({'version': version, 'packages': {'': {'version': version}}}))
            (root / 'versions.json').write_text(json.dumps({version: '1.5.0'}))
            (root / 'CHANGELOG.md').write_text(f'## {changelog_tag or tag}\n\nVerified release change.\n\n## 0.0.0\n\nOlder release.\n')
            environment = {**os.environ, 'RELEASE_TAG': tag, 'GITHUB_ENV': str(root / 'github-env')}
            result = subprocess.run([sys.executable, str(root / 'scripts' / 'check-release.py')], env=environment, capture_output=True, text=True, check=False)
            notes_path = root / 'dist' / 'release-notes.md'
            env_path = root / 'github-env'
            return result, notes_path.read_text() if notes_path.exists() else None, env_path.read_text() if env_path.exists() else None

    def test_stable_and_beta_metadata_generate_notes_and_channel(self):
        for tag, channel in (('1.3.35', 'false'), ('1.3.36-beta.1', 'true'), ('1.3.35+build-with-hyphen', 'false')):
            with self.subTest(tag=tag):
                result, notes, environment = self.run_check(tag)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('Verified release change.', notes)
                self.assertIn(f'/blob/{tag}/docs/USER-GUIDE.md', notes)
                self.assertEqual(environment, f'RELEASE_PRERELEASE={channel}\n')

    def test_invalid_tag_cannot_generate_notes_or_channel(self):
        for tag in ('v1.3.36-beta.1', '1.3.36-beta.01', '01.3.35', '1.3.36-beta..1'):
            with self.subTest(tag=tag):
                result, notes, environment = self.run_check(tag)
                self.assertNotEqual(result.returncode, 0)
                self.assertIsNone(notes)
                self.assertIsNone(environment)

    def test_beta_still_requires_exact_metadata_and_own_changelog(self):
        for options, error in (({'metadata_version': '1.3.35'}, 'versions must match'), ({'changelog_tag': '1.3.36'}, 'Missing release changelog')):
            with self.subTest(options=options):
                result, notes, environment = self.run_check('1.3.36-beta.1', **options)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(error, result.stderr)
                self.assertIsNone(notes)
                self.assertIsNone(environment)


if __name__ == '__main__':
    unittest.main()
