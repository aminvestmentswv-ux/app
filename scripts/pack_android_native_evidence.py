"""Emit bounded, public-safe emulator evidence in the existing test job log.

PNG bytes are never transformed. No artifacts, caches, APKs or external storage.
"""
import base64
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile

MAX_ARCHIVE_BYTES = 4_800_000
MAX_SCREENSHOT_BYTES = 2_000_000
MAX_DIAGNOSTIC_BYTES = 200_000
MANIFEST = 'screenshot-manifest.json'
PRIORITY = ('09-gallery-initial.png', '09-gallery-next.png', '01-cold-startup.png')
REQUIRED = PRIORITY[:2]
DIAGNOSTICS = ('emulator.log', 'crash-log.txt', 'apk-badging.txt', 'foreground-diagnostics.txt')


def build_archive(files):
    """Deterministic tar.gz of name -> exact bytes."""
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as archive:
            for name, data in sorted(files.items()):
                info = tarfile.TarInfo(name)
                info.size = len(data)
                info.mode = 0o644
                archive.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


def collect_files(root):
    root = Path(root)
    files = {p.name: p.read_bytes() for p in sorted(root.iterdir())
             if p.is_file() and p.suffix in ('.json', '.xml', '.sha256') and p.name != MANIFEST}
    for name in DIAGNOSTICS:
        path = root / name
        if path.is_file():
            files[name + '.tail.txt'] = path.read_bytes()[-MAX_DIAGNOSTIC_BYTES:]
    screens = {p.name: p.read_bytes() for p in sorted(root.glob('*.png')) if p.is_file()}
    return files, screens


def pack_evidence(files, screens, max_bytes=MAX_ARCHIVE_BYTES):
    """Reserve required gallery evidence, then greedily fit other exact PNGs.

    Every tentative selection is measured as the final compressed archive,
    including the complete manifest. Textual evidence is never silently dropped.
    """
    if MANIFEST in files or set(files) & set(screens):
        raise ValueError('Duplicate evidence or reserved manifest filename')
    selected = set()
    metadata = {name: {'name': name, 'bytes': len(data),
                       'sha256': hashlib.sha256(data).hexdigest()}
                for name, data in sorted(screens.items())}

    def assemble(chosen):
        manifest = {'archive_limit_bytes': max_bytes,
                    'screenshot_limit_bytes': MAX_SCREENSHOT_BYTES,
                    'png_transformations': False,
                    'selected': [metadata[n] for n in sorted(chosen)],
                    'skipped': [dict(metadata[n], reason='exceeds individual screenshot limit'
                                    if len(screens[n]) > MAX_SCREENSHOT_BYTES else 'archive byte budget')
                                for n in sorted(screens) if n not in chosen]}
        entries = dict(files)
        entries.update({n: screens[n] for n in chosen})
        entries[MANIFEST] = (json.dumps(manifest, indent=2) + '\n').encode()
        return build_archive(entries), manifest

    data, manifest = assemble(selected)
    if len(data) > max_bytes:
        raise ValueError(f'Textual evidence plus screenshot manifest requires {len(data)} bytes; limit {max_bytes}')
    required = {n for n in REQUIRED if n in screens and len(screens[n]) <= MAX_SCREENSHOT_BYTES}
    data, manifest = assemble(required)
    if len(data) > max_bytes:
        raise ValueError('Required initial/next gallery PNGs cannot fit after textual evidence: '
                         f'{len(data)} bytes exceeds limit {max_bytes}')
    selected.update(required)
    order = [n for n in PRIORITY if n in screens] + sorted(n for n in screens if n not in PRIORITY)
    for name in order:
        if name in selected or len(screens[name]) > MAX_SCREENSHOT_BYTES:
            continue
        candidate, candidate_manifest = assemble(selected | {name})
        if len(candidate) <= max_bytes:
            selected.add(name)
            data, manifest = candidate, candidate_manifest
    return data, manifest


def main():
    root = Path('test-results/android')
    root.mkdir(parents=True, exist_ok=True)
    report = root / 'report.json'
    if not report.exists():
        report.write_text(json.dumps({'passed': False, 'status': 'blocked_before_ui_report',
                          'commit': os.getenv('GITHUB_SHA'),
                          'note': 'Inspect failed build or emulator step; native UI tests did not finish.'}, indent=2) + '\n')
    text = report.read_text()
    print('AM_NATIVE_REPORT_BEGIN\n' + text + '\nAM_NATIVE_REPORT_END')
    if os.getenv('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write('## Android native test-only run\n\nNo deployment or store submission. '
                          'Simulator evidence does not establish physical-device behavior.\n\n```json\n' + text + '\n```\n')
    data, manifest = pack_evidence(*collect_files(root))
    print(f'AM_NATIVE_EVIDENCE_BYTES {len(data)}; selected PNGs {len(manifest["selected"])}; '
          f'skipped PNGs {len(manifest["skipped"])}')
    print('AM_NATIVE_EVIDENCE_TGZ_BASE64_BEGIN')
    encoded = base64.b64encode(data).decode('ascii')
    for start in range(0, len(encoded), 160):
        print(encoded[start:start + 160])
    print('AM_NATIVE_EVIDENCE_TGZ_BASE64_END')


if __name__ == '__main__':
    main()
