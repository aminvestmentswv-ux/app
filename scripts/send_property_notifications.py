"""Optional OneSignal delivery after a verified app publication.

Subscriber records stay in OneSignal. This repository stores only public property
IDs/statuses on a separate branch, advancing that baseline after successful sends.
Missing configuration is a safe no-op. The first configured run establishes a
baseline without sending the existing inventory to users.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import uuid

STATE_BRANCH = 'property-notification-state'
APP_URL = 'https://app.aminvestmentswv.com/'
TOPICS = {'available': 'am_available', 'coming-soon': 'am_coming_soon'}
STATUSES = {*TOPICS, 'under-contract', 'sold'}


def inventory(snapshot):
    if snapshot.get('schemaVersion') != 1 or not isinstance(snapshot.get('properties'), list):
        raise ValueError('Invalid notification inventory')
    result = {}
    for property in snapshot['properties']:
        identifier = property.get('id')
        if (not isinstance(identifier, str) or not identifier or identifier in result
                or property.get('listingType') != 'sale' or property.get('status') not in STATUSES
                or not isinstance(property.get('address'), str) or not property['address'].strip()):
            raise ValueError('Invalid or duplicate notification property')
        result[identifier] = property['status']
    if not result:
        raise ValueError('Refusing to use an empty notification inventory')
    return result


def changed_properties(properties, previous):
    if previous is None:
        return []
    return [p for p in properties if p['status'] in TOPICS and previous.get(p['id']) != p['status']]


def message_for(property, app_id, baseline_commit):
    topic = TOPICS[property['status']]
    key = str(uuid.uuid5(uuid.NAMESPACE_URL, f'{app_id}:{baseline_commit}:{property["id"]}:{property["status"]}'))
    return {
        'app_id': app_id, 'target_channel': 'push', 'isAnyWeb': True,
        'filters': [{'field': 'tag', 'key': topic, 'relation': '=', 'value': '1'}],
        'headings': {'en': 'New available property' if property['status'] == 'available' else 'Coming soon property'},
        'contents': {'en': property['address'] + (f' — {property["city"]}, {property["state"]}' if property.get('city') else '')},
        'web_url': APP_URL + '?' + urlencode({'property': property['id']}),
        'idempotency_key': key,
    }


def send(message, api_key):
    request = Request('https://api.onesignal.com/notifications?c=push',
                      data=json.dumps(message).encode(), method='POST',
                      headers={'Authorization': 'Key ' + api_key, 'Content-Type': 'application/json'})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                result = json.load(response)
            if result.get('id') or result.get('recipients') == 0 or result.get('errors') == ['All included players are not subscribed']:
                return
            raise RuntimeError('Push service did not accept the notification; baseline was not advanced')
        except HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == 2:
                raise RuntimeError(f'Push service returned HTTP {error.code}; baseline was not advanced') from None
        except (URLError, TimeoutError):
            if attempt == 2:
                raise RuntimeError('Push service could not be reached; baseline was not advanced') from None
        time.sleep(2 ** attempt)


def git(*args, input=None, environment=None, cwd=None):
    result = subprocess.run(['git', *args], input=input, text=True, capture_output=True,
                            env=environment, cwd=cwd)
    if result.returncode:
        raise RuntimeError('Notification state Git operation failed; inspect repository access')
    return result.stdout.strip()


def read_baseline(app_id):
    remote = subprocess.run(['git', 'ls-remote', '--exit-code', '--heads', 'origin',
                             f'refs/heads/{STATE_BRANCH}'], text=True, capture_output=True)
    if remote.returncode == 2:
        return None, None
    if remote.returncode:
        raise RuntimeError('Could not check the notification baseline; no notifications sent')
    git('fetch', '--depth=1', 'origin', f'refs/heads/{STATE_BRANCH}')
    parent = git('rev-parse', 'FETCH_HEAD')
    state = json.loads(git('show', f'{parent}:state.json'))
    if (state.get('schemaVersion') != 1 or not isinstance(state.get('statuses'), dict)
            or not all(isinstance(k, str) and v in STATUSES for k, v in state['statuses'].items())):
        raise ValueError('Invalid saved notification baseline; no notifications sent')
    return parent, state['statuses'] if state.get('appId') == app_id else None


def save_baseline(state, parent):
    git_directory = git('rev-parse', '--absolute-git-dir')
    with tempfile.TemporaryDirectory(prefix='am-push-state-') as temporary:
        directory = Path(temporary)
        (directory / 'state.json').write_text(json.dumps(state, indent=2) + '\n')
        environment = os.environ.copy()
        environment['GIT_INDEX_FILE'] = str(directory / 'index')
        prefix = ['--git-dir', git_directory, '--work-tree', str(directory),
                  '-c', 'user.name=github-actions[bot]',
                  '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com']

        def isolated(*args, input=None):
            return git(*prefix, *args, input=input, environment=environment, cwd=directory)

        isolated('read-tree', '--empty')
        isolated('add', '--force', '--', 'state.json')
        tree = isolated('write-tree')
        parents = ['-p', parent] if parent else []
        commit = isolated('commit-tree', tree, *parents, input='Record delivered property notification baseline\n')
        git('push', 'origin', f'{commit}:refs/heads/{STATE_BRANCH}')


def main(snapshot_path):
    app_id = os.environ.get('ONESIGNAL_APP_ID', '').strip()
    api_key = os.environ.get('ONESIGNAL_REST_API_KEY', '').strip()
    if not app_id or not api_key:
        print('Push delivery is not configured. Preferences are available; no notifications sent.')
        return
    try:
        uuid.UUID(app_id)
    except ValueError:
        raise ValueError('Invalid OneSignal app ID') from None
    if os.environ.get('AM_APP_WEB_URL') != APP_URL:
        raise ValueError('Push delivery requires the verified custom-domain publication')
    snapshot = json.loads(snapshot_path.read_text())
    statuses = inventory(snapshot)
    parent, previous = read_baseline(app_id)
    changes = changed_properties(snapshot['properties'], previous)
    for property in changes:
        send(message_for(property, app_id, parent), api_key)
    if previous != statuses:
        save_baseline({'schemaVersion': 1, 'appId': app_id,
                       'checkedAt': snapshot['checkedAt'], 'statuses': statuses}, parent)
    print('Notification baseline initialized without an inventory blast.' if previous is None
          else f'Processed {len(changes)} new or changed-status property notifications.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, default=Path('src/data/properties.json'))
    main(parser.parse_args().snapshot)
