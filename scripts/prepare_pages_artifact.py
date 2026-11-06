"""Prepare one verified artifact; gh-pages is history, never a build trigger."""
import argparse
import json
import os
from pathlib import Path
import subprocess
from urllib.request import urlopen

try:
    from .retain_web_assets import asset_path, retain_previous_assets
except ImportError:
    from retain_web_assets import asset_path, retain_previous_assets


def api(repo, *args):
    return json.loads(subprocess.check_output(['gh', 'api', f'repos/{repo}/pages', *args], text=True))


def retain_live(directory, origin):
    # The branch tip can be a FAILED publication. Preserve actual live assets too.
    def read(path):
        with urlopen(origin + path, timeout=30) as response:
            if not response.geturl().startswith(origin):
                raise ValueError('Live asset redirected outside the selected origin')
            return response.read()
    manifest = json.loads(read('current-build-assets.json'))
    if not isinstance(manifest, list) or any(not isinstance(p, str) or not asset_path(p)
            or '?' in p or '#' in p or '\\' in p for p in manifest):
        raise ValueError('Invalid live asset manifest')
    for path in manifest:
        target = directory / path
        if not target.exists():
            data = read(path)
            if not data:
                raise ValueError('Empty live asset: ' + path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)


def prepare(directory):
    directory = directory.resolve()
    report = json.loads(Path('test-results/hourly-refresh.json').read_text())
    if not report.get('passed') or not (directory / 'index.html').is_file():
        raise ValueError('A verified export is required')
    repo = os.environ['GITHUB_REPOSITORY']
    domain = os.environ['AM_APP_WEB_DOMAIN']
    origin = os.environ['AM_APP_WEB_URL']
    pages = api(repo)
    if (pages.get('cname', '') != domain or report.get('domain') != domain
            or domain != 'app.aminvestmentswv.com' or origin != f'https://{domain}/'):
        raise ValueError('Pages custom domain changed; refusing publication')
    # Preserve domain and HTTPS; change only the publishing mechanism once.
    if pages.get('build_type') != 'workflow':
        api(repo, '--method', 'PUT', '-f', 'build_type=workflow')
        pages = api(repo)
    if pages.get('build_type') != 'workflow' or pages.get('cname') != domain:
        raise ValueError('Pages must use workflow publishing with the existing domain')
    if not pages.get('https_enforced'):
        raise ValueError('HTTPS enforcement must remain enabled')
    def git(*args):
        return subprocess.check_output(['git', *args], text=True).strip()
    git('fetch', '--depth=1', 'origin', 'gh-pages')
    parent = git('rev-parse', 'FETCH_HEAD')
    retain_previous_assets(directory, parent, git('rev-parse', '--absolute-git-dir'))
    retain_live(directory, origin)
    # Keep the existing isolated commit machinery, without POST/build polling.
    try:
        from .publish_pages import archive_export
    except ImportError:
        from publish_pages import archive_export
    commit = archive_export(directory, parent, report['checkedAt'])
    print('Verified artifact archived at ' + commit, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web-dir', type=Path, required=True)
    prepare(parser.parse_args().web_dir)
