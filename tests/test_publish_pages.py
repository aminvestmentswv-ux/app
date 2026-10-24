import json
import unittest
from unittest.mock import patch

from scripts.publish_pages import wait_for_pages


class PagesPublicationTests(unittest.TestCase):
    def wait(self, builds, timeout=45):
        now = [0]

        def sleep(seconds):
            now[0] += seconds

        with patch('scripts.publish_pages.time.monotonic', side_effect=lambda: now[0]), \
             patch('scripts.publish_pages.time.sleep', side_effect=sleep), \
             patch('scripts.publish_pages.subprocess.check_output',
                   side_effect=[json.dumps(build) for build in builds]) as api:
            wait_for_pages('owner/app', 'new', timeout=timeout)
            return api

    def test_cancelled_attempt_error_does_not_hide_successful_replacement(self):
        api = self.wait([
            {'commit': 'new', 'status': 'errored', 'error': {'message': 'Page build failed.'}},
            {'commit': 'new', 'status': 'building'},
            {'commit': 'new', 'status': 'built'},
        ])
        self.assertEqual(api.call_count, 3)
        self.assertEqual(api.call_args.args[0], ['gh', 'api', 'repos/owner/app/pages/builds/latest'])

    def test_success_of_previous_commit_is_not_accepted(self):
        api = self.wait([
            {'commit': 'old', 'status': 'built'},
            {'commit': 'new', 'status': 'queued'},
            {'commit': 'new', 'status': 'built'},
        ])
        self.assertEqual(api.call_count, 3)

    def test_persistent_error_fails_with_diagnostics(self):
        failure = {'commit': 'new', 'status': 'errored', 'error': {'message': 'Page build failed.'}}
        with self.assertRaisesRegex(TimeoutError, 'Page build failed'):
            self.wait([failure, failure], timeout=30)

    def test_other_commit_never_confirms_publication(self):
        with self.assertRaisesRegex(TimeoutError, 'deployment of new'):
            self.wait([{'commit': 'old', 'status': 'built'}], timeout=15)
