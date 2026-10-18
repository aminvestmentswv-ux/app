from pathlib import Path
import tempfile
import unittest

from PIL import Image
from scripts.pages_address import CUSTOM_DOMAIN, prepare_export, settings_for_domain
from scripts.verify_refresh import verify_export


class PagesAddressTests(unittest.TestCase):
    def export(self, root, base_path):
        (root / 'bundle.js').write_text('console.log("AM Investments app");')
        (root / 'index.html').write_text(
            '<title>AM Investments app</title>'
            f'<script src="{base_path}/bundle.js"></script>')
        Image.new('RGB', (2, 2)).save(root / 'am-investments-logo.jpg')

    def test_current_link_remains_usable_before_domain_activation(self):
        settings = settings_for_domain(None)
        self.assertEqual(settings['AM_APP_WEB_BASE_PATH'], '/app')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.export(root, '/app')
            prepare_export(root, '', '/app')
            self.assertFalse((root / 'CNAME').exists())
            self.assertEqual(verify_export(root, '/app', ''), 1)

    def test_custom_domain_uses_root_assets_and_persists_cname(self):
        settings = settings_for_domain(CUSTOM_DOMAIN)
        self.assertEqual(settings['AM_APP_WEB_URL'], 'https://app.aminvestmentswv.com/')
        self.assertEqual(settings['AM_APP_WEB_BASE_PATH'], '')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.export(root, '')
            prepare_export(root, CUSTOM_DOMAIN, '')
            self.assertEqual((root / 'CNAME').read_text(), CUSTOM_DOMAIN + '\n')
            self.assertEqual(verify_export(root, '', CUSTOM_DOMAIN), 1)
            (root / 'CNAME').unlink()
            with self.assertRaises(ValueError):
                verify_export(root, '', CUSTOM_DOMAIN)

    def test_wrong_base_path_or_unknown_domain_blocks_publication(self):
        with self.assertRaises(ValueError):
            settings_for_domain('example.com')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.export(root, '/app')
            with self.assertRaises(ValueError):
                prepare_export(root, CUSTOM_DOMAIN, '/app')
            with self.assertRaises(ValueError):
                verify_export(root, '', CUSTOM_DOMAIN)


if __name__ == '__main__':
    unittest.main()
