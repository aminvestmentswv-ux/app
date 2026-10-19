from pathlib import Path
import json
import shutil
import subprocess
import tempfile
import unittest

from scripts.retain_web_assets import MANIFEST, retain_previous_assets


class RetainWebAssetsTests(unittest.TestCase):
    def test_cached_bundle_survives_one_update_without_unbounded_accumulation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repository = root / 'repository'
            repository.mkdir()

            def git(*args):
                return subprocess.check_output(['git', '-C', str(repository), *args], text=True,
                                               stderr=subprocess.DEVNULL).strip()

            git('init', '--quiet')
            git('config', 'user.name', 'Test')
            git('config', 'user.email', 'test@example.com')

            def write(directory, name, content):
                target = directory / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content)

            old = '_expo/static/js/web/old.js'
            new = '_expo/static/js/web/new.js'
            last = '_expo/static/js/web/last.js'
            write(repository, old, 'old bundle')
            write(repository, 'assets/old-logo.jpg', 'old image')
            write(repository, 'index.html', 'old HTML must never be retained')
            git('add', '.')
            git('commit', '--quiet', '-m', 'Old publication')
            parent = git('rev-parse', 'HEAD')
            export = root / 'export'
            export.mkdir()
            write(export, new, 'new bundle')
            write(export, 'index.html', 'current HTML')
            self.assertEqual(retain_previous_assets(export, parent, repository / '.git'), 2)
            self.assertEqual((export / old).read_text(), 'old bundle')
            self.assertEqual((export / 'index.html').read_text(), 'current HTML')
            self.assertEqual(json.loads((export / MANIFEST).read_text()), [new])
            self.assertEqual(git('rev-parse', 'HEAD'), parent)
            self.assertEqual(git('status', '--porcelain'), '')

            for path in repository.iterdir():
                if path.name != '.git':
                    if path.is_dir():
                        shutil.rmtree(path)
                    else:
                        path.unlink()
            shutil.copytree(export, repository, dirs_exist_ok=True)
            git('add', '--all')
            git('commit', '--quiet', '-m', 'Next publication')
            final = root / 'final'
            final.mkdir()
            write(final, last, 'last bundle')
            retain_previous_assets(final, git('rev-parse', 'HEAD'), repository / '.git')
            self.assertTrue((final / new).is_file())
            self.assertFalse((final / old).exists())
            self.assertFalse((final / 'assets/old-logo.jpg').exists())
            self.assertEqual(json.loads((final / MANIFEST).read_text()), [last])
