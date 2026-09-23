import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('verify_release', Path(__file__).with_name('verify-release.py'))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class PublicReleaseTests(unittest.TestCase):
    def setUp(self):
        self.expected = {name: b'test' for name in verify.RUNTIME}
        self.release = dict(tag_name='0.98.12', draft=False, prerelease=False,
                            html_url='https://github.com/example/repo/releases/tag/0.98.12',
                            assets=[dict(name=name, state='uploaded', size=4) for name in verify.RUNTIME])

    def test_complete_listing(self):
        verify.verify_listing(self.release, '0.98.12', self.expected)

    def test_tag_endpoint_with_empty_assets_is_not_success(self):
        self.release['assets'] = []
        with self.assertRaisesRegex(ValueError, 'main.js'):
            verify.verify_listing(self.release, '0.98.12', self.expected)

    def test_missing_each_runtime_asset(self):
        for name in verify.RUNTIME:
            with self.subTest(name=name):
                release = {**self.release, 'assets': [a for a in self.release['assets'] if a['name'] != name]}
                with self.assertRaisesRegex(ValueError, name):
                    verify.verify_listing(release, '0.98.12', self.expected)

    def test_wrong_version_draft_prerelease(self):
        for change in ({'tag_name': '0.98.11'}, {'draft': True}, {'prerelease': True}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                verify.verify_listing({**self.release, **change}, '0.98.12', self.expected)

    def test_partial_corrupt_or_duplicate_asset(self):
        for change in ({'size': 0}, {'state': 'starter'}, {'digest': 'sha256:wrong'}):
            release = {**self.release, 'assets': [{**self.release['assets'][0], **change}, *self.release['assets'][1:]]}
            with self.subTest(change=change), self.assertRaises(ValueError):
                verify.verify_listing(release, '0.98.12', self.expected)
        self.release['assets'].append(self.release['assets'][0])
        with self.assertRaises(ValueError):
            verify.verify_listing(self.release, '0.98.12', self.expected)

    def test_public_download_must_match_build(self):
        with patch.object(verify, 'fetch', side_effect=[verify.json.dumps(self.release).encode(), b'wrong']):
            with self.assertRaisesRegex(ValueError, 'download differs'):
                verify.verify_public('example/repo', '0.98.12', self.expected)

    def test_all_downloads_verified(self):
        with patch.object(verify, 'fetch', side_effect=[verify.json.dumps(self.release).encode(), b'test', b'test', b'test']):
            self.assertEqual(verify.verify_public('example/repo', '0.98.12', self.expected), self.release['html_url'])


if __name__ == '__main__':
    unittest.main()
