import contextlib
from email.message import Message
import hashlib
import io
import json
import os
from pathlib import Path
import ssl
import tempfile
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

from scripts.verify_published_startup import AGENTS, ORIGIN, fetch, verify

MODULE = 'scripts.verify_published_startup'


class PublishedStartupTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        (self.directory / 'home-screen-check').mkdir()
        files = [
            ('index.html', '<script src="/bundle.js"></script>', 'text/html'),
            ('manifest.webmanifest', json.dumps({'start_url': '/?launch=homescreen'}),
             'application/manifest+json'),
            ('home-screen-check/index.html', 'Static test page', 'text/html'),
            ('home-screen-check/app.html', 'Property app comparison', 'text/html'),
            ('bundle.js', 'app()', 'application/javascript'),
        ]
        self.responses = []
        for path, contents, mime in files:
            (self.directory / path).write_text(contents)
            self.responses.append((contents.encode(), mime, {'age': '0', 'x-cache': 'MISS'}))
        self.now = 0
        self.start_patch('time.monotonic', side_effect=lambda: self.now)
        self.sleep = self.start_patch('time.sleep', side_effect=self.advance)
        self.output = io.StringIO()
        output = contextlib.redirect_stdout(self.output)
        output.__enter__()
        self.addCleanup(output.__exit__, None, None, None)

    def start_patch(self, name, **kwargs):
        patcher = patch(MODULE + '.' + name, **kwargs)
        self.addCleanup(patcher.stop)
        return patcher.start()

    def advance(self, seconds):
        self.now += seconds

    def verify(self, **kwargs):
        return verify(self.directory, **kwargs)

    def test_actual_responses_must_match_export_for_both_agents(self):
        request = self.start_patch('fetch', side_effect=self.responses * 2)
        report = self.verify()
        self.assertEqual(set(report['agents']), {'safari', 'standalone'})
        self.assertEqual(report['attempts'], 1)
        self.assertEqual(request.call_count, 10)
        agents = [call.args[1] for call in request.call_args_list]
        self.assertIn('Safari/', agents[0])
        self.assertNotIn('Safari/', agents[-1])
        self.sleep.assert_not_called()

    def test_old_html_then_fresh_export_passes_all_checks_on_new_url(self):
        request = self.start_patch('fetch', side_effect=[(b'old HTML', 'text/html', {'age': '90', 'x-cache': 'HIT'})] + self.responses * 2)
        report = self.verify()
        self.assertEqual(report['attempts'], 2)
        self.assertEqual(request.call_count, 11)
        self.sleep.assert_called_once_with(10)
        first, second = [call.args[0] for call in request.call_args_list[:2]]
        self.assertNotEqual(first, second)
        self.assertTrue(first.endswith('-safari-1'))
        self.assertTrue(second.endswith('-safari-2'))
        self.assertIn('received sha256=' + hashlib.sha256(b'old HTML').hexdigest(), self.output.getvalue())
        self.assertIn('expected sha256=', self.output.getvalue())

    def test_late_standalone_failure_restarts_both_agents(self):
        responses = self.responses * 2
        responses[-1] = (b'old bundle', 'application/javascript', {})
        request = self.start_patch('fetch', side_effect=responses + self.responses * 2)
        self.assertEqual(self.verify()['attempts'], 2)
        self.assertEqual(request.call_count, 20)
        self.assertEqual(request.call_args_list[10].args[1], AGENTS['safari'])
        self.assertEqual(self.output.getvalue().count('Published iPhone safari responses verified'), 1)

    def test_permanent_mismatch_fails_at_attempt_limit_with_hash_and_mime(self):
        request = self.start_patch('fetch', return_value=(b'wrong', 'text/html', {}))
        with self.assertRaisesRegex(ValueError, 'failed after 3 attempt.*published HTML differs.*content-type=text/html'):
            self.verify(max_attempts=3)
        self.assertEqual(request.call_count, 3)
        self.assertEqual(self.sleep.call_count, 2)
        self.assertNotIn('responses verified', self.output.getvalue())

    def test_every_original_content_and_mime_guard_remains_required(self):
        failures = [
            (0, b'bad', 'text/html', 'HTML differs'),
            (0, self.responses[0][0], 'text/plain', 'HTML differs'),
            (1, b'not JSON', 'application/manifest+json', 'manifest differs'),
            (1, b'{}', 'application/manifest+json', 'manifest differs'),
            (2, b'bad', 'text/html', 'standalone test page differs'),
            (2, self.responses[2][0], 'text/plain', 'standalone test page differs'),
            (3, b'bad', 'text/html', 'property-app comparison differs'),
            (3, self.responses[3][0], 'text/plain', 'property-app comparison differs'),
            (4, b'bad', 'application/javascript', 'startup script differs'),
            (4, self.responses[4][0], 'text/plain', 'startup script differs'),
        ]
        for index, body, mime, message in failures:
            with self.subTest(index=index, mime=mime, message=message):
                responses = self.responses.copy()
                responses[index] = body, mime, {}
                with patch(MODULE + '.fetch', side_effect=responses):
                    with self.assertRaisesRegex(ValueError, message):
                        self.verify(max_attempts=1)

    def test_manifest_semantic_comparison_is_preserved(self):
        responses = self.responses.copy()
        responses[1] = b'{\n  "start_url" : "/?launch=homescreen"\n}', 'application/json', {}
        self.start_patch('fetch', side_effect=responses * 2)
        self.assertEqual(self.verify()['attempts'], 1)

    def test_transient_http_network_and_timeout_errors_are_retried(self):
        errors = [HTTPError(ORIGIN, 404, 'not propagated', {}, None),
                  HTTPError(ORIGIN, 503, 'unavailable', {}, None),
                  HTTPError(ORIGIN, 408, 'request timeout', {}, None),
                  HTTPError(ORIGIN, 429, 'retry later', {}, None),
                  ConnectionResetError('connection reset'),
                  URLError('temporary DNS failure'), TimeoutError('request timed out')]
        for error in errors:
            with self.subTest(error=error):
                with patch(MODULE + '.fetch', side_effect=[error] + self.responses * 2):
                    self.assertEqual(self.verify()['attempts'], 2)

    def test_redirect_certificate_and_nontransient_http_errors_fail_immediately(self):
        errors = [ValueError('Published startup redirected away from the app origin'),
                  URLError(ssl.SSLCertVerificationError('certificate invalid')),
                  HTTPError(ORIGIN, 403, 'forbidden', {}, None)]
        for error in errors:
            with self.subTest(error=error):
                with patch(MODULE + '.fetch', side_effect=error) as request:
                    with self.assertRaises(type(error)):
                        self.verify()
                    self.assertEqual(request.call_count, 1)
        self.sleep.assert_not_called()

    def test_invalid_local_manifest_fails_without_retry(self):
        (self.directory / 'manifest.webmanifest').write_text('not JSON')
        request = self.start_patch('fetch', side_effect=self.responses)
        with self.assertRaises(json.JSONDecodeError):
            self.verify()
        self.assertEqual(request.call_count, 1)
        self.sleep.assert_not_called()

    def test_unexpected_script_origin_is_not_retried(self):
        html = b'<script src="//other.example/bundle.js"></script>'
        (self.directory / 'index.html').write_bytes(html)
        responses = self.responses.copy()
        responses[0] = html, 'text/html', {}
        request = self.start_patch('fetch', side_effect=responses)
        with self.assertRaisesRegex(ValueError, 'Unexpected published startup script origin'):
            self.verify()
        self.assertEqual(request.call_count, 4)
        self.sleep.assert_not_called()

    def test_retry_window_does_not_allow_another_sleep_past_deadline(self):
        request = self.start_patch('fetch', return_value=(b'old HTML', 'text/html', {'age': '90', 'x-cache': 'HIT'}))
        with self.assertRaisesRegex(ValueError, 'failed after 2 attempt'):
            self.verify(timeout_seconds=15, retry_interval=10)
        self.assertEqual(request.call_count, 2)
        self.sleep.assert_called_once_with(10)
        self.assertEqual(request.call_args_list[-1].kwargs['timeout'], 5)

    def test_request_consuming_budget_fails_even_if_content_matches(self):
        def slow_response(*args, **kwargs):
            self.advance(5)
            return self.responses[0]
        request = self.start_patch('fetch', side_effect=slow_response)
        with self.assertRaisesRegex(ValueError, 'time budget exhausted'):
            self.verify(timeout_seconds=5)
        self.assertEqual(request.call_count, 1)
        self.assertEqual(request.call_args.kwargs['timeout'], 5)
        self.sleep.assert_not_called()

    def test_request_timeout_is_capped_at_thirty_seconds(self):
        request = self.start_patch('fetch', side_effect=self.responses * 2)
        self.verify()
        self.assertTrue(all(call.kwargs['timeout'] == 30 for call in request.call_args_list))

    def test_default_budget_exhaustion_remains_bounded(self):
        request = self.start_patch('fetch', return_value=(b'old HTML', 'text/html', {'age': '90', 'x-cache': 'HIT'}))
        with self.assertRaisesRegex(ValueError, 'failed after 72 attempt'):
            self.verify()
        self.assertEqual(request.call_count, 72)
        self.assertEqual(self.sleep.call_count, 71)
        self.assertEqual(self.now, 710)

    def test_cache_lifetime_expiry_can_recover_with_strict_checks_for_both_agents(self):
        stale = (b'previous build', 'text/html', {'age': '599', 'cache-control': 'max-age=600'})
        request = self.start_patch('fetch', side_effect=[stale] * 61 + self.responses * 2)
        report = self.verify()
        self.assertEqual(report['attempts'], 62)
        self.assertEqual(report['elapsedSeconds'], 610)
        self.assertEqual(set(report['agents']), {'safari', 'standalone'})
        self.assertEqual(request.call_count, 71)
        self.assertEqual(self.sleep.call_count, 61)
        self.assertTrue(all(0 < call.kwargs['timeout'] <= 30
                            for call in request.call_args_list))

    def test_propagation_after_two_minutes_can_recover_within_new_budget(self):
        stale = (b'previous build', 'text/html', {'age': '151', 'x-cache': 'HIT'})
        request = self.start_patch('fetch', side_effect=[stale] * 15 + self.responses * 2)
        report = self.verify()
        self.assertEqual(report['attempts'], 16)
        self.assertEqual(report['elapsedSeconds'], 150)
        self.assertEqual(request.call_count, 25)
        self.assertIn('"x-cache": "HIT"', self.output.getvalue())
        self.assertIn('elapsed=140s failed:', self.output.getvalue())
        self.assertNotIn('previous build', self.output.getvalue())

    def test_http_error_cache_diagnostics_use_allowlist(self):
        headers = Message()
        headers['Age'] = '75'
        headers['X-GitHub-Request-Id'] = 'public-request-id'
        headers['Set-Cookie'] = 'private-cookie'
        headers['Authorization'] = 'private-token'
        error = HTTPError(ORIGIN, 503, 'unavailable', headers, None)
        self.start_patch('fetch', side_effect=[error] + self.responses * 2)
        self.assertEqual(self.verify()['attempts'], 2)
        logged = self.output.getvalue()
        self.assertIn('"age": "75"', logged)
        self.assertIn('public-request-id', logged)
        self.assertNotIn('private-cookie', logged)
        self.assertNotIn('private-token', logged)

    def test_deployment_context_is_logged_on_failure_and_retained_on_success(self):
        environment = {'GITHUB_SHA': 'source-sha', 'GITHUB_RUN_ID': 'run-id',
                       'GITHUB_RUN_ATTEMPT': '2', 'AM_PAGES_DEPLOYMENT_ID': 'deployment-id',
                       'UNRELATED_SECRET': 'do-not-log'}
        with patch.dict(os.environ, environment, clear=True):
            with patch(MODULE + '.fetch', return_value=(b'old', 'text/html', {})):
                with self.assertRaises(ValueError):
                    self.verify(max_attempts=1)
            with patch(MODULE + '.fetch', side_effect=self.responses * 2):
                report = self.verify()
        self.assertEqual(report['deployment'], {'sourceCommit': 'source-sha',
                         'workflowRunId': 'run-id', 'workflowRunAttempt': '2',
                         'pagesDeploymentId': 'deployment-id'})
        self.assertIn('deployment-id', self.output.getvalue())
        self.assertNotIn('do-not-log', self.output.getvalue())

    def test_remaining_timeout_shrinks_during_one_complete_pass(self):
        responses = iter(self.responses * 2)
        def response(*args, **kwargs):
            self.advance(1)
            return next(responses)
        request = self.start_patch('fetch', side_effect=response)
        self.assertEqual(self.verify(timeout_seconds=12)['elapsedSeconds'], 10)
        self.assertEqual([call.kwargs['timeout'] for call in request.call_args_list],
                         list(range(12, 2, -1)))

    def test_invalid_retry_limits_are_rejected_before_network(self):
        request = self.start_patch('fetch')
        for kwargs in [{'max_attempts': 0}, {'timeout_seconds': 0}, {'retry_interval': -1}]:
            with self.assertRaises(ValueError):
                self.verify(**kwargs)
        request.assert_not_called()


class PublishedFetchTests(unittest.TestCase):
    def test_response_cache_headers_are_allowlisted_case_insensitive_and_bounded(self):
        response = MagicMock()
        response.geturl.return_value = ORIGIN + '/'
        response.read.return_value = b'HTML'
        response.headers = Message()
        response.headers['Content-Type'] = 'text/html'
        response.headers['AGE'] = '123'
        response.headers['ETag'] = '"build-id"'
        response.headers['X-Cache'] = 'HIT\t  MISS'
        response.headers['X-Served-By'] = 'cache-' + 'x' * 300
        response.headers['Set-Cookie'] = 'private-cookie'
        response.headers['Authorization'] = 'private-token'
        opener = MagicMock()
        opener.return_value.__enter__.return_value = response
        with patch(MODULE + '.urlopen', opener):
            body, mime, headers = fetch(ORIGIN + '/', AGENTS['safari'])
        self.assertEqual((body, mime), (b'HTML', 'text/html'))
        self.assertEqual(headers, {'age': '123', 'etag': '"build-id"',
                         'x-cache': 'HIT MISS', 'x-served-by': ('cache-' + 'x' * 300)[:200]})

    def test_fetch_preserves_agent_no_cache_origin_and_timeout_checks(self):
        response = MagicMock()
        response.geturl.return_value = ORIGIN + '/'
        response.read.return_value = b'HTML'
        response.headers.get_content_type.return_value = 'text/html'
        response.headers.get.side_effect = lambda name: None
        opener = MagicMock()
        opener.return_value.__enter__.return_value = response
        with patch(MODULE + '.urlopen', opener):
            self.assertEqual(fetch(ORIGIN + '/', AGENTS['safari'], timeout=7), (b'HTML', 'text/html', {}))
        request = opener.call_args.args[0]
        self.assertEqual(request.get_header('User-agent'), AGENTS['safari'])
        self.assertEqual(request.get_header('Cache-control'), 'no-cache')
        self.assertEqual(opener.call_args.kwargs['timeout'], 7)
        response.geturl.return_value = 'https://other.example/'
        with patch(MODULE + '.urlopen', opener):
            with self.assertRaisesRegex(ValueError, 'redirected away'):
                fetch(ORIGIN + '/', AGENTS['safari'])

    def test_fetch_does_not_multiply_retries(self):
        with patch(MODULE + '.urlopen', side_effect=TimeoutError) as opener:
            with self.assertRaises(TimeoutError):
                fetch(ORIGIN + '/', AGENTS['safari'])
        self.assertEqual(opener.call_count, 1)
