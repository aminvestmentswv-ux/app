import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from scripts.sync_properties import fetch

URL = 'https://www.aminvestmentswv.com/property/917-chappell-rd/'
MODULE = 'scripts.sync_properties'


class FetchTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.cache = Path(temporary.name)
        sleeping = patch(MODULE + '.time.sleep')
        self.sleep = sleeping.start()
        self.addCleanup(sleeping.stop)

    def response(self, code=0, status=200, body='<html>verified source</html>',
                 final=URL, mime='text/html; charset=UTF-8'):
        def run(command, **options):
            self.assertEqual(options['timeout'], 35)
            self.assertEqual(command[command.index('--max-time') + 1], '30')
            self.assertEqual(command[command.index('--connect-timeout') + 1], '10')
            self.assertNotIn('--insecure', command)
            Path(command[command.index('--output') + 1]).write_text(body)
            return SimpleNamespace(returncode=code, stderr='temporary failure' if code else '',
                                   stdout=json.dumps({'http_code': status, 'url_effective': final, 'content_type': mime}))
        return run

    def request(self, responses):
        remaining = iter(responses)
        return patch(MODULE + '.subprocess.run', side_effect=lambda *args, **kwargs: next(remaining)(*args, **kwargs))

    def test_timeout_then_success_retries_and_caches_only_the_complete_response(self):
        with self.request([self.response(28, 0, body='partial'), self.response()]) as run:
            self.assertEqual(fetch(URL, self.cache), '<html>verified source</html>')
            self.assertEqual(fetch(URL, self.cache), '<html>verified source</html>')
        self.assertEqual(run.call_count, 2)
        self.sleep.assert_called_once_with(1)
        self.assertEqual(len(list(self.cache.iterdir())), 1)

    def test_transient_http_response_retries_without_caching_error_body(self):
        for status in [408, 429, 500, 502, 503, 504]:
            with self.subTest(status=status), tempfile.TemporaryDirectory() as temp:
                with self.request([self.response(22, status, body='error'), self.response()]):
                    self.assertEqual(fetch(URL, Path(temp)), '<html>verified source</html>')

    def test_three_failed_attempts_stop_and_leave_no_partial_cache(self):
        with self.request([self.response(28, 0)] * 3) as run:
            with self.assertRaisesRegex(RuntimeError, 'after 3 attempt'):
                fetch(URL, self.cache)
        self.assertEqual(run.call_count, 3)
        self.assertEqual([call.args[0] for call in self.sleep.call_args_list], [1, 2])
        self.assertEqual(list(self.cache.iterdir()), [])

    def test_denied_missing_certificate_and_bad_protocol_fail_without_retry(self):
        for code, status in [(22, 403), (22, 404), (60, 0), (35, 0), (1, 0)]:
            with self.subTest(code=code, status=status):
                with self.request([self.response(code, status)]) as run:
                    with self.assertRaisesRegex(RuntimeError, 'after 1 attempt'):
                        fetch(URL, self.cache)
                self.assertEqual(run.call_count, 1)
        self.sleep.assert_not_called()
        self.assertEqual(list(self.cache.iterdir()), [])

    def test_process_timeout_is_bounded_and_retryable(self):
        def expired(*args, **kwargs):
            raise subprocess.TimeoutExpired('curl', 35)
        with self.request([expired, self.response()]) as run:
            self.assertEqual(fetch(URL, self.cache), '<html>verified source</html>')
        self.assertEqual(run.call_count, 2)

    def test_unexpected_redirect_or_non_html_is_rejected_without_retry(self):
        for settings in [{'final': 'https://other.example/property/'}, {'final': 'http://www.aminvestmentswv.com/property/'}, {'mime': 'application/json'}, {'mime': 'text/html-malformed'}]:
            with self.subTest(settings=settings), self.request([self.response(**settings)]) as run:
                with self.assertRaises(RuntimeError):
                    fetch(URL, self.cache)
                self.assertEqual(run.call_count, 1)
        self.sleep.assert_not_called()
        self.assertEqual(list(self.cache.iterdir()), [])

    def test_invalid_transfer_metadata_fails_closed(self):
        with patch(MODULE + '.subprocess.run', return_value=SimpleNamespace(returncode=0, stdout='bad metadata', stderr='')):
            with self.assertRaisesRegex(RuntimeError, 'metadata was invalid'):
                fetch(URL, self.cache)
        self.sleep.assert_not_called()


if __name__ == '__main__':
    unittest.main()
