"""Check the actual HTTPS startup responses with Safari and standalone iPhone agents."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import time
from urllib.request import Request, urlopen

try:
    from .verify_refresh import Scripts
except ImportError:
    from verify_refresh import Scripts

ORIGIN = 'https://app.aminvestmentswv.com'
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
AGENTS = {'safari': IPHONE + ' Version/27.0 Mobile/15E148 Safari/604.1',
          'standalone': IPHONE + ' Mobile/15E148'}


def fetch(url, agent):
    request = Request(url, headers={'User-Agent': agent, 'Cache-Control': 'no-cache'})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                if not response.geturl().startswith(ORIGIN + '/'):
                    raise ValueError('Published startup redirected away from the app origin')
                return response.read(), response.headers.get_content_type()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(3)


def verify(directory):
    directory = Path(directory)
    expected = (directory / 'index.html').read_bytes()
    version = hashlib.sha256(expected).hexdigest()[:16]
    report = {'htmlVersion': version, 'agents': {}}
    for name, agent in AGENTS.items():
        body, mime = fetch(f'{ORIGIN}/?am-verify={version}-{name}', agent)
        if body != expected or mime != 'text/html':
            raise ValueError(f'{name}: published HTML differs from the verified export')
        manifest, _ = fetch(f'{ORIGIN}/manifest.webmanifest?am-verify={version}-{name}', agent)
        if json.loads(manifest) != json.loads((directory / 'manifest.webmanifest').read_text()):
            raise ValueError(f'{name}: published Home Screen manifest differs')
        check, mime = fetch(f'{ORIGIN}/home-screen-check/?am-verify={version}-{name}', agent)
        if check != (directory / 'home-screen-check/index.html').read_bytes() or mime != 'text/html':
            raise ValueError(f'{name}: published standalone test page differs')
        for source in Scripts(expected.decode('utf-8')).sources:
            if not source.startswith('/') or source.startswith('//'):
                raise ValueError('Unexpected published startup script origin')
            bundle, mime = fetch(f'{ORIGIN}{source}?am-verify={version}-{name}', agent)
            if bundle != (directory / source.lstrip('/')).read_bytes() or mime not in {'application/javascript', 'text/javascript'}:
                raise ValueError(f'{name}: published startup script differs')
        report['agents'][name] = 'startup HTML, JavaScript, manifest and static test page match'
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
