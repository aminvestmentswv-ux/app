"""Host-only tests for the Android harness. These do not replace emulator checks."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

SPEC = importlib.util.spec_from_file_location('android_native_smoke', Path(__file__).resolve().parents[1] / 'scripts/android_native_smoke.py')
qa = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qa)
XML = '''<?xml version="1.0"?><hierarchy><node text="Available" content-desc="" enabled="true" bounds="[0,10][90,40]"/><node text="" content-desc="Available" enabled="true" bounds="[100,10][190,40]"/><node text="" content-desc="Close property details" enabled="true" bounds="[0,60][100,100]"/></hierarchy>'''
SNAPSHOT = {'checkedAt': '2026-11-06T00:00:00Z', 'properties': [
    {'listingType': 'sale', 'status': 'available', 'address': '123 Test Street'}]}


class Selectors(unittest.TestCase):
    def test_exact_accessibility_label_preferred(self):
        self.assertEqual(qa.bounds(qa.find_node(qa.parse_ui(XML), 'Available')), (100, 10, 190, 40))

    def test_no_substring_taps(self):
        self.assertIsNone(qa.find_node(qa.parse_ui(XML), 'Close'))

    def test_disabled_zero_area_not_selected(self):
        root = qa.parse_ui('<hierarchy><node text="X" enabled="false" bounds="[0,0][10,10]"/><node text="X" bounds="[0,0][0,10]"/></hierarchy>')
        self.assertIsNone(qa.find_node(root, 'X'))

    def test_prefixed_dump(self):
        self.assertEqual(qa.parse_ui('UI dump complete\n' + XML).tag, 'hierarchy')

    def test_invalid_dump(self):
        with self.assertRaises(ValueError):
            qa.parse_ui('ERROR: null root node')

    def test_crash_package_is_exact(self):
        target = 'com.aminvestments.nativeqatest'
        self.assertTrue(qa.crash_evidence('FATAL EXCEPTION: main\nProcess: '+target+', PID: 123\nError: boom', target))
        self.assertFalse(qa.crash_evidence('FATAL EXCEPTION: main\nProcess: '+target+'.other, PID: 123', target))
        self.assertFalse(qa.crash_evidence('No fatal records', target))


class Harness(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.adb = Mock()
        self.adb.run.return_value = XML
        self.smoke = qa.Smoke(self.adb, 'com.aminvestments.nativeqatest', self.temp.name, SNAPSHOT)

    def test_package_validation(self):
        with self.assertRaises(ValueError):
            qa.Smoke(self.adb, 'bad; command', self.temp.name, SNAPSHOT)

    @patch.object(qa.time, 'sleep')
    def test_tap_coordinates_from_xml(self, sleep):
        self.smoke.tap('Available')
        self.adb.run.assert_any_call('shell', 'input', 'tap', '145', '25')

    def test_wait_fails_explicitly(self):
        with self.assertRaisesRegex(AssertionError, "Expected 'Missing' to be visible"):
            self.smoke.wait('Missing', seconds=0)

    def test_absence_wait(self):
        self.assertIsNone(self.smoke.wait('Missing', seconds=0, absent=True))

    @patch.object(qa.time, 'sleep')
    def test_dump_retries_transient_error(self, sleep):
        self.adb.run.side_effect = [RuntimeError('busy'), '', XML]
        self.assertEqual(self.smoke.ui().tag, 'hierarchy')
        self.assertEqual(self.adb.run.call_count, 3)

    def test_back_failure_when_app_exited(self):
        self.smoke.open_property = Mock()
        self.smoke.wait = Mock()
        self.adb.run.return_value = 'mCurrentFocus=Window{123 com.android.launcher/.Launcher}'
        with self.assertRaisesRegex(AssertionError, 'not foreground'):
            self.smoke.back(SNAPSHOT['properties'][0])

    def test_case_failure_preserves_report_and_evidence(self):
        self.smoke.evidence = Mock(return_value=[])
        self.assertFalse(self.smoke.case('bad', Mock(side_effect=AssertionError('actual failure'))))
        self.assertEqual(self.smoke.results[0]['error'], 'actual failure')
        self.smoke.evidence.assert_called_once_with('bad')

    def test_missing_png_fails_otherwise_passed_case(self):
        self.smoke.evidence = Mock(return_value=['PNG: invalid'])
        self.assertFalse(self.smoke.case('missing-image', lambda: None))

    def test_setup_failure_writes_json(self):
        self.adb.run.side_effect = RuntimeError('device not found')
        self.assertEqual(self.smoke.run(), 1)
        report = json.loads((Path(self.temp.name) / 'report.json').read_text())
        self.assertFalse(report['passed'])
        self.assertEqual(report['results'][0]['name'], 'harness-setup')

    @patch.object(qa.subprocess, 'run')
    def test_adb_uses_argv_not_host_shell(self, run):
        run.return_value = subprocess.CompletedProcess([], 0, b'ok', b'')
        self.assertEqual(qa.Adb('emulator-5554').run('shell', 'wm', 'size'), 'ok')
        self.assertEqual(run.call_args.args[0], ['adb', '-s', 'emulator-5554', 'shell', 'wm', 'size'])
        self.assertNotIn('shell', run.call_args.kwargs)


if __name__ == '__main__':
    unittest.main()
