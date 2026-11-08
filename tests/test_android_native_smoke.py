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
    def test_tap_rejects_real_failure_card_hidden_by_qa_overlay(self):
        root = qa.parse_ui('<hierarchy><node content-desc="View 314 Skyline Drive" bounds="[63,2043][1017,2337]"/><node text="QA inventory connection: online" bounds="[5,2149][1075,2186]"/></hierarchy>')
        self.assertIsNone(qa.unobscured_tap_point(root, qa.find_node(root, 'View 314 Skyline Drive'), 'View 314 Skyline Drive', 1080, 2400))

    def test_tap_accepts_card_after_scrolling_clear_of_qa_overlay(self):
        root = qa.parse_ui('<hierarchy><node content-desc="View 314 Skyline Drive" bounds="[63,800][1017,2100]"/><node text="QA inventory connection: online" bounds="[5,2149][1075,2186]"/></hierarchy>')
        self.assertEqual(qa.unobscured_tap_point(root, qa.find_node(root, 'View 314 Skyline Drive'), 'View 314 Skyline Drive', 1080, 2400), (540, 1450))

    def test_qa_buttons_remain_tappable(self):
        root = qa.parse_ui('<hierarchy><node content-desc="QA set inventory offline" bounds="[5,2223][207,2316]"/><node text="QA inventory connection: online" bounds="[5,2149][1075,2186]"/></hierarchy>')
        self.assertEqual(qa.unobscured_tap_point(root, qa.find_node(root, 'QA set inventory offline'), 'QA set inventory offline', 1080, 2400), (106, 2269))

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

    @patch.object(qa.time, 'sleep')
    def test_obscured_target_scrolls_then_taps_only_visible_location(self, sleep):
        self.smoke.wait = Mock()
        hidden = qa.parse_ui('<hierarchy><node content-desc="Coming Soon" bounds="[300,2140][530,2337]"/><node text="QA inventory connection: online" bounds="[5,2149][1075,2186]"/></hierarchy>')
        clear = qa.parse_ui('<hierarchy><node content-desc="Coming Soon" bounds="[300,1000][530,1200]"/><node text="QA inventory connection: online" bounds="[5,2149][1075,2186]"/></hierarchy>')
        self.smoke.height = 2400
        self.smoke.ui = Mock(side_effect=[hidden, clear])
        self.smoke.scroll = Mock()
        self.smoke.tap('Coming Soon')
        self.smoke.scroll.assert_called_once()
        self.adb.run.assert_called_once_with('shell', 'input', 'tap', '415', '1100')

    @patch.object(qa.time, 'sleep')
    def test_still_obscured_target_fails_without_tapping(self, sleep):
        self.smoke.wait = Mock()
        hidden = qa.parse_ui('<hierarchy><node content-desc="Coming Soon" bounds="[300,2140][530,2337]"/><node text="QA inventory connection: online" bounds="[5,2149][1075,2186]"/></hierarchy>')
        self.smoke.height = 2400
        self.smoke.ui = Mock(return_value=hidden)
        self.smoke.scroll = Mock()
        with self.assertRaisesRegex(AssertionError, 'remains obscured'):
            self.smoke.tap('Coming Soon')
        self.adb.run.assert_not_called()

    def test_wait_fails_explicitly(self):
        with self.assertRaisesRegex(AssertionError, "Expected 'Missing' to be visible"):
            self.smoke.wait('Missing', seconds=0)

    def test_refresh_noop_fails_despite_previous_success_text(self):
        self.smoke.inventory_attempts = Mock(return_value=3)
        with self.assertRaisesRegex(AssertionError, 'did not initiate a new request'):
            self.smoke.wait_for_inventory_attempt(3, seconds=0)

    def test_refresh_requires_counter_increment(self):
        self.smoke.inventory_attempts = Mock(return_value=4)
        self.assertEqual(self.smoke.wait_for_inventory_attempt(3, seconds=0), 4)

    def test_refresh_counter_exact_label(self):
        self.smoke.ui = Mock(return_value=qa.parse_ui('<hierarchy><node text="QA inventory attempts: 12"/></hierarchy>'))
        self.assertEqual(self.smoke.inventory_attempts(), 12)

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
        self.smoke.ui = Mock(return_value=qa.parse_ui('<hierarchy><node package="com.android.launcher" text="Home" bounds="[0,0][1080,2400]"/></hierarchy>'))
        self.adb.run.return_value = 'mCurrentFocus=Window{123 com.android.launcher/.Launcher}'
        with self.assertRaisesRegex(AssertionError, 'not foreground'):
            self.smoke.back(SNAPSHOT['properties'][0])

    def test_api36_real_app_window_without_dumpsys_focus(self):
        fixture = Path(__file__).parent / 'fixtures/android-api36-app-window.xml'
        self.smoke.ui = Mock(return_value=qa.parse_ui(fixture.read_text()))
        self.adb.run.return_value = 'WINDOW MANAGER WINDOWS (dumpsys window windows)'
        self.smoke.foreground()
        self.assertIn('active packages', (Path(self.temp.name) / 'foreground-diagnostics.txt').read_text())

    def test_system_only_window_rejected(self):
        self.smoke.ui = Mock(return_value=qa.parse_ui('<hierarchy><node package="com.android.permissioncontroller" text="Allow notifications?" bounds="[0,0][1080,2400]"/></hierarchy>'))
        with self.assertRaisesRegex(AssertionError, 'not foreground'):
            self.smoke.foreground()

    def test_system_overlay_with_target_behind_rejected(self):
        self.smoke.ui = Mock(return_value=qa.parse_ui('<hierarchy><node package="com.aminvestments.nativeqatest" text="Property" bounds="[0,0][1080,2400]"/><node package="com.android.systemui" text="Dialog" bounds="[0,0][1080,2400]"/></hierarchy>'))
        with self.assertRaisesRegex(AssertionError, 'not foreground'):
            self.smoke.foreground()

    def test_blank_target_window_rejected(self):
        self.smoke.ui = Mock(return_value=qa.parse_ui('<hierarchy><node package="com.aminvestments.nativeqatest" bounds="[0,0][1080,2400]"/></hierarchy>'))
        with self.assertRaisesRegex(AssertionError, 'not foreground'):
            self.smoke.foreground()

    def test_address_input_safe_encoding_and_rejection(self):
        self.assertEqual(qa.adb_search_text('5113A Brookside Drive'), '5113A%sBrookside%sDrive')
        for unsafe in ('12 & 14 Street', '12; reboot', '$(id)', '12%sStreet', '12\nStreet', ''):
            with self.assertRaises(ValueError):
                qa.adb_search_text(unsafe)

    def test_open_property_searches_exact_fixture_address(self):
        prop = {'status': 'sold', 'address': '5113A Brookside Drive'}
        for method in ('launch', 'wait', 'select_status', 'top', 'tap'):
            setattr(self.smoke, method, Mock())
        self.smoke.open_property(prop)
        self.adb.run.assert_any_call('shell', 'input', 'text', '5113A%sBrookside%sDrive')
        self.smoke.tap.assert_any_call('View 5113A Brookside Drive', seek=True)
        self.smoke.wait.assert_any_call('Close property details')

    def test_replace_input_validates_before_touching_device(self):
        self.smoke.top = Mock()
        with self.assertRaises(ValueError):
            self.smoke.replace_input('Your agent name (optional)', 'bad; command')
        self.smoke.top.assert_not_called()
        self.adb.run.assert_not_called()

    def test_replace_input_verifies_value_and_dismisses_keyboard(self):
        self.smoke.top = Mock()
        self.smoke.tap = Mock()
        self.smoke.wait = Mock(return_value=qa.parse_ui('<hierarchy><node text="Test agent"/></hierarchy>').find('node'))
        self.smoke.replace_input('Your agent name (optional)', 'Test agent')
        self.adb.run.assert_any_call('shell', 'input', 'text', 'Test%sagent')
        self.adb.run.assert_any_call('shell', 'input', 'keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_A')
        self.adb.run.assert_any_call('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        self.smoke.wait.assert_any_call('Close property details')

    def test_replace_input_fails_if_text_was_appended_instead(self):
        self.smoke.top = Mock()
        self.smoke.tap = Mock()
        self.smoke.wait = Mock(return_value=qa.parse_ui('<hierarchy><node text="oldTest agent"/></hierarchy>').find('node'))
        with self.assertRaisesRegex(AssertionError, 'Input replacement failed'):
            self.smoke.replace_input('Your agent name (optional)', 'Test agent')

    def test_buyer_agent_never_taps_contacts_and_checks_restart_persistence(self):
        for method in ('open_property', 'tap', 'replace_input', 'seek', 'wait', 'top',
                       'gallery_evidence', 'select_status', 'foreground', 'launch', 'reset_buyer_agent'):
            setattr(self.smoke, method, Mock())
        sold = {'listingType': 'sale', 'status': 'sold', 'address': '2 Sold Street'}
        self.smoke.properties.append(sold)
        self.smoke.buyer_agent(SNAPSHOT['properties'][0])
        self.assertEqual([c.args[0] for c in self.smoke.open_property.call_args_list], [SNAPSHOT['properties'][0], SNAPSHOT['properties'][0], sold])
        self.smoke.launch.assert_not_called()
        tapped = [call.args[0] for call in self.smoke.tap.call_args_list]
        self.assertNotIn('Call your agent', tapped)
        self.assertNotIn('Text your agent about this property', tapped)
        self.assertIn('Cancel agent edit', tapped)
        self.assertIn('Clear your agent', tapped)
        self.assertEqual(tapped.count('View 2 Sold Street'), 1)
        self.smoke.replace_input.assert_any_call('Your agent US or Canada phone number', '3045550123')
        self.smoke.seek.assert_any_call('This property is sold. It is not listed as available to buy.')
        self.smoke.wait.assert_any_call('Call your agent', absent=True)
        self.adb.run.assert_not_called()

    def test_contact_reset_restricted_to_disposable_test_identity(self):
        self.smoke.package = 'com.example.production'
        with self.assertRaisesRegex(AssertionError, 'disposable QA app'):
            self.smoke.reset_buyer_agent()

    def test_contact_reset_requires_known_synthetic_value_before_clearing(self):
        self.smoke.package = 'com.aminvestments.nativeqatest'
        self.smoke.seek_any = Mock(side_effect=['Clear your agent', 'Test agent · +13045550123'])
        self.smoke.top = Mock()
        self.smoke.tap = Mock()
        self.smoke.seek = Mock()
        self.smoke.reset_buyer_agent()
        self.smoke.seek_any.assert_any_call(('Test agent · +13045550123', 'Updated agent · +13045550123'))
        self.smoke.tap.assert_called_once_with('Clear your agent', seek=True)

    def test_contact_reset_does_not_clear_unexpected_value(self):
        self.smoke.package = 'com.aminvestments.nativeqatest'
        self.smoke.seek_any = Mock(side_effect=['Clear your agent', AssertionError('unknown contact')])
        self.smoke.top = Mock()
        self.smoke.tap = Mock()
        with self.assertRaisesRegex(AssertionError, 'unknown contact'):
            self.smoke.reset_buyer_agent()
        self.smoke.tap.assert_not_called()

    def test_android_wrapper_timeout_change_is_bounded_and_preserves_source(self):
        spec = importlib.util.spec_from_file_location('wrapper', Path(__file__).resolve().parents[1] / 'scripts/configure_android_qa_wrapper.py')
        wrapper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(wrapper)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'gradle-wrapper.properties'
            original = 'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.4.1-bin.zip\nnetworkTimeout=10000\nvalidateDistributionUrl=true\n'
            path.write_text(original)
            wrapper.configure(path)
            self.assertEqual(path.read_text(), original.replace('networkTimeout=10000', 'networkTimeout=60000'))
            wrapper.configure(path)
            for invalid in [original.replace('https', 'http'), original.replace('services.gradle.org', 'untrusted.example'), original.replace('10000', '0')]:
                path.write_text(invalid)
                with self.assertRaises(ValueError):
                    wrapper.configure(path)
                self.assertEqual(path.read_text(), invalid)

    def test_gallery_captures_initial_next_and_wraparound(self):
        for method in ('open_property', 'seek', 'tap', 'wait'):
            setattr(self.smoke, method, Mock())
        self.smoke.evidence = Mock(return_value=[])
        self.smoke.gallery({'images': [{}, {}]})
        self.assertEqual([c.args[0] for c in self.smoke.evidence.call_args_list],
                         ['09-gallery-initial', '09-gallery-next', '09-gallery-wraparound'])

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


class EvidencePacking(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('pack_android_native_evidence',
            Path(__file__).resolve().parents[1] / 'scripts/pack_android_native_evidence.py')
        cls.pack = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.pack)

    def test_greedy_priority_required_and_manifest(self):
        pack = self.pack
        screens = {name: b'x' * size for name, size in [
            ('09-gallery-initial.png', 30), ('09-gallery-next.png', 30),
            ('01-cold-startup.png', 25), ('02-status.png', 20), ('03-small.png', 5)]}
        # Mock compressed size, isolating selection logic from compression ratios.
        with patch.object(pack, 'build_archive', side_effect=lambda files:
                          b'x' * (10 + sum(len(v) for k, v in files.items() if k.endswith('.png')))):
            data, manifest = pack.pack_evidence({'report.json': b'{}'}, screens, max_bytes=100)
        self.assertEqual(len(data), 100)
        self.assertEqual({x['name'] for x in manifest['selected']},
                         {'09-gallery-initial.png', '09-gallery-next.png', '01-cold-startup.png', '03-small.png'})
        self.assertEqual(manifest['skipped'][0]['name'], '02-status.png')
        self.assertEqual(manifest['selected'][0]['bytes'], 25)
        self.assertEqual(len(manifest['selected'][0]['sha256']), 64)

    def test_required_gallery_cannot_fit_fails(self):
        pack = self.pack
        with patch.object(pack, 'build_archive', side_effect=lambda files:
                          b'x' * (10 + sum(len(v) for k, v in files.items() if k.endswith('.png')))):
            with self.assertRaisesRegex(ValueError, 'Required initial/next gallery PNGs cannot fit'):
                pack.pack_evidence({}, {n: b'x' * 50 for n in pack.REQUIRED}, max_bytes=100)

    def test_textual_budget_overflow_fails(self):
        with patch.object(self.pack, 'build_archive', return_value=b'x' * 101):
            with self.assertRaisesRegex(ValueError, 'Textual evidence'):
                self.pack.pack_evidence({'report.json': b'{}'}, {}, max_bytes=100)

    def test_individually_oversize_png_recorded_not_transformed(self):
        with patch.object(self.pack, 'MAX_SCREENSHOT_BYTES', 2):
            data, manifest = self.pack.pack_evidence({}, {'09-gallery-initial.png': b'abc'})
        self.assertEqual(manifest['selected'], [])
        self.assertEqual(manifest['skipped'][0]['bytes'], 3)
        self.assertIn('individual', manifest['skipped'][0]['reason'])

    def test_real_archive_exact_bytes_hashes_and_all_text(self):
        import hashlib
        import io
        import tarfile
        files = {'report.json': b'{}', 'screen.xml': b'<hierarchy/>', 'apk.sha256': b'abc'}
        screens = {'09-gallery-initial.png': b'\x89PNG\r\n\x1a\nEXACT ORIGINAL BYTES',
                   '09-gallery-next.png': b'\x89PNG\r\n\x1a\nSECOND ORIGINAL BYTES'}
        data, manifest = self.pack.pack_evidence(files, screens)
        self.assertLessEqual(len(data), 4_800_000)
        self.assertEqual(data, self.pack.pack_evidence(files, screens)[0])
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
            for name, expected in dict(files, **screens).items():
                self.assertEqual(archive.extractfile(name).read(), expected)
            recorded = json.loads(archive.extractfile(self.pack.MANIFEST).read())
        for entry in recorded['selected']:
            self.assertEqual(entry['sha256'], hashlib.sha256(screens[entry['name']]).hexdigest())

    def test_collect_keeps_all_structured_evidence_and_bounds_text(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name, data in {'report.json': b'{}', 'ui.xml': b'<hierarchy/>',
                               'build.sha256': b'hash', 'crash-log.txt': b'0123456789',
                               'app.apk': b'NEVER INCLUDE', 'photo.png': b'PNG'}.items():
                (root / name).write_bytes(data)
            with patch.object(self.pack, 'MAX_DIAGNOSTIC_BYTES', 4):
                files, screens = self.pack.collect_files(root)
        self.assertEqual(set(files), {'report.json', 'ui.xml', 'build.sha256', 'crash-log.txt.tail.txt'})
        self.assertEqual(files['crash-log.txt.tail.txt'], b'6789')
        self.assertEqual(screens, {'photo.png': b'PNG'})


if __name__ == '__main__':
    unittest.main()
