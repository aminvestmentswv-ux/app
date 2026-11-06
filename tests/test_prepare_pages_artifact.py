import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from scripts.prepare_pages_artifact import retain_live, prepare


class ArtifactTests(unittest.TestCase):
    def test_live_manifest_cannot_escape_export(self):
        with tempfile.TemporaryDirectory() as temp:
            response = MagicMock()
            response.geturl.return_value = 'https://app.example/current-build-assets.json'
            response.read.return_value = json.dumps(['assets/../../outside']).encode()
            response.__enter__.return_value = response
            with patch('scripts.prepare_pages_artifact.urlopen', return_value=response):
                with self.assertRaisesRegex(ValueError, 'manifest'):
                    retain_live(Path(temp), 'https://app.example/')

    def test_actual_live_bundle_retained_without_replacing_current_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / 'current-build-assets.json').write_text('["assets/new.js"]')
            def response(url, **kwargs):
                item = MagicMock()
                item.geturl.return_value = url
                item.read.return_value = b'["assets/live.js"]' if url.endswith('.json') else b'old live bundle'
                item.__enter__.return_value = item
                return item
            with patch('scripts.prepare_pages_artifact.urlopen', side_effect=response):
                retain_live(directory, 'https://app.example/')
            self.assertEqual((directory / 'assets/live.js').read_bytes(), b'old live bundle')
            self.assertEqual(json.loads((directory / 'current-build-assets.json').read_text()), ['assets/new.js'])

    def test_unverified_export_never_changes_pages_settings(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            with patch('scripts.prepare_pages_artifact.Path.read_text', return_value='{"passed":false}'), patch('scripts.prepare_pages_artifact.api') as api:
                with self.assertRaisesRegex(ValueError, 'verified export'):
                    prepare(directory)
                api.assert_not_called()

    def test_workflow_mode_migration_changes_only_build_type(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / 'index.html').write_text('verified')
            pages = {'cname': 'app.aminvestmentswv.com', 'https_enforced': True, 'build_type': 'legacy'}
            ready = dict(pages, build_type='workflow')
            env = {'GITHUB_REPOSITORY': 'owner/app', 'AM_APP_WEB_DOMAIN': pages['cname'], 'AM_APP_WEB_URL': 'https://app.aminvestmentswv.com/'}
            with patch.dict('os.environ', env), patch('scripts.prepare_pages_artifact.Path.read_text', return_value=json.dumps({'passed': True, 'checkedAt': 'today', 'domain': pages['cname']})), patch('scripts.prepare_pages_artifact.api', side_effect=[pages, {}, ready]) as api, patch('scripts.prepare_pages_artifact.subprocess.check_output', return_value='parent'), patch('scripts.prepare_pages_artifact.retain_previous_assets'), patch('scripts.prepare_pages_artifact.retain_live'), patch('scripts.publish_pages.archive_export', return_value='export'):
                prepare(directory)
            self.assertEqual(api.call_args_list[1].args, ('owner/app', '--method', 'PUT', '-f', 'build_type=workflow'))

    def test_unexpected_domain_blocks_migration(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            (directory / 'index.html').write_text('verified')
            env = {'GITHUB_REPOSITORY': 'owner/app', 'AM_APP_WEB_DOMAIN': 'app.aminvestmentswv.com', 'AM_APP_WEB_URL': 'https://app.aminvestmentswv.com/'}
            with patch.dict('os.environ', env), patch('scripts.prepare_pages_artifact.Path.read_text', return_value='{"passed":true}'), patch('scripts.prepare_pages_artifact.api', return_value={'cname':'unexpected.example'}) as api:
                with self.assertRaisesRegex(ValueError, 'domain changed'):
                    prepare(directory)
                self.assertEqual(api.call_count, 1)
