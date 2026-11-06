"""Write a small public-safe evidence archive into the existing test job log.

No artifacts, caches, APKs, credentials, external storage or deployment are used.
The archive is evidence from a disposable emulator, not a distributable app.
"""
import base64
import io
import json
import os
from pathlib import Path
import tarfile

root = Path('test-results/android')
root.mkdir(parents=True, exist_ok=True)
report = root / 'report.json'
if report.exists():
    text = report.read_text()
    print('AM_NATIVE_REPORT_BEGIN\n' + text + '\nAM_NATIVE_REPORT_END')
else:
    text = json.dumps({'passed': False, 'status': 'blocked_before_ui_report', 'commit': os.getenv('GITHUB_SHA'), 'note': 'Inspect failed build or emulator step; native UI tests did not finish.'}, indent=2)
    report.write_text(text + '\n')
    print('AM_NATIVE_REPORT_BEGIN\n' + text + '\nAM_NATIVE_REPORT_END')
if os.getenv('GITHUB_STEP_SUMMARY'):
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
        summary.write('## Android native test-only run\n\nNo deployment or store submission. Simulator evidence does not establish physical-device behavior.\n\n```json\n' + text + '\n```\n')
files = [p for p in root.glob('*.json')] + [p for p in root.glob('*.xml')]
files += [p for p in root.glob('*.sha256')]
for name in ('emulator.log', 'crash-log.txt', 'apk-badging.txt'):
    p = root / name
    if p.exists():
        tail = root / (name + '.tail.txt')
        tail.write_text(p.read_text(errors='replace')[-200_000:])
        files.append(tail)
screens = sorted(root.glob('*.png'))
files += screens[:1] + (screens[-2:] if len(screens) > 1 else [])
buffer = io.BytesIO()
with tarfile.open(fileobj=buffer, mode='w:gz') as archive:
    for p in sorted(set(files)):
        if p.is_file() and p.stat().st_size <= 2_000_000:
            archive.add(p, arcname=p.name, recursive=False)
data = buffer.getvalue()
if len(data) > 5_000_000:
    raise SystemExit('Evidence archive exceeded the five MB log limit')
print('AM_NATIVE_EVIDENCE_TGZ_BASE64_BEGIN')
encoded = base64.b64encode(data).decode('ascii')
for start in range(0, len(encoded), 160):
    print(encoded[start:start + 160])
print('AM_NATIVE_EVIDENCE_TGZ_BASE64_END')
