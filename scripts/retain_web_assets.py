"""Keep the previous build's immutable assets usable by cached Home Screen HTML."""
from __future__ import annotations

import json
from pathlib import Path, PurePosixPath
import subprocess

MANIFEST = 'current-build-assets.json'


def asset_path(value):
    path = PurePosixPath(value)
    return (not path.is_absolute() and '..' not in path.parts
            and value.startswith(('_expo/static/', 'assets/')))


def retain_previous_assets(directory, parent, git_directory):
    directory = Path(directory).resolve()
    command = ['git', '--git-dir', str(git_directory)]
    # Record only this fresh build's assets, before adding the previous build.
    current = sorted(p.relative_to(directory).as_posix() for p in directory.rglob('*')
                     if p.is_file() and asset_path(p.relative_to(directory).as_posix()))
    listing = subprocess.check_output([*command, 'ls-tree', '-r', '--name-only', parent], text=True)
    paths = listing.splitlines()
    if MANIFEST in paths:
        previous = json.loads(subprocess.check_output([*command, 'show', f'{parent}:{MANIFEST}'], text=True))
        if not isinstance(previous, list) or any(not isinstance(p, str) or not asset_path(p) for p in previous):
            raise ValueError('Invalid previous build asset manifest')
    else:
        previous = [p for p in paths if asset_path(p)]
    retained = 0
    for path in previous:
        target = directory / path
        if target.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(subprocess.check_output([*command, 'show', f'{parent}:{path}']))
        retained += 1
    (directory / MANIFEST).write_text(json.dumps(current, indent=2) + '\n')
    return retained
