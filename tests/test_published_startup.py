import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.verify_published_startup import verify


class PublishedStartupTests(unittest.TestCase):
    def test_actual_responses_must_match_export_for_both_agents(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'home-screen-check').mkdir()
            (directory / 'index.html').write_text('<script src="/bundle.js"></script>')
            (directory / 'bundle.js').write_text('app()')
            (directory / 'manifest.webmanifest').write_text(json.dumps({'start_url': '/?launch=homescreen'}))
            (directory / 'home-screen-check/index.html').write_text('Static test page')
            responses = [((directory / p).read_bytes(), mime) for p, mime in [
                ('index.html', 'text/html'), ('manifest.webmanifest', 'application/manifest+json'),
                ('home-screen-check/index.html', 'text/html'), ('bundle.js', 'application/javascript')]]
            with patch('scripts.verify_published_startup.fetch', side_effect=responses * 2) as request:
                self.assertEqual(set(verify(directory)['agents']), {'safari', 'standalone'})
                agents = [call.args[1] for call in request.call_args_list]
                self.assertIn('Safari/', agents[0])
                self.assertNotIn('Safari/', agents[-1])
            with patch('scripts.verify_published_startup.fetch', return_value=(b'', 'text/html')):
                with self.assertRaisesRegex(ValueError, 'published HTML differs'):
                    verify(directory)
