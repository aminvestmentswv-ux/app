"""Keep Pages exports aligned with the address currently activated on GitHub."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess

CUSTOM_DOMAIN = "app.aminvestmentswv.com"
LEGACY_URL = "https://aminvestmentswv-ux.github.io/app/"


def settings_for_domain(domain):
    if domain not in (None, "", CUSTOM_DOMAIN):
        raise ValueError("Unexpected Pages custom domain; review before publishing")
    return {
        "AM_APP_WEB_DOMAIN": domain or "",
        "AM_APP_WEB_BASE_PATH": "" if domain else "/app",
        "AM_APP_WEB_URL": f"https://{domain}/" if domain else LEGACY_URL,
    }


def prepare_export(directory, domain, base_path):
    expected = settings_for_domain(domain)
    if base_path != expected["AM_APP_WEB_BASE_PATH"]:
        raise ValueError("The export base path does not match the selected domain")
    if not (directory / "index.html").is_file():
        raise ValueError("Build the app before preparing Pages files")
    (directory / ".nojekyll").touch()
    cname = directory / "CNAME"
    if domain:
        cname.write_text(domain + "\n")
    elif cname.exists():
        raise ValueError("An unselected custom domain is present in the export")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    options = parser.add_mutually_exclusive_group(required=True)
    options.add_argument("--github-env", type=Path)
    options.add_argument("--web-dir", type=Path)
    args = parser.parse_args()
    if args.github_env:
        repository = os.environ.get("GITHUB_REPOSITORY", "aminvestmentswv-ux/app")
        pages = json.loads(subprocess.check_output(["gh", "api", f"repos/{repository}/pages"], text=True))
        settings = settings_for_domain(pages.get("cname"))
        with args.github_env.open("a") as output:
            for key, value in settings.items():
                output.write(f"{key}={value}\n")
        print("Building for " + settings["AM_APP_WEB_URL"], flush=True)
    else:
        prepare_export(args.web_dir, os.environ.get("AM_APP_WEB_DOMAIN", ""),
                       os.environ.get("AM_APP_WEB_BASE_PATH", "/app"))


if __name__ == "__main__":
    main()
