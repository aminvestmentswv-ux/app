"""Prepare installable web-app metadata and the official logo for Home Screen use."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def prepare(directory, base_path):
    if base_path not in {'', '/app'}:
        raise ValueError('Unexpected app base path')
    html_path = directory / 'index.html'
    html = html_path.read_text()
    if '</head>' not in html:
        raise ValueError('Expected an exported app HTML document')
    icons = directory / 'app-icons'
    icons.mkdir(exist_ok=True)
    with Image.open(ROOT / 'assets/am-investments-logo.jpg') as logo:
        for size in [180, 192, 512]:
            image = Image.new('RGB', (size, size), 'white')
            fitted = ImageOps.contain(logo.convert('RGB'), (int(size * .82), int(size * .82)))
            image.paste(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
            image.save(icons / f'icon-{size}.png')
    manifest = {
        'id': base_path + '/', 'name': 'AM Investments', 'short_name': 'AM Investments',
        'start_url': base_path + '/', 'scope': base_path + '/', 'display': 'standalone',
        'background_color': '#ffffff', 'theme_color': '#133c7a',
        'icons': [{'src': f'{base_path}/app-icons/icon-{size}.png',
                   'sizes': f'{size}x{size}', 'type': 'image/png', 'purpose': 'any'}
                  for size in [192, 512]],
    }
    (directory / 'manifest.webmanifest').write_text(json.dumps(manifest, indent=2) + '\n')
    (directory / 'OneSignalSDKWorker.js').write_bytes((ROOT / 'public/OneSignalSDKWorker.js').read_bytes())
    if 'name="am-install-metadata"' not in html:
        links = (f'<meta name="am-install-metadata" content="1">\n'
                 f'<link rel="manifest" href="{base_path}/manifest.webmanifest">\n'
                 f'<link rel="apple-touch-icon" href="{base_path}/app-icons/icon-180.png">\n'
                 '<meta name="apple-mobile-web-app-capable" content="yes">\n'
                 '<meta name="apple-mobile-web-app-title" content="AM Investments">\n'
                 '<meta name="theme-color" content="#133c7a">\n')
        html_path.write_text(html.replace('</head>', links + '</head>'))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web-dir', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.web_dir, os.environ.get('AM_APP_WEB_BASE_PATH', '/app'))
