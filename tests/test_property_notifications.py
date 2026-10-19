import json
from contextlib import chdir
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import uuid

from scripts.send_property_notifications import changed_properties, inventory, main, message_for, read_baseline, save_baseline
from scripts.prepare_web_push import prepare


def property(identifier='house-1', status='available'):
    return {'id': identifier, 'status': status, 'listingType': 'sale',
            'address': '123 Example Street', 'city': 'Charleston', 'state': 'WV'}


class NotificationTests(unittest.TestCase):
    def test_first_run_and_unchanged_properties_do_not_send_inventory_blasts(self):
        properties = [property(), property('next', 'coming-soon')]
        self.assertEqual(changed_properties(properties, None), [])
        self.assertEqual(changed_properties(properties, {'house-1': 'available', 'next': 'coming-soon'}), [])

    def test_only_new_or_changed_selected_statuses_generate_events(self):
        properties = [property('new'), property('changing', 'coming-soon'), property('sold', 'sold'),
                      property('contract', 'under-contract'), property('unchanged')]
        changes = changed_properties(properties, {'changing': 'available', 'sold': 'available',
                                                 'unchanged': 'available'})
        self.assertEqual([p['id'] for p in changes], ['new', 'changing'])

    def test_messages_have_exact_topic_filters_deep_links_and_retry_keys(self):
        identifier = 'two & three'
        for status, tag in [('available', 'am_available'), ('coming-soon', 'am_coming_soon')]:
            message = message_for(property(identifier, status), 'app-id', 'baseline-commit')
            self.assertEqual(message['filters'], [{'field': 'tag', 'key': tag, 'relation': '=', 'value': '1'}])
            self.assertNotIn('included_segments', message)
            self.assertEqual(message['web_url'], 'https://app.aminvestmentswv.com/?property=two+%26+three')
            self.assertTrue(message['isAnyWeb'])
            self.assertEqual(str(uuid.UUID(message['idempotency_key'])), message['idempotency_key'])
            self.assertEqual(message, message_for(property(identifier, status), 'app-id', 'baseline-commit'))
            self.assertNotEqual(message['idempotency_key'], message_for(property(identifier, status), 'app-id', 'next-baseline')['idempotency_key'])

    def test_invalid_or_duplicate_inventory_is_rejected_before_delivery(self):
        for properties in [[], [property(), property()], [property(status='unknown')]]:
            with self.assertRaises(ValueError):
                inventory({'schemaVersion': 1, 'properties': properties})

    def test_missing_service_configuration_does_not_read_state_or_contact_service(self):
        with patch.dict('os.environ', {}, clear=True), patch('scripts.send_property_notifications.read_baseline') as baseline:
            main(Path('does-not-exist.json'))
            baseline.assert_not_called()

    def test_failed_delivery_does_not_advance_baseline(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'snapshot.json'
            path.write_text(json.dumps({'schemaVersion': 1, 'checkedAt': '2026-10-19T00:00:00Z', 'properties': [property()]}))
            with patch.dict('os.environ', {'ONESIGNAL_APP_ID': '11111111-1111-4111-8111-111111111111',
                                          'ONESIGNAL_REST_API_KEY': 'test-key', 'AM_APP_WEB_URL': 'https://app.aminvestmentswv.com/'}, clear=True), \
                 patch('scripts.send_property_notifications.read_baseline', return_value=('baseline', {})), \
                 patch('scripts.send_property_notifications.send', side_effect=RuntimeError('Not delivered')), \
                 patch('scripts.send_property_notifications.save_baseline') as saved:
                with self.assertRaises(RuntimeError):
                    main(path)
                saved.assert_not_called()

    def test_install_metadata_uses_current_base_path_and_real_logo(self):
        for base in ['', '/app']:
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory)
                (path / 'index.html').write_text('<html><head><title>App</title></head><body></body></html>')
                prepare(path, base)
                prepare(path, base)
                manifest = json.loads((path / 'manifest.webmanifest').read_text())
                self.assertEqual(manifest['display'], 'standalone')
                self.assertEqual(manifest['start_url'], base + '/?launch=homescreen')
                self.assertEqual(manifest['id'], base + '/')
                html = (path / 'index.html').read_text()
                self.assertEqual(html.count('id="am-startup"'), 1)
                self.assertIn('AM-LOAD-01', html)
                probe = (path / 'home-screen-check/index.html').read_text()
                self.assertIn('This test page opened.', probe)
                self.assertNotIn('<script', probe)
                self.assertEqual((path / 'index.html').read_text().count('rel="manifest"'), 1)
                self.assertTrue((path / 'app-icons/icon-192.png').is_file())
                self.assertTrue((path / 'app-icons/icon-512.png').is_file())

    def test_baseline_commits_do_not_modify_the_source_checkout(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            remote, source = root / 'remote.git', root / 'source'
            def command(*args, cwd=None):
                return subprocess.check_output(['git', *args], cwd=cwd, text=True, stderr=subprocess.DEVNULL).strip()
            command('init', '--bare', '--quiet', str(remote))
            command('init', '--quiet', str(source))
            command('config', 'user.name', 'Test', cwd=source)
            command('config', 'user.email', 'test@example.com', cwd=source)
            command('remote', 'add', 'origin', str(remote), cwd=source)
            (source / 'source.txt').write_text('source remains untouched')
            command('add', '.', cwd=source)
            command('commit', '--quiet', '-m', 'Source', cwd=source)
            head = command('rev-parse', 'HEAD', cwd=source)
            with chdir(source):
                self.assertEqual(read_baseline('app'), (None, None))
                state = {'schemaVersion': 1, 'appId': 'app', 'statuses': {'house-1': 'coming-soon'}}
                save_baseline(state, None)
                parent, previous = read_baseline('app')
                self.assertEqual(previous, state['statuses'])
                state['statuses']['house-1'] = 'available'
                save_baseline(state, parent)
                updated, previous = read_baseline('app')
                self.assertNotEqual(parent, updated)
                self.assertEqual(previous, {'house-1': 'available'})
                self.assertEqual(command('rev-parse', 'HEAD'), head)
                self.assertEqual(command('status', '--porcelain'), '')
