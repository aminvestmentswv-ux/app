from concurrent.futures import Future
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.sync_properties import sync

MODULE = 'scripts.sync_properties'


class SyncBatchTests(unittest.TestCase):
    def test_fatal_detail_failure_cancels_queued_requests_and_preserves_snapshot(self):
        good, failed, pending = Future(), Future(), Future()
        good.set_result({'id': 'first', 'status': 'sold'})
        failed.set_exception(ValueError('source unavailable'))
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'properties.json'
            output.write_text('previous verified snapshot')
            with patch(MODULE + '.fetch', return_value='archive'), patch(MODULE + '.parse_archive', return_value=(['a', 'b', 'c'], None)), patch(MODULE + '.ThreadPoolExecutor') as executor, patch(MODULE + '.as_completed', return_value=iter([good, failed])):
                executor.return_value.__enter__.return_value.submit.side_effect = [good, failed, pending]
                with self.assertRaisesRegex(ValueError, 'source unavailable'):
                    sync(output)
            self.assertTrue(pending.cancelled())
            self.assertEqual(output.read_text(), 'previous verified snapshot')

    def test_out_of_order_completions_preserve_source_order_and_rental_count(self):
        first, second, rental = Future(), Future(), Future()
        first.set_result({'id': 'first', 'status': 'sold'})
        second.set_result({'id': 'second', 'status': 'available'})
        rental.set_result(None)
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'properties.json'
            with patch(MODULE + '.fetch', return_value='archive'), patch(MODULE + '.parse_archive', return_value=(['a', 'b', 'c'], None)), patch(MODULE + '.ThreadPoolExecutor') as executor, patch(MODULE + '.as_completed', return_value=iter([rental, second, first])), patch(MODULE + '.apply_owner_overrides'), patch(MODULE + '.parse_coming_soon', return_value=[]), patch(MODULE + '.merge_coming_soon', side_effect=lambda properties, upcoming: properties):
                executor.return_value.__enter__.return_value.submit.side_effect = [first, second, rental]
                sync(output)
            snapshot = json.loads(output.read_text())
            self.assertEqual([p['id'] for p in snapshot['properties']], ['first', 'second'])
            self.assertEqual(snapshot['excludedNonSaleCount'], 1)
            self.assertEqual(snapshot['sourcePropertyCount'], 3)


if __name__ == '__main__':
    unittest.main()
