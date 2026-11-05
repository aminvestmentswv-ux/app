from pathlib import Path
import tempfile
import unittest
from scripts.verify_refresh import verify_local_links


class ExportLinkTests(unittest.TestCase):
    def test_local_and_external_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'asset.js').write_text('hello')
            (root / 'index.html').write_text('<script src="/app/asset.js"></script><a href="?property=example">Open</a><a href="https://example.com/">Remote</a>')
            verify_local_links(root, '/app')
            (root / 'asset.js').unlink()
            with self.assertRaisesRegex(ValueError, 'Missing local'):
                verify_local_links(root, '/app')

    def test_missing_image_wrong_base_and_traversal(self):
        for url in ['/missing.png', '/app/missing.png', '/app/%2e%2e/private.png']:
            with self.subTest(url=url), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / 'index.html').write_text(f'<img src="{url}">')
                with self.assertRaises(ValueError):
                    verify_local_links(root, '/app')

    def test_nested_relative_link(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'nested').mkdir()
            (root / 'index.html').write_text('<a href="nested/">Open</a>')
            (root / 'nested/index.html').write_text('<a href="../index.html">Back</a>')
            verify_local_links(root, '')
