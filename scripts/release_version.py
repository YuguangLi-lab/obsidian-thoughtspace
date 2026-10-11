"""Validate exact SemVer release tags and classify their release channel."""
import re

NUMBER = r'(?:0|[1-9][0-9]*)'
IDENTIFIER = r'(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
SEMVER = re.compile(
    rf'{NUMBER}\.{NUMBER}\.{NUMBER}'
    rf'(?:-(?P<prerelease>{IDENTIFIER}(?:\.{IDENTIFIER})*))?'
    r'(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?'
)


def is_prerelease(tag):
    match = SEMVER.fullmatch(tag) if isinstance(tag, str) else None
    if not match:
        raise ValueError('Release tag must be an exact SemVer version, without a v prefix')
    return match.group('prerelease') is not None
