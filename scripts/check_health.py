"""Validate public freshness metadata; no credentials or listing records included."""
from datetime import datetime, timezone
import argparse
import json
from pathlib import Path
import urllib.request
try:
    from scripts.refresh_schedule import inventory_is_current
except ModuleNotFoundError:
    from refresh_schedule import inventory_is_current


def check_timestamp(value, max_hours=4, now=None):
    timestamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if timestamp.tzinfo is None:
        raise ValueError('Freshness timestamp must include a timezone')
    age = ((now or datetime.now(timezone.utc)) - timestamp).total_seconds()
    if age < -300 or age > max_hours * 3600:
        raise ValueError('Import is stale or its timestamp is in the future')


def check_published_timestamp(value, now=None):
    timestamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if not inventory_is_current(timestamp, now):
        raise ValueError('Published import is stale or its timestamp is in the future')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path)
    parser.add_argument('--web-dir', type=Path)
    parser.add_argument('--url')
    args = parser.parse_args()
    if args.url:
        # A cache-busting request checks the published snapshot, not source main.
        url = args.url + '?check=' + str(int(datetime.now(timezone.utc).timestamp()))
        with urllib.request.urlopen(url, timeout=30) as response:
            if response.status != 200 or 'application/json' not in response.headers.get('Content-Type', ''):
                raise ValueError('Health endpoint must return HTTP 200 JSON')
            result = json.load(response)
        check_published_timestamp(result['checkedAt'])
        print('Published import is fresh')
    elif args.snapshot and args.web_dir:
        snapshot = json.loads(args.snapshot.read_text())
        check_timestamp(snapshot['checkedAt'], max_hours=1)
        (args.web_dir / 'health.json').write_text(json.dumps({
            'schemaVersion': 1, 'checkedAt': snapshot['checkedAt'],
        }) + '\n')
    else:
        parser.error('Use --url or both --snapshot and --web-dir')


if __name__ == '__main__':
    main()
