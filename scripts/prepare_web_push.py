"""Prepare installable web-app metadata and the official logo for Home Screen use."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
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
    logo_path = ROOT / 'assets/am-investments-logo-house.png'
    revision = hashlib.sha256(logo_path.read_bytes()).hexdigest()[:12]
    with Image.open(logo_path) as logo:
        for size in [180, 192, 512]:
            # The approved artwork already includes app-icon safe margins.
            image = ImageOps.fit(logo.convert('RGB'), (size, size), method=Image.Resampling.LANCZOS)
            image.save(icons / f'icon-{size}.png')
    # A small browser-tab icon shares the same approved artwork.
    with Image.open(logo_path) as logo:
        ImageOps.fit(logo.convert('RGB'), (32, 32)).save(icons / 'favicon.png')
    manifest = {
        'id': base_path + '/', 'name': 'AM Investments', 'short_name': 'AM Investments',
        'start_url': base_path + '/?launch=homescreen', 'scope': base_path + '/', 'display': 'standalone',
        'background_color': '#ffffff', 'theme_color': '#133c7a',
        'icons': [{'src': f'{base_path}/app-icons/icon-{size}.png?v={revision}',
                   'sizes': f'{size}x{size}', 'type': 'image/png', 'purpose': 'any'}
                  for size in [192, 512]],
    }
    (directory / 'manifest.webmanifest').write_text(json.dumps(manifest, indent=2) + '\n')
    (directory / 'OneSignalSDKWorker.js').write_bytes((ROOT / 'public/OneSignalSDKWorker.js').read_bytes())
    shutil.copytree(ROOT / 'public/home-screen-check', directory / 'home-screen-check', dirs_exist_ok=True)
    if 'name="am-install-metadata"' not in html:
        links = (f'<meta name="am-install-metadata" content="1">\n'
                 f'<link rel="icon" type="image/png" href="{base_path}/app-icons/favicon.png?v={revision}">\n'
                 f'<link rel="manifest" href="{base_path}/manifest.webmanifest">\n'
                 f'<link rel="apple-touch-icon" href="{base_path}/app-icons/icon-180.png?v={revision}">\n'
                 '<meta name="apple-mobile-web-app-capable" content="yes">\n'
                 '<meta name="apple-mobile-web-app-title" content="AM Investments">\n'
                 '<meta name="theme-color" content="#133c7a">\n')
        html = html.replace('</head>', links + '</head>')
    if 'id="am-startup"' not in html:
        recovery = ('<section id="am-startup" role="status" style="position:fixed;inset:0;z-index:9999;'
                    'overflow:auto;background:#f5f7fb;color:#133c7a;font:16px/1.6 -apple-system,Arial,sans-serif;'
                    'padding:calc(32px + env(safe-area-inset-top)) 24px 32px;box-sizing:border-box">'
                    '<div style="max-width:520px;margin:40px auto">'
                    '<h1 style="font-size:28px">AM Investments</h1>'
                    '<p id="am-startup-message">Opening your property app…</p>'
                    '<a id="am-startup-retry" hidden style="padding:12px 20px;'
                    'background:#e0ad2d;color:#133c7a;border-radius:8px;font-weight:bold" '
                    f'href="{base_path}/?launch=homescreen">Reload app</a>'
                    '<noscript><p>Enable JavaScript in your browser to open the property app.</p></noscript>'
                    '</div></section>')
        startup = (ROOT / 'public/app-startup.js').read_text()
        # Place the recovery and its handlers before Expo's deferred bundle.
        html = html.replace('<body>', '<body>' + recovery + '<script>' + startup + '</script>', 1)
    html_path.write_text(html)
    # Keep the comparison launch inside the already-working test app's scope.
    check_html = html.replace(f'href="{base_path}/manifest.webmanifest"', 'href="./manifest.webmanifest"')
    badge = ('<aside id="am-check-status" role="status" style="position:fixed;bottom:12px;left:12px;'
             'right:12px;z-index:10001;background:#e0ad2d;color:#133c7a;padding:8px 12px;'
             'font:14px/1.4 -apple-system,Arial,sans-serif;pointer-events:none">App test: opening…</aside>'
             '<script>window.addEventListener("am-app-ready",function(){'
             'document.getElementById("am-check-status").textContent="App test: ready";},{once:true});</script>')
    check_html = check_html.replace('</body>', badge + '</body>')
    (directory / 'home-screen-check/app.html').write_text(check_html)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web-dir', type=Path, required=True)
    args = parser.parse_args()
    prepare(args.web_dir, os.environ.get('AM_APP_WEB_BASE_PATH', '/app'))
