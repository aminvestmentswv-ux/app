import contextlib
import io
import os
import unittest
from unittest.mock import Mock, patch
from scripts import check_onesignal_auth as auth


class AuthenticationCheckTests(unittest.TestCase):
    def run_check(self, status=200, error=None, environment=None):
        factory = Mock()
        conn = factory.return_value
        conn.getresponse.return_value.status = status
        if error:
            conn.request.side_effect = error
        output = io.StringIO()
        env = environment if environment is not None else {
            'ONESIGNAL_APP_ID': auth.APP_ID,
            'ONESIGNAL_REST_API_KEY': 'synthetic-never-real-key',
        }
        with patch.dict(os.environ, env, clear=True), contextlib.redirect_stdout(output):
            result = auth.check(factory)
        self.assertNotIn('synthetic-never-real-key', output.getvalue())
        conn.getresponse.return_value.read.assert_not_called()
        return result, factory, output.getvalue()

    def test_success_is_only_get_to_fixed_app_and_closes(self):
        result, factory, output = self.run_check()
        self.assertEqual(result, 0)
        factory.assert_called_once_with('api.onesignal.com', timeout=20)
        factory.return_value.request.assert_called_once_with(
            'GET', '/apps/' + auth.APP_ID + '/segments?limit=1',
            headers={'Authorization': 'Key synthetic-never-real-key'})
        factory.return_value.close.assert_called_once()
        self.assertIn('HTTP 200', output)

    def test_failure_and_redirect_never_retry_or_read_body(self):
        for status in [301, 302, 401, 403, 429, 500]:
            with self.subTest(status=status):
                result, factory, _ = self.run_check(status)
                self.assertEqual(result, 1)
                self.assertEqual(factory.return_value.request.call_count, 1)

    def test_exception_details_suppressed(self):
        result, _, output = self.run_check(error=RuntimeError('synthetic-never-real-key'))
        self.assertEqual(result, 1)
        self.assertIn('transport error', output)

    def test_invalid_configuration_never_connects(self):
        for env in [{}, {'ONESIGNAL_APP_ID': 'wrong', 'ONESIGNAL_REST_API_KEY': 'x'},
                    {'ONESIGNAL_APP_ID': auth.APP_ID, 'ONESIGNAL_REST_API_KEY': 'bad key'}]:
            result, factory, _ = self.run_check(environment=env)
            self.assertEqual(result, 1)
            factory.assert_not_called()
