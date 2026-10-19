"""Publish verified static files without changing the source checkout or history."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

try:
    from .retain_web_assets import retain_previous_assets
except ImportError:
    from retain_web_assets import retain_previous_assets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--web-dir", type=Path, required=True)
    args = parser.parse_args()
    directory = args.web_dir.resolve()
    if not (directory / "index.html").is_file() or not (directory / ".nojekyll").is_file():
        raise ValueError("Expected a verified Pages export with .nojekyll")
    report = json.loads(Path("test-results/hourly-refresh.json").read_text())
    if not report.get("passed"):
        raise ValueError("Publication requires a successful refresh verification report")
    repository = os.environ.get("GITHUB_REPOSITORY", "aminvestmentswv-ux/app")
    pages = json.loads(subprocess.check_output(["gh", "api", f"repos/{repository}/pages"], text=True))
    if (pages.get("cname") or "") != report.get("domain", ""):
        raise ValueError("Pages address changed after the build; rerun the refresh before publishing")

    def git(*arguments):
        return subprocess.check_output(["git", *arguments], text=True).strip()

    source_head = git("rev-parse", "HEAD")
    source_status = git("status", "--porcelain=v1", "--untracked-files=all")
    subprocess.run(["git", "fetch", "--depth=1", "origin", "gh-pages"], check=True)
    parent = git("rev-parse", "FETCH_HEAD")
    git_directory = git("rev-parse", "--absolute-git-dir")
    retained = retain_previous_assets(directory, parent, git_directory)
    print(f"Retained {retained} previous-build assets for cached app pages", flush=True)
    with tempfile.TemporaryDirectory(prefix="am-pages-index-") as temporary:
        environment = os.environ.copy()
        environment["GIT_INDEX_FILE"] = str(Path(temporary) / "index")
        command = [
            "git", "--git-dir", git_directory, "--work-tree", str(directory),
            "-c", "user.name=github-actions[bot]",
            "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        ]

        def isolated(*arguments, input=None):
            return subprocess.check_output(
                [*command, *arguments], cwd=directory, env=environment, input=input, text=True,
            ).strip()

        isolated("read-tree", "--empty")
        isolated("add", "--force", "--all", "--", ".")
        tree = isolated("write-tree")
        message = f"Refresh verified website inventory ({report['checkedAt']})\n"
        commit = isolated("commit-tree", tree, "-p", parent, input=message)
        subprocess.run(["git", "push", "origin", f"{commit}:refs/heads/gh-pages"], check=True)

    if git("rev-parse", "HEAD") != source_head or git("status", "--porcelain=v1", "--untracked-files=all") != source_status:
        raise RuntimeError("Source checkout changed during publication")

    endpoint = f"repos/{repository}/pages/builds"
    subprocess.run(["gh", "api", endpoint, "--method", "POST"], check=True)
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        build = json.loads(subprocess.check_output(["gh", "api", endpoint + "/latest"], text=True))
        print(f"Pages build: {build['status']} ({build['commit']})", flush=True)
        if build["commit"] == commit:
            if build["status"] == "built":
                url = os.environ.get("AM_APP_WEB_URL", "https://aminvestmentswv-ux.github.io/app/")
                print(f"Published {url} at {commit}", flush=True)
                return
            if build["status"] == "errored":
                raise RuntimeError(f"Pages build failed: {build.get('error')}")
        time.sleep(15)
    raise TimeoutError("Pages did not confirm the new deployment within ten minutes")


if __name__ == "__main__":
    main()
