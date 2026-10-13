"""Run only the publication shell fragment with a harmless fake gh executable."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

WORKFLOW = Path(__file__).resolve().parent.parent / '.github' / 'workflows' / 'release.yml'


class ReleaseWorkflowTests(unittest.TestCase):
    def publish_command(self):
        text = WORKFLOW.read_text()
        step = text.split('      - name: Publish standard Obsidian assets\n', 1)[1].split('      - name:', 1)[0]
        run = step.split('        run:', 1)[1].strip()
        if run.startswith('|'):
            return '\n'.join(line[10:] for line in run.splitlines()[1:])
        return run

    def run_publish(self, tag, channel):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            gh = root / 'gh'
            gh.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$RELEASE_ARGS_FILE"\n')
            gh.chmod(0o755)
            arguments = root / 'arguments'
            environment = {**os.environ, 'PATH': str(root) + os.pathsep + os.environ['PATH'], 'RELEASE_TAG': tag, 'RELEASE_PRERELEASE': channel, 'RELEASE_ARGS_FILE': str(arguments)}
            result = subprocess.run(['bash', '-e', '-c', self.publish_command()], env=environment, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            return arguments.read_text().splitlines()

    def test_beta_is_marked_prerelease_and_never_latest(self):
        arguments = self.run_publish('1.3.36-beta.1', 'true')
        self.assertEqual(arguments[:3], ['release', 'create', '1.3.36-beta.1'])
        self.assertIn('--prerelease', arguments)
        self.assertIn('--latest=false', arguments)
        self.assertIn('--verify-tag', arguments)
        self.assertIn('dist/thoughtspace-1.3.36-beta.1.zip', arguments)

    def test_stable_publication_marks_latest_and_preserves_standard_assets(self):
        for tag in ('1.3.35', '1.3.35+build-with-hyphen'):
            with self.subTest(tag=tag):
                arguments = self.run_publish(tag, 'false')
                self.assertEqual(arguments[:3], ['release', 'create', tag])
                self.assertNotIn('--prerelease', arguments)
                self.assertIn('--latest', arguments)
                self.assertNotIn('--latest=false', arguments)
                self.assertIn('--notes-file', arguments)
                self.assertIn('dist/release-notes.md', arguments)


if __name__ == '__main__':
    unittest.main()
