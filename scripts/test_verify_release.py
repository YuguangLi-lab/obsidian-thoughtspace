import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
spec = importlib.util.spec_from_file_location('verify_release', Path(__file__).with_name('verify-release.py'))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)

VALID_TAGS = (
    ('0.0.0', False),
    ('1.2.3', False),
    ('123.456.789', False),
    ('1.2.3+build.00', False),
    ('1.2.3+00', False),
    ('0.99.0-beta.1', True),
    ('1.2.3-0', True),
    ('1.2.3-alpha.0', True),
    ('1.2.3-01a', True),
    ('1.2.3-alpha-beta', True),
    ('1.2.3--', True),
    ('1.2.3-rc.1+build.00', True),
)
INVALID_TAGS = (
    '', 'v1.2.3', '01.2.3', '1.02.3', '1.2.03', '1.2',
    '1.2.3-', '1.2.3+', '1.2.3-alpha..1', '1.2.3-alpha.01',
    '1.2.3-00', '1.2.3+build..1', '1.2.3-beta_1', '1.2.3-β',
    ' 1.2.3', '1.2.3 ', '1.2.3\n', '１.2.3',
)


class PublicReleaseTests(unittest.TestCase):
    def setUp(self):
        self.expected = {name: b'test' for name in verify.RUNTIME}
        self.release = dict(tag_name='0.98.12', draft=False, prerelease=False,
                            html_url='https://github.com/example/repo/releases/tag/0.98.12',
                            assets=[dict(name=name, state='uploaded', size=4) for name in verify.RUNTIME])

    def test_complete_listing(self):
        verify.verify_listing(self.release, '0.98.12', self.expected)

    def test_listing_prerelease_flag_matches_the_semver_tag(self):
        for tag, prerelease in VALID_TAGS:
            with self.subTest(tag=tag):
                release = {**self.release, 'tag_name': tag, 'prerelease': prerelease}
                verify.verify_listing(release, tag, self.expected)

    def test_listing_rejects_invalid_semver_even_when_the_tag_name_matches(self):
        for tag in INVALID_TAGS:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                verify.verify_listing({**self.release, 'tag_name': tag}, tag, self.expected)

    def test_listing_requires_exact_prerelease_boolean(self):
        for tag, prerelease in (('1.2.3', False), ('1.2.3-beta.1', True)):
            release = {**self.release, 'tag_name': tag, 'prerelease': prerelease}
            for wrong in (not prerelease, None, 0, 1, 'false', 'true', [], {}):
                with self.subTest(tag=tag, flag=wrong), self.assertRaises(ValueError):
                    verify.verify_listing({**release, 'prerelease': wrong}, tag, self.expected)
            del release['prerelease']
            with self.subTest(tag=tag, flag='missing'), self.assertRaises(ValueError):
                verify.verify_listing(release, tag, self.expected)

    def test_listing_requires_exact_false_draft_boolean(self):
        for tag, prerelease in (('1.2.3', False), ('1.2.3-beta.1', True)):
            for draft in (True, None, 0, 1, 'false', [], {}):
                release = {**self.release, 'tag_name': tag, 'prerelease': prerelease, 'draft': draft}
                with self.subTest(tag=tag, draft=draft), self.assertRaises(ValueError):
                    verify.verify_listing(release, tag, self.expected)

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

    def test_prerelease_verifies_its_exact_tag_endpoint_and_all_downloads(self):
        tag = '0.99.0-beta.1+build.00'
        release = {**self.release, 'tag_name': tag, 'prerelease': True,
                   'html_url': f'https://github.com/example/repo/releases/tag/{tag}'}
        with patch.object(verify, 'fetch', side_effect=[verify.json.dumps(release).encode(), b'test', b'test', b'test']) as fetch:
            self.assertEqual(verify.verify_public('example/repo', tag, self.expected), release['html_url'])
        self.assertEqual([call.args[0] for call in fetch.call_args_list], [
            f'https://api.github.com/repos/example/repo/releases/tags/{tag}',
            *[f'https://github.com/example/repo/releases/download/{tag}/{name}' for name in verify.RUNTIME],
        ])

    def test_prerelease_keeps_asset_and_download_validation(self):
        tag = '0.99.0-beta.1'
        release = {**self.release, 'tag_name': tag, 'prerelease': True}
        for change in ({'size': 0}, {'state': 'starter'}, {'digest': 'sha256:wrong'}):
            damaged = {**release, 'assets': [{**release['assets'][0], **change}, *release['assets'][1:]]}
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, 'asset|digest'):
                verify.verify_listing(damaged, tag, self.expected)
        with patch.object(verify, 'fetch', side_effect=[verify.json.dumps(release).encode(), b'wrong']):
            with self.assertRaisesRegex(ValueError, 'download differs'):
                verify.verify_public('example/repo', tag, self.expected)


class ReleaseCommandTests(unittest.TestCase):
    def test_main_accepts_full_semver_and_preserves_the_exact_tag(self):
        for tag, _prerelease in VALID_TAGS:
            expected = {name: b'test' for name in verify.RUNTIME}
            expected['manifest.json'] = verify.json.dumps({'version': tag}).encode()
            with self.subTest(tag=tag), patch.dict(verify.os.environ, {'RELEASE_TAG': tag, 'GITHUB_REPOSITORY': 'example/repo'}), \
                    patch.object(Path, 'read_bytes', autospec=True, side_effect=lambda path: expected[path.name]), \
                    patch.object(verify, 'verify_public', return_value='https://example.com/release') as public, patch('builtins.print'):
                verify.main()
                public.assert_called_once_with('example/repo', tag, expected)

    def test_main_rejects_invalid_semver_before_reading_assets_or_fetching(self):
        for tag in INVALID_TAGS:
            with self.subTest(tag=tag), patch.dict(verify.os.environ, {'RELEASE_TAG': tag, 'GITHUB_REPOSITORY': 'example/repo'}), \
                    patch.object(Path, 'read_bytes') as read, patch.object(verify, 'verify_public') as public:
                with self.assertRaisesRegex(SystemExit, 'Invalid release tag'):
                    verify.main()
                read.assert_not_called()
                public.assert_not_called()

    def test_main_still_rejects_invalid_repository_before_fetching(self):
        with patch.dict(verify.os.environ, {'RELEASE_TAG': '1.2.3-beta.1', 'GITHUB_REPOSITORY': 'example/repo/extra'}), \
                patch.object(Path, 'read_bytes') as read, patch.object(verify, 'verify_public') as public:
            with self.assertRaisesRegex(SystemExit, 'Invalid release tag or repository'):
                verify.main()
            read.assert_not_called()
            public.assert_not_called()


if __name__ == '__main__':
    unittest.main()
