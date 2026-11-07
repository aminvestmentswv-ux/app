"""Check the actual HTTPS startup responses with Safari and standalone iPhone agents."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import ssl
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    from .verify_refresh import Scripts
except ImportError:
    from verify_refresh import Scripts

ORIGIN = 'https://app.aminvestmentswv.com'
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
AGENTS = {'safari': IPHONE + ' Version/27.0 Mobile/15E148 Safari/604.1',
          'standalone': IPHONE + ' Mobile/15E148'}


class PublishedMismatch(ValueError):
    """A successful HTTP response did not yet match the verified artifact."""


def fetch(url, agent, timeout=30):
    # Retry the COMPLETE verification below, not nested request-level retries.
    request = Request(url, headers={'User-Agent': agent, 'Cache-Control': 'no-cache'})
    with urlopen(request, timeout=timeout) as response:
        if not response.geturl().startswith(ORIGIN + '/'):
            raise ValueError('Published startup redirected away from the app origin')
        return response.read(), response.headers.get_content_type()


def mismatch(label, expected, actual, mime):
    return PublishedMismatch(
        f'{label}; expected sha256={hashlib.sha256(expected).hexdigest()} '
        f'bytes={len(expected)}, received sha256={hashlib.sha256(actual).hexdigest()} '
        f'bytes={len(actual)} content-type={mime}')


def verify_once(directory, expected, version, attempt, deadline):
    report = {'htmlVersion': version, 'agents': {}}

    def read(path, agent):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Published verification time budget exhausted')
        result = fetch(ORIGIN + path, agent, timeout=min(30, remaining))
        if time.monotonic() >= deadline:
            raise TimeoutError('Published verification time budget exhausted')
        return result

    def require_bytes(path, agent, expected_body, allowed_mimes, label):
        body, mime = read(path, agent)
        if body != expected_body or mime not in allowed_mimes:
            raise mismatch(label, expected_body, body, mime)

    for name, agent in AGENTS.items():
        # Each pass uses a fresh URL and starts again with Safari, so partial
        # successes from different attempts cannot add up to a false pass.
        query = f'am-verify={version}-{name}-{attempt}'
        require_bytes(f'/?{query}', agent, expected, {'text/html'},
                      f'{name}: published HTML differs from the verified export')
        manifest_expected = (directory / 'manifest.webmanifest').read_bytes()
        expected_json = json.loads(manifest_expected)
        manifest, mime = read(f'/manifest.webmanifest?{query}', agent)
        try:
            manifest_matches = json.loads(manifest) == expected_json
        except (ValueError, UnicodeError):
            manifest_matches = False
        if not manifest_matches:
            raise mismatch(f'{name}: published Home Screen manifest differs',
                           manifest_expected, manifest, mime)
        require_bytes(f'/home-screen-check/?{query}', agent,
                      (directory / 'home-screen-check/index.html').read_bytes(), {'text/html'},
                      f'{name}: published standalone test page differs')
        require_bytes(f'/home-screen-check/app.html?am-push=off&{query}', agent,
                      (directory / 'home-screen-check/app.html').read_bytes(), {'text/html'},
                      f'{name}: published property-app comparison differs')
        for source in Scripts(expected.decode('utf-8')).sources:
            if not source.startswith('/') or source.startswith('//'):
                raise ValueError('Unexpected published startup script origin')
            require_bytes(f'{source}?{query}', agent, (directory / source.lstrip('/')).read_bytes(),
                          {'application/javascript', 'text/javascript'},
                          f'{name}: published startup script differs ({source})')
        report['agents'][name] = 'startup HTML, JavaScript, manifest and static test page match'
    return report


def retryable(error):
    if isinstance(error, HTTPError):
        return error.code in {404, 408, 429, 500, 502, 503, 504}
    if isinstance(error, URLError):
        return not isinstance(error.reason, ssl.SSLCertVerificationError)
    return isinstance(error, (PublishedMismatch, TimeoutError, ConnectionError))


def verify(directory, *, max_attempts=13, timeout_seconds=120, retry_interval=10):
    if max_attempts < 1 or timeout_seconds <= 0 or retry_interval < 0:
        raise ValueError('Verification retry limits must be positive (interval may be zero)')
    directory = Path(directory)
    expected = (directory / 'index.html').read_bytes()
    version = hashlib.sha256(expected).hexdigest()[:16]
    started = time.monotonic()
    deadline = started + timeout_seconds
    for attempt in range(1, max_attempts + 1):
        try:
            report = verify_once(directory, expected, version, attempt, deadline)
        except (ValueError, URLError, TimeoutError, ConnectionError) as error:
            if not retryable(error):
                raise
            print(f'Published startup attempt {attempt}/{max_attempts} failed: {error}', flush=True)
            remaining = deadline - time.monotonic()
            if attempt == max_attempts or remaining <= retry_interval:
                raise ValueError(
                    f'Published startup verification failed after {attempt} attempt(s): {error}'
                ) from error
            time.sleep(retry_interval)
        else:
            report['attempts'] = attempt
            report['elapsedSeconds'] = round(time.monotonic() - started, 3)
            for name in report['agents']:
                print(f'Published iPhone {name} responses verified', flush=True)
            return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web-dir', type=Path, required=True)
    args = parser.parse_args()
    report = verify(args.web_dir)
    destination = Path('test-results/published-startup.json')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + '\n')
