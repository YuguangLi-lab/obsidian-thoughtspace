"""Verify the public tag endpoint and downloaded assets, as installers see them."""
import hashlib
import json
import os
import re
import time
import urllib.request
from pathlib import Path

RUNTIME = ('main.js', 'manifest.json', 'styles.css')


def verify_listing(release, tag, expected):
    if release.get('tag_name') != tag or release.get('draft') is not False:
        raise ValueError('The requested stable release is not public')
    if release.get('prerelease') is not False:
        raise ValueError('The release must not be a prerelease')
    assets = release.get('assets', [])
    for name, data in expected.items():
        matches = [a for a in assets if a.get('name') == name]
        if len(matches) != 1:
            raise ValueError(f'Public tag endpoint must expose exactly one {name}')
        asset = matches[0]
        if asset.get('state') != 'uploaded' or asset.get('size') != len(data):
            raise ValueError(f'Incomplete or incorrect asset: {name}')
        digest = asset.get('digest')
        if digest and digest != 'sha256:' + hashlib.sha256(data).hexdigest():
            raise ValueError(f'Asset digest mismatch: {name}')


def fetch(url):
    # Deliberately anonymous: a maintainer's access can hide installation failures.
    request = urllib.request.Request(url, headers={'User-Agent': 'ThoughtSpace-release-verifier'})
    with urllib.request.urlopen(request, timeout=40) as response:
        return response.read()


def verify_public(repo, tag, expected):
    release = json.loads(fetch(f'https://api.github.com/repos/{repo}/releases/tags/{tag}'))
    verify_listing(release, tag, expected)
    for name, data in expected.items():
        downloaded = fetch(f'https://github.com/{repo}/releases/download/{tag}/{name}')
        if downloaded != data:
            raise ValueError(f'Public download differs from the build: {name}')
    return release['html_url']


def main():
    root = Path(__file__).resolve().parent.parent
    tag = os.environ['RELEASE_TAG']
    repo = os.environ.get('GITHUB_REPOSITORY', 'YuguangLi-lab/obsidian-thoughtspace')
    if not re.fullmatch(r'\d+\.\d+\.\d+', tag) or not re.fullmatch(r'[\w.-]+/[\w.-]+', repo):
        raise SystemExit('Invalid release tag or repository')
    expected = {name: (root / name).read_bytes() for name in RUNTIME}
    if json.loads(expected['manifest.json'])['version'] != tag:
        raise SystemExit('Local manifest version differs from the release tag')
    for attempt in range(6):
        try:
            url = verify_public(repo, tag, expected)
            print(f'Public tag and all three downloads verified: {url}')
            return
        except (OSError, ValueError, KeyError) as error:
            print(f'Public verification {attempt + 1}/6 failed: {error}', flush=True)
            if attempt == 5:
                raise SystemExit('Release upload is not sufficient: public installation verification failed') from error
            time.sleep(10)


if __name__ == '__main__':
    main()
