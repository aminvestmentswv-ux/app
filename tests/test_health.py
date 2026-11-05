from datetime import datetime, timezone
import unittest
from scripts.check_health import check_timestamp


class HealthTests(unittest.TestCase):
    now = datetime(2026, 1, 2, 12, tzinfo=timezone.utc)

    def test_recent_and_equivalent_timezone(self):
        for value in ['2026-01-02T11:00:00Z', '2026-01-02T06:00:00-05:00']:
            check_timestamp(value, now=self.now)

    def test_stale_future_naive_and_malformed_fail(self):
        for value in ['2026-01-02T07:59:59Z', '2026-01-02T12:06:00Z',
                      '2026-01-02T11:00:00', 'not-a-date']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                check_timestamp(value, now=self.now)

    def test_publish_uses_stricter_freshness_than_watchdog(self):
        value = '2026-01-02T10:00:00Z'
        check_timestamp(value, now=self.now)
        with self.assertRaises(ValueError):
            check_timestamp(value, max_hours=1, now=self.now)

    def test_stale_import_cannot_overwrite_previous_marker(self):
        import json
        from pathlib import Path
        import tempfile
        from unittest.mock import patch
        from scripts.check_health import main
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            snapshot = root / 'snapshot.json'
            snapshot.write_text(json.dumps({'checkedAt': '2000-01-01T00:00:00Z'}))
            marker = root / 'health.json'
            marker.write_text('previous marker')
            with patch('sys.argv', ['check_health', '--snapshot', str(snapshot), '--web-dir', str(root)]):
                with self.assertRaises(ValueError):
                    main()
            self.assertEqual(marker.read_text(), 'previous marker')

    def test_marker_contains_no_listing_data(self):
        import json
        from pathlib import Path
        import tempfile
        from unittest.mock import patch
        from scripts.check_health import main
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            timestamp = datetime.now(timezone.utc).isoformat()
            snapshot = root / 'snapshot.json'
            snapshot.write_text(json.dumps({'checkedAt': timestamp, 'properties': [{'id': 'synthetic'}]}))
            with patch('sys.argv', ['check_health', '--snapshot', str(snapshot), '--web-dir', str(root)]):
                main()
            self.assertEqual(json.loads((root / 'health.json').read_text()),
                             {'schemaVersion': 1, 'checkedAt': timestamp})
