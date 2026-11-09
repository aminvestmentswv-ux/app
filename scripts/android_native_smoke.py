#!/usr/bin/env python3
"""Read-only native UI smoke checks. Requires an installed release-mode APK + adb.

No third-party Python packages, HTTP calls, calls, sharing, or notification enrollment.
Assertions use the freshly validated public snapshot prepared for this build. PNGs
are review evidence, NOT proof that remote photographs decoded successfully.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import time
import traceback
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
LABELS = {'available': 'Available', 'coming-soon': 'Coming Soon',
          'under-contract': 'Under Contract', 'sold': 'Sold'}


def parse_ui(xml):
    start = xml.find('<?xml')
    if start < 0:
        start = xml.find('<hierarchy')
    if start < 0:
        raise ValueError('UIAutomator did not return an XML hierarchy')
    return ET.fromstring(xml[start:])


def bounds(node):
    values = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
    if not values:
        return None
    x1, y1, x2, y2 = map(int, values.groups())
    return (x1, y1, x2, y2) if x2 > x1 and y2 > y1 else None


def find_node(root, label):
    # Prefer exact accessibility labels over text and never tap substring matches.
    for attr in ('content-desc', 'text'):
        for node in root.iter('node'):
            if node.get(attr) == label and node.get('enabled', 'true') == 'true' and bounds(node):
                return node
    return None


def adb_search_text(value):
    # adb shell joins arguments on-device: reject metacharacters even though the
    # host subprocess uses argv. Encode spaces using Android input's %s syntax.
    if not value or not re.fullmatch(r'[A-Za-z0-9 .,-]+', value):
        raise ValueError('Search address contains unsupported adb input characters')
    return value.replace(' ', '%s')


def active_app_packages(root):
    return {n.get('package', '') for n in root.iter('node') if bounds(n)}


def unobscured_tap_point(root, node, label, width, height):
    """Reject target centers hidden by the disposable QA panel, not app bugs."""
    rect = bounds(node)
    if rect is None:
        return None
    x1, y1, x2, y2 = rect
    x1, x2 = max(0, x1), min(width - 1, x2)
    y1, y2 = max(0, y1), min(height - 1, y2)
    if x2 <= x1 or y2 <= y1:
        return None
    point = ((x1 + x2) // 2, (y1 + y2) // 2)
    if not label.startswith('QA '):
        qa_top = min((bounds(n)[1] for n in root.iter('node') if bounds(n) and
                      (n.get('text', '') or n.get('content-desc', '')).startswith('QA ')), default=height)
        if point[1] >= qa_top - 8:
            return None
    return point


def visible_ime_top(dump):
    """Read Android WindowManager's visible IME insets, never infer from app bounds."""
    tops = []
    for line in dump.splitlines():
        if not re.search(r"(?:mType|type)=ime\b", line) or not re.search(r"(?:mVisible|visible)=true\b", line):
            continue
        frame = re.search(r"(?:mFrame|frame)=\[(\d+),(\d+)\]\[(\d+),(\d+)\]", line)
        if frame:
            x1, y1, x2, y2 = map(int, frame.groups())
            if x2 > x1 and y2 > y1 and y1 > 0:
                tops.append(y1)
    return min(tops) if tops else None


def crash_evidence(log, package):
    """Match crash-buffer records only for our package; retain adjacent stack."""
    chunks = re.split(r'(?=\bFATAL EXCEPTION:)|(?=\bFatal signal \d+)', log)
    hits = []
    for chunk in chunks:
        if re.search(r'(?<![\w.])' + re.escape(package) + r'(?![\w.])', chunk):
            if re.search(r'FATAL EXCEPTION:|Fatal signal \d+|Process:|>>>', chunk):
                hits.append(chunk)
    return hits


class Adb:
    def __init__(self, serial=None):
        self.prefix = ['adb'] + (['-s', serial] if serial else [])

    def run(self, *args, binary=False, check=True):
        result = subprocess.run(self.prefix + list(args), stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=35)
        if check and result.returncode:
            raise RuntimeError(f'adb {args!r} failed: {result.stderr.decode(errors="replace")}')
        return result.stdout if binary else result.stdout.decode(errors='replace')


class Smoke:
    def __init__(self, adb, package, output, snapshot):
        if not re.fullmatch(r'[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+', package):
            raise ValueError('Invalid Android package name')
        self.adb, self.package, self.output = adb, package, Path(output)
        self.output.mkdir(parents=True, exist_ok=True)
        self.snapshot = snapshot
        self.properties = [p for p in snapshot['properties'] if p['listingType'] == 'sale']
        self.results = []
        self.last_xml = ''
        self.width, self.height = 1080, 1920

    def ui(self):
        last = None
        for _ in range(3):
            try:
                self.adb.run('shell', 'uiautomator', 'dump', '/sdcard/am-qa-window.xml')
                self.last_xml = self.adb.run('shell', 'cat', '/sdcard/am-qa-window.xml')
                return parse_ui(self.last_xml)
            except (RuntimeError, ValueError, ET.ParseError, subprocess.TimeoutExpired) as exc:
                last = exc
                time.sleep(0.5)
        raise AssertionError(f'Unable to inspect UI after 3 attempts: {last}')

    def wait(self, label, seconds=12, absent=False):
        end = time.monotonic() + seconds
        while True:
            node = find_node(self.ui(), label)
            if (node is None) == absent:
                return node
            if time.monotonic() >= end:
                raise AssertionError(f'Expected {label!r} to be {"absent" if absent else "visible"}')
            time.sleep(0.4)

    def scroll(self, down=True):
        x = self.width // 2
        a, b = int(self.height * 0.78), int(self.height * 0.32)
        if not down:
            a, b = b, a
        self.adb.run('shell', 'input', 'swipe', str(x), str(a), str(x), str(b), '350')
        time.sleep(0.3)

    def seek(self, label, steps=14):
        for i in range(steps + 1):
            node = find_node(self.ui(), label)
            if node is not None:
                return node
            if i < steps:
                self.scroll()
        raise AssertionError(f'Could not find {label!r} after {steps} downward scrolls')

    def top(self):
        # All tested views stay within a bounded number of pages; no Sold archive traversal.
        for _ in range(14):
            self.scroll(down=False)

    def tap(self, label, seek=False):
        self.seek(label) if seek else self.wait(label)
        for attempt in range(5):
            root = self.ui()
            node = find_node(root, label)
            point = unobscured_tap_point(root, node, label, self.width, self.height) if node is not None else None
            if point:
                self.adb.run('shell', 'input', 'tap', str(point[0]), str(point[1]))
                time.sleep(0.3)
                return
            if attempt < 4:
                self.scroll()
        raise AssertionError(f'{label!r} remains obscured by test controls or outside the display')

    def evidence(self, name):
        errors = []
        try:
            self.ui()
            (self.output / f'{name}.xml').write_text(self.last_xml)
        except Exception as exc:
            errors.append(f'XML: {exc}')
        try:
            png = self.adb.run('exec-out', 'screencap', '-p', binary=True)
            if not png.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('screencap did not return PNG')
            (self.output / f'{name}.png').write_bytes(png)
        except Exception as exc:
            errors.append(f'PNG: {exc}')
        return errors

    def case(self, name, action):
        started = time.monotonic()
        result = {'name': name, 'status': 'passed'}
        try:
            detail = action()
            if detail:
                result['detail'] = detail
        except Exception as exc:
            result.update(status='failed', error=str(exc), traceback=traceback.format_exc())
        result['evidence_errors'] = self.evidence(name)
        if result['evidence_errors'] and result['status'] == 'passed':
            result.update(status='failed', error='Required evidence capture failed')
        result['duration_seconds'] = round(time.monotonic() - started, 2)
        self.results.append(result)
        print(json.dumps(result), flush=True)
        return result['status'] == 'passed'

    def launch(self, cold=False):
        if cold:
            self.adb.run('shell', 'am', 'force-stop', self.package)
        self.adb.run('shell', 'am', 'start', '-W', '-n', f'{self.package}/.MainActivity')
        time.sleep(0.8)

    def foreground(self):
        # API 36 no longer reliably emits mCurrentFocus from this dumpsys view.
        # UIAutomator dumps the active accessibility window: require its visible
        # nodes to belong to our app, never accept a launcher/system-only dialog.
        root = self.ui()
        packages = active_app_packages(root)
        has_content = any(n.get('package') == self.package and bounds(n) and
                          (n.get('text') or n.get('content-desc')) for n in root.iter('node'))
        try:
            focus = self.adb.run('shell', 'dumpsys', 'window', 'windows')
        except Exception as exc:
            focus = f'dumpsys diagnostic unavailable: {exc}'
        with (self.output / 'foreground-diagnostics.txt').open('a') as log:
            log.write(f'Case index {len(self.results)}; active packages={sorted(packages)!r}\n{focus}\n')
        if packages != {self.package} or not has_content:
            raise AssertionError(f'App is not foreground: active UI packages={sorted(packages)!r}; '
                                 f'target app content visible={has_content}')

    def startup(self):
        self.launch(cold=True)
        self.wait('AM Investments logo', seconds=35)
        self.foreground()
        self.seek('Search properties by address or city')

    def select_status(self, status):
        self.top()
        self.tap(LABELS[status], seek=True)
        self.seek(LABELS[status] + ' properties')
        items = [p for p in self.properties if p['status'] == status]
        self.seek('View ' + items[0]['address'] if items else
                  f'No {LABELS[status].lower()} listings in this inventory')
        return f'Bundled {LABELS[status]} count: {len(items)}; first card or empty state verified'

    def search(self):
        self.select_status('available')
        self.top()
        self.tap('Search properties by address or city', seek=True)
        self.adb.run('shell', 'input', 'text', 'zzznativeqanomatch938472')
        # Back dismisses the IME; it is not the separate details Back test.
        self.adb.run('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.seek('No matching properties')
        self.tap('Clear search', seek=True)
        self.wait('No matching properties', absent=True)
        items = [p for p in self.properties if p['status'] == 'available']
        self.seek('View ' + items[0]['address'] if items else 'No available listings in this inventory')

    def open_property(self, prop):
        self.launch(cold=True)  # Recover cleanly from any previous failed case.
        self.wait('AM Investments logo', seconds=35)
        self.select_status(prop['status'])
        self.top()
        self.tap('Search properties by address or city', seek=True)
        self.adb.run('shell', 'input', 'text', adb_search_text(prop['address']))
        self.adb.run('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.tap('View ' + prop['address'], seek=True)
        self.wait('Close property details')

    def details(self, prop):
        self.open_property(prop)
        self.seek('Property details')
        for label in ('Bedrooms', 'Bathrooms', 'Square footage', 'Description'):
            self.seek(label)
        errors = self.evidence('07-details-open-fields')
        if errors:
            raise AssertionError('Details evidence failed: ' + '; '.join(errors))
        self.top()
        self.tap('Close property details')
        self.wait('Close property details', absent=True)
        self.tap('View ' + prop['address'], seek=True)
        self.wait('Close property details')
        self.tap('Close property details')
        self.wait('Close property details', absent=True)

    def back(self, prop):
        self.open_property(prop)
        self.adb.run('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.wait('Close property details', absent=True)
        self.foreground()  # Exiting the app is a failure, not a successful dismissal.
        self.seek('View ' + prop['address'])

    def gallery(self, prop):
        self.open_property(prop)
        count = len(prop['images'])
        self.seek(f'Photo 1 of {count}')
        self.gallery_evidence('09-gallery-initial')
        self.tap('Next photo')
        self.wait(f'Photo 2 of {count}')
        self.gallery_evidence('09-gallery-next')
        self.tap('Previous photo')
        self.wait(f'Photo 1 of {count}')
        self.tap('Previous photo')
        self.wait(f'Photo {count} of {count}')
        self.gallery_evidence('09-gallery-wraparound')
        self.tap('Next photo')
        self.wait(f'Photo 1 of {count}')
        return 'Next, Previous and wraparound counters verified; image pixels not asserted'

    def gallery_evidence(self, name):
        errors = self.evidence(name)
        if errors:
            raise AssertionError('Gallery evidence failed: ' + '; '.join(errors))

    def resume(self, prop):
        self.open_property(prop)
        self.adb.run('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        time.sleep(1)
        self.launch()
        self.foreground()
        self.wait('Close property details')
        self.tap('Close property details')
        self.wait('Close property details', absent=True)
        self.startup()
        return 'Home/resume preserved modal; force-stop/relaunch returned to usable home'

    def wait_input(self, label, value=None, seconds=10):
        # Observe state only; never retry a destructive edit or retype until passing.
        end = time.monotonic() + seconds
        stable = 0
        while True:
            node = find_node(self.ui(), label)
            if node is not None and node.get('class') == 'android.widget.EditText' and node.get('focused') == 'true' and (value is None or node.get('text', '') == value):
                stable += 1
                if stable >= 2:
                    return node
            else:
                stable = 0
            if time.monotonic() >= end:
                actual = None if node is None else node.get('text')
                raise AssertionError(f'Input state failed for {label!r}: expected focused value {value!r}, got {actual!r}')
            time.sleep(0.3)

    def assert_input_above_ime(self, label, seconds=10):
        end = time.monotonic() + seconds
        while True:
            node = find_node(self.ui(), label)
            dump = self.adb.run('shell', 'dumpsys', 'window')
            (self.output / 'own-agent-keyboard-window.txt').write_text(dump)
            top = visible_ime_top(dump)
            rect = bounds(node) if node is not None else None
            if (node is not None and node.get('focused') == 'true' and rect and
                    top is not None and rect[1] >= 0 and rect[3] <= top):
                return
            if time.monotonic() >= end:
                raise AssertionError(f'Focused input {label!r} is not fully above visible IME: bounds={rect}, ime_top={top}')
            time.sleep(0.3)

    def replace_input(self, label, value):
        encoded = adb_search_text(value)
        self.top()
        self.tap(label, seek=True)
        self.wait_input(label)
        self.assert_input_above_ime(label)
        self.adb.run('shell', 'input', 'keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_A')
        self.adb.run('shell', 'input', 'keyevent', 'KEYCODE_DEL')
        self.wait_input(label, '')
        self.adb.run('shell', 'input', 'text', encoded)
        self.wait_input(label, value)
        self.assert_input_above_ime(label)
        # Capture the live focused editor before hiding the keyboard, including
        # the edit/cancel regression that failed in the previous hosted build.
        if value == 'Unsaved edit':
            self.gallery_evidence('17-own-agent-keyboard')
        self.adb.run('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.wait('Close property details')

    def seek_any(self, labels, steps=14):
        for i in range(steps + 1):
            root = self.ui()
            for label in labels:
                if find_node(root, label) is not None:
                    return label
            if i < steps:
                self.scroll()
        raise AssertionError(f'Could not find any of {labels!r}')

    def reset_buyer_agent(self):
        if self.package != 'com.aminvestments.nativeqatest':
            raise AssertionError('Contact reset is restricted to the disposable QA app')
        control = self.seek_any(('Add your agent', 'Clear your agent'))
        if control == 'Clear your agent':
            # Never clear an unexpected contact, even on the disposable test app.
            self.top()
            self.seek_any(('Test agent · +13045550123', 'Updated agent · +13045550123'))
            self.tap('Clear your agent', seek=True)
            self.seek('Add your agent')

    def buyer_agent(self, prop):
        # Synthetic reserved example number only. Never tap call or text actions.
        self.open_property(prop)
        self.reset_buyer_agent()
        self.tap('Add your agent', seek=True)
        self.replace_input('Your agent US or Canada phone number', '123')
        self.tap('Save agent on this device', seek=True)
        self.seek('Enter a valid 10-digit US or Canada phone number.')
        self.replace_input('Your agent name (optional)', 'Test agent')
        self.replace_input('Your agent US or Canada phone number', '3045550123')
        self.tap('Save agent on this device', seek=True)
        self.top()
        self.seek('Test agent · +13045550123')
        self.seek('Call your agent')
        self.seek('Text your agent about this property')
        self.tap('Edit your agent', seek=True)
        self.replace_input('Your agent name (optional)', 'Unsaved edit')
        self.tap('Cancel agent edit', seek=True)
        self.top()
        self.seek('Test agent · +13045550123')
        self.tap('Edit your agent', seek=True)
        self.replace_input('Your agent name (optional)', 'Updated agent')
        self.tap('Save agent on this device', seek=True)
        self.top()
        self.seek('Updated agent · +13045550123')
        self.gallery_evidence('17-own-agent-configured')
        # Force-stop and relaunch: persistence must survive a fresh native process.
        self.open_property(prop)
        self.seek('Updated agent · +13045550123')
        self.top()
        self.tap('Close property details')
        self.wait('Close property details', absent=True)
        # Retain the loaded contact across another property without a relaunch.
        self.top()
        self.tap('Clear search', seek=True)
        other = next((p for p in self.properties if p['status'] == 'sold'), prop)
        self.select_status(other['status'])
        self.tap('View ' + other['address'], seek=True)
        self.wait('Close property details')
        self.seek('Updated agent · +13045550123')
        if other['status'] == 'sold':
            self.top()
            self.seek('This property is sold. It is not listed as available to buy.')
        self.tap('Clear your agent', seek=True)
        self.seek('Add your agent')
        self.wait('Call your agent', absent=True)
        self.wait('Text your agent about this property', absent=True)
        # Cold launch again: clearing must remove persisted data, not just UI state.
        self.open_property(other)
        self.seek('Add your agent')
        self.foreground()
        return 'Synthetic agent entry, validation, edit/cancel/save, cross-property retention, cold-restart save and clear verified; no dialer or message handoff opened'

    def crashes(self):
        log = self.adb.run('logcat', '-b', 'crash', '-d', '-v', 'threadtime')
        (self.output / 'crash-log.txt').write_text(log)
        hits = crash_evidence(log, self.package)
        if hits:
            raise AssertionError('Target-package crash-buffer entries detected: ' + '\n'.join(hits)[:6000])
        self.foreground()
        return 'No target-package fatal records in Android crash buffer; not a full JS/network audit'

    def live_refresh(self):
        self.startup()
        self.top()
        self.seek('Loaded the latest published website inventory.')
        before = self.inventory_attempts()
        self.tap('Refresh property inventory', seek=True)
        self.wait_for_inventory_attempt(before)
        self.wait('Loaded the latest published website inventory.', seconds=30)
        self.foreground()
        return 'Installed app accepted the real public HTTPS feed on launch and manual refresh'

    def inventory_attempts(self):
        for node in self.ui().iter('node'):
            match = re.fullmatch(r'QA inventory attempts: (\d+)', node.get('text', '') or node.get('content-desc', ''))
            if match:
                return int(match.group(1))
        raise AssertionError('Missing QA inventory request counter')

    def wait_for_inventory_attempt(self, before, seconds=30):
        end = time.monotonic() + seconds
        while True:
            after = self.inventory_attempts()
            if after > before:
                return after
            if time.monotonic() >= end:
                raise AssertionError('Inventory refresh did not initiate a new request')
            time.sleep(0.4)

    def offline_refresh(self):
        self.tap('QA set inventory offline')
        self.wait('QA inventory connection: offline')
        self.top()
        self.tap('Refresh property inventory', seek=True)
        self.wait('Could not get a current update. Showing saved inventory; availability may have changed.', seconds=30)
        self.select_status('available')
        return 'Feed-only injected network failure preserved the rendered catalog; no OS network settings changed'

    def offline_cold_launch(self):
        self.adb.run('shell', 'am', 'force-stop', self.package)
        self.adb.run('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
                     '-d', 'am-native-qa://offline', '-n', f'{self.package}/.MainActivity')
        self.wait('AM Investments logo', seconds=35)
        self.wait('QA inventory connection: offline')
        self.seek('Could not get a current update. Showing saved inventory; availability may have changed.')
        self.select_status('available')
        return 'Cold launch with feed failure displayed the bundled fallback; not persistent downloaded-cache coverage'

    def recover_online(self):
        self.tap('QA set inventory online')
        self.wait('QA inventory connection: online')
        self.top()
        self.tap('Refresh property inventory', seek=True)
        self.wait('Loaded the latest published website inventory.', seconds=30)
        self.select_status('available')
        return 'Installed app recovered by fetching the actual HTTPS feed after injected outage'

    def foreground_refresh(self):
        self.top()
        self.seek('Refresh property inventory')
        self.tap('QA set inventory offline')
        self.adb.run('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        time.sleep(1)
        self.launch()
        self.wait('Could not get a current update. Showing saved inventory; availability may have changed.', seconds=30)
        self.tap('QA set inventory online')
        self.adb.run('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        time.sleep(1)
        self.launch()
        self.wait('Loaded the latest published website inventory.', seconds=30)
        return 'Foreground transitions retried automatically, first failing safely then recovering online'

    def run(self):
        try:
            self.adb.run('wait-for-device')
            size = self.adb.run('shell', 'wm', 'size')
            sizes = re.findall(r'(\d+)x(\d+)', size)
            if sizes:
                self.width, self.height = map(int, sizes[-1])
            self.adb.run('logcat', '-b', 'crash', '-c')
            self.case('01-cold-startup', self.startup)
            for i, status in enumerate(LABELS, 2):
                def status_test(s=status):
                    self.startup()
                    return self.select_status(s)
                self.case(f'{i:02d}-status-{status}', status_test)
            self.case('06-search-no-match-clear', self.search)
            # First entry guarantees it can be reached without archive pagination.
            prop = next((p for p in self.properties if p['status'] == 'available'), self.properties[0])
            self.case('07-details-close-reopen', lambda: self.details(prop))
            self.case('08-android-back', lambda: self.back(prop))
            # Address search reaches any bundled listing without archive pagination.
            gallery = next((p for p in self.properties if len(p.get('images', [])) > 1), None)
            if gallery:
                self.case('09-gallery-controls', lambda: self.gallery(gallery))
            else:
                self.results.append({'name': '09-gallery-controls', 'status': 'skipped',
                                     'reason': 'No bundled property has multiple photos'})
            self.case('10-background-relaunch', lambda: self.resume(prop))
            self.case('11-live-refresh', self.live_refresh)
            self.case('12-offline-refresh', self.offline_refresh)
            self.case('13-offline-cold-launch', self.offline_cold_launch)
            self.case('14-online-recovery', self.recover_online)
            self.case('15-foreground-refresh', self.foreground_refresh)
            self.case('17-own-agent-entry-navigation-clear', lambda: self.buyer_agent(prop))
            self.case('16-crash-detection', self.crashes)
        except Exception as exc:
            self.results.append({'name': 'harness-setup', 'status': 'failed', 'error': str(exc),
                                 'traceback': traceback.format_exc()})
        finally:
            report = {'package': self.package, 'snapshot_checked_at': self.snapshot['checkedAt'],
                      'source': 'Public feed validated before build; installed launch/manual/foreground refresh uses real HTTPS feed',
                      'results': self.results,
                      'limitations': ['No external links, calls, sharing or notifications triggered',
                                      'No production signing/store installation, iOS or physical device coverage',
                                      'Gallery counter tests do not prove remote image decode or swipe behavior',
                                      'Offline cases inject a feed-only fetch failure; do not exercise physical radio-off networking',
                                      'QA-only controls are added to the disposable test build, not production source entrypoints']}
            report['passed'] = bool(self.results) and all(r['status'] != 'failed' for r in self.results)
            (self.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        return 0 if report['passed'] else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package', default=os.environ.get('AM_TEST_PACKAGE', 'com.aminvestments.nativeqatest'))
    parser.add_argument('--serial', default=os.environ.get('ANDROID_SERIAL'))
    parser.add_argument('--output', type=Path, default=ROOT / 'test-results/android')
    parser.add_argument('--snapshot', type=Path, default=ROOT / 'src/data/properties.json')
    args = parser.parse_args()
    snapshot = json.loads(args.snapshot.read_text())
    return Smoke(Adb(args.serial), args.package, args.output, snapshot).run()


if __name__ == '__main__':
    raise SystemExit(main())
